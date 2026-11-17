import { CheckCircle2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ErrorBanner from "../../components/ErrorBanner";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Toast from "../../components/ui/Toast";
import {
  assignSupervisor,
  getAssignedSupervisorCount,
  listConventions,
  listTeachers,
} from "../../services.responsable";

const EXPERTISE_OPTIONS = [
  "python", "java", "aws", "docker", "react", "sql", "spring",
  "linux", "kubernetes", "django", "typescript", "git",
  "mongodb", "node", "angular",
];

function initials(teacher) {
  return [teacher.firstName, teacher.lastName]
    .filter(Boolean)
    .map((value) => value[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}

export default function ResponsableEncadrement() {
  const [conventions, setConventions] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [nextCursor, setNextCursor] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [activeStudent, setActiveStudent] = useState(null);
  const [query, setQuery] = useState("");
  const [expertise, setExpertise] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [affectedCount, setAffectedCount] = useState(getAssignedSupervisorCount());
  const [withoutSupervisorCount, setWithoutSupervisorCount] = useState(0);

  async function loadConventionQueue() {
    setLoading(true);
    setError(null);
    try {
      const [page, all] = await Promise.all([
        listConventions({ withoutSupervisor: true, limit: 5 }),
        listConventions({ withoutSupervisor: true, limit: 100 }),
      ]);
      setConventions(page.items);
      setWithoutSupervisorCount(all.items.length);
      setNextCursor(page.nextCursor);
      setAffectedCount(getAssignedSupervisorCount());
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }

  async function loadDirectory() {
    try {
      const result = await listTeachers({ limit: 100 });
      setTeachers(result.items);
    } catch (loadError) {
      setError(loadError);
    }
  }

  useEffect(() => {
    void loadConventionQueue();
    void loadDirectory();
  }, []);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await listConventions({
        withoutSupervisor: true,
        limit: 5,
        cursor: nextCursor,
      });
      setConventions((current) => [...current, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoadingMore(false);
    }
  }

  const visibleTeachers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    return teachers.filter((teacher) => {
      const haystack =
        `${teacher.firstName} ${teacher.lastName} ${teacher.expertise.join(" ")}`.toLocaleLowerCase("fr");
      return (
        (!normalizedQuery || haystack.includes(normalizedQuery)) &&
        (!expertise || teacher.expertise.includes(expertise))
      );
    });
  }, [expertise, query, teachers]);

  function matchesSubject(teacher) {
    if (!activeStudent) return false;
    const subject = `${activeStudent.subjectTitle} ${activeStudent.specialty || ""}`
      .toLocaleLowerCase("fr");
    return teacher.expertise.some((value) =>
      subject.includes(value.toLocaleLowerCase("fr")),
    );
  }

  async function confirmAssignment() {
    if (!activeStudent || !selectedTeacher) return;
    setBusy(true);
    setError(null);
    try {
      await assignSupervisor(activeStudent.studentId, selectedTeacher.userId);
      setToast("Encadrant affecté.");
      setSelectedTeacher(null);
      setActiveStudent(null);
      await loadConventionQueue();
    } catch (assignmentError) {
      setError(assignmentError);
      setSelectedTeacher(null);
      if (assignmentError?.status === 409) await loadConventionQueue();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="student-page responsable-page">
      <PageHeader
        eyebrow="Espace responsable"
        title="Encadrement"
        subtitle="Affectez un encadrant aux étudiants dont la convention est approuvée."
      />
      {error && (
        <ErrorBanner
          title={error.status === 409 ? "Affectation impossible" : "Impossible de charger l’encadrement"}
          message={error.message || "Une erreur est survenue."}
          onRetry={() => void loadConventionQueue()}
        />
      )}
      <div className="responsable-supervision-stats">
        <article>
          <strong>{withoutSupervisorCount}</strong>
          <span>Sans encadrant</span>
        </article>
        <article>
          <strong>{affectedCount}</strong>
          <span>Affectés cette session</span>
        </article>
      </div>
      {loading ? (
        <Skeleton className="responsable-row-skeleton" />
      ) : conventions.length ? (
        <>
          <div className="responsable-supervision-list">
            {conventions.map((item) => (
              <article key={item.conventionId}>
                <span className="responsable-student-avatar" aria-hidden="true">
                  {[item.studentName]
                    .join("")
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <div>
                  <h3>{item.studentName}</h3>
                  <small>{item.specialty}</small>
                </div>
                <div>
                  <strong>{item.companyName}</strong>
                  <small>{item.offerTitle}</small>
                </div>
                <div className="responsable-supervision-date">
                  <strong>Approuvée {formatDate(item.approvedAt)}</strong>
                  <small>
                    Approuvée depuis{" "}
                    {item.approvedAt
                      ? Math.max(
                          0,
                          Math.floor(
                            (Date.now() - new Date(item.approvedAt).getTime()) /
                              (24 * 60 * 60 * 1000),
                          ),
                        )
                      : 0}{" "}
                    jour(s)
                  </small>
                </div>
                <button
                  type="button"
                  className="hero-button"
                  onClick={() => {
                    setActiveStudent(item);
                    setSelectedTeacher(null);
                    setQuery("");
                    setExpertise("");
                  }}
                >
                  Affecter un encadrant
                </button>
              </article>
            ))}
          </div>
          {nextCursor && (
            <button
              type="button"
              className="secondary-button responsable-load-more"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? "Chargement…" : "Charger plus"}
            </button>
          )}
        </>
      ) : (
        <div className="responsable-supervision-empty">
          <CheckCircle2 aria-hidden="true" size={22} />
          <EmptyState
            title="Tous les étudiants ont un encadrant"
            message="Aucun étudiant approuvé n’attend d’affectation."
          />
        </div>
      )}

      {activeStudent && (
        <div className="responsable-teacher-backdrop" role="presentation">
          <section className="responsable-teacher-drawer" role="dialog" aria-modal="true">
            <div className="responsable-teacher-heading">
              <div>
                <p className="eyebrow">Affectation</p>
                <h3>Choisir un encadrant</h3>
                <small>Étudiant : {activeStudent.studentName}</small>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setActiveStudent(null)}
              >
                Fermer
              </button>
            </div>
            <label className="responsable-convention-search">
              <Search size={15} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher par nom ou expertise"
                aria-label="Rechercher un enseignant"
              />
            </label>
            <div className="responsable-expertise-chips" aria-label="Filtrer par expertise">
              <button
                type="button"
                className={!expertise ? "active" : ""}
                onClick={() => setExpertise("")}
              >
                Toutes
              </button>
              {EXPERTISE_OPTIONS.map((option) => (
                <button
                  type="button"
                  className={expertise === option ? "active" : ""}
                  onClick={() => setExpertise(option)}
                  key={option}
                >
                  {option}
                </button>
              ))}
            </div>
            {visibleTeachers.length ? (
              <div className="responsable-teacher-grid">
                {visibleTeachers.map((teacher) => {
                  const matching = matchesSubject(teacher);
                  return (
                    <article className={matching ? "matching" : ""} key={teacher.userId}>
                      <span className="responsable-teacher-avatar" aria-hidden="true">
                        {initials(teacher)}
                      </span>
                      <div>
                        <h4>{teacher.firstName} {teacher.lastName}</h4>
                        {matching && <span className="responsable-match-label">Correspond au sujet</span>}
                      </div>
                      <div className="responsable-teacher-skills">
                        {teacher.expertise.map((skill) => <span key={skill}>{skill}</span>)}
                      </div>
                      <button
                        type="button"
                        className="hero-button"
                        onClick={() => setSelectedTeacher(teacher)}
                      >
                        Sélectionner
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="Aucun enseignant"
                message="Aucun enseignant ne correspond à cette recherche."
              />
            )}
          </section>
        </div>
      )}
      {selectedTeacher && activeStudent && (
        <ConfirmDialog
          open
          title={`Affecter ${selectedTeacher.firstName} ${selectedTeacher.lastName} à ${activeStudent.studentName} ?`}
          body="L’encadrant et l’étudiant seront notifiés. L’affectation est immédiate."
          confirmLabel={busy ? "Affectation…" : "Affecter"}
          confirmDisabled={busy}
          onCancel={() => setSelectedTeacher(null)}
          onConfirm={() => void confirmAssignment()}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
