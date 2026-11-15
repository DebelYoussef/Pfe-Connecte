import { getToken, getUser, saveSession } from "./auth";
import { api } from "./api";

export const REAL = {
  me: true,
  offers: false,
  applications: false,
  conventions: false,
  journals: false,
  reports: false,
  notifications: false,
};

const WAIT_MS = 60;
const OFFER_STATUSES = ["OPEN", "CLOSED", "FILLED"];
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
const GOUVERNORATS = [
  "Tunis",
  "Sousse",
  "Sfax",
  "Monastir",
  "Nabeul",
  "Gabès",
  "Gafsa",
  "Bizerte",
];
const WORK_MODES = ["ONSITE", "HYBRID", "REMOTE"];
const ID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OTHER_COMPANY_ID = ID(999);
const FOREIGN_OFFER_ID = ID(199);
const stores = new Map();
let profileExtras = {};

const wait = (value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), WAIT_MS));
const fail = (status, code, message, details = {}) => ({
  status,
  code,
  message,
  details,
});
const copy = (value) => JSON.parse(JSON.stringify(value));

function daysAgo(days, hours = 0) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(date.getHours() - hours);
  return date.toISOString();
}

function currentIsoWeek(offset = 0) {
  const date = new Date();
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - day + 1 + offset * 7);
  const thursday = new Date(utc);
  thursday.setUTCDate(utc.getUTCDate() + 3);
  const year = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - (firstThursday.getUTCDay() || 7) + 4,
  );
  const week = 1 + Math.round((thursday - firstThursday) / 604800000);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

// NOT IN API YET: student names are display enrichments for the mock company area.
const STUDENTS = [
  { firstName: "Amira", lastName: "Ben Salah", specialty: "Génie logiciel", etab: "Institut A", gouvernorat: "Tunis", skills: ["react", "javascript", "sql"] },
  { firstName: "Youssef", lastName: "Debel", specialty: "Réseaux", etab: "Institut B", gouvernorat: "Sousse", skills: ["linux", "cisco", "python"] },
  { firstName: "Inès", lastName: "Mansouri", specialty: "Data science", etab: "Institut A", gouvernorat: "Sfax", skills: ["python", "pandas", "sql"] },
  { firstName: "Mehdi", lastName: "Trabelsi", specialty: "Systèmes embarqués", etab: "Institut B", gouvernorat: "Monastir", skills: ["c", "linux", "iot"] },
  { firstName: "Sarra", lastName: "Jlassi", specialty: "Génie logiciel", etab: "Institut A", gouvernorat: "Nabeul", skills: ["java", "spring", "docker"] },
  { firstName: "Omar", lastName: "Gharbi", specialty: "Data science", etab: "Institut B", gouvernorat: "Gabès", skills: ["python", "machine learning", "git"] },
];

// NOT IN API YET: workMode is stored only as an offer presentation enrichment.
const OFFER_SEEDS = [
  {
    title: "Développement d’une plateforme React",
    description: "Concevoir et développer des interfaces accessibles pour une plateforme web métier.",
    keywords: ["frontend", "react", "accessibilité"],
    skills: ["react", "javascript", "css"],
    gouvernorat: "Tunis",
    durationWeeks: 16,
    status: "OPEN",
    createdDaysAgo: 3,
    workMode: "HYBRID",
    similar: [{ subjectId: "SUJET-ARCH-01", score: 0.87 }],
  },
  {
    title: "Analyse de données sur les flux urbains",
    description: "Préparer des jeux de données et construire des indicateurs de mobilité.",
    keywords: ["data", "mobilité", "analyse"],
    skills: ["python", "pandas", "sql"],
    gouvernorat: "Sousse",
    durationWeeks: 20,
    status: "OPEN",
    createdDaysAgo: 8,
    workMode: "ONSITE",
    similar: [],
  },
  {
    title: "Sécurisation d’une application web",
    description: "Étudier les contrôles d’accès et améliorer la sécurité d’une application.",
    keywords: ["sécurité", "web", "authentification"],
    skills: ["linux", "javascript", "tests"],
    gouvernorat: "Sfax",
    durationWeeks: 24,
    status: "OPEN",
    createdDaysAgo: 12,
    workMode: "REMOTE",
    similar: [],
  },
  {
    title: "Automatisation des déploiements cloud",
    description: "Mettre en place des pipelines de livraison et documenter leur exploitation.",
    keywords: ["cloud", "déploiement", "automatisation"],
    skills: ["docker", "git", "linux"],
    gouvernorat: "Monastir",
    durationWeeks: 12,
    status: "CLOSED",
    createdDaysAgo: 20,
    workMode: "HYBRID",
    similar: [],
  },
  {
    title: "Système embarqué pour capteurs",
    description: "Prototyper la collecte et la transmission de mesures issues de capteurs.",
    keywords: ["embarqué", "capteurs", "iot"],
    skills: ["c", "iot", "linux"],
    gouvernorat: "Nabeul",
    durationWeeks: 16,
    status: "FILLED",
    createdDaysAgo: 29,
    workMode: "ONSITE",
    similar: [],
  },
];

const APP_SEEDS = [
  { student: 0, offer: 0, status: "PENDING", days: 1 },
  { student: 1, offer: 0, status: "VIEWED", days: 2 },
  { student: 2, offer: 1, status: "IN_PROGRESS", days: 3 },
  { student: 3, offer: 2, status: "ACCEPTED", days: 4 },
  { student: 4, offer: 3, status: "REJECTED", days: 5 },
  { student: 5, offer: 4, status: "DECLINED", days: 6 },
  { student: 1, offer: 1, status: "WITHDRAWN", days: 7 },
  { student: 0, offer: 0, status: "CONFIRMED", days: 18 },
  { student: 2, offer: 2, status: "CONFIRMED", days: 35 },
  { student: 4, offer: 3, status: "CONFIRMED", days: 24 },
  { student: 5, offer: 4, status: "CONFIRMED", days: 30 },
];

function createApplication(seed, companyId, offers) {
  const createdAt = daysAgo(seed.days);
  const viewedAt =
    seed.status === "PENDING" || seed.status === "WITHDRAWN"
      ? undefined
      : daysAgo(seed.days - 0.25);
  const updatedAt =
    seed.status === "PENDING" ? createdAt : daysAgo(Math.max(0, seed.days - 0.5));
  return {
    studentId: ID(seed.student + 1),
    offerId: offers[seed.offer].offerId,
    companyId,
    status: seed.status,
    createdAt,
    updatedAt,
    ...(viewedAt ? { viewedAt } : {}),
  };
}

function createEvent(conventionId, type, actorId, actorRole, fromState, toState, timestamp, extra = {}) {
  return {
    conventionId,
    timestamp,
    type,
    actorId,
    actorRole,
    ...(fromState ? { fromState } : {}),
    ...(toState ? { toState } : {}),
    ...extra,
  };
}

function makeConvention({ id, app, companyId, state, days, modified = false }) {
  const conventionId = ID(id);
  const student = STUDENTS[Number(app.studentId.slice(-1)) - 1];
  const offer = OFFER_SEEDS.find((_, index) => ID(100 + index) === app.offerId);
  const createdAt = daysAgo(days);
  const studentActorId = app.studentId;
  const events = [
    createEvent(
      conventionId,
      "SUBMITTED",
      studentActorId,
      "ETU",
      "DRAFT",
      "SUBMITTED",
      createdAt,
    ),
  ];

  if (state === "SIGNED_STUDENT") {
    events.push(
      createEvent(
        conventionId,
        "SIGNED",
        studentActorId,
        "ETU",
        "SUBMITTED",
        "SIGNED_STUDENT",
        daysAgo(days - 1),
        { pdfSha256: "a".repeat(64) },
      ),
    );
  } else if (state === "APPROVED") {
    events.push(
      createEvent(
        conventionId,
        "SIGNED",
        studentActorId,
        "ETU",
        "SUBMITTED",
        "SIGNED_STUDENT",
        daysAgo(days - 1),
        { pdfSha256: "b".repeat(64) },
      ),
      createEvent(
        conventionId,
        "SIGNED",
        companyId,
        "ENT",
        "SIGNED_STUDENT",
        "SIGNED_COMPANY",
        daysAgo(days - 1.5),
        { pdfSha256: "b".repeat(64) },
      ),
      createEvent(
        conventionId,
        "APPROVED",
        ID(700),
        "RESP",
        "SIGNED_COMPANY",
        "APPROVED",
        daysAgo(days - 2),
        { pdfSha256: "c".repeat(64) },
      ),
    );
  } else if (modified) {
    // NOT IN API YET: MODIFIED is recorded for the seeded student-correction history.
    events.push(
      createEvent(
        conventionId,
        "MODIFIED",
        studentActorId,
        "ETU",
        "SUBMITTED",
        "DRAFT",
        daysAgo(days - 1),
      ),
    );
  }

  return {
    conventionId,
    studentId: app.studentId,
    companyId,
    offerId: app.offerId,
    etab: student.etab,
    state,
    renderedText: `Convention de stage — ${student.firstName} ${student.lastName}\nOffre : ${offer?.title || "Stage de fin d’études"}`,
    templateVersion: 1,
    pdfSha256: "a".repeat(64),
    shortRef: `PFE-${String(id).padStart(4, "0")}`,
    ...(state === "SIGNED_STUDENT"
      ? { currentActorId: companyId, stepSince: daysAgo(days - 1) }
      : {}),
    ...(state === "DRAFT"
      ? { currentActorId: studentActorId, stepSince: daysAgo(days - 1) }
      : {}),
    ...(state === "APPROVED" ? { finalSha256: "c".repeat(64), approvedAt: daysAgo(days - 2) } : {}),
    createdAt,
    events,
  };
}

function createStore(companyId) {
  const students = STUDENTS.map((student, index) => ({
    userId: ID(index + 1),
    ...student,
  }));
  const offers = OFFER_SEEDS.map((seed, index) => ({
    offerId: ID(100 + index),
    companyId,
    title: seed.title,
    description: seed.description,
    keywords: [...seed.keywords],
    skills: [...seed.skills],
    gouvernorat: seed.gouvernorat,
    durationWeeks: seed.durationWeeks,
    status: seed.status,
    similar: copy(seed.similar),
    createdAt: daysAgo(seed.createdDaysAgo),
    workMode: seed.workMode,
  }));
  offers.push({
    offerId: FOREIGN_OFFER_ID,
    companyId: OTHER_COMPANY_ID,
    title: "Offre d’une autre entreprise",
    description: "Offre témoin utilisée pour vérifier les contrôles de propriété.",
    keywords: [],
    skills: [],
    gouvernorat: "Tunis",
    durationWeeks: 12,
    status: "OPEN",
    similar: [],
    createdAt: daysAgo(2),
    // NOT IN API YET: workMode is a presentation-only offer enrichment.
    workMode: "ONSITE",
  });
  const applications = APP_SEEDS.map((seed) =>
    createApplication(seed, companyId, offers),
  );
  const confirmed = applications.filter((item) => item.status === "CONFIRMED");
  const conventions = [
    makeConvention({ id: 401, app: confirmed[0], companyId, state: "SIGNED_STUDENT", days: 14 }),
    makeConvention({ id: 402, app: confirmed[1], companyId, state: "APPROVED", days: 22 }),
    makeConvention({ id: 403, app: confirmed[2], companyId, state: "DRAFT", days: 9, modified: true }),
    makeConvention({ id: 404, app: confirmed[3], companyId, state: "APPROVED", days: 25 }),
  ];
  const approvedInterns = conventions.filter((item) => item.state === "APPROVED");
  const interns = approvedInterns.map((convention) => ({
    studentId: convention.studentId,
    conventionId: convention.conventionId,
    // NOT IN API YET: expected and late weeks are derived internship tracking metadata.
    expectedWeeks: [currentIsoWeek(-2), currentIsoWeek(-1), currentIsoWeek()],
    lateWeeks: [currentIsoWeek()],
  }));
  const journals = [
    {
      studentId: interns[0].studentId,
      week: currentIsoWeek(-2),
      content: "Mise en place de l’environnement de développement et première revue des besoins.",
      submittedAt: daysAgo(12),
      validated: true,
      validatedBy: companyId,
      validatedAt: daysAgo(10),
      comment: "Bonne synthèse, poursuivre avec les tests.",
    },
    {
      studentId: interns[0].studentId,
      week: currentIsoWeek(-1),
      content: "Développement du premier écran et intégration des données de test.",
      submittedAt: daysAgo(5),
      validated: false,
    },
    {
      studentId: interns[1].studentId,
      week: currentIsoWeek(-2),
      content: "Analyse des données disponibles et préparation du prototype.",
      submittedAt: daysAgo(13),
      validated: true,
      validatedBy: companyId,
      validatedAt: daysAgo(11),
      comment: "Travail validé, penser à préciser les sources.",
    },
    {
      studentId: interns[1].studentId,
      week: currentIsoWeek(-1),
      content: "Comparaison des résultats et rédaction des premières observations.",
      submittedAt: daysAgo(4),
      validated: false,
    },
  ];
  const reports = [
    {
      studentId: interns[0].studentId,
      version: 2,
      sha256: "d".repeat(64),
      status: "UNDER_REVIEW",
      companyId,
      submittedAt: daysAgo(2),
    },
    {
      studentId: interns[1].studentId,
      version: 1,
      sha256: "e".repeat(64),
      status: "VALIDATED",
      companyId,
      companyDecision: "APPROVED",
      teacherDecision: "APPROVED",
      submittedAt: daysAgo(5),
    },
    {
      studentId: interns[0].studentId,
      version: 1,
      sha256: "f".repeat(64),
      status: "CHANGES_REQUESTED",
      companyId,
      companyDecision: "CHANGES_REQUESTED",
      companyComment: "Préciser la méthode d’évaluation et ajouter les limites.",
      submittedAt: daysAgo(3),
    },
  ];
  const notifications = [
    ["APPLICATION_STATUS", "Nouvelle candidature à examiner", "Une candidature a été déposée pour une offre publiée.", "APPLICATION", applications[0].offerId, false, 1],
    ["APPLICATION_STATUS", "Candidature consultée", "Une candidature a été ouverte depuis votre espace.", "APPLICATION", applications[1].offerId, false, 3],
    ["CONVENTION", "Convention en attente de signature", "Une convention nécessite votre signature.", "CONVENTION", conventions[0].conventionId, false, 5],
    ["REPORT", "Rapport à examiner", "Un rapport attend votre décision.", "REPORT", reports[0].studentId, false, 8],
    ["OFFER", "Offre publiée", "Une offre est visible dans l’espace étudiant.", "OFFER", offers[0].offerId, true, 12],
    ["JOURNAL", "Journal hebdomadaire à consulter", "Une entrée de journal attend votre validation.", "JOURNAL", interns[0].studentId, false, 16],
    ["APPLICATION_STATUS", "Candidature mise à jour", "Le statut d’une candidature a été actualisé.", "APPLICATION", applications[2].offerId, true, 22],
    ["CONVENTION", "Convention approuvée", "Une convention a été approuvée.", "CONVENTION", conventions[1].conventionId, true, 28],
    ["REPORT", "Modifications demandées", "Un rapport a été renvoyé avec des commentaires.", "REPORT", reports[2].studentId, false, 32],
    ["OFFER", "Offre clôturée", "Une offre n’accepte plus de nouvelles candidatures.", "OFFER", offers[3].offerId, true, 40],
    ["JOURNAL", "Journal manquant", "Une semaine de journal est en retard.", "JOURNAL", interns[1].studentId, false, 48],
    ["APPLICATION_STATUS", "Candidature confirmée", "Un stage a été confirmé.", "APPLICATION", applications[7].offerId, true, 56],
  ].map(([type, title, body, refType, refId, read, hours]) => ({
    id: `company-notification-${String(hours).padStart(2, "0")}`,
    createdAt: daysAgo(0, hours),
    type,
    title,
    body,
    refType,
    refId,
    read,
  }));

  return {
    students,
    offers,
    applications,
    conventions,
    interns,
    journals,
    reports,
    notifications,
  };
}

function currentCompanyId() {
  const companyId = getUser()?.userId;
  if (!companyId) {
    throw fail(401, "UNAUTHORIZED", "Votre session entreprise a expiré.");
  }
  return companyId;
}

function storeFor(companyId = currentCompanyId()) {
  if (!stores.has(companyId)) stores.set(companyId, createStore(companyId));
  return stores.get(companyId);
}

function optionalStore() {
  const companyId = getUser()?.userId;
  return companyId ? storeFor(companyId) : null;
}

function page(items, limit = 100, cursor = null) {
  const parsed = Number.parseInt(cursor || "0", 10);
  const start = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const size = Number.isInteger(Number(limit)) && Number(limit) > 0 ? Number(limit) : 100;
  const end = start + size;
  return {
    items: copy(items.slice(start, end)),
    nextCursor: end < items.length ? String(end) : null,
  };
}

function ownOffers(store, companyId) {
  return store.offers
    .filter((offer) => offer.companyId === companyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function findOffer(store, offerId, companyId) {
  const offer = store.offers.find((item) => item.offerId === offerId);
  if (!offer) throw fail(404, "NOT_FOUND", "Cette offre est introuvable.");
  if (offer.companyId !== companyId)
    throw fail(403, "FORBIDDEN", "Vous ne pouvez pas gérer cette offre.");
  return offer;
}

function normalizeTag(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function normalizedTags(values, field) {
  if (!Array.isArray(values))
    throw fail(400, "VALIDATION_ERROR", `Le champ ${field} doit être une liste.`);
  const result = [...new Set(values.map(normalizeTag).filter(Boolean))];
  if (result.length > 10)
    throw fail(400, "VALIDATION_ERROR", "Dix éléments maximum par liste.");
  return result;
}

function validateOfferInput(input, { partial = false } = {}) {
  const allowed = new Set([
    "title",
    "description",
    "keywords",
    "skills",
    "gouvernorat",
    "durationWeeks",
    "status",
    "workMode",
  ]);
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length)
    throw fail(400, "VALIDATION_ERROR", "Le formulaire contient des champs inconnus.", { fields: unknown });
  const result = {};
  if (!partial || "title" in input) {
    const title = String(input.title ?? "").trim();
    if (!title || title.length > 200)
      throw fail(400, "VALIDATION_ERROR", "Le titre doit contenir de 1 à 200 caractères.", { fields: ["title"] });
    result.title = title;
  }
  if (!partial || "description" in input) {
    const description = String(input.description ?? "").trim();
    if (!description || description.length > 5000)
      throw fail(400, "VALIDATION_ERROR", "La description doit contenir de 1 à 5 000 caractères.", { fields: ["description"] });
    result.description = description;
  }
  if (!partial || "keywords" in input)
    result.keywords = normalizedTags(input.keywords ?? [], "keywords");
  if (!partial || "skills" in input)
    result.skills = normalizedTags(input.skills ?? [], "skills");
  if (!partial || "gouvernorat" in input) {
    if (!GOUVERNORATS.includes(input.gouvernorat))
      throw fail(400, "VALIDATION_ERROR", "Sélectionnez un gouvernorat valide.", { fields: ["gouvernorat"] });
    result.gouvernorat = input.gouvernorat;
  }
  if (!partial || "durationWeeks" in input) {
    const durationWeeks = Number(input.durationWeeks);
    if (!Number.isInteger(durationWeeks) || durationWeeks < 1)
      throw fail(400, "VALIDATION_ERROR", "La durée doit être un nombre entier d’au moins une semaine.", { fields: ["durationWeeks"] });
    result.durationWeeks = durationWeeks;
  }
  if ("workMode" in input) {
    if (!WORK_MODES.includes(input.workMode))
      throw fail(400, "VALIDATION_ERROR", "Sélectionnez un mode de travail valide.", { fields: ["workMode"] });
    // NOT IN API YET: workMode remains a local display enrichment.
    result.workMode = input.workMode;
  }
  if ("status" in input) {
    if (!OFFER_STATUSES.includes(input.status))
      throw fail(400, "VALIDATION_ERROR", "Sélectionnez un statut valide.", { fields: ["status"] });
    result.status = input.status;
  }
  return result;
}

function findSimilarSubjects(offer) {
  const terms = new Set([...offer.skills, ...offer.keywords].map(normalizeTag));
  const archived = [
    { subjectId: "SUJET-ARCH-01", terms: ["react", "javascript", "frontend", "interface"] },
    { subjectId: "SUJET-ARCH-02", terms: ["python", "data", "analyse", "sql"] },
    { subjectId: "SUJET-ARCH-03", terms: ["iot", "embarque", "capteurs", "c"] },
  ];
  return archived
    .map((subject) => {
      const overlap = subject.terms.filter((term) => terms.has(normalizeTag(term))).length;
      return { subjectId: subject.subjectId, score: overlap / subject.terms.length };
    })
    .filter((subject) => subject.score >= 0.5)
    .sort((a, b) => b.score - a.score);
}

function studentFor(store, studentId) {
  return store.students.find((student) => student.userId === studentId);
}

function studentName(store, studentId) {
  const student = studentFor(store, studentId);
  return student ? `${student.firstName} ${student.lastName}` : "Étudiant";
}

function offerFor(store, offerId) {
  return store.offers.find((offer) => offer.offerId === offerId);
}

function enrichApplication(store, application) {
  return {
    ...application,
    // NOT IN API YET: these values are joined from the mocked student and offer records.
    studentName: studentName(store, application.studentId),
    offerTitle: offerFor(store, application.offerId)?.title || "Offre indisponible",
  };
}

function enrichConvention(store, convention) {
  return {
    ...convention,
    // NOT IN API YET: these values are joined for company-facing list rows.
    studentName: studentName(store, convention.studentId),
    offerTitle: offerFor(store, convention.offerId)?.title || "Offre indisponible",
  };
}

function enrichReport(store, report) {
  return {
    ...report,
    // NOT IN API YET: studentName is joined from the mock user directory.
    studentName: studentName(store, report.studentId),
  };
}

export async function getMe() {
  if (REAL.me) {
    const user = await api("/v1/me");
    const token = getToken();
    if (token) saveSession({ token, user: { ...(getUser() || {}), ...user } });
    return { ...user, ...profileExtras };
  }
  await wait(null);
  return { ...(getUser() || {}), ...profileExtras };
}

export async function updateMe(partial = {}) {
  const allowedFields = ["firstName", "lastName", "companyName"];
  const apiFields = Object.fromEntries(
    allowedFields
      .filter((field) => partial[field] !== undefined)
      .map((field) => [field, partial[field]]),
  );
  const localFields = Object.fromEntries(
    Object.entries(partial).filter(([field]) => !allowedFields.includes(field)),
  );
  let user;
  if (REAL.me) {
    user = Object.keys(apiFields).length
      ? await api("/v1/me", { method: "PUT", body: apiFields })
      : await api("/v1/me");
  } else {
    await wait(null);
    user = { ...(getUser() || {}), ...apiFields };
  }
  profileExtras = { ...profileExtras, ...localFields };
  const token = getToken();
  if (token) saveSession({ token, user: { ...(getUser() || {}), ...user } });
  return { ...user, ...profileExtras };
}

export async function listMyOffers({ status, limit = 5, cursor = null } = {}) {
  const companyId = currentCompanyId();
  if (REAL.offers) {
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (limit) query.set("limit", String(limit));
    if (cursor) query.set("cursor", cursor);
    const result = await api(`/v1/offers${query.size ? `?${query}` : ""}`);
    return {
      items: (result.items || []).filter((offer) => offer.companyId === companyId),
      nextCursor: result.nextCursor ?? null,
    };
  }
  const store = storeFor(companyId);
  const offers = ownOffers(store, companyId).filter((offer) => !status || offer.status === status);
  return wait(page(offers, limit, cursor));
}

export async function getOffer(offerId) {
  const companyId = currentCompanyId();
  if (REAL.offers) {
    const offer = await api(`/v1/offers/${encodeURIComponent(offerId)}`);
    if (offer.companyId !== companyId)
      throw fail(403, "FORBIDDEN", "Vous ne pouvez pas consulter cette offre.");
    return offer;
  }
  const store = storeFor(companyId);
  const offer = findOffer(store, offerId, companyId);
  return wait(copy(offer));
}

export async function createOffer(payload) {
  const companyId = currentCompanyId();
  const offer = validateOfferInput(payload);
  if (REAL.offers) {
    const apiFields = { ...offer };
    delete apiFields.workMode;
    return api("/v1/offers", { method: "POST", body: apiFields });
  }
  const similar = findSimilarSubjects(offer);
  const created = {
    offerId: createId(),
    companyId,
    ...offer,
    status: "OPEN",
    similar,
    createdAt: new Date().toISOString(),
  };
  storeFor(companyId).offers.push(created);
  return wait(copy(created));
}

const STATUS_TRANSITIONS = {
  OPEN: ["CLOSED", "FILLED"],
  CLOSED: ["OPEN"],
  FILLED: [],
};

export async function updateOffer(offerId, patch) {
  const companyId = currentCompanyId();
  const next = validateOfferInput(patch, { partial: true });
  if (!Object.keys(next).length)
    throw fail(400, "VALIDATION_ERROR", "Aucune modification à enregistrer.");
  if (REAL.offers) {
    const current = await api(`/v1/offers/${encodeURIComponent(offerId)}`);
    if (current.companyId !== companyId)
      throw fail(403, "FORBIDDEN", "Vous ne pouvez pas gérer cette offre.");
    if (
      Object.keys(next).some((field) => field !== "status") &&
      !["OPEN", "CLOSED"].includes(current.status)
    ) {
      throw fail(409, "CONFLICT", "Une offre pourvue ne peut plus être modifiée.");
    }
    if (
      next.status &&
      !STATUS_TRANSITIONS[current.status]?.includes(next.status)
    ) {
      throw fail(409, "CONFLICT", "Cette transition de statut n’est pas autorisée.", {
        from: current.status,
        to: next.status,
      });
    }
    const apiFields = { ...next };
    delete apiFields.workMode;
    return api(`/v1/offers/${encodeURIComponent(offerId)}`, {
      method: "PATCH",
      body: apiFields,
    });
  }
  const store = storeFor(companyId);
  const current = findOffer(store, offerId, companyId);
  if (
    Object.keys(next).some((field) => field !== "status") &&
    !["OPEN", "CLOSED"].includes(current.status)
  ) {
    throw fail(409, "CONFLICT", "Une offre pourvue ne peut plus être modifiée.");
  }
  if (
    next.status &&
    !STATUS_TRANSITIONS[current.status]?.includes(next.status)
  ) {
    throw fail(409, "CONFLICT", "Cette transition de statut n’est pas autorisée.", {
      from: current.status,
      to: next.status,
    });
  }
  Object.assign(current, next);
  return wait(copy(current));
}

export function getMyOfferStats() {
  const store = optionalStore();
  const companyId = getUser()?.userId;
  const offers = store && companyId ? ownOffers(store, companyId) : [];
  return {
    total: offers.length,
    open: offers.filter((offer) => offer.status === "OPEN").length,
    filled: offers.filter((offer) => offer.status === "FILLED").length,
    closed: offers.filter((offer) => offer.status === "CLOSED").length,
  };
}

export function getOfferApplicationCounts() {
  const store = optionalStore();
  if (!store) return {};
  const counts = {};
  for (const application of store.applications) {
    counts[application.offerId] = (counts[application.offerId] || 0) + 1;
  }
  return counts;
}

export async function listCompanyApplications({
  status,
  offerId,
  limit = 100,
  cursor = null,
} = {}) {
  const companyId = currentCompanyId();
  const store = storeFor(companyId);
  const items = store.applications
    .filter(
      (application) =>
        application.companyId === companyId &&
        (!status || application.status === status) &&
        (!offerId || application.offerId === offerId),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((application) => enrichApplication(store, application));
  return wait(page(items, limit, cursor));
}

export async function listMyConventions({ state, limit = 100, cursor = null } = {}) {
  const companyId = currentCompanyId();
  const store = storeFor(companyId);
  const items = store.conventions
    .filter((convention) => convention.companyId === companyId && (!state || convention.state === state))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((convention) => enrichConvention(store, convention));
  return wait(page(items, limit, cursor));
}

export async function listMyReports({ status, limit = 100, cursor = null } = {}) {
  const companyId = currentCompanyId();
  const store = storeFor(companyId);
  const items = store.reports
    .filter((report) => report.companyId === companyId && (!status || report.status === status))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .map((report) => enrichReport(store, report));
  return wait(page(items, limit, cursor));
}

export async function listMyInterns({ limit = 100, cursor = null } = {}) {
  const companyId = currentCompanyId();
  const store = storeFor(companyId);
  const items = store.interns.map((intern) => ({
    ...intern,
    // NOT IN API YET: intern display details are joined from the mock student directory.
    student: copy(studentFor(store, intern.studentId)),
    convention: copy(store.conventions.find((item) => item.conventionId === intern.conventionId)),
  }));
  return wait(page(items, limit, cursor));
}

export async function listCompanyJournals({ studentId, limit = 100, cursor = null } = {}) {
  const companyId = currentCompanyId();
  const store = storeFor(companyId);
  const items = store.journals
    .filter((entry) => !studentId || entry.studentId === studentId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .map((entry) => ({
      ...entry,
      // NOT IN API YET: studentName is joined for company-facing journal rows.
      studentName: studentName(store, entry.studentId),
    }));
  return wait(page(items, limit, cursor));
}

export async function listCompanyNotifications({ limit = 100, cursor = null } = {}) {
  const store = storeFor();
  const items = [...store.notifications].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  return wait(page(items, limit, cursor));
}

export async function markCompanyNotificationRead(id) {
  const store = storeFor();
  const notification = store.notifications.find((item) => item.id === id);
  if (!notification)
    throw fail(404, "NOT_FOUND", "Cette notification n’existe plus.");
  notification.read = true;
  return wait(copy(notification));
}

export async function markAllCompanyNotificationsRead() {
  const store = storeFor();
  store.notifications.forEach((notification) => {
    notification.read = true;
  });
  return wait({ updated: store.notifications.length });
}

export function getCompanyApplicationsToProcessCount() {
  const store = optionalStore();
  const companyId = getUser()?.userId;
  return (
    store?.applications.filter(
      (application) =>
        application.companyId === companyId &&
        ["PENDING", "VIEWED"].includes(application.status),
    ).length || 0
  );
}

export function getCompanyConventionsToSignCount() {
  const store = optionalStore();
  const companyId = getUser()?.userId;
  return (
    store?.conventions.filter(
      (convention) => convention.companyId === companyId && convention.currentActorId === companyId,
    ).length || 0
  );
}

export function getCompanyReportsToReviewCount() {
  const store = optionalStore();
  const companyId = getUser()?.userId;
  return (
    store?.reports.filter(
      (report) =>
        report.companyId === companyId &&
        report.status === "UNDER_REVIEW" &&
        !report.companyDecision,
    ).length || 0
  );
}

export function getCompanyUnreadNotificationsCount() {
  const store = optionalStore();
  return store?.notifications.filter((notification) => !notification.read).length || 0;
}

export const COMPANY_OFFER_FILTERS = [
  { value: "OPEN", label: "Ouvertes" },
  { value: "CLOSED", label: "Clôturées" },
  { value: "FILLED", label: "Pourvues" },
];
export const COMPANY_GOUVERNORATS = GOUVERNORATS;
export const COMPANY_WORK_MODES = WORK_MODES;
export const COMPANY_APPLICATION_STATUSES = APPLICATION_STATUSES;
