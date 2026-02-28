// src/contexts/LocationContext.js — GoDavaii 2030
// ✅ ALL EXISTING API UNCHANGED (currentAddress, setCurrentAddress, clearCurrentAddress)
// ✅ NEW: Auto-detects GPS on first app open if no stored address
// ✅ NEW: isDetecting, locationError, refreshLocation exposed in context
// ✅ NEW: Cross-tab sync, SSR-safe, permission handling

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

const STORAGE_KEY = "currentAddress";
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const LocationContext = createContext();

/** Safe JSON parse that never throws */
function safeParse(json) {
  try { return JSON.parse(json); } catch { return null; }
}

/** Read from localStorage safely (SSR friendly) */
function readStoredAddress() {
  if (typeof window === "undefined") return null;
  return safeParse(window.localStorage.getItem(STORAGE_KEY)) || null;
}

/** Reverse geocode lat/lng → formatted address via backend */
async function reverseGeocode(lat, lng) {
  const res = await axios.get(`${API_BASE_URL}/api/geocode?lat=${lat}&lng=${lng}`);
  const place = res.data?.results?.[0];
  if (!place) throw new Error("No results from geocode");
  return {
    formatted: place.formatted_address,
    lat,
    lng,
    place_id: place.place_id || null,
    autoDetected: true,
  };
}

// ─────────────────────────────────────────────────────────────
export function LocationProvider({ children }) {
  const [currentAddress, setCurrentAddress] = useState(() => readStoredAddress());
  const [isDetecting, setIsDetecting]       = useState(false);
  const [locationError, setLocationError]   = useState(null); // null | "denied" | "unavailable" | "timeout"
  const [permissionState, setPermissionState] = useState(null); // "granted"|"denied"|"prompt"|null

  const autoDetectAttempted = useRef(false);

  // ── Persist to localStorage whenever address changes ────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (currentAddress) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentAddress));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch { /* quota / serialization errors — ignore */ }
  }, [currentAddress]);

  // ── Cross-tab sync ───────────────────────────────────────────
  useEffect(() => {
    function handleStorage(e) {
      if (e.key !== STORAGE_KEY) return;
      setCurrentAddress(safeParse(e.newValue) || null);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorage);
      return () => window.removeEventListener("storage", handleStorage);
    }
  }, []);

  // ── Check permission state (Permissions API) ─────────────────
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    navigator.permissions.query({ name: "geolocation" })
      .then((result) => {
        setPermissionState(result.state);
        result.addEventListener("change", () => setPermissionState(result.state));
      })
      .catch(() => {});
  }, []);

  // ── Core detect function (exposed in context) ────────────────
  const refreshLocation = React.useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator?.geolocation) {
        setLocationError("unavailable");
        reject(new Error("Geolocation not supported"));
        return;
      }
      setIsDetecting(true);
      setLocationError(null);

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const addr = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
            setCurrentAddress(addr);
            setLocationError(null);
            setPermissionState("granted");
            resolve(addr);
          } catch {
            // Reverse geocode failed — still store coords with fallback label
            const fallback = {
              formatted: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              place_id: null,
              autoDetected: true,
            };
            setCurrentAddress(fallback);
            resolve(fallback);
          } finally {
            setIsDetecting(false);
          }
        },
        (err) => {
          setIsDetecting(false);
          const errType =
            err.code === 1 ? "denied" :
            err.code === 2 ? "unavailable" :
            err.code === 3 ? "timeout" : "unavailable";
          setLocationError(errType);
          setPermissionState(err.code === 1 ? "denied" : permissionState);
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-detect on first mount IF no stored address ──────────
  useEffect(() => {
    if (autoDetectAttempted.current) return;
    autoDetectAttempted.current = true;

    const stored = readStoredAddress();
    if (stored?.lat && stored?.lng) return; // already have location — skip

    // Only auto-detect if permission is already "granted" OR we haven't asked yet ("prompt")
    // Never auto-ask if "denied"
    const tryAutoDetect = async () => {
      // Check permission first if API available
      if (navigator?.permissions) {
        try {
          const result = await navigator.permissions.query({ name: "geolocation" });
          if (result.state === "denied") return; // don't bother
          if (result.state === "granted") {
            // Silently auto-detect (no prompt needed)
            await refreshLocation();
            return;
          }
          // state === "prompt" — auto-trigger so browser shows permission dialog on first open
          // This is the key UX: app asks for location right away, just like Swiggy/Blinkit
          await refreshLocation();
        } catch {
          // Permissions API failed, try anyway
          try { await refreshLocation(); } catch {}
        }
      } else {
        // No Permissions API — try anyway (browser will show dialog)
        try { await refreshLocation(); } catch {}
      }
    };

    // Small delay so app renders first, THEN location dialog appears (better UX)
    const timer = setTimeout(tryAutoDetect, 800);
    return () => clearTimeout(timer);
  }, [refreshLocation]);

  // ── Backward-compatible clearCurrentAddress ──────────────────
  const clearCurrentAddress = React.useCallback(() => {
    setCurrentAddress(null);
    setLocationError(null);
  }, []);

  // ── Context value (all existing keys + new ones) ─────────────
  const value = useMemo(() => ({
    // ── EXISTING API (unchanged) ──
    currentAddress,
    setCurrentAddress,
    clearCurrentAddress,
    // ── NEW additions ──
    isDetecting,
    locationError,        // null | "denied" | "unavailable" | "timeout"
    permissionState,      // "granted" | "denied" | "prompt" | null
    refreshLocation,      // call to re-detect GPS
  }), [currentAddress, isDetecting, locationError, permissionState, refreshLocation, clearCurrentAddress]);

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  return useContext(LocationContext);
}