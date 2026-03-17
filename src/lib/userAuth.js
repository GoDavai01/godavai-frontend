import axios from "axios";

const TOKEN_KEYS = ["token", "authToken", "accessToken", "userToken"];

function normalizeBearerValue(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.startsWith("Bearer ") ? raw.slice("Bearer ".length).trim() : raw;
}

function readStorageToken(storage) {
  if (!storage) return "";
  for (const key of TOKEN_KEYS) {
    try {
      const token = normalizeBearerValue(storage.getItem(key));
      if (token) return token;
    } catch (_) {
      // Ignore storage access issues in restricted browser modes.
    }
  }
  return "";
}

function readCookieToken() {
  if (typeof document === "undefined") return "";
  const cookieText = String(document.cookie || "");
  if (!cookieText) return "";

  for (const key of TOKEN_KEYS) {
    const match = cookieText.match(new RegExp(`(?:^|; )${key}=([^;]+)`));
    const token = normalizeBearerValue(match?.[1] ? decodeURIComponent(match[1]) : "");
    if (token) return token;
  }
  return "";
}

export function getUserAuthToken(explicitToken = "") {
  const directToken = normalizeBearerValue(explicitToken);
  if (directToken) return directToken;

  if (typeof window !== "undefined") {
    const localToken = readStorageToken(window.localStorage);
    if (localToken) return localToken;

    const sessionToken = readStorageToken(window.sessionStorage);
    if (sessionToken) return sessionToken;

    const cookieToken = readCookieToken();
    if (cookieToken) return cookieToken;
  }

  const axiosToken = normalizeBearerValue(
    axios?.defaults?.headers?.common?.Authorization ||
      axios?.defaults?.headers?.common?.authorization ||
      axios?.defaults?.headers?.Authorization ||
      axios?.defaults?.headers?.authorization ||
      ""
  );
  return axiosToken;
}

export function getUserAuthHeaders(explicitToken = "") {
  const token = getUserAuthToken(explicitToken);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
