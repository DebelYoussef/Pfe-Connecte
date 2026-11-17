import { ArrowRight, CalendarDays, FileSignature, GraduationCap, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ErrorBanner from "../../components/ErrorBanner";
import EmptyState from "../../components/ui/EmptyState";
import Skeleton from "../../components/ui/Skeleton";
import { useNotifications } from "../../context/NotificationsContext";
import { getUser } from "../../auth";
import {
  getBlockedCount,
  getDraftCount,
  getToSignConventions,
  getDeadlineSettings,
  getWithoutSupervisorCount,
  listConventions,
} from "../../services.responsable";

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date);
}

export default function ResponsableHome() {
  const user = getUser() || {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deadline, setDeadline] = useState(null);
  const notifications = useNotifications();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [result, deadlineResult] = await Promise.all([
        listConventions({ limit: 100 }),
        getDeadlineSettings(),
      ]);
      setItems(result.items);
      setDeadline(deadlineResult);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const toSign = getToSignConventions(items);
  const withoutSupervisorCount = getWithoutSupervisorCount(items);
  const blockedCount = getBlockedCount(items);
  const draftCount = getDraftCount(items);
  const attentionCards = [
    { label: "Conventions à signer", count: toSign.length, line: "Signature finale des conventions", icon: FileSignature, to: "/responsable/conventions" },
    { label: "Étudiants sans encadrant", count: withoutSupervisorCount, line: "Choisir un enseignant pour l’encadrement", icon: GraduationCap, to: "/responsable/encadrement" },
    { label: "Conventions bloquées depuis plus de 5 jours", count: blockedCount, line: "Reprendre les dossiers en attente", icon: TriangleAlert, to: "/responsable/conventions" },
    { label: "Conventions à corriger", count: draftCount, line: "Corriger puis remettre les brouillons", icon: FileSignature, to: "/responsable/conventions" },
  ].filter((card) => card.count > 0);

  const deadlineDate = deadline?.deadline ? new Date(`${deadline.deadline}T12:00:00`) : null;
  const remaining = deadlineDate
    ? Math.ceil((deadlineDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;

  return (
    <section className="student-page responsable-home">
      {error && (
        <ErrorBanner
          title="Impossible de charger l’accueil"
          message={error.message || "Une erreur est survenue."}
          onRetry={() => void load()}
        />
      )}
      <section className="responsable-hero">
        <div>
          <p className="eyebrow">Espace responsable</p>
          <h3 className="responsable-hero-title">
            Bonjour, {user.firstName || user.email?.split("@")[0] || "Responsable"}
          </h3>
          <p>{user.etab === "ETAB2" ? "Institut B" : "Institut A"} — Suivi des conventions et de l’encadrement.</p>
        </div>
        <CalendarDays size={26} aria-hidden="true" />
      </section>

      <section className="responsable-worklist">
        <div className="responsable-section-heading">
          <h3>À traiter</h3>
        </div>
        {loading ? (
          <div className="responsable-action-grid">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="responsable-action-skeleton" />)}
          </div>
        ) : !error && attentionCards.length ? (
          <div className="responsable-action-grid">
            {attentionCards.map(({ label, count, line, icon: Icon, to }) => (
              <Link className="responsable-action-card interactive" to={to} key={label}>
                <span className="responsable-action-icon"><Icon size={18} /></span>
                <span>
                  <strong>{label}</strong>
                  <small>{line}</small>
                </span>
                <b>{count}</b>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        ) : !error ? (
          <EmptyState
            title="Rien à traiter pour le moment"
            message="Toutes les conventions et demandes sont à jour."
            actionLabel="Voir les conventions"
            actionTo="/responsable/conventions"
          />
        ) : null}
      </section>

      <Link className="responsable-deadline-card interactive" to="/responsable/echeance">
        <CalendarDays size={18} />
        <span>
          <strong>Échéance du PFE</strong>
          {deadline?.deadlineEnabled && deadlineDate
            ? <small>{formatDate(deadlineDate)} · {remaining >= 0 ? `${remaining} jour${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""}` : "Échéance dépassée"}</small>
            : <small>Échéance désactivée</small>}
        </span>
        <ArrowRight size={16} />
      </Link>

      <div className="responsable-dashboard-columns">
        <section className="responsable-dashboard-card">
          <header>
            <h3>Conventions à signer</h3>
            <Link to="/responsable/conventions">Voir toutes</Link>
          </header>
          {loading ? (
            <Skeleton className="responsable-row-skeleton" />
          ) : toSign.length ? (
            <div className="responsable-preview-list">
              {toSign.slice(0, 5).map((item) => (
                <article key={item.conventionId}>
                  <div>
                    <strong>{item.studentName}</strong>
                    <small>{item.companyName}</small>
                  </div>
                  <span>{formatDate(item.stepSince)}</span>
                  <Link className="outlined-action" to={`/responsable/conventions/${item.conventionId}`}>Voir</Link>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Aucune convention à signer" message="Votre liste de signatures est vide." />
          )}
        </section>

        <section className="responsable-dashboard-card">
          <header><h3>Activité récente</h3></header>
          {notifications.loading ? (
            <Skeleton className="responsable-row-skeleton" />
          ) : notifications.items.length ? (
            <div className="responsable-activity-list">
              {notifications.items.slice(0, 5).map((item) => (
                <article key={item.id}>
                  <strong>{item.title}</strong>
                  <small>{formatDate(item.createdAt)}</small>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Aucune activité" message="Les nouvelles notifications apparaîtront ici." />
          )}
        </section>
      </div>
    </section>
  );
}
