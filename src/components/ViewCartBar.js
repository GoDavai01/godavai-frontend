// src/components/ViewCartBar.js
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { useCart } from "../context/CartContext";
import { Button } from "../components/ui/button";
import CartSheet from "./cart/CartSheet";

const HIDDEN_ROUTES = ["/profile", "/checkout", "/cart"];
const BOTTOM_NAV_HEIGHT = 72;
const GAP_ABOVE_NAV = 8;
const BOTTOM_OFFSET = `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${GAP_ABOVE_NAV}px)`;

export default function ViewCartBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    cart,
    clearCart,
    selectedPharmacy,
    setSelectedPharmacy,
  } = useCart();

  const [open, setOpen] = useState(false);

  const total = cart.reduce((sum, m) => sum + m.price * m.quantity, 0);

  // same multi-pharmacy check as CartPage
  const cartPharmacyId =
    typeof selectedPharmacy === "object" ? selectedPharmacy?._id : selectedPharmacy;
  const multiPharmacy = cart.some((item) => {
    const id = typeof item.pharmacy === "object" ? item.pharmacy?._id : item.pharmacy;
    return item.pharmacy && id !== cartPharmacyId;
  });

  if (HIDDEN_ROUTES.includes(location.pathname) || !cart.length) return null;

  // Handlers used by the sheet (NO flow change)
  const onChangePharmacy = () => {
    // simplest: go to full cart where your select dialog exists
    navigate("/cart");
  };
  const onClearCart = () => {
    clearCart();
    setSelectedPharmacy?.(null);
    setOpen(false);
  };
  const onCheckout = () => {
    if (!selectedPharmacy || multiPharmacy) {
      // keep the same flow: go to the Cart page so user can pick pharmacy
      navigate("/cart");
      return;
    }
    navigate("/checkout");
  };

  return (
    <>
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="fixed left-0 right-0 z-[1200]"
            style={{ bottom: BOTTOM_OFFSET }}
          >
            <div className="mx-auto w-full max-w-[520px] px-3">
              <div className="flex items-center justify-between rounded-2xl px-3 py-3 backdrop-blur-xl bg-white/90 ring-1 ring-emerald-100/60 shadow-[0_-6px_24px_rgba(16,24,40,0.12)]">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="rounded-2xl bg-gradient-to-br from-teal-100 to-emerald-100 p-2">
                      <ShoppingCart className="h-6 w-6 text-teal-700" />
                    </div>
                    <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[11px] font-bold text-white">
                      {cart.length}
                    </span>
                  </div>
                  <div className="leading-tight">
                    <div className="text-[15px] font-extrabold text-teal-800">
                      {cart.length} {cart.length === 1 ? "item" : "items"}
                    </div>
                    <div className="text-sm font-semibold text-emerald-700">₹{total}</div>
                  </div>
                </div>

                <Button
                  size="lg"
                  onClick={() => setOpen(true)}
                  className="rounded-full px-5 font-extrabold tracking-wide bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-[15px] shadow-[0_6px_20px_rgba(16,185,129,0.35)] hover:brightness-105"
                >
                  VIEW CART
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom sheet — now with handlers passed through */}
      <CartSheet
        open={open}
        onOpenChange={setOpen}
        onChangePharmacy={onChangePharmacy}
        onClearCart={onClearCart}
        onCheckout={onCheckout}
        selectedPharmacy={selectedPharmacy}
        multiPharmacy={multiPharmacy}
        loadingPharmacies={false}
        pharmacies={[]}               // you can wire real list later if you want
        openSelectDialog={() => navigate("/cart")}
      />
    </>
  );
}
