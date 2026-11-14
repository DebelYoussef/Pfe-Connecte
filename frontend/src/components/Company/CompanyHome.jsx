import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Briefcase,
  ChevronRight,
  FileCheck2,
  Inbox,
  ListChecks,
  Pencil,
  Plus,
  RotateCw,
  UserCheck,
} from "lucide-react";
import {
  getCompanyDashboard,
  getCompanyProfile,
  getCompanyTasks,
  listCompanyApplications,
  listCompanyNotifications,
  listMyOffers,
} from "../../services";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const APPLICATION_STATUS = {
  PENDING: { label: "En attente", className: "bg-accent-tint text-accent-ink" },
  VIEWED: { label: "Consultée", className: "bg-bg text-ink-soft border border-line" },
  IN_PROGRESS: { label: "En cours", className: "bg-primary-tint text-primary" },
  ACCEPTED: { label: "Acceptée", className: "bg-primary text-on-primary" },
};

const OFFER_STATUS = {
  OPEN: { label: "Ouverte", className: "bg-primary-tint text-primary" },
  CLOSED: { label: "Fermée", className: "bg-bg text-ink-soft border border-line" },
  FILLED: { label: "Pourvue", className: "bg-accent-tint text-accent-ink" },
};

const TASK_TYPE = {
  convention: "Convention",
  journal: "Journal",
  report: "Rapport",
};

const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

function relativeDate(iso) {
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
  return rtf.format(Math.round(diffSec / (86400 * 30)), "month");
}

function useResource(loader) {
  const [state, setState] = useState({ status: "loading", data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: "loading", data: null, error: null });
    loader()
      .then((data) => active && setState({ status: "success", data, error: null }))
      .catch((error) => active && setState({ status: "error", data: null, error }));
    return () => {
      active = false;
    };
  }, [loader, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

const loadProfile = () => getCompanyProfile();
const loadDashboard = () => getCompanyDashboard();
const loadApplications = () => listCompanyApplications({ limit: 5 });
const loadOffers = () => listMyOffers({ limit: 4 });
const loadTasks = () => getCompanyTasks();
const loadNotifications = () => listCompanyNotifications({ limit: 3 });

/* ---------- Shared bits ---------- */

function Skeleton({ className = "" }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded bg-skeleton ${className}`} />;
}

function ErrorBanner({ message, onRetry, tone = "default" }) {
  const onDark = tone === "onHero";
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center gap-3 rounded border px-4 py-3 text-sm ${
        onDark ? "border-danger/30 bg-surface text-ink" : "border-danger/30 bg-danger-tint text-ink"
      }`}
    >
      <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden="true" />
      <p className="flex-1">
        <span className="font-medium">Chargement impossible.</span>{" "}
        <span className="text-ink-soft">{message}</span>
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={`inline-flex items-center gap-2 rounded border border-line bg-surface px-3 py-1.5 font-medium text-ink transition-colors hover:bg-bg ${focusRing}`}
      >
        <RotateCw className="size-4" aria-hidden="true" />
        Réessayer
      </button>
    </div>
  );
}

function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded border border-dashed border-line px-6 py-8">
      <span className="grid size-10 place-items-center rounded bg-primary-tint text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div>
        <p className="font-medium text-ink">{title}</p>
        {text && <p className="mt-1 text-sm text-ink-soft">{text}</p>}
      </div>
      {action}
    </div>
  );
}

function PrimaryLink({ to, children, icon: Icon = ArrowUpRight }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-3 rounded bg-primary px-5 py-3.5 text-[15px] font-semibold text-on-primary transition-opacity hover:opacity-90 ${focusRing}`}
    >
      {children}
      <Icon className="size-4" aria-hidden="true" />
    </Link>
  );
}

function SecondaryLink({ to, children }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 rounded border border-primary px-5 py-3.5 text-[15px] font-semibold text-primary transition-colors hover:bg-primary-tint ${focusRing}`}
    >
      {children}
    </Link>
  );
}

function SmallLink({ to, children }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 rounded border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-bg ${focusRing}`}
    >
      {children}
    </Link>
  );
}

function SectionHeader({ id, eyebrow, title, action }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent-ink">{eyebrow}</p>
        )}
        <h2 id={id} className="font-serif text-3xl font-semibold tracking-tight text-ink">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function TextLink({ to, children, label }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className={`shrink-0 rounded text-sm font-medium text-primary hover:underline ${focusRing}`}
    >
      {children}
    </Link>
  );
}

function StatusBadge({ map, status }) {
  const s = map[status] ?? { label: status, className: "bg-bg text-ink-soft" };
  return (
    <span className={`inline-flex shrink-0 items-center rounded px-2 py-1 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}

/* ---------- Hero ---------- */

const STAT_TILES = [
  { key: "openOffers", label: "Offres ouvertes", icon: Briefcase, className: "bg-primary text-white dark:bg-[#1a5b6a]" },
  { key: "pendingApplications", label: "Candidatures à traiter", icon: FileCheck2, className: "bg-accent text-[#1d2729]" },
  { key: "confirmedInterns", label: "Stagiaires confirmés", icon: UserCheck, className: "bg-primary-strong text-white" },
];

function Hero({ profile, dashboard }) {
  return (
    <section aria-labelledby="hero-title" className="rounded bg-hero p-6 sm:p-10">
      <div className="grid items-center gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-accent-ink">
            Bonjour
            {profile.status === "success" && `, ${profile.data.name}`}
            {profile.status === "loading" && (
              <>
                {", "}
                <Skeleton className="inline-block h-3 w-28 align-middle" />
              </>
            )}
          </p>
          <h1 id="hero-title" className="text-balance font-serif text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            Gérez vos offres de stage
          </h1>
          <div className="mt-8 flex flex-wrap gap-3">
            <PrimaryLink to="/company/offers/new" icon={Plus}>
              Publier une offre
            </PrimaryLink>
            <SecondaryLink to="/company/applications">Voir les candidatures</SecondaryLink>
          </div>
        </div>

        <div aria-live="polite" aria-busy={dashboard.status === "loading"}>
          {dashboard.status === "error" ? (
            <ErrorBanner tone="onHero" message={dashboard.error.message} onRetry={dashboard.retry} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-3">
              {STAT_TILES.map(({ key, label, icon: Icon, className }, i) => (
                <li
                  key={key}
                  className={`relative flex min-h-36 flex-col justify-between overflow-hidden rounded p-5 ${className}`}
                >
                  <span className="text-sm opacity-80">{String(i + 1).padStart(2, "0")}</span>
                  <Icon
                    className="pointer-events-none absolute -bottom-3 -right-3 size-20 opacity-15"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <div className="relative">
                    {dashboard.status === "loading" ? (
                      <span aria-hidden="true" className="mb-2 block h-9 w-12 animate-pulse rounded bg-current opacity-20" />
                    ) : (
                      <p className="font-serif text-4xl font-bold leading-none">{dashboard.data[key]}</p>
                    )}
                    <p className="mt-2 text-sm font-medium leading-snug">{label}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- Recent applications ---------- */

function RecentApplications({ resource }) {
  const { status, data, error, retry } = resource;
  return (
    <section aria-labelledby="apps-title" className="flex flex-col gap-6">
      <SectionHeader
        id="apps-title"
        eyebrow="À traiter"
        title="Candidatures récentes"
        action={<TextLink to="/company/applications" label="Voir toutes les candidatures">Voir tout</TextLink>}
      />

      {status === "loading" && (
        <ul aria-busy="true" aria-label="Chargement des candidatures" className="divide-y divide-line border-y border-line">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center gap-4 py-4">
              <Skeleton className="size-10" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <Skeleton className="h-6 w-20" />
            </li>
          ))}
        </ul>
      )}

      {status === "error" && <ErrorBanner message={error.message} onRetry={retry} />}

      {status === "success" && data.items.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="Aucune candidature pour le moment"
          text="Les candidatures des étudiants apparaîtront ici dès qu’une offre sera publiée."
          action={<SmallLink to="/company/offers/new"><Plus className="size-4" aria-hidden="true" />Publier une offre</SmallLink>}
        />
      )}

      {status === "success" && data.items.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {data.items.map((app) => (
            <li key={app.id}>
              <Link
                to={`/company/applications/${app.id}`}
                className={`group flex items-center gap-4 py-4 ${focusRing}`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded border border-line bg-surface text-xs font-semibold text-primary">
                  {app.studentName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{app.studentName}</p>
                  <p className="truncate text-sm text-ink-soft">
                    {app.offerTitle}
                    <span aria-hidden="true"> · </span>
                    <time dateTime={app.createdAt}>{relativeDate(app.createdAt)}</time>
                  </p>
                </div>
                <StatusBadge map={APPLICATION_STATUS} status={app.status} />
                <ChevronRight className="size-5 shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- My offers ---------- */

function MyOffers({ resource }) {
  const { status, data, error, retry } = resource;
  return (
    <section aria-labelledby="offers-title" className="flex flex-col gap-6">
      <SectionHeader
        id="offers-title"
        title="Mes offres"
        action={<TextLink to="/company/offers" label="Voir toutes mes offres">Voir tout</TextLink>}
      />

      {status === "loading" && (
        <div aria-busy="true" aria-label="Chargement des offres" className="rounded border border-line bg-surface">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="size-8" />
            </div>
          ))}
        </div>
      )}

      {status === "error" && <ErrorBanner message={error.message} onRetry={retry} />}

      {status === "success" && data.items.length === 0 && (
        <EmptyState
          icon={Briefcase}
          title="Aucune offre publiée"
          text="Publiez votre première offre pour recevoir des candidatures d’étudiants."
          action={<SmallLink to="/company/offers/new"><Plus className="size-4" aria-hidden="true" />Publier une offre</SmallLink>}
        />
      )}

      {status === "success" && data.items.length > 0 && (
        <div className="overflow-x-auto rounded border border-line bg-surface">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">Vos dernières offres de stage</caption>
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-soft">
                <th scope="col" className="px-5 py-3 font-medium">Offre</th>
                <th scope="col" className="px-3 py-3 font-medium">Statut</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Candidatures</th>
                <th scope="col" className="px-5 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((offer) => (
                <tr key={offer.id}>
                  <th scope="row" className="px-5 py-4 font-semibold text-ink">
                    <Link to={`/company/offers/${offer.id}`} className={`rounded hover:underline ${focusRing}`}>
                      {offer.title}
                    </Link>
                  </th>
                  <td className="px-3 py-4"><StatusBadge map={OFFER_STATUS} status={offer.status} /></td>
                  <td className="px-3 py-4 text-right tabular-nums text-ink">{offer.applicationsCount}</td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      to={`/company/offers/${offer.id}/edit`}
                      aria-label={`Modifier l’offre ${offer.title}`}
                      className={`inline-grid size-8 place-items-center rounded text-ink-soft transition-colors hover:bg-primary-tint hover:text-primary ${focusRing}`}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------- Right panel ---------- */

function Tasks({ resource }) {
  const { status, data, error, retry } = resource;
  return (
    <section aria-labelledby="tasks-title" className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <h2 id="tasks-title" className="font-serif text-3xl font-semibold tracking-tight text-ink">À faire</h2>
        <TextLink to="/company/convention" label="Voir toutes les tâches">Voir tout</TextLink>
      </div>

      {status === "loading" && (
        <ul aria-busy="true" aria-label="Chargement des tâches" className="divide-y divide-line">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 py-4">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-4 flex-1" />
            </li>
          ))}
        </ul>
      )}

      {status === "error" && <ErrorBanner message={error.message} onRetry={retry} />}

      {status === "success" && data.length === 0 && (
        <EmptyState
          icon={ListChecks}
          title="Rien à traiter"
          text="Les conventions, journaux et rapports à valider apparaîtront ici."
          action={<SmallLink to="/company/applications">Voir les candidatures</SmallLink>}
        />
      )}

      {status === "success" && data.length > 0 && (
        <ul className="divide-y divide-line border-b border-line">
          {data.map((task) => (
            <li key={task.id}>
              <Link to={task.to} className={`group flex items-center gap-3 py-4 ${focusRing}`}>
                <span className="shrink-0 rounded bg-primary-tint px-2 py-1 text-xs font-medium text-primary">
                  {TASK_TYPE[task.type]}
                </span>
                <span className="flex-1 text-[15px] leading-snug text-ink">{task.label}</span>
                <ChevronRight className="size-5 shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentNotifications({ resource }) {
  const { status, data, error, retry } = resource;
  return (
    <section aria-labelledby="notif-title" className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <h2 id="notif-title" className="font-serif text-3xl font-semibold tracking-tight text-ink">
          Notifications récentes
        </h2>
        <TextLink to="/company/notifications" label="Voir toutes les notifications">Tout voir</TextLink>
      </div>

      {status === "loading" && (
        <ul aria-busy="true" aria-label="Chargement des notifications" className="space-y-4 py-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-24" />
            </li>
          ))}
        </ul>
      )}

      {status === "error" && <ErrorBanner message={error.message} onRetry={retry} />}

      {status === "success" && data.items.length === 0 && (
        <EmptyState
          icon={Bell}
          title="Aucune notification"
          text="Vous serez averti ici des nouvelles candidatures et signatures."
          action={<SmallLink to="/company/offers">Gérer mes offres</SmallLink>}
        />
      )}

      {status === "success" && data.items.length > 0 && (
        <ul className="divide-y divide-line">
          {data.items.map((n) => (
            <li key={n.id} className="flex gap-3 py-4">
              <span
                className={`mt-2 size-2 shrink-0 rounded-full ${n.read ? "bg-line" : "bg-accent"}`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className={`text-[15px] leading-snug ${n.read ? "text-ink-soft" : "font-medium text-ink"}`}>
                  {n.title}
                  {!n.read && <span className="sr-only"> (non lue)</span>}
                </p>
                <time dateTime={n.createdAt} className="mt-1 block text-xs text-ink-soft">
                  {relativeDate(n.createdAt)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- Page ---------- */

export default function CompanyHome() {
  const profile = useResource(loadProfile);
  const dashboard = useResource(loadDashboard);
  const applications = useResource(loadApplications);
  const offers = useResource(loadOffers);
  const tasks = useResource(loadTasks);
  const notifications = useResource(loadNotifications);

  useEffect(() => {
    document.title = "Accueil entreprise · PFE Connect";
  }, []);

  return (
    <div className="flex flex-col gap-12">
      <Hero profile={profile} dashboard={dashboard} />

      <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-0">
        <div className="flex flex-col gap-14 xl:pr-14">
          <RecentApplications resource={applications} />
          <MyOffers resource={offers} />
        </div>
        <aside aria-label="Tâches et notifications" className="flex flex-col gap-12 xl:border-l xl:border-line xl:pl-10">
          <Tasks resource={tasks} />
          <RecentNotifications resource={notifications} />
        </aside>
      </div>
    </div>
  );
}
