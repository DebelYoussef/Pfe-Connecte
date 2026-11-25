import {
  Bell,
  Home,
  LogOut,
  School,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { getUser, logout } from "../../auth";
import { AdminOverviewProvider, useAdminOverview } from "../../context/AdminOverviewContext";
import { NotificationsProvider, useNotifications } from "../../context/NotificationsContext";
import ConfirmDialog from "../ui/ConfirmDialog";
import IconButton from "../ui/IconButton";
import NotificationBell from "../NotificationBell";
import ThemeToggle from "../ThemeToggle";

const notificationRouteMap = {
  INSTITUTION: "/admin/etablissements/{refId}",
  USER: "/admin/comptes",
  CONVENTION: "/admin/etablissements",
};

function AdminShell() {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const user = getUser() || {};
  const navigate = useNavigate();
  const { overview } = useAdminOverview();
  const { unreadCount } = useNotifications();

  function confirmLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const links = [
    { to: "/admin", label: "Accueil", icon: Home, end: true },
    { to: "/admin/comptes", label: "Comptes", icon: UsersRound },
    {
      to: "/admin/etablissements",
      label: "Établissements",
      icon: School,
      badge: overview?.institutionsWithoutResponsable?.length,
    },
    {
      to: "/admin/notifications",
      label: "Notifications",
      icon: Bell,
      badge: unreadCount,
    },
  ];

  return (
    <div className="student-shell">
      <aside className="student-sidebar">
        <div className="sidebar-brand">
          <Link to="/admin" className="brand-mark interactive">
            <span className="brand-monogram">PC</span>
            <span>PFE Connect</span>
          </Link>
        </div>
        <nav aria-label="Navigation administrateur">
          {links.map(({ to, label, icon: Icon, end = false, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                isActive
                  ? "student-nav-link active interactive"
                  : "student-nav-link interactive"
              }
            >
              <Icon size={18} />
              <span className="student-nav-label">{label}</span>
              {badge > 0 && <span className="nav-badge">{badge > 99 ? "99+" : badge}</span>}
              {to === "/admin/etablissements" && badge === 0 && overview && (
                <span className="nav-badge">0</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-row">
            <span className="user-avatar">
              {user.firstName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "A"}
            </span>
            <span>
              <strong>{user.email || "Administrateur"}</strong>
              <small>Administrateur</small>
            </span>
            <IconButton
              label="Se déconnecter"
              tooltip="Se déconnecter"
              className="logout-button"
              onClick={() => setLogoutOpen(true)}
            >
              <LogOut size={16} />
            </IconButton>
          </div>
        </div>
      </aside>
      <div className="student-main">
        <header className="student-topbar">
          <div className="topbar-actions">
            <NotificationBell
              notificationRouteMap={notificationRouteMap}
              notificationsPath="/admin/notifications"
              homePath="/admin"
            />
            <ThemeToggle />
          </div>
        </header>
        <main className="student-content">
          <Outlet context={{ notificationRouteMap, homePath: "/admin" }} />
        </main>
      </div>
      <ConfirmDialog
        open={logoutOpen}
        title="Se déconnecter ?"
        body="Votre session sera fermée sur cet appareil."
        confirmLabel="Se déconnecter"
        onCancel={() => setLogoutOpen(false)}
        onConfirm={confirmLogout}
      />
    </div>
  );
}

export default function AdminLayout() {
  return (
    <AdminOverviewProvider>
      <NotificationsProvider autoRefresh>
        <AdminShell />
      </NotificationsProvider>
    </AdminOverviewProvider>
  );
}
