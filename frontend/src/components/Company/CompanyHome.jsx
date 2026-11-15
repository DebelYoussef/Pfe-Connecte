import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  FileCheck2,
  FileSignature,
  FileText,
  Plus,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getUser } from "../../auth";
import ErrorBanner from "../../components/ErrorBanner";
import EmptyState from "../../components/ui/EmptyState";
import Skeleton from "../../components/ui/Skeleton";
import StatusBadge from "../../components/ui/StatusBadge";
import {
  listCompanyApplications,
  listCompanyJournals,
  listCompanyNotifications,
  listMyConventions,
  listMyInterns,
  listMyOffers,
  listMyReports,
} from "../../services.company";

const notificationRoutes = {
  APPLICATION: (id) => `/company/candidatures?offer=${encodeURIComponent(id)}`,
  CONVENTION: (id) => `/company/conventions/${encodeURIComponent(id)}`,
  JOURNAL: (id) => `/company/journaux/${encodeURIComponent(id)}`,
  REPORT: () => "/company/rapports",
  OFFER: (id) => `/company/offres/${encodeURIComponent(id)}`,
};

const formatDate = (date) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(
    new Date(date),
  );

function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("fr");
}

function LoadingRows({ count = 3 }) {
  return (
    <div aria-busy="true" className="company-loading-rows">
      {Array.from({ length: count }, (_, index) => (
        <div className="company-loading-row" key={index}>
          <Skeleton className="company-loading-avatar" />
          <span>
            <Skeleton className="company-loading-title" />
            <Skeleton className="company-loading-detail" />
          </span>
          <Skeleton className="company-loading-status" />
        </div>
      ))}
    </div>
  );
}

function DashboardSection({ title, to, children }) {
  return (
    <section className="company-dashboard-section">
      <div className="company-dashboard-section-heading">
        <h2>{title}</h2>
        <Link to={to}>Voir tout</Link>
      </div>
      {children}
    </section>
  );
}

export default function CompanyHome() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const user = getUser() || {};
  const displayName =
    user.firstName?.trim() ||
    user.companyName?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email ||
    "";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        offers,
        applications,
        conventions,
        reports,
        journals,
        interns,
        notifications,
      ] = await Promise.all([
        listMyOffers({ limit: 100 }),
        listCompanyApplications({ limit: 100 }),
        listMyConventions({ limit: 100 }),
        listMyReports({ limit: 100 }),
        listCompanyJournals({ limit: 100 }),
        listMyInterns({ limit: 100 }),
        listCompanyNotifications({ limit: 100 }),
      ]);
      setData({ offers: offers.items, applications: applications.items, conventions: conventions.items, reports: reports.items, journals: journals.items, interns: interns.items, notifications: notifications.items });
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) load();
    });
    return () => {
      active = false;
    };
  }, [load, attempt]);

  useEffect(() => {
    document.title = "Accueil entreprise · PFE Connect";
  }, []);

  const derived = useMemo(() => {
    if (!data) return null;
    const companyId = user.userId;
    const pendingApplications = data.applications.filter((application) =>
      ["PENDING", "VIEWED"].includes(application.status),
    );
    const conventionsToSign = data.conventions.filter(
      (convention) => convention.currentActorId === companyId,
    );
    const reportsToReview = data.reports.filter(
      (report) => report.status === "UNDER_REVIEW" && !report.companyDecision,
    );
    const journalsToReview = data.journals.filter((journal) => !journal.validated);
    const lateWeeks = data.interns.flatMap((intern) => intern.lateWeeks || []);
    return {
      openOffers: data.offers.filter((offer) => offer.status === "OPEN"),
      pendingApplications,
      conventionsToSign,
      reportsToReview,
      journalsToReview,
      lateWeeks,
      recentApplications: [...data.applications]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
      recentNotifications: [...data.notifications]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
    };
  }, [data, user.userId]);

  const retry = () => setAttempt((value) => value + 1);
  const statCards = derived
    ? [
        { label: "Offres ouvertes", value: derived.openOffers.length, to: "/company/offres", icon: BriefcaseBusiness },
        { label: "Candidatures à traiter", value: derived.pendingApplications.length, to: "/company/candidatures", icon: FileCheck2 },
        { label: "Conventions à signer", value: derived.conventionsToSign.length, to: "/company/conventions", icon: FileSignature },
        { label: "Rapports à examiner", value: derived.reportsToReview.length, to: "/company/rapports", icon: FileText },
      ]
    : [];

  return (
    <div className="company-dashboard">
      <section className="company-dashboard-hero">
        <div>
          <p className="company-dashboard-eyebrow">Espace entreprise</p>
          <h1>Bonjour, {displayName}</h1>
          <p>Suivez vos offres et accompagnez les candidatures en cours.</p>
          <Link className="company-primary-link" to="/company/offres/nouvelle">
            <Plus size={17} aria-hidden="true" />
            Publier une offre
          </Link>
        </div>
      </section>

      {error && (
        <ErrorBanner
          title="Impossible de charger le tableau de bord"
          message={error.message || "Veuillez réessayer."}
          onRetry={retry}
        />
      )}

      <section className="company-dashboard-stats" aria-label="Indicateurs">
        {loading
          ? Array.from({ length: 4 }, (_, index) => (
              <div className="company-dashboard-stat" key={index}>
                <Skeleton className="company-stat-number" />
                <Skeleton className="company-stat-label" />
              </div>
            ))
          : statCards.map(({ label, value, to, icon: Icon }) => (
              <Link className="company-dashboard-stat" to={to} key={label}>
                <span className="company-dashboard-stat-icon">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="company-dashboard-stat-copy">
                  <strong>{value}</strong>
                  <span>{label}</span>
                </span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            ))}
      </section>

      <div className="company-dashboard-columns">
        <div className="company-dashboard-main">
          <DashboardSection title="Candidatures récentes" to="/company/candidatures">
            {loading ? (
              <LoadingRows count={5} />
            ) : error ? null : derived?.recentApplications.length ? (
              <ul className="company-dashboard-list">
                {derived.recentApplications.map((application) => (
                  <li key={`${application.studentId}-${application.offerId}`}>
                    <Link
                      className="company-dashboard-list-link"
                      to={`/company/candidatures?offer=${encodeURIComponent(application.offerId)}`}
                    >
                      <span className="company-student-avatar">{initials(application.studentName)}</span>
                      <span className="company-dashboard-row-copy">
                        <strong>{application.studentName}</strong>
                        <span>{application.offerTitle}</span>
                      </span>
                      <span className="company-dashboard-row-meta">
                        <StatusBadge status={application.status} />
                        <time dateTime={application.createdAt}>{formatDate(application.createdAt)}</time>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Aucune candidature pour le moment"
                message="Les candidatures reçues apparaîtront ici."
                actionLabel="Publier une offre"
                actionTo="/company/offres/nouvelle"
              />
            )}
          </DashboardSection>

          <DashboardSection title="Conventions à signer" to="/company/conventions">
            {loading ? (
              <LoadingRows count={2} />
            ) : error ? null : derived?.conventionsToSign.length ? (
              <ul className="company-dashboard-list">
                {derived.conventionsToSign.map((convention) => (
                  <li key={convention.conventionId}>
                    <div className="company-dashboard-list-link">
                      <span className="company-student-avatar">{initials(convention.studentName)}</span>
                      <span className="company-dashboard-row-copy">
                        <strong>{convention.studentName}</strong>
                        <span>{convention.offerTitle}</span>
                      </span>
                      <span className="company-dashboard-row-meta">
                        <time dateTime={convention.createdAt}>{formatDate(convention.createdAt)}</time>
                        <Link className="company-small-link" to={`/company/conventions/${convention.conventionId}`}>
                          Voir
                        </Link>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Aucune convention à signer"
                message="Les conventions en attente de votre signature apparaîtront ici."
                actionLabel="Voir les candidatures"
                actionTo="/company/candidatures"
              />
            )}
          </DashboardSection>

        </div>

        <aside className="company-dashboard-aside">
          <section className="company-dashboard-section">
            <div className="company-dashboard-section-heading">
              <h2>À traiter</h2>
            </div>
            {loading ? (
              <LoadingRows count={4} />
            ) : error ? null : (
              <ul className="company-task-list">
                <li><Link to="/company/candidatures"><FileCheck2 size={17} aria-hidden="true" /><span>Candidatures</span><strong>{derived?.pendingApplications.length ?? 0}</strong></Link></li>
                <li><Link to="/company/conventions"><FileSignature size={17} aria-hidden="true" /><span>Conventions</span><strong>{derived?.conventionsToSign.length ?? 0}</strong></Link></li>
                <li><Link to="/company/journaux"><BookOpen size={17} aria-hidden="true" /><span>Journaux</span><strong>{(derived?.journalsToReview.length ?? 0) + (derived?.lateWeeks.length ?? 0)}</strong></Link></li>
                <li><Link to="/company/rapports"><FileText size={17} aria-hidden="true" /><span>Rapports</span><strong>{derived?.reportsToReview.length ?? 0}</strong></Link></li>
              </ul>
            )}
          </section>

          <DashboardSection title="Activité récente" to="/company/notifications">
            {loading ? (
              <LoadingRows count={4} />
            ) : error ? null : derived?.recentNotifications.length ? (
              <ul className="company-activity-list">
                {derived.recentNotifications.map((notification) => (
                  <li key={notification.id}>
                    <Link
                      to={notificationRoutes[notification.refType]?.(notification.refId) || "/company/notifications"}
                      className={notification.read ? "" : "unread"}
                    >
                      <span className="company-activity-dot" aria-hidden="true" />
                      <span>
                        <strong>{notification.title}</strong>
                        <time dateTime={notification.createdAt}>{formatDate(notification.createdAt)}</time>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Aucune activité récente"
                message="Les notifications apparaîtront ici."
                actionLabel="Voir les offres"
                actionTo="/company/offres"
              />
            )}
          </DashboardSection>
        </aside>
      </div>

    </div>
  );
}
