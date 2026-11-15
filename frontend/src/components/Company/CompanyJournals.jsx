import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CheckCheck, Clock, PenLine, Search, Users } from "lucide-react";
import { CompanyAvatar, CompanyMetricCard } from "./CompanyVisuals";
import ErrorBanner from "../ErrorBanner";
import EmptyState from "../ui/EmptyState";
import PageHeader from "../ui/PageHeader";
import Skeleton from "../ui/Skeleton";
import {
  COMPANY_DATA_CHANGED_EVENT,
  listMyInterns,
} from "../../services.company";

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
    <section className="company-journals-page flex flex-col gap-6">
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
          <div className="company-stat-grid">
            <CompanyMetricCard icon={Users} label="Stagiaires" value={stats.interns} tone="teal" />
            <CompanyMetricCard icon={PenLine} label="Entrées à valider" value={stats.toValidate} tone="gold" />
            <CompanyMetricCard icon={CheckCheck} label="Entrées validées" value={stats.validated} tone="green" />
            <CompanyMetricCard icon={Clock} label="En retard" value={stats.late} tone="slate" />
          </div>

          <div className="company-journals-content flex flex-col gap-4">
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
              <div className="company-intern-list">
                {visible.map((intern) => {
                  const totalWeeks = intern.totalWeeks;
                  const progress = totalWeeks
                    ? Math.round((intern.validatedCount / totalWeeks) * 100)
                    : 0;
                  return (
                    <article className="company-intern-row" key={intern.studentId}>
                      <div className="company-intern-identity">
                        <CompanyAvatar name={intern.studentName} />
                        <div className="company-intern-copy">
                          <div className="company-intern-name-line">
                            <h3 className="company-person-name">{intern.studentName}</h3>
                            {intern.toValidateCount > 0 && (
                              <span className="company-count-pill">
                                {intern.toValidateCount} à valider
                              </span>
                            )}
                          </div>
                          <p className="company-intern-offer">{intern.offerTitle}</p>
                          <p className="company-intern-meta">
                            Début du stage : {formatDate(intern.startDate)} · {intern.etab}
                          </p>
                        </div>
                      </div>
                      <div className="company-intern-actions">
                        <div className="company-intern-progress">
                          <div
                            className="company-progress-track"
                            role="progressbar"
                            aria-label={`Semaines validées par ${intern.studentName}`}
                            aria-valuemin="0"
                            aria-valuemax={totalWeeks}
                            aria-valuenow={intern.validatedCount}
                          >
                            <span style={{ width: `${progress}%` }} />
                          </div>
                          <span>{intern.validatedCount} / {totalWeeks} semaines validées</span>
                        </div>
                        <Link
                          to={`/company/journaux/${encodeURIComponent(intern.studentId)}`}
                          className="company-secondary-button"
                        >
                          <BookOpen className="size-4" aria-hidden="true" />
                          Consulter
                        </Link>
                      </div>
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
