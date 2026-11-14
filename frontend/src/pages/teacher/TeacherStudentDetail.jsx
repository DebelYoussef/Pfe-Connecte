import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  FileText,
  MessageSquareText,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import EmptyState from "../../components/ui/EmptyState";
import Skeleton from "../../components/ui/Skeleton";
import StatusBadge from "../../components/ui/StatusBadge";
import Toast from "../../components/ui/Toast";
import Tooltip from "../../components/ui/Tooltip";
import {
  getReportPdfUrl,
  listMySupervisions,
  listStudentJournals,
  listStudentReports,
  reviewReport,
} from "../../services.teacher";
import { formatWeekRange, weekEnd, weekNumber } from "../student/parts/weeks";
import "./teacherStudentDetail.css";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function journalStatus(entry) {
  if (entry.validated) return "Validée";
  const due = weekEnd(entry.week);
  due.setDate(due.getDate() + 7);
  return new Date(entry.submittedAt) > due ? "En retard" : "Soumise";
}

function decisionLabel(decision) {
  if (decision === "APPROVED") return "Approuvé";
  if (decision === "CHANGES_REQUESTED") return "Modifications demandées";
  return "En attente";
}

function DecisionRow({ label, decision, comment }) {
  return (
    <div className="teacher-detail-reviewer">
      <div>
        <strong>{label}</strong>
        <span
          className={
            decision
              ? "teacher-detail-decision"
              : "teacher-detail-decision pending"
          }
        >
          {decisionLabel(decision)}
        </span>
      </div>
      {comment && <p>{comment}</p>}
    </div>
  );
}

function ReviewActions({ report, latest, onApprove, onRequestChanges }) {
  const disabledReason = !latest
    ? "Seule la dernière version peut être examinée."
    : "Votre avis est déjà enregistré pour cette version.";
  if (!latest || report.teacherDecision) {
    return (
      <div className="teacher-detail-actions">
        <Tooltip content={disabledReason}>
          <button type="button" disabled>
            <Check size={15} />
            Approuver
          </button>
        </Tooltip>
        <Tooltip content={disabledReason}>
          <button type="button" disabled>
            <MessageSquareText size={15} />
            Demander des modifications
          </button>
        </Tooltip>
      </div>
    );
  }
  return (
    <div className="teacher-detail-actions">
      <button type="button" onClick={onApprove}>
        <Check size={15} />
        Approuver
      </button>
      <button type="button" onClick={onRequestChanges}>
        <MessageSquareText size={15} />
        Demander des modifications
      </button>
    </div>
  );
}

export default function TeacherStudentDetail() {
  const { studentId } = useParams();
  const [activeTab, setActiveTab] = useState("journal");
  const [data, setData] = useState({
    loading: true,
    error: null,
    forbidden: false,
    student: null,
    journals: [],
    reports: [],
    reportPdfUrls: {},
  });
  const [dialog, setDialog] = useState(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [toast, setToast] = useState("");

  const fetchData = useCallback(async () => {
      const { items: supervisions } = await listMySupervisions();
      const student = supervisions.find(
        (item) =>
          item.studentId === studentId &&
          ["ACCEPTED", "ASSIGNED"].includes(item.status),
      );
      if (!student) {
        return {
          loading: false,
          error: "Ce dossier n’est pas accessible à votre compte.",
          forbidden: true,
          student: null,
          journals: [],
          reports: [],
          reportPdfUrls: {},
        };
      }
      const [journals, reports] = await Promise.all([
        listStudentJournals(studentId),
        listStudentReports(studentId),
      ]);
      const reportPdfUrls = await Promise.all(
        reports.items.map(async (report) => {
          const { url } = await getReportPdfUrl(studentId, report.version);
          return [report.version, url];
        }),
      );
      return {
        loading: false,
        error: null,
        forbidden: false,
        student,
        journals: journals.items,
        reports: reports.items,
        reportPdfUrls: Object.fromEntries(reportPdfUrls),
      };
  }, [studentId]);

  const load = useCallback(async () => {
    setData((current) => ({ ...current, loading: true, error: null }));
    try {
      setData(await fetchData());
    } catch (error) {
      setData({
        loading: false,
        error: error?.message || "Impossible de charger ce dossier.",
        forbidden: error?.status === 403,
        student: null,
        journals: [],
        reports: [],
        reportPdfUrls: {},
      });
    }
  }, [fetchData]);

  useEffect(() => {
    let active = true;
    fetchData()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((error) => {
        if (active)
          setData({
            loading: false,
            error: error?.message || "Impossible de charger ce dossier.",
            forbidden: error?.status === 403,
            student: null,
            journals: [],
            reports: [],
          });
      });
    return () => {
      active = false;
    };
  }, [fetchData]);

  async function submitReview(decision) {
    const report = data.reports[0];
    if (!report) return;
    setSaving(true);
    setActionError("");
    try {
      await reviewReport(report.studentId, report.version, {
        decision,
        comment: decision === "CHANGES_REQUESTED" ? comment : "",
      });
      setDialog(null);
      setComment("");
      await load();
      setToast(
        decision === "APPROVED"
          ? "Votre avis a été enregistré."
          : "La demande de modifications a été envoyée.",
      );
    } catch (error) {
      setActionError(error?.message || "La décision n’a pas pu être enregistrée.");
    } finally {
      setSaving(false);
    }
  }

  const latestReport = data.reports[0];

  return (
    <section className="teacher-student-detail student-page">
      {data.loading ? (
        <div className="teacher-detail-loading" aria-label="Chargement">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      ) : data.error ? (
        <section className="teacher-detail-error" role="alert">
          <Link to="/teacher/etudiants">
            <ArrowLeft size={16} />
            Retour aux étudiants
          </Link>
          <h1>{data.forbidden ? "Dossier non accessible" : "Erreur de chargement"}</h1>
          <p>{data.error}</p>
          {!data.forbidden && (
            <button type="button" onClick={load}>
              Réessayer
            </button>
          )}
        </section>
      ) : (
        <>
          <header className="teacher-detail-header">
            <Link to="/teacher/etudiants" className="teacher-detail-back">
              <ArrowLeft size={16} />
              Retour
            </Link>
            <p className="teacher-detail-eyebrow">DOSSIER ÉTUDIANT</p>
            <h1>{data.student.studentName}</h1>
            <p className="teacher-detail-specialty">
              {data.student.specialty}
            </p>
            <div className="teacher-detail-meta">
              <span>
                <small>Établissement</small>
                <strong>{data.student.etab}</strong>
              </span>
              <span>
                <small>Entreprise</small>
                <strong>{data.student.companyName}</strong>
              </span>
              <span>
                <small>Sujet PFE</small>
                <strong>{data.student.subjectTitle}</strong>
              </span>
            </div>
          </header>

          <div className="teacher-detail-tabs" role="tablist" aria-label="Dossier étudiant">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "journal"}
              className={activeTab === "journal" ? "active" : ""}
              onClick={() => setActiveTab("journal")}
            >
              Journal
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "report"}
              className={activeTab === "report" ? "active" : ""}
              onClick={() => setActiveTab("report")}
            >
              Rapport
            </button>
          </div>

          {actionError && (
            <div className="teacher-detail-action-error" role="alert">
              <span>{actionError}</span>
              <button type="button" onClick={() => setActionError("")}>
                Fermer
              </button>
            </div>
          )}

          {activeTab === "journal" ? (
            <section
              className="teacher-detail-panel"
              role="tabpanel"
              aria-label="Journal"
            >
              {data.journals.length ? (
                <div className="teacher-journal-list">
                  {data.journals.map((entry) => {
                    const state = journalStatus(entry);
                    return (
                      <article
                        className="teacher-detail-card"
                        key={entry.week}
                      >
                        <header>
                          <div>
                            <h2>Semaine {weekNumber(entry.week)}</h2>
                            <p>{formatWeekRange(entry.week)}</p>
                          </div>
                          <span
                            className={`teacher-journal-status ${state.toLowerCase().replaceAll(" ", "-")}`}
                          >
                            {state}
                          </span>
                        </header>
                        <p className="teacher-journal-content">
                          {entry.content}
                        </p>
                        <p className="teacher-journal-submitted">
                          Soumise le {formatDate(entry.submittedAt)}
                          {entry.validated && entry.validatedAt
                            ? ` · Validée le ${formatDate(entry.validatedAt)}`
                            : ""}
                        </p>
                        {entry.comment && (
                          <div className="teacher-journal-comment">
                            <span>Commentaire de l’entreprise</span>
                            <blockquote>{entry.comment}</blockquote>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="Aucune entrée de journal"
                  message="Les entrées hebdomadaires de cet étudiant apparaîtront ici."
                />
              )}
            </section>
          ) : (
            <section
              className="teacher-detail-panel"
              role="tabpanel"
              aria-label="Rapport"
            >
              {data.reports.length ? (
                <div className="teacher-report-history">
                  {data.reports.map((report) => {
                    const isLatest = report.version === latestReport?.version;
                    return (
                      <article
                        className="teacher-detail-card teacher-report-card"
                        key={report.version}
                      >
                        <header>
                          <div>
                            <div className="teacher-report-title">
                              <FileText size={18} />
                              <h2>Version {report.version}</h2>
                            </div>
                            <p>Déposée le {formatDate(report.submittedAt)}</p>
                          </div>
                          <StatusBadge status={report.status} />
                        </header>
                        <p className="teacher-report-hash">
                          SHA-256 <code>{report.sha256.slice(0, 16)}</code>
                        </p>
                        <div className="teacher-report-decisions">
                          <DecisionRow
                            label="Entreprise"
                            decision={report.companyDecision}
                            comment={report.companyComment}
                          />
                          <DecisionRow
                            label="Encadrant"
                            decision={report.teacherDecision}
                            comment={report.teacherComment}
                          />
                        </div>
                        <div className="teacher-report-rule">
                          Le rapport est validé uniquement si l’entreprise et
                          l’encadrant l’approuvent. Chaque nouveau dépôt remet
                          les deux avis à zéro.
                        </div>
                        <footer className="teacher-report-footer">
                          <a
                            href={data.reportPdfUrls[report.version]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="teacher-report-download"
                          >
                            <Download size={15} />
                            Télécharger
                          </a>
                          <ReviewActions
                            report={report}
                            latest={isLatest}
                            onApprove={() => setDialog("approve")}
                            onRequestChanges={() => {
                              setComment("");
                              setDialog("changes");
                            }}
                          />
                        </footer>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="Aucun rapport soumis"
                  message="Les versions du rapport de cet étudiant apparaîtront ici."
                />
              )}
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(dialog)}
        title={
          dialog === "approve"
            ? "Approuver ce rapport ?"
            : "Demander des modifications ?"
        }
        body={
          dialog === "approve"
            ? "Votre avis sera enregistré pour la dernière version du rapport."
            : "Indiquez les modifications attendues. Un commentaire est obligatoire."
        }
        confirmLabel={dialog === "approve" ? "Approuver" : "Envoyer la demande"}
        confirmDisabled={
          saving || (dialog === "changes" && !comment.trim())
        }
        onCancel={() => {
          setDialog(null);
          setComment("");
        }}
        onConfirm={() =>
          void submitReview(
            dialog === "approve" ? "APPROVED" : "CHANGES_REQUESTED",
          )
        }
      >
        {dialog === "changes" && (
          <label className="teacher-review-comment">
            <span>Commentaire requis</span>
            <textarea
              value={comment}
              maxLength={2000}
              rows={5}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Décrivez les modifications attendues…"
            />
            <small>{comment.length} / 2000</small>
          </label>
        )}
      </ConfirmDialog>
      {toast && (
        <Toast message={toast} onClose={() => setToast("")} />
      )}
    </section>
  );
}
