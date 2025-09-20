// src/api/suggest.js
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export async function fetchBrandSuggest(q, limit = 10) {
  if (!q || q.trim().length < 2) return [];
  const { data } = await axios.get(`${API_BASE_URL}/api/suggest/brand`, {
    params: { query: q.trim(), limit },
  });
  return Array.isArray(data) ? data : [];
}

export async function fetchCompositionSuggest(q, limit = 10) {
  if (!q || q.trim().length < 2) return [];
  const { data } = await axios.get(`${API_BASE_URL}/api/suggest/composition`, {
    params: { query: q.trim(), limit },
  });
  return Array.isArray(data) ? data : [];
}

export async function fetchPrefillByBrandId(id) {
  if (!id) return {};
  const { data } = await axios.get(`${API_BASE_URL}/api/suggest/prefill`, { params: { brandId: id } });
  return data || {};
}

export async function fetchPrefillByCompositionId(id) {
  if (!id) return {};
  const { data } = await axios.get(`${API_BASE_URL}/api/suggest/prefill`, { params: { compositionId: id } });
  return data || {};
}

export async function postSuggestLearn(payload) {
  try {
    await axios.post(`${API_BASE_URL}/api/suggest/learn`, payload);
  } catch {
    // non-blocking
  }
}
