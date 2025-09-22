// src/cart/CartSheet.jsx
import React, { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Loader2 } from "lucide-react";
import CartBody from "./CartBody";
import { useCart } from "../../context/CartContext";
import GenericSuggestionModal from "../../components/generics/GenericSuggestionModal";
import GenericSaverAtCheckout from "../../components/generics/GenericSaverAtCheckout";
import { buildCompositionKey } from "../../lib/composition";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0f6e51";
const LS_SNOOZE_KEY = "GENERIC_SAVER_SNOOZE_UNTIL";

export default function CartSheet({
  open,
  onOpenChange,
  onClearCart,
  onCheckout,
  selectedPharmacy,
  multiPharmacy,
}) {
  const { cart, setSelectedPharmacy, addToCart, removeFromCart } = useCart();
  const [selectOpen, setSelectOpen] = useState(false);
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(false);

  // ===== Old single-item suggestion (kept for Add flows elsewhere) =====
  const [genericSugg, setGenericSugg] = useState({ open: false, brand: null, generics: [] });
  const isGenericItem = (m) =>
    (m?.productKind === "generic") || !m?.brand || String(m.brand).trim() === "";

  // ===== New multi-line saver at checkout =====
  const [saverOpen, setSaverOpen] = useState(false);

  async function fetchEligiblePharmacies() {
    setLoading(true);
    try {
      const medicines = cart.map((m) => m._id);
      const city = cart[0]?.city || "Delhi";
      const area = "";
      const res = await fetch(`${API_BASE_URL}/api/pharmacies/available-for-cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, area, medicines }),
      });
      const data = await res.json();
      setPharmacies(Array.isArray(data) ? data : []);
    } catch {
      setPharmacies([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (selectOpen && cart.length) fetchEligiblePharmacies();
    // eslint-disable-next-line
  }, [selectOpen, cart]);

  // Build rows for the multi-line saver: each branded cart line + qty
  const saverItems = cart
    .filter((i) => !isGenericItem(i) && buildCompositionKey(i?.composition || ""))
    .map((i) => ({ item: i, qty: i.quantity || 1 }));

  // Resolve pharmacy id for a given item (selected → item’s → any item’s)
  const resolvePharmacyId = (fallbackItem) =>
    selectedPharmacy?._id ||
    fallbackItem?.pharmacy ||
    cart.find((x) => x?.pharmacy)?.pharmacy;

  // Function passed to GenericSaver to fetch alternatives per item
  const fetchAlternativesForItem = async (brandItem) => {
    try {
      const pid = resolvePharmacyId(brandItem);
      if (!pid) return { brand: brandItem, generics: [] };
      const key = buildCompositionKey(brandItem?.composition || "");
      if (!key) return { brand: brandItem, generics: [] };

      const r = await fetch(
        `${API_BASE_URL}/api/pharmacies/${pid}/alternatives?compositionKey=${encodeURIComponent(
          key
        )}&brandId=${brandItem._id}`
      );
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

  // Apply replacement chosen in the saver
  const replaceLineWithGeneric = (brand, generic, qty) => {
    const phId = brand?.pharmacy || resolvePharmacyId(brand);
    const withPharmacy = { ...generic, pharmacy: generic.pharmacy || phId };

    removeFromCart(brand);
    for (let k = 0; k < (qty || 1); k++) addToCart(withPharmacy);
  };

  // Entry-point when user taps PROCEED
  async function handleProceed() {
    // Respect snooze
    const snoozeUntil = Number(localStorage.getItem(LS_SNOOZE_KEY) || 0);
    const snoozed = snoozeUntil && snoozeUntil > Date.now();

    // If nothing to check (no branded items) or snoozed, go straight through
    if (!saverItems.length || snoozed) {
      return onCheckout();
    }

    // Open the multi-line saver; it will auto-proceed if no savings are found.
    setSaverOpen(true);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Use small viewport units so mobile browser UI doesn’t cut content */}
      <SheetContent
        side="bottom"
        className="
          bg-white
          max-h-[90svh]
          h-auto
          overflow-hidden
          rounded-t-2xl
          px-0
        "
      >
        {/* Inner container centers and pads content; width locked to mobile */}
        <div className="mx-auto w-full max-w-md px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0)+8px)]">
          <SheetHeader className="mb-2">
            <SheetTitle className="text-lg font-black" style={{ color: DEEP }}>
              Cart
            </SheetTitle>
          </SheetHeader>

          {/* Scroll area: takes available height inside the sheet */}
          <div className="overflow-y-auto pr-1" style={{ maxHeight: "calc(90svh - 72px)" }}>
            <CartBody
              onChangePharmacy={() => setSelectOpen(true)}
              onClearCart={onClearCart}
              onCheckout={handleProceed}
              selectedPharmacy={selectedPharmacy}
              multiPharmacy={multiPharmacy}
              loadingPharmacies={loading}
              pharmacies={pharmacies}
              openSelectDialog={() => setSelectOpen(true)}
            />
          </div>
        </div>

        {/* Inline Select Pharmacy dialog */}
        <Dialog open={selectOpen} onOpenChange={setSelectOpen}>
          <DialogContent className="max-w-[92vw] sm:max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-extrabold" style={{ color: DEEP }}>
                Select a Pharmacy
              </DialogTitle>
            </DialogHeader>

            <div className="mt-2">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: DEEP }} />
                  Loading pharmacies…
                </div>
              ) : pharmacies.length === 0 ? (
                <div className="text-sm text-zinc-500">No eligible pharmacies found.</div>
              ) : (
                <div className="space-y-2">
                  {pharmacies.map((ph) => (
                    <button
                      key={ph._id}
                      onClick={() => {
                        setSelectedPharmacy(ph);
                        setSelectOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg transition flex items-center justify-between hover:bg-gray-50"
                      style={{ border: "1px solid rgba(15,110,81,0.25)" }}
                    >
                      <span
                        className="font-medium truncate pr-2"
                        style={{ color: "#0b3f30", maxWidth: "70vw" }}
                        title={ph.name}
                      >
                        {ph.name}
                      </span>
                      {selectedPharmacy?._id === ph._id && (
                        <Badge className="text-white shrink-0" style={{ backgroundColor: DEEP }}>
                          Selected
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="mt-3">
              <Button
                variant="outline"
                onClick={() => setSelectOpen(false)}
                className="font-semibold hover:bg-gray-50"
                style={{ borderColor: "rgba(15,110,81,0.40)", color: DEEP }}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Legacy single-item generic suggestion (kept for Add flows that open this sheet) */}
        <GenericSuggestionModal
          open={genericSugg.open}
          onOpenChange={(o) => setGenericSugg((s) => ({ ...s, open: o }))}
          brand={genericSugg.brand}
          generics={genericSugg.generics}
          onReplace={(g) => {
            const qty =
              (cart.find(
                (i) => (i._id || i.id) === (genericSugg.brand?._id || genericSugg.brand?.id)
              )?.quantity) || 1;

            const phId =
              genericSugg.brand?.pharmacy || selectedPharmacy?._id || cart[0]?.pharmacy;
            const withPharmacy = { ...g, pharmacy: g.pharmacy || phId };

            removeFromCart(genericSugg.brand);
            for (let k = 0; k < qty; k++) addToCart(withPharmacy);
            setGenericSugg({ open: false, brand: null, generics: [] });
            onCheckout();
          }}
          onAddAlso={(g) => {
            const phId =
              genericSugg.brand?.pharmacy || selectedPharmacy?._id || cart[0]?.pharmacy;
            const withPharmacy = { ...g, pharmacy: g.pharmacy || phId };

            addToCart(withPharmacy);
            setGenericSugg({ open: false, brand: null, generics: [] });
            onCheckout();
          }}
          onKeep={() => {
            setGenericSugg({ open: false, brand: null, generics: [] });
            onCheckout();
          }}
        />

        {/* New multi-line saver at checkout */}
        <GenericSaverAtCheckout
          open={saverOpen}
          onOpenChange={setSaverOpen}
          items={saverItems}
          fetchAlternatives={fetchAlternativesForItem}
          onReplaceItem={replaceLineWithGeneric}
          onProceed={onCheckout}
          defaultSnoozeDays={7}
        />
      </SheetContent>
    </Sheet>
  );
}
