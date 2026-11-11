import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  FileCheck2,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import ThemeToggle from "../ThemeToggle";
import NotificationBell from "../NotificationBell";
import IconButton from "../ui/IconButton";
import { getUser, logout } from "../../auth";
import useInternshipStatus from "../../hooks/useInternshipStatus";
import { NotificationsProvider } from "../../context/NotificationsContext";
const nav = [
  { to: "/student", label: "Accueil", icon: LayoutDashboard },
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
  { to: "/student/notifications", label: "Notifications", icon: Bell },
  { to: "/student/profil", label: "Profil", icon: UserRound },
];
function Brand() {
  return (
    <Link to="/student" className="brand-mark interactive">
      <span className="brand-monogram">PC</span>
      <span>PFE Connect</span>
    </Link>
  );
}
export default function StudentLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const user = getUser() || {};
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email ||
    "Utilisateur";
  const initials =
    [user.firstName, user.lastName]
      .filter(Boolean)
      .map((value) => value[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";
  const { status } = useInternshipStatus();
  const active = (path) =>
    path === "/student"
      ? location.pathname === path
      : location.pathname.startsWith(path);
  function confirmLogout() {
    logout();
    setLogoutOpen(false);
    navigate("/login", { replace: true });
  }
  return (
    <NotificationsProvider>
      <div className="student-shell">
        <aside className={open ? "student-sidebar open" : "student-sidebar"}>
          <div className="sidebar-brand">
            <Brand />
          </div>
          <nav aria-label="Navigation étudiant">
            {nav.map(({ to, label, icon: Icon, lockWhen }) => {
              const locked =
                lockWhen === "none"
                  ? status === "none"
                  : lockWhen === "notApproved" && status !== "approved";
              return (
                <Link
                  key={to}
                  className={
                    active(to)
                      ? "student-nav-link active interactive"
                      : "student-nav-link interactive"
                  }
                  to={to}
                  title={
                    locked
                      ? "Disponible après la validation de la convention"
                      : undefined
                  }
                  onClick={() => setOpen(false)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {locked && <Lock className="nav-lock" size={13} />}
                </Link>
              );
            })}
          </nav>
          <div className="sidebar-user">
            <div className="sidebar-user-row">
              <Link
                className="sidebar-user-link interactive"
                to="/student/profil"
                title="Mon profil"
              >
                <span className="user-avatar">{initials}</span>
                <span>
                  <strong>{fullName}</strong>
                  <small>Étudiant</small>
                </span>
              </Link>
              <IconButton
                label="Se déconnecter"
                tooltip="Se déconnecter"
                className="logout-button"
                onClick={() => setLogoutOpen(true)}
              >
                <LogOut size={17} />
              </IconButton>
            </div>
          </div>
        </aside>
        {open && (
          <button
            className="sidebar-overlay"
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
          />
        )}
        <div className="student-main">
          <header className="student-topbar">
            <IconButton
              label="Ouvrir le menu"
              tooltip="Ouvrir le menu"
              className="mobile-menu"
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </IconButton>
            <form
              className="dashboard-search"
              onSubmit={(event) => {
                event.preventDefault();
                navigate(
                  `/student/offres?q=${encodeURIComponent(new FormData(event.currentTarget).get("q") || "")}`,
                );
              }}
            >
              <Search size={17} />
              <input
                name="q"
                placeholder="Rechercher une offre"
                aria-label="Rechercher une offre"
              />
            </form>
            <div className="topbar-actions">
              <NotificationBell />
              <ThemeToggle />
              <Link
                className="user-avatar interactive"
                to="/student/profil"
                title="Mon profil"
              >
                {initials}
              </Link>
            </div>
          </header>
          <main className="student-content">
            <Outlet />
          </main>
        </div>
        {logoutOpen && (
          <div className="confirm-backdrop">
            <section
              className="confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="logout-title"
            >
              <h2 id="logout-title">Se déconnecter ?</h2>
              <p>Votre session sera fermée sur cet appareil.</p>
              <div>
                <button
                  className="modal-cancel interactive"
                  onClick={() => setLogoutOpen(false)}
                >
                  Annuler
                </button>
                <button
                  className="modal-confirm interactive"
                  onClick={confirmLogout}
                >
                  Se déconnecter
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </NotificationsProvider>
  );
}
