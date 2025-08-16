import React, { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Loader2 } from "lucide-react";
import CartBody from "./CartBody";
import { useCart } from "../../context/CartContext";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export default function CartSheet({
  open,
  onOpenChange,
  onClearCart,
  onCheckout,
  selectedPharmacy,
  multiPharmacy,
}) {
  // Inline “Select Pharmacy” dialog that opens on pencil / select button
  const { cart, setSelectedPharmacy } = useCart();
  const [selectOpen, setSelectOpen] = useState(false);
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(false);

  // Same fetch logic you use on the page
  async function fetchEligiblePharmacies() {
    setLoading(true);
    try {
      const medicines = cart.map(m => m._id);
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* No fixed height -> no weird blank area. Grows to content up to 75vh. */}
      <SheetContent
        side="bottom"
        className="bg-white max-h-[75vh] overflow-hidden rounded-t-2xl"
      >
        {/* Center + safe-area padding */}
        <div className="mx-auto w-full max-w-md px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0)+8px)]">
          <SheetHeader className="mb-2">
            <SheetTitle className="text-lg font-black bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
              Cart
            </SheetTitle>
          </SheetHeader>

          {/* Scroll only when needed */}
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            <CartBody
              onChangePharmacy={() => setSelectOpen(true)}  // open inline picker
              onClearCart={onClearCart}
              onCheckout={onCheckout}
              selectedPharmacy={selectedPharmacy}
              multiPharmacy={multiPharmacy}
              loadingPharmacies={loading}
              pharmacies={pharmacies}
              openSelectDialog={() => setSelectOpen(true)}
            />
          </div>
        </div>

        {/* Inline Select Pharmacy dialog (sits over the sheet) */}
        <Dialog open={selectOpen} onOpenChange={setSelectOpen}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-extrabold">Select a Pharmacy</DialogTitle>
            </DialogHeader>

            <div className="mt-2">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin text-teal-500" />
                  Loading pharmacies…
                </div>
              ) : pharmacies.length === 0 ? (
                <div className="text-sm text-zinc-500">No eligible pharmacies found.</div>
              ) : (
                <div className="space-y-2">
                  {pharmacies.map(ph => (
                    <button
                      key={ph._id}
                      onClick={() => {
                        setSelectedPharmacy(ph);
                        setSelectOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg border hover:bg-zinc-50 transition flex items-center justify-between"
                    >
                      <span className="font-medium">{ph.name}</span>
                      {selectedPharmacy?._id === ph._id && (
                        <Badge className="bg-teal-500">Selected</Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="mt-3">
              <Button variant="outline" onClick={() => setSelectOpen(false)} className="font-semibold">
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
