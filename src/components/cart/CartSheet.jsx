import React, { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Loader2 } from "lucide-react";
import CartBody from "./CartBody";
import { useCart } from "../../context/CartContext";

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
  const { cart, setSelectedPharmacy } = useCart();
  const [selectOpen, setSelectOpen] = useState(false);
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-white max-h-[75vh] overflow-hidden rounded-t-2xl">
        <div className="mx-auto w-full max-w-md px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0)+8px)]">
          <SheetHeader className="mb-2">
            <SheetTitle className="text-lg font-black" style={{ color: DEEP }}>
              Cart
            </SheetTitle>
          </SheetHeader>

          <div className="max-h-[65vh] overflow-y-auto pr-1">
            <CartBody
              onChangePharmacy={() => setSelectOpen(true)}
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

        {/* Inline Select Pharmacy dialog */}
        <Dialog open={selectOpen} onOpenChange={setSelectOpen}>
          <DialogContent className="max-w-sm rounded-2xl">
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
                      <span className="font-medium" style={{ color: "#0b3f30" }}>
                        {ph.name}
                      </span>
                      {selectedPharmacy?._id === ph._id && (
                        <Badge className="text-white" style={{ backgroundColor: DEEP }}>
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
      </SheetContent>
    </Sheet>
  );
}
