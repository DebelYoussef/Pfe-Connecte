import { useEffect, useState } from "react";
import ErrorBanner from "../../components/ErrorBanner";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import Toast from "../../components/ui/Toast";
import { assignSupervisor, listConventions, listTeachers } from "../../services.responsable";

export default function ResponsableEncadrement() {
  const [conventions, setConventions] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState({});
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [result, teacherResult] = await Promise.all([
        listConventions({ withoutSupervisor: true, limit: 100 }),
        listTeachers(),
      ]);
      setConventions(result.items);
      setTeachers(teacherResult);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function assign(conventionId) {
    if (!selected[conventionId]) return;
    setBusy(conventionId);
    try {
      await assignSupervisor(conventionId, selected[conventionId]);
      setToast("Encadrant assigné.");
      await load();
    } catch (actionError) {
      setError(actionError);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="student-page responsable-page">
      <PageHeader eyebrow="Espace responsable" title="Encadrement" subtitle="Assignez un enseignant aux conventions approuvées." />
      {error && <ErrorBanner title="Impossible de charger l’encadrement" message={error.message} onRetry={() => void load()} />}
      {loading ? (
        <Skeleton className="responsable-row-skeleton" />
      ) : conventions.length ? (
        <div className="responsable-encadrement-list">
          {conventions.map((item) => (
            <article key={item.conventionId}>
              <div>
                <strong>{item.studentName}</strong>
                <small>{item.subjectTitle} · {item.companyName}</small>
              </div>
              <select value={selected[item.conventionId] || ""} onChange={(event) => setSelected((current) => ({ ...current, [item.conventionId]: event.target.value }))}>
                <option value="">Choisir un enseignant</option>
                {teachers.map((teacher) => (
                  <option value={teacher.userId} key={teacher.userId}>{teacher.firstName} {teacher.lastName} — {teacher.expertise.join(", ")}</option>
                ))}
              </select>
              <button type="button" className="hero-button" disabled={busy === item.conventionId || !selected[item.conventionId]} title={!selected[item.conventionId] ? "Choisissez un enseignant" : "Assigner cet enseignant"} onClick={() => void assign(item.conventionId)}>
                Assigner
              </button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Aucun étudiant sans encadrant" message="Toutes les conventions approuvées sont encadrées." actionLabel="Voir les conventions" actionTo="/responsable/conventions" />
      )}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
