// ...existing student services stay above this line, unchanged...

/* ------------------------------------------------------------------ */
/* Entreprise (rôle ENT) — données simulées                           */
/* ------------------------------------------------------------------ */

// "normal" | "empty" | "error". Override in the browser with ?scenario=empty
export const COMPANY_MOCK_SCENARIO = "normal";

function companyScenario() {
  const fromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("scenario") : null;
  return ["normal", "empty", "error"].includes(fromUrl) ? fromUrl : COMPANY_MOCK_SCENARIO;
}

function companyMock(normal, empty, ms = 600) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = companyScenario();
      if (scenario === "error") reject(new Error("Le serveur est momentanément indisponible."));
      else resolve(structuredClone(scenario === "empty" ? empty : normal));
    }, ms + Math.round(Math.random() * 300));
  });
}

const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();

const COMPANY_PROFILE = { id: "ent-1", name: "Atelier Digital", city: "Tunis" };

const COMPANY_OFFERS = [
  { id: "off-1", title: "Développeur Front-end React", status: "OPEN", applicationsCount: 12, createdAt: hoursAgo(24 * 9) },
  { id: "off-2", title: "Développeur Back-end Node.js", status: "OPEN", applicationsCount: 7, createdAt: hoursAgo(24 * 15) },
  { id: "off-3", title: "Designer UX/UI", status: "FILLED", applicationsCount: 18, createdAt: hoursAgo(24 * 40) },
  { id: "off-4", title: "Ingénieur DevOps", status: "CLOSED", applicationsCount: 4, createdAt: hoursAgo(24 * 62) },
  { id: "off-5", title: "Data engineer", status: "OPEN", applicationsCount: 3, createdAt: hoursAgo(24 * 3) },
];

const COMPANY_APPLICATIONS = [
  { id: "app-1", offerId: "off-1", offerTitle: "Développeur Front-end React", studentName: "Youssef Debel", status: "PENDING", createdAt: hoursAgo(2) },
  { id: "app-2", offerId: "off-5", offerTitle: "Data engineer", studentName: "Amira Ben Salah", status: "PENDING", createdAt: hoursAgo(5) },
  { id: "app-3", offerId: "off-1", offerTitle: "Développeur Front-end React", studentName: "Mehdi Trabelsi", status: "VIEWED", createdAt: hoursAgo(26) },
  { id: "app-4", offerId: "off-2", offerTitle: "Développeur Back-end Node.js", studentName: "Sarra Jlassi", status: "IN_PROGRESS", createdAt: hoursAgo(24 * 3) },
  { id: "app-5", offerId: "off-3", offerTitle: "Designer UX/UI", studentName: "Omar Gharbi", status: "ACCEPTED", createdAt: hoursAgo(24 * 6) },
  { id: "app-6", offerId: "off-2", offerTitle: "Développeur Back-end Node.js", studentName: "Ines Mansouri", status: "VIEWED", createdAt: hoursAgo(24 * 8) },
];

const COMPANY_TASKS = [
  { id: "t-1", type: "convention", label: "Signer la convention de Omar Gharbi", to: "/company/convention" },
  { id: "t-2", type: "journal", label: "Valider le journal de Sarra Jlassi — semaine 45", to: "/company/journals" },
  { id: "t-3", type: "report", label: "Relire le rapport intermédiaire de Omar Gharbi", to: "/company/reports" },
];

const COMPANY_NOTIFICATIONS = [
  { id: "n-1", title: "Nouvelle candidature de Youssef Debel", createdAt: hoursAgo(2), read: false },
  { id: "n-2", title: "Nouvelle candidature de Amira Ben Salah", createdAt: hoursAgo(5), read: false },
  { id: "n-3", title: "La convention de Omar Gharbi attend votre signature", createdAt: hoursAgo(30), read: true },
  { id: "n-4", title: "Votre offre « Designer UX/UI » est pourvue", createdAt: hoursAgo(24 * 4), read: true },
];

function companyPage(items, limit = 10) {
  const page = items.slice(0, limit);
  return { items: page, nextCursor: items.length > limit ? String(limit) : null };
}

export function getCompanyProfile() {
  return companyMock(COMPANY_PROFILE, COMPANY_PROFILE, 200);
}

export function getCompanyDashboard() {
  const normal = {
    openOffers: COMPANY_OFFERS.filter((o) => o.status === "OPEN").length,
    pendingApplications: COMPANY_APPLICATIONS.filter((a) => a.status === "PENDING" || a.status === "VIEWED").length,
    confirmedInterns: COMPANY_APPLICATIONS.filter((a) => a.status === "ACCEPTED").length,
  };
  return companyMock(normal, { openOffers: 0, pendingApplications: 0, confirmedInterns: 0 });
}

export function listMyOffers({ limit = 10 } = {}) {
  return companyMock(companyPage(COMPANY_OFFERS, limit), { items: [], nextCursor: null });
}

export function listCompanyApplications({ limit = 10, status } = {}) {
  const filtered = status ? COMPANY_APPLICATIONS.filter((a) => a.status === status) : COMPANY_APPLICATIONS;
  return companyMock(companyPage(filtered, limit), { items: [], nextCursor: null });
}

export function getCompanyTasks() {
  return companyMock(COMPANY_TASKS, []);
}

export function listCompanyNotifications({ limit = 10 } = {}) {
  return companyMock(companyPage(COMPANY_NOTIFICATIONS, limit), { items: [], nextCursor: null });
}
