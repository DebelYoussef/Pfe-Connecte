// NOT IN API YET: Teacher-specific notification examples and read state are in memory.
let teacherNotifications = [
  {
    id: "teacher-2026-11-14#1",
    createdAt: "2026-11-14T09:00:00Z",
    type: "SUPERVISION",
    title: "Nouvelle demande d'encadrement",
    body: "Une nouvelle demande d'encadrement attend votre réponse.",
    refType: "SUPERVISION",
    refId: "request-1",
    read: false,
  },
  {
    id: "teacher-2026-11-13#2",
    createdAt: "2026-11-13T14:00:00Z",
    type: "REPORT",
    title: "Rapport PFE soumis",
    body: "Un étudiant a soumis une nouvelle version de son rapport.",
    refType: "REPORT",
    refId: "report-1",
    read: false,
  },
  {
    id: "teacher-2026-11-12#3",
    createdAt: "2026-11-12T10:00:00Z",
    type: "JOURNAL",
    title: "Journal de stage mis à jour",
    body: "Une nouvelle entrée de journal est disponible.",
    refType: "JOURNAL",
    refId: "student-1",
    read: false,
  },
  {
    id: "teacher-2026-11-10#4",
    createdAt: "2026-11-10T12:00:00Z",
    type: "REMINDER",
    title: "Rappel de suivi",
    body: "Pensez à consulter les dossiers de vos étudiants.",
    refType: "JOURNAL",
    refId: "student-1",
    read: true,
  },
  {
    id: "teacher-2026-11-08#5",
    createdAt: "2026-11-08T09:00:00Z",
    type: "REMINDER",
    title: "Échéance de suivi à venir",
    body: "Une échéance de suivi approche pour un dossier étudiant.",
    refType: "JOURNAL",
    refId: "student-1",
    read: true,
  },
];

const wait = (value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), 40));

export async function listTeacherNotifications() {
  return wait({ items: teacherNotifications, nextCursor: null });
}

export async function markTeacherNotificationRead(id) {
  teacherNotifications = teacherNotifications.map((item) =>
    item.id === id ? { ...item, read: true } : item,
  );
  return wait(teacherNotifications.find((item) => item.id === id));
}
