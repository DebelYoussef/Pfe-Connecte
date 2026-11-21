// NOT IN API YET: les conventions et leurs actions sont conservées dans ce magasin local de démonstration.
import { getUser } from "../auth";
import {
  AUTO_BINDINGS,
  buildDocument,
  countCompanyConventionActions,
  computeCompletion,
  etabName,
  resolveAuto,
  sha256Hex,
  canonicalize,
  serializeDocumentText,
  validateField,
} from "../lib/conventionDocument";

const STORAGE_KEY = "pfe-mock-conventions";
const SCENARIOS = new Set([
  "new",
  "fill",
  "ready",
  "signing",
  "toApprove",
  "approved",
  "draftRefused",
  "draftModified",
]);
const clone = (value) => JSON.parse(JSON.stringify(value));
let memoryStore = null;
let lastStorageValue = null;

export const MOCK_CAST = Object.freeze({
  students: [
    {
      studentId: "S2",
      firstName: "Amira",
      lastName: "Ben Salah",
      email: "amira@example.test",
      specialty: "Génie logiciel",
      department: "Informatique",
      gouvernorat: "Tunis",
      etab: "ETAB1",
    },
    {
      studentId: "S3",
      firstName: "Youssef",
      lastName: "Debel",
      email: "youssef@example.test",
      specialty: "Réseaux",
      department: "Technologies de l’information",
      gouvernorat: "Sousse",
      etab: "ETAB2",
    },
  ],
  companies: [
    {
      companyId: "C2",
      name: "Logistique Horizon",
      contactName: "Sonia Trabelsi",
      email: "contact@logistique.example.test",
      gouvernorat: "Sousse",
    },
  ],
  teachers: [
    { userId: "T1", firstName: "Karim", lastName: "Hadded", etab: "ETAB1" },
    { userId: "T2", firstName: "Leila", lastName: "Ben Ammar", etab: "ETAB1" },
    { userId: "T3", firstName: "Nizar", lastName: "Chaabane", etab: "ETAB1" },
    { userId: "T4", firstName: "Sonia", lastName: "Mansour", etab: "ETAB2" },
    { userId: "T5", firstName: "Walid", lastName: "Khalfallah", etab: "ETAB2" },
    { userId: "T6", firstName: "Amel", lastName: "Jemai", etab: "ETAB2" },
  ],
  offers: [
    {
      offerId: "O1",
      companyId: "C1",
      title: "Développement d’une plateforme React",
      durationWeeks: 16,
      gouvernorat: "Tunis",
      workMode: "HYBRID",
    },
    {
      offerId: "O2",
      companyId: "C2",
      title: "Analyse de données logistiques",
      durationWeeks: 20,
      gouvernorat: "Sousse",
      workMode: "ONSITE",
    },
    {
      offerId: "O3",
      companyId: "C1",
      title: "Sécurisation d’une application web",
      durationWeeks: 24,
      gouvernorat: "Sfax",
      workMode: "REMOTE",
    },
  ],
});

const APPLICATIONS = [
  { applicationId: "A1", studentId: "S1", offerId: "O1", etab: "ETAB1" },
  { applicationId: "A2", studentId: "S2", offerId: "O2", etab: "ETAB1" },
  { applicationId: "A3", studentId: "S3", offerId: "O3", etab: "ETAB2" },
];

function fail(status, code, message, details = {}) {
  return { status, code, message, details };
}

function throwError(status, code, message, details = {}) {
  throw fail(status, code, message, details);
}

function currentUser() {
  const user = getUser();
  if (!user || typeof user !== "object") {
    throwError(401, "UNAUTHENTICATED", "La session utilisateur est introuvable.");
  }
  return user;
}

function normalizeEtab(etab) {
  if (etab === "Institut A") return "ETAB1";
  if (etab === "Institut B") return "ETAB2";
  return etab || "ETAB1";
}

function currentEtab(user = getUser()) {
  return normalizeEtab(user?.etab);
}

function makeField(key, label, type, source, required = true, extra = {}) {
  return { key, label, type, source, required, ...extra };
}

function defaultTemplate(etab = "ETAB1") {
  const normalizedEtab = normalizeEtab(etab);
  const sourcePlaceholder = "À confirmer depuis le PDF source";
  const staticField = (key, label, value = sourcePlaceholder) =>
    makeField(key, label, "text", "STATIC", true, { value });
  const partyField = (key, label, type = "text", required = true, extra = {}) =>
    makeField(key, label, type, "STUDENT", required, extra);
  const companyField = (key, label, type = "text", required = true, extra = {}) =>
    makeField(key, label, type, "COMPANY", required, extra);
  const autoField = (key, label, type, binding, required = true) =>
    makeField(key, label, type, "AUTO", required, { binding });
  const articles = Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    const text =
      number === 9
        ? "9-1. [Texte exact du PDF à fournir]\n9-2. [Texte exact du PDF à fournir]"
        : `[Texte exact de l’article ${number} à fournir]`;
    return {
      id: `article-${number}`,
      title: `Article ${number}`,
      text,
    };
  });

  return {
    etab: normalizedEtab,
    version: 3,
    createdAt: new Date().toISOString(),
    header: {
      lines: [
        "En-tête français à confirmer depuis le PDF source",
        "يُستكمل النص العربي من الوثيقة الأصلية",
      ],
    },
    title: "Convention de stage PFE",
    sections: [
      {
        id: "origin",
        title: "Établissement d'origine",
        fields: [
          staticField("originName", "Nom", etabName(normalizedEtab)),
          staticField("originAddress", "Adresse"),
          staticField("originPhone", "Téléphone"),
          staticField("originFax", "Fax"),
          staticField("originEmail", "Email"),
          staticField("originWebsite", "Site web"),
        ],
      },
      {
        id: "host",
        title: "Établissement d'accueil",
        fields: [
          autoField("companyName", "Nom", "text", "company.name"),
          companyField("companyAddress", "Adresse"),
          companyField("companyPostalCode", "Code postal"),
          companyField("companyCity", "Ville"),
          companyField("companyCountry", "Pays"),
          companyField("companyPhone", "Téléphone", "phone"),
          companyField("companyFax", "Fax", "phone", false),
          companyField("companyEmail", "Email", "email"),
          companyField("companyWebsite", "Site web", "text", false),
        ],
      },
      {
        id: "student",
        title: "L'élève stagiaire",
        fields: [
          autoField("studentSpecialty", "Spécialité", "text", "student.specialty"),
          autoField("studentFullName", "Nom et prénom", "text", "student.fullName"),
          partyField("studentBirthDatePlace", "Date et lieu de naissance"),
          partyField("studentCin", "CIN N°", "text", false, { sensitive: true }),
          partyField("studentPassport", "Passeport N°", "text", false, { sensitive: true }),
          partyField("studentNationality", "Nationalité"),
          partyField("studentAddress", "Adresse personnelle", "textarea"),
          partyField("studentPostalCode", "Code postal"),
          partyField("studentCity", "Ville"),
          autoField("studentEmail", "Email", "email", "student.email"),
          partyField("studentPhone", "Tél.", "phone"),
          partyField("baccalaureateYear", "Année d'obtention du baccalauréat", "number"),
          partyField("baccalaureateSpecialty", "Spécialité du baccalauréat", "text", false),
          partyField("baccalaureateMention", "Mention"),
          partyField("firstEnrollmentYear", "Année de la première inscription", "number"),
          partyField("registrationNumber", "N° d'inscription"),
          partyField("otherDiploma", "Autre diplôme", "text", false),
          partyField("otherDiplomaYear", "Année d'obtention du diplôme", "number", false),
        ],
      },
      {
        id: "supervisor",
        title: "Réservé à l'encadrant en entreprise",
        fields: [
          companyField("supervisorName", "Nom et prénom"),
          companyField("supervisorGrade", "Grade / Spécialité"),
          companyField("supervisorPhone", "Téléphone", "phone"),
          companyField("supervisorPosition", "Poste", "text", false),
          companyField("supervisorFax", "Fax", "phone", false),
          companyField("supervisorMobile", "Mobile", "phone"),
          companyField("supervisorEmail", "Email", "email"),
          companyField("supervisorDate", "Date", "date"),
        ],
      },
      {
        id: "period",
        title: "Période du stage",
        fields: [
          companyField("internshipStartDate", "Date de début", "date"),
          companyField("internshipEndDate", "Date de fin", "date"),
          autoField("durationWeeks", "Durée en semaines", "number", "offer.durationWeeks"),
        ],
      },
      {
        id: "subject",
        title: "Sujet",
        fields: [
          autoField("offerTitle", "Intitulé", "text", "offer.title"),
          companyField("workObjective", "Objectif du travail demandé", "textarea"),
          companyField("workEnvironment", "Environnement de travail", "textarea", true, {
            helpText: "matériel, systèmes, méthodologies, autres",
          }),
        ],
      },
    ],
    articles,
    signatories: [
      {
        role: "ETU",
        label: "L'élève stagiaire",
        hint: "Nom, prénom et signature obligatoires",
      },
      {
        role: "ENT",
        label: "Le représentant de l'établissement d'accueil",
        hint: "Cachet et signature obligatoires",
      },
      {
        role: "RESP",
        label: "Le Directeur de l'établissement",
        hint: "Cachet et signature obligatoires",
      },
    ],
    footer: {
      code: "FO-PFE-27",
      revision: "00",
      edition: "01/2023",
    },
  };
}

function getStudent(studentId, user = getUser()) {
  if (studentId === "S1") {
    const actingStudent = user?.role === "ETU" ? user : null;
    const firstName = actingStudent?.firstName || "";
    const lastName = actingStudent?.lastName || "";
    return {
      studentId: "S1",
      firstName,
      lastName,
      fullName:
        actingStudent?.fullName ||
        [firstName, lastName].filter(Boolean).join(" "),
      email: actingStudent?.email || "",
      specialty: actingStudent?.specialty || "",
      department: actingStudent?.department || "",
      gouvernorat: actingStudent?.gouvernorat || "",
      etab: normalizeEtab(actingStudent?.etab),
    };
  }
  return MOCK_CAST.students.find((student) => student.studentId === studentId) || {};
}

function getCompany(companyId, user = getUser()) {
  if (companyId === "C1") {
    const actingCompany = user?.role === "ENT" ? user : null;
    const firstName = actingCompany?.firstName || "";
    const lastName = actingCompany?.lastName || "";
    return {
      companyId: "C1",
      name: actingCompany?.companyName || "Atelier Numérique",
      contactName:
        actingCompany?.contactName ||
        [firstName, lastName].filter(Boolean).join(" "),
      email: actingCompany?.contactEmail || actingCompany?.email || "",
      gouvernorat: actingCompany?.gouvernorat || "Tunis",
    };
  }
  return MOCK_CAST.companies.find((company) => company.companyId === companyId) || {};
}

function makeAutoContext(application, user = getUser()) {
  const student = getStudent(application.studentId, user);
  const offer = MOCK_CAST.offers.find((item) => item.offerId === application.offerId);
  const company = getCompany(offer?.companyId, user);
  const institution = {
    name: etabName(application.etab),
  };
  return { student, company, offer: offer || {}, institution };
}

function roleParty(user, convention) {
  if (user.role === "ETU") return convention.studentId === "S1" ? "STUDENT" : null;
  if (user.role === "ENT") return convention.companyId === "C1" ? "COMPANY" : null;
  if (user.role === "RESP" && normalizeEtab(user.etab) === convention.etab) return "RESP";
  return null;
}

function actorIdFor(role, convention, user) {
  if (role === "ETU") return convention.studentId;
  if (role === "ENT") return convention.companyId;
  if (role === "RESP") return `RESP#${convention.etab}`;
  return user?.userId;
}

function eventFor(convention, type, actorRole, actorId, fromState, toState, extra = {}) {
  return {
    conventionId: convention.conventionId,
    timestamp: new Date().toISOString(),
    type,
    actorId,
    actorRole,
    fromState,
    toState,
    ...extra,
  };
}

function templateFields(snapshot) {
  return (Array.isArray(snapshot?.sections) ? snapshot.sections : []).flatMap(
    (section) => (Array.isArray(section?.fields) ? section.fields : []),
  );
}

function validateTemplate(template) {
  const errors = [];
  const keys = new Set();
  const sections = Array.isArray(template.sections) ? template.sections : [];
  if (!Array.isArray(template.sections)) {
    errors.push({ key: "sections", message: "Les sections du modèle sont invalides." });
  }
  if (sections.some((section) => !section || typeof section !== "object" || Array.isArray(section))) {
    errors.push({ key: "sections", message: "Une section du modèle est invalide." });
  }
  const fields = templateFields({ sections });
  for (const field of fields) {
    if (!field || typeof field !== "object" || Array.isArray(field)) {
      errors.push({ key: "fields", message: "Un champ du modèle est invalide." });
      continue;
    }
    if (!/^[A-Za-z0-9_]+$/.test(field.key || "")) {
      errors.push({ key: field.key || "key", message: "La clé doit contenir uniquement des lettres, chiffres et traits de soulignement." });
    } else if (keys.has(field.key)) {
      errors.push({ key: field.key, message: "La clé du champ doit être unique." });
    }
    keys.add(field.key);
    if (!String(field.label || "").trim()) {
      errors.push({ key: field.key || "label", message: "Le libellé du champ est obligatoire." });
    }
    if (
      field.source === "STATIC" &&
      (typeof field.value !== "string" || !field.value.trim())
    ) {
      errors.push({ key: field.key, message: "Un champ statique doit avoir une valeur." });
    }
    if (field.source === "AUTO" && !Object.hasOwn(AUTO_BINDINGS, field.binding)) {
      errors.push({ key: field.key, message: "La liaison automatique est invalide." });
    }
    if (!["text", "email", "phone", "date", "textarea", "number"].includes(field.type)) {
      errors.push({ key: field.key, message: "Le type de champ est invalide." });
    }
    if (!["STATIC", "AUTO", "STUDENT", "COMPANY"].includes(field.source)) {
      errors.push({ key: field.key, message: "La source du champ est invalide." });
    }
    if (typeof field.required !== "boolean") {
      errors.push({ key: field.key, message: "Le caractère obligatoire du champ est invalide." });
    }
  }
  if (!fields.some((field) => field.source === "STUDENT")) {
    errors.push({ key: "fields", message: "Le modèle doit contenir au moins un champ étudiant." });
  }
  if (!fields.some((field) => field.source === "COMPANY")) {
    errors.push({ key: "fields", message: "Le modèle doit contenir au moins un champ entreprise." });
  }
  const articles = Array.isArray(template.articles) ? template.articles : [];
  if (!Array.isArray(template.articles)) {
    errors.push({ key: "articles", message: "Les articles du modèle sont invalides." });
  }
  for (const article of articles) {
    if (!String(article.title || "").trim()) {
      errors.push({ key: article.id || "article", message: "Le titre de chaque article est obligatoire." });
    }
  }
  if (errors.length) {
    throwError(400, "VALIDATION_ERROR", "Le modèle de convention est invalide.", {
      fields: errors.map((error) => error.key),
      messages: errors,
    });
  }
}

function initialValues(snapshot, context, complete) {
  const values = {};
  for (const field of templateFields(snapshot)) {
    if (field.source === "AUTO") {
      values[field.key] = resolveAuto(field.binding, context);
    } else if (complete && ["STUDENT", "COMPANY"].includes(field.source)) {
      if (field.type === "email") {
        values[field.key] =
          field.source === "STUDENT" ? "etu@example.test" : "contact@example.test";
      } else if (field.type === "phone") {
        values[field.key] = "+216 20 123 456";
      } else if (field.type === "date") {
        values[field.key] = "2026-02-15";
      } else if (field.type === "number") {
        values[field.key] = /Year$/.test(field.key) ? "2022" : "16";
      } else if (field.key === "studentNationality") {
        values[field.key] = "Tunisienne";
      } else if (field.key === "companyCountry") {
        values[field.key] = "Tunisie";
      } else if (field.key === "companyPostalCode" || field.key === "studentPostalCode") {
        values[field.key] = "1000";
      } else if (field.key === "supervisorName") {
        values[field.key] = "Responsable d’entreprise";
      } else {
        values[field.key] = "Information de démonstration";
      }
    }
  }
  return values;
}

async function updateDerived(convention) {
  convention.completion = computeCompletion(convention.templateSnapshot, convention.values);
  convention.documentHash = await sha256Hex(
    canonicalize(buildDocument(convention.templateSnapshot, convention.values)),
  );
}

function newStore() {
  return {
    templates: {
      ETAB1: defaultTemplate("ETAB1"),
      ETAB2: defaultTemplate("ETAB2"),
    },
    conventions: [],
  };
}

function browserStorage() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

function storageError() {
  return fail(
    500,
    "CONVENTION_STORAGE_ERROR",
    "Les données locales des conventions sont indisponibles.",
  );
}

async function readStore() {
  let raw;
  try {
    raw = browserStorage()?.getItem(STORAGE_KEY) ?? null;
  } catch {
    throw storageError();
  }
  if (raw !== lastStorageValue) {
    if (!raw) {
      memoryStore = null;
      lastStorageValue = null;
    } else {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || !parsed.templates || !Array.isArray(parsed.conventions)) {
          throw new Error("invalid store");
        }
        memoryStore = parsed;
        lastStorageValue = raw;
      } catch {
        throw storageError();
      }
    }
  }
  if (!memoryStore) {
    memoryStore = newStore();
    await resetScenarioInStore(memoryStore, "fill");
    await writeStore(memoryStore);
  }
  return memoryStore;
}

export function getCompanyConventionActionCount(companyId) {
  if (!companyId) return 0;
  let raw;
  try {
    raw = browserStorage()?.getItem(STORAGE_KEY) ?? null;
  } catch {
    throw storageError();
  }
  if (!raw) return 0;
  let store;
  try {
    store = JSON.parse(raw);
  } catch {
    throw storageError();
  }
  if (!store || !Array.isArray(store.conventions)) {
    throw storageError();
  }
  return countCompanyConventionActions(store.conventions, companyId);
}

async function writeStore(store) {
  memoryStore = store;
  try {
    const storage = browserStorage();
    if (storage) {
      const raw = JSON.stringify(store);
      storage.setItem(STORAGE_KEY, raw);
      lastStorageValue = raw;
    }
  } catch {
    throw storageError();
  }
}

async function makeConvention(application, template, complete) {
  const context = makeAutoContext(application);
  const now = new Date().toISOString();
  const convention = {
    conventionId: `CONV-${application.applicationId}-${Date.now()}`,
    applicationId: application.applicationId,
    studentId: application.studentId,
    companyId: MOCK_CAST.offers.find((offer) => offer.offerId === application.offerId)?.companyId,
    offerId: application.offerId,
    etab: application.etab,
    state: "SUBMITTED",
    shortRef: `PFE-${String(Date.now()).slice(-6)}`,
    currentActorId: application.studentId,
    stepSince: now,
    rejectionReason: null,
    approvedAt: null,
    createdAt: now,
    templateVersion: template.version,
    templateSnapshot: clone(template),
    values: initialValues(template, context, complete),
    completion: null,
    documentHash: "",
    frozenHash: null,
    frozenAt: null,
    signatures: [],
    events: [],
  };
  convention.events.push(
    eventFor(
      convention,
      "SUBMITTED",
      "ETU",
      application.studentId,
      "DRAFT",
      "SUBMITTED",
    ),
  );
  await updateDerived(convention);
  return convention;
}

async function resetScenarioInStore(store, scenarioName) {
  if (!SCENARIOS.has(scenarioName)) {
    throwError(400, "INVALID_SCENARIO", "Le scénario de convention est invalide.", {
      fields: ["scenarioName"],
    });
  }
  store.conventions = [];
  if (scenarioName === "new") return;

  const application = { ...APPLICATIONS[0], etab: currentEtab() };
  const convention = await makeConvention(
    application,
    store.templates[application.etab],
    scenarioName !== "fill",
  );
  if (scenarioName === "draftRefused") {
    const fromState = convention.state;
    convention.state = "DRAFT";
    convention.currentActorId = `RESP#${convention.etab}`;
    convention.rejectionReason = "Le téléphone de l’étudiant doit être précisé.";
    convention.stepSince = new Date().toISOString();
    convention.events.push(
      eventFor(
        convention,
        "REJECTED",
        "RESP",
        `RESP#${convention.etab}`,
        fromState,
        "DRAFT",
        { reason: convention.rejectionReason, hash: convention.documentHash },
      ),
    );
  }
  if (scenarioName === "draftModified") {
    convention.frozenHash = convention.documentHash;
    convention.frozenAt = new Date().toISOString();
    convention.signatures = [
      {
        role: "ETU",
        signerId: "S1",
        signedAt: convention.frozenAt,
        hash: convention.frozenHash,
      },
      {
        role: "ENT",
        signerId: "C1",
        signedAt: convention.frozenAt,
        hash: convention.frozenHash,
      },
    ];
    const oldHash = convention.frozenHash.slice(0, 12);
    convention.frozenHash = null;
    convention.frozenAt = null;
    convention.signatures = [];
    convention.state = "DRAFT";
    convention.currentActorId = `RESP#${convention.etab}`;
    convention.stepSince = new Date().toISOString();
    convention.events.push(
      eventFor(
        convention,
        "MODIFIED",
        "ETU",
        "S1",
        "SIGNED_COMPANY",
        "DRAFT",
        { party: "STUDENT", oldHash, newHash: convention.documentHash },
      ),
    );
  } else if (["signing", "toApprove", "approved"].includes(scenarioName)) {
    convention.frozenHash = convention.documentHash;
    convention.frozenAt = new Date().toISOString();
    convention.signatures.push({
      role: "ETU",
      signerId: "S1",
      signedAt: convention.frozenAt,
      hash: convention.frozenHash,
    });
    convention.events.push(
      eventFor(
        convention,
        "SIGNED",
        "ETU",
        "S1",
        "SUBMITTED",
        "SIGNED_STUDENT",
        { hash: convention.frozenHash },
      ),
    );
    convention.state = "SIGNED_STUDENT";
    convention.currentActorId = "C1";
    if (["toApprove", "approved"].includes(scenarioName)) {
      convention.signatures.push({
        role: "ENT",
        signerId: "C1",
        signedAt: convention.frozenAt,
        hash: convention.frozenHash,
      });
      convention.events.push(
        eventFor(
          convention,
          "SIGNED",
          "ENT",
          "C1",
          "SIGNED_STUDENT",
          "SIGNED_COMPANY",
          { hash: convention.frozenHash },
        ),
      );
      convention.state = "SIGNED_COMPANY";
      convention.currentActorId = `RESP#${convention.etab}`;
      if (scenarioName === "approved") {
        convention.signatures.push({
          role: "RESP",
          signerId: `RESP#${convention.etab}`,
          signedAt: convention.frozenAt,
          hash: convention.frozenHash,
        });
        convention.state = "APPROVED";
        convention.approvedAt = new Date().toISOString();
          convention.noSupervisorEtab = convention.etab;
        delete convention.currentActorId;
        convention.events.push(
          eventFor(
            convention,
            "APPROVED",
            "RESP",
            `RESP#${convention.etab}`,
            "SIGNED_COMPANY",
            "APPROVED",
            { hash: convention.frozenHash },
          ),
        );
      }
    }
  }
  store.conventions.push(convention);
}

function findConvention(store, conventionId) {
  const convention = store.conventions.find((item) => item.conventionId === conventionId);
  if (!convention) {
    throwError(404, "NOT_FOUND", "Convention introuvable.");
  }
  return convention;
}

function assertVisible(user, convention) {
  if (!roleParty(user, convention)) {
    throwError(403, "FORBIDDEN", "Cette convention n’est pas accessible à votre compte.");
  }
}

function requireRole(user, role) {
  if (user.role !== role) {
    throwError(403, "FORBIDDEN", "Cette action n’est pas autorisée pour votre rôle.");
  }
}

function missingRequiredLabels(convention) {
  return templateFields(convention.templateSnapshot)
    .filter(
      (field) =>
        field.required &&
        ["STUDENT", "COMPANY"].includes(field.source) &&
        !String(convention.values[field.key] ?? "").trim(),
    )
    .map((field) => field.label);
}

async function saveConvention(store) {
  await writeStore(store);
}

export async function getConventions() {
  const store = await readStore();
  const user = currentUser();
  return clone(
    store.conventions.filter((convention) =>
      roleParty(user, convention),
    ),
  );
}

export async function getConvention(conventionId) {
  const store = await readStore();
  const convention = findConvention(store, conventionId);
  assertVisible(currentUser(), convention);
  return clone(convention);
}

// NOT IN API YET: legacy convention service fields are derived views of the structured snapshot.
export function toConventionView(convention) {
  const document = buildDocument(convention.templateSnapshot, convention.values);
  const fieldValues = Object.fromEntries(
    document.sections.flatMap((section) =>
      section.fields.map((field) => [field.key, field.value]),
    ),
  );
  return {
    ...clone(convention),
    etabName: etabName(convention.etab),
    studentName: fieldValues.studentFullName || "",
    companyName: fieldValues.companyName || "",
    offerTitle: fieldValues.offerTitle || "",
    subjectTitle: fieldValues.offerTitle || "",
    studentAddress: convention.values.studentAddress || "",
    studentPhone: convention.values.studentPhone || "",
    renderedText: serializeDocumentText(document),
    pdfSha256: convention.documentHash,
    ...(convention.state === "APPROVED"
      ? { finalSha256: convention.frozenHash }
      : {}),
  };
}

export async function getConventionTemplate(etab = currentEtab()) {
  const store = await readStore();
  const template = store.templates[normalizeEtab(etab)];
  if (!template) {
    throwError(404, "TEMPLATE_NOT_FOUND", "Le modèle de convention est introuvable.");
  }
  return clone(template);
}

export async function putConventionTemplate(template) {
  const user = currentUser();
  requireRole(user, "RESP");
  const store = await readStore();
  const etab = normalizeEtab(template?.etab || currentEtab(user));
  if (etab !== currentEtab(user)) {
    throwError(403, "FORBIDDEN", "Vous ne pouvez modifier que le modèle de votre établissement.");
  }
  validateTemplate(template || {});
  const previous = store.templates[etab] || defaultTemplate(etab);
  const updated = {
    ...clone(template),
    etab,
    version: previous.version + 1,
    createdAt: new Date().toISOString(),
  };
  store.templates[etab] = updated;
  await saveConvention(store);
  return clone(updated);
}

export async function restoreDefaultTemplate(etab = currentEtab()) {
  return defaultTemplate(normalizeEtab(etab));
}

export async function createConventionFromApplication(applicationId) {
  const user = currentUser();
  requireRole(user, "ETU");
  const application = APPLICATIONS.find((item) => item.applicationId === applicationId);
  if (!application) {
    throwError(404, "APPLICATION_NOT_FOUND", "Candidature introuvable.");
  }
  if (application.studentId !== "S1") {
    throwError(403, "FORBIDDEN", "Cette candidature n’appartient pas à votre compte.");
  }
  const store = await readStore();
  if (store.conventions.some((item) => item.applicationId === applicationId)) {
    throwError(409, "CONVENTION_ALREADY_EXISTS", "Une convention existe déjà pour cette candidature.");
  }
  const activeApplication = { ...application, etab: currentEtab(user) };
  const template =
    store.templates[activeApplication.etab] || defaultTemplate(activeApplication.etab);
  const convention = await makeConvention(activeApplication, template, false);
  convention.applicationId = applicationId;
  store.conventions.push(convention);
  await saveConvention(store);
  return clone(convention);
}

export async function saveFields(conventionId, values) {
  const user = currentUser();
  const store = await readStore();
  const convention = findConvention(store, conventionId);
  const party = roleParty(user, convention);
  if (!party) throwError(403, "FORBIDDEN", "Cette convention n’est pas accessible à votre compte.");
  if (convention.frozenHash || !["SUBMITTED", "DRAFT"].includes(convention.state)) {
    throwError(409, "DOCUMENT_FROZEN", "Le document est gelé et ne peut plus être modifié.");
  }
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    throwError(400, "VALIDATION_ERROR", "Les champs transmis sont invalides.", {
      fields: [],
    });
  }
  const fields = templateFields(convention.templateSnapshot);
  const allowedFields = fields.filter(
    (field) => field.source === (party === "STUDENT" ? "STUDENT" : "COMPANY"),
  );
  const allowedKeys = new Set(allowedFields.map((field) => field.key));
  const suppliedKeys = Object.keys(values);
  const forbidden = suppliedKeys.filter((key) => !allowedKeys.has(key));
  if (forbidden.length) {
    throwError(403, "FIELD_NOT_ALLOWED", "Vous ne pouvez modifier que les champs de votre partie.", {
      fields: forbidden,
    });
  }
  const messages = {};
  for (const field of allowedFields) {
    if (!Object.hasOwn(values, field.key)) continue;
    const message = validateField(field, values[field.key]);
    if (message) messages[field.key] = message;
  }
  if (Object.keys(messages).length) {
    throwError(400, "VALIDATION_ERROR", "Certains champs sont invalides.", {
      fields: Object.keys(messages),
      messages,
    });
  }
  for (const key of suppliedKeys) {
    convention.values[key] = String(values[key] ?? "");
  }
  await updateDerived(convention);
  convention.stepSince = new Date().toISOString();
  convention.events.push(
    eventFor(
      convention,
      "FIELDS_UPDATED",
      user.role,
      actorIdFor(user.role, convention, user),
      convention.state,
      convention.state,
      { party, count: suppliedKeys.length },
    ),
  );
  await saveConvention(store);
  return clone(convention);
}

export async function signConvention(conventionId) {
  const user = currentUser();
  const store = await readStore();
  const convention = findConvention(store, conventionId);
  assertVisible(user, convention);
  const expectedRole =
    convention.state === "SUBMITTED"
      ? "ETU"
      : convention.state === "SIGNED_STUDENT"
        ? "ENT"
        : convention.state === "SIGNED_COMPANY"
          ? "RESP"
          : null;
  const actorId = actorIdFor(user.role, convention, user);
  if (
    !expectedRole ||
    user.role !== expectedRole ||
    convention.currentActorId !== actorId
  ) {
    throwError(409, "NOT_YOUR_TURN", "Ce n’est pas votre tour de signer.");
  }
  await updateDerived(convention);
  if (!convention.completion.complete) {
    throwError(409, "DOCUMENT_INCOMPLETE", "La convention doit être complète avant sa signature.", {
      missing: missingRequiredLabels(convention),
    });
  }
  const integrityHash = convention.documentHash;
  if (convention.frozenHash && integrityHash !== convention.frozenHash) {
    throwError(409, "DOCUMENT_CHANGED", "Le document a changé depuis sa première signature.");
  }
  if (convention.documentHash !== integrityHash) {
    convention.documentHash = integrityHash;
  }
  const fromState = convention.state;
  const timestamp = new Date().toISOString();
  if (!convention.frozenHash) {
    convention.frozenHash = integrityHash;
    convention.frozenAt = timestamp;
  }
  convention.signatures.push({
    role: user.role,
    signerId: user.userId,
    signedAt: timestamp,
    hash: convention.frozenHash,
  });
  if (user.role === "ETU") {
    convention.state = "SIGNED_STUDENT";
    convention.currentActorId = convention.companyId;
  } else if (user.role === "ENT") {
    convention.state = "SIGNED_COMPANY";
    convention.currentActorId = `RESP#${convention.etab}`;
  } else {
    convention.state = "APPROVED";
    convention.approvedAt = timestamp;
    convention.noSupervisorEtab = convention.etab;
    delete convention.currentActorId;
  }
  convention.stepSince = timestamp;
  convention.events.push(
    eventFor(
      convention,
      user.role === "RESP" ? "APPROVED" : "SIGNED",
      user.role,
      actorId,
      fromState,
      convention.state,
      { hash: convention.frozenHash },
    ),
  );
  await saveConvention(store);
  return clone(convention);
}

export async function requestModification(conventionId, reason = "") {
  const user = currentUser();
  const store = await readStore();
  const convention = findConvention(store, conventionId);
  const party = roleParty(user, convention);
  if (!["STUDENT", "COMPANY"].includes(party)) {
    throwError(403, "FORBIDDEN", "Seules les parties peuvent demander une modification.");
  }
  if (!convention.frozenHash && convention.state !== "APPROVED") {
    throwError(409, "DOCUMENT_NOT_FROZEN", "La convention doit avoir été signée avant une modification.");
  }
  const fromState = convention.state;
  const oldHash = (convention.frozenHash || convention.documentHash).slice(0, 12);
  const timestamp = new Date().toISOString();
  convention.state = "DRAFT";
  convention.currentActorId = `RESP#${convention.etab}`;
  convention.stepSince = timestamp;
  convention.rejectionReason = null;
  convention.signatures = [];
  convention.frozenHash = null;
  convention.frozenAt = null;
  delete convention.approvedAt;
  delete convention.noSupervisorEtab;
  await updateDerived(convention);
  convention.events.push(
    eventFor(
      convention,
      "MODIFIED",
      user.role,
      actorIdFor(user.role, convention, user),
      fromState,
      "DRAFT",
      // NOT IN API YET: the browser mock stores old and current hashes in history.
      {
        party,
        oldHash,
        newHash: convention.documentHash,
        ...(String(reason || "").trim() ? { reason: String(reason).trim() } : {}),
      },
    ),
  );
  await saveConvention(store);
  return clone(convention);
}

export async function correctConvention(conventionId, { staticValues = {}, articles } = {}) {
  const user = currentUser();
  requireRole(user, "RESP");
  const store = await readStore();
  const convention = findConvention(store, conventionId);
  assertVisible(user, convention);
  if (convention.state !== "DRAFT") {
    throwError(409, "INVALID_STATE", "Seule une convention en brouillon peut être corrigée.");
  }
  const snapshot = clone(convention.templateSnapshot);
  const fields = templateFields(snapshot);
  for (const key of Object.keys(staticValues || {})) {
    const field = fields.find((item) => item.key === key);
    if (!field || field.source !== "STATIC") {
      throwError(403, "FIELD_NOT_ALLOWED", "Seuls les champs statiques peuvent être corrigés.", {
        fields: [key],
      });
    }
    const message = validateField(field, staticValues[key]);
    if (message) {
      throwError(400, "VALIDATION_ERROR", "La valeur statique est invalide.", {
        fields: [key],
        messages: { [key]: message },
      });
    }
    field.value = String(staticValues[key] ?? "");
  }
  if (articles !== undefined) {
    if (!Array.isArray(articles) || articles.some((article) => !String(article?.title || "").trim())) {
      throwError(400, "VALIDATION_ERROR", "Chaque article doit avoir un titre.", {
        fields: ["articles"],
      });
    }
    snapshot.articles = clone(articles);
  }
  convention.templateSnapshot = snapshot;
  await updateDerived(convention);
  convention.stepSince = new Date().toISOString();
  convention.events.push(
    eventFor(
      convention,
      "CORRECTED",
      "RESP",
      actorIdFor("RESP", convention, user),
      "DRAFT",
      "DRAFT",
      // NOT IN API YET: the browser mock stores the corrected document hash in history.
      { hash: convention.documentHash },
    ),
  );
  await saveConvention(store);
  return clone(convention);
}

export async function rejectConvention(conventionId, { reason } = {}) {
  const user = currentUser();
  if (!["ENT", "RESP"].includes(user.role)) {
    throwError(403, "FORBIDDEN", "Cette action n’est pas autorisée pour votre rôle.");
  }
  const normalizedReason = String(reason ?? "").trim();
  if (!normalizedReason || normalizedReason.length > 1000) {
    throwError(400, "VALIDATION_ERROR", "Le motif doit contenir de 1 à 1 000 caractères.", {
      fields: ["reason"],
    });
  }
  const store = await readStore();
  const convention = findConvention(store, conventionId);
  assertVisible(user, convention);
  if (!["SUBMITTED", "SIGNED_STUDENT", "SIGNED_COMPANY"].includes(convention.state)) {
    throwError(409, "INVALID_STATE", "Cette convention ne peut plus être refusée.");
  }
  const fromState = convention.state;
  const timestamp = new Date().toISOString();
  convention.state = "DRAFT";
  convention.currentActorId = `RESP#${convention.etab}`;
  convention.stepSince = timestamp;
  convention.rejectionReason = normalizedReason;
  convention.signatures = [];
  convention.frozenHash = null;
  convention.frozenAt = null;
  delete convention.approvedAt;
  delete convention.noSupervisorEtab;
  await updateDerived(convention);
  convention.events.push(
    eventFor(
      convention,
      "REJECTED",
      "RESP",
      actorIdFor("RESP", convention, user),
      fromState,
      "DRAFT",
      { reason: normalizedReason, hash: convention.documentHash },
    ),
  );
  await saveConvention(store);
  return clone(convention);
}

export async function resubmitConvention(conventionId) {
  const user = currentUser();
  requireRole(user, "RESP");
  const store = await readStore();
  const convention = findConvention(store, conventionId);
  assertVisible(user, convention);
  if (convention.state !== "DRAFT") {
    throwError(409, "INVALID_STATE", "Seule une convention en brouillon peut être renvoyée.");
  }
  if (!convention.completion.complete) {
    throwError(409, "DOCUMENT_INCOMPLETE", "La convention doit être complète avant son renvoi.", {
      missing: missingRequiredLabels(convention),
    });
  }
  const timestamp = new Date().toISOString();
  convention.state = "SUBMITTED";
  convention.currentActorId = convention.studentId;
  convention.stepSince = timestamp;
  convention.rejectionReason = null;
  convention.signatures = [];
  convention.frozenHash = null;
  convention.frozenAt = null;
  await updateDerived(convention);
  convention.events.push(
    eventFor(
      convention,
      "RESUBMITTED",
      "RESP",
      actorIdFor("RESP", convention, user),
      "DRAFT",
      "SUBMITTED",
    ),
  );
  await saveConvention(store);
  return clone(convention);
}

export async function assignConventionSupervisor(conventionId, teacher) {
  const user = currentUser();
  requireRole(user, "RESP");
  const store = await readStore();
  const convention = findConvention(store, conventionId);
  assertVisible(user, convention);
  if (convention.state !== "APPROVED") {
    throwError(409, "INVALID_STATE", "La convention doit être approuvée avant l’affectation d’un encadrant.");
  }
  convention.supervisorId = teacher.userId;
  convention.supervisorName = [teacher.firstName, teacher.lastName]
    .filter(Boolean)
    .join(" ");
  delete convention.noSupervisorEtab;
  await saveConvention(store);
  return clone(convention);
}

export async function verifyIntegrity(convention) {
  if (!convention?.templateSnapshot || !convention.values) return false;
  const actualHash = await sha256Hex(
    canonicalize(buildDocument(convention.templateSnapshot, convention.values)),
  );
  return actualHash === (convention.frozenHash || convention.documentHash);
}

export async function resetMockConventions(scenarioName = "fill") {
  const store = await readStore();
  await resetScenarioInStore(store, scenarioName);
  await writeStore(store);
  return clone(store);
}

if (import.meta.env?.DEV && typeof window !== "undefined") {
  window.__pfeMock = {
    reset: resetMockConventions,
  };
}
