import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  FileCheck2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import ThemeToggle from "../ThemeToggle";
import { getUser, logout } from "../../auth";

const nav = [
  { to: "/student", label: "Accueil", icon: LayoutDashboard },
  { to: "/student/offres", label: "Offres", icon: BriefcaseBusiness },
  { to: "/student/candidatures", label: "Candidatures", icon: FileCheck2 },
  { to: "/student/convention", label: "Convention", icon: FileText },
  { to: "/student/encadrant", label: "Encadrant", icon: UsersRound },
  { to: "/student/journal", label: "Journal", icon: BookOpen },
  { to: "/student/rapport", label: "Rapport", icon: FileText },
  {
    to: "/student/notifications",
    label: "Notifications",
    icon: Bell,
    badge: 2,
  },
  { to: "/student/profil", label: "Profil", icon: UserRound },
];
function Brand() {
  return (
    <Link to="/student" className="brand-mark">
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
    user.companyName ||
    user.email ||
    "Utilisateur";
  const initials =
    [user.firstName, user.lastName]
      .filter(Boolean)
      .map((value) => value[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";
  const active = (path) =>
    path === "/student"
      ? location.pathname === path
      : location.pathname.startsWith(path);
  function handleLogout() {
    setLogoutOpen(true);
  }
  function confirmLogout() {
    logout();
    setLogoutOpen(false);
    navigate("/login", { replace: true });
  }
  return (
    <div className="student-shell">
      <aside className={open ? "student-sidebar open" : "student-sidebar"}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="sidebar-close"
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav aria-label="Navigation étudiant">
          {nav.map(({ to, label, icon: Icon, badge }) => (
            <Link
              key={to}
              className={
                active(to) ? "student-nav-link active" : "student-nav-link"
              }
              to={to}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {badge && <span className="nav-badge">{badge}</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-row">
            <span className="user-avatar">{initials}</span>
            <span>
              <strong>{fullName}</strong>
              <small>Étudiant</small>
            </span>
            <button onClick={handleLogout} aria-label="Se déconnecter">
              <LogOut size={17} />
            </button>
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
          <button
            className="mobile-menu"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu size={21} />
          </button>
          <form
            className="dashboard-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(
                `/student/offres?q=${new FormData(e.currentTarget).get("q") || ""}`,
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
            <button className="icon-button" aria-label="Notifications">
              <Bell size={19} />
              <span className="notification-dot" />
            </button>
            <ThemeToggle />
            <span className="user-avatar" title={fullName}>
              {initials}
            </span>
          </div>
        </header>
        <main className="student-content">
          <Outlet />
        </main>
      </div>
      {logoutOpen && (
        <div
          className="logout-modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setLogoutOpen(false)
          }
        >
          <section
            className="logout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
          >
            <div className="logout-modal-icon">
              <LogOut size={19} />
            </div>
            <h2 id="logout-title">Se déconnecter ?</h2>
            <p>Votre session sera fermée sur cet appareil.</p>
            <div className="logout-modal-actions">
              <button
                type="button"
                className="modal-cancel"
                onClick={() => setLogoutOpen(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="modal-confirm"
                onClick={confirmLogout}
              >
                Se déconnecter
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
