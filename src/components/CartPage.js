// src/components/CartPage.js
import React, { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import { Loader2 } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import CartBody from "./cart/CartBody";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export default function CartPage() {
  const { cart, clearCart, selectedPharmacy, setSelectedPharmacy } = useCart();
  const navigate = useNavigate();

  const [selectDialogOpen, setSelectDialogOpen] = useState(false);
  const [pharmacies, setPharmacies] = useState([]);
  const [loadingPharmacies, setLoadingPharmacies] = useState(false);

  const cartPharmacyId =
    typeof selectedPharmacy === "object" ? selectedPharmacy?._id : selectedPharmacy;

  const multiPharmacy = cart.some((item) => {
    const id = typeof item.pharmacy === "object" ? item.pharmacy?._id : item.pharmacy;
    return item.pharmacy && id !== cartPharmacyId;
  });

  useEffect(() => {
    if (!cart.length && selectedPharmacy) setSelectedPharmacy(null);
  }, [cart, selectedPharmacy, setSelectedPharmacy]);

  const fetchEligiblePharmacies = async () => {
    setLoadingPharmacies(true);
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
    setLoadingPharmacies(false);
  };

  useEffect(() => {
    if (selectDialogOpen && cart.length) fetchEligiblePharmacies();
    // eslint-disable-next-line
  }, [selectDialogOpen, cart]);

  const handleChangePharmacy = () => setSelectDialogOpen(true);
  const handleClearCart = () => {
    clearCart();
    setSelectedPharmacy(null);
  };
  const handleCheckout = () => {
    if (!selectedPharmacy || multiPharmacy) return setSelectDialogOpen(true);
    navigate("/checkout");
  };
  const handleSelectPharmacy = (pharmacy) => {
    setSelectedPharmacy(pharmacy);
    setSelectDialogOpen(false);
  };

  if (!cart.length) {
    return (
      <div className="max-w-md mx-auto pt-10 pb-24 px-3 text-center">
        <div className="text-2xl font-extrabold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
          Your cart is empty.
        </div>
        <Button
          className="mt-4 rounded-full px-6 py-5 font-extrabold bg-teal-500 hover:bg-teal-600"
          onClick={() => navigate("/medicines")}
        >
          Browse Medicines
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-4 mb-24 px-3">
      <h1 className="text-3xl font-black mb-3 tracking-wide bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
        Cart
      </h1>

      <CartBody
        onChangePharmacy={handleChangePharmacy}
        onClearCart={handleClearCart}
        onCheckout={handleCheckout}
        selectedPharmacy={selectedPharmacy}
        multiPharmacy={multiPharmacy}
        loadingPharmacies={loadingPharmacies}
        pharmacies={pharmacies}
        openSelectDialog={() => setSelectDialogOpen(true)}
      />

      {/* Select pharmacy dialog (unchanged logic) */}
      <Dialog open={selectDialogOpen} onOpenChange={setSelectDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-extrabold">Select a Pharmacy</DialogTitle>
          </DialogHeader>

          <div className="mt-2">
            {loadingPharmacies ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin text-teal-500" />
                Loading pharmacies…
              </div>
            ) : pharmacies.length === 0 ? (
              <div className="text-sm text-zinc-500">No eligible pharmacies found.</div>
            ) : (
              <div className="space-y-2">
                {pharmacies.map((ph) => (
                  <button
                    key={ph._id}
                    onClick={() => handleSelectPharmacy(ph)}
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
            <Button
              variant="outline"
              onClick={() => setSelectDialogOpen(false)}
              className="font-semibold"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
