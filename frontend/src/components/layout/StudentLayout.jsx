import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  FileCheck2,
  FileText,
  LayoutDashboard,
  UserRound,
  UsersRound,
} from "lucide-react";
import AppShell from "./AppShell";
import useInternshipStatus from "../../hooks/useInternshipStatus";

const navigation = [
  { to: "/student", label: "Accueil", icon: LayoutDashboard, end: true },
  { to: "/student/offres", label: "Offres", icon: BriefcaseBusiness },
  { to: "/student/candidatures", label: "Candidatures", icon: FileCheck2 },
  {
    to: "/student/convention",
    label: "Convention",
    icon: FileText,
    lockWhen: "none",
  },
  {
    to: "/student/encadrant",
    label: "Encadrant",
    icon: UsersRound,
    lockWhen: "notApproved",
  },
  {
    to: "/student/journal",
    label: "Journal",
    icon: BookOpen,
    lockWhen: "notApproved",
  },
  {
    to: "/student/rapport",
    label: "Rapport",
    icon: FileText,
    lockWhen: "notApproved",
  },
  {
    to: "/student/notifications",
    label: "Notifications",
    icon: Bell,
    badge: "unread",
  },
  { to: "/student/profil", label: "Profil", icon: UserRound },
];

const notificationRouteMap = {
  APPLICATION: "/student/candidatures",
  CONVENTION: "/student/convention",
  SUPERVISION: "/student/encadrant",
  JOURNAL: "/student/journal",
  REPORT: "/student/rapport",
  PROFILE: "/student/profil",
};

export default function StudentLayout() {
  const { status } = useInternshipStatus();
  const navItems = navigation.map(({ lockWhen, ...item }) => {
    const locked =
      lockWhen === "none"
        ? status === "none"
        : lockWhen === "notApproved" && status !== "approved";
    return {
      ...item,
      locked,
      lockedTooltip: locked
        ? "Disponible après la validation de la convention"
        : undefined,
    };
  });

  return (
    <AppShell
      roleLabel="Étudiant"
      navItems={navItems}
      profilePath="/student/profil"
      notificationRouteMap={notificationRouteMap}
    />
  );
}
