import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, FileSignature, MapPin } from "lucide-react";
import ErrorBanner from "../../components/ErrorBanner";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import StatusBadge from "../../components/ui/StatusBadge";
import {
  COMPANY_DATA_CHANGED_EVENT,
  listConventions,
} from "../../services.company";
import { getUser } from "../../auth";

const STATE_LABELS = {
  DRAFT: "Brouillon",
  SUBMITTED: "Soumise",
  SIGNED_STUDENT: "Signée par l’étudiant",
  SIGNED_COMPANY: "Signée par l’entreprise",
  APPROVED: "Approuvée",
};
const TABS = [
  { id: "TO_SIGN", label: "À signer" },
  { id: "IN_PROGRESS", label: "En cours" },
  { id: "APPROVED", label: "Approuvées" },
  { id: "ALL", label: "Toutes" },
];

function isWaitingForCompany(convention) {
  return (
    convention.state === "SIGNED_STUDENT" &&
    convention.currentActorId === getUser()?.userId
  );
}

function isInProgress(convention) {
  return !["SIGNED_STUDENT", "APPROVED"].includes(convention.state);
}

function waitingFor(convention) {
  if (convention.state === "APPROVED") return "—";
  if (isWaitingForCompany(convention)) return "Vous";
  if (String(convention.currentActorId || "").startsWith("RESP#"))
    return "Responsable";
  if (convention.state === "SIGNED_COMPANY") return "Responsable";
  if (convention.state === "SIGNED_STUDENT") return "Entreprise";
  return "Étudiant";
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}

function ConventionSkeleton() {
  return (
    <div className="company-convention-skeletons" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <article className="company-convention-skeleton" key={index}>
          <Skeleton className="company-convention-skeleton-title" />
          <Skeleton className="company-convention-skeleton-detail" />
          <Skeleton className="company-convention-skeleton-detail" />
          <Skeleton className="company-convention-skeleton-action" />
        </article>
      ))}
    </div>
  );
}

export default function CompanyConventions() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [selectedTab, setSelectedTab] = useState(null);

  useEffect(() => {
    document.title = "Conventions · PFE Connect";
  }, []);

  useEffect(() => {
    let active = true;
    listConventions({ limit: 100 })
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setError(null);
      })
      .catch((loadError) => {
        if (active) setError(loadError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);

  const retryLoad = useCallback(() => {
    setLoading(true);
    setRetry((value) => value + 1);
  }, []);

  useEffect(() => {
    const refresh = () => retryLoad();
    window.addEventListener(COMPANY_DATA_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(COMPANY_DATA_CHANGED_EVENT, refresh);
  }, [retryLoad]);

  const counts = useMemo(
    () => ({
      TO_SIGN: items.filter(isWaitingForCompany).length,
      IN_PROGRESS: items.filter(isInProgress).length,
      APPROVED: items.filter((item) => item.state === "APPROVED").length,
      ALL: items.length,
    }),
    [items],
  );
  const activeTab = selectedTab || (counts.TO_SIGN > 0 ? "TO_SIGN" : "ALL");
  const visibleItems = useMemo(
    () =>
      items.filter((item) => {
        if (activeTab === "TO_SIGN") return isWaitingForCompany(item);
        if (activeTab === "IN_PROGRESS") return isInProgress(item);
        if (activeTab === "APPROVED") return item.state === "APPROVED";
        return true;
      }),
    [activeTab, items],
  );

  return (
    <section className="company-conventions-page">
      <PageHeader
        eyebrow="Espace entreprise"
        title="Conventions"
        subtitle="Suivez les conventions de stage et les signatures."
      />
      {error && (
        <ErrorBanner
          title="Impossible de charger les conventions"
          message={error.message || "Une erreur est survenue. Réessayez."}
          onRetry={retryLoad}
        />
      )}
      {loading ? (
        <ConventionSkeleton />
      ) : error ? null : (
        <>
          <div className="company-convention-stats">
            {[
              ["Total", counts.ALL],
              ["À signer", counts.TO_SIGN],
              ["En cours", counts.IN_PROGRESS],
              ["Approuvées", counts.APPROVED],
            ].map(([label, count]) => (
              <article className="company-convention-stat" key={label}>
                <strong>{count}</strong>
                <span>{label}</span>
              </article>
            ))}
          </div>
          <div
            className="company-convention-tabs"
            role="tablist"
            aria-label="Filtrer les conventions"
          >
            {TABS.map((tab) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
              >
                {tab.label} <span>{counts[tab.id]}</span>
              </button>
            ))}
          </div>
          {visibleItems.length ? (
            <div className="company-convention-list">
              {visibleItems.map((item) => {
                const toSign = isWaitingForCompany(item);
                return (
                  <article
                    className="company-convention-row"
                    key={item.conventionId}
                  >
                    <div className="company-convention-row-main">
                      <div className="company-convention-row-heading">
                        <h2>{item.studentName}</h2>
                        {toSign && (
                          <span className="company-convention-sign-marker">
                            À signer
                          </span>
                        )}
                        <StatusBadge
                          status={item.state}
                          label={STATE_LABELS[item.state] || item.state}
                        />
                      </div>
                      <p className="company-convention-offer">
                        {item.offerTitle}
                      </p>
                      <div className="company-convention-meta">
                        <span>
                          <MapPin aria-hidden="true" size={14} />
                          {item.etab || "Établissement non renseigné"}
                        </span>
                        <span>
                          <CalendarDays aria-hidden="true" size={14} />
                          {formatDate(item.createdAt)}
                        </span>
                        <span>
                          <FileSignature aria-hidden="true" size={14} />
                          En attente de : {waitingFor(item)}
                        </span>
                      </div>
                    </div>
                    <Link
                      className="company-convention-view"
                      to={`/company/conventions/${item.conventionId}`}
                    >
                      Voir
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="Aucune convention dans cette catégorie"
              message="Les conventions apparaîtront ici après la confirmation d’un stage."
              actionLabel="Voir les candidatures"
              actionTo="/company/candidatures"
            />
          )}
        </>
      )}
    </section>
  );
}
