import { getUser } from "./auth";
import { isoWeek, weekEnd } from "./pages/student/parts/weeks";

export const REAL = {
  supervisions: false,
  journals: false,
  reports: false,
  reportPdf: false,
  notifications: false,
};

export const MOCK_SCENARIO = "full";

const delay = 40;
const wait = (value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), delay));

function mockPdfDataUrl(version) {
  const content = `BT /F1 14 Tf 50 750 Td (Rapport PFE - version ${version}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let document = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(document.length);
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const crossReferenceOffset = document.length;
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  document += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${crossReferenceOffset}\n%%EOF`;
  return `data:application/pdf;base64,${btoa(document)}`;
}

function daysAgo(amount, hour = 12) {
  const date = new Date();
  date.setDate(date.getDate() - amount);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function isoDaysAgo(amount, hour = 12) {
  return daysAgo(amount, hour).toISOString();
}

function currentTeacherId() {
  return getUser()?.userId || "teacher-mock-id";
}

const students = [
  {
    studentId: "11111111-1111-4111-8111-111111111101",
    // NOT IN API YET
    studentName: "Étudiant 01",
    // NOT IN API YET
    specialty: "Génie logiciel",
    // NOT IN API YET
    subjectTitle: "Suivi numérique des projets de fin d’études",
    // NOT IN API YET
    companyName: "Atelier Numérique",
    etab: "Institut A",
  },
  {
    studentId: "11111111-1111-4111-8111-111111111102",
    // NOT IN API YET
    studentName: "Étudiant 02",
    // NOT IN API YET
    specialty: "Data et intelligence artificielle",
    // NOT IN API YET
    subjectTitle: "Analyse prédictive des flux logistiques",
    // NOT IN API YET
    companyName: "Logistique Horizon",
    etab: "Institut B",
  },
  {
    studentId: "11111111-1111-4111-8111-111111111103",
    // NOT IN API YET
    studentName: "Étudiant 03",
    // NOT IN API YET
    specialty: "Cybersécurité",
    // NOT IN API YET
    subjectTitle: "Détection des anomalies dans les accès",
    // NOT IN API YET
    companyName: "Sécurité Conseil",
    etab: "Institut A",
  },
  {
    studentId: "11111111-1111-4111-8111-111111111104",
    // NOT IN API YET
    studentName: "Étudiant 04",
    // NOT IN API YET
    specialty: "Systèmes embarqués",
    // NOT IN API YET
    subjectTitle: "Supervision des équipements connectés",
    // NOT IN API YET
    companyName: "Industrie Connectée",
    etab: "Institut B",
  },
  {
    studentId: "11111111-1111-4111-8111-111111111105",
    // NOT IN API YET
    studentName: "Étudiant 05",
    // NOT IN API YET
    specialty: "Génie logiciel",
    // NOT IN API YET
    subjectTitle: "Automatisation du suivi des interventions",
    // NOT IN API YET
    companyName: "Services du Maghreb",
    etab: "Institut A",
  },
  {
    studentId: "11111111-1111-4111-8111-111111111106",
    // NOT IN API YET
    studentName: "Étudiant 06",
    // NOT IN API YET
    specialty: "Réseaux et télécommunications",
    // NOT IN API YET
    subjectTitle: "Optimisation d’un réseau de capteurs",
    // NOT IN API YET
    companyName: "Réseaux Innovants",
    etab: "Institut B",
  },
  {
    studentId: "11111111-1111-4111-8111-111111111107",
    // NOT IN API YET
    studentName: "Étudiant 07",
    // NOT IN API YET
    specialty: "Data et intelligence artificielle",
    // NOT IN API YET
    subjectTitle: "Prévision de la demande énergétique",
    // NOT IN API YET
    companyName: "Énergie Durable",
    etab: "Institut A",
  },
  {
    studentId: "11111111-1111-4111-8111-111111111108",
    // NOT IN API YET
    studentName: "Étudiant 08",
    // NOT IN API YET
    specialty: "Génie logiciel",
    // NOT IN API YET
    subjectTitle: "Modernisation d’un portail interne",
    // NOT IN API YET
    companyName: "Solutions du Nord",
    etab: "Institut B",
  },
];

const supervisionRecords = [
  {
    studentId: students[0].studentId,
    teacherId: "teacher-mock-id",
    status: "ACCEPTED",
    etab: students[0].etab,
    requestedAt: isoDaysAgo(65),
    respondedAt: isoDaysAgo(63),
  },
  {
    studentId: students[1].studentId,
    teacherId: "teacher-mock-id",
    status: "ACCEPTED",
    etab: students[1].etab,
    requestedAt: isoDaysAgo(58),
    respondedAt: isoDaysAgo(56),
  },
  {
    studentId: students[2].studentId,
    teacherId: "teacher-mock-id",
    status: "ASSIGNED",
    etab: students[2].etab,
    requestedAt: isoDaysAgo(52),
    respondedAt: isoDaysAgo(49),
    assignedBy: "22222222-2222-4222-8222-222222222201",
  },
  {
    studentId: students[3].studentId,
    teacherId: "teacher-mock-id",
    status: "ACCEPTED",
    etab: students[3].etab,
    requestedAt: isoDaysAgo(47),
    respondedAt: isoDaysAgo(45),
  },
  {
    studentId: students[4].studentId,
    teacherId: "teacher-mock-id",
    status: "ASSIGNED",
    etab: students[4].etab,
    requestedAt: isoDaysAgo(39),
    respondedAt: isoDaysAgo(35),
    assignedBy: "22222222-2222-4222-8222-222222222201",
  },
  {
    studentId: students[5].studentId,
    teacherId: "teacher-mock-id",
    status: "ACCEPTED",
    etab: students[5].etab,
    requestedAt: isoDaysAgo(31),
    respondedAt: isoDaysAgo(29),
  },
  {
    studentId: students[6].studentId,
    teacherId: "teacher-mock-id",
    status: "REQUESTED",
    etab: students[6].etab,
    requestedAt: isoDaysAgo(1, 10),
  },
  {
    studentId: students[7].studentId,
    teacherId: "teacher-mock-id",
    status: "REQUESTED",
    etab: students[7].etab,
    requestedAt: isoDaysAgo(0, 9),
  },
];

function makeReport(studentIndex, version, status, companyDecision, teacherDecision, days, comments = {}) {
  const student = students[studentIndex];
  return {
    studentId: student.studentId,
    version,
    sha256: `${String(studentIndex + 1).repeat(8)}${String(version).repeat(8)}${"a4b7c9d2".repeat(6)}`,
    status,
    companyId: `33333333-3333-4333-8333-33333333330${studentIndex + 1}`,
    teacherId: "teacher-mock-id",
    companyDecision,
    teacherDecision,
    companyComment: comments.companyComment || "",
    teacherComment: comments.teacherComment || "",
    submittedAt: isoDaysAgo(days),
    // NOT IN API YET
    studentName: student.studentName,
    // NOT IN API YET
    companyName: student.companyName,
    // NOT IN API YET
    reportTitle: student.subjectTitle,
  };
}

const reportRecords = [
  makeReport(1, 1, "CHANGES_REQUESTED", "CHANGES_REQUESTED", "CHANGES_REQUESTED", 35, {
    companyComment: "Préciser le périmètre des essais.",
    teacherComment: "Ajouter une comparaison des résultats.",
  }),
  makeReport(1, 2, "UNDER_REVIEW", "APPROVED", null, 4, {
    companyComment: "Version relue par l’entreprise.",
  }),
  makeReport(2, 1, "CHANGES_REQUESTED", "CHANGES_REQUESTED", null, 8, {
    companyComment: "Décrire plus précisément la méthode de test.",
  }),
  makeReport(3, 1, "VALIDATED", "APPROVED", "APPROVED", 12, {
    companyComment: "Travail conforme aux attentes.",
    teacherComment: "Rapport validé.",
  }),
  makeReport(4, 1, "UNDER_REVIEW", null, null, 2),
  makeReport(5, 1, "CHANGES_REQUESTED", "APPROVED", "CHANGES_REQUESTED", 14, {
    teacherComment: "Compléter l’analyse des limites.",
  }),
];

function makeJournal(studentIndex, daysBack, content, validated, lateByDays = 1, comment = "") {
  const student = students[studentIndex];
  const week = isoWeek(daysAgo(daysBack));
  const end = weekEnd(week);
  const submittedAt = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate() + lateByDays,
    10,
  ).toISOString();
  return {
    studentId: student.studentId,
    week,
    content,
    submittedAt,
    validated,
    validatedAt: validated ? isoDaysAgo(Math.max(0, daysBack - 3)) : undefined,
    comment,
  };
}

const journalRecords = [
  makeJournal(
    0,
    21,
    "Mise en place du modèle de données et définition des premiers parcours de suivi.",
    true,
    1,
    "La progression est conforme au planning.",
  ),
  makeJournal(
    0,
    14,
    "Développement de la première version du tableau de bord et tests des parcours.",
    false,
  ),
  makeJournal(
    1,
    39,
    "Analyse des données disponibles et préparation du pipeline de traitement.",
    false,
    9,
  ),
  makeJournal(
    1,
    21,
    "Comparaison des modèles et documentation des résultats préliminaires.",
    true,
    1,
    "Bonne synthèse des essais réalisés.",
  ),
  makeJournal(
    3,
    18,
    "Configuration de l’environnement de test et vérification des équipements.",
    true,
    1,
    "Les objectifs hebdomadaires sont atteints.",
  ),
  makeJournal(
    4,
    28,
    "Cartographie des interventions et définition du processus d’automatisation.",
    false,
  ),
  makeJournal(
    4,
    14,
    "Prototype du suivi des interventions présenté à l’équipe.",
    false,
  ),
  makeJournal(
    5,
    10,
    "Mesures de latence sur le réseau de capteurs et premiers ajustements.",
    true,
    1,
    "Poursuivre les mesures sur un échantillon plus large.",
  ),
];

function groupByStudent(records) {
  return records.reduce((result, record) => {
    result[record.studentId] ||= [];
    result[record.studentId].push(record);
    return result;
  }, {});
}

function buildNotifications(supervisions, reports, journals) {
  const events = [
    ...supervisions
      .filter((item) => item.status === "REQUESTED")
      .map((item) => ({
        createdAt: item.requestedAt,
        type: "SUPERVISION",
        title: "Nouvelle demande d’encadrement",
        body: "Une demande d’encadrement attend votre réponse.",
        refType: "SUPERVISION",
        refId: item.studentId,
      })),
    ...reports.map((item) => ({
      createdAt: item.submittedAt,
      type: "REPORT",
      title: "Rapport PFE soumis",
      body: "Une nouvelle version d’un rapport est disponible.",
      refType: "REPORT",
      refId: item.studentId,
    })),
    ...journals.map((item) => ({
      createdAt: item.submittedAt,
      type: "JOURNAL",
      title: "Journal de stage mis à jour",
      body: "Une nouvelle entrée de journal est disponible.",
      refType: "JOURNAL",
      refId: item.studentId,
    })),
  ];
  return events
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((item, index) => ({
      id: `teacher-notification-${index + 1}`,
      ...item,
      read: index > 4,
    }));
}

function createStore() {
  let supervisions;
  let reports;
  let journals;

  if (MOCK_SCENARIO === "empty") {
    supervisions = [];
    reports = [];
    journals = [];
  } else if (MOCK_SCENARIO === "pending") {
    supervisions = supervisionRecords.filter(
      (item) => item.status === "REQUESTED",
    );
    reports = [];
    journals = [];
  } else if (MOCK_SCENARIO === "full") {
    supervisions = supervisionRecords.map((item) => ({ ...item }));
    reports = reportRecords.map((item) => ({ ...item }));
    journals = journalRecords.map((item) => ({ ...item }));
  } else {
    throw new Error(`Scénario mock inconnu : ${MOCK_SCENARIO}`);
  }

  return {
    supervisions,
    reportsByStudent: groupByStudent(reports),
    journalsByStudent: groupByStudent(journals),
    notifications: buildNotifications(supervisions, reports, journals),
  };
}

const store = createStore();
const listeners = new Set();
const notifyStoreChanged = () => listeners.forEach((listener) => listener());

function supervisionWithEnrichment(item) {
  const profile = students.find((student) => student.studentId === item.studentId);
  return { ...item, teacherId: currentTeacherId(), ...profile };
}

function forbiddenStudent() {
  return Object.assign(
    new Error("Cet étudiant n’est pas encadré par cet enseignant."),
    { status: 403 },
  );
}

function latestReportFor(studentId) {
  return [...(store.reportsByStudent[studentId] || [])].sort(
    (left, right) => right.version - left.version,
  )[0];
}

export function subscribeToTeacherData(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRequestedSupervisionCount() {
  return store.supervisions.filter((item) => item.status === "REQUESTED").length;
}

export async function listMySupervisions({ status, limit, cursor } = {}) {
  const filtered = store.supervisions
    .filter((item) => !status || item.status === status)
    .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
  const offset = Math.max(0, Number(cursor) || 0);
  const pageSize = Math.max(1, Number(limit) || filtered.length || 1);
  const page = filtered.slice(offset, offset + pageSize);
  return wait({
    items: page.map(supervisionWithEnrichment),
    nextCursor:
      offset + pageSize < filtered.length ? String(offset + pageSize) : null,
  });
}

export async function respondToSupervision(studentId, decision) {
  if (!["ACCEPTED", "DECLINED"].includes(decision)) {
    throw Object.assign(new Error("Décision de supervision invalide."), {
      status: 400,
    });
  }
  const supervision = store.supervisions.find(
    (item) => item.studentId === studentId,
  );
  if (!supervision || supervision.status !== "REQUESTED") {
    throw Object.assign(
      new Error("Cette demande a déjà reçu une réponse."),
      { status: 409 },
    );
  }
  supervision.status = decision;
  supervision.respondedAt = new Date().toISOString();
  notifyStoreChanged();
  return wait(supervisionWithEnrichment(supervision));
}

export async function listStudentJournals(studentId) {
  const supervision = store.supervisions.find(
    (item) =>
      item.studentId === studentId &&
      ["ACCEPTED", "ASSIGNED"].includes(item.status),
  );
  if (!supervision) throw forbiddenStudent();
  const items = [...(store.journalsByStudent[studentId] || [])]
    .sort((left, right) => right.week.localeCompare(left.week))
    .map((item) => ({ ...item }));
  return wait({ items, nextCursor: null });
}

// NOT IN API YET: The teacher API exposes only the reports pending for review.
export async function listStudentReports(studentId) {
  const supervision = store.supervisions.find(
    (item) =>
      item.studentId === studentId &&
      ["ACCEPTED", "ASSIGNED"].includes(item.status),
  );
  if (!supervision) throw forbiddenStudent();
  const items = [...(store.reportsByStudent[studentId] || [])]
    .sort((left, right) => right.version - left.version)
    .map((item) => ({
      ...item,
      teacherId: currentTeacherId(),
    }));
  return wait({ items, nextCursor: null });
}

export async function listTeacherStudents() {
  const { items: supervisions } = await listMySupervisions();
  const supervised = supervisions.filter((item) =>
    ["ACCEPTED", "ASSIGNED"].includes(item.status),
  );
  return Promise.all(
    supervised.map(async (supervision) => {
      const { items: reports } = await listStudentReports(supervision.studentId);
      return {
        ...supervision,
        latestReport: reports[0] || null,
      };
    }),
  );
}

export async function listLatestTeacherReports() {
  const studentsWithReports = await listTeacherStudents();
  return {
    items: studentsWithReports
      .filter((student) => student.latestReport)
      .map((student) => student.latestReport),
    nextCursor: null,
  };
}

export async function reviewReport(studentId, version, { decision, comment = "" }) {
  if (!["APPROVED", "CHANGES_REQUESTED"].includes(decision)) {
    throw Object.assign(new Error("Décision de rapport invalide."), {
      status: 400,
    });
  }
  if (
    decision === "CHANGES_REQUESTED" &&
    (!comment.trim() || comment.length > 2000)
  ) {
    throw Object.assign(
      new Error("Un commentaire de 1 à 2000 caractères est requis."),
      { status: 400 },
    );
  }

  const supervision = store.supervisions.find(
    (item) =>
      item.studentId === studentId &&
      ["ACCEPTED", "ASSIGNED"].includes(item.status),
  );
  if (!supervision) throw forbiddenStudent();
  const latest = latestReportFor(studentId);
  if (!latest || latest.version !== Number(version) || latest.teacherDecision) {
    throw Object.assign(
      new Error("Cette version n’est plus en attente de votre décision."),
      { status: 409 },
    );
  }

  latest.teacherDecision = decision;
  latest.teacherComment = decision === "CHANGES_REQUESTED" ? comment.trim() : "";
  latest.status =
    latest.companyDecision === "CHANGES_REQUESTED" ||
    latest.teacherDecision === "CHANGES_REQUESTED"
      ? "CHANGES_REQUESTED"
      : latest.companyDecision === "APPROVED" &&
          latest.teacherDecision === "APPROVED"
        ? "VALIDATED"
        : "UNDER_REVIEW";
  notifyStoreChanged();
  return wait({ ...latest, teacherId: currentTeacherId() });
}

export async function getReportPdfUrl(studentId, version) {
  const supervision = store.supervisions.find(
    (item) =>
      item.studentId === studentId &&
      ["ACCEPTED", "ASSIGNED"].includes(item.status),
  );
  if (!supervision) throw forbiddenStudent();
  const report = (store.reportsByStudent[studentId] || []).find(
    (item) => item.version === Number(version),
  );
  if (!report) {
    throw Object.assign(new Error("Cette version de rapport est introuvable."), {
      status: 404,
    });
  }
  return wait({
    url: mockPdfDataUrl(Number(version)),
    expiresIn: 300,
  });
}

export async function listTeacherNotifications() {
  const items = store.notifications
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((item) => ({ ...item }));
  return wait({ items, nextCursor: null });
}

export async function markTeacherNotificationRead(id) {
  const item = store.notifications.find((notification) => notification.id === id);
  if (item) item.read = true;
  return wait(item ? { ...item } : undefined);
}
