import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { useCart } from "../context/CartContext";
import { Button } from "../components/ui/button";
import CartSheet from "./cart/CartSheet";

const HIDDEN_ROUTES = ["/profile", "/checkout", "/cart"];

// Also hide on welcome & auth entry points.
const HIDE_EXACT = ["/", "/otp-login", "/login", "/register"];
const HIDE_PREFIXES = ["/welcome"];

const BOTTOM_NAV_HEIGHT = 80; // slightly more for floating island
const GAP_ABOVE_NAV = 8;
const BOTTOM_OFFSET = `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px) + ${GAP_ABOVE_NAV}px)`;

const DEEP = "#0C5A3E";
const ACCENT = "#00D97E";

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

  // Skin-based hiding
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
            <div className="mx-auto w-full max-w-[520px] px-4">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderRadius: 20,
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.88)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  border: "1px solid rgba(12,90,62,0.08)",
                  boxShadow:
                    "0 12px 40px rgba(0,0,0,0.12), " +
                    "0 0 0 1px rgba(0,217,126,0.04), " +
                    "inset 0 1px 0 rgba(255,255,255,0.5)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        borderRadius: 14,
                        padding: 10,
                        background: `linear-gradient(135deg, ${DEEP}12, ${ACCENT}08)`,
                        border: "1px solid rgba(0,217,126,0.08)",
                      }}
                    >
                      <ShoppingCart style={{ width: 22, height: 22, color: DEEP }} />
                    </div>
                    <span
                      style={{
                        position: "absolute", right: -4, top: -4,
                        display: "inline-flex",
                        height: 20, minWidth: 20,
                        alignItems: "center", justifyContent: "center",
                        borderRadius: 100, paddingLeft: 4, paddingRight: 4,
                        fontSize: 11, fontWeight: 700, color: "#fff",
                        background: `linear-gradient(135deg, ${DEEP}, #0E7A4F)`,
                        boxShadow: "0 2px 8px rgba(12,90,62,0.30)",
                        border: "1.5px solid #fff",
                      }}
                    >
                      {cart.length}
                    </span>
                  </div>
                  <div style={{ lineHeight: 1.3 }}>
                    <div style={{
                      fontSize: 15, fontWeight: 800, color: "#0B1F16",
                      fontFamily: "'Sora',sans-serif",
                    }}>
                      {cart.length} {cart.length === 1 ? "item" : "items"}
                    </div>
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: DEEP,
                      fontFamily: "'Sora',sans-serif",
                    }}>
                      ₹{total}
                    </div>
                  </div>
                </div>

                <Button
                  size="lg"
                  onClick={() => setOpen(true)}
                  style={{
                    borderRadius: 100,
                    paddingLeft: 22, paddingRight: 22,
                    fontWeight: 700, fontSize: 14,
                    letterSpacing: "0.3px",
                    color: "#fff",
                    background: `linear-gradient(135deg, ${DEEP}, #0E7A4F)`,
                    boxShadow: "0 6px 20px rgba(12,90,62,0.30), 0 0 10px rgba(0,217,126,0.10)",
                    border: "none",
                    position: "relative", overflow: "hidden",
                    fontFamily: "'Sora',sans-serif",
                  }}
                >
                  <span style={{
                    position: "absolute", inset: 0, borderRadius: "inherit",
                    background: "linear-gradient(135deg, rgba(255,255,255,0.12), transparent 60%)",
                    pointerEvents: "none",
                  }} />
                  <span style={{ position: "relative", zIndex: 1 }}>VIEW CART</span>
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
