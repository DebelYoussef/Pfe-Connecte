import {
  Check,
  ChevronRight,
  FileText,
  GraduationCap,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/ui/PageHeader";
import {
  activities,
  reports,
  requests,
  students,
} from "../../data/teacherMockData";

const pendingRequests = requests.filter(
  (request) => request.status === "REQUESTED",
);
const reportsToReview = reports.filter(
  (report) => report.status === "UNDER_REVIEW",
);
const validatedReports = reports.filter(
  (report) => report.status === "VALIDATED",
);

const stats = [
  {
    label: "Étudiants encadrés",
    value: students.length,
    icon: UsersRound,
    to: "/teacher/etudiants",
  },
  {
    label: "Demandes en attente",
    value: pendingRequests.length,
    icon: GraduationCap,
    to: "/teacher/demandes",
  },
  {
    label: "Rapports à examiner",
    value: reportsToReview.length,
    icon: FileText,
    to: "/teacher/rapports",
  },
  {
    label: "Rapports validés",
    value: validatedReports.length,
    icon: Check,
    to: "/teacher/rapports",
  },
];

export default function TeacherDashboard() {
  return (
    <section className="student-page teacher-dashboard">
      <PageHeader
        eyebrow="Espace enseignant"
        title="Tableau de bord"
        subtitle="Suivez vos étudiants et accompagnez-les jusqu'à la réussite de leur projet de fin d'études."
      />
      <div className="teacher-dashboard-stats">
        {stats.map(({ label, value, icon: Icon, to }) => (
          <Link className="teacher-dashboard-stat interactive" to={to} key={label}>
            <span className="teacher-dashboard-stat-icon">
              <Icon size={18} />
            </span>
            <span>
              <small>{label}</small>
              <strong>{value}</strong>
            </span>
            <ChevronRight size={16} />
          </Link>
        ))}
      </div>
      <div className="teacher-dashboard-columns">
        <section className="teacher-dashboard-card">
          <header>
            <div>
              <p className="eyebrow">À DÉCIDER</p>
              <h2>Demandes d'encadrement</h2>
            </div>
            <Link to="/teacher/demandes">
              Voir toutes <ChevronRight size={15} />
            </Link>
          </header>
          {pendingRequests.length ? (
            <ul>
              {pendingRequests.map((request) => (
                <li key={request.id}>
                  <span>{request.subject}</span>
                  <span className="status-badge status-requested">
                    En attente
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Aucune demande en attente.</p>
          )}
        </section>
        <section className="teacher-dashboard-card">
          <header>
            <div>
              <p className="eyebrow">ACTIVITÉ RÉCENTE</p>
              <h2>Dernières actualités</h2>
            </div>
            <Link to="/teacher/notifications">
              Notifications <ChevronRight size={15} />
            </Link>
          </header>
          <ul>
            {activities.map((activity) => (
              <li key={activity.title}>
                <span>{activity.title}</span>
                <small>{activity.time}</small>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
