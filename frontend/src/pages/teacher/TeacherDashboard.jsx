import {
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  FileText,
  GraduationCap,
  UsersRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getUser } from "../../auth";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import EmptyState from "../../components/ui/EmptyState";
import Skeleton from "../../components/ui/Skeleton";
import StatusBadge from "../../components/ui/StatusBadge";
import Toast from "../../components/ui/Toast";
import { useNotifications } from "../../context/NotificationsContext";
import {
  listMySupervisions,
  listTeacherStudents,
  respondToSupervision,
} from "../../services.teacher";

function useZone(loader) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    items: [],
  });
  const reload = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const result = await loader();
      setState({
        loading: false,
        error: null,
        items: Array.isArray(result) ? result : result.items,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error:
          error?.message ||
          "Une erreur est survenue lors du chargement des données.",
      }));
    }
  }, [loader]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { ...state, reload };
}

function ZoneError({ error, onRetry }) {
  return (
    <div className="teacher-zone-error" role="alert">
      <span>{error || "Impossible de charger cette section."}</span>
      <button type="button" onClick={onRetry}>
        Réessayer
      </button>
    </div>
  );
}

function ZoneSkeleton({ lines = 3 }) {
  return (
    <div className="teacher-zone-skeleton" aria-label="Chargement">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} />
      ))}
    </div>
  );
}

function studentStatus(student) {
  if (!student.latestReport) return "En cours";
  if (student.latestReport.status === "CHANGES_REQUESTED")
    return "Modifications demandées";
  if (student.latestReport.status === "VALIDATED") return "Validé";
  return "Rapport à examiner";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

const loadSupervisions = () => listMySupervisions();
const loadStudents = () => listTeacherStudents();

export default function TeacherDashboard() {
  const user = getUser() || {};
  const firstName =
    user.firstName || user.email?.split("@")[0] || "";
  const supervisions = useZone(loadSupervisions);
  const students = useZone(loadStudents);
  const notifications = useNotifications();
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [toast, setToast] = useState("");
  const closeToast = useCallback(() => setToast(""), []);
  const requests = supervisions.items.filter(
    (item) => item.status === "REQUESTED",
  );
  const latestReports = students.items
    .map((student) => student.latestReport)
    .filter(Boolean)
    .sort((left, right) =>
      right.submittedAt.localeCompare(left.submittedAt),
    );
  const reportsToReview = latestReports.filter(
    (report) =>
      report.status === "UNDER_REVIEW" && !report.teacherDecision,
  );
  const validatedReports = latestReports.filter(
    (report) => report.status === "VALIDATED",
  );

  async function confirmSupervisionResponse() {
    if (!confirmation) return;
    setBusy(true);
    setActionError("");
    try {
      await respondToSupervision(
        confirmation.studentId,
        confirmation.decision,
      );
      await Promise.all([supervisions.reload(), students.reload()]);
      setToast(
        confirmation.decision === "ACCEPTED"
          ? "Demande acceptée."
          : "Demande refusée.",
      );
      setConfirmation(null);
    } catch (error) {
      setActionError(
        error?.message || "La réponse à la demande a échoué.",
      );
      setConfirmation(null);
    } finally {
      setBusy(false);
    }
  }

  const stats = [
    {
      label: "Étudiants encadrés",
      value: students.items.length,
      icon: UsersRound,
      to: "/teacher/etudiants",
      loading: students.loading,
      error: students.error,
    },
    {
      label: "Demandes en attente",
      value: requests.length,
      icon: GraduationCap,
      to: "/teacher/demandes",
      loading: supervisions.loading,
      error: supervisions.error,
    },
    {
      label: "Rapports à examiner",
      value: reportsToReview.length,
      icon: FileText,
      to: "/teacher/rapports",
      loading: students.loading,
      error: students.error,
    },
    {
      label: "Rapports validés",
      value: validatedReports.length,
      icon: Check,
      to: "/teacher/rapports",
      loading: students.loading,
      error: students.error,
    },
  ];

  return (
    <section className="student-page teacher-dashboard">
      <section className="teacher-dashboard-hero">
        <div>
          <p className="eyebrow">Espace enseignant</p>
          <h1>{firstName ? `Bonjour, ${firstName}` : "Bonjour"}</h1>
          <p>Retrouvez en un coup d’œil les suivis et décisions à traiter.</p>
        </div>
        <span className="teacher-dashboard-hero-icon" aria-hidden="true">
          <GraduationCap size={27} />
        </span>
      </section>

      <div className="teacher-dashboard-stats">
        {stats.map(({ label, value, icon: Icon, to, loading, error }) => (
          <Link
            className="teacher-dashboard-stat interactive"
            to={to}
            key={label}
          >
            <span className="teacher-dashboard-stat-icon">
              <Icon size={18} />
            </span>
            <span>
              <small>{label}</small>
              {loading ? (
                <Skeleton />
              ) : error ? (
                <strong aria-label="Indisponible">—</strong>
              ) : (
                <strong>{value}</strong>
              )}
            </span>
            <ChevronRight size={16} />
          </Link>
        ))}
      </div>
      {(supervisions.error || students.error) && (
        <ZoneError
          error={supervisions.error || students.error}
          onRetry={() =>
            void Promise.all([supervisions.reload(), students.reload()])
          }
        />
      )}

      <div className="teacher-dashboard-layout">
        <div className="teacher-dashboard-main">
          <section className="teacher-dashboard-card">
            <header>
              <div>
                <p className="eyebrow">VOTRE PORTEFEUILLE</p>
                <h2>Mes étudiants</h2>
              </div>
              <Link to="/teacher/etudiants">
                Voir tous <ChevronRight size={15} />
              </Link>
            </header>
            {students.error ? (
              <ZoneError error={students.error} onRetry={students.reload} />
            ) : students.loading ? (
              <ZoneSkeleton />
            ) : students.items.length ? (
              <ul>
                {students.items.slice(0, 4).map((student) => (
                  <li key={student.studentId}>
                    <Link
                      className="teacher-dashboard-row-link"
                      to={`/teacher/etudiants/${student.studentId}`}
                    >
                      <span>
                        <strong>{student.studentName}</strong>
                        <small>{student.subjectTitle}</small>
                      </span>
                      <span className="teacher-dashboard-row-end">
                        {studentStatus(student)}
                        <ArrowRight size={15} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Aucun étudiant encadré"
                message="Les étudiants qui vous sont confiés apparaîtront ici."
              />
            )}
          </section>

          <section className="teacher-dashboard-card">
            <header>
              <div>
                <p className="eyebrow">À DÉCIDER</p>
                <h2>Demandes d’encadrement</h2>
              </div>
              <Link to="/teacher/demandes">
                Voir toutes <ChevronRight size={15} />
              </Link>
            </header>
            {supervisions.error ? (
              <ZoneError
                error={supervisions.error}
                onRetry={supervisions.reload}
              />
            ) : supervisions.loading ? (
              <ZoneSkeleton lines={2} />
            ) : requests.length ? (
              <ul>
                {requests.slice(0, 4).map((request) => (
                  <li key={request.studentId}>
                    <span className="teacher-request-preview">
                      <strong>{request.studentName}</strong>
                      <small>{request.subjectTitle}</small>
                      <small>Reçue le {formatDate(request.requestedAt)}</small>
                    </span>
                    <span className="teacher-request-preview-actions">
                      <button
                        type="button"
                        aria-label={`Accepter la demande de ${request.studentName}`}
                        onClick={() =>
                          setConfirmation({
                            studentId: request.studentId,
                            studentName: request.studentName,
                            decision: "ACCEPTED",
                          })
                        }
                      >
                        <Check size={15} />
                        Accepter
                      </button>
                      <button
                        type="button"
                        aria-label={`Refuser la demande de ${request.studentName}`}
                        onClick={() =>
                          setConfirmation({
                            studentId: request.studentId,
                            studentName: request.studentName,
                            decision: "DECLINED",
                          })
                        }
                      >
                        <X size={15} />
                        Refuser
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Aucune demande en attente"
                message="Les nouvelles demandes d’encadrement apparaîtront ici."
              />
            )}
            {actionError && (
              <div className="teacher-zone-error" role="alert">
                {actionError}
                <button
                  type="button"
                  onClick={() => setActionError("")}
                >
                  Fermer
                </button>
              </div>
            )}
          </section>

          <section className="teacher-dashboard-card">
            <header>
              <div>
                <p className="eyebrow">DOCUMENTS</p>
                <h2>Rapports PFE</h2>
              </div>
              <Link to="/teacher/rapports">
                Voir tous <ChevronRight size={15} />
              </Link>
            </header>
            {students.error ? (
              <ZoneError error={students.error} onRetry={students.reload} />
            ) : students.loading ? (
              <ZoneSkeleton />
            ) : latestReports.length ? (
              <ul>
                {latestReports.slice(0, 4).map((report) => (
                  <li key={`${report.studentId}-${report.version}`}>
                    <Link
                      className="teacher-dashboard-row-link"
                      to={`/teacher/etudiants/${report.studentId}`}
                    >
                      <span>
                        <strong>{report.studentName}</strong>
                        <small>{report.reportTitle}</small>
                      </span>
                      <span className="teacher-dashboard-row-end">
                        <StatusBadge status={report.status} />
                        <ArrowRight size={15} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Aucun rapport soumis"
                message="Les rapports de vos étudiants apparaîtront ici."
              />
            )}
          </section>
        </div>

        <aside className="teacher-dashboard-side">
          <section className="teacher-dashboard-card">
            <header>
              <div>
                <p className="eyebrow">SUIVI</p>
                <h2>À traiter</h2>
              </div>
            </header>
            {supervisions.error || students.error ? (
              <ZoneError
                error={supervisions.error || students.error}
                onRetry={() =>
                  void Promise.all([
                    supervisions.reload(),
                    students.reload(),
                  ])
                }
              />
            ) : supervisions.loading || students.loading ? (
              <ZoneSkeleton lines={3} />
            ) : (
              <ul className="teacher-dashboard-todo">
                <li>
                  <Link to="/teacher/demandes">
                    <span><GraduationCap size={17} />Demandes d’encadrement</span>
                    <strong>{requests.length}</strong>
                  </Link>
                </li>
                <li>
                  <Link to="/teacher/rapports">
                    <span><FileText size={17} />Rapports à examiner</span>
                    <strong>{reportsToReview.length}</strong>
                  </Link>
                </li>
                <li>
                  <Link to="/teacher/notifications">
                    <span><Bell size={17} />Notifications non lues</span>
                    <strong>{notifications?.unreadCount || 0}</strong>
                  </Link>
                </li>
              </ul>
            )}
          </section>

          <section className="teacher-dashboard-card">
            <header>
              <div>
                <p className="eyebrow">ACTIVITÉ RÉCENTE</p>
                <h2>Dernières notifications</h2>
              </div>
              <Link to="/teacher/notifications" aria-label="Toutes les notifications">
                Voir tout <ChevronRight size={15} />
              </Link>
            </header>
            {(notifications?.items || []).length ? (
              <ul>
                {(notifications?.items || []).slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <Link
                      className="teacher-dashboard-activity"
                      to="/teacher/notifications"
                    >
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.body}</small>
                      </span>
                      <small>{formatDate(item.createdAt)}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Aucune activité récente"
                message="Les dernières notifications apparaîtront ici."
              />
            )}
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={Boolean(confirmation)}
        title={
          confirmation?.decision === "ACCEPTED"
            ? "Accepter cette demande ?"
            : "Refuser cette demande ?"
        }
        body={`Confirmez votre réponse à la demande de ${confirmation?.studentName || ""}.`}
        confirmLabel={
          confirmation?.decision === "ACCEPTED" ? "Accepter" : "Refuser"
        }
        confirmDisabled={busy}
        onCancel={() => setConfirmation(null)}
        onConfirm={confirmSupervisionResponse}
      />
      {toast && <Toast message={toast} onClose={closeToast} />}
    </section>
  );
}
