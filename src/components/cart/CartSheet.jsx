// src/components/cart/CartSheet.jsx — 2035 customer flow (NO pharmacy select, single delivery)
import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import CartBody from "./CartBody";
import { useCart } from "../../context/CartContext";

import GenericSuggestionModal from "../../components/generics/GenericSuggestionModal";
import GenericSaverAtCheckout from "../../components/generics/GenericSaverAtCheckout";
import { buildCompositionKey } from "../../lib/composition";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0f6e51";

export default function CartSheet({ open, onOpenChange, onClearCart, onCheckout }) {
  const { cart, addToCart, removeFromCart } = useCart();

  const [genericSugg, setGenericSugg] = useState({ open: false, brand: null, generics: [] });
  const [saverOpen, setSaverOpen] = useState(false);

  const isGenericItem = (m) =>
    m?.productKind === "generic" || !m?.brand || String(m.brand).trim() === "";

  const saverItems = cart
    .filter((i) => !isGenericItem(i))
    .map((i) => ({ item: i, qty: i.quantity || 1 }));

  // ✅ 2035: global alternatives (NOT pharmacy-based)
  const fetchAlternativesForItem = async (brandItem) => {
    try {
      const keyFromItem = buildCompositionKey(
        brandItem?.composition || brandItem?.compositionKey || ""
      );

      const url =
        `${API_BASE_URL}/api/medicines/alternatives?brandId=${encodeURIComponent(
          brandItem._id
        )}` + (keyFromItem ? `&compositionKey=${encodeURIComponent(keyFromItem)}` : "");

      const r = await fetch(url);
      if (!r.ok) return { brand: brandItem, generics: [] };

      const data = await r.json();
      return {
        brand: data?.brand || brandItem,
        generics: Array.isArray(data?.generics) ? data.generics : [],
      };
    } catch {
      return { brand: brandItem, generics: [] };
    }
  };

  const replaceLineWithGeneric = (brand, generic, qty) => {
    const q = Number(qty || 1);
    removeFromCart(brand);
    for (let k = 0; k < q; k++) addToCart(generic);
  };

  async function handleProceed() {
    const hasBranded = cart.some((i) => !isGenericItem(i));
    if (!hasBranded) return onCheckout();
    setSaverOpen(true);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-white max-h-[90svh] h-auto overflow-hidden rounded-t-2xl px-0"
      >
        <div className="mx-auto w-full max-w-md px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0)+8px)]">
          <SheetHeader className="mb-2">
            <SheetTitle className="text-lg font-black" style={{ color: DEEP }}>
              Cart
            </SheetTitle>
            <div className="text-[12px] font-semibold" style={{ color: "rgba(15,110,81,0.75)" }}>
              Fulfilled by GoDavaii · Single delivery
            </div>
          </SheetHeader>

          <div className="overflow-y-auto pr-1" style={{ maxHeight: "calc(90svh - 90px)" }}>
            <CartBody onClearCart={onClearCart} onCheckout={handleProceed} />
          </div>
        </div>

        {/* Legacy single-item generic suggestion (kept if other flows open it) */}
        <GenericSuggestionModal
          open={genericSugg.open}
          onOpenChange={(o) => setGenericSugg((s) => ({ ...s, open: o }))}
          brand={genericSugg.brand}
          generics={genericSugg.generics}
          onReplace={(g) => {
            const qty =
              (cart.find((i) => (i._id || i.id) === (genericSugg.brand?._id || genericSugg.brand?.id))
                ?.quantity) || 1;

            removeFromCart(genericSugg.brand);
            for (let k = 0; k < qty; k++) addToCart(g);

            setGenericSugg({ open: false, brand: null, generics: [] });
            onCheckout();
          }}
          onAddAlso={(g) => {
            addToCart(g);
            setGenericSugg({ open: false, brand: null, generics: [] });
            onCheckout();
          }}
          onKeep={() => {
            setGenericSugg({ open: false, brand: null, generics: [] });
            onCheckout();
          }}
        />

        {/* Multi-line saver at checkout */}
        <GenericSaverAtCheckout
          open={saverOpen}
          onOpenChange={setSaverOpen}
          items={saverItems}
          fetchAlternatives={fetchAlternativesForItem}
          onReplaceItem={replaceLineWithGeneric}
          onProceed={onCheckout}
        />
      </SheetContent>
    </Sheet>
  );
}