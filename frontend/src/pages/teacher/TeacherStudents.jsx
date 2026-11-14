import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  Search,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import { listTeacherStudents } from "../../services.teacher";
import "./teacherPages.css";

const allStatuses = [
  "En cours",
  "Rapport à examiner",
  "Modifications demandées",
  "Validé",
];

function studentStatus(student) {
  if (!student.latestReport) return "En cours";
  if (student.latestReport.status === "CHANGES_REQUESTED")
    return "Modifications demandées";
  if (student.latestReport.status === "VALIDATED") return "Validé";
  return "Rapport à examiner";
}

function StudentStatus({ status }) {
  const kind =
    status === "Validé"
      ? "validated"
      : status === "Modifications demandées"
        ? "changes"
      : status === "Rapport à examiner"
        ? "review"
        : "progress";
  return (
    <span className={`ts-status ts-status-${kind}`}>
      <i />
      {status}
    </span>
  );
}

export default function TeacherStudents() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tous les statuts");

  const fetchItems = useCallback(() => listTeacherStudents(), []);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchItems());
    } catch (loadError) {
      setError(
        loadError?.message ||
          "Impossible de charger la liste des étudiants.",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchItems]);

  useEffect(() => {
    let active = true;
    fetchItems()
      .then((result) => {
        if (active) setItems(result);
      })
      .catch((loadError) => {
        if (active)
          setError(
            loadError?.message ||
              "Impossible de charger la liste des étudiants.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchItems]);

  const filteredStudents = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("fr");
    return items.filter((student) => {
      const matchesQuery = [
        student.studentName,
        student.specialty,
        student.subjectTitle,
        student.companyName,
      ]
        .join(" ")
        .toLocaleLowerCase("fr")
        .includes(term);
      return (
        matchesQuery &&
        (status === "Tous les statuts" || studentStatus(student) === status)
      );
    });
  }, [items, query, status]);

  const reviewCount = items.filter(
    (student) =>
      student.latestReport?.status === "UNDER_REVIEW" &&
      !student.latestReport.teacherDecision,
  ).length;
  const validatedCount = items.filter(
    (student) => student.latestReport?.status === "VALIDATED",
  ).length;
  const stats = [
    { label: "Total", value: items.length, icon: Users, type: "teal" },
    {
      label: "En cours",
      value: items.filter((student) => !student.latestReport).length,
      icon: BookOpen,
      type: "gold",
    },
    {
      label: "Rapports à examiner",
      value: reviewCount,
      icon: FileText,
      type: "slate",
    },
    {
      label: "Validés",
      value: validatedCount,
      icon: Check,
      type: "green",
    },
  ];

  return (
    <section className="ts-page student-page">
      <PageHeader
        eyebrow="Espace enseignant"
        title="Mes étudiants"
        subtitle="Retrouvez les étudiants que vous accompagnez et suivez l’avancement de leurs projets de fin d’études."
        action={
          <span className="ts-count">
            <Users size={18} />
            {loading
              ? "…"
              : `${items.length} étudiant${items.length > 1 ? "s" : ""}`}
          </span>
        }
      />

      <div className="ts-stats">
        {stats.map(({ label, value, icon: Icon, type }) => (
          <article className={`ts-stat ts-stat-${type}`} key={label}>
            <span className="ts-stat-icon">
              <Icon size={18} />
            </span>
            <div>
              <span className="ts-stat-label">{label}</span>
              {loading ? <Skeleton /> : <strong>{value}</strong>}
            </div>
          </article>
        ))}
      </div>

      <section className="ts-list" aria-label="Liste des étudiants">
        <div className="ts-list-heading">
          <div>
            <span className="ts-eyebrow">VOTRE PORTEFEUILLE</span>
            <h2>Liste des étudiants</h2>
          </div>
          {!loading && !error && (
            <span className="ts-result-count">
              {filteredStudents.length} résultat
              {filteredStudents.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="ts-toolbar">
          <label className="ts-search">
            <Search size={17} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher par nom, sujet ou entreprise…"
              aria-label="Rechercher un étudiant par nom, sujet ou entreprise"
            />
          </label>
          <label className="ts-filter">
            <span>Statut</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filtrer les étudiants par statut"
            >
              <option>Tous les statuts</option>
              {allStatuses.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

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
            <Skeleton />
          </div>
        ) : filteredStudents.length ? (
          <div className="ts-grid">
            {filteredStudents.map((student) => {
              const label = studentStatus(student);
              return (
                <Link
                  className="ts-card interactive"
                  key={student.studentId}
                  to={`/teacher/etudiants/${student.studentId}`}
                  title={`Consulter le dossier de ${student.studentName}`}
                >
                  <header className="ts-card-header">
                    <span className="ts-avatar">
                      {student.studentName
                        .split(" ")
                        .slice(-1)[0]
                        .slice(-2)}
                    </span>
                    <div className="ts-student-name">
                      <h3>{student.studentName}</h3>
                      <span>{student.specialty}</span>
                    </div>
                    <StudentStatus status={label} />
                  </header>
                  <div className="ts-card-subject">
                    <span>Sujet PFE</span>
                    <strong>{student.subjectTitle}</strong>
                  </div>
                  <footer className="ts-card-footer">
                    <span>
                      <small>Entreprise</small>
                      <strong>{student.companyName}</strong>
                    </span>
                    <span>
                      <small>Établissement</small>
                      <strong>{student.etab}</strong>
                    </span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </footer>
                </Link>
              );
            })}
          </div>
        ) : items.length ? (
          <EmptyState
            title="Aucun étudiant trouvé"
            message="Modifiez votre recherche ou choisissez un autre statut."
          />
        ) : (
          <EmptyState
            title="Aucun étudiant encadré"
            message="Les étudiants acceptés ou confiés par l’établissement apparaîtront ici."
          />
        )}
      </section>
    </section>
  );
}
