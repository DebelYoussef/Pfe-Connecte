import { getUser, saveSession } from "./auth";
import { getToken } from "./auth";
import { getMe as getRealMe, updateMe as updateRealMe } from "./services";

export const REAL = {
  me: true,
  conventions: false,
  templates: false,
  deadline: false,
  teachers: false,
  supervision: false,
  notifications: false,
};

export const RESPONSABLE_DATA_CHANGED_EVENT = "pfe:responsable-data-changed";

const delay = 40;
const wait = (value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), delay));

const mockError = (status, code, message) =>
  Promise.reject({ status, code, message, details: {} });

function daysAgo(amount, hour = 12) {
  const date = new Date();
  date.setDate(date.getDate() - amount);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function daysAhead(amount) {
  const date = new Date();
  date.setDate(date.getDate() + amount);
  return date.toISOString();
}

function dateOnlyAhead(amount) {
  const date = new Date();
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function institution() {
  return getUser()?.etab || "ETAB1";
}

function event(conventionId, timestamp, type, actorId, actorRole, fromState, toState, reason) {
  return {
    conventionId,
    timestamp,
    type,
    actorId,
    actorRole,
    fromState,
    toState,
    ...(reason ? { reason } : {}),
  };
}

const user = getUser() || {};

function mockConvention(index, values) {
  return {
    conventionId: `responsable-convention-${index}`,
    studentId: `student-${index}`,
    companyId: `company-${index}`,
    offerId: `offer-${index}`,
    etab: institution(),
    state: values.state,
    renderedText: values.renderedText,
    templateVersion: 3,
    pdfSha256: `pdf-hash-${index}`,
    ...(values.finalSha256 ? { finalSha256: values.finalSha256 } : {}),
    ...(values.approvedAt ? { approvedAt: values.approvedAt } : {}),
    ...(values.noSupervisorEtab ? { noSupervisorEtab: values.noSupervisorEtab } : {}),
    shortRef: `PFE-2026-${String(100 + index).padStart(4, "0")}`,
    ...(values.currentActorId ? { currentActorId: values.currentActorId } : {}),
    ...(values.stepSince ? { stepSince: values.stepSince } : {}),
    ...(values.rejectionReason ? { rejectionReason: values.rejectionReason } : {}),
    createdAt: values.createdAt || daysAgo(18 + index),
    // NOT IN API YET
    studentName: values.studentName,
    // NOT IN API YET
    companyName: values.companyName,
    // NOT IN API YET
    subjectTitle: values.subjectTitle,
    // NOT IN API YET
    supervisorName: values.supervisorName || null,
  };
}

let conventions = [
  mockConvention(1, {
    state: "SIGNED_COMPANY",
    currentActorId: `RESP#${institution()}`,
    stepSince: daysAgo(2),
    studentName: "Amina Ben Salem",
    companyName: "Atelier Numérique",
    subjectTitle: "Plateforme de suivi des stages",
  }),
  mockConvention(2, {
    state: "SIGNED_COMPANY",
    currentActorId: `RESP#${institution()}`,
    stepSince: daysAgo(7),
    studentName: "Yassine Trabelsi",
    companyName: "Logistique Horizon",
    subjectTitle: "Optimisation des flux logistiques",
  }),
  mockConvention(3, {
    state: "SIGNED_STUDENT",
    currentActorId: "company-3",
    stepSince: daysAgo(3),
    studentName: "Nour Khediri",
    companyName: "Sécurité Conseil",
    subjectTitle: "Détection des anomalies",
  }),
  mockConvention(4, {
    state: "SUBMITTED",
    currentActorId: "student-4",
    stepSince: daysAgo(8),
    studentName: "Omar Dridi",
    companyName: "DataVision",
    subjectTitle: "Tableau de bord prédictif",
  }),
  mockConvention(5, {
    state: "DRAFT",
    studentName: "Lina Messaoud",
    companyName: "FinTech Tunisie",
    subjectTitle: "Sécurisation des paiements",
    rejectionReason: "La durée du stage doit être corrigée.",
  }),
  mockConvention(6, {
    state: "DRAFT",
    studentName: "Mehdi Bouaziz",
    companyName: "Cloud Services",
    subjectTitle: "Automatisation cloud",
  }),
  mockConvention(7, {
    state: "APPROVED",
    noSupervisorEtab: institution(),
    approvedAt: daysAgo(4),
    finalSha256: "final-hash-7",
    studentName: "Sara Gharbi",
    companyName: "AgriTech",
    subjectTitle: "Suivi agricole intelligent",
  }),
  mockConvention(8, {
    state: "APPROVED",
    noSupervisorEtab: institution(),
    approvedAt: daysAgo(2),
    finalSha256: "final-hash-8",
    studentName: "Adam Jaziri",
    companyName: "Industrie 4.0",
    subjectTitle: "Supervision des équipements",
  }),
  mockConvention(9, {
    state: "APPROVED",
    approvedAt: daysAgo(1),
    finalSha256: "final-hash-9",
    studentName: "Ines Ayari",
    companyName: "Santé Connectée",
    subjectTitle: "Application de télésuivi",
    supervisorName: "M. Karim Hadded",
  }),
].map((item) => {
  const events = [
    event(item.conventionId, daysAgo(14), "SUBMITTED", item.studentId, "ETU", "DRAFT", "SUBMITTED"),
  ];
  if (item.state === "SIGNED_COMPANY" || item.state === "SIGNED_STUDENT") {
    events.push(event(item.conventionId, daysAgo(10), "SIGNED", item.studentId, "ETU", "SUBMITTED", "SIGNED_STUDENT"));
  }
  if (item.state === "SIGNED_COMPANY") {
    events.push(event(item.conventionId, daysAgo(8), "SIGNED", item.companyId, "ENT", "SIGNED_STUDENT", "SIGNED_COMPANY"));
  }
  if (item.state === "DRAFT" && item.rejectionReason) {
    events.push(event(item.conventionId, daysAgo(6), "REJECTED", `RESP#${institution()}`, "RESP", "SIGNED_COMPANY", "DRAFT", item.rejectionReason));
  }
  if (item.conventionId === "responsable-convention-6") {
    events.push(event(item.conventionId, daysAgo(5), "MODIFIED", item.studentId, "ETU", "DRAFT", "DRAFT"));
  }
  if (item.state === "APPROVED") {
    events.push(event(item.conventionId, item.approvedAt || daysAgo(1), "APPROVED", `RESP#${institution()}`, "RESP", "SIGNED_COMPANY", "APPROVED"));
  }
  return {
    ...item,
    renderedText: item.renderedText || `Convention PFE entre ${item.studentName}, ${item.companyName} et ${institution()} pour « ${item.subjectTitle} ».`,
    events,
  };
});

let template = {
  etab: institution(),
  version: 3,
  text: "Convention de stage PFE\n\nÉtablissement : {{etab}}\nÉtudiant : {{student}}\nEntreprise : {{company}}\nSujet : {{subject}}\nDébut : {{startDate}}\nFin : {{endDate}}\nDurée : {{durationWeeks}} semaines",
  createdAt: daysAgo(45),
};

let deadlineSettings = {
  deadline: dateOnlyAhead(90),
  deadlineEnabled: true,
};

let supervisionRecords = new Map();

let notifications = [
  { id: "notif-1", createdAt: daysAgo(0, 14), type: "CONVENTION", title: "Convention à signer", body: "Une convention attend votre signature.", refType: "CONVENTION", refId: "responsable-convention-1", read: false },
  { id: "notif-2", createdAt: daysAgo(1, 10), type: "CONVENTION", title: "Convention bloquée depuis 5 jours", body: "La convention d’Omar Dridi nécessite une intervention.", refType: "CONVENTION", refId: "responsable-convention-4", read: false },
  { id: "notif-3", createdAt: daysAgo(2, 9), type: "SUPERVISION", title: "Encadrement à définir", body: "Deux étudiants approuvés sont sans enseignant.", refType: "SUPERVISION", refId: "", read: false },
  { id: "notif-4", createdAt: daysAgo(3, 16), type: "REMINDER", title: "Échéance du PFE", body: "Préparez les conventions avant la date limite.", refType: "REMINDER", refId: "", read: true },
  { id: "notif-5", createdAt: daysAgo(4, 11), type: "CONVENTION", title: "Convention refusée", body: "Lina Messaoud doit corriger sa convention.", refType: "CONVENTION", refId: "responsable-convention-5", read: true },
  { id: "notif-6", createdAt: daysAgo(5, 13), type: "SUPERVISION", title: "Convention approuvée", body: "Sara Gharbi est prête à être encadrée.", refType: "SUPERVISION", refId: "responsable-convention-7", read: false },
  { id: "notif-7", createdAt: daysAgo(6, 15), type: "CONVENTION", title: "Convention modifiée", body: "Mehdi Bouaziz a modifié sa convention.", refType: "CONVENTION", refId: "responsable-convention-6", read: true },
  { id: "notif-8", createdAt: daysAgo(7, 8), type: "REMINDER", title: "Rappel institutionnel", body: "Vérifiez les conventions en attente.", refType: "REMINDER", refId: "", read: true },
];

export async function getMeResponsable() {
  if (REAL.me) return getRealMe();
  return wait({ ...user, etab: institution() });
}

export async function updateMeResponsable(partial) {
  if (REAL.me) {
    const allowed = {};
    if (partial.firstName !== undefined) allowed.firstName = partial.firstName;
    if (partial.lastName !== undefined) allowed.lastName = partial.lastName;
    const updated = await updateRealMe(allowed);
    const token = getToken();
    if (token) saveSession({ token, user: { ...getUser(), ...updated } });
    return updated;
  }
  const token = getToken();
  const updated = { ...getUser(), ...partial };
  if (token) saveSession({ token, user: updated });
  return wait(updated);
}

export async function getMe() {
  return getMeResponsable();
}

export async function updateMe(partial) {
  return updateMeResponsable(partial);
}

export async function listConventions({ withoutSupervisor = false, limit = 100, cursor } = {}) {
  let items = conventions.filter((item) => item.etab === institution());
  if (withoutSupervisor) {
    items = items.filter((item) => item.state === "APPROVED" && item.noSupervisorEtab === institution());
  } else {
    // The default responsible queue includes the institution conventions.
  }
  const safeLimit = Number(limit) > 0 ? Number(limit) : 100;
  return wait({ items: items.slice(0, safeLimit), nextCursor: undefined });
}

export async function getConvention(conventionId) {
  const item = conventions.find((convention) => convention.conventionId === conventionId);
  if (!item) return mockError(404, "NOT_FOUND", "Convention introuvable.");
  return wait(item);
}

export async function listNotifications({ limit = 100, cursor } = {}) {
  const safeLimit = Number(limit) > 0 ? Number(limit) : 100;
  return wait({
    items: notifications.slice(0, safeLimit),
    nextCursor: undefined,
  });
}

export async function markNotificationRead(id) {
  const item = notifications.find((notification) => notification.id === id);
  if (!item) return mockError(404, "NOT_FOUND", "Notification introuvable.");
  item.read = true;
  return wait({ ...item });
}

export function isBlocked(convention) {
  if (convention.state === "APPROVED") return false;
  if (!convention.stepSince) return false;
  return Date.now() - new Date(convention.stepSince).getTime() > 5 * 24 * 60 * 60 * 1000;
}

export function getToSignConventions(items = conventions) {
  return items.filter(
    (item) =>
      item.etab === institution() &&
      item.state === "SIGNED_COMPANY" &&
      item.currentActorId === `RESP#${institution()}`,
  );
}

export function getConventionsToSignCount(items = conventions) {
  return getToSignConventions(items).length;
}

export function getWithoutSupervisorConventions(items = conventions) {
  return items.filter(
    (item) =>
      item.etab === institution() &&
      item.state === "APPROVED" &&
      item.noSupervisorEtab === institution(),
  );
}

export function getWithoutSupervisorCount(items = conventions) {
  return getWithoutSupervisorConventions(items).length;
}

export function getBlockedConventions(items = conventions) {
  return items.filter((item) => item.etab === institution() && isBlocked(item));
}

export function getBlockedCount(items = conventions) {
  return getBlockedConventions(items).length;
}

export function getDraftConventions(items = conventions) {
  return items.filter((item) => item.etab === institution() && item.state === "DRAFT");
}

export function getDraftCount(items = conventions) {
  return getDraftConventions(items).length;
}

export async function getConventionTemplate() {
  return wait({ ...template });
}

export async function updateConventionTemplate(text) {
  template = {
    ...template,
    version: template.version + 1,
    text,
    createdAt: new Date().toISOString(),
  };
  window.dispatchEvent(new Event(RESPONSABLE_DATA_CHANGED_EVENT));
  return wait({ ...template });
}

export async function getDeadlineSettings() {
  return wait({ ...deadlineSettings });
}

export async function updateDeadlineSettings(partial) {
  deadlineSettings = { ...deadlineSettings, ...partial };
  window.dispatchEvent(new Event(RESPONSABLE_DATA_CHANGED_EVENT));
  return wait({ ...deadlineSettings });
}

const teachers = [
  { userId: "teacher-1", firstName: "Karim", lastName: "Hadded", etab: institution(), expertise: ["python", "django", "sql"] },
  { userId: "teacher-2", firstName: "Leila", lastName: "Ben Ammar", etab: institution(), expertise: ["java", "spring", "docker"] },
  { userId: "teacher-3", firstName: "Nizar", lastName: "Chaabane", etab: institution(), expertise: ["aws", "linux", "kubernetes"] },
  { userId: "teacher-4", firstName: "Sonia", lastName: "Mansour", etab: institution(), expertise: ["react", "typescript", "node"] },
  { userId: "teacher-5", firstName: "Walid", lastName: "Khalfallah", etab: institution(), expertise: ["mongodb", "node", "git"] },
  { userId: "teacher-6", firstName: "Amel", lastName: "Jemai", etab: institution(), expertise: ["angular", "typescript", "java"] },
];

export async function listTeachers() {
  return wait(teachers.filter((teacher) => teacher.etab === institution()));
}

export async function assignSupervisor(conventionId, teacherId) {
  const convention = conventions.find((item) => item.conventionId === conventionId);
  const teacher = teachers.find((item) => item.userId === teacherId);
  if (!convention || !teacher) return mockError(404, "NOT_FOUND", "Convention ou enseignant introuvable.");
  convention.noSupervisorEtab = undefined;
  convention.supervisorName = `${teacher.firstName} ${teacher.lastName}`;
  supervisionRecords.set(convention.studentId, {
    studentId: convention.studentId,
    teacherId,
    status: "ASSIGNED",
    etab: institution(),
    assignedBy: getUser()?.userId,
  });
  window.dispatchEvent(new Event(RESPONSABLE_DATA_CHANGED_EVENT));
  return wait({ conventionId, studentId: convention.studentId, teacherId, status: "ASSIGNED", etab: institution() });
}

export async function signConvention(conventionId) {
  const convention = conventions.find((item) => item.conventionId === conventionId);
  if (!convention) return mockError(404, "NOT_FOUND", "Convention introuvable.");
  if (convention.state !== "SIGNED_COMPANY") {
    return mockError(409, "CONFLICT", "Cette convention n’est pas en attente de votre signature.");
  }
  convention.state = "APPROVED";
  convention.approvedAt = new Date().toISOString();
  convention.noSupervisorEtab = institution();
  convention.finalSha256 = `final-hash-${convention.conventionId}`;
  convention.events.push(event(
    conventionId,
    new Date().toISOString(),
    "APPROVED",
    `RESP#${institution()}`,
    "RESP",
    "SIGNED_COMPANY",
    "APPROVED",
  ));
  convention.currentActorId = undefined;
  convention.stepSince = undefined;
  window.dispatchEvent(new Event(RESPONSABLE_DATA_CHANGED_EVENT));
  return wait({ ...convention });
}

export async function correctConvention(conventionId, renderedText) {
  const convention = conventions.find((item) => item.conventionId === conventionId);
  if (!convention) return mockError(404, "NOT_FOUND", "Convention introuvable.");
  if (convention.state !== "DRAFT") {
    return mockError(409, "CONFLICT", "Cette convention n’est pas un brouillon.");
  }
  convention.renderedText = renderedText;
  convention.templateVersion = template.version;
  convention.events.push(event(
    conventionId,
    new Date().toISOString(),
    "MODIFIED",
    `RESP#${institution()}`,
    "RESP",
    "DRAFT",
    "DRAFT",
  ));
  window.dispatchEvent(new Event(RESPONSABLE_DATA_CHANGED_EVENT));
  return wait({ ...convention });
}
