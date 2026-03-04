// src/context/CartContext.js — GoDavaii 2035 HealthOS (Customer-Side)
// ✅ Pharmacy/Chemist concept REMOVED from customer cart flow
// ✅ Single delivery only (no delivery options UI)
// ✅ Cart stores only product info (medicineId, name, price, qty, etc.)
// ✅ No alerts() — silent safe guards
// ✅ localStorage persistence kept

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const CartContext = createContext();

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

function normalizeMedicine(m) {
  const id = m?.medId || m?.medicineId || m?._id || m?.id;
  if (!id) return null;

  return {
    _id: id,
    medicineId: id,

    // product fields
    name: String(m?.name || ""),
    brand: String(m?.brand || ""),
    company: String(m?.company || ""),
    composition: String(m?.composition || m?.compositionKey || ""),
    compositionKey: String(m?.compositionKey || ""),

    packCount: m?.packCount || "",
    packUnit: m?.packUnit || "",

    // numeric pricing
    price: toNum(m?.price ?? m?.sellingPrice ?? m?.salePrice ?? m?.mrp, 0),
    mrp: toNum(m?.mrp, 0),

    img: m?.img || "",
    category: Array.isArray(m?.category) ? m.category : m?.category ? [m.category] : [],
    type: m?.type || "",

    prescriptionRequired: !!m?.prescriptionRequired,
    productKind: m?.productKind || "",

    quantity: toNum(m?.quantity ?? m?.qty, 1),

    // stable cart line id
    lineId: m?.lineId || `${id}`,
  };
}

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("cart");
    return saved ? safeParse(saved, []) : [];
  });

  // Location selectors kept (your existing APIs use these sometimes)
  const [selectedCity, setSelectedCity] = useState(() => {
    if (typeof window === "undefined") return "Delhi";
    return localStorage.getItem("selectedCity") || "Delhi";
  });

  const [selectedArea, setSelectedArea] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("selectedArea") || "";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("selectedCity", selectedCity || "");
  }, [selectedCity]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("selectedArea", selectedArea || "");
  }, [selectedArea]);

  const addToCart = useCallback((medicine) => {
    const nm = normalizeMedicine(medicine);
    if (!nm) return;

    setCart((prev) => {
      const exists = prev.find((x) => x._id === nm._id);
      if (exists) {
        return prev.map((x) =>
          x._id === nm._id ? { ...x, quantity: toNum(x.quantity, 1) + 1 } : x
        );
      }
      return [...prev, { ...nm, quantity: 1 }];
    });
  }, []);

  const removeOneFromCart = useCallback((medicine) => {
    const id = medicine?._id || medicine?.medicineId || medicine?.medId;
    if (!id) return;

    setCart((prev) =>
      prev
        .map((x) => (x._id === id ? { ...x, quantity: toNum(x.quantity, 1) - 1 } : x))
        .filter((x) => toNum(x.quantity, 0) > 0)
    );
  }, []);

  const removeFromCart = useCallback((medicine) => {
    const id = medicine?._id || medicine?.medicineId || medicine?.medId;
    if (!id) return;

    setCart((prev) => prev.filter((x) => x._id !== id));
  }, []);

  const changeQuantity = useCallback((medicine, qty) => {
    const id = medicine?._id || medicine?.medicineId || medicine?.medId;
    if (!id) return;

    const q = Math.max(1, toNum(qty, 1));
    setCart((prev) => prev.map((x) => (x._id === id ? { ...x, quantity: q } : x)));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const clearCartAndStorage = useCallback(() => {
    setCart([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("cart");
    }
  }, []);

  return (
    <CartContext.Provider
      value={{
        cart,
        setCart,

        addToCart,
        removeOneFromCart,
        removeFromCart,
        changeQuantity,
        clearCart,
        clearCartAndStorage,

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