import {
  Bell,
  CalendarDays,
  FileCheck2,
  FileSignature,
  LayoutDashboard,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import AppShell from "./AppShell";
import {
  RESPONSABLE_DATA_CHANGED_EVENT,
  getBlockedCount,
  getConventionsToSignCount,
  getWithoutSupervisorCount,
  listConventions,
  listNotifications,
  markNotificationRead,
} from "../../services.responsable";

const notificationRouteMap = {
  CONVENTION: "/responsable/conventions/{refId}",
  SUPERVISION: "/responsable/encadrement",
  REMINDER: "/responsable",
};

const notificationService = {
  listNotifications,
  markNotificationRead,
};

export default function ResponsableLayout() {
  const [, refresh] = useState(0);
  const [counts, setCounts] = useState({
    toSign: getConventionsToSignCount(),
    withoutSupervisor: getWithoutSupervisorCount(),
  });

  useEffect(() => {
    let active = true;
    const reload = async () => {
      try {
        const [all, withoutSupervisor] = await Promise.all([
          listConventions({ limit: 100 }),
          listConventions({ withoutSupervisor: true, limit: 100 }),
        ]);
        if (!active) return;
        setCounts({
          toSign: getConventionsToSignCount(all.items),
          withoutSupervisor: getWithoutSupervisorCount(withoutSupervisor.items),
        });
      } catch {
        // Les compteurs restent disponibles à partir du store local.
      }
    };
    void reload();
    const onChange = () => {
      refresh((value) => value + 1);
      void reload();
    };
    window.addEventListener(RESPONSABLE_DATA_CHANGED_EVENT, onChange);
    return () => {
      active = false;
      window.removeEventListener(RESPONSABLE_DATA_CHANGED_EVENT, onChange);
    };
  }, []);

  const navItems = [
    { to: "/responsable", label: "Accueil", icon: LayoutDashboard, end: true },
    {
      to: "/responsable/conventions",
      label: "Conventions",
      icon: FileSignature,
      badge: counts.toSign,
    },
    {
      to: "/responsable/encadrement",
      label: "Encadrement",
      icon: UsersRound,
      badge: counts.withoutSupervisor,
    },
    { to: "/responsable/modele", label: "Modèle de convention", icon: FileCheck2 },
    { to: "/responsable/echeance", label: "Échéance du PFE", icon: CalendarDays },
    { to: "/responsable/notifications", label: "Notifications", icon: Bell, badge: "unread" },
    { to: "/responsable/profil", label: "Mon profil", icon: UserRound },
  ];

  return (
    <AppShell
      roleLabel="Responsable"
      navItems={navItems}
      profilePath="/responsable/profil"
      notificationRouteMap={notificationRouteMap}
      notificationService={notificationService}
    />
  );
}
