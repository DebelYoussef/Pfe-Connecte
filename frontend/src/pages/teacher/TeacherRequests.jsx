import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock3, GraduationCap, Search, X } from "lucide-react";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import StatusBadge from "../../components/ui/StatusBadge";
import Toast from "../../components/ui/Toast";
import { getMe } from "../../services";
import { listMySupervisions, respondToSupervision } from "../../services.teacher";
import "./teacherPages.css";

const statusLabels = {
  REQUESTED: "En attente",
  ACCEPTED: "Acceptée",
  ASSIGNED: "Affecté par le responsable",
  DECLINED: "Refusée",
};

const statusOptions = [
  { value: "ALL", label: "Toutes" },
  { value: "REQUESTED", label: "En attente" },
  { value: "ACCEPTED", label: "Acceptées" },
  { value: "ASSIGNED", label: "Affectées" },
  { value: "DECLINED", label: "Refusées" },
];

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter((part) => /\p{L}/u.test(part));
  const value =
    parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : (parts[0] || "").slice(0, 2);
  return value.toLocaleUpperCase("fr");
}

function formatReceivedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const received = new Date(date);
  received.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysAgo = Math.round((today - received) / 86400000);
  if (daysAgo === 0) return "Aujourd'hui";
  if (daysAgo === 1) return "Hier";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr");
}

function matchesExpertise(item, expertise) {
  const subject = normalize(`${item.subjectTitle} ${item.specialty}`);
  return expertise.some((tag) => {
    const term = normalize(tag).trim();
    return term && subject.includes(term);
  });
}

function emptyTitle(filter) {
  if (filter === "REQUESTED") return "Aucune demande en attente";
  if (filter === "ACCEPTED") return "Aucune demande acceptée";
  if (filter === "ASSIGNED") return "Aucune demande affectée";
  if (filter === "DECLINED") return "Aucune demande refusée";
  return "Aucune demande";
}

export default function TeacherRequests() {
  const [items, setItems] = useState([]);
  const [expertise, setExpertise] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("REQUESTED");
  const [expertiseError, setExpertiseError] = useState("");
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
      setItems(supervisions);
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
        if (active) setItems(supervisions);
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError?.message ||
              "Impossible de charger les demandes d’encadrement.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchItems]);

  useEffect(() => {
    let active = true;
    getMe()
      .then((profile) => {
        if (active) {
          setExpertise(
            Array.isArray(profile?.expertise) ? profile.expertise : [],
          );
          setExpertiseError("");
        }
      })
      .catch((profileError) => {
        if (active) {
          setExpertiseError(
            profileError?.message ||
              "Impossible de charger votre profil d’expertise.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    return items
      .filter((item) => {
        const content = normalize(
          `${item.studentName} ${item.subjectTitle} ${item.companyName}`,
        );
        return (
          content.includes(term) &&
          (filter === "ALL" || item.status === filter)
        );
      })
      .sort((left, right) => {
        if (left.status === "REQUESTED" && right.status !== "REQUESTED") {
          return -1;
        }
        if (right.status === "REQUESTED" && left.status !== "REQUESTED") {
          return 1;
        }
        return right.requestedAt.localeCompare(left.requestedAt);
      });
  }, [items, query, filter]);

  const requestedCount = items.filter(
    (item) => item.status === "REQUESTED",
  ).length;
  const acceptedCount = items.filter(
    (item) => ["ACCEPTED", "ASSIGNED"].includes(item.status),
  ).length;
  const declinedCount = items.filter(
    (item) => item.status === "DECLINED",
  ).length;
  const counts = [
    {
      label: "Total",
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
      setConfirmation(null);
      if (responseError?.status === 409) {
        await load();
        setActionError(
          "Cette demande a déjà été traitée. La liste a été actualisée.",
        );
      } else {
        setActionError(
          responseError?.message || "La réponse à la demande a échoué.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function reloadExpertise() {
    try {
      const profile = await getMe();
      setExpertise(
        Array.isArray(profile?.expertise) ? profile.expertise : [],
      );
      setExpertiseError("");
    } catch (profileError) {
      setExpertiseError(
        profileError?.message ||
          "Impossible de charger votre profil d’expertise.",
      );
    }
  }

  return (
    <section className="rq-page student-page" aria-label="Demandes d'encadrement">
      <PageHeader
        eyebrow="Espace enseignant"
        title="Demandes d'encadrement"
        subtitle="Examinez les demandes des étudiants et choisissez ceux que vous souhaitez encadrer."
      />

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
            <h2>Demandes d’encadrement</h2>
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
              placeholder="Rechercher par nom, sujet ou entreprise…"
              aria-label="Rechercher une demande par nom, sujet ou entreprise"
            />
          </label>
          <label className="rq-filter">
            <span>Statut</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label="Filtrer par statut"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {actionError && (
          <div className="teacher-zone-error" role="alert">
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError("")}>
              Fermer
            </button>
          </div>
        )}
        {expertiseError && (
          <div className="teacher-zone-error" role="alert">
            <span>Expertise indisponible : {expertiseError}</span>
            <button type="button" onClick={reloadExpertise}>
              Réessayer
            </button>
          </div>
        )}

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
                  <span className="rq-avatar" aria-hidden="true">
                    {initials(item.studentName)}
                  </span>
                  <div className="rq-person">
                    <h3>{item.studentName}</h3>
                    <span>{item.specialty}</span>
                  </div>
                  <StatusBadge
                    status={item.status}
                    label={statusLabels[item.status]}
                  />
                </header>
                <div className="rq-subject">
                  <span>SUJET PROPOSÉ</span>
                  <strong>{item.subjectTitle}</strong>
                  {matchesExpertise(item, expertise) && (
                    <span className="rq-expertise">
                      Correspond à votre expertise
                    </span>
                  )}
                </div>
                <div className="rq-meta">
                  <span>
                    <small>Entreprise</small>
                    <b>{item.companyName}</b>
                  </span>
                  <span>
                    <small>Établissement</small>
                    <b>{item.etab}</b>
                  </span>
                  <span>
                    <small>Reçue le</small>
                    <b>{formatReceivedDate(item.requestedAt)}</b>
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
            title={query.trim() ? "Aucune demande trouvée" : emptyTitle(filter)}
            message={
              query.trim()
                ? "Modifiez votre recherche ou le filtre de statut."
                : "Les demandes correspondant à ce statut apparaîtront ici."
            }
          />
        )}
      </section>

      <ConfirmDialog
        open={Boolean(confirmation)}
        title={
          confirmation?.decision === "ACCEPTED"
            ? "Accepter cette demande ?"
            : "Refuser cette demande ?"
        }
        body={
          confirmation?.decision === "ACCEPTED"
            ? "L’étudiant sera notifié de votre réponse et ajouté à « Mes étudiants »."
            : "L’étudiant sera notifié de votre réponse."
        }
        confirmLabel={
          busy
            ? "Enregistrement…"
            : confirmation?.decision === "ACCEPTED"
              ? "Accepter"
              : "Refuser"
        }
        confirmDisabled={busy}
        onCancel={() => setConfirmation(null)}
        onConfirm={confirmResponse}
      />
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
