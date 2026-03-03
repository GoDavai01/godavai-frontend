// src/components/BottomNavBar.js — GoDavaii 2035 Health OS
// ✅ UPGRADED: 3-tab → 5-tab Health OS navigation
// ✅ NEW: Search (marketplace), AI assistant, Orders quick access
// ✅ REMOVED: "Medicines" → /pharmacies-near-you (pharmacy-first route GONE)
// ✅ REMOVED: "Doctor" standalone tab (merged into /search?tab=doctors)
// ✅ KEPT: All animation logic, haptics, spring physics, memo

import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { Home, Search, Sparkles, ClipboardList, User } from "lucide-react";

const navs = [
  { label: "Home",    path: "/home",    icon: Home },
  { label: "Search",  path: "/search",  icon: Search },
  { label: "AI",      path: "/ai",      icon: Sparkles },
  { label: "Orders",  path: "/orders",  icon: ClipboardList },
  { label: "Profile", path: "/profile", icon: User },
];

function BottomNavBarImpl() {
  const navigate = useNavigate();
  const location = useLocation();
  const shouldReduce = useReducedMotion();

  const activeIdx = Math.max(
    0,
    navs.findIndex((n) => location.pathname.startsWith(n.path))
  );
  const [burstIdx, setBurstIdx] = useState(null);

  const spring = { type: "spring", stiffness: 520, damping: 34, mass: 0.55 };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[1201] mx-auto w-full max-w-[520px] select-none"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <div
        className="relative overflow-hidden border-t border-[color:rgba(255,255,255,0.20)] shadow-[0_-10px_24px_-10px_rgba(0,0,0,0.28)] pb-[max(0.6rem,env(safe-area-inset-bottom))]"
        style={{ background: "linear-gradient(160deg, #0C5A3E 0%, #083D28 100%)" }}
      >
        <div className="relative px-2 pt-2 pb-1">
          <div className="relative grid grid-cols-5 gap-1">
            {/* Frosted inner surface */}
            <div className="pointer-events-none absolute inset-0 -z-10">
              <div className="absolute inset-x-1 bottom-1 top-1 rounded-3xl border border-white/15 bg-white/10 backdrop-blur-[6px]" />
            </div>

            {navs.map((item, idx) => {
              const Icon = item.icon;
              const active = idx === activeIdx;
              const isAI = item.label === "AI";

              return (
                <button
                  key={item.label}
                  onClick={() => {
                    if (window?.navigator?.vibrate) navigator.vibrate(8);
                    setBurstIdx(idx);
                    navigate(item.path);
                  }}
                  className="relative isolate flex min-h-[52px] flex-col items-center justify-center rounded-2xl text-white font-extrabold focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(255,255,255,0.6)]"
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                >
                  {/* Active pill */}
                  {active && (
                    <LazyMotion features={domAnimation}>
                      <m.span
                        layoutId="gd-neo-pill"
                        transition={spring}
                        className="absolute inset-0 -z-10 rounded-2xl bg-white/15 border border-white/25"
                        style={{ backdropFilter: "blur(2px)" }}
                      />
                    </LazyMotion>
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
                        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{
                          background:
                            "radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.0) 70%)",
                        }}
                      />
                    </LazyMotion>
                  )}

                  {/* AI tab special glow when active */}
                  {isAI && active && (
                    <div
                      className="pointer-events-none absolute inset-0 -z-10 rounded-2xl"
                      style={{
                        background:
                          "radial-gradient(circle at center, rgba(0,217,126,0.25) 0%, transparent 70%)",
                        animation: "gdAIGlow 2s ease-in-out infinite",
                      }}
                    />
                  )}

                  <Icon
                    className={`mb-0.5 h-[19px] w-[19px] transition-transform ${
                      active
                        ? "scale-[1.08] drop-shadow-[0_3px_12px_rgba(255,255,255,0.55)]"
                        : ""
                    }`}
                  />
                  <span
                    className={`text-[11px] leading-tight ${
                      active ? "opacity-100" : "opacity-80"
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

      <style>{`
        @keyframes gdAIGlow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const BottomNavBar = React.memo(BottomNavBarImpl);
export default BottomNavBar;