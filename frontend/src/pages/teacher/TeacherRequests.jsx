import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock3, GraduationCap, Search, UsersRound, X } from "lucide-react";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import EmptyState from "../../components/ui/EmptyState";
import Skeleton from "../../components/ui/Skeleton";
import Toast from "../../components/ui/Toast";
import { listMySupervisions, respondToSupervision } from "../../services.teacher";
import "./teacherPages.css";

const labels = {
  REQUESTED: "En attente",
  ACCEPTED: "Acceptée",
  DECLINED: "Refusée",
};
const options = ["Tous les statuts", ...Object.values(labels)];

function RequestStatus({ status }) {
  return (
    <span className={`rq-badge rq-badge-${status.toLowerCase()}`}>
      <i />
      {labels[status]}
    </span>
  );
}

export default function TeacherRequests() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(options[0]);
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [toast, setToast] = useState("");

  const fetchItems = useCallback(() => listMySupervisions(), []);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items: supervisions } = await fetchItems();
      setItems(supervisions.filter((item) => item.status !== "ASSIGNED"));
    } catch (loadError) {
      setError(
        loadError?.message ||
          "Impossible de charger les demandes d’encadrement.",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchItems]);

  useEffect(() => {
    let active = true;
    fetchItems()
      .then(({ items: supervisions }) => {
        if (active)
          setItems(supervisions.filter((item) => item.status !== "ASSIGNED"));
      })
      .catch((loadError) => {
        if (active)
          setError(
            loadError?.message ||
              "Impossible de charger les demandes d’encadrement.",
          );
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
      const content = `${item.studentName} ${item.subjectTitle} ${item.etab}`;
      return (
        content.toLocaleLowerCase("fr").includes(term) &&
        (filter === options[0] || labels[item.status] === filter)
      );
    });
  }, [items, query, filter]);

  const requestedCount = items.filter(
    (item) => item.status === "REQUESTED",
  ).length;
  const acceptedCount = items.filter(
    (item) => item.status === "ACCEPTED",
  ).length;
  const declinedCount = items.filter(
    (item) => item.status === "DECLINED",
  ).length;
  const counts = [
    {
      label: "Total des demandes",
      count: items.length,
      icon: GraduationCap,
      type: "teal",
    },
    {
      label: "En attente",
      count: requestedCount,
      icon: Clock3,
      type: "gold",
    },
    {
      label: "Acceptées",
      count: acceptedCount,
      icon: Check,
      type: "green",
    },
    {
      label: "Refusées",
      count: declinedCount,
      icon: X,
      type: "rose",
    },
  ];

  async function confirmResponse() {
    if (!confirmation) return;
    setBusy(true);
    setActionError("");
    try {
      await respondToSupervision(
        confirmation.studentId,
        confirmation.decision,
      );
      await load();
      setToast(
        confirmation.decision === "ACCEPTED"
          ? "Demande acceptée."
          : "Demande refusée.",
      );
      setConfirmation(null);
    } catch (responseError) {
      setActionError(
        responseError?.message || "La réponse à la demande a échoué.",
      );
      setConfirmation(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rq-page student-page" aria-labelledby="rq-title">
      <header className="rq-heading">
        <div>
          <span className="rq-eyebrow">ESPACE ENSEIGNANT</span>
          <h1 id="rq-title">Demandes d’encadrement</h1>
          <p>
            Consultez les demandes reçues et choisissez les projets que vous
            souhaitez accompagner.
          </p>
        </div>
        <span className="rq-total">
          <UsersRound size={18} />
          {loading
            ? "…"
            : `${requestedCount} demande${requestedCount !== 1 ? "s" : ""} en attente`}
        </span>
      </header>

      <div className="rq-stats">
        {counts.map(({ label, count, icon: Icon, type }) => (
          <article className={`rq-stat rq-stat-${type}`} key={label}>
            <span className="rq-stat-icon">
              <Icon size={18} />
            </span>
            <div>
              <span>{label}</span>
              {loading ? <Skeleton /> : <strong>{count}</strong>}
            </div>
          </article>
        ))}
      </div>

      <section className="rq-list" aria-label="Liste des demandes">
        <header className="rq-list-heading">
          <div>
            <span className="rq-eyebrow">CANDIDATURES REÇUES</span>
            <h2>Toutes les demandes</h2>
          </div>
          {!loading && !error && (
            <span className="rq-results">
              {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </header>
        <div className="rq-toolbar">
          <label className="rq-search">
            <Search size={16} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher par nom, sujet ou institution…"
              aria-label="Rechercher une demande"
            />
          </label>
          <label className="rq-filter">
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
          <div className="rq-grid">
            {filtered.map((item) => (
              <article className="rq-card" key={item.studentId}>
                <header className="rq-card-heading">
                  <span className="rq-avatar">
                    {item.studentName.split(" ").slice(-1)[0].slice(-2)}
                  </span>
                  <div className="rq-person">
                    <h3>{item.studentName}</h3>
                    <span>{item.specialty}</span>
                  </div>
                  <RequestStatus status={item.status} />
                </header>
                <div className="rq-subject">
                  <span>SUJET PROPOSÉ</span>
                  <strong>{item.subjectTitle}</strong>
                </div>
                <div className="rq-meta">
                  <span>
                    <small>Établissement</small>
                    <b>{item.etab}</b>
                  </span>
                  <span>
                    <small>Reçue le</small>
                    <b>
                      {new Intl.DateTimeFormat("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(item.requestedAt))}
                    </b>
                  </span>
                </div>
                {item.status === "REQUESTED" && (
                  <footer className="rq-actions">
                    <button
                      className="rq-accept"
                      type="button"
                      onClick={() =>
                        setConfirmation({
                          studentId: item.studentId,
                          studentName: item.studentName,
                          decision: "ACCEPTED",
                        })
                      }
                    >
                      <Check size={15} />
                      Accepter
                    </button>
                    <button
                      className="rq-decline"
                      type="button"
                      onClick={() =>
                        setConfirmation({
                          studentId: item.studentId,
                          studentName: item.studentName,
                          decision: "DECLINED",
                        })
                      }
                    >
                      <X size={15} />
                      Refuser
                    </button>
                  </footer>
                )}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title={items.length ? "Aucune demande trouvée" : "Aucune demande"}
            message={
              items.length
                ? "Modifiez votre recherche ou le filtre de statut."
                : "Les demandes d’encadrement reçues apparaîtront ici."
            }
          />
        )}
        {actionError && (
          <div className="teacher-zone-error" role="alert">
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError("")}>
              Fermer
            </button>
          </div>
        )}
      </section>

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
        onConfirm={confirmResponse}
      />
      {toast && (
        <Toast message={toast} onClose={() => setToast("")} />
      )}
    </section>
  );
}
