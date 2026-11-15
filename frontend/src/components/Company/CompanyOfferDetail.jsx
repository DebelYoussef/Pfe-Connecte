import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Clock, Laptop2, MapPin, Pencil, Users } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import ErrorBanner from "../../components/ErrorBanner";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import StatusBadge from "../../components/ui/StatusBadge";
import Toast from "../../components/ui/Toast";
import {
  getOffer,
  updateOffer,
} from "../../services.company";

const WORK_MODE_LABELS = {
  ONSITE: "Sur site",
  HYBRID: "Hybride",
  REMOTE: "Télétravail",
};

const TRANSITIONS = {
  OPEN: [
    {
      status: "CLOSED",
      label: "Clôturer",
      title: "Clôturer cette offre ?",
      body: "L’offre disparaîtra de l’espace étudiant. Les candidatures déjà reçues resteront accessibles.",
    },
    {
      status: "FILLED",
      label: "Marquer comme pourvue",
      title: "Marquer cette offre comme pourvue ?",
      body: "L’offre sera indiquée comme pourvue et ne sera plus proposée aux étudiants.",
    },
  ],
  CLOSED: [
    {
      status: "OPEN",
      label: "Rouvrir",
      title: "Rouvrir cette offre ?",
      body: "L’offre redeviendra visible et les étudiants pourront à nouveau y postuler.",
    },
  ],
  FILLED: [],
};

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function AccessError({ status, message }) {
  const forbidden = status === 403;
  return (
    <section className="company-offer-error-page" role="alert">
      <PageHeader eyebrow="Espace entreprise" title={forbidden ? "Accès refusé" : "Offre introuvable"} />
      <p>{message || (forbidden ? "Vous ne pouvez pas consulter cette offre." : "Cette offre n’existe pas ou n’est plus disponible.")}</p>
      <Link className="company-primary-link" to="/company/offres">Retour à mes offres</Link>
    </section>
  );
}

export default function CompanyOfferDetail() {
  const { offerId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(location.state?.toast || "");

  const load = useCallback(async ({ keepError = false } = {}) => {
    setLoading(true);
    if (!keepError) setError(null);
    try {
      setOffer(await getOffer(offerId));
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [offerId]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    document.title = offer?.title
      ? `${offer.title} · PFE Connect`
      : "Détail de l’offre · PFE Connect";
  }, [offer?.title]);

  useEffect(() => {
    if (location.state?.toast)
      navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  async function confirmTransition() {
    if (!dialog || busy) return;
    setBusy(true);
    try {
      const updated = await updateOffer(offer.offerId, {
        status: dialog.status,
      });
      setOffer(updated);
      setToast(
        dialog.status === "OPEN"
          ? "Offre rouverte."
          : dialog.status === "CLOSED"
            ? "Offre clôturée."
            : "Offre marquée comme pourvue.",
      );
      setDialog(null);
    } catch (actionError) {
      setError(actionError);
      setDialog(null);
      if (actionError.status === 409) await load({ keepError: true });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="company-offer-detail-page" aria-busy="true">
        <Skeleton className="company-detail-skeleton-title" />
        <Skeleton className="company-detail-skeleton-block" />
        <Skeleton className="company-detail-skeleton-block" />
      </section>
    );
  }

  if (!offer && (error?.status === 403 || error?.status === 404))
    return <AccessError status={error.status} message={error.message} />;

  if (error && !offer) {
    return (
      <section className="company-offer-detail-page">
        <ErrorBanner
          title="Impossible de charger l’offre"
          message={error.message || "Veuillez réessayer."}
          onRetry={load}
        />
      </section>
    );
  }

  if (!offer) return <AccessError status={404} />;

  const transitions = TRANSITIONS[offer.status] || [];
  const closedLabel = offer.status === "CLOSED" ? "Clôturée" : undefined;

  return (
    <section className="company-offer-detail-page">
      <Link className="company-back-button" to="/company/offres">
        <ArrowLeft size={16} aria-hidden="true" />
        Retour à mes offres
      </Link>
      <PageHeader
        eyebrow="Détail de l’offre"
        title={offer.title}
        subtitle="Consultez les informations et gérez le statut de cette offre."
        action={
          <div className="company-detail-header-actions">
            {offer.status !== "FILLED" && (
              <Link className="company-secondary-button" to={`/company/offres/${offer.offerId}/modifier`}>
                <Pencil size={15} aria-hidden="true" />
                Modifier
              </Link>
            )}
            {transitions.map((transition) => (
              <button
                className="company-primary-button"
                type="button"
                key={transition.status}
                onClick={() => setDialog(transition)}
              >
                {transition.label}
              </button>
            ))}
          </div>
        }
      />

      {error && (
        <ErrorBanner
          title="Modification impossible"
          message={error.message || "Veuillez réessayer."}
          onRetry={load}
        />
      )}

      {offer.similar?.length > 0 && (
        <aside className="company-similar-banner" aria-label="Sujets similaires détectés">
          <strong>Sujets similaires détectés</strong>
          <ul>
            {offer.similar.map((subject) => (
              <li key={subject.subjectId}>
                Sujet {subject.subjectId} · {Math.round(subject.score * 100)} %
              </li>
            ))}
          </ul>
        </aside>
      )}

      <div className="company-offer-detail-grid">
        <div className="company-offer-detail-main">
          <section className="company-detail-card">
            <div className="company-detail-card-heading">
              <h2>Description</h2>
              <StatusBadge status={offer.status} label={closedLabel} />
            </div>
            <p className="company-offer-description">{offer.description}</p>
          </section>

          <section className="company-detail-card">
            <h2>Compétences demandées</h2>
            {offer.skills?.length ? (
              <ul className="company-detail-tags">
                {offer.skills.map((skill) => <li key={skill}>{skill}</li>)}
              </ul>
            ) : <p>Aucune compétence précisée.</p>}
          </section>

          <section className="company-detail-card">
            <h2>Mots-clés</h2>
            {offer.keywords?.length ? (
              <ul className="company-detail-tags">
                {offer.keywords.map((keyword) => <li key={keyword}>{keyword}</li>)}
              </ul>
            ) : <p>Aucun mot-clé précisé.</p>}
          </section>
        </div>

        <aside className="company-offer-detail-aside">
          <section className="company-detail-card">
            <h2>Informations</h2>
            <ul className="company-offer-facts">
              <li><MapPin size={16} aria-hidden="true" /><span>Gouvernorat</span><strong>{offer.gouvernorat}</strong></li>
              <li><Clock size={16} aria-hidden="true" /><span>Durée</span><strong>{offer.durationWeeks} semaines</strong></li>
              <li><Laptop2 size={16} aria-hidden="true" /><span>Mode de travail</span><strong>{WORK_MODE_LABELS[offer.workMode] || "À préciser"}</strong></li>
              <li><CalendarDays size={16} aria-hidden="true" /><span>Publication</span><strong>{formatDate(offer.createdAt)}</strong></li>
            </ul>
            <StatusBadge status={offer.status} label={closedLabel} />
          </section>
          <Link className="company-primary-link company-applications-link" to={`/company/candidatures?offer=${encodeURIComponent(offer.offerId)}`}>
            <Users size={17} aria-hidden="true" />
            Voir les candidatures
          </Link>
        </aside>
      </div>

      {dialog && (
        <ConfirmDialog
          open
          title={dialog.title}
          body={dialog.body}
          confirmLabel={busy ? "Enregistrement…" : dialog.label}
          onCancel={() => setDialog(null)}
          onConfirm={confirmTransition}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
