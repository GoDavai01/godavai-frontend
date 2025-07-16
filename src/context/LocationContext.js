// src/contexts/LocationContext.js
import React, { createContext, useContext, useState, useEffect } from "react";

const LocationContext = createContext();

export function LocationProvider({ children }) {
  // On mount, read from localStorage
  const [currentAddress, setCurrentAddress] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("currentAddress")) || null;
    } catch {
      return null;
    }
  });

  // Sync changes to localStorage
  useEffect(() => {
    if (currentAddress) {
      localStorage.setItem("currentAddress", JSON.stringify(currentAddress));
    } else {
      localStorage.removeItem("currentAddress");
    }
    // eslint-disable-next-line
  }, [currentAddress]);

  // Listen for external updates (cross-tab, or manually)
  useEffect(() => {
    function handleStorage(e) {
      if (e.key === "currentAddress") {
        try {
          setCurrentAddress(JSON.parse(e.newValue) || null);
        } catch {
          setCurrentAddress(null);
        }
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Optionally, add a clear function
  const clearCurrentAddress = () => setCurrentAddress(null);

  return (
    <LocationContext.Provider value={{ currentAddress, setCurrentAddress, clearCurrentAddress }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  return useContext(LocationContext);
}
