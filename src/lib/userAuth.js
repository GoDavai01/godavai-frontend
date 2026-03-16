import axios from "axios";

function normalizeBearerValue(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.startsWith("Bearer ") ? raw.slice("Bearer ".length).trim() : raw;
}

export function getUserAuthToken(explicitToken = "") {
  const directToken = normalizeBearerValue(explicitToken);
  if (directToken) return directToken;

  if (typeof window !== "undefined") {
    const localToken = normalizeBearerValue(window.localStorage?.getItem("token"));
    if (localToken) return localToken;
  }

  const axiosToken = normalizeBearerValue(
    axios?.defaults?.headers?.common?.Authorization ||
      axios?.defaults?.headers?.common?.authorization ||
      ""
  );
  return axiosToken;
}

export function getUserAuthHeaders(explicitToken = "") {
  const token = getUserAuthToken(explicitToken);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
