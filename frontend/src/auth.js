const TOKEN_KEY = "token";
const USER_KEY = "user";

const HOMES = {
  ETU: "/student",
  ENT: "/company",
  ENS: "/teacher",
  RESP: "/responsable",
  ADM: "/admin",
};

export function saveSession({ token, user }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function homeFor(role) {
  return HOMES[role] ?? "/login";
}

function isExpired(token) {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "=")));
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now();
  } catch {
    return false; // undecodable: let the server decide
  }
}

export function isAuthenticated() {
  const token = getToken();
  if (!token || !getUser()) return false;
  if (isExpired(token)) {
    logout();
    return false;
  }
  return true;
}