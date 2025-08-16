// src/contexts/LocationContext.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "currentAddress";
const LocationContext = createContext();

/** Safe JSON parse that never throws */
function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Read from localStorage safely (SSR friendly) */
function readStoredAddress() {
  if (typeof window === "undefined") return null;
  return safeParse(window.localStorage.getItem(STORAGE_KEY)) || null;
}

export function LocationProvider({ children }) {
  // Initial read on mount
  const [currentAddress, setCurrentAddress] = useState(() => readStoredAddress());

  // Sync changes to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (currentAddress) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentAddress));
      } catch {
        // ignore quota/serialization errors
      }
    } else {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }, [currentAddress]);

  // Listen for cross-tab updates to the same key
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

  // Same API as before
  const clearCurrentAddress = () => setCurrentAddress(null);

  // Memoize context value to avoid needless renders
  const value = useMemo(
    () => ({ currentAddress, setCurrentAddress, clearCurrentAddress }),
    [currentAddress]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  return useContext(LocationContext);
}
