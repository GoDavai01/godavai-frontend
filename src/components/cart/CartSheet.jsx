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
import { buildCompositionKey } from "../../lib/composition";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0f6e51";

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

  // ===== Generic suggestion state =====
  const [genericSugg, setGenericSugg] = useState({ open: false, brand: null, generics: [] });
  const isGenericItem = (m) =>
    (m?.productKind === "generic") || !m?.brand || String(m.brand).trim() === "";

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

  // ✅ More robust: always check generics for ANY branded line (qty 1 or 10)
  //    and resolve pharmacy id defensively.
  async function checkGenericsBeforeCheckout() {
    try {
      if (!cart.length) return onCheckout();

      // Find any branded item with a valid normalized composition
      const branded = cart.find(
        (i) => !isGenericItem(i) && buildCompositionKey(i?.composition || "")
      );
      if (!branded) return onCheckout();

      // Resolve pharmacy id (selected → item’s → any item’s)
      const pid =
        selectedPharmacy?._id ||
        branded?.pharmacy ||
        cart.find((x) => x?.pharmacy)?.pharmacy;

      if (!pid) return onCheckout();

      const key = buildCompositionKey(branded.composition || "");
      const r = await fetch(
        `${API_BASE_URL}/api/pharmacies/${pid}/alternatives?compositionKey=${encodeURIComponent(
          key
        )}&brandId=${branded._id}`
      );

      if (!r.ok) return onCheckout();

      const data = await r.json();
      if (Array.isArray(data?.generics) && data.generics.length) {
        setGenericSugg({ open: true, brand: data.brand || branded, generics: data.generics });
        return; // stop; modal decides next
      }
    } catch {
      // ignore and continue
    }
    onCheckout(); // no alternatives → proceed
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
          <div className="overflow-y-auto pr-1"
               style={{ maxHeight: "calc(90svh - 72px)" }}>
            <CartBody
              onChangePharmacy={() => setSelectOpen(true)}
              onClearCart={onClearCart}
              onCheckout={checkGenericsBeforeCheckout}
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

        {/* Generic suggestion modal (same-component portal dialog) */}
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

            // ✅ ensure pharmacy is set on the generic we add
            const phId = genericSugg.brand?.pharmacy || selectedPharmacy?._id || cart[0]?.pharmacy;
            const withPharmacy = { ...g, pharmacy: g.pharmacy || phId };

            removeFromCart(genericSugg.brand);
            for (let k = 0; k < qty; k++) addToCart(withPharmacy);
            setGenericSugg({ open: false, brand: null, generics: [] });
            onCheckout(); // continue after choice
          }}
          onAddAlso={(g) => {
            const phId = genericSugg.brand?.pharmacy || selectedPharmacy?._id || cart[0]?.pharmacy;
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
      </SheetContent>
    </Sheet>
  );
}
