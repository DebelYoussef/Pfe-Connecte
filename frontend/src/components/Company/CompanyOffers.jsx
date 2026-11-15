import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Clock, MapPin, Plus, Search } from "lucide-react";
import ErrorBanner from "../../components/ErrorBanner";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import StatusBadge from "../../components/ui/StatusBadge";
import Toast from "../../components/ui/Toast";
import {
  COMPANY_OFFER_FILTERS,
  getMyOfferStats,
  getOfferApplicationCounts,
  listMyOffers,
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

function OfferLoadingRows() {
  return (
    <div className="company-offer-table-wrap" aria-busy="true" aria-label="Chargement des offres">
      {Array.from({ length: 5 }, (_, index) => (
        <div className="company-offer-skeleton-row" key={index}>
          <Skeleton className="company-offer-skeleton-title" />
          <Skeleton className="company-offer-skeleton-meta" />
          <Skeleton className="company-offer-skeleton-meta" />
          <Skeleton className="company-offer-skeleton-badge" />
          <Skeleton className="company-offer-skeleton-action" />
        </div>
      ))}
    </div>
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function Stat({ label, value }) {
  return (
    <div className="company-offer-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function CompanyOffers() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [offers, setOffers] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, filled: 0, closed: 0 });
  const [applicationCounts, setApplicationCounts] = useState({});
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(
    async ({ keepError = false } = {}) => {
      if (!keepError) setError(null);
      setLoading(true);
      try {
        const page = await listMyOffers({ status: status || undefined, limit: 5 });
        setOffers(page.items);
        setNextCursor(page.nextCursor);
        setStats(getMyOfferStats());
        setApplicationCounts(getOfferApplicationCounts());
      } catch (loadError) {
        setError(loadError);
      } finally {
        setLoading(false);
      }
    },
    [status],
  );

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) load();
    });
    return () => {
      active = false;
    };
  }, [load, reloadKey]);

  const visibleOffers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr");
    if (!query) return offers;
    return offers.filter((offer) => offer.title.toLocaleLowerCase("fr").includes(query));
  }, [offers, search]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listMyOffers({
        status: status || undefined,
        limit: 5,
        cursor: nextCursor,
      });
      setOffers((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoadingMore(false);
    }
  }

  async function confirmTransition() {
    if (!dialog || busy) return;
    setBusy(true);
    try {
      await updateOffer(dialog.offer.offerId, { status: dialog.transition.status });
      setToast(`L’offre a été ${dialog.transition.status === "OPEN" ? "rouverte" : dialog.transition.status === "CLOSED" ? "clôturée" : "marquée comme pourvue"}.`);
      setDialog(null);
      setReloadKey((value) => value + 1);
    } catch (actionError) {
      setError(actionError);
      setDialog(null);
      if (actionError.status === 409) await load({ keepError: true });
    } finally {
      setBusy(false);
    }
  }

  const retry = () => setReloadKey((value) => value + 1);
  const canShowData = !error || error.status === 409;

  return (
    <section className="company-offers-page">
      <PageHeader
        eyebrow="Espace entreprise"
        title="Mes offres"
        subtitle="Consultez et gérez les offres publiées par votre entreprise."
        action={
          <Link className="company-primary-link" to="/company/offres/nouvelle">
            <Plus size={17} aria-hidden="true" />
            Nouvelle offre
          </Link>
        }
      />

      {error && (
        <ErrorBanner
          title="Impossible de charger ou modifier les offres"
          message={error.message || "Veuillez réessayer."}
          onRetry={retry}
        />
      )}

      <div className="company-offer-stats" aria-label="Statistiques des offres">
        {loading || (error && error.status !== 409)
          ? Array.from({ length: 4 }, (_, index) => (
              <div className="company-offer-stat" key={index}>
                <Skeleton className="company-offer-stat-number" />
                <Skeleton className="company-offer-stat-label" />
              </div>
            ))
          : <>
              <Stat label="Total" value={stats.total} />
              <Stat label="Ouvertes" value={stats.open} />
              <Stat label="Pourvues" value={stats.filled} />
              <Stat label="Clôturées" value={stats.closed} />
            </>}
      </div>

      <div className="company-offer-filters">
        <label className="company-offer-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Rechercher par titre</span>
          <input
            type="search"
            placeholder="Rechercher par titre"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="company-offer-status-filter">
          <span>Statut</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Toutes</option>
            {COMPANY_OFFER_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>{filter.label}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <OfferLoadingRows />
      ) : !canShowData ? null : visibleOffers.length ? (
        <div className="company-offer-table-wrap">
          <table className="company-offer-table">
            <caption className="sr-only">Liste de vos offres de stage</caption>
            <thead>
              <tr>
                <th scope="col">Offre</th>
                <th scope="col">Mode et durée</th>
                <th scope="col">Publication</th>
                <th scope="col">Statut</th>
                <th scope="col">Candidatures</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {visibleOffers.map((offer) => (
                <tr key={offer.offerId}>
                  <th scope="row">
                    <Link className="company-offer-title" to={`/company/offres/${offer.offerId}`}>
                      {offer.title}
                    </Link>
                    <span className="company-offer-location">
                      <MapPin size={14} aria-hidden="true" />
                      {offer.gouvernorat}
                    </span>
                  </th>
                  <td>
                    <span className="company-offer-meta">
                      <span>{WORK_MODE_LABELS[offer.workMode] || "Mode à préciser"}</span>
                      <span><Clock size={14} aria-hidden="true" />{offer.durationWeeks} semaines</span>
                    </span>
                  </td>
                  <td>
                    <span className="company-offer-date">
                      <CalendarDays size={14} aria-hidden="true" />
                      {formatDate(offer.createdAt)}
                    </span>
                  </td>
                  <td><StatusBadge status={offer.status} label={offer.status === "CLOSED" ? "Clôturée" : undefined} /></td>
                  <td>
                    <Link className="company-applicant-count" to={`/company/candidatures?offer=${encodeURIComponent(offer.offerId)}`}>
                      {applicationCounts[offer.offerId] || 0}
                    </Link>
                  </td>
                  <td>
                    <div className="company-offer-row-actions">
                      {offer.status === "FILLED" ? (
                        <Link className="company-small-link" to={`/company/offres/${offer.offerId}`}>
                          Voir
                        </Link>
                      ) : (
                        <>
                          <Link className="company-small-link" to={`/company/offres/${offer.offerId}/modifier`}>
                            Modifier
                          </Link>
                          {(TRANSITIONS[offer.status] || []).map((transition) => (
                            <button
                              className="company-text-button"
                              type="button"
                              key={transition.status}
                              onClick={() => setDialog({ offer, transition })}
                            >
                              {transition.label}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={offers.length ? "Aucune offre ne correspond à ces critères" : "Aucune offre publiée"}
          message={offers.length ? "Essayez une autre recherche ou un autre statut." : "Publiez une offre pour recevoir des candidatures."}
          actionLabel="Nouvelle offre"
          actionTo="/company/offres/nouvelle"
        />
      )}

      {nextCursor && (
        <button
          className="company-load-more"
          type="button"
          onClick={loadMore}
          aria-busy={loadingMore}
        >
          {loadingMore ? "Chargement…" : "Charger plus"}
        </button>
      )}

      {dialog && (
        <ConfirmDialog
          open
          title={dialog.transition.title}
          body={dialog.transition.body}
          confirmLabel={busy ? "Enregistrement…" : dialog.transition.label}
          onCancel={() => setDialog(null)}
          onConfirm={confirmTransition}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
