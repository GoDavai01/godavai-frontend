// src/components/BottomNavBar.js — GoDavaii 2035 Premium Health OS
// ✅ Same routes/logic
// ✅ Cleaner premium bottom bar
// ✅ AI center tab still highlighted, but more refined
// ✅ Tone matched with GoDavaii AI / Home

import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { Home, Pill, Sparkles, Stethoscope, FlaskConical } from "lucide-react";

const DEEP = "#0A5A3B";
const MID = "#0F7A53";
const ACC = "#18E2A1";

const navs = [
  { label: "Home", path: "/home", icon: Home, isCenter: false },
  { label: "Medicines", path: "/all-medicines", icon: Pill, isCenter: false },
  { label: "AI", path: "/ai", icon: Sparkles, isCenter: true },
  { label: "Doctor", path: "/doctors", icon: Stethoscope, isCenter: false },
  { label: "Lab Test", path: "/lab-tests", icon: FlaskConical, isCenter: false },
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
    if (location.pathname.startsWith("/lab-tests")) return 4;
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
          borderTop: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 -12px 30px -10px rgba(0,0,0,0.24)",
          paddingBottom: "max(0.6rem, env(safe-area-inset-bottom))",
          background: `linear-gradient(160deg, ${DEEP} 0%, #083D28 65%, ${MID} 100%)`,
          backdropFilter: "blur(16px)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "10%",
            right: "10%",
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(24,226,161,0.30), transparent)",
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
                  {active && !isCenter && (
                    <LazyMotion features={domAnimation}>
                      <m.span
                        layoutId="gd-neo-pill"
                        transition={spring}
                        style={{
                          position: "absolute",
                          inset: 0,
                          zIndex: -1,
                          borderRadius: 16,
                          background: "rgba(255,255,255,0.10)",
                          border: "1px solid rgba(255,255,255,0.14)",
                          backdropFilter: "blur(2px)",
                        }}
                      />
                    </LazyMotion>
                  )}

                  {isCenter && (
                    <div
                      style={{
                        position: "absolute",
                        inset: -2,
                        zIndex: -1,
                        borderRadius: 20,
                        background: active ? "linear-gradient(135deg, #CFFFF0, #18E2A1)" : "linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
                        border: active ? "2px solid rgba(255,255,255,0.40)" : "1.5px solid rgba(255,255,255,0.12)",
                        boxShadow: active ? "0 10px 24px rgba(24,226,161,0.22)" : "0 4px 12px rgba(0,0,0,0.22)",
                        transition: "all 0.3s ease",
                      }}
                    />
                  )}

                  {isCenter && active && (
                    <div
                      style={{
                        position: "absolute",
                        inset: -6,
                        zIndex: -2,
                        borderRadius: 24,
                        background: "radial-gradient(circle at center, rgba(24,226,161,0.22) 0%, transparent 70%)",
                        animation: "gdAIGlow 2s ease-in-out infinite",
                        pointerEvents: "none",
                      }}
                    />
                  )}

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
                          left: "50%",
                          top: "50%",
                          width: 40,
                          height: 40,
                          transform: "translate(-50%, -50%)",
                          borderRadius: "50%",
                          pointerEvents: "none",
                          zIndex: -1,
                          background: "radial-gradient(circle, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0) 70%)",
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
                      transform: active ? "scale(1.06)" : "scale(1)",
                      filter: active && !isCenter ? "drop-shadow(0 3px 12px rgba(255,255,255,0.25))" : "none",
                      color: isCenter && active ? DEEP : "#fff",
                    }}
                  />

                  <span
                    style={{
                      fontSize: isCenter ? 10 : 10.5,
                      lineHeight: 1.2,
                      fontFamily: "'Sora', sans-serif",
                      fontWeight: active ? 800 : 600,
                      opacity: active ? 1 : 0.72,
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
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
}

const BottomNavBar = React.memo(BottomNavBarImpl);
export default BottomNavBar;