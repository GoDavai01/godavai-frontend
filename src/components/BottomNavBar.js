// src/components/BottomNavBar.js — GoDavaii 2035 Health OS
// ✅ FIXED DUPLICACY: Removed Profile & Search — they live in Navbar
// ✅ NEW: 5-tab: Home, Medicines, AI (center hero), Doctor, Lab Test
// ✅ AI center tab — elevated, glow animation, stands out
// ✅ KEPT: Spring physics, haptics, memo, burst animation
// ─────────────────────────────────────────────────────────
// WHY: Navbar already has Location + Profile + Search bar
//       → bottom bar has ZERO overlap now

import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { Home, Pill, Sparkles, Stethoscope, FlaskConical } from "lucide-react";

const DEEP = "#0C5A3E";
const MID = "#0E7A4F";
const ACC = "#00D97E";

const navs = [
  { label: "Home",      path: "/home",      icon: Home,         isCenter: false },
  { label: "Medicines", path: "/all-medicines", icon: Pill,      isCenter: false },
  { label: "AI",        path: "/ai",        icon: Sparkles,     isCenter: true  },
  { label: "Doctor",    path: "/doctors",   icon: Stethoscope,  isCenter: false },
  { label: "Lab Test",  path: "/search?tab=labs", icon: FlaskConical, isCenter: false },
];

function BottomNavBarImpl() {
  const navigate = useNavigate();
  const location = useLocation();
  const shouldReduce = useReducedMotion();

  const activeIdx = (() => {
    if (location.pathname.startsWith("/search")) {
      const tab = new URLSearchParams(location.search).get("tab");
      if (tab === "doctors") return 3;
      if (tab === "labs") return 4;
      return 1;
    }
    if (location.pathname.startsWith("/doctors")) return 3;
    const idx = navs.findIndex((n) => location.pathname.startsWith(n.path));
    if (idx >= 0) return idx;
    if (location.pathname.startsWith("/medicines")) return 1;
    if (location.pathname.startsWith("/all-medicines")) return 1;
    if (location.pathname.startsWith("/pharmacies")) return 1;
    return 0;
  })();

  const [burstIdx, setBurstIdx] = useState(null);
  const spring = { type: "spring", stiffness: 520, damping: 34, mass: 0.55 };

  return (
    <div
      style={{
        position: "fixed",
        insetInline: 0,
        bottom: 0,
        zIndex: 1201,
        maxWidth: 520,
        margin: "0 auto",
        width: "100%",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderTop: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 -8px 32px -8px rgba(0,0,0,0.28)",
          paddingBottom: "max(0.6rem, env(safe-area-inset-bottom))",
          background: `linear-gradient(160deg, ${DEEP} 0%, #083D28 100%)`,
        }}
      >
        {/* Top accent line */}
        <div
          style={{
            position: "absolute", top: 0, left: "10%", right: "10%",
            height: 1,
            background: `linear-gradient(90deg, transparent, ${ACC}40, transparent)`,
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", padding: "6px 6px 2px" }}>
          <div
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 2,
            }}
          >
            {navs.map((item, idx) => {
              const Icon = item.icon;
              const active = idx === activeIdx;
              const isCenter = item.isCenter;

              return (
                <button
                  key={item.label}
                  onClick={() => {
                    if (window?.navigator?.vibrate) navigator.vibrate(8);
                    setBurstIdx(idx);
                    navigate(item.path);
                  }}
                  style={{
                    position: "relative",
                    isolation: "isolate",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: isCenter ? 56 : 52,
                    borderRadius: isCenter ? 20 : 16,
                    color: "#fff",
                    fontWeight: 800,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    outline: "none",
                    padding: 0,
                    marginTop: isCenter ? -8 : 0,
                  }}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                >
                  {/* Active pill — non-center tabs */}
                  {active && !isCenter && (
                    <LazyMotion features={domAnimation}>
                      <m.span
                        layoutId="gd-neo-pill"
                        transition={spring}
                        style={{
                          position: "absolute", inset: 0, zIndex: -1,
                          borderRadius: 16,
                          background: "rgba(255,255,255,0.12)",
                          border: "1px solid rgba(255,255,255,0.18)",
                          backdropFilter: "blur(2px)",
                        }}
                      />
                    </LazyMotion>
                  )}

                  {/* Center AI tab — elevated bg */}
                  {isCenter && (
                    <div
                      style={{
                        position: "absolute", inset: -2, zIndex: -1,
                        borderRadius: 20,
                        background: active
                          ? `linear-gradient(135deg, ${ACC}, #00E5FF)`
                          : `linear-gradient(135deg, ${MID}, ${DEEP})`,
                        border: active
                          ? `2px solid ${ACC}`
                          : "2px solid rgba(255,255,255,0.15)",
                        boxShadow: active
                          ? `0 4px 20px ${ACC}60, 0 0 30px ${ACC}25`
                          : "0 4px 12px rgba(0,0,0,0.25)",
                        transition: "all 0.3s ease",
                      }}
                    />
                  )}

                  {/* AI glow pulse */}
                  {isCenter && active && (
                    <div
                      style={{
                        position: "absolute", inset: -6, zIndex: -2,
                        borderRadius: 24,
                        background: `radial-gradient(circle at center, ${ACC}30 0%, transparent 70%)`,
                        animation: "gdAIGlow 2s ease-in-out infinite",
                        pointerEvents: "none",
                      }}
                    />
                  )}

                  {/* Click burst */}
                  {burstIdx === idx && !shouldReduce && (
                    <LazyMotion features={domAnimation}>
                      <m.span
                        key={`burst-${idx}-${location.pathname}`}
                        initial={{ opacity: 0.45, scale: 0.2 }}
                        animate={{ opacity: 0, scale: 1.6 }}
                        transition={{ duration: 0.45, ease: "easeOut" }}
                        onAnimationComplete={() => setBurstIdx(null)}
                        style={{
                          position: "absolute",
                          left: "50%", top: "50%",
                          width: 40, height: 40,
                          transform: "translate(-50%, -50%)",
                          borderRadius: "50%",
                          pointerEvents: "none", zIndex: -1,
                          background: "radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)",
                        }}
                      />
                    </LazyMotion>
                  )}

                  <Icon
                    style={{
                      width: isCenter ? 22 : 19,
                      height: isCenter ? 22 : 19,
                      marginBottom: 2,
                      transition: "transform 0.2s",
                      transform: active ? "scale(1.08)" : "scale(1)",
                      filter: active
                        ? isCenter
                          ? "drop-shadow(0 2px 8px rgba(0,0,0,0.3))"
                          : "drop-shadow(0 3px 12px rgba(255,255,255,0.55))"
                        : "none",
                      color: isCenter && active ? DEEP : "#fff",
                    }}
                  />
                  <span
                    style={{
                      fontSize: isCenter ? 10 : 10.5,
                      lineHeight: 1.2,
                      fontFamily: "'Sora', sans-serif",
                      fontWeight: active ? 800 : 600,
                      opacity: active ? 1 : 0.7,
                      color: isCenter && active ? DEEP : "#fff",
                      letterSpacing: "-0.1px",
                    }}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes gdAIGlow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

const BottomNavBar = React.memo(BottomNavBarImpl);
export default BottomNavBar;
