// src/components/BottomNavBar.js
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
  const [burstIdx, setBurstIdx] = useState(null); // for click pulse burst

  const spring = { type: "spring", stiffness: 520, damping: 34, mass: 0.55 };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[1201] mx-auto w-full max-w-[520px] select-none"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Lighter, medical gradient bar */}
      <div className="relative overflow-hidden border-t border-emerald-100/40 bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500/95 shadow-[0_-10px_24px_-10px_rgba(0,0,0,0.28)] pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        <div className="relative px-3 pt-2.5 pb-1">
          <div className="relative grid grid-cols-3 gap-2">
            {/* Subtle frosted surface */}
            <div className="pointer-events-none absolute inset-0 -z-10">
              <div className="absolute inset-x-2 bottom-2 top-2 rounded-3xl border border-white/15 bg-white/10 backdrop-blur-[6px]" />
            </div>

            {navs.map((item, idx) => {
              const Icon = item.icon;
              const active = idx === activeIdx;
              return (
                <button
                  key={item.label}
                  onClick={(e) => {
                    if (window?.navigator?.vibrate) navigator.vibrate(8);
                    setBurstIdx(idx); // trigger burst
                    navigate(item.path);
                  }}
                  className="relative isolate flex min-h-[54px] flex-col items-center justify-center rounded-2xl text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-200/70"
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                >
                  {/* === NEO LIGHT (moves with active tab) === */}
                  {active && (
                    <LazyMotion features={domAnimation}>
                      <m.span
                        layoutId="gd-neo-pill"
                        transition={spring}
                        className="absolute inset-0 -z-10 rounded-2xl"
                        style={{
                          background:
                            "radial-gradient(80px 40px at 50% 60%, rgba(255,255,255,0.26), rgba(255,255,255,0.12) 70%)",
                          boxShadow:
                            "0 10px 26px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.28)",
                          border: "1px solid rgba(255,255,255,0.24)",
                          backdropFilter: "blur(2px)",
                        }}
                      />
                    </LazyMotion>
                  )}

                  {/* Gentle breathing halo while active */}
                  {active && !shouldReduce && (
                    <LazyMotion features={domAnimation}>
                      <m.span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 -z-10 rounded-2xl"
                        animate={{ opacity: [0.2, 0.55, 0.2], scale: [0.98, 1.04, 0.98] }}
                        transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}
                        style={{
                          background:
                            "radial-gradient(75px 38px at 50% 58%, rgba(255,255,255,0.16), transparent 72%)",
                        }}
                      />
                    </LazyMotion>
                  )}

                  {/* === CLICK BURST (one-shot pulse on press) === */}
                  {burstIdx === idx && !shouldReduce && (
                    <LazyMotion features={domAnimation}>
                      <m.span
                        key={`burst-${idx}-${location.pathname}`} // reset on route change
                        initial={{ opacity: 0.45, scale: 0.2 }}
                        animate={{ opacity: 0, scale: 1.6 }}
                        transition={{ duration: 0.45, ease: "easeOut" }}
                        onAnimationComplete={() => setBurstIdx(null)}
                        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{
                          background:
                            "radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.0) 70%)",
                        }}
                      />
                    </LazyMotion>
                  )}

                  <Icon
                    className={`mb-0.5 h-[21px] w-[21px] transition-transform ${
                      active ? "scale-[1.07] drop-shadow-[0_3px_12px_rgba(255,255,255,0.55)]" : ""
                    }`}
                    style={{ willChange: "transform" }}
                  />
                  <span
                    className={`text-[12.5px] font-semibold tracking-wide ${
                      active ? "opacity-100" : "opacity-95"
                    }`}
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
