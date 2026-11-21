import { getUser, saveSession } from "./auth";
import { getToken } from "./auth";
import {
  getMe as getRealMe,
  updateMe as updateRealMe,
} from "./services";
import {
  assignConventionSupervisor,
  correctConvention as correctStoredConvention,
  getConvention as getStoredConvention,
  getConventions as listStoredConventions,
  getConventionTemplate as getStoredTemplate,
  putConventionTemplate as putStoredTemplate,
  rejectConvention as rejectStoredConvention,
  restoreDefaultTemplate as restoreStoredDefaultTemplate,
  resubmitConvention as resubmitStoredConvention,
  signConvention as signStoredConvention,
  toConventionView,
} from "./mock/conventionStore";

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

const mockError = (status, code, message, details = {}) =>
  Promise.reject({ status, code, message, details });

function daysAgo(amount, hour = 12) {
  const date = new Date();
  date.setDate(date.getDate() - amount);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function dateOnlyAhead(amount) {
  const date = new Date();
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function institution() {
  const etab = getUser()?.etab || "ETAB1";
  if (etab === "Institut A") return "ETAB1";
  if (etab === "Institut B") return "ETAB2";
  return etab;
}

let deadlineSettings = {
  deadline: dateOnlyAhead(90),
  deadlineEnabled: true,
};

let supervisionRecords = new Map();

let notifications = [
  { id: "notif-1", createdAt: daysAgo(0, 14), type: "CONVENTION", title: "Convention à signer", body: "Une convention attend votre signature.", refType: "CONVENTION", refId: "responsable-convention-1", read: false },
  { id: "notif-2", createdAt: daysAgo(1, 10), type: "CONVENTION", title: "Convention bloquée", body: "Une convention nécessite une intervention.", refType: "CONVENTION", refId: "responsable-convention-4", read: false },
  { id: "notif-3", createdAt: daysAgo(2, 9), type: "SUPERVISION", title: "Encadrement à définir", body: "Deux étudiants approuvés sont sans enseignant.", refType: "SUPERVISION", refId: "", read: false },
  { id: "notif-4", createdAt: daysAgo(3, 16), type: "REMINDER", title: "Échéance du PFE", body: "Préparez les conventions avant la date limite.", refType: "REMINDER", refId: "", read: true },
  { id: "notif-5", createdAt: daysAgo(4, 11), type: "CONVENTION", title: "Convention refusée", body: "Une convention attend une correction.", refType: "CONVENTION", refId: "responsable-convention-5", read: true },
  { id: "notif-6", createdAt: daysAgo(5, 13), type: "SUPERVISION", title: "Convention approuvée", body: "Une convention approuvée attend un encadrant.", refType: "SUPERVISION", refId: "responsable-convention-7", read: false },
  { id: "notif-7", createdAt: daysAgo(6, 15), type: "CONVENTION", title: "Convention modifiée", body: "Une convention a été modifiée.", refType: "CONVENTION", refId: "responsable-convention-6", read: true },
  { id: "notif-8", createdAt: daysAgo(7, 8), type: "REMINDER", title: "Rappel institutionnel", body: "Vérifiez les conventions en attente.", refType: "REMINDER", refId: "", read: true },
];

const responsableExtrasKey = (userId) =>
  `profile-extras-${userId}`;

function readResponsableProfileExtras(userId) {
  if (!userId) return {};
  try {
    const stored = JSON.parse(localStorage.getItem(responsableExtrasKey(userId)));
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

function mergeResponsableProfileExtras(profile, partial = {}) {
  const userId = profile?.userId || getUser()?.userId;
  if (!userId) return { ...profile, links: partial.links || {} };
  const current = readResponsableProfileExtras(userId);
  const extras = {
    ...current,
    ...partial,
  };
  extras.links = {
    ...(current.links || {}),
    ...(partial.links || {}),
  };
  try {
    localStorage.setItem(responsableExtrasKey(userId), JSON.stringify(extras));
  } catch {
    // L’aperçu reste disponible dans la session même si le stockage local est plein.
  }
  return {
    ...profile,
    ...extras,
  };
}

export async function getMeResponsable() {
  if (REAL.me) return getRealMe();
  return wait({ ...getUser(), etab: institution() });
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
  const profile = await getMeResponsable();
  return wait({
    ...profile,
    ...readResponsableProfileExtras(profile.userId || getUser()?.userId),
  });
}

export async function updateMe(partial) {
  const profile = await updateMeResponsable(partial);
  const extras = {};
  for (const key of ["avatarUrl", "bio", "contactEmail", "links"]) {
    if (partial[key] !== undefined) extras[key] = partial[key];
  }
  const merged = mergeResponsableProfileExtras(profile, extras);
  return wait(merged);
}

export async function listConventions({ withoutSupervisor = false, limit = 100, cursor } = {}) {
  let items = await listStoredConventions();
  if (withoutSupervisor) {
    items = items.filter(
      (item) => item.state === "APPROVED" && item.noSupervisorEtab === item.etab,
    );
  }
  items = items.map(toConventionView);
  const safeLimit = Number(limit) > 0 ? Number(limit) : 100;
  const start = cursor ? Math.max(0, Number(cursor) || 0) : 0;
  const page = items.slice(start, start + safeLimit);
  const nextIndex = start + safeLimit;
  return wait({
    items: page,
    nextCursor: nextIndex < items.length ? String(nextIndex) : undefined,
  });
}

export async function getConvention(conventionId) {
  return wait(toConventionView(await getStoredConvention(conventionId)));
}

export async function listNotifications({ limit = 100, cursor } = {}) {
  const safeLimit = Number(limit) > 0 ? Number(limit) : 100;
  const start = cursor ? Math.max(0, Number(cursor) || 0) : 0;
  const page = notifications.slice(start, start + safeLimit);
  const nextIndex = start + safeLimit;
  return wait({
    items: page,
    nextCursor: nextIndex < notifications.length ? String(nextIndex) : undefined,
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

export function getToSignConventions(items = []) {
  return items.filter(
    (item) =>
      item.etab === institution() &&
      item.state === "SIGNED_COMPANY" &&
      item.currentActorId === `RESP#${institution()}`,
  );
}

export function getConventionsToSignCount(items = []) {
  return getToSignConventions(items).length;
}

export function getWithoutSupervisorConventions(items = []) {
  return items.filter(
    (item) =>
      item.etab === institution() &&
      item.state === "APPROVED" &&
      item.noSupervisorEtab === item.etab,
  );
}

export function getWithoutSupervisorCount(items = []) {
  return getWithoutSupervisorConventions(items).length;
}

export function getAssignedSupervisions() {
  return [...supervisionRecords.values()].filter(
    (record) => record.etab === institution(),
  );
}

export function getAssignedSupervisorCount() {
  return getAssignedSupervisions().length;
}

export function getBlockedConventions(items = []) {
  return items.filter((item) => item.etab === institution() && isBlocked(item));
}

export function getBlockedCount(items = []) {
  return getBlockedConventions(items).length;
}

export function getDraftConventions(items = []) {
  return items.filter((item) => item.etab === institution() && item.state === "DRAFT");
}

export function getDraftCount(items = []) {
  return getDraftConventions(items).length;
}

export function getInProgressConventions(items = []) {
  return items.filter(
    (item) =>
      item.etab === institution() &&
      ["SUBMITTED", "SIGNED_STUDENT"].includes(item.state),
  );
}

export function getInProgressCount(items = []) {
  return getInProgressConventions(items).length;
}

export function getApprovedConventions(items = []) {
  return items.filter(
    (item) => item.etab === institution() && item.state === "APPROVED",
  );
}

export function getApprovedCount(items = []) {
  return getApprovedConventions(items).length;
}

// NOT IN API YET: structured templates are stored in the shared local mock store.
export async function getStructuredConventionTemplate() {
  return wait(await getStoredTemplate());
}

export async function getDefaultStructuredConventionTemplate() {
  return wait(await restoreStoredDefaultTemplate());
}

export async function putStructuredConventionTemplate(template) {
  const updated = await putStoredTemplate(template);
  window.dispatchEvent(new Event(RESPONSABLE_DATA_CHANGED_EVENT));
  return wait(updated);
}

export async function getDeadlineSettings() {
  return wait({ ...deadlineSettings });
}

export async function putDeadlineSettings({ deadlineEnabled, deadline } = {}) {
  if (typeof deadlineEnabled !== "boolean") {
    return mockError(
      400,
      "VALIDATION_ERROR",
      "Le statut d’activation est requis.",
      { fields: ["deadlineEnabled"] },
    );
  }
  if (deadlineEnabled && !deadline) {
    return mockError(
      400,
      "VALIDATION_ERROR",
      "Une date limite est requise lorsque l’échéance est active.",
      { fields: ["deadline"] },
    );
  }
  deadlineSettings = {
    deadline: deadlineEnabled ? deadline : null,
    deadlineEnabled,
  };
  window.dispatchEvent(new Event(RESPONSABLE_DATA_CHANGED_EVENT));
  return wait({ ...deadlineSettings });
}

export async function updateDeadlineSettings(partial) {
  return putDeadlineSettings(partial);
}

const teachers = [
  { userId: "teacher-1", firstName: "Karim", lastName: "Hadded", etab: institution(), expertise: ["python", "django", "sql"] },
  { userId: "teacher-2", firstName: "Leila", lastName: "Ben Ammar", etab: institution(), expertise: ["java", "spring", "docker"] },
  { userId: "teacher-3", firstName: "Nizar", lastName: "Chaabane", etab: institution(), expertise: ["aws", "linux", "kubernetes"] },
  { userId: "teacher-4", firstName: "Sonia", lastName: "Mansour", etab: institution(), expertise: ["react", "typescript", "node"] },
  { userId: "teacher-5", firstName: "Walid", lastName: "Khalfallah", etab: institution(), expertise: ["mongodb", "node", "git"] },
  { userId: "teacher-6", firstName: "Amel", lastName: "Jemai", etab: institution(), expertise: ["angular", "typescript", "java"] },
];

export async function listTeachers({ expertise, limit = 100, cursor } = {}) {
  let items = teachers.filter((teacher) => teacher.etab === institution());
  if (expertise) {
    items = items.filter((teacher) =>
      teacher.expertise.some(
        (value) => value.toLocaleLowerCase("fr") === String(expertise).toLocaleLowerCase("fr"),
      ),
    );
  }
  const safeLimit = Number(limit) > 0 ? Number(limit) : 100;
  const start = cursor ? Math.max(0, Number(cursor) || 0) : 0;
  const page = items.slice(start, start + safeLimit);
  const nextIndex = start + safeLimit;
  return wait({
    items: page,
    nextCursor: nextIndex < items.length ? String(nextIndex) : undefined,
  });
}

export async function assignSupervisor(studentId, teacherId) {
  const convention = (await listStoredConventions()).find(
    (item) => item.studentId === studentId,
  );
  const teacher = teachers.find((item) => item.userId === teacherId);
  if (!teacher) {
    return mockError(404, "NOT_FOUND", "Enseignant introuvable.");
  }
  if (teacher.etab !== institution()) {
    return mockError(404, "NOT_FOUND", "Enseignant introuvable dans cet établissement.");
  }
  if (!convention) {
    return mockError(404, "NOT_FOUND", "Étudiant introuvable.");
  }
  if (convention.state !== "APPROVED") {
    return mockError(409, "CONFLICT", "La convention de cet étudiant n’est pas approuvée.");
  }
  const existing = supervisionRecords.get(studentId);
  if (
    existing &&
    ["ACCEPTED", "ASSIGNED"].includes(existing.status)
  ) {
    return mockError(409, "CONFLICT", "Cet étudiant possède déjà un encadrement.");
  }
  await assignConventionSupervisor(
    convention.conventionId,
    teacher,
  );
  const timestamp = new Date().toISOString();
  const supervision = {
    studentId,
    teacherId,
    status: "ASSIGNED",
    etab: institution(),
    assignedBy: getUser()?.userId,
    respondedAt: timestamp,
  };
  supervisionRecords.set(studentId, supervision);
  notifications.unshift(
    {
      id: `notif-supervision-student-${studentId}-${Date.now()}`,
      createdAt: timestamp,
      type: "SUPERVISION",
      title: "Encadrant affecté",
      body: "Un encadrant a été affecté à votre suivi.",
      refType: "SUPERVISION",
      refId: studentId,
      read: false,
    },
    {
      id: `notif-supervision-teacher-${teacherId}-${Date.now()}`,
      createdAt: timestamp,
      type: "SUPERVISION",
      title: "Nouvelle affectation",
      body: "Un étudiant a été affecté à votre encadrement.",
      refType: "SUPERVISION",
      refId: studentId,
      read: false,
    },
  );
  window.dispatchEvent(new Event(RESPONSABLE_DATA_CHANGED_EVENT));
  return wait(supervision);
}

export async function signConvention(conventionId) {
  const updated = await signStoredConvention(conventionId);
  window.dispatchEvent(new Event(RESPONSABLE_DATA_CHANGED_EVENT));
  return wait(toConventionView(updated));
}

export async function rejectConvention(conventionId, { reason } = {}) {
  const updated = await rejectStoredConvention(conventionId, { reason });
  window.dispatchEvent(new Event(RESPONSABLE_DATA_CHANGED_EVENT));
  return wait(toConventionView(updated));
}

export async function correctConvention(conventionId, input = {}) {
  const updated = await correctStoredConvention(conventionId, input);
  window.dispatchEvent(new Event(RESPONSABLE_DATA_CHANGED_EVENT));
  return wait(toConventionView(updated));
}

export async function resubmitConvention(conventionId) {
  const updated = await resubmitStoredConvention(conventionId);
  window.dispatchEvent(new Event(RESPONSABLE_DATA_CHANGED_EVENT));
  return wait(toConventionView(updated));
}

export async function getConventionPdfUrl(conventionId) {
  const convention = await getConvention(conventionId);
  const documentHash = convention.frozenHash || convention.documentHash;
  const lines = [
    "CONVENTION DE STAGE PFE",
    convention.shortRef,
    ...String(convention.renderedText || "").split(/\r?\n/).slice(0, 6),
    `Empreinte : ${documentHash || ""}`,
  ];
  const pdf = `%PDF-1.4\n${lines.join("\n")}\n%%EOF`;
  const url = `data:application/pdf;charset=utf-8,${encodeURIComponent(pdf)}`;
  return wait({ url, expiresIn: 300 });
}
