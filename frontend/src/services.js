export const MOCK_SCENARIO = "applying";

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
    applications: [
      {
        studentId: "stu-1",
        offerId: "off-1",
        offerTitle: "Développeur Front-end React",
        companyName: "Atelier Digital",
        status: "IN_PROGRESS",
        createdAt: "2026-11-06",
      },
    ],
    convention: null,
    supervision: null,
    journals: [],
    report: null,
  },
  accepted: {
    activeCount: 2,
    applications: [
      {
        studentId: "stu-1",
        offerId: "off-1",
        offerTitle: "Développeur Front-end React",
        companyName: "Atelier Digital",
        status: "ACCEPTED",
        createdAt: "2026-11-06",
      },
    ],
    convention: null,
    supervision: null,
    journals: [],
    report: null,
  },
  signing: {
    activeCount: 1,
    applications: [
      {
        studentId: "stu-1",
        offerId: "off-1",
        offerTitle: "Développeur Front-end React",
        companyName: "Atelier Digital",
        status: "CONFIRMED",
        createdAt: "2026-11-06",
      },
    ],
    convention: {
      conventionId: "conv-1",
      state: "SIGNED_STUDENT",
      companyName: "Atelier Digital",
    },
    supervision: null,
    journals: [],
    report: null,
  },
  approved: {
    activeCount: 1,
    applications: [
      {
        studentId: "stu-1",
        offerId: "off-1",
        offerTitle: "Développeur Front-end React",
        companyName: "Atelier Digital",
        status: "CONFIRMED",
        createdAt: "2026-11-06",
      },
    ],
    convention: {
      conventionId: "conv-1",
      state: "APPROVED",
      companyName: "Atelier Digital",
    },
    supervision: { teacherName: "", status: "REQUESTED" },
    journals: [{ week: "2026-W45", validated: true }],
    report: { version: 1, status: "UNDER_REVIEW" },
  },
};
const wait = (data) =>
  new Promise((resolve) => setTimeout(() => resolve(data), 260));
const current = () => scenarios[MOCK_SCENARIO] || scenarios.applying;
export async function getMe() {
  const s = current();
  return wait({
    userId: "stu-1",
    firstName: "Amine",
    lastName: "Ben Salah",
    role: "ETU",
    etab: "Institut A",
    department: "Informatique",
    specialty: "Génie logiciel",
    skills: ["react", "typescript"],
    gouvernorat: "Tunis",
    activeCount: s.activeCount,
  });
}
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
      description: "Concevez des interfaces utiles et accessibles.",
      skills: ["react"],
      gouvernorat: "Tunis",
      durationWeeks: 24,
      status: "OPEN",
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
      description: "Transformez les données en décisions.",
      skills: ["python"],
      gouvernorat: "Sousse",
      durationWeeks: 20,
      status: "OPEN",
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
      description: "Participez à des projets d’infrastructure.",
      skills: ["linux"],
      gouvernorat: "Sfax",
      durationWeeks: 24,
      status: "OPEN",
    },
  },
];
export async function listMyRecommendations() {
  return wait({ items: offers, nextCursor: null });
}
export async function listMyApplications() {
  return wait({ items: current().applications, nextCursor: null });
}
export async function getMyConvention() {
  return wait(current().convention);
}
export async function getMySupervision() {
  return wait(current().supervision);
}
export async function listMyJournals() {
  return wait({ items: current().journals, nextCursor: null });
}
export async function getMyReport() {
  return wait(current().report);
}
export async function listNotifications() {
  return wait({
    items: [
      {
        id: "n1",
        createdAt: "2026-11-08T09:00:00Z",
        type: "APPLICATION",
        title: "Votre candidature a été consultée",
        read: false,
      },
      {
        id: "n2",
        createdAt: "2026-11-07T14:00:00Z",
        type: "INFO",
        title: "Une nouvelle offre correspond à votre profil",
        read: false,
      },
      {
        id: "n3",
        createdAt: "2026-11-06T10:00:00Z",
        type: "JOURNAL",
        title: "Votre journal de la semaine est attendu",
        read: true,
      },
    ],
    nextCursor: null,
  });
}
export async function getDeadline() {
  return wait({ deadline: "2027-02-15", deadlineEnabled: true });
}
