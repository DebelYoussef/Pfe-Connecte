export const REAL = {
  me: true,
  offers: false,
  applications: false,
  conventions: false,
  journals: false,
  reports: false,
  notifications: false,
};

const hoursAgo = (hours) =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

const notifications = [
  {
    id: "company-notification-1",
    createdAt: hoursAgo(1),
    type: "APPLICATION_STATUS",
    title: "Nouvelle candidature à examiner",
    body: "Une candidature vient d’être déposée pour une offre publiée.",
    refType: "APPLICATION",
    refId: "application-1",
    read: false,
  },
  {
    id: "company-notification-2",
    createdAt: hoursAgo(4),
    type: "CONVENTION",
    title: "Convention en attente de signature",
    body: "Une convention nécessite votre signature.",
    refType: "CONVENTION",
    refId: "convention-1",
    read: false,
  },
  {
    id: "company-notification-3",
    createdAt: hoursAgo(9),
    type: "JOURNAL",
    title: "Journal de stage à consulter",
    body: "Un journal hebdomadaire attend votre validation.",
    refType: "JOURNAL",
    refId: "student-1",
    read: true,
  },
  {
    id: "company-notification-4",
    createdAt: hoursAgo(18),
    type: "REPORT",
    title: "Rapport à examiner",
    body: "Un nouveau rapport de stage a été transmis.",
    refType: "REPORT",
    refId: "report-1",
    read: false,
  },
  {
    id: "company-notification-5",
    createdAt: hoursAgo(30),
    type: "OFFER",
    title: "Offre publiée",
    body: "Votre offre est maintenant visible dans l’espace étudiant.",
    refType: "OFFER",
    refId: "offer-1",
    read: true,
  },
  {
    id: "company-notification-6",
    createdAt: hoursAgo(52),
    type: "APPLICATION_STATUS",
    title: "Candidature mise à jour",
    body: "Le statut d’une candidature a été actualisé.",
    refType: "APPLICATION",
    refId: "application-2",
    read: true,
  },
  {
    id: "company-notification-7",
    createdAt: hoursAgo(76),
    type: "CONVENTION",
    title: "Convention mise à jour",
    body: "Les informations d’une convention ont été actualisées.",
    refType: "CONVENTION",
    refId: "convention-2",
    read: false,
  },
  {
    id: "company-notification-8",
    createdAt: hoursAgo(120),
    type: "REPORT",
    title: "Décision de rapport enregistrée",
    body: "Votre décision concernant un rapport a bien été enregistrée.",
    refType: "REPORT",
    refId: "report-2",
    read: true,
  },
];

export async function listCompanyNotifications({ limit = 100, cursor = null } = {}) {
  const start = cursor ? Number.parseInt(cursor, 10) : 0;
  const end = start + limit;
  return {
    items: notifications.slice(start, end).map((item) => ({ ...item })),
    nextCursor: end < notifications.length ? String(end) : null,
  };
}

export async function markCompanyNotificationRead(id) {
  const notification = notifications.find((item) => item.id === id);
  if (!notification) {
    throw new Error("Cette notification n’existe plus.");
  }
  notification.read = true;
  return { ...notification };
}

export function getCompanyApplicationsToProcessCount() {
  return 0;
}

export function getCompanyConventionsToSignCount() {
  return 0;
}

export function getCompanyReportsToReviewCount() {
  return 0;
}
