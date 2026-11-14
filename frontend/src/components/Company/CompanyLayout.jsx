import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  Briefcase,
  FileCheck2,
  FileSignature,
  FileText,
  LayoutGrid,
  LogOut,
  Menu,
  Search,
  User,
  X,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { logout } from "../auth";
import { getCompanyProfile, listCompanyNotifications } from "../services";
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const NAV = [
  { to: "/company", label: "Accueil", icon: LayoutGrid, end: true },
  { to: "/company/offers", label: "Mes offres", icon: Briefcase },
  { to: "/company/applications", label: "Candidatures", icon: FileCheck2 },
  { to: "/company/convention", label: "Conventions", icon: FileSignature },
  { to: "/company/journals", label: "Journaux", icon: BookOpen },
  { to: "/company/reports", label: "Rapports", icon: FileText },
  { to: "/company/notifications", label: "Notifications", icon: Bell, badge: true },
  { to: "/company/profile", label: "Profil", icon: User },
];

function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function Sidebar({ company, unread, onNavigate, onLogout }) {
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-24 items-center gap-3 px-8">
        <span className="grid size-9 place-items-center rounded border border-ink/70 text-xs font-semibold text-ink">
          PC
        </span>
        <span className="text-lg font-semibold tracking-tight text-ink">PFE Connect</span>
      </div>

      <nav aria-label="Navigation entreprise" className="flex-1 overflow-y-auto px-5 pt-4">
        <ul className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end, badge }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  [
                    "relative flex items-center gap-4 rounded px-4 py-3 text-[15px] transition-colors",
                    focusRing,
                    isActive
                      ? "bg-primary-tint font-medium text-primary before:absolute before:-left-5 before:top-0 before:h-full before:w-[3px] before:bg-primary"
                      : "text-ink-soft hover:bg-bg hover:text-ink",
                  ].join(" ")
                }
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                {badge && unread > 0 && (
                  <span className="grid size-6 place-items-center rounded-full bg-accent text-xs font-semibold text-ink">
                    {unread}
                    <span className="sr-only"> non lues</span>
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mx-5 flex items-center gap-3 border-t border-line py-5">
        <span className="grid size-10 shrink-0 place-items-center rounded bg-primary-tint text-xs font-semibold text-primary">
          {company ? initials(company.name) : ""}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{company?.name ?? "…"}</p>
          <p className="text-xs text-ink-soft">Entreprise</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Se déconnecter"
          className={`grid size-9 place-items-center rounded text-ink-soft transition-colors hover:bg-bg hover:text-ink ${focusRing}`}
        >
          <LogOut className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default function CompanyLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [company, setCompany] = useState(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    getCompanyProfile()
      .then((profile) => active && setCompany(profile))
      .catch(() => {});
    listCompanyNotifications({ limit: 50 })
      .then((res) => active && setUnread(res.items.filter((n) => !n.read).length))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  function handleSearch(e) {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q")?.toString().trim();
    navigate(q ? `/company/applications?q=${encodeURIComponent(q)}` : "/company/applications");
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <a
        href="#contenu"
        className="sr-only z-50 rounded bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Aller au contenu
      </a>

      <aside className="fixed inset-y-0 left-0 hidden w-80 border-r border-line lg:block">
        <Sidebar company={company} unread={unread} onLogout={handleLogout} />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] border-r border-line shadow-xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Fermer le menu"
              className={`absolute right-3 top-7 z-10 grid size-9 place-items-center rounded text-ink-soft hover:bg-bg ${focusRing}`}
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            <Sidebar
              company={company}
              unread={unread}
              onNavigate={() => setDrawerOpen(false)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}

      <div className="lg:pl-80">
        <header className="sticky top-0 z-30 border-b border-line bg-bg">
          <div className="flex h-20 items-center gap-3 px-4 sm:px-8 lg:h-24 lg:px-14">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Ouvrir le menu"
              aria-expanded={drawerOpen}
              className={`grid size-10 place-items-center rounded text-ink lg:hidden ${focusRing}`}
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>

            <form role="search" onSubmit={handleSearch} className="relative flex-1">
              <label htmlFor="company-search" className="sr-only">
                Rechercher une candidature
              </label>
              <Search
                className="pointer-events-none absolute left-0 top-1/2 size-5 -translate-y-1/2 text-ink-soft"
                aria-hidden="true"
              />
              <input
                id="company-search"
                name="q"
                type="search"
                placeholder="Rechercher une candidature"
                className="w-full max-w-md rounded bg-transparent py-2 pl-8 pr-3 text-[15px] text-ink placeholder:text-ink-soft focus-visible:outline-2 focus-visible:outline-primary"
              />
            </form>

            <Link
              to="/company/notifications"
              aria-label={unread > 0 ? `Notifications, ${unread} non lues` : "Notifications"}
              className={`relative grid size-11 place-items-center rounded-full text-ink transition-colors hover:bg-surface ${focusRing}`}
            >
              <Bell className="size-5" aria-hidden="true" />
              {unread > 0 && (
                <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-accent ring-2 ring-bg" />
              )}
            </Link>

            <ThemeToggle />

            <Link
              to="/company/profile"
              aria-label="Profil de l’entreprise"
              className={`grid size-11 place-items-center rounded bg-primary-tint text-xs font-semibold text-primary ${focusRing}`}
            >
              {company ? initials(company.name) : ""}
            </Link>
          </div>
        </header>

        <main id="contenu" className="px-4 py-8 sm:px-8 lg:px-14 lg:py-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
