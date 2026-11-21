import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ErrorBanner from "../../components/ErrorBanner";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import StatusBadge from "../../components/ui/StatusBadge";
import Tooltip from "../../components/ui/Tooltip";
import { computePartyProgress } from "../../lib/conventionDocument";
import {
  getApprovedCount,
  getBlockedCount,
  getDraftCount,
  getInProgressCount,
  getConventionsToSignCount,
  isBlocked,
  listConventions,
  RESPONSABLE_DATA_CHANGED_EVENT,
} from "../../services.responsable";

const STATE_LABELS = {
  DRAFT: "Brouillon",
  SUBMITTED: "Soumise",
  SIGNED_STUDENT: "Signée par l’étudiant",
  SIGNED_COMPANY: "Signée par l’entreprise",
  APPROVED: "Approuvée",
};

function daysSince(value) {
  if (!value) return null;
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / (24 * 60 * 60 * 1000)),
  );
}

function waitingFor(convention) {
  if (convention.state === "APPROVED") return "—";
  if (convention.currentActorId === `RESP#${convention.etab}`) return "Vous";
  if (convention.currentActorId === convention.studentId) return "Étudiant";
  if (convention.currentActorId === convention.companyId) return "Entreprise";
  if (String(convention.currentActorId || "").startsWith("RESP#")) return "Responsable";
  return "Étudiant";
}

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function ResponsableConventions() {
  const [items, setItems] = useState([]);
  const [countItems, setCountItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(undefined);
  const [filter, setFilter] = useState("TO_SIGN");
  const [search, setSearch] = useState("");

  const load = useCallback(async (cursor) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      if (cursor) {
        const result = await listConventions({ limit: 5, cursor });
        setItems((current) => [...current, ...result.items]);
        setNextCursor(result.nextCursor);
      } else {
        const [page, all] = await Promise.all([
          listConventions({ limit: 5 }),
          listConventions({ limit: 100 }),
        ]);
        setItems(page.items);
        setCountItems(all.items);
        setNextCursor(page.nextCursor);
      }
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (active) void load();
    };
    Promise.resolve().then(refresh);
    window.addEventListener(RESPONSABLE_DATA_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      active = false;
      window.removeEventListener(RESPONSABLE_DATA_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [load]);

  const counts = useMemo(() => ({
    TO_SIGN: getConventionsToSignCount(countItems),
    DRAFT: getDraftCount(countItems),
    IN_PROGRESS: getInProgressCount(countItems),
    BLOCKED: getBlockedCount(countItems),
    APPROVED: getApprovedCount(countItems),
    ALL: countItems.length,
  }), [countItems]);

  const activeFilter =
    items.length && !counts.TO_SIGN && filter === "TO_SIGN" ? "ALL" : filter;
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr");
    return items.filter((item) => {
      let tabMatch = true;
      if (activeFilter === "TO_SIGN") tabMatch = item.state === "SIGNED_COMPANY" && item.currentActorId === `RESP#${item.etab}`;
      if (activeFilter === "DRAFT") tabMatch = item.state === "DRAFT";
      if (activeFilter === "IN_PROGRESS") tabMatch = ["SUBMITTED", "SIGNED_STUDENT"].includes(item.state);
      if (activeFilter === "BLOCKED") tabMatch = isBlocked(item);
      if (activeFilter === "APPROVED") tabMatch = item.state === "APPROVED";
      if (!tabMatch) return false;
      if (!query) return true;
      return [item.studentName, item.companyName, item.offerTitle, item.subjectTitle]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("fr").includes(query));
    });
  }, [activeFilter, items, search]);

  const cardLinks = [
    ["TO_SIGN", "À signer", counts.TO_SIGN],
    ["DRAFT", "À corriger", counts.DRAFT],
    ["IN_PROGRESS", "En cours", counts.IN_PROGRESS],
    ["APPROVED", "Approuvées", counts.APPROVED],
  ];

  return (
    <section className="student-page responsable-conventions-page">
      <PageHeader
        eyebrow="Espace responsable"
        title="Conventions"
        subtitle="Signez, corrigez et suivez les conventions de votre établissement."
      />
      {error && (
        <ErrorBanner
          title="Impossible de charger les conventions"
          message={error.message || "Une erreur est survenue."}
          onRetry={() => void load()}
        />
      )}
      <div className="responsable-convention-stats">
        {cardLinks.map(([id, label, count]) => (
          <button
            type="button"
            className={activeFilter === id ? "responsable-convention-stat active" : "responsable-convention-stat"}
            key={id}
            onClick={() => setFilter(id)}
          >
            <strong>{count}</strong>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="responsable-convention-tools">
        <div className="responsable-convention-tabs" role="tablist">
          {[
            ["TO_SIGN", "À signer", counts.TO_SIGN],
            ["DRAFT", "À corriger", counts.DRAFT],
            ["IN_PROGRESS", "En cours", counts.IN_PROGRESS],
            ["BLOCKED", "Bloquées", counts.BLOCKED],
            ["APPROVED", "Approuvées", counts.APPROVED],
            ["ALL", "Toutes", counts.ALL],
          ].map(([id, label, count]) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === id}
              className={activeFilter === id ? "active" : ""}
              onClick={() => setFilter(id)}
              key={id}
            >
              {label} <span>{count}</span>
            </button>
          ))}
        </div>
        <label className="responsable-convention-search">
          <Search size={15} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Étudiant, entreprise ou offre"
            aria-label="Rechercher une convention"
          />
        </label>
      </div>
      {loading ? (
        <div aria-busy="true">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="responsable-row-skeleton" />
          ))}
        </div>
      ) : visible.length || nextCursor ? (
        <>
          {visible.length ? (
            <div className="responsable-convention-list">
              {visible.map((item) => {
              const blocked = isBlocked(item);
              const days = daysSince(item.stepSince);
              const toSign = item.state === "SIGNED_COMPANY" && item.currentActorId === `RESP#${item.etab}`;
              const progress = computePartyProgress(item.templateSnapshot, item.values);
              return (
                <article className="responsable-convention-item" key={item.conventionId}>
                  <span className="responsable-student-avatar" aria-hidden="true">
                    {initials(item.studentName)}
                  </span>
                  <div className="responsable-convention-row-main">
                    <div className="responsable-convention-row-heading">
                      <h3>{item.studentName}</h3>
                      {toSign && <span className="responsable-sign-marker">À signer</span>}
                    </div>
                    <small>{item.offerTitle || item.subjectTitle}</small>
                    <span className="responsable-convention-company">{item.companyName}</span>
                  </div>
                  <div
                    className="responsable-row-completion"
                    aria-label="Complétude de la convention"
                  >
                    <MiniMeter label="Étudiant" progress={progress.student} />
                    <MiniMeter label="Entreprise" progress={progress.company} />
                  </div>
                  <div className="responsable-convention-status">
                    <StatusBadge status={item.state} label={STATE_LABELS[item.state]} />
                    <small>En attente de <strong>{waitingFor(item)}</strong></small>
                  </div>
                  <div className={blocked ? "responsable-step-age blocked" : "responsable-step-age"}>
                    {blocked && days !== null ? (
                      <span>
                        Bloquée depuis {days} jour{days > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span>—</span>
                    )}
                    <code>{item.shortRef}</code>
                  </div>
                  <Link className="outlined-action" to={`/responsable/conventions/${item.conventionId}`}>Voir</Link>
                </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="Aucune convention sur cette page"
              message="Chargez les conventions suivantes pour poursuivre la recherche."
            />
          )}
          {nextCursor && (
            <Tooltip content={loadingMore ? "Chargement des conventions en cours." : "Afficher les conventions suivantes."}>
              <span className="convention-disabled-action" tabIndex={loadingMore ? 0 : undefined}>
                <button
                  type="button"
                  className="secondary-button responsable-load-more"
                  disabled={loadingMore}
                  onClick={() => void load(nextCursor)}
                >
                  {loadingMore ? "Chargement…" : "Charger plus"}
                </button>
              </span>
            </Tooltip>
          )}
        </>
      ) : (
        <EmptyState
          title="Aucune convention"
          message="Aucun dossier ne correspond à ce filtre."
          actionLabel="Voir toutes les conventions"
          actionTo="/responsable/conventions"
        />
      )}
    </section>
  );
}

function MiniMeter({ label, progress }) {
  const ratio = progress.total
    ? Math.min(100, Math.round((progress.done / progress.total) * 100))
    : 0;
  return (
    <div className="responsable-mini-meter">
      <span>
        {label} {progress.done}/{progress.total}
      </span>
      <span
        className="responsable-mini-meter-track"
        role="progressbar"
        aria-label={`Complétude ${label.toLowerCase()}`}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
      >
        <span style={{ width: `${ratio}%` }} />
      </span>
    </div>
  );
}
