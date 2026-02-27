// src/components/BottomNavBar.js — GoDavaii 2030 Floating Island
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { Home, Pill, Stethoscope } from "lucide-react";

const navs = [
  { label: "GoDavaii", path: "/home", icon: Home },
  { label: "Medicines", path: "/pharmacies-near-you", icon: Pill },
  { label: "Doctor", path: "/doctors", icon: Stethoscope },
];

function BottomNavBarImpl() {
  const navigate = useNavigate();
  const location = useLocation();
  const shouldReduce = useReducedMotion();

  const activeIdx = Math.max(0, navs.findIndex((n) => location.pathname.startsWith(n.path)));
  const [burstIdx, setBurstIdx] = useState(null);

  const spring = { type: "spring", stiffness: 520, damping: 34, mass: 0.55 };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[1201] mx-auto w-full max-w-[520px] select-none"
      style={{ WebkitTapHighlightColor: "transparent", padding: "0 14px 0" }}
    >
      {/* Floating Island Container */}
      <div
        style={{
          marginBottom: "max(10px, env(safe-area-inset-bottom))",
          borderRadius: 24,
          background: "rgba(12, 90, 62, 0.90)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          border: "1px solid rgba(0, 217, 126, 0.12)",
          boxShadow:
            "0 12px 40px rgba(0,0,0,0.22), " +
            "0 0 0 1px rgba(0,217,126,0.06), " +
            "inset 0 1px 0 rgba(255,255,255,0.06), " +
            "0 0 20px rgba(0,217,126,0.08)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top sheen */}
        <div style={{
          position: "absolute", inset: "0 0 auto 0", height: 30,
          background: "linear-gradient(180deg, rgba(255,255,255,0.06), transparent)",
          pointerEvents: "none", borderRadius: "24px 24px 0 0",
        }} />

        <div className="relative px-2 pt-2.5 pb-2">
          <div className="relative grid grid-cols-3 gap-1">
            {navs.map((item, idx) => {
              const Icon = item.icon;
              const active = idx === activeIdx;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    if (window?.navigator?.vibrate) navigator.vibrate(8);
                    setBurstIdx(idx);
                    navigate(item.path);
                  }}
                  className="relative isolate flex min-h-[52px] flex-col items-center justify-center rounded-2xl text-white font-extrabold focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(0,217,126,0.4)]"
                  style={{ transition: "all 0.2s" }}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                >
                  {/* Active pill — glass with glow */}
                  {active && (
                    <LazyMotion features={domAnimation}>
                      <m.span
                        layoutId="gd-island-pill"
                        transition={spring}
                        className="absolute inset-0 -z-10 rounded-2xl"
                        style={{
                          background: "rgba(255,255,255,0.10)",
                          backdropFilter: "blur(4px)",
                          WebkitBackdropFilter: "blur(4px)",
                          border: "1px solid rgba(0,217,126,0.20)",
                          boxShadow: "0 0 16px rgba(0,217,126,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
                        }}
                      />
                    </LazyMotion>
                  )}

                  {/* Click burst */}
                  {burstIdx === idx && !shouldReduce && (
                    <LazyMotion features={domAnimation}>
                      <m.span
                        key={`burst-${idx}-${location.pathname}`}
                        initial={{ opacity: 0.5, scale: 0.2 }}
                        animate={{ opacity: 0, scale: 1.8 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        onAnimationComplete={() => setBurstIdx(null)}
                        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{
                          background:
                            "radial-gradient(circle, rgba(0,217,126,0.4) 0%, rgba(0,229,255,0.15) 40%, transparent 70%)",
                        }}
                      />
                    </LazyMotion>
                  )}

                  {/* Glow indicator for active */}
                  {active && (
                    <div style={{
                      position: "absolute", bottom: -1, left: "50%", transform: "translateX(-50%)",
                      width: 20, height: 3, borderRadius: 2,
                      background: "linear-gradient(90deg, #00D97E, #00E5FF)",
                      boxShadow: "0 0 8px rgba(0,217,126,0.5)",
                    }} />
                  )}

                  <Icon
                    className={`mb-0.5 transition-all duration-200 ${
                      active
                        ? "h-[22px] w-[22px] drop-shadow-[0_0_10px_rgba(0,217,126,0.5)]"
                        : "h-[20px] w-[20px] opacity-70"
                    }`}
                    style={{ color: active ? "#00FFB2" : "rgba(255,255,255,0.7)" }}
                  />
                  <span
                    className="text-[11px] font-bold"
                    style={{
                      color: active ? "#00FFB2" : "rgba(255,255,255,0.6)",
                      letterSpacing: active ? "0.2px" : "0",
                      transition: "all 0.2s",
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
    </div>
  );
}

const BottomNavBar = React.memo(BottomNavBarImpl);
export default BottomNavBar;
