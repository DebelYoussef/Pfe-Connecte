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
import {
  getCompanyApplicationsToProcessCount,
  getCompanyConventionsToSignCount,
  getCompanyReportsToReviewCount,
  listCompanyNotifications,
  markCompanyNotificationRead,
} from "../../services.company";

const navigation = [
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
    badge: getCompanyConventionsToSignCount(),
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
  return (
    <AppShell
      roleLabel="Entreprise"
      navItems={navigation}
      profilePath="/company/profil"
      notificationRouteMap={notificationRouteMap}
      notificationService={notificationService}
    />
  );
}
