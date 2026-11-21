import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, FileSignature, MapPin } from "lucide-react";
import ErrorBanner from "../../components/ErrorBanner";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import StatusBadge from "../../components/ui/StatusBadge";
import { COMPANY_DATA_CHANGED_EVENT, listConventions } from "../../services.company";
import {
  computePartyProgress,
  getCompanyConventionAction,
} from "../../lib/conventionDocument";

const STATE_LABELS = {
  DRAFT: "Brouillon",
  SUBMITTED: "Soumise",
  SIGNED_STUDENT: "Signée par l’étudiant",
  SIGNED_COMPANY: "Signée par l’entreprise",
  APPROVED: "Approuvée",
};
const TABS = [
  { id: "TO_COMPLETE", label: "À compléter" },
  { id: "TO_SIGN", label: "À signer" },
  { id: "IN_PROGRESS", label: "En cours" },
  { id: "APPROVED", label: "Approuvées" },
  { id: "ALL", label: "Toutes" },
];

function waitingFor(convention) {
  if (convention.state === "APPROVED") return "—";
  if (convention.currentActorId === convention.companyId) return "Vous";
  if (convention.currentActorId === convention.studentId) return "l’étudiant";
  if (String(convention.currentActorId || "").startsWith("RESP#")) {
    return "le responsable";
  }
  if (convention.state === "SIGNED_STUDENT") return "l’entreprise";
  return "l’étudiant";
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

function CompactMeter({ label, count }) {
  const ratio = count.total
    ? Math.min(100, Math.round((count.done / count.total) * 100))
    : 0;
  return (
    <div className="company-convention-mini-meter">
      <span>
        {label} {count.done}/{count.total}
      </span>
      <div
        className="company-convention-mini-track"
        role="progressbar"
        aria-label={`Complétude ${label.toLowerCase()}`}
        aria-valuemin={0}
        aria-valuemax={count.total}
        aria-valuenow={count.done}
      >
        <span style={{ width: `${ratio}%` }} />
      </div>
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
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(COMPANY_DATA_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [retryLoad]);

  const actions = useMemo(
    () =>
      items.map((item) => ({
        item,
        action: getCompanyConventionAction(item, item.companyId),
        completion: computePartyProgress(item.templateSnapshot, item.values),
      })),
    [items],
  );
  const counts = useMemo(
    () => ({
      TO_COMPLETE: actions.filter((entry) => entry.action === "TO_COMPLETE")
        .length,
      TO_SIGN: actions.filter((entry) => entry.action === "TO_SIGN").length,
      IN_PROGRESS: actions.filter(
        (entry) => entry.action === "IN_PROGRESS",
      ).length,
      APPROVED: actions.filter((entry) => entry.action === "APPROVED").length,
      ALL: actions.length,
    }),
    [actions],
  );
  const activeTab =
    selectedTab ||
    (counts.TO_COMPLETE > 0
      ? "TO_COMPLETE"
      : counts.TO_SIGN > 0
        ? "TO_SIGN"
        : "ALL");
  const visibleItems = useMemo(
    () =>
      actions.filter((entry) => {
        if (activeTab === "ALL") return true;
        return entry.action === activeTab;
      }),
    [actions, activeTab],
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
              ["À compléter", counts.TO_COMPLETE],
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
              {visibleItems.map(({ item, action, completion }) => (
                <article
                  className="company-convention-row"
                  key={item.conventionId}
                >
                  <div className="company-convention-row-main">
                    <div className="company-convention-row-heading">
                      <h3>{item.studentName}</h3>
                      {action === "TO_COMPLETE" && (
                        <span className="company-convention-complete-marker">
                          À compléter
                        </span>
                      )}
                      {action === "TO_SIGN" && (
                        <span className="company-convention-sign-marker">
                          À signer
                        </span>
                      )}
                      <StatusBadge
                        status={item.state}
                        label={STATE_LABELS[item.state] || item.state}
                      />
                    </div>
                    <p className="company-convention-offer">{item.offerTitle}</p>
                    <div className="company-convention-meta">
                      <span>
                        <MapPin aria-hidden="true" size={14} />
                        {item.etabName || "Établissement non renseigné"}
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
                  <div
                    className="company-convention-completion-column"
                    aria-label="Complétude"
                  >
                    <strong>Complétude</strong>
                    <CompactMeter
                      label="Étudiant"
                      count={completion.student}
                    />
                    <CompactMeter
                      label="Entreprise"
                      count={completion.company}
                    />
                  </div>
                  <Link
                    className="company-convention-view"
                    to={`/company/conventions/${item.conventionId}`}
                  >
                    Voir
                  </Link>
                </article>
              ))}
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
