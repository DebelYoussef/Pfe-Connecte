import { Lock, LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { getUser, logout } from "../../auth";
import { NotificationsProvider, useNotifications } from "../../context/NotificationsContext";
import NotificationBell from "../NotificationBell";
import ConfirmDialog from "../ui/ConfirmDialog";
import IconButton from "../ui/IconButton";
import ThemeToggle from "../ThemeToggle";

function initialsFor(user) {
  return (
    [user?.firstName, user?.lastName]
      .filter(Boolean)
      .map((value) => value[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "U"
  );
}

function ShellContent({
  roleLabel,
  navItems,
  profilePath,
  notificationRouteMap,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const navigate = useNavigate();
  const user = getUser() || {};
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email ||
    "Utilisateur";
  const initials = initialsFor(user);
  const notifications = useNotifications();
  const basePath = profilePath.replace(/\/profil\/?$/, "");
  const notificationsPath = `${basePath}/notifications`;

  function confirmLogout() {
    logout();
    setLogoutOpen(false);
    navigate("/login", { replace: true });
  }

  return (
    <div className="student-shell">
      <aside className={menuOpen ? "student-sidebar open" : "student-sidebar"}>
        <div className="sidebar-brand">
          <Link to={navItems[0]?.to || basePath} className="brand-mark interactive">
            <span className="brand-monogram">PC</span>
            <span>PFE Connect</span>
          </Link>
        </div>
        <nav aria-label={`Navigation ${roleLabel.toLocaleLowerCase("fr")}`}>
          {navItems.map(
            ({
              to,
              label,
              icon: Icon,
              end = false,
              badge,
              locked = false,
              lockedTooltip,
            }) => {
              const badgeValue =
                badge === "unread" ? notifications?.unreadCount : badge;
              return (
                <NavLink
                  key={to}
                  className={({ isActive }) =>
                    isActive
                      ? "student-nav-link active interactive"
                      : "student-nav-link interactive"
                  }
                  to={to}
                  end={end}
                  title={locked ? lockedTooltip : label}
                  onClick={() => setMenuOpen(false)}
                >
                  {Icon && <Icon size={18} />}
                  <span className="student-nav-label">{label}</span>
                  {badgeValue > 0 && (
                    <span className="nav-badge">
                      {badgeValue > 99 ? "99+" : badgeValue}
                    </span>
                  )}
                  {locked && <Lock className="nav-lock" size={13} />}
                </NavLink>
              );
            },
          )}
        </nav>
        <div className="sidebar-user">
          <Link
            className="sidebar-user-link interactive"
            to={profilePath}
            title="Mon profil"
          >
            <span className="user-avatar">{initials}</span>
            <span>
              <strong>{fullName}</strong>
              <small>{roleLabel}</small>
            </span>
          </Link>
          <button
            className="logout-button interactive"
            type="button"
            onClick={() => setLogoutOpen(true)}
          >
            <LogOut size={16} />
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="sidebar-overlay"
          type="button"
          onClick={() => setMenuOpen(false)}
          aria-label="Fermer le menu"
        />
      )}
      <div className="student-main">
        <header className="student-topbar">
          <IconButton
            label="Ouvrir le menu"
            tooltip="Ouvrir le menu"
            className="mobile-menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={21} />
          </IconButton>
          <div className="topbar-actions">
            <NotificationBell
              notificationRouteMap={notificationRouteMap}
              notificationsPath={notificationsPath}
              homePath={basePath}
            />
            <ThemeToggle />
            <Link
              className="user-avatar interactive"
              to={profilePath}
              title="Mon profil"
            >
              {initials}
            </Link>
          </div>
        </header>
        <main className="student-content">
          <Outlet context={{ notificationRouteMap, homePath: basePath }} />
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

export default function AppShell({
  roleLabel,
  navItems,
  profilePath,
  notificationRouteMap,
  notificationService,
}) {
  return (
    <NotificationsProvider service={notificationService}>
      <ShellContent
        roleLabel={roleLabel}
        navItems={navItems}
        profilePath={profilePath}
        notificationRouteMap={notificationRouteMap}
      />
    </NotificationsProvider>
  );
}
