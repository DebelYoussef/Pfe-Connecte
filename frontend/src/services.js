import { getToken, getUser, saveSession } from "./auth";
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
const current = () => scenarios[MOCK_SCENARIO] || scenarios.applying;
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
export async function getMe() {
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
const offers = [
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
export async function listMyRecommendations() {
  return wait({ items: offers, nextCursor: null });
}
export async function listOffers() {
  return wait({ items: offers.map((item) => item.offer), nextCursor: null });
}
export async function getOffer(id) {
  return wait(offers.find((item) => item.offerId === id)?.offer || null);
}
export async function listMyApplications() {
  return wait({ items: mockApplications, nextCursor: null });
}
export async function applyToOffer(id) {
  const offer = offers.find((item) => item.offerId === id)?.offer;
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
export async function actOnApplication(id, action) {
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
let mockNotifications = [
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
export async function updateMe(partial) {
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
  return getMe();
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
  mockProfileExtras = {
    ...mockProfileExtras,
    cvFileName: null,
    cvSize: null,
    cvUploadedAt: null,
  };
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
        mockProfileExtras = {
          ...mockProfileExtras,
          cvFileName: file.name,
          cvSize: file.size,
          cvUploadedAt: new Date().toISOString(),
        };
      }
      if (key.startsWith("avatar/")) {
        // NOT IN API YET: avatarUrl.
        mockProfileExtras = {
          ...mockProfileExtras,
          avatarUrl: URL.createObjectURL(file),
        };
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