import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, MapPin, Search } from "lucide-react";
import ErrorBanner from "../../components/ErrorBanner";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import StatusBadge from "../../components/ui/StatusBadge";
import Toast from "../../components/ui/Toast";
import Tooltip from "../../components/ui/Tooltip";
import {
  actOnApplication,
  getOfferApplicationStatusCounts,
  listMyOffers,
  listOfferApplications,
  updateOffer,
} from "../../services.company";

const APPLICATION_STATUSES = [
  "PENDING",
  "VIEWED",
  "IN_PROGRESS",
  "ACCEPTED",
  "REJECTED",
  "CONFIRMED",
  "DECLINED",
  "WITHDRAWN",
];
const FILTERS = [
  { value: "ALL", label: "Toutes", statuses: APPLICATION_STATUSES },
  { value: "PROCESSING", label: "À traiter", statuses: ["PENDING", "VIEWED"] },
  { value: "IN_PROGRESS", label: "En cours", statuses: ["IN_PROGRESS"] },
  { value: "ACCEPTED", label: "Acceptées", statuses: ["ACCEPTED"] },
  {
    value: "COMPLETED",
    label: "Terminées",
    statuses: ["REJECTED", "DECLINED", "WITHDRAWN", "CONFIRMED"],
  },
];
const PROGRESS_STEPS = [
  { status: "PENDING", label: "Envoyée" },
  { status: "VIEWED", label: "Vue" },
  { status: "IN_PROGRESS", label: "En cours" },
  { status: "ACCEPTED", label: "Acceptée" },
  { status: "CONFIRMED", label: "Confirmée" },
];
const PROGRESS_INDEX = {
  PENDING: 0,
  VIEWED: 1,
  IN_PROGRESS: 2,
  ACCEPTED: 3,
  CONFIRMED: 4,
  REJECTED: 0,
  DECLINED: 3,
  WITHDRAWN: 0,
};

function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("fr");
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);
}

function normalizedSkill(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("fr");
}

function ApplicationSkeleton() {
  return (
    <div className="company-applicant-skeleton" aria-busy="true">
      {Array.from({ length: 3 }, (_, index) => (
        <article className="company-applicant-skeleton-card" key={index}>
          <Skeleton className="company-applicant-skeleton-avatar" />
          <span>
            <Skeleton className="company-applicant-skeleton-title" />
            <Skeleton className="company-applicant-skeleton-detail" />
            <Skeleton className="company-applicant-skeleton-skills" />
          </span>
          <Skeleton className="company-applicant-skeleton-status" />
        </article>
      ))}
    </div>
  );
}

export default function CompanyApplications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedOfferId = searchParams.get("offer");
  const [offers, setOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [offersLoaded, setOffersLoaded] = useState(false);
  const [offersRetry, setOffersRetry] = useState(0);
  const [applicationsRetry, setApplicationsRetry] = useState(0);
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [offerBusy, setOfferBusy] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    document.title = "Candidatures · PFE Connect";
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (active) setOffersLoading(true);
        return listMyOffers({ limit: 100 });
      })
      .then(({ items }) => {
        if (!active) return;
        setOffers(items);
        setOffersLoaded(true);
        setError(null);
      })
      .catch((loadError) => {
        if (active) setError(loadError);
      })
      .finally(() => {
        if (active) setOffersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [offersRetry]);

  const defaultOffer =
    offers.find(
      (offer) => getOfferApplicationStatusCounts(offer.offerId).total > 0,
    ) || offers[0];
  const requestedOfferExists = offers.some(
    (offer) => offer.offerId === requestedOfferId,
  );
  const selectedOfferId = requestedOfferExists
    ? requestedOfferId
    : defaultOffer?.offerId || "";

  useEffect(() => {
    if (!offersLoaded) return;
    if (selectedOfferId !== requestedOfferId) {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (selectedOfferId) next.set("offer", selectedOfferId);
          else next.delete("offer");
          return next;
        },
        { replace: true },
      );
    }
  }, [
    offers,
    offersLoaded,
    requestedOfferId,
    selectedOfferId,
    setSearchParams,
  ]);

  useEffect(() => {
    let active = true;
    if (!selectedOfferId) {
      Promise.resolve().then(() => {
        if (active) {
          setApplications([]);
          setApplicationsLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }

    Promise.resolve()
      .then(async () => {
        if (active) {
          setApplications([]);
          setApplicationsLoading(true);
        }
        const allApplications = [];
        let cursor = null;
        do {
          const page = await listOfferApplications(selectedOfferId, {
            limit: 100,
            cursor,
          });
          allApplications.push(...page.items);
          cursor = page.nextCursor;
        } while (cursor);
        if (active) setApplications(allApplications);
      })
      .catch((loadError) => {
        if (active) setError(loadError);
      })
      .finally(() => {
        if (active) setApplicationsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applicationsRetry, selectedOfferId]);

  const selectedOffer = offers.find(
    (offer) => offer.offerId === selectedOfferId,
  );
  const counts = useMemo(() => {
    const result = Object.fromEntries(
      APPLICATION_STATUSES.map((status) => [status, 0]),
    );
    for (const application of applications) {
      result[application.status] += 1;
    }
    return { ...result, total: applications.length };
  }, [applications]);

  const visibleApplications = useMemo(() => {
    const selectedFilter = FILTERS.find((item) => item.value === filter);
    const query = search.trim().toLocaleLowerCase("fr");
    return applications.filter(
      (application) =>
        selectedFilter.statuses.includes(application.status) &&
        application.studentName.toLocaleLowerCase("fr").includes(query),
    );
  }, [applications, filter, search]);

  function selectOffer(offerId) {
    setFilter("ALL");
    setSearch("");
    setError(null);
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("offer", offerId);
      return next;
    });
  }

  function retry() {
    setError(null);
    setOffersRetry((value) => value + 1);
    setApplicationsRetry((value) => value + 1);
  }

  async function runAction(application, action) {
    if (busy) return;
    setBusy(true);
    try {
      await actOnApplication(
        application.offerId,
        application.studentId,
        action,
      );
      setError(null);
      setDialog(null);
      setToast(
        action === "in_progress"
          ? "La candidature est passée en cours."
          : action === "accept"
            ? "La candidature a été acceptée."
            : "La candidature a été refusée.",
      );
      setApplicationsRetry((value) => value + 1);
    } catch (actionError) {
      setDialog(null);
      setError(actionError);
      if (actionError.status === 409) {
        setApplicationsRetry((value) => value + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  async function markOfferFilled() {
    if (!selectedOffer || offerBusy) return;
    setOfferBusy(true);
    try {
      const updatedOffer = await updateOffer(selectedOffer.offerId, {
        status: "FILLED",
      });
      setOffers((current) =>
        current.map((offer) =>
          offer.offerId === updatedOffer.offerId ? updatedOffer : offer,
        ),
      );
      setToast("L’offre a été marquée comme pourvue.");
    } catch (updateError) {
      setError(updateError);
      if (updateError.status === 409) {
        setOffersRetry((value) => value + 1);
      }
    } finally {
      setOfferBusy(false);
    }
  }

  const confirmedApplication = applications.some(
    (application) => application.status === "CONFIRMED",
  );
  const showOfferSuggestion =
    selectedOffer?.status === "OPEN" && confirmedApplication;

  return (
    <section className="company-applications-page">
      <PageHeader
        eyebrow="Espace entreprise"
        title="Candidatures"
        subtitle="Examinez les profils et suivez chaque étape de recrutement."
      />

      {error && (
        <ErrorBanner
          title="Impossible de charger ou modifier les candidatures"
          message={error.message || "Veuillez réessayer."}
          onRetry={retry}
        />
      )}

      <div className="company-applications-layout">
        <aside className="company-applications-offers">
          <h2>Mes offres</h2>
          {offersLoading ? (
            <div className="company-applications-offer-skeletons" aria-busy="true">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton className="company-applications-offer-skeleton" key={index} />
              ))}
            </div>
          ) : offers.length ? (
            <ul className="company-applications-offer-list">
              {offers.map((offer) => {
                const offerCounts = getOfferApplicationStatusCounts(
                  offer.offerId,
                );
                return (
                  <li key={offer.offerId}>
                    <button
                      type="button"
                      className={
                        offer.offerId === selectedOfferId
                          ? "company-applications-offer selected"
                          : "company-applications-offer"
                      }
                      aria-pressed={offer.offerId === selectedOfferId}
                      onClick={() => selectOffer(offer.offerId)}
                    >
                      <strong>{offer.title}</strong>
                      <span>
                        {offerCounts.total}{" "}
                        {offerCounts.total > 1
                          ? "candidatures"
                          : "candidature"}
                      </span>
                      <small>
                        {offerCounts.PENDING + offerCounts.VIEWED} à traiter
                      </small>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="Aucune offre publiée"
              message="Publiez une offre pour recevoir des candidatures."
              actionLabel="Publier une offre"
              actionTo="/company/offres/nouvelle"
            />
          )}
        </aside>

        <div className="company-applications-results">
          {selectedOffer && (
            <div className="company-applications-selected-offer">
              <div>
                <p>Offre sélectionnée</p>
                <h2>{selectedOffer.title}</h2>
              </div>
              <Link
                className="company-small-link"
                to={`/company/offres/${selectedOffer.offerId}`}
              >
                Voir l’offre
              </Link>
            </div>
          )}

          {showOfferSuggestion && (
            <div className="company-application-filled-suggestion">
              <p>
                Un étudiant a confirmé son stage : marquer l’offre comme
                pourvue ?
              </p>
              <button
                className="company-secondary-button"
                type="button"
                disabled={offerBusy}
                title={offerBusy ? "Une action est en cours." : undefined}
                onClick={markOfferFilled}
              >
                {offerBusy ? "Mise à jour…" : "Marquer comme pourvue"}
              </button>
            </div>
          )}

          <div className="company-applications-filters">
            <div
              className="company-applications-tabs"
              role="tablist"
              aria-label="Filtrer les candidatures par statut"
            >
              {FILTERS.map((item) => {
                const count = item.statuses.reduce(
                  (total, status) => total + counts[status],
                  0,
                );
                return (
                  <button
                    key={item.value}
                    type="button"
                    role="tab"
                    aria-selected={filter === item.value}
                    className={filter === item.value ? "active" : ""}
                    onClick={() => setFilter(item.value)}
                  >
                    {item.label}
                    <span>{count}</span>
                  </button>
                );
              })}
            </div>
            <label className="company-applications-search">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Rechercher par nom d’étudiant</span>
              <input
                type="search"
                placeholder="Rechercher un étudiant"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>

          {offersLoading || applicationsLoading ? (
            <ApplicationSkeleton />
          ) : !selectedOffer ? (
            <EmptyState
              title="Aucune offre à consulter"
              message="Publiez une offre pour commencer à recevoir des candidatures."
              actionLabel="Publier une offre"
              actionTo="/company/offres/nouvelle"
            />
          ) : visibleApplications.length ? (
            <div className="company-applicant-list" role="tabpanel">
              {visibleApplications.map((application) => {
                const requiredSkills = selectedOffer.skills || [];
                const matchingSkills = application.skills.filter((skill) =>
                  requiredSkills.some(
                    (required) =>
                      normalizedSkill(required) === normalizedSkill(skill),
                  ),
                );
                const progressIndex =
                  PROGRESS_INDEX[application.status] ?? -1;
                const isRejected = application.status === "REJECTED";
                return (
                  <article
                    className="company-applicant-card"
                    key={`${application.offerId}-${application.studentId}`}
                  >
                    <div className="company-applicant-heading">
                      <span className="company-applicant-avatar" aria-hidden="true">
                        {initials(application.studentName)}
                      </span>
                      <div className="company-applicant-name">
                        <h3>{application.studentName}</h3>
                        <p>
                          {application.specialty}
                          {application.institution
                            ? ` · ${application.institution}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge status={application.status} />
                    </div>

                    <div className="company-applicant-meta">
                      {application.gouvernorat && (
                        <span>
                          <MapPin size={14} aria-hidden="true" />
                          {application.gouvernorat}
                        </span>
                      )}
                      <span>
                        <CalendarDays size={14} aria-hidden="true" />
                        Candidature envoyée le {formatDate(application.createdAt)}
                      </span>
                    </div>

                    <div className="company-applicant-skills">
                      <strong>Compétences</strong>
                      <div>
                        {application.skills.length ? (
                          application.skills.map((skill) => {
                            const matched = matchingSkills.some(
                              (item) =>
                                normalizedSkill(item) === normalizedSkill(skill),
                            );
                            return (
                              <span
                                className={matched ? "matched" : ""}
                                key={skill}
                              >
                                {skill}
                              </span>
                            );
                          })
                        ) : (
                          <span>Aucune compétence renseignée</span>
                        )}
                      </div>
                      <p>
                        {matchingSkills.length} compétence
                        {matchingSkills.length > 1 ? "s" : ""} sur{" "}
                        {requiredSkills.length}{" "}
                        {matchingSkills.length > 1
                          ? "correspondent"
                          : "correspond"}
                      </p>
                    </div>

                    <div
                      className={`company-application-progress${isRejected ? " rejected" : ""}`}
                      role="img"
                      aria-label={`Progression : ${application.status}`}
                    >
                      {PROGRESS_STEPS.map((step, index) => (
                        <span
                          className={[
                            "company-application-progress-step",
                            progressIndex >= index &&
                            (!isRejected || index === 0)
                              ? "reached"
                              : "",
                            application.status === step.status ? "current" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          key={step.status}
                        >
                          <i aria-hidden="true" />
                          <small>{step.label}</small>
                        </span>
                      ))}
                    </div>

                    <div className="company-applicant-actions">
                      <Tooltip content="CV non disponible">
                        <span>
                          <button
                            className="company-button-disabled"
                            type="button"
                            disabled={!application.cvAvailable}
                            title={!application.cvAvailable ? "CV non disponible" : undefined}
                          >
                            CV
                          </button>
                        </span>
                      </Tooltip>

                      {["PENDING", "VIEWED"].includes(application.status) && (
                        <>
                          <button
                            className="company-secondary-button"
                            type="button"
                            disabled={busy}
                            title={busy ? "Une action est en cours." : undefined}
                            onClick={() =>
                              runAction(application, "in_progress")
                            }
                          >
                            Passer en cours
                          </button>
                          <button
                            className="company-primary-button"
                            type="button"
                            disabled={busy}
                            title={busy ? "Une action est en cours." : undefined}
                            onClick={() =>
                              setDialog({ application, action: "accept" })
                            }
                          >
                            Accepter
                          </button>
                          <button
                            className="company-danger-button"
                            type="button"
                            disabled={busy}
                            title={busy ? "Une action est en cours." : undefined}
                            onClick={() =>
                              setDialog({ application, action: "reject" })
                            }
                          >
                            Refuser
                          </button>
                        </>
                      )}
                      {application.status === "IN_PROGRESS" && (
                        <>
                          <button
                            className="company-primary-button"
                            type="button"
                            disabled={busy}
                            title={busy ? "Une action est en cours." : undefined}
                            onClick={() =>
                              setDialog({ application, action: "accept" })
                            }
                          >
                            Accepter
                          </button>
                          <button
                            className="company-danger-button"
                            type="button"
                            disabled={busy}
                            title={busy ? "Une action est en cours." : undefined}
                            onClick={() =>
                              setDialog({ application, action: "reject" })
                            }
                          >
                            Refuser
                          </button>
                        </>
                      )}
                      {application.status === "ACCEPTED" && (
                        <>
                          <button
                            className="company-danger-button"
                            type="button"
                            disabled={busy}
                            title={busy ? "Une action est en cours." : undefined}
                            onClick={() =>
                              setDialog({ application, action: "reject" })
                            }
                          >
                            Refuser
                          </button>
                          <span className="company-application-waiting">
                            En attente de la confirmation de l’étudiant
                          </span>
                        </>
                      )}
                      {application.status === "CONFIRMED" && (
                        <Link
                          className="company-small-link"
                          to="/company/conventions"
                        >
                          Voir la convention
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title={
                counts.total
                  ? "Aucune candidature ne correspond"
                  : "Aucune candidature reçue"
              }
              message={
                counts.total
                  ? "Essayez une autre recherche ou un autre statut."
                  : "Les candidatures reçues pour cette offre apparaîtront ici."
              }
              actionLabel={
                counts.total ? "Voir les offres" : "Publier une offre"
              }
              actionTo={
                counts.total ? "/company/offres" : "/company/offres/nouvelle"
              }
            />
          )}
        </div>
      </div>

      {dialog && (
        <ConfirmDialog
          open
          title={
            dialog.action === "accept"
              ? "Accepter cette candidature ?"
              : "Refuser cette candidature ?"
          }
          body={
            dialog.action === "accept"
              ? "L’étudiant devra confirmer pour que la convention soit créée."
              : "L’étudiant sera notifié et libérera une de ses 5 candidatures."
          }
          confirmLabel={
            busy
              ? "Mise à jour…"
              : dialog.action === "accept"
                ? "Accepter"
                : "Refuser"
          }
          confirmDisabled={busy}
          confirmTooltip={busy ? "Une action est en cours." : undefined}
          onCancel={() => setDialog(null)}
          onConfirm={() => runAction(dialog.application, dialog.action)}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </section>
  );
}
