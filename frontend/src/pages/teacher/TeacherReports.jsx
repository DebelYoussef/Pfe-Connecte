import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, FileText, Search } from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState";
import Skeleton from "../../components/ui/Skeleton";
import { listLatestTeacherReports } from "../../services.teacher";
import "./teacherPages.css";

const labels = {
  UNDER_REVIEW: "À examiner",
  VALIDATED: "Validé",
  CHANGES_REQUESTED: "Modifications demandées",
};
const options = ["Tous les statuts", ...Object.values(labels)];

function ReportStatus({ status }) {
  const kind =
    status === "UNDER_REVIEW"
      ? "review"
      : status === "VALIDATED"
        ? "validated"
        : "changes";
  return (
    <span className={`rp-badge rp-badge-${kind}`}>
      <i />
      {labels[status]}
    </span>
  );
}

export default function TeacherReports() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(options[0]);

  const fetchItems = useCallback(() => listLatestTeacherReports(), []);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items: reports } = await fetchItems();
      setItems(reports);
    } catch (loadError) {
      setError(
        loadError?.message || "Impossible de charger les rapports.",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchItems]);

  useEffect(() => {
    let active = true;
    fetchItems()
      .then(({ items: reports }) => {
        if (active) setItems(reports);
      })
      .catch((loadError) => {
        if (active)
          setError(loadError?.message || "Impossible de charger les rapports.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchItems]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("fr");
    return items.filter((item) => {
      const content = `${item.studentName} ${item.reportTitle} ${item.companyName}`;
      return (
        content.toLocaleLowerCase("fr").includes(term) &&
        (filter === options[0] || labels[item.status] === filter)
      );
    });
  }, [items, query, filter]);

  const reviewCount = items.filter(
    (item) => item.status === "UNDER_REVIEW" && !item.teacherDecision,
  ).length;
  const validatedCount = items.filter(
    (item) => item.status === "VALIDATED",
  ).length;
  const changesCount = items.filter(
    (item) => item.status === "CHANGES_REQUESTED",
  ).length;
  const stats = [
    { label: "Rapports récents", count: items.length, type: "teal" },
    { label: "À examiner", count: reviewCount, type: "gold" },
    { label: "Validés", count: validatedCount, type: "green" },
    {
      label: "Modifications demandées",
      count: changesCount,
      type: "slate",
    },
  ];

  return (
    <section className="rp-page student-page" aria-labelledby="rp-title">
      <header className="rp-heading">
        <div>
          <span className="rp-eyebrow">ESPACE ENSEIGNANT</span>
          <h1 id="rp-title">Rapports PFE</h1>
          <p>
            Consultez les dernières versions et accompagnez chaque étudiant
            jusqu’à la validation finale.
          </p>
        </div>
        <span className="rp-total">
          <FileText size={18} />
          {loading
            ? "…"
            : `${items.length} rapport${items.length !== 1 ? "s" : ""}`}
        </span>
      </header>

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
        <div className="rp-toolbar">
          <label className="rp-search">
            <Search size={16} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher par étudiant, titre ou entreprise…"
              aria-label="Rechercher un rapport"
            />
          </label>
          <label className="rp-filter">
            <span>Statut</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label="Filtrer par statut"
            >
              {options.map((option) => (
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
          </div>
        ) : filtered.length ? (
          <div className="rp-table-wrap">
            <table className="rp-table">
              <thead>
                <tr>
                  <th>Étudiant</th>
                  <th>Titre du rapport</th>
                  <th>Date</th>
                  <th>Entreprise</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={`${item.studentId}-${item.version}`}>
                    <td>
                      <span className="rp-student">
                        <span className="rp-avatar">
                          {item.studentName
                            .split(" ")
                            .slice(-1)[0]
                            .slice(-2)}
                        </span>
                        <strong>{item.studentName}</strong>
                      </span>
                    </td>
                    <td className="rp-title-cell">{item.reportTitle}</td>
                    <td>
                      {new Intl.DateTimeFormat("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(item.submittedAt))}
                    </td>
                    <td>{item.companyName}</td>
                    <td>
                      <ReportStatus status={item.status} />
                    </td>
                    <td>
                      <div className="rp-actions">
                        <Link
                          className="rp-consult"
                          to={`/teacher/etudiants/${item.studentId}`}
                        >
                          <Check size={14} />
                          Examiner
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="rp-mobile-list">
              {filtered.map((item) => (
                <article
                  className="rp-mobile-card"
                  key={`${item.studentId}-${item.version}-mobile`}
                >
                  <header>
                    <span className="rp-avatar">
                      {item.studentName
                        .split(" ")
                        .slice(-1)[0]
                        .slice(-2)}
                    </span>
                    <div>
                      <strong>{item.studentName}</strong>
                      <span>{item.companyName}</span>
                    </div>
                    <ReportStatus status={item.status} />
                  </header>
                  <h3>{item.reportTitle}</h3>
                  <p>
                    Version {item.version} ·{" "}
                    {new Intl.DateTimeFormat("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(item.submittedAt))}
                  </p>
                  <div className="rp-actions">
                    <Link
                      className="rp-consult"
                      to={`/teacher/etudiants/${item.studentId}`}
                    >
                      Examiner
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            title={items.length ? "Aucun rapport trouvé" : "Aucun rapport soumis"}
            message={
              items.length
                ? "Modifiez votre recherche ou le filtre de statut."
                : "Les dernières versions des rapports de vos étudiants apparaîtront ici."
            }
          />
        )}
      </section>
    </section>
  );
}
