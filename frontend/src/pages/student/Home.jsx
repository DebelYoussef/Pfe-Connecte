import {
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleAlert,
  Cpu,
  FileCheck2,
  FileText,
  Network,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getDeadline,
  getMe,
  getMyConvention,
  getMyReport,
  getMySupervision,
  listMyApplications,
  listMyJournals,
  listNotifications,
  listMyRecommendations,
} from "../../services";
import { getUser } from "../../auth";

const stepData = [
  {
    title: "Candidature",
    description: "Postulez à jusqu’à 5 offres.",
    to: "/student/candidatures",
    icon: BriefcaseBusiness,
  },
  {
    title: "Confirmation",
    description: "Confirmez l’offre acceptée par l’entreprise.",
    to: "/student/candidatures",
    icon: Check,
  },
  {
    title: "Convention",
    description: "Signatures : étudiant, entreprise, responsable.",
    to: "/student/convention",
    icon: FileText,
  },
  {
    title: "Encadrant",
    description: "Choisissez un enseignant pour vous suivre.",
    to: "/student/encadrant",
    icon: Network,
  },
  {
    title: "Journal de stage",
    description: "Une entrée par semaine, validée par l’entreprise.",
    to: "/student/journal",
    icon: FileCheck2,
  },
  {
    title: "Rapport final",
    description: "Dépôt du PDF et double validation.",
    to: "/student/rapport",
    icon: FileText,
  },
];
const offerIcons = [BriefcaseBusiness, Cpu, Network];
function Loading() {
  return (
    <div className="dashboard-skeleton" aria-label="Chargement">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}
function ErrorBox({ retry }) {
  return (
    <div className="dashboard-error" role="alert">
      <CircleAlert size={18} />
      Impossible de charger ces informations.
      <button onClick={retry}>
        <RefreshCw size={14} />
        Réessayer
      </button>
    </div>
  );
}
function stateHeadline(data) {
  if (data.convention?.state === "APPROVED" && !data.supervision)
    return "Choisissez votre encadrant";
  if (data.convention?.state === "APPROVED") return "Votre stage est confirmé";
  if (data.convention) return "Votre convention est en cours de signature";
  if (data.applications.some((a) => a.status === "ACCEPTED"))
    return "Une entreprise vous a accepté : confirmez votre stage";
  if (data.activeCount > 0)
    return `${data.activeCount} candidature${data.activeCount > 1 ? "s" : ""} en cours`;
  return "Trouvez votre stage de fin d’études";
}
function daysUntil(date) {
  return Math.max(0, Math.ceil((new Date(date) - new Date()) / 86400000));
}
export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const load = () =>
    Promise.all([
      getMe(),
      listMyRecommendations(),
      listMyApplications(),
      getMyConvention(),
      getMySupervision(),
      listMyJournals(),
      getMyReport(),
      listNotifications(),
      getDeadline(),
    ])
      .then(
        ([
          me,
          recommendations,
          applications,
          convention,
          supervision,
          journals,
          report,
          notifications,
          deadline,
        ]) =>
          setData({
            me,
            recommendations,
            applications,
            convention,
            supervision,
            journals,
            report,
            notifications,
            deadline,
          }),
      )
      .catch(() => setError(true));
  useEffect(() => {
    load();
  }, []);
  const steps = useMemo(() => {
    if (!data) return [];
    const done = [
      data.applications.items.length > 0,
      Boolean(data.convention),
      data.convention?.state === "APPROVED",
      ["ACCEPTED", "ASSIGNED"].includes(data.supervision?.status),
      data.journals.items.length > 0,
      data.report?.status === "VALIDATED",
    ];
    let current = done.findIndex((value) => !value);
    return stepData.map((step, index) => ({
      ...step,
      done: done[index],
      current: current === index,
    }));
  }, [data]);
  if (error)
    return (
      <ErrorBox
        retry={() => {
          setError(false);
          load();
        }}
      />
    );
  if (!data) return <Loading />;
  const unread = data.notifications.items.filter((n) => !n.read);
  const tasks = [
    {
      tag: "Candidature",
      text: data.applications.items[0]
        ? `Suivre votre candidature chez ${data.applications.items[0].companyName}`
        : "Postuler à une offre qui vous correspond",
      to: "/student/candidatures",
    },
    data.convention && data.convention.state !== "APPROVED"
      ? {
          tag: "Convention",
          text: "Signer la convention",
          to: "/student/convention",
        }
      : null,
    !data.journals.items.length
      ? {
          tag: "Journal",
          text: "Remplir le journal de la semaine 45",
          to: "/student/journal",
        }
      : null,
    data.report && data.report.status !== "VALIDATED"
      ? {
          tag: "Rapport",
          text: "Suivre la validation de votre rapport",
          to: "/student/rapport",
        }
      : null,
  ]
    .filter(Boolean)
    .slice(0, 4);
  return (
    <div className="home-dashboard">
      <section className="student-hero">
        <div className="hero-copy">
          <p className="eyebrow">
            Bonjour, {getUser()?.firstName || data.me.firstName}
          </p>
          <h1>
            {stateHeadline({ ...data, applications: data.applications.items })}
          </h1>
          <span
            className={
              data.me.activeCount >= 5
                ? "activity-chip danger"
                : data.me.activeCount >= 4
                  ? "activity-chip warning"
                  : "activity-chip"
            }
          >
            Candidatures actives : {data.me.activeCount}/5
          </span>
          <Link className="hero-button" to="/student/candidatures">
            Voir mes candidatures <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="recommendations" aria-label="Offres recommandées">
          {data.recommendations.items.map((item, index) => {
            const Icon = offerIcons[index];
            return (
              <Link
                className={`offer-card offer-${index + 1}`}
                key={item.offerId}
                to={`/student/offres/${item.offerId}`}
              >
                <small>0{index + 1}</small>
                <h2>{item.offer.title}</h2>
                <span>{item.offer.companyName}</span>
                <span>
                  {item.offer.gouvernorat} · {item.offer.durationWeeks} semaines
                </span>
                <Icon className="offer-deco" size={86} />
              </Link>
            );
          })}
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="journey-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">Votre progression</p>
              <h2>Mon parcours de stage</h2>
            </div>
            <strong>{steps.filter((s) => s.done).length}/6</strong>
          </div>
          <div className="progress-track">
            <span
              style={{
                width: `${(steps.filter((s) => s.done).length / 6) * 100}%`,
              }}
            />
          </div>
          <div className="journey-steps">
            {steps.map(
              ({ title, description, to, icon: Icon, done, current }) => (
                <Link
                  className={current ? "journey-step current" : "journey-step"}
                  to={to}
                  key={title}
                >
                  <span className={done ? "step-icon done" : "step-icon"}>
                    <Icon size={18} />
                    {done && (
                      <i>
                        <Check size={10} />
                      </i>
                    )}
                  </span>
                  <span className="step-copy">
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                  <ChevronRight size={17} />
                </Link>
              ),
            )}
          </div>
        </section>
        <aside className="dashboard-aside">
          <section className="aside-block">
            <div className="aside-heading">
              <h2>À faire</h2>
              <Link to="/student/candidatures">Voir tout</Link>
            </div>
            {tasks.length ? (
              tasks.map((task) => (
                <Link className="task-row" to={task.to} key={task.text}>
                  <span className={`task-tag ${task.tag.toLowerCase()}`}>
                    {task.tag}
                  </span>
                  <span>{task.text}</span>
                  <ChevronRight size={15} />
                </Link>
              ))
            ) : (
              <p className="empty-state">Votre espace est à jour.</p>
            )}
          </section>
          {data.deadline.deadlineEnabled && (
            <section className="deadline-card">
              <p>Échéance du PFE</p>
              <strong>15 février 2027</strong>
              <span>{daysUntil(data.deadline.deadline)} jours restants</span>
            </section>
          )}
          <section className="aside-block">
            <div className="aside-heading">
              <h2>Notifications récentes</h2>
              <Link to="/student/notifications">Tout voir</Link>
            </div>
            {unread.length ? (
              data.notifications.items.slice(0, 3).map((note) => (
                <div className="notification-row" key={note.id}>
                  <span className={note.read ? "read-dot" : "unread-dot"} />
                  <div>
                    <strong>{note.title}</strong>
                    <small>il y a 2 h</small>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-state">Aucune notification récente.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
