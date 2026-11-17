import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ErrorBanner from "../../components/ErrorBanner";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import StatusBadge from "../../components/ui/StatusBadge";
import { getBlockedCount, getConventionsToSignCount, getDraftCount, isBlocked, listConventions } from "../../services.responsable";

const labels = {
  DRAFT: "Brouillon",
  SUBMITTED: "Soumise",
  SIGNED_STUDENT: "Signée par l’étudiant",
  SIGNED_COMPANY: "Signée par l’entreprise",
  APPROVED: "Approuvée",
};

export default function ResponsableConventions() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("ALL");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await listConventions({ limit: 100 });
      setItems(result.items);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const toSign = getConventionsToSignCount(items);
  const blocked = getBlockedCount(items);
  const drafts = getDraftCount(items);
  const visible = items.filter((item) => {
    if (filter === "TO_SIGN") return item.state === "SIGNED_COMPANY";
    if (filter === "BLOCKED") return isBlocked(item);
    if (filter === "DRAFT") return item.state === "DRAFT";
    return true;
  });

  return (
    <section className="student-page responsable-page">
      <PageHeader eyebrow="Espace responsable" title="Conventions" subtitle="Traitez les conventions de votre institution." />
      {error && <ErrorBanner title="Impossible de charger les conventions" message={error.message} onRetry={() => void load()} />}
      <div className="responsable-convention-tabs">
        {[
          ["ALL", "Toutes", items.length],
          ["TO_SIGN", "À signer", toSign],
          ["BLOCKED", "Bloquées", blocked],
          ["DRAFT", "À corriger", drafts],
        ].map(([id, label, count]) => (
          <button type="button" className={filter === id ? "active" : ""} onClick={() => setFilter(id)} key={id}>
            {label} <span>{count}</span>
          </button>
        ))}
      </div>
      {loading ? (
        <div aria-busy="true">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="responsable-row-skeleton" />)}</div>
      ) : visible.length ? (
        <div className="responsable-convention-list">
          {visible.map((item) => (
            <article key={item.conventionId}>
              <div>
                <strong>{item.studentName}</strong>
                <small>{item.companyName} · {item.subjectTitle}</small>
              </div>
              <StatusBadge status={item.state} label={labels[item.state]} />
              {isBlocked(item) && <span className="responsable-blocked-label">Bloquée</span>}
              <Link className="outlined-action" to={`/responsable/conventions/${item.conventionId}`}>Voir</Link>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Aucune convention" message="Aucun dossier ne correspond à ce filtre." actionLabel="Voir toutes les conventions" actionTo="/responsable/conventions" />
      )}
    </section>
  );
}
