// src/components/CartPage.js — GoDavaii 2030 Ultra-Futuristic UI
import React, { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import { Loader2, ShoppingBag } from "lucide-react";
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
      <div className="max-w-md mx-auto pt-16 pb-24 px-4 text-center">
        <div style={{
          width: 80, height: 80, borderRadius: 24,
          background: "rgba(0,217,126,0.08)",
          border: "1px solid rgba(0,217,126,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
        }}>
          <ShoppingBag style={{ width: 36, height: 36, color: "#0C5A3E" }} />
        </div>
        <h2 style={{
          fontFamily: "'Sora',sans-serif",
          fontSize: 22, fontWeight: 800,
          background: "linear-gradient(135deg, #0C5A3E, #00D97E)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          marginBottom: 8,
        }}>
          Your cart is empty
        </h2>
        <p style={{ fontSize: 14, color: "#94A3B8", marginBottom: 24 }}>
          Add medicines to get started
        </p>
        <Button
          onClick={() => navigate("/pharmacies-near-you")}
          style={{
            borderRadius: 100, padding: "12px 28px",
            fontWeight: 700, fontSize: 14,
            background: "linear-gradient(135deg, #0C5A3E, #0E7A4F)",
            color: "#fff",
            boxShadow: "0 6px 20px rgba(12,90,62,0.30), 0 0 10px rgba(0,217,126,0.10)",
            fontFamily: "'Sora',sans-serif",
          }}
        >
          Browse Medicines
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-4 mb-24 px-3">
      <h1 style={{
        fontFamily: "'Sora',sans-serif",
        fontSize: 28, fontWeight: 900, letterSpacing: "-0.5px",
        background: "linear-gradient(135deg, #0C5A3E, #00D97E)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        marginBottom: 14,
      }}>
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

      {/* Select pharmacy dialog */}
      <Dialog open={selectDialogOpen} onOpenChange={setSelectDialogOpen}>
        <DialogContent style={{
          maxWidth: 380, borderRadius: 24,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(12,90,62,0.06)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.15)",
        }}>
          <DialogHeader>
            <DialogTitle style={{
              fontFamily: "'Sora',sans-serif", fontWeight: 800,
              fontSize: 18, color: "#0B1F16",
            }}>
              Select a Pharmacy
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2">
            {loadingPharmacies ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: "#94A3B8" }}>
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: "#0C5A3E" }} />
                Loading pharmacies...
              </div>
            ) : pharmacies.length === 0 ? (
              <div className="text-sm" style={{ color: "#94A3B8" }}>No eligible pharmacies found.</div>
            ) : (
              <div className="space-y-2">
                {pharmacies.map((ph) => (
                  <button
                    key={ph._id}
                    onClick={() => handleSelectPharmacy(ph)}
                    style={{
                      width: "100%", textAlign: "left",
                      padding: "12px 14px", borderRadius: 16,
                      border: selectedPharmacy?._id === ph._id
                        ? "1.5px solid rgba(0,217,126,0.3)"
                        : "1px solid rgba(12,90,62,0.08)",
                      background: selectedPharmacy?._id === ph._id
                        ? "rgba(0,217,126,0.04)"
                        : "rgba(255,255,255,0.6)",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    <span style={{ fontWeight: 600, color: "#0B1F16", fontSize: 14 }}>{ph.name}</span>
                    {selectedPharmacy?._id === ph._id && (
                      <Badge style={{
                        background: "linear-gradient(135deg, #0C5A3E, #0E7A4F)",
                        color: "#fff", borderRadius: 100, fontSize: 11,
                      }}>
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
              onClick={() => setSelectDialogOpen(false)}
              style={{
                fontWeight: 600, borderRadius: 100,
                border: "1px solid rgba(12,90,62,0.12)",
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
