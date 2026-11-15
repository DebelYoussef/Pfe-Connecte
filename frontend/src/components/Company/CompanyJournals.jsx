import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Search } from "lucide-react";
import ErrorBanner from "../ErrorBanner";
import EmptyState from "../ui/EmptyState";
import PageHeader from "../ui/PageHeader";
import Skeleton from "../ui/Skeleton";
import {
  COMPANY_DATA_CHANGED_EVENT,
  listMyInterns,
} from "../../services.company";

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : (parts[0] || "").slice(0, 2)
  ).toLocaleUpperCase("fr");
}

function formatDate(value) {
  if (!value) return "Date non disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date non disponible";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function StatCard({ label, value }) {
  return (
    <article className="rounded border border-line bg-surface p-4">
      <p className="text-sm text-ink-soft">{label}</p>
      <strong className="mt-2 block font-serif text-2xl font-semibold text-ink">
        {value}
      </strong>
    </article>
  );
}

export default function CompanyJournals() {
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("pending");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items } = await listMyInterns({ limit: 100 });
      setInterns(items);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (active) void load();
    };
    Promise.resolve().then(refresh);
    window.addEventListener(COMPANY_DATA_CHANGED_EVENT, refresh);
    return () => {
      active = false;
      window.removeEventListener(COMPANY_DATA_CHANGED_EVENT, refresh);
    };
  }, [load]);

  const stats = useMemo(
    () => ({
      interns: interns.length,
      toValidate: interns.reduce((total, intern) => total + intern.toValidateCount, 0),
      validated: interns.reduce((total, intern) => total + intern.validatedCount, 0),
      late: interns.reduce((total, intern) => total + intern.lateWeeks.length, 0),
    }),
    [interns],
  );

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("fr");
    return interns.filter((intern) => {
      const matchesTab = tab === "all" || intern.toValidateCount > 0;
      const matchesQuery = intern.studentName.toLocaleLowerCase("fr").includes(term);
      return matchesTab && matchesQuery;
    });
  }, [interns, query, tab]);

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Espace entreprise"
        title="Journaux"
        subtitle="Suivez les semaines de stage et validez les entrées de vos stagiaires."
      />

      {error && (
        <ErrorBanner
          title="Impossible de charger les journaux"
          message={error.message || "Une erreur est survenue. Réessayez."}
          onRetry={() => void load()}
        />
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Chargement">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-20 rounded" />
          ))}
          <Skeleton className="h-32 rounded sm:col-span-2 xl:col-span-4" />
          <Skeleton className="h-32 rounded sm:col-span-2 xl:col-span-4" />
        </div>
      ) : !error ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Stagiaires" value={stats.interns} />
            <StatCard label="Entrées à valider" value={stats.toValidate} />
            <StatCard label="Entrées validées" value={stats.validated} />
            <StatCard label="En retard" value={stats.late} />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div
                className="flex gap-2 overflow-x-auto border-b border-line"
                role="tablist"
                aria-label="Filtrer les stagiaires"
              >
                {[
                  {
                    id: "pending",
                    label: "À valider",
                    count: interns.filter((item) => item.toValidateCount > 0).length,
                  },
                  { id: "all", label: "Tous", count: interns.length },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.id}
                    onClick={() => setTab(item.id)}
                    className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${
                      tab === item.id
                        ? "border-primary text-primary"
                        : "border-transparent text-ink-soft hover:text-ink"
                    }`}
                  >
                    {item.label} · {item.count}
                  </button>
                ))}
              </div>
              <label className="flex min-h-10 items-center gap-2 rounded border border-line bg-surface px-3 text-ink-soft sm:w-80">
                <Search className="size-4 shrink-0" aria-hidden="true" />
                <span className="sr-only">Rechercher un stagiaire</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher un stagiaire"
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft"
                />
              </label>
            </div>

            {visible.length ? (
              <div className="grid gap-3">
                {visible.map((intern) => {
                  const totalWeeks = intern.totalWeeks;
                  const progress = totalWeeks
                    ? Math.round((intern.validatedCount / totalWeeks) * 100)
                    : 0;
                  return (
                    <article
                      key={intern.studentId}
                      className="grid gap-4 rounded border border-line bg-surface p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-5"
                    >
                      <div
                        className="grid size-11 place-items-center rounded-full bg-primary-tint text-sm font-semibold text-primary"
                        aria-hidden="true"
                      >
                        {initials(intern.studentName)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-ink">{intern.studentName}</h2>
                          {intern.toValidateCount > 0 && (
                            <span className="rounded bg-accent-tint px-2 py-1 text-xs font-medium text-accent-ink">
                              {intern.toValidateCount} à valider
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-ink-soft">{intern.offerTitle}</p>
                        <p className="mt-1 text-xs text-ink-soft">
                          Début du stage : {formatDate(intern.startDate)} · {intern.etab}
                        </p>
                        <div className="mt-3 flex items-center gap-3">
                          <div
                            className="h-1.5 min-w-20 flex-1 overflow-hidden rounded-full bg-line"
                            role="progressbar"
                            aria-label={`Semaines validées par ${intern.studentName}`}
                            aria-valuemin="0"
                            aria-valuemax={totalWeeks}
                            aria-valuenow={intern.validatedCount}
                          >
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-xs text-ink-soft">
                            {intern.validatedCount} / {totalWeeks} semaines validées
                          </span>
                        </div>
                      </div>
                      <Link
                        to={`/company/journaux/${encodeURIComponent(intern.studentId)}`}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-line px-4 text-sm font-semibold text-primary hover:bg-bg"
                      >
                        <BookOpen className="size-4" aria-hidden="true" />
                        Consulter
                      </Link>
                    </article>
                  );
                })}
              </div>
            ) : interns.length ? (
              <div className="rounded border border-line bg-surface p-6 text-center">
                <EmptyState
                  title="Aucun stagiaire trouvé"
                  message="Modifiez votre recherche ou affichez tous les stagiaires."
                />
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setTab("all");
                  }}
                  className="mt-3 text-sm font-semibold text-primary hover:underline"
                >
                  Afficher tous les stagiaires
                </button>
              </div>
            ) : (
              <EmptyState
                title="Aucun stagiaire à suivre"
                message="Les stagiaires ayant une convention approuvée apparaîtront ici."
                actionLabel="Voir les conventions"
                actionTo="/company/conventions"
              />
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}