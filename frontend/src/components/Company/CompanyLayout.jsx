import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  FileCheck2,
  FileSignature,
  FileText,
  LayoutDashboard,
  UserRound,
} from "lucide-react";
import AppShell from "../layout/AppShell";
import ErrorBanner from "../ErrorBanner";
import {
  COMPANY_DATA_CHANGED_EVENT,
  getCompanyApplicationsToProcessCount,
  getCompanyConventionsToSignCount,
  getCompanyReportsToReviewCount,
  listMyConventions,
  listCompanyNotifications,
  markCompanyNotificationRead,
} from "../../services.company";
import { countCompanyConventionActions } from "../../lib/conventionDocument";

const navigation = (conventionsToProcess) => [
  { to: "/company", label: "Accueil", icon: LayoutDashboard, end: true },
  { to: "/company/offres", label: "Mes offres", icon: BriefcaseBusiness },
  {
    to: "/company/candidatures",
    label: "Candidatures",
    icon: FileCheck2,
    badge: getCompanyApplicationsToProcessCount(),
  },
  {
    to: "/company/conventions",
    label: "Conventions",
    icon: FileSignature,
    badge: conventionsToProcess,
  },
  { to: "/company/journaux", label: "Journaux", icon: BookOpen },
  {
    to: "/company/rapports",
    label: "Rapports",
    icon: FileText,
    badge: getCompanyReportsToReviewCount(),
  },
  {
    to: "/company/notifications",
    label: "Notifications",
    icon: Bell,
    badge: "unread",
  },
  { to: "/company/profil", label: "Mon profil", icon: UserRound },
];

const notificationRouteMap = {
  APPLICATION: "/company/candidatures?offer={refId}",
  CONVENTION: "/company/conventions/{refId}",
  JOURNAL: "/company/journaux/{refId}",
  REPORT: "/company/rapports",
  OFFER: "/company/offres/{refId}",
};

const notificationService = {
  listNotifications: listCompanyNotifications,
  markNotificationRead: markCompanyNotificationRead,
};

export default function CompanyLayout() {
  const [conventionsToProcess, setConventionsToProcess] = useState(
    getCompanyConventionsToSignCount,
  );
  const [conventionsError, setConventionsError] = useState(null);

  const refreshConventions = useCallback(() => {
    listMyConventions({ limit: 100 })
      .then(({ items }) => {
        setConventionsToProcess(
          countCompanyConventionActions(items, items[0]?.companyId),
        );
        setConventionsError(null);
      })
      .catch(setConventionsError);
  }, []);

  useEffect(() => {
    const refresh = () => refreshConventions();
    refresh();
    window.addEventListener(COMPANY_DATA_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(COMPANY_DATA_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refreshConventions]);

  return (
    <>
      {conventionsError && (
        <ErrorBanner
          title="Impossible de charger le compteur des conventions"
          message={conventionsError.message || "Veuillez réessayer."}
          onRetry={refreshConventions}
        />
      )}
      <AppShell
        roleLabel="Entreprise"
        navItems={navigation(conventionsToProcess)}
        profilePath="/company/profil"
        notificationRouteMap={notificationRouteMap}
        notificationService={notificationService}
      />
    </>
  );
}
