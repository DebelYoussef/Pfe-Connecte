import { getToken, getUser, saveSession } from "./auth";
import { api } from "./api";

// REAL/MOCK SWITCH. true = real API (src/api.js), false = the previous mock, per group.
// Flip one group back to false if something breaks. Edit it here: the mock state below is built
// once at load time.
const REAL = {
  me: true, // getMe, updateMe
  offers: true, // listOffers, getOffer
  applications: true, // applyToOffer, listMyApplications, actOnApplication (withdraw, decline)
  recommendations: true, // listMyRecommendations
};
// "confirm" stays MOCKED: the conventions backend does not exist yet (the applications Lambda
// answers 400 "confirm is handled by the conventions service"). Set to true once it exists.
const REAL_CONFIRM = false;
export const MOCK_SCENARIO = "supervised";
// NOT IN API YET: workMode on applications (the mock copies it from the offer).
const baseApplication = {
  studentId: "stu-1",
  offerId: "off-1",
  offerTitle: "Développeur Front-end React",
  companyName: "Atelier Digital",
  gouvernorat: "Tunis",
  workMode: "HYBRID",
  status: "IN_PROGRESS",
  createdAt: "2026-11-06",
  updatedAt: "2026-11-07",
};
// NOT IN API YET: studentAddress and studentPhone are mock convention form fields.
const conventionInfoTemplate =
  "Étudiant : {{studentName}}\nAdresse : {{studentAddress}}\nTéléphone : {{studentPhone}}\nE-mail : {{studentEmail}}\nÉtablissement : {{etab}}\nDépartement : {{department}}\nSpécialité : {{specialty}}\n\nEntreprise : {{companyName}}\nOffre : {{offerTitle}}";
const scenarios = {
  new: {
    activeCount: 0,
    applications: [],
    convention: null,
    supervision: null,
    journals: [],
    report: null,
  },
  applying: {
    activeCount: 2,
    applications: [baseApplication],
    convention: null,
    supervision: null,
    journals: [],
    report: null,
  },
  accepted: {
    activeCount: 2,
    applications: [{ ...baseApplication, status: "ACCEPTED" }],
    convention: null,
    supervision: null,
    journals: [],
    report: null,
  },
  signing: {
    activeCount: 1,
    applications: [{ ...baseApplication, status: "CONFIRMED" }],
    convention: {
      conventionId: "conv-1",
      state: "SUBMITTED",
      companyName: "Atelier Digital",
      offerTitle: "Développeur Front-end React",
      etab: "Institut A",
      renderedText:
        "Entre les soussignés, l’entreprise Atelier Digital et l’étudiant, il est convenu ce qui suit pour la réalisation du stage de fin d’études.",
      templateVersion: 3,
      pdfSha256: "a82f7e9d20c14b77f1a",
      shortRef: "PFE-2026-0042",
      currentActorId: "stu-1",
      createdAt: "2026-11-06",
      events: [
        {
          timestamp: "2026-11-06T10:00:00Z",
          type: "SUBMITTED",
          actorRole: "ETU",
          pdfSha256: "a82f7e9d20c14b77f1a",
        },
      ],
    },
    supervision: null,
    journals: [],
    report: null,
  },
  draft: {
    activeCount: 1,
    applications: [{ ...baseApplication, status: "CONFIRMED" }],
    convention: {
      conventionId: "conv-1",
      state: "DRAFT",
      companyName: "Atelier Digital",
      offerTitle: "Développeur Front-end React",
      etab: "Institut A",
      renderedText: "Convention en cours de correction.",
      templateVersion: 3,
      pdfSha256: "a82f7e9d20c14b77f1a",
      shortRef: "PFE-2026-0042",
      currentActorId: "RESP#1",
      rejectionReason: "Le responsable doit corriger une information.",
      createdAt: "2026-11-06",
      events: [
        {
          timestamp: "2026-11-06T10:00:00Z",
          type: "SUBMITTED",
          actorRole: "ETU",
          pdfSha256: "a82f7e9d20c14b77f1a",
        },
        {
          timestamp: "2026-11-07T10:00:00Z",
          type: "REJECTED",
          actorRole: "RESP",
          pdfSha256: "a82f7e9d20c14b77f1a",
          reason: "Le responsable doit corriger une information.",
        },
      ],
    },
    supervision: null,
    journals: [],
    report: null,
  },
  approved: {
    activeCount: 1,
    applications: [{ ...baseApplication, status: "CONFIRMED" }],
    convention: {
      conventionId: "conv-1",
      state: "APPROVED",
      companyName: "Atelier Digital",
      offerTitle: "Développeur Front-end React",
      etab: "Institut A",
      renderedText:
        "La présente convention encadre le stage de fin d’études de l’étudiant.",
      templateVersion: 3,
      pdfSha256: "a82f7e9d20c14b77f1a",
      shortRef: "PFE-2026-0042",
      currentActorId: "RESP#1",
      createdAt: "2026-11-06",
      approvedAt: "2026-11-09",
      events: [
        {
          timestamp: "2026-11-06T10:00:00Z",
          type: "SUBMITTED",
          actorRole: "ETU",
          pdfSha256: "a82f7e9d20c14b77f1a",
        },
        {
          timestamp: "2026-11-07T10:00:00Z",
          type: "SIGNED",
          actorRole: "ETU",
          pdfSha256: "a82f7e9d20c14b77f1a",
        },
        {
          timestamp: "2026-11-09T10:00:00Z",
          type: "APPROVED",
          actorRole: "RESP",
          pdfSha256: "a82f7e9d20c14b77f1a",
        },
      ],
    },
    supervision: null,
    journals: [],
    report: null,
  },
  supervised: {
    activeCount: 1,
    applications: [{ ...baseApplication, status: "CONFIRMED" }],
    convention: {
      conventionId: "conv-1",
      state: "APPROVED",
      companyName: "Atelier Digital",
      offerTitle: "Développeur Front-end React",
      etab: "Institut A",
      renderedText: "La présente convention encadre le stage de fin d’études.",
      templateVersion: 3,
      pdfSha256: "a82f7e9d20c14b77f1a",
      shortRef: "PFE-2026-0042",
      currentActorId: "RESP#1",
      createdAt: "2026-11-06",
      approvedAt: "2026-11-09",
      events: [
        {
          timestamp: "2026-11-06T10:00:00Z",
          type: "SUBMITTED",
          actorRole: "ETU",
          pdfSha256: "a82f7e9d20c14b77f1a",
        },
        {
          timestamp: "2026-11-07T10:00:00Z",
          type: "SIGNED",
          actorRole: "ETU",
          pdfSha256: "a82f7e9d20c14b77f1a",
        },
        {
          timestamp: "2026-11-08T10:00:00Z",
          type: "SIGNED",
          actorRole: "ENT",
          pdfSha256: "a82f7e9d20c14b77f1a",
        },
        {
          timestamp: "2026-11-09T09:00:00Z",
          type: "SIGNED",
          actorRole: "RESP",
          pdfSha256: "a82f7e9d20c14b77f1a",
        },
        {
          timestamp: "2026-11-09T10:00:00Z",
          type: "APPROVED",
          actorRole: "RESP",
          pdfSha256: "a82f7e9d20c14b77f1a",
        },
      ],
    },
    supervision: {
      studentId: "stu-1",
      teacherId: "teacher-1",
      teacherName: "Nadia Mansour",
      firstName: "Nadia",
      lastName: "Mansour",
      expertise: ["react", "web", "pédagogie"],
      etab: "Institut A",
      status: "ASSIGNED",
      requestedAt: "2026-11-08",
    },
    journals: [],
    report: null,
  },
};
scenarios.modified = {
  ...scenarios.supervised,
  convention: {
    ...scenarios.supervised.convention,
    state: "DRAFT",
    studentAddress: "5 avenue du Campus, Tunis",
    studentPhone: "+216 22 456 789",
    currentActorId: "RESP#Institut A",
    rejectionReason: null,
    events: scenarios.supervised.convention.events
      .map((event) =>
        ["SIGNED", "APPROVED"].includes(event.type)
          ? { ...event, invalidated: true }
          : event,
      )
      .concat({
        timestamp: "2026-11-10T12:00:00Z",
        type: "MODIFIED",
        actorRole: "ETU",
        message: "Informations modifiées par l’étudiant",
        oldHash: "a82f7e9d20c1",
        newHash: "e14548ab0298",
      }),
  },
};
// Added: the Rapport page needs a state with a report already submitted.
scenarios.reportReview = {
  ...scenarios.supervised,
  report: { version: 1, status: "UNDER_REVIEW" },
};
const wait = (data) =>
  new Promise((resolve) => setTimeout(() => resolve(data), 260));
// While real applications are on, the student has no internship: every remaining mock (convention,
// supervision, journals, reports, notifications) starts from the "new" scenario so the Convention,
// Encadrant, Journal and Rapport pages show their locked state. With REAL.applications = false,
// MOCK_SCENARIO works exactly as before.
const SCENARIO = REAL.applications ? "new" : MOCK_SCENARIO;
const current = () => scenarios[SCENARIO] || scenarios.applying;
let mockApplications = [...current().applications];
let mockConvention = current().convention;
let mockSupervision = current().supervision;
// NOT IN API YET: profile extras the API does not store yet (kept in memory for the mock).
// bio, contactEmail, avatarUrl, links, cvFileName, cvSize, cvUploadedAt (the API only stores cvKey).
let mockProfileExtras = {
  bio: "",
  contactEmail: "",
  avatarUrl: null,
  links: { linkedin: "", github: "", portfolio: "" },
  cvFileName: null,
  cvSize: null,
  cvUploadedAt: null,
};
let mockCvBlob = null;
async function mockGetMe() {
  // Real fields come from the logged-in user saved at sign-in (src/auth.js).
  const session = getUser() || {};
  return wait({
    userId: "stu-1",
    role: "ETU",
    ...session,
    skills: session.skills || [],
    ...mockProfileExtras,
    links: { ...mockProfileExtras.links },
    activeCount: mockApplications.filter((item) =>
      ["PENDING", "VIEWED", "IN_PROGRESS", "ACCEPTED"].includes(item.status),
    ).length,
  });
}
// NOT IN API YET: the mock offers include workMode until the API exposes it.
const mockOffers = [
  {
    rank: 1,
    offerId: "off-1",
    score: 94,
    offer: {
      offerId: "off-1",
      companyId: "co-1",
      companyName: "Atelier Digital",
      title: "Développeur Front-end React",
      description:
        "Concevez des interfaces utiles et accessibles pour les étudiants et les entreprises.",
      keywords: ["frontend", "web", "accessibilité"],
      skills: ["react", "typescript", "git", "css", "testing"],
      gouvernorat: "Tunis",
      workMode: "HYBRID",
      durationWeeks: 24,
      status: "OPEN",
      createdAt: "2026-11-02",
    },
  },
  {
    rank: 2,
    offerId: "off-2",
    score: 88,
    offer: {
      offerId: "off-2",
      companyId: "co-2",
      companyName: "Data North",
      title: "Data analyst junior",
      description:
        "Transformez les données en décisions au sein d’une équipe produit.",
      keywords: ["data", "analyse", "python"],
      skills: ["python", "sql", "pandas", "power bi", "git"],
      gouvernorat: "Sousse",
      workMode: "REMOTE",
      durationWeeks: 20,
      status: "OPEN",
      createdAt: "2026-10-28",
    },
  },
  {
    rank: 3,
    offerId: "off-3",
    score: 83,
    offer: {
      offerId: "off-3",
      companyId: "co-3",
      companyName: "Systèmes Plus",
      title: "Ingénieur systèmes",
      description:
        "Participez à des projets d’infrastructure fiables et documentés.",
      keywords: ["linux", "cloud", "réseau"],
      skills: ["linux", "aws", "docker", "networking", "git"],
      gouvernorat: "Sfax",
      workMode: "ONSITE",
      durationWeeks: 24,
      status: "OPEN",
      createdAt: "2026-10-21",
    },
  },
];
async function mockListMyRecommendations() {
  return wait({ items: mockOffers, nextCursor: null });
}
async function mockListOffers() {
  return wait({ items: mockOffers.map((item) => item.offer), nextCursor: null });
}
async function mockGetOffer(id) {
  return wait(mockOffers.find((item) => item.offerId === id)?.offer || null);
}
async function mockListMyApplications() {
  return wait({ items: mockApplications, nextCursor: null });
}
async function mockApplyToOffer(id) {
  const offer = mockOffers.find((item) => item.offerId === id)?.offer;
  const item = {
    studentId: "stu-1",
    offerId: id,
    status: "PENDING",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    offerTitle: offer?.title,
    companyName: offer?.companyName,
    gouvernorat: offer?.gouvernorat,
    // NOT IN API YET: workMode.
    workMode: offer?.workMode,
  };
  mockApplications = [...mockApplications, item];
  return wait(item);
}
async function mockActOnApplication(id, action) {
  const status = {
    withdraw: "WITHDRAWN",
    decline: "DECLINED",
    confirm: "CONFIRMED",
  }[action];
  mockApplications = mockApplications.map((item) =>
    item.offerId === id ? { ...item, status } : item,
  );
  return wait(mockApplications.find((item) => item.offerId === id));
}
export async function getConventionTextHash(text) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
function renderConventionText(convention, profile) {
  const base =
    convention.renderedTextTemplate ??
    `${convention.renderedText || ""}\n\n${conventionInfoTemplate}`;
  const values = {
    studentName: [profile.firstName, profile.lastName]
      .filter(Boolean)
      .join(" "),
    studentAddress: convention.studentAddress || "",
    studentPhone: convention.studentPhone || "",
    studentEmail: profile.email || "",
    etab: profile.etab || convention.etab || "",
    department: profile.department || "",
    specialty: profile.specialty || "",
    companyName: convention.companyName || "",
    offerTitle: convention.offerTitle || "",
  };
  return base.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? "").trim();
}
export async function getMyConvention() {
  if (!mockConvention) return wait(null);
  const profile = await getMe();
  mockConvention = {
    ...mockConvention,
    studentAddress:
      mockConvention.studentAddress ?? "12 rue des Jasmins, Tunis",
    studentPhone: mockConvention.studentPhone ?? "+216 22 345 678",
    renderedTextTemplate:
      mockConvention.renderedTextTemplate ??
      `${mockConvention.renderedText || ""}\n\n${conventionInfoTemplate}`,
  };
  const renderedText = renderConventionText(mockConvention, profile);
  if (!/^[a-f0-9]{64}$/i.test(mockConvention.pdfSha256 || "")) {
    const computedHash = await getConventionTextHash(renderedText);
    mockConvention = {
      ...mockConvention,
      pdfSha256: computedHash,
      events: (mockConvention.events || []).map((event) =>
        event.type === "MODIFIED"
          ? { ...event, newHash: computedHash.slice(0, 12) }
          : event,
      ),
    };
  }
  return wait({ ...mockConvention, renderedText });
}
export async function saveConventionStudentInfo(
  fields,
  { allowAfterSignature = false } = {},
) {
  const current = await getMyConvention();
  if (!current)
    throw {
      status: 404,
      code: "NOT_FOUND",
      message: "Convention introuvable",
      details: {},
    };
  const profile = await getMe();
  const nextFields = {
    studentAddress: fields.studentAddress.trim(),
    studentPhone: fields.studentPhone.trim(),
  };
  const renderedText = renderConventionText(
    { ...current, ...nextFields },
    profile,
  );
  const nextHash = await getConventionTextHash(renderedText);
  if (nextHash === current.pdfSha256)
    return { changed: false, convention: current };
  const signedEvents = (current.events || []).filter(
    (event) =>
      !event.invalidated && ["SIGNED", "APPROVED"].includes(event.type),
  );
  const hasSignatures = current.state === "APPROVED" || signedEvents.length > 0;
  if (hasSignatures && !allowAfterSignature)
    throw {
      status: 409,
      code: "CONFLICT",
      message:
        "Une modification est nécessaire pour modifier des informations déjà signées.",
      details: {},
    };
  let events = [...(current.events || [])];
  let nextState = current.state;
  let currentActorId = current.currentActorId;
  if (hasSignatures) {
    events = events.map((event) =>
      ["SIGNED", "APPROVED"].includes(event.type)
        ? { ...event, invalidated: true }
        : event,
    );
    /* NOT IN API YET: MODIFIED is a mock convention history event. */ events.push(
      {
        timestamp: new Date().toISOString(),
        type: "MODIFIED",
        actorRole: "ETU",
        message: "Informations modifiées par l’étudiant",
        oldHash: current.pdfSha256.slice(0, 12),
        newHash: nextHash.slice(0, 12),
      },
    );
    nextState = "DRAFT";
    currentActorId = `RESP#${profile.etab || current.etab}`;
    mockNotifications.push(
      {
        id: `${Date.now()}#convention-company`,
        createdAt: new Date().toISOString(),
        type: "CONVENTION",
        title: "Convention modifiée",
        body: "Les signatures ont été annulées après une modification des informations étudiant.",
        refType: "CONVENTION",
        refId: current.conventionId,
        recipientRole: "ENT",
        recipientId: current.companyId || "co-1",
        read: false,
      },
      {
        id: `${Date.now()}#convention-responsable`,
        createdAt: new Date().toISOString(),
        type: "CONVENTION",
        title: "Convention à renvoyer",
        body: "La convention modifiée attend votre renvoi pour signature.",
        refType: "CONVENTION",
        refId: current.conventionId,
        recipientRole: "RESP",
        recipientId: profile.etab,
        read: false,
      },
    );
  }
  mockConvention = {
    ...mockConvention,
    ...nextFields,
    renderedTextTemplate: current.renderedTextTemplate,
    renderedText,
    pdfSha256: nextHash,
    events,
    state: nextState,
    currentActorId,
    approvedAt: hasSignatures ? null : current.approvedAt,
    rejectionReason: hasSignatures ? null : current.rejectionReason,
  };
  return {
    changed: true,
    signaturesReset: hasSignatures,
    convention: await getMyConvention(),
  };
}
export async function signConvention(id) {
  const current = await getMyConvention();
  if (
    !current ||
    current.conventionId !== id ||
    current.state !== "SUBMITTED" ||
    (current.events || []).some(
      (event) =>
        !event.invalidated &&
        event.type === "SIGNED" &&
        event.actorRole === "ETU",
    )
  )
    throw {
      status: 409,
      code: "CONFLICT",
      message: "La convention ne peut pas être signée à cette étape.",
      details: {},
    };
  mockConvention = {
    ...mockConvention,
    state: "SIGNED_STUDENT",
    currentActorId: "ENT#1",
    events: [
      ...(mockConvention.events || []),
      {
        timestamp: new Date().toISOString(),
        type: "SIGNED",
        actorRole: "ETU",
        pdfSha256: current.pdfSha256,
      },
    ],
  };
  return getMyConvention();
}
export async function getConventionPdfUrl() {
  return wait({ url: "#pdf-convention", expiresIn: 300 });
}
export async function getMySupervision() {
  return wait(mockSupervision);
}
const teacherDirectory = [
  {
    userId: "teacher-1",
    firstName: "Nadia",
    lastName: "Mansour",
    etab: "Institut A",
    expertise: ["react", "web", "pédagogie"],
  },
  {
    userId: "teacher-3",
    firstName: "Salma",
    lastName: "Trabelsi",
    etab: "Institut A",
    expertise: ["python", "data", "sql"],
  },
  {
    userId: "teacher-4",
    firstName: "Fares",
    lastName: "Jaziri",
    etab: "Institut A",
    expertise: ["linux", "cloud", "réseau"],
  },
  {
    userId: "teacher-5",
    firstName: "Leila",
    lastName: "Gharbi",
    etab: "Institut A",
    expertise: ["react", "accessibilité", "design"],
  },
  {
    userId: "teacher-2",
    firstName: "Karim",
    lastName: "Jaziri",
    etab: "Institut B",
    expertise: ["python", "data", "sql"],
  },
];
export async function listTeachers({ etab, cursor } = {}) {
  const matches = teacherDirectory.filter(
    (teacher) => !etab || teacher.etab === etab,
  );
  const offset = Number.parseInt(cursor || "0", 10) || 0;
  const limit = 2;
  return wait({
    items: matches.slice(offset, offset + limit),
    nextCursor: offset + limit < matches.length ? String(offset + limit) : null,
  });
}
export async function requestSupervision(teacherId) {
  const teacher = teacherDirectory.find((item) => item.userId === teacherId);
  if (!teacher)
    throw {
      status: 404,
      code: "NOT_FOUND",
      message: "Cet enseignant n’est plus disponible.",
      details: {},
    };
  mockSupervision = {
    studentId: "stu-1",
    teacherId,
    teacherName: `${teacher.firstName} ${teacher.lastName}`,
    firstName: teacher.firstName,
    lastName: teacher.lastName,
    expertise: teacher.expertise,
    etab: teacher.etab,
    status: "REQUESTED",
    requestedAt: new Date().toISOString(),
  };
  return wait(mockSupervision);
}
let mockJournals = current().journals || [];
let mockReports = current().report
  ? [
      {
        studentId: "stu-1",
        version: current().report.version || 1,
        sha256: "a82f7e9d20c14b77f1a",
        status: current().report.status,
        companyId: "co-1",
        teacherId: "teacher-1",
        companyName: "Atelier Digital",
        teacherName: "Nadia Mansour",
        companyDecision: null,
        teacherDecision: null,
        companyComment: "",
        teacherComment: "",
        submittedAt: "2026-11-08",
      },
    ]
  : [];
export async function listMyJournals() {
  return wait({ items: mockJournals, nextCursor: null });
}
export async function putJournalEntry(week, content) {
  const existing = mockJournals.find((item) => item.week === week);
  if (existing?.validated)
    throw {
      status: 409,
      code: "CONFLICT",
      message: "Cette entrée est déjà validée",
      details: {},
    };
  const item = {
    studentId: "stu-1",
    week,
    content,
    submittedAt: new Date().toISOString(),
    validated: false,
    validatedAt: null,
    comment: null,
  };
  mockJournals = [...mockJournals.filter((entry) => entry.week !== week), item];
  return wait(item);
}
// NOT IN API YET: internship dates. The mock starts five weeks before the current week.
export async function getInternshipPeriod() {
  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 35,
  );
  return wait({ startDate: start.toISOString().slice(0, 10), endDate: null });
}
export async function listMyReports() {
  return wait({ items: mockReports, nextCursor: null });
}
export async function getMyReport() {
  return wait(mockReports[0] || null);
}
export async function createReportUploadUrl() {
  if (
    !mockSupervision ||
    !["ACCEPTED", "ASSIGNED"].includes(mockSupervision.status)
  )
    throw {
      status: 409,
      code: "CONFLICT",
      message: "Un encadrant est requis",
      details: {},
    };
  return wait({
    url: "/mock-upload",
    fields: {},
    key: "reports/report.pdf",
    expiresIn: 300,
  });
}
// Uploaded report files by version (the mock returns the real file in getReportPdfUrl).
const mockReportBlobs = {};
export async function getReportPdfUrl(version) {
  const blob = mockReportBlobs[version];
  return wait({
    url: blob ? URL.createObjectURL(blob) : `#report-version-${version}`,
    expiresIn: 300,
  });
}
export async function submitMockReport() {
  const version = mockReports.length + 1;
  const item = {
    studentId: "stu-1",
    version,
    sha256: "b91c5c4ae81d2f11",
    status: "UNDER_REVIEW",
    companyId: "co-1",
    teacherId: "teacher-1",
    companyName: "Atelier Digital",
    teacherName: "Nadia Mansour",
    companyDecision: null,
    teacherDecision: null,
    companyComment: "",
    teacherComment: "",
    submittedAt: new Date().toISOString(),
  };
  mockReports = [item, ...mockReports];
  return wait(item);
}
const allMockNotifications = [
  {
    id: "2026-11-10#1",
    createdAt: "2026-11-10T09:00:00Z",
    type: "APPLICATION_STATUS",
    title: "Votre candidature a été consultée",
    body: "Atelier Digital a consulté votre candidature.",
    refType: "APPLICATION",
    refId: "off-1",
    read: false,
  },
  {
    id: "2026-11-09#2",
    createdAt: "2026-11-09T14:00:00Z",
    type: "CONVENTION",
    title: "Votre convention est prête",
    body: "Une nouvelle étape de votre convention vous attend.",
    refType: "CONVENTION",
    refId: "conv-1",
    read: false,
  },
  {
    id: "2026-11-08#3",
    createdAt: "2026-11-08T10:00:00Z",
    type: "REMINDER",
    title: "Pensez à compléter votre profil",
    body: "Votre profil peut améliorer vos recommandations.",
    refType: "PROFILE",
    refId: "profile",
    read: false,
  },
  {
    id: "2026-11-07#4",
    createdAt: "2026-11-07T14:00:00Z",
    type: "JOURNAL",
    title: "Votre journal de la semaine est attendu",
    body: "Une entrée hebdomadaire est à compléter.",
    refType: "JOURNAL",
    refId: "2026-W45",
    read: true,
  },
];
// Real applications on: the student has no application nor convention, so only the profile
// reminder stays coherent.
let mockNotifications = REAL.applications
  ? allMockNotifications.filter((item) => item.type === "REMINDER")
  : allMockNotifications;
export async function listNotifications() {
  return wait({ items: mockNotifications, nextCursor: null });
}
export async function markNotificationRead(id) {
  mockNotifications = mockNotifications.map((item) =>
    item.id === id ? { ...item, read: true } : item,
  );
  return wait(mockNotifications.find((item) => item.id === id));
}
const PROFILE_API_FIELDS = [
  "firstName",
  "lastName",
  "department",
  "specialty",
  "skills",
  "gouvernorat",
];
// NOT IN API YET: bio, contactEmail, avatarUrl, links.
const PROFILE_EXTRA_FIELDS = ["bio", "contactEmail", "avatarUrl", "links"];
const pickFields = (source, keys) =>
  Object.fromEntries(
    keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]),
  );
async function mockUpdateMe(partial) {
  const apiFields = pickFields(partial, PROFILE_API_FIELDS);
  const extraFields = pickFields(partial, PROFILE_EXTRA_FIELDS);
  if ("firstName" in apiFields && !String(apiFields.firstName).trim())
    throw {
      status: 400,
      code: "BAD_REQUEST",
      message: "Le prénom est obligatoire.",
      details: {},
    };
  if ("lastName" in apiFields && !String(apiFields.lastName).trim())
    throw {
      status: 400,
      code: "BAD_REQUEST",
      message: "Le nom est obligatoire.",
      details: {},
    };
  // The real PUT /v1/me returns the updated User: keep the saved session in sync with it.
  const token = getToken();
  const session = getUser();
  if (token && session) saveSession({ token, user: { ...session, ...apiFields } });
  mockProfileExtras = { ...mockProfileExtras, ...extraFields };
  return mockGetMe();
}
export async function createCvUploadUrl() {
  return wait({
    url: "/mock-cv-upload",
    fields: {},
    key: "cv/stu-1.pdf",
    expiresIn: 300,
  });
}
// NOT IN API YET: download link for the student's own CV.
export async function getCvDownloadUrl() {
  return wait({
    url: mockCvBlob ? URL.createObjectURL(mockCvBlob) : "#cv",
    expiresIn: 300,
  });
}
// NOT IN API YET: removing the CV.
export async function deleteMyCv() {
  mockCvBlob = null;
  patchProfileExtras({ cvFileName: null, cvSize: null, cvUploadedAt: null });
  return getMe();
}
export async function createAvatarUploadUrl() {
  return wait({
    url: "/mock-avatar-upload",
    fields: {},
    key: "avatar/stu-1.png",
    expiresIn: 300,
  });
}
// Uploads a file to a presigned POST ({ url, fields, key }) and reports progress (0-100).
// Real URLs are sent as multipart/form-data; "/mock-…" URLs are simulated.
export async function uploadToPresignedPost(
  presigned,
  file,
  onProgress = () => {},
) {
  const { url, fields = {}, key = "" } = presigned;
  if (url.startsWith("/mock")) return mockUpload(key, file, onProgress);
  return new Promise((resolve, reject) => {
    const form = new FormData();
    Object.entries(fields).forEach(([name, value]) => form.append(name, value));
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (event) =>
      event.lengthComputable &&
      onProgress(Math.round((event.loaded / event.total) * 100));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve({ key });
      } else
        reject({
          status: xhr.status,
          code: "UPLOAD_FAILED",
          message: "Le fichier n’a pas pu être envoyé.",
          details: {},
        });
    };
    xhr.onerror = () =>
      reject({
        status: 0,
        code: "NETWORK_ERROR",
        message: "Serveur injoignable",
        details: {},
      });
    xhr.send(form);
  });
}
async function sha256Hex(file) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
function mockUpload(key, file, onProgress) {
  return new Promise((resolve) => {
    let progress = 0;
    const timer = setInterval(() => {
      progress = Math.min(100, progress + 20);
      onProgress(progress);
      if (progress < 100) return;
      clearInterval(timer);
      if (key.startsWith("cv/")) {
        mockCvBlob = file;
        // NOT IN API YET: cvFileName, cvSize, cvUploadedAt (the API only stores cvKey).
        patchProfileExtras({
          cvFileName: file.name,
          cvSize: file.size,
          cvUploadedAt: new Date().toISOString(),
        });
      }
      if (key.startsWith("avatar/")) {
        // NOT IN API YET: avatarUrl.
        patchProfileExtras({ avatarUrl: URL.createObjectURL(file) });
      }
      if (key.startsWith("reports/")) {
        // Simulates the S3 event that registers the new version a few seconds later.
        setTimeout(async () => {
          const version =
            Math.max(0, ...mockReports.map((item) => item.version)) + 1;
          mockReportBlobs[version] = file;
          mockReports = [
            {
              studentId: "stu-1",
              version,
              sha256: await sha256Hex(file),
              status: "UNDER_REVIEW",
              companyId: mockConvention?.companyId || "co-1",
              teacherId: mockSupervision?.teacherId || "teacher-1",
              companyName: mockConvention?.companyName || "Atelier Digital",
              teacherName: mockSupervision?.teacherName || "Nadia Mansour",
              companyDecision: null,
              teacherDecision: null,
              companyComment: "",
              teacherComment: "",
              submittedAt: new Date().toISOString(),
            },
            ...mockReports,
          ];
        }, 4000);
      }
      resolve({ key });
    }, 140);
  });
}
export async function getDeadline() {
  return wait({ deadline: "2027-02-15", deadlineEnabled: true });
}

// ============================================================================
// REAL API LAYER (everything the REAL switch at the top controls).
// api() errors ({ status, code, message, details }) are NOT caught here, except when a list row
// is enriched with its offer: a missing offer must not break the whole list.
// ============================================================================
const enc = encodeURIComponent;

// "?a=1&b=2" without empty values. encodeURIComponent keeps spaces as %20 ("Ben Arous"),
// URLSearchParams would send "+".
function qs(params) {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${enc(String(value))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

const sessionExpired = () => ({
  status: 401,
  code: "UNAUTHORIZED",
  message: "Session expirée",
  details: {},
});

// ---- Profile extras ---------------------------------------------------------
// NOT IN API YET: bio, contactEmail, avatarUrl, links, cvFileName, cvSize, cvUploadedAt.
// Stored in localStorage under profile-extras-{userId} and merged back by getMe().
const EXTRA_DEFAULTS = {
  bio: "",
  contactEmail: "",
  avatarUrl: null,
  links: { linkedin: "", github: "", portfolio: "" },
  cvFileName: null,
  cvSize: null,
  cvUploadedAt: null,
};
const EXTRA_KEYS = Object.keys(EXTRA_DEFAULTS);
const extrasKey = (userId) => `profile-extras-${userId}`;
// blob: URLs (mock avatar upload) die on reload: kept in memory only, never persisted.
const volatileExtras = {};

function readStoredExtras(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(extrasKey(userId)));
    return parsed && typeof parsed === "object" ? pickFields(parsed, EXTRA_KEYS) : {};
  } catch {
    return {};
  }
}

function readExtras(userId) {
  const merged = {
    ...EXTRA_DEFAULTS,
    ...readStoredExtras(userId),
    ...volatileExtras[userId],
  };
  merged.links = { ...EXTRA_DEFAULTS.links, ...(merged.links || {}) };
  return merged;
}

function patchExtras(userId, patch) {
  const fields = pickFields(patch, EXTRA_KEYS);
  const stored = readStoredExtras(userId);
  const volatile = { ...volatileExtras[userId] };
  for (const [key, value] of Object.entries(fields)) {
    delete volatile[key];
    if (typeof value === "string" && value.startsWith("blob:")) {
      volatile[key] = value;
      stored[key] = null;
    } else {
      stored[key] = value;
    }
  }
  volatileExtras[userId] = volatile;
  try {
    localStorage.setItem(extrasKey(userId), JSON.stringify(stored));
  } catch {
    // Storage full or blocked: keep the extras in memory for this page load.
    volatileExtras[userId] = { ...volatile, ...fields };
  }
}

// Used by the mocked CV / avatar uploads so they keep working while REAL.me is on.
function patchProfileExtras(patch) {
  if (REAL.me) return patchExtras(getUser()?.userId ?? "unknown", patch);
  mockProfileExtras = { ...mockProfileExtras, ...patch };
}

// Keeps the saved session in sync (sidebar name and avatar). Token unchanged.
function syncSession(real, extras) {
  const token = getToken();
  if (!token) return;
  const session = getUser();
  const next = { ...(session || {}), ...real, avatarUrl: extras.avatarUrl };
  if (JSON.stringify(next) !== JSON.stringify(session)) saveSession({ token, user: next });
}

function buildMe(real) {
  const extras = readExtras(real.userId);
  syncSession(real, extras);
  return {
    ...real,
    skills: real.skills ?? [],
    activeCount: real.activeCount ?? 0,
    ...extras,
  };
}

function assertProfileNames(fields) {
  if ("firstName" in fields && !String(fields.firstName).trim())
    throw {
      status: 400,
      code: "BAD_REQUEST",
      message: "Le prénom est obligatoire.",
      details: {},
    };
  if ("lastName" in fields && !String(fields.lastName).trim())
    throw {
      status: 400,
      code: "BAD_REQUEST",
      message: "Le nom est obligatoire.",
      details: {},
    };
}

async function realGetMe() {
  return buildMe(await api("/v1/me"));
}

async function realUpdateMe(partial = {}) {
  // The contract is additionalProperties: false: only the API fields go to PUT /v1/me.
  const apiFields = pickFields(partial, PROFILE_API_FIELDS);
  const extraFields = pickFields(partial, PROFILE_EXTRA_FIELDS);
  assertProfileNames(apiFields);
  // An empty PUT is a 400 ("No fields to update"): extras-only updates read the profile instead.
  const real = Object.keys(apiFields).length
    ? await api("/v1/me", { method: "PUT", body: apiFields })
    : await api("/v1/me");
  if (Object.keys(extraFields).length) patchExtras(real.userId, extraFields);
  return buildMe(real);
}

// ---- Offers -------------------------------------------------------------------
// The API has no companyName and no workMode on offers.
function adaptOffer(offer) {
  if (!offer) return offer;
  return {
    ...offer,
    companyName: offer.companyName ?? "Entreprise", // NOT IN API YET
    workMode: offer.workMode ?? null, // NOT IN API YET
    keywords: offer.keywords ?? [],
    skills: offer.skills ?? [],
  };
}

// offerId -> Promise of the adapted offer (in memory, for the page lifetime). Failed lookups are
// not kept, so the next call tries again.
const offerCache = new Map();
function fetchOfferCached(offerId) {
  if (!offerCache.has(offerId)) {
    offerCache.set(
      offerId,
      api(`/v1/offers/${enc(offerId)}`).then(adaptOffer, () => {
        offerCache.delete(offerId);
        return null;
      }),
    );
  }
  return offerCache.get(offerId);
}

const fold = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const asList = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const toNum = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

// Client-side filters on the returned page (the API only filters by gouvernorat).
// The accepted names are the usual ones; unknown names are ignored. Adjust the aliases if the
// page uses other names.
function filterOffers(items, f) {
  const text = fold(f.q ?? f.search ?? f.query ?? f.text);
  const skills = asList(f.skills ?? f.skill).map(fold).filter(Boolean);
  const modes = asList(f.workMode ?? f.mode)
    .map((mode) => String(mode).toUpperCase())
    .filter((mode) => mode && mode !== "ALL");
  const exact = toNum(f.durationWeeks ?? f.duration);
  const min = toNum(f.minDuration ?? f.durationMin);
  const max = toNum(f.maxDuration ?? f.durationMax);
  return items.filter((offer) => {
    if (text) {
      const haystack = fold(
        [
          offer.title,
          offer.description,
          offer.companyName,
          offer.gouvernorat,
          ...offer.keywords,
          ...offer.skills,
        ].join(" "),
      );
      if (!haystack.includes(text)) return false;
    }
    if (skills.length) {
      const have = offer.skills.map(fold);
      if (!skills.some((skill) => have.includes(skill))) return false;
    }
    // NOT IN API YET: workMode is null on real offers. An unknown mode is kept, otherwise
    // choosing a mode would empty the list.
    if (modes.length && offer.workMode && !modes.includes(offer.workMode)) return false;
    const weeks = offer.durationWeeks;
    if (exact !== null && weeks !== exact) return false;
    if (min !== null && !(weeks >= min)) return false;
    if (max !== null && !(weeks <= max)) return false;
    return true;
  });
}

async function realListOffers({ gouvernorat, limit, cursor, ...filters } = {}) {
  const res = await api(`/v1/offers${qs({ gouvernorat, limit, cursor })}`);
  const items = (res.items ?? []).map(adaptOffer);
  items.forEach((offer) => offerCache.set(offer.offerId, Promise.resolve(offer)));
  return { items: filterOffers(items, filters), nextCursor: res.nextCursor ?? null };
}

async function realGetOffer(offerId) {
  const offer = adaptOffer(await api(`/v1/offers/${enc(offerId)}`));
  offerCache.set(offerId, Promise.resolve(offer));
  return offer;
}

// ---- Applications ---------------------------------------------------------------
// The API has no offerTitle, companyName, gouvernorat or workMode on applications: they are read
// from the offer. Never throws: an unreadable offer gives "Offre indisponible".
async function enrichApplication(app) {
  const offer = await fetchOfferCached(app.offerId);
  return {
    ...app,
    offerTitle: app.offerTitle ?? offer?.title ?? "Offre indisponible", // NOT IN API YET
    companyName: app.companyName ?? offer?.companyName ?? "Entreprise", // NOT IN API YET
    gouvernorat: app.gouvernorat ?? offer?.gouvernorat ?? null, // NOT IN API YET
    workMode: app.workMode ?? offer?.workMode ?? null, // NOT IN API YET
  };
}

async function realListMyApplications({ limit, cursor } = {}) {
  const res = await api(`/v1/students/me/applications${qs({ limit, cursor })}`);
  return {
    items: await Promise.all((res.items ?? []).map(enrichApplication)),
    nextCursor: res.nextCursor ?? null,
  };
}

// Backend errors reach the page unchanged. 409 codes: ALREADY_APPLIED, APPLICATION_LIMIT,
// OFFER_NOT_OPEN (apply); INVALID_TRANSITION, COUNTER_OUT_OF_SYNC (withdraw, decline).
async function realApplyToOffer(offerId) {
  const res = await api(`/v1/offers/${enc(offerId)}/applications`, { method: "POST" });
  return enrichApplication(res);
}

async function realActOnApplication(offerId, action) {
  const studentId = getUser()?.userId;
  if (!studentId) throw sessionExpired();
  const res = await api(`/v1/applications/${enc(offerId)}/${enc(studentId)}`, {
    method: "PATCH",
    body: { action },
  });
  return enrichApplication(res);
}

// ---- Recommendations ------------------------------------------------------------
// The endpoint is a stub ({ items: [] }, no nextCursor). Items follow the spec: { rank, offerId,
// score, computedAt, offer? }. A missing offer is loaded, a recommendation without readable
// offer is dropped.
async function realListMyRecommendations({ limit, cursor } = {}) {
  const res = await api(`/v1/students/me/recommendations${qs({ limit, cursor })}`);
  const items = await Promise.all(
    (res.items ?? []).map(async (rec) => {
      const offer = rec.offer ? adaptOffer(rec.offer) : await fetchOfferCached(rec.offerId);
      return offer ? { ...rec, offer } : null;
    }),
  );
  return { items: items.filter(Boolean), nextCursor: res.nextCursor ?? null };
}

// ============================================================================
// PUBLIC EXPORTS of the 8 migrated functions: real or mock according to REAL.
// ============================================================================
export async function getMe() {
  return REAL.me ? realGetMe() : mockGetMe();
}

export async function updateMe(partial) {
  return REAL.me ? realUpdateMe(partial) : mockUpdateMe(partial);
}

export async function listOffers(params) {
  return REAL.offers ? realListOffers(params) : mockListOffers();
}

export async function getOffer(id) {
  return REAL.offers ? realGetOffer(id) : mockGetOffer(id);
}

export async function listMyRecommendations(params) {
  return REAL.recommendations
    ? realListMyRecommendations(params)
    : mockListMyRecommendations();
}

export async function listMyApplications(params) {
  return REAL.applications ? realListMyApplications(params) : mockListMyApplications();
}

export async function applyToOffer(id) {
  return REAL.applications ? realApplyToOffer(id) : mockApplyToOffer(id);
}

export async function actOnApplication(id, action) {
  if (!REAL.applications) return mockActOnApplication(id, action);
  if (action === "confirm" && !REAL_CONFIRM) {
    // MOCK (conventions backend missing). The mock list is empty while real applications are on,
    // so answer with a CONFIRMED copy instead of undefined. Nothing changes server-side: the next
    // listMyApplications still returns the real status.
    const mocked = await mockActOnApplication(id, action);
    return (
      mocked ?? {
        studentId: getUser()?.userId,
        offerId: id,
        status: "CONFIRMED",
        updatedAt: new Date().toISOString(),
      }
    );
  }
  return realActOnApplication(id, action);
}