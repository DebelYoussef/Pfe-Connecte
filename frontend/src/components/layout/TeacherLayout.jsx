import {
  Bell,
  FileText,
  GraduationCap,
  LayoutDashboard,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "./AppShell";
import {
  getRequestedSupervisionCount,
  listTeacherNotifications,
  markTeacherNotificationRead,
  subscribeToTeacherData,
} from "../../services.teacher";

const notificationRouteMap = {
  SUPERVISION: "/teacher/demandes",
  REPORT: "/teacher/rapports",
  JOURNAL: "/teacher/etudiants/{refId}",
};

const notificationService = {
  listNotifications: listTeacherNotifications,
  markNotificationRead: markTeacherNotificationRead,
};

export default function TeacherLayout() {
  const [requestCount, setRequestCount] = useState(getRequestedSupervisionCount);
  const navItems = useMemo(
    () => [
      { to: "/teacher", label: "Tableau de bord", icon: LayoutDashboard, end: true },
      { to: "/teacher/etudiants", label: "Mes étudiants", icon: UsersRound },
      {
        to: "/teacher/demandes",
        label: "Demandes d'encadrement",
        icon: GraduationCap,
        badge: requestCount,
      },
      { to: "/teacher/rapports", label: "Rapports PFE", icon: FileText },
      {
        to: "/teacher/notifications",
        label: "Notifications",
        icon: Bell,
        badge: "unread",
      },
      { to: "/teacher/profil", label: "Mon profil", icon: UserRound },
    ],
    [requestCount],
  );

  useEffect(
    () =>
      subscribeToTeacherData(() =>
        setRequestCount(getRequestedSupervisionCount()),
      ),
    [],
  );

  return (
    <AppShell
      roleLabel="Enseignant"
      navItems={navItems}
      profilePath="/teacher/profil"
      notificationRouteMap={notificationRouteMap}
      notificationService={notificationService}
    />
  );
}
