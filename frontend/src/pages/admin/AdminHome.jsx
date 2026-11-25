import { Link } from "react-router-dom";
import { ArrowRight, Building2, FileClock, Layers, UsersRound } from "lucide-react";
import ErrorBanner from "../../components/ErrorBanner";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import { useAdminOverview } from "../../context/AdminOverviewContext";

const roleLabels = {
  ETU: "Étudiants",
  ENT: "Entreprises",
  ENS: "Enseignants",
  RESP: "Responsables",
  ADM: "Administrateurs",
};

function daysSince(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function oldestTimestamp(items) {
  return items.reduce((oldest, item) => {
    const time = Date.parse(item.since);
    return Number.isNaN(time) ? oldest : Math.min(oldest, time);
  }, Number.POSITIVE_INFINITY);
}

export default function AdminHome() {
  const { overview, loading, error, refresh } = useAdminOverview();
  const institutions = overview?.institutionsWithoutResponsable || [];
  const departments = overview?.departmentsWithoutSpecialty || [];
  const conventions = overview?.conventionsWaitingForMissingResponsable || [];
  const oldest = oldestTimestamp(conventions);
  const ageInDays = Number.isFinite(oldest)
    ? daysSince(new Date(oldest).toISOString())
    : null;
  const hasIssues = institutions.length + departments.length + conventions.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Accueil"
        subtitle="Suivez les comptes et les éléments qui nécessitent une configuration."
      />
      {error && (
        <ErrorBanner
          title="Impossible de charger l’accueil administrateur"
          message={error.message || "Veuillez réessayer."}
          onRetry={() => void refresh()}
        />
      )}
      {loading && !overview ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-56 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-36 rounded-xl" />
        </>
      ) : overview ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2">
            <article className="admin-overview-card admin-overview-stat">
              <h3>Comptes créés cette semaine</h3>
              <strong>{overview.recentUsersCount}</strong>
            </article>
            <article className="admin-overview-card">
              <h3>Comptes par rôle</h3>
              <div className="admin-role-chips">
                {Object.entries(roleLabels).map(([role, label]) => (
                  <Link key={role} to={`/admin/comptes?role=${role}`}>
                    <span>{label}</span>
                    <strong>{overview.usersByRole?.[role] ?? 0}</strong>
                  </Link>
                ))}
              </div>
            </article>
          </section>

          {!hasIssues ? (
            <section className="admin-overview-empty" role="status">
              <Building2 size={26} />
              <h3>Tout est configuré</h3>
              <p>Aucun établissement, département ou convention ne nécessite d’intervention.</p>
            </section>
          ) : (
            <section className="space-y-3">
              <h2 className="admin-home-section-title">À configurer</h2>
              <div className="grid gap-4 lg:grid-cols-3">
                <article className="admin-overview-card">
                  <header className="admin-overview-card-heading">
                    <Building2 size={19} />
                    <h3>Établissements sans responsable</h3>
                    <strong>{institutions.length}</strong>
                  </header>
                  {institutions.length ? (
                    <ul>
                      {institutions.map((item) => (
                        <li key={item.id}>
                          <Link to={`/admin/etablissements/${encodeURIComponent(item.id)}`}>
                            {item.name}<ArrowRight size={14} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="admin-overview-muted">Aucun établissement concerné.</p>}
                </article>

                <article className="admin-overview-card">
                  <header className="admin-overview-card-heading">
                    <Layers size={19} />
                    <h3>Départements sans spécialité</h3>
                    <strong>{departments.length}</strong>
                  </header>
                  {departments.length ? (
                    <ul>
                      {departments.map((item) => (
                        <li key={item.id}>
                          <Link to={`/admin/etablissements/${encodeURIComponent(item.etab)}`}>
                            {item.name}<ArrowRight size={14} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="admin-overview-muted">Aucun département concerné.</p>}
                </article>

                <article className="admin-overview-card">
                  <header className="admin-overview-card-heading">
                    <FileClock size={19} />
                    <h3>Conventions en attente</h3>
                    <strong>{conventions.length}</strong>
                  </header>
                  <p className="admin-overview-wait">
                    {conventions.length
                      ? `La plus ancienne attend depuis ${ageInDays} ${ageInDays === 1 ? "jour" : "jours"}.`
                      : "Aucune convention en attente."}
                  </p>
                  {conventions.length > 0 && (
                    <Link className="admin-overview-action" to="/admin/etablissements">
                      Voir les établissements<ArrowRight size={14} />
                    </Link>
                  )}
                </article>
              </div>
            </section>
          )}
        </>
      ) : !error ? (
        <section className="admin-overview-empty">
          <UsersRound size={25} />
          <p>Les données administrateur ne sont pas disponibles.</p>
        </section>
      ) : null}
    </div>
  );
}
