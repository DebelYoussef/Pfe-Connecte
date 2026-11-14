import {
  Bell,
  FileText,
  GraduationCap,
  LayoutDashboard,
  UserRound,
  UsersRound,
} from "lucide-react";
import AppShell from "./AppShell";
import { requests } from "../../data/teacherMockData";
import {
  listTeacherNotifications,
  markTeacherNotificationRead,
} from "../../services.teacher";

const notificationRouteMap = {
  SUPERVISION: "/teacher/demandes",
  REPORT: "/teacher/rapports",
  JOURNAL: "/teacher/etudiants/{refId}",
};

const navItems = [
  { to: "/teacher", label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/teacher/etudiants", label: "Mes étudiants", icon: UsersRound },
  {
    to: "/teacher/demandes",
    label: "Demandes d'encadrement",
    icon: GraduationCap,
    badge: requests.filter((request) => request.status === "REQUESTED").length,
  },
  { to: "/teacher/rapports", label: "Rapports PFE", icon: FileText },
  { to: "/teacher/notifications", label: "Notifications", icon: Bell, badge: "unread" },
  { to: "/teacher/profil", label: "Mon profil", icon: UserRound },
];

const notificationService = {
  listNotifications: listTeacherNotifications,
  markNotificationRead: markTeacherNotificationRead,
};

export default function TeacherLayout() {
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
