import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, FileText, Search } from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import ReportReviewDialog from "../../components/reports/ReportReviewDialog";
import Skeleton from "../../components/ui/Skeleton";
import StatusBadge from "../../components/ui/StatusBadge";
import Toast from "../../components/ui/Toast";
import {
  listLatestTeacherReports,
  reviewReport,
  subscribeToTeacherData,
} from "../../services.teacher";
import "./teacherPages.css";

const reportStatusLabels = {
  UNDER_REVIEW: "En relecture",
  CHANGES_REQUESTED: "Modifications demandées",
  VALIDATED: "Validé",
};

const statusOptions = [
  { value: "ALL", label: "Tous les statuts" },
  { value: "UNDER_REVIEW", label: "En relecture" },
  { value: "CHANGES_REQUESTED", label: "Modifications demandées" },
  { value: "VALIDATED", label: "Validé" },
];

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter((part) => /\p{L}/u.test(part));
  const value =
    parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : (parts[0] || "").slice(0, 2);
  return value.toLocaleUpperCase("fr");
}

function decisionLabel(decision) {
  if (decision === "APPROVED") return "Approuvé";
  if (decision === "CHANGES_REQUESTED") return "Modifications demandées";
  return "En attente";
}

function DecisionBadge({ decision }) {
  return (
    <StatusBadge
      status={decision || "PENDING"}
      label={decisionLabel(decision)}
    />
  );
}

function ReportStatus({ status }) {
  return (
    <StatusBadge status={status} label={reportStatusLabels[status]} />
  );
}

export default function TeacherReports() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [tab, setTab] = useState("review");
  const [confirmation, setConfirmation] = useState(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [toast, setToast] = useState("");

  const fetchItems = useCallback(() => listLatestTeacherReports(), []);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items: reports } = await fetchItems();
      setItems(reports);
    } catch (loadError) {
      setError(loadError?.message || "Impossible de charger les rapports.");
    } finally {
      setLoading(false);
    }
  }, [fetchItems]);

  const refreshFromStore = useCallback(async () => {
    try {
      const { items: reports } = await fetchItems();
      setItems(reports);
      setError(null);
    } catch (loadError) {
      setError(loadError?.message || "Impossible de charger les rapports.");
    }
  }, [fetchItems]);

  useEffect(() => {
    let active = true;
    fetchItems()
      .then(({ items: reports }) => {
        if (active) setItems(reports);
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError?.message || "Impossible de charger les rapports.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchItems]);

  useEffect(
    () =>
      subscribeToTeacherData(() => {
        void refreshFromStore();
      }),
    [refreshFromStore],
  );

  const reviewCount = items.filter((item) => !item.teacherDecision).length;
  const validatedCount = items.filter(
    (item) => item.status === "VALIDATED",
  ).length;
  const changesCount = items.filter(
    (item) => item.status === "CHANGES_REQUESTED",
  ).length;
  const stats = [
    { label: "Total", count: items.length, type: "teal" },
    { label: "À examiner", count: reviewCount, type: "gold" },
    { label: "Validés", count: validatedCount, type: "green" },
    {
      label: "Modifications demandées",
      count: changesCount,
      type: "slate",
    },
  ];

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("fr");
    return items.filter((item) => {
      const content =
        `${item.studentName} ${item.reportTitle} ${item.companyName}`.toLocaleLowerCase(
          "fr",
        );
      return (
        content.includes(term) &&
        (tab === "all" || !item.teacherDecision) &&
        (filter === "ALL" || item.status === filter)
      );
    });
  }, [items, query, filter, tab]);

  async function submitReview() {
    if (!confirmation) return;
    setBusy(true);
    setActionError("");
    const decision = confirmation.decision;
    try {
      const updatedReport = await reviewReport(
        confirmation.studentId,
        confirmation.version,
        {
          decision,
          comment: decision === "CHANGES_REQUESTED" ? comment : "",
        },
      );
      setItems((current) =>
        current.map((item) =>
          item.studentId === updatedReport.studentId ? updatedReport : item,
        ),
      );
      setConfirmation(null);
      setComment("");
      setToast(
        decision === "APPROVED"
          ? "Votre avis a été enregistré."
          : "La demande de modifications a été envoyée.",
      );
    } catch (reviewError) {
      setConfirmation(null);
      setComment("");
      if (reviewError?.status === 409) {
        await load();
        setActionError(
          "Cette version a déjà été traitée. La liste a été actualisée.",
        );
      } else {
        setActionError(
          reviewError?.message || "La décision n’a pas pu être enregistrée.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rp-page student-page" aria-label="Rapports PFE">
      <PageHeader
        eyebrow="Espace enseignant"
        title="Rapports PFE"
        subtitle="Relisez les rapports de vos étudiants. Un rapport est validé lorsque l'entreprise et vous l'approuvez."
      />

      <div className="rp-stats">
        {stats.map(({ label, count, type }) => (
          <article className={`rp-stat rp-stat-${type}`} key={label}>
            <span className="rp-stat-icon">
              <FileText size={18} />
            </span>
            <div>
              <span>{label}</span>
              {loading ? <Skeleton /> : <strong>{count}</strong>}
            </div>
          </article>
        ))}
      </div>

      <section className="rp-list" aria-label="Liste des rapports">
        <header className="rp-list-heading">
          <div>
            <span className="rp-eyebrow">SUIVI DES DOCUMENTS</span>
            <h2>Dernières versions</h2>
          </div>
          {!loading && !error && (
            <span className="rp-results">
              {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </header>

        <div className="rp-tabs" role="tablist" aria-label="Filtrer les rapports">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "review"}
            className={tab === "review" ? "active" : ""}
            onClick={() => setTab("review")}
          >
            À examiner
            <span>{reviewCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "all"}
            className={tab === "all" ? "active" : ""}
            onClick={() => setTab("all")}
          >
            Tous
          </button>
        </div>

        <div className="rp-toolbar">
          <label className="rp-search">
            <Search size={16} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher par étudiant, titre ou entreprise…"
              aria-label="Rechercher un rapport par étudiant, titre ou entreprise"
            />
          </label>
          <label className="rp-filter">
            <span>Statut</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label="Filtrer les rapports par statut"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {actionError && (
          <div className="teacher-zone-error" role="alert">
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError("")}>
              Fermer
            </button>
          </div>
        )}

        {error ? (
          <div className="teacher-zone-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={load}>
              Réessayer
            </button>
          </div>
        ) : loading ? (
          <div className="teacher-zone-skeleton" aria-label="Chargement">
            <Skeleton />
            <Skeleton />
          </div>
        ) : filtered.length ? (
          <div className="rp-table-wrap">
            <table className="rp-table">
              <thead>
                <tr>
                  <th>Étudiant</th>
                  <th>Titre du rapport</th>
                  <th>Version</th>
                  <th>Date</th>
                  <th>Entreprise</th>
                  <th>Avis de l'entreprise</th>
                  <th>Mon avis</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const pending = !item.teacherDecision;
                  return (
                    <tr key={`${item.studentId}-${item.version}`}>
                      <td>
                        <Link
                          className="rp-student"
                          to={`/teacher/etudiants/${item.studentId}`}
                        >
                          <span className="rp-avatar" aria-hidden="true">
                            {initials(item.studentName)}
                          </span>
                          <strong>{item.studentName}</strong>
                        </Link>
                      </td>
                      <td className="rp-title-cell">{item.reportTitle}</td>
                      <td>v{item.version}</td>
                      <td>
                        {new Intl.DateTimeFormat("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }).format(new Date(item.submittedAt))}
                      </td>
                      <td>{item.companyName}</td>
                      <td>
                        <DecisionBadge decision={item.companyDecision} />
                      </td>
                      <td>
                        <DecisionBadge decision={item.teacherDecision} />
                      </td>
                      <td>
                        <ReportStatus status={item.status} />
                      </td>
                      <td>
                        <div className="rp-actions">
                          <Link
                            className="rp-consult"
                            to={`/teacher/etudiants/${item.studentId}?tab=report`}
                          >
                            <FileText size={14} />
                            Consulter
                          </Link>
                          {pending && (
                            <>
                              <button
                                className="rp-approve"
                                type="button"
                                onClick={() => {
                                  setComment("");
                                  setConfirmation({
                                    ...item,
                                    decision: "APPROVED",
                                  });
                                }}
                              >
                                <Check size={14} />
                                Approuver
                              </button>
                              <button
                                className="rp-request-changes"
                                type="button"
                                onClick={() => {
                                  setComment("");
                                  setConfirmation({
                                    ...item,
                                    decision: "CHANGES_REQUESTED",
                                  });
                                }}
                              >
                                Demander des modifications
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={
              items.length
                ? "Aucun rapport trouvé"
                : "Aucun rapport soumis"
            }
            message={
              items.length
                ? "Modifiez votre recherche, le filtre de statut ou l’onglet sélectionné."
                : "Les dernières versions des rapports de vos étudiants apparaîtront ici."
            }
          />
        )}
      </section>

      <ReportReviewDialog
        open={Boolean(confirmation)}
        decision={confirmation?.decision}
        comment={comment}
        onCommentChange={setComment}
        busy={busy}
        onCancel={() => {
          setConfirmation(null);
          setComment("");
        }}
        onConfirm={() => void submitReview()}
      />
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
