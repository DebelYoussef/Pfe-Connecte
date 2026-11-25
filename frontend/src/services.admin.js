import { getUser } from "./auth";
import { api } from "./api";

export const REAL = {
  users: true,
  institutions: true,
  departments: true,
  specialties: true,
  notifications: true,
};

const PAGE_LIMIT = 100;
const userPatchFields = [
  "role",
  "etab",
  "firstName",
  "lastName",
  "department",
  "specialty",
  "gouvernorat",
  "companyName",
];
let mockUsers = [];
let mockInstitutions = [];
let mockDepartments = [];
let mockSpecialties = [];

function queryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const result = query.toString();
  return result ? `?${result}` : "";
}

function mockPage(items, { limit = PAGE_LIMIT, cursor } = {}) {
  const start = cursor ? Number(cursor) : 0;
  const pageItems = items.slice(start, start + limit);
  const next = start + limit;
  return {
    items: pageItems,
    nextCursor: next < items.length ? String(next) : null,
  };
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || `mock-${Date.now()}-${Math.random()}`;
}

function notifyAdminDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pfe:admin-data-changed"));
  }
}

function mockUserList({ role, etab, email, limit, cursor } = {}) {
  const users = [...mockUsers];
  const loggedInUser = getUser();
  if (
    loggedInUser?.role === "ADM" &&
    !users.some((user) => user.userId === loggedInUser.userId)
  ) {
    users.unshift(loggedInUser);
  }
  const filtered = users.filter(
    (user) =>
      (!role || user.role === role) &&
      (!etab || user.etab === etab) &&
      (!email || user.email?.toLowerCase() === email.toLowerCase()),
  );
  if (email) return { items: filtered.slice(0, 1), nextCursor: null };
  return mockPage(filtered, { limit: limit || PAGE_LIMIT, cursor });
}

export async function listUsers({
  role,
  etab,
  email,
  limit = PAGE_LIMIT,
  cursor,
} = {}) {
  if (!REAL.users) return mockUserList({ role, etab, email, limit, cursor });
  return api(
    `/v1/admin/users${queryString({ role, etab, email, limit, cursor })}`,
  );
}

export async function createUser(payload) {
  if (!REAL.users) {
    const user = {
      ...payload,
      userId: newId(),
      createdAt: new Date().toISOString(),
    };
    mockUsers = [user, ...mockUsers];
    notifyAdminDataChanged();
    return user;
  }
  const user = await api("/v1/admin/users", { method: "POST", body: payload });
  notifyAdminDataChanged();
  return user;
}

export async function updateUser(id, patch) {
  const safePatch = Object.fromEntries(
    Object.entries(patch).filter(([field]) => userPatchFields.includes(field)),
  );
  if (!REAL.users) {
    let user = mockUsers.find((item) => item.userId === id);
    if (!user && getUser()?.userId === id) {
      user = { ...getUser() };
      mockUsers.push(user);
    }
    if (!user) throw { status: 404, code: "NOT_FOUND", message: "Compte introuvable", details: {} };
    Object.assign(user, safePatch);
    notifyAdminDataChanged();
    return { ...user };
  }
  const user = await api(`/v1/admin/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: safePatch,
  });
  notifyAdminDataChanged();
  return user;
}

export async function listInstitutions({ limit = PAGE_LIMIT, cursor } = {}) {
  if (!REAL.institutions) return mockPage(mockInstitutions, { limit, cursor });
  return api(`/v1/admin/institutions${queryString({ limit, cursor })}`);
}

export async function createInstitution(payload) {
  if (!REAL.institutions) {
    const institution = { id: newId(), ...payload };
    mockInstitutions.push(institution);
    notifyAdminDataChanged();
    return institution;
  }
  const institution = await api("/v1/admin/institutions", {
    method: "POST",
    body: payload,
  });
  notifyAdminDataChanged();
  return institution;
}

export async function updateInstitution(id, patch) {
  if (!REAL.institutions) {
    const institution = mockInstitutions.find((item) => item.id === id);
    if (!institution) throw { status: 404, code: "NOT_FOUND", message: "Établissement introuvable", details: {} };
    Object.assign(institution, { name: patch.name });
    notifyAdminDataChanged();
    return { ...institution };
  }
  const institution = await api(`/v1/admin/institutions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { name: patch.name },
  });
  notifyAdminDataChanged();
  return institution;
}

export async function listDepartments({
  etab,
  limit = PAGE_LIMIT,
  cursor,
} = {}) {
  if (!REAL.departments) {
    return mockPage(
      mockDepartments.filter((item) => !etab || item.etab === etab),
      { limit, cursor },
    );
  }
  return api(`/v1/admin/departments${queryString({ etab, limit, cursor })}`);
}

export async function createDepartment(payload) {
  if (!REAL.departments) {
    const department = { id: `${payload.etab}#${newId()}`, ...payload };
    mockDepartments.push(department);
    notifyAdminDataChanged();
    return department;
  }
  const department = await api("/v1/admin/departments", {
    method: "POST",
    body: payload,
  });
  notifyAdminDataChanged();
  return department;
}

export async function updateDepartment(id, patch) {
  if (!REAL.departments) {
    const department = mockDepartments.find((item) => item.id === id);
    if (!department) throw { status: 404, code: "NOT_FOUND", message: "Département introuvable", details: {} };
    Object.assign(department, { name: patch.name });
    notifyAdminDataChanged();
    return { ...department };
  }
  const department = await api(`/v1/admin/departments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { name: patch.name },
  });
  notifyAdminDataChanged();
  return department;
}

export async function listSpecialties({
  department,
  limit = PAGE_LIMIT,
  cursor,
} = {}) {
  if (!REAL.specialties) {
    return mockPage(
      mockSpecialties.filter(
        (item) => !department || item.department === department,
      ),
      { limit, cursor },
    );
  }
  return api(
    `/v1/admin/specialties${queryString({ department, limit, cursor })}`,
  );
}

export async function createSpecialty(payload) {
  if (!REAL.specialties) {
    const specialty = { id: `${payload.department}#${newId()}`, ...payload };
    mockSpecialties.push(specialty);
    notifyAdminDataChanged();
    return specialty;
  }
  const specialty = await api("/v1/admin/specialties", {
    method: "POST",
    body: payload,
  });
  notifyAdminDataChanged();
  return specialty;
}

export async function updateSpecialty(id, patch) {
  if (!REAL.specialties) {
    const specialty = mockSpecialties.find((item) => item.id === id);
    if (!specialty) throw { status: 404, code: "NOT_FOUND", message: "Spécialité introuvable", details: {} };
    Object.assign(specialty, { name: patch.name });
    notifyAdminDataChanged();
    return { ...specialty };
  }
  const specialty = await api(`/v1/admin/specialties/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { name: patch.name },
  });
  notifyAdminDataChanged();
  return specialty;
}

export async function listAdminNotifications({ limit = 20, cursor } = {}) {
  if (!REAL.notifications) {
    throw {
      status: 0,
      code: "MOCK_MODE",
      message: "Les notifications administrateur réelles sont désactivées.",
      details: {},
    };
  }
  return api(`/v1/notifications${queryString({ limit, cursor })}`);
}

export async function markAdminNotificationRead(id) {
  if (!REAL.notifications) {
    throw {
      status: 0,
      code: "MOCK_MODE",
      message: "Les notifications administrateur réelles sont désactivées.",
      details: {},
    };
  }
  return api(`/v1/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
  });
}

export async function getOverview() {
  if (!REAL.users) {
    const usersByRole = { ETU: 0, ENT: 0, ENS: 0, RESP: 0, ADM: 0 };
    [...mockUsers, getUser()].filter(Boolean).forEach((user) => {
      if (usersByRole[user.role] !== undefined) usersByRole[user.role] += 1;
    });
    return {
      usersByRole,
      recentUsersCount: 0,
      institutionsWithoutResponsable: [],
      departmentsWithoutSpecialty: [],
      conventionsWaitingForMissingResponsable: [],
    };
  }
  return api("/v1/admin/overview");
}

export { PAGE_LIMIT };
