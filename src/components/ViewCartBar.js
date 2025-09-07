import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { useCart } from "../context/CartContext";
import { Button } from "../components/ui/button";
import CartSheet from "./cart/CartSheet";

const HIDDEN_ROUTES = ["/profile", "/checkout", "/cart"];

// Also hide on welcome & auth entry points.
// If your welcome route is "/", this covers it. If you use "/welcome", that’s covered too.
const HIDE_EXACT = ["/", "/otp-login", "/login", "/register"];
const HIDE_PREFIXES = ["/welcome"]; // add more prefixes if needed, e.g., "/onboarding"

const BOTTOM_NAV_HEIGHT = 72;
const GAP_ABOVE_NAV = 8;
const BOTTOM_OFFSET = `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${GAP_ABOVE_NAV}px)`;

// Deep-green brand tone
const DEEP = "#0f6e51";

export default function ViewCartBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { cart, clearCart, selectedPharmacy, setSelectedPharmacy } = useCart();

  const [open, setOpen] = useState(false);

  const total = cart.reduce((sum, m) => {
    const price =
      Number(m?.price ?? m?.mrp ?? m?.sellingPrice ?? m?.salePrice ?? 0) || 0;
    const qty = Number(m?.quantity ?? m?.qty ?? 1) || 1;
    return sum + price * qty;
  }, 0);

  const cartPharmacyId =
    typeof selectedPharmacy === "object" ? selectedPharmacy?._id : selectedPharmacy;
  const multiPharmacy = cart.some((item) => {
    const id =
      typeof item.pharmacy === "object" ? item.pharmacy?._id : item.pharmacy;
    return item.pharmacy && id !== cartPharmacyId;
  });

  // Route-based hiding
  const onHiddenRoute =
    HIDDEN_ROUTES.includes(location.pathname) ||
    HIDE_EXACT.includes(location.pathname) ||
    HIDE_PREFIXES.some((p) => location.pathname.startsWith(p));

  // Skin-based hiding (defensive: hide if welcome skin is applied)
  const onWelcomeSkin =
    typeof document !== "undefined" &&
    (document.documentElement.classList.contains("gd-welcome") ||
      document.body.classList.contains("welcome-solid-bg"));

  if (onHiddenRoute || onWelcomeSkin || !cart.length) return null;

  // Handlers used by the sheet (NO flow change)
  const onChangePharmacy = () => navigate("/cart");
  const onClearCart = () => {
    clearCart();
    setSelectedPharmacy?.(null);
    setOpen(false);
  };
  const onCheckout = () => {
    if (!selectedPharmacy || multiPharmacy) {
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
              <div
                className="flex items-center justify-between rounded-2xl px-3 py-3 backdrop-blur-xl bg-white/90 shadow-[0_-6px_24px_rgba(16,24,40,0.12)]"
                style={{ border: "1px solid rgba(15,110,81,0.14)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div
                      className="rounded-2xl p-2"
                      style={{ background: "rgba(15,110,81,0.10)" }}
                    >
                      <ShoppingCart className="h-6 w-6" style={{ color: DEEP }} />
                    </div>
                    <span
                      className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white"
                      style={{ background: DEEP }}
                    >
                      {cart.length}
                    </span>
                  </div>
                  <div className="leading-tight">
                    <div className="text-[15px] font-extrabold" style={{ color: "#0b3f30" }}>
                      {cart.length} {cart.length === 1 ? "item" : "items"}
                    </div>
                    <div className="text-sm font-semibold" style={{ color: DEEP }}>
                      ₹{total}
                    </div>
                  </div>
                </div>

                <Button
                  size="lg"
                  onClick={() => setOpen(true)}
                  className="rounded-full px-5 font-extrabold tracking-wide text-white text-[15px] hover:brightness-105 shadow-lg"
                  style={{ backgroundColor: DEEP }}
                >
                  VIEW CART
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom sheet */}
      <CartSheet
        open={open}
        onOpenChange={setOpen}
        onChangePharmacy={onChangePharmacy}
        onClearCart={onClearCart}
        onCheckout={onCheckout}
        selectedPharmacy={selectedPharmacy}
        multiPharmacy={multiPharmacy}
        loadingPharmacies={false}
        pharmacies={[]}
        openSelectDialog={() => navigate("/cart")}
      />
    </>
  );
}
