import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleCheck,
  ExternalLink,
  FileText,
  Hourglass,
  Info,
  MessageSquare,
  MessageSquareWarning,
  Search,
} from "lucide-react";
import { CompanyAvatar, CompanyMetricCard } from "./CompanyVisuals";
import ErrorBanner from "../ErrorBanner";
import ReportReviewDialog from "../reports/ReportReviewDialog";
import ReportVersionCard from "../reports/ReportVersionCard";
import EmptyState from "../ui/EmptyState";
import PageHeader from "../ui/PageHeader";
import Skeleton from "../ui/Skeleton";
import StatusBadge from "../ui/StatusBadge";
import Toast from "../ui/Toast";
import Tooltip from "../ui/Tooltip";
import {
  COMPANY_DATA_CHANGED_EVENT,
  getReportPdfUrl,
  listCompanyReportHistory,
  listReportsForReview,
  reviewReport,
} from "../../services.company";

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

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function CompanyReports() {
  const [items, setItems] = useState([]);
  const [historyByStudent, setHistoryByStudent] = useState({});
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [tab, setTab] = useState("review");
  const [reviewTarget, setReviewTarget] = useState(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items: reports } = await listReportsForReview({ limit: 100 });
      setItems(reports);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadHistory = useCallback(async (studentId) => {
    setHistoryByStudent((current) => ({
      ...current,
      [studentId]: {
        items: current[studentId]?.items || [],
        loading: true,
        error: null,
      },
    }));
    try {
      const { items: reports } = await listCompanyReportHistory(studentId, {
        limit: 100,
      });
      setHistoryByStudent((current) => ({
        ...current,
        [studentId]: { items: reports, loading: false, error: null },
      }));
    } catch (historyError) {
      setHistoryByStudent((current) => ({
        ...current,
        [studentId]: {
          items: current[studentId]?.items || [],
          loading: false,
          error: historyError,
        },
      }));
    }
  }, []);

  useEffect(() => {
    const refresh = () => {
      void load();
      if (expandedStudentId) void loadHistory(expandedStudentId);
    };
    window.addEventListener(COMPANY_DATA_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(COMPANY_DATA_CHANGED_EVENT, refresh);
  }, [expandedStudentId, load, loadHistory]);

  const pendingCount = items.filter((item) => !item.companyDecision).length;
  const validatedCount = items.filter((item) => item.status === "VALIDATED").length;
  const changesCount = items.filter(
    (item) => item.status === "CHANGES_REQUESTED",
  ).length;

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("fr");
    return items.filter((item) => {
      const text =
        `${item.studentName} ${item.reportTitle} ${item.offerTitle}`.toLocaleLowerCase(
          "fr",
        );
      return (
        text.includes(term) &&
        (tab === "all" || !item.companyDecision) &&
        (statusFilter === "ALL" || item.status === statusFilter)
      );
    });
  }, [items, query, statusFilter, tab]);

  function toggleHistory(studentId) {
    if (expandedStudentId === studentId) {
      setExpandedStudentId(null);
      return;
    }
    setExpandedStudentId(studentId);
    if (!historyByStudent[studentId]) void loadHistory(studentId);
  }

  async function consultReport(report) {
    setActionError("");
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    try {
      const { url } = await getReportPdfUrl(report.studentId, report.version);
      if (popup) popup.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
    } catch (openError) {
      popup?.close();
      setActionError(
        openError?.message || "Le rapport n’a pas pu être ouvert.",
      );
    }
  }

  async function submitReview() {
    if (!reviewTarget) return;
    setBusy(true);
    setActionError("");
    try {
      const updated = await reviewReport(
        reviewTarget.studentId,
        reviewTarget.version,
        {
          decision: reviewTarget.decision,
          comment:
            reviewTarget.decision === "CHANGES_REQUESTED" ? comment : "",
        },
      );
      setItems((current) =>
        current.map((item) =>
          item.studentId === updated.studentId ? updated : item,
        ),
      );
      if (expandedStudentId !== updated.studentId) {
        setHistoryByStudent((current) => ({
          ...current,
          [updated.studentId]: undefined,
        }));
      }
      setReviewTarget(null);
      setComment("");
      setToast(
        reviewTarget.decision === "APPROVED"
          ? "Votre avis a été enregistré."
          : "La demande de modifications a été envoyée.",
      );
    } catch (reviewError) {
      setReviewTarget(null);
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

  const retryHistory = (studentId) => void loadHistory(studentId);

  return (
    <section className="company-reports-page flex flex-col gap-6">
      <PageHeader
        eyebrow="Espace entreprise"
        title="Rapports"
        subtitle="Relisez les rapports de vos stagiaires. Un rapport est validé lorsque vous et l'encadrant l'approuvez."
      />
      <div className="company-info-note">
        <Info size={16} aria-hidden="true" />
        <span>Chaque nouveau dépôt remet les deux avis à zéro.</span>
      </div>

      {error && (
        <ErrorBanner
          title="Impossible de charger les rapports"
          message={error.message || "Une erreur est survenue. Réessayez."}
          onRetry={() => void load()}
        />
      )}
      {actionError && (
        <ErrorBanner
          title="Action impossible"
          message={actionError}
          onRetry={() => void load()}
          onClose={() => setActionError("")}
        />
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Chargement">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-20 rounded" />
          ))}
          <Skeleton className="h-56 rounded sm:col-span-2 xl:col-span-4" />
        </div>
      ) : !error ? (
        <>
          <div className="company-stat-grid">
            <CompanyMetricCard icon={FileText} label="Total" value={items.length} tone="teal" />
            <CompanyMetricCard icon={Hourglass} label="À examiner" value={pendingCount} tone="gold" />
            <CompanyMetricCard icon={CircleCheck} label="Validés" value={validatedCount} tone="green" />
            <CompanyMetricCard icon={MessageSquareWarning} label="Modifications demandées" value={changesCount} tone="slate" />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
              <div
                className="flex gap-2 overflow-x-auto border-b border-line"
                role="tablist"
                aria-label="Filtrer les rapports"
              >
                {[
                  { id: "review", label: "À examiner", count: pendingCount },
                  { id: "all", label: "Tous", count: items.length },
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
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="flex min-h-10 items-center gap-2 rounded border border-line bg-surface px-3 text-ink-soft sm:min-w-72">
                  <Search className="size-4 shrink-0" aria-hidden="true" />
                  <span className="sr-only">
                    Rechercher un stagiaire, un rapport ou une offre
                  </span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Rechercher"
                    className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft"
                  />
                </label>
                <label className="flex min-h-10 items-center gap-2 rounded border border-line bg-surface px-3 text-sm text-ink-soft">
                  <span>Statut</span>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="min-w-0 bg-transparent text-ink outline-none"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {visible.length ? (
              <div className="company-reports-table-wrap">
                <table className="rp-table company-reports-table">
                  <colgroup>
                    <col className="company-report-col-student" />
                    <col className="company-report-col-title" />
                    <col className="company-report-col-date" />
                    <col className="company-report-col-decisions" />
                    <col className="company-report-col-status" />
                    <col className="company-report-col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">Stagiaire</th>
                      <th scope="col">Rapport</th>
                      <th scope="col">Date</th>
                      <th scope="col">Avis</th>
                      <th scope="col">Statut</th>
                      <th scope="col" className="company-report-actions-heading">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((report) => {
                      const hasDecision = Boolean(report.companyDecision);
                      const waitForStudent =
                        hasDecision && report.status === "CHANGES_REQUESTED";
                      const disabledReason = waitForStudent
                        ? "En attente de la nouvelle version de l'étudiant"
                        : "Vous avez déjà donné votre avis";
                      const history = historyByStudent[report.studentId];
                      const expanded = expandedStudentId === report.studentId;
                      return (
                        <FragmentRows
                          key={report.studentId}
                          report={report}
                          expanded={expanded}
                          history={history}
                          disabledReason={disabledReason}
                          hasDecision={hasDecision}
                          onConsult={() => void consultReport(report)}
                          onHistory={() => toggleHistory(report.studentId)}
                          onRetryHistory={() => retryHistory(report.studentId)}
                          onReview={(decision) => {
                            setComment("");
                            setReviewTarget({
                              studentId: report.studentId,
                              version: report.version,
                              decision,
                            });
                          }}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : items.length ? (
              <div className="rounded border border-line bg-surface p-6 text-center">
                <EmptyState
                  title="Aucun rapport trouvé"
                  message="Modifiez votre recherche, le filtre de statut ou l’onglet sélectionné."
                />
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setStatusFilter("ALL");
                    setTab("all");
                  }}
                  className="mt-3 text-sm font-semibold text-primary hover:underline"
                >
                  Effacer les filtres
                </button>
              </div>
            ) : (
              <EmptyState
                title="Aucun rapport soumis"
                message="Les dernières versions des rapports de vos stagiaires apparaîtront ici."
                actionLabel="Voir les stagiaires"
                actionTo="/company/journaux"
              />
            )}
          </div>
        </>
      ) : null}

      <ReportReviewDialog
        open={Boolean(reviewTarget)}
        decision={reviewTarget?.decision}
        comment={comment}
        onCommentChange={setComment}
        busy={busy}
        onCancel={() => {
          setReviewTarget(null);
          setComment("");
        }}
        onConfirm={() => void submitReview()}
      />
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}

function FragmentRows({
  report,
  expanded,
  history,
  disabledReason,
  hasDecision,
  onConsult,
  onHistory,
  onRetryHistory,
  onReview,
}) {
  const statusLabel = reportStatusLabels[report.status] || report.status;
  return (
    <>
      <tr className="company-report-row">
        <td>
          <div className="company-report-student">
            <CompanyAvatar name={report.studentName} />
            <span className="company-report-student-name">{report.studentName}</span>
          </div>
        </td>
        <td>
          <span className="company-report-title" title={report.reportTitle}>{report.reportTitle}</span>
          <span className="company-report-subtitle">v{report.version} · {report.offerTitle}</span>
        </td>
        <td><span className="company-nowrap">{formatDate(report.submittedAt)}</span></td>
        <td>
          <div className="company-decision-stack">
            <div><span>Encadrant</span><span className="company-nowrap"><DecisionBadge decision={report.teacherDecision} /></span></div>
            <div><span>Moi</span><span className="company-nowrap"><DecisionBadge decision={report.companyDecision} /></span></div>
          </div>
        </td>
        <td><span className="company-nowrap"><StatusBadge status={report.status} label={statusLabel} /></span></td>
        <td>
          <div className="company-report-actions">
            <Tooltip content="Consulter le PDF">
              <button type="button" onClick={onConsult} className="company-icon-button" aria-label="Consulter le PDF">
                <ExternalLink className="size-4" aria-hidden="true" />
              </button>
            </Tooltip>
            <Tooltip content="Historique des versions">
              <button type="button" aria-label="Historique des versions" aria-expanded={expanded} onClick={onHistory} className="company-icon-button">
                <ChevronDown className={`size-4 company-history-chevron${expanded ? ' is-expanded' : ''}`} aria-hidden="true" />
              </button>
            </Tooltip>
            {hasDecision ? (
              <>
                <Tooltip content={disabledReason}>
                  <span className="company-disabled-action-target" tabIndex={0}>
                    <button type="button" disabled className="company-action-button company-action-disabled">
                      <Check className="size-3.5" aria-hidden="true" />Approuver
                    </button>
                  </span>
                </Tooltip>
                <Tooltip content={disabledReason}>
                  <span className="company-disabled-action-target" tabIndex={0}>
                    <button type="button" disabled aria-label="Demander des modifications" className="company-action-button company-action-disabled company-action-icon-only">
                      <MessageSquare className="size-4" aria-hidden="true" />
                    </button>
                  </span>
                </Tooltip>
              </>
            ) : (
              <>
                <button type="button" onClick={() => onReview('APPROVED')} className="company-action-button company-action-approve">
                  <Check className="size-3.5" aria-hidden="true" />Approuver
                </button>
                <Tooltip content="Demander des modifications">
                  <button type="button" onClick={() => onReview('CHANGES_REQUESTED')} className="company-action-button company-action-danger" aria-label="Demander des modifications">
                    <MessageSquare className="size-4" aria-hidden="true" />
                    <span>Modifications</span>
                  </button>
                </Tooltip>
              </>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-line">
          <td colSpan={6} className="company-report-history-cell">
            {history?.loading && (
              <div className="grid gap-3" aria-label="Chargement de l’historique">
                <Skeleton className="h-40 rounded" />
              </div>
            )}
            {history?.error && (
              <ErrorBanner
                title="Impossible de charger l’historique"
                message={history.error.message || "Une erreur est survenue."}
                onRetry={onRetryHistory}
              />
            )}
            {history && !history.loading && !history.error && (
              history.items.length ? (
                <div className="company-report-history">
                  {history.items.map((version) => (
                    <div className="company-history-card" key={version.version}>
                      <ReportVersionCard
                      report={version}
                      showRule={false}
                    />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-soft">
                  Aucun historique de version n’est disponible.
                </p>
              )
            )}
          </td>
        </tr>
      )}
    </>
  );
}
