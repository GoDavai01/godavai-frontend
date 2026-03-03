// src/context/CartContext.js — GoDavaii 2035 Health OS
// ✅ KEPT: 100% of existing logic (addToCart, removeFromCart, etc.)
// ✅ UPGRADED: alert() for pharmacy conflict → triggers onConflict callback
// ✅ NEW: clearCartAndPharmacy (was already present, now also clears localStorage)
// ✅ NEW: onConflict state for bottom-sheet integration
// ✅ NEW: addToCartForced() — force-add after conflict resolution
// ✅ KEPT: normalizeMedicine, localStorage persistence, all state

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const CartContext = createContext();

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function normalizeMedicine(medicine) {
  return {
    medicineId: medicine.medId || medicine.medicineId || medicine._id,
    pharmacyId:
      medicine.pharmacyId ||
      (typeof medicine.pharmacy === "object"
        ? medicine.pharmacy._id
        : medicine.pharmacy),
    name: medicine.name,
    price: medicine.price,
    quantity: medicine.quantity || 1,
    img: medicine.img || "",
    brand: medicine.brand || "",
    mrp: medicine.mrp || "",
    category: Array.isArray(medicine.category)
      ? medicine.category
      : medicine.category
        ? [medicine.category]
        : [],
    composition: medicine.composition || "",
    company: medicine.company || "",
    type: medicine.type || "",
    packCount: medicine.packCount || "",
    packUnit: medicine.packUnit || "",
    prescriptionRequired: medicine.prescriptionRequired || false,
    productKind: medicine.productKind || "",
    _id: medicine.medId || medicine.medicineId || medicine._id,
  };
}

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("cart");
    return saved ? safeParse(saved, []) : [];
  });

  const [selectedPharmacy, setSelectedPharmacy] = useState(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem("selectedPharmacy");
    return saved ? safeParse(saved, null) : null;
  });

  const [selectedCity, setSelectedCity] = useState(() => {
    if (typeof window === "undefined") return "Delhi";
    return localStorage.getItem("selectedCity") || "Delhi";
  });

  const [selectedArea, setSelectedArea] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("selectedArea") || "";
  });

  // 🆕 2035: Conflict state for bottom-sheet UI instead of alert()
  // When set, a bottom sheet can display: { pendingMedicine, existingPharmacy, newPharmacy }
  const [conflict, setConflict] = useState(null);

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem("selectedPharmacy", JSON.stringify(selectedPharmacy));
  }, [selectedPharmacy]);

  useEffect(() => {
    localStorage.setItem("selectedCity", selectedCity || "");
  }, [selectedCity]);

  useEffect(() => {
    localStorage.setItem("selectedArea", selectedArea || "");
  }, [selectedArea]);

  // ── MAIN LOGIC: Single pharmacy enforcement ──────────────
  const addToCart = useCallback((medicine) => {
    if (
      !medicine ||
      !(medicine._id || medicine.medId || medicine.medicineId) ||
      !(
        medicine.pharmacyId ||
        (medicine.pharmacy &&
          (typeof medicine.pharmacy === "string" ||
            (typeof medicine.pharmacy === "object" && medicine.pharmacy._id)))
      )
    ) {
      // Fallback alert for truly invalid data
      alert("Medicine or pharmacy not specified. Please select a valid medicine with pharmacy.");
      return;
    }

    setCart((prev) => {
      const pharmacyId =
        typeof medicine.pharmacy === "object"
          ? medicine.pharmacy._id
          : medicine.pharmacy;

      if (prev.length === 0) {
        setSelectedPharmacy(
          medicine.pharmacyObj ||
          medicine.pharmacyObject ||
          (typeof medicine.pharmacy === "object" ? medicine.pharmacy : null)
        );
        return [{ ...normalizeMedicine(medicine), quantity: 1 }];
      }

      const cartPharmacyId =
        typeof selectedPharmacy === "object"
          ? selectedPharmacy?._id
          : selectedPharmacy;

      if (cartPharmacyId && pharmacyId && cartPharmacyId !== pharmacyId) {
        // 🆕 2035: Instead of alert(), set conflict state for bottom sheet
        setConflict({
          pendingMedicine: medicine,
          existingPharmacyId: cartPharmacyId,
          newPharmacyId: pharmacyId,
        });
        return prev; // Don't add — wait for user decision
      }

      // Check if medicine already in cart
      const exists = prev.find((item) => item._id === medicine._id);
      if (exists) {
        return prev.map((item) =>
          item._id === medicine._id
            ? { ...normalizeMedicine(item), quantity: item.quantity + 1 }
            : item
        );
      }

      return [...prev, { ...normalizeMedicine(medicine), quantity: 1 }];
    });
  }, [selectedPharmacy]);

  // 🆕 2035: Force-add after user confirms "Switch & Add" in bottom sheet
  const addToCartForced = useCallback((medicine) => {
    setCart([]);
    setSelectedPharmacy(
      medicine.pharmacyObj ||
      medicine.pharmacyObject ||
      (typeof medicine.pharmacy === "object" ? medicine.pharmacy : null)
    );
    setCart([{ ...normalizeMedicine(medicine), quantity: 1 }]);
    setConflict(null);
  }, []);

  // 🆕 2035: Dismiss conflict (user chose "Keep current cart")
  const dismissConflict = useCallback(() => {
    setConflict(null);
  }, []);

  const removeOneFromCart = useCallback((medicine) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item._id === medicine._id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const removeFromCart = useCallback((medicine) => {
    setCart((prev) => prev.filter((item) => item._id !== medicine._id));
  }, []);

  const changeQuantity = useCallback((medicine, qty) => {
    setCart((prev) =>
      prev.map((item) =>
        item._id === medicine._id
          ? { ...item, quantity: Math.max(1, qty) }
          : item
      )
    );
  }, []);

  const clearCartAndPharmacy = useCallback(() => {
    setCart([]);
    setSelectedPharmacy(null);
    setConflict(null);
    localStorage.removeItem("cart");
    localStorage.removeItem("selectedPharmacy");
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setConflict(null);
  }, []);

  return (
    <CartContext.Provider
      value={{
        cart,
        setCart,
        selectedPharmacy,
        setSelectedPharmacy,
        addToCart,
        addToCartForced,       // 🆕 2035
        removeFromCart,
        changeQuantity,
        clearCart,
        removeOneFromCart,
        clearCartAndPharmacy,
        conflict,              // 🆕 2035: { pendingMedicine, existingPharmacyId, newPharmacyId } | null
        dismissConflict,       // 🆕 2035
        selectedCity,
        setSelectedCity,
        selectedArea,
        setSelectedArea,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);