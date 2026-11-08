import { getToken, logout } from "./auth";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const PUBLIC_PATHS = ["/v1/auth/login", "/v1/auth/signup"];

export async function api(path, { method = "GET", body } = {}) {
  const isPublic = PUBLIC_PATHS.includes(path.split("?")[0]);
  const token = getToken();

  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token && !isPublic) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw {
      status: 0,
      code: "NETWORK_ERROR",
      message: "Serveur injoignable",
      details: {},
    };
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && !isPublic) {
      logout();
      window.location.assign("/login");
    }
    const e = data?.error ?? {};
    throw {
      status: res.status,
      code: e.code ?? "HTTP_ERROR",
      message: e.message ?? "Une erreur est survenue",
      details: e.details ?? {},
    };
  }

  return data;
}