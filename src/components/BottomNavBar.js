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

  const activeIdx = Math.max(
    0,
    navs.findIndex((n) => location.pathname.startsWith(n.path))
  );
  const [burstIdx, setBurstIdx] = useState(null);

  const spring = { type: "spring", stiffness: 520, damping: 34, mass: 0.55 };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[1201] w-full select-none"
      style={{
        WebkitTapHighlightColor: "transparent",
        // keep a little breathing room on ultra-narrow devices
        paddingLeft: "max(8px, env(safe-area-inset-left))",
        paddingRight: "max(8px, env(safe-area-inset-right))",
      }}
    >
      {/* width clamps per device; bar stays centered but never exceeds viewport */}
      <div className="mx-auto w-full max-w-[calc(100vw-16px)] sm:max-w-[520px] md:max-w-[640px] lg:max-w-[720px]">
        {/* Solid dark-green bar with bold white labels */}
        <div className="relative overflow-hidden border-t border-[color:rgba(255,255,255,0.20)] bg-[var(--brand-green)] shadow-[0_-10px_24px_-10px_rgba(0,0,0,0.28)] pb-[max(0.6rem,env(safe-area-inset-bottom))] rounded-t-2xl">
          <div className="relative px-3 pt-2.5 pb-1">
            <div className="relative grid grid-cols-3 gap-2">
              {/* Frosted inner surface for subtle depth */}
              <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute inset-x-2 bottom-2 top-2 rounded-3xl border border-white/15 bg-white/10 backdrop-blur-[6px]" />
              </div>

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
                    className="relative isolate flex flex-col items-center justify-center rounded-2xl text-white font-extrabold focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(255,255,255,0.6)]"
                    style={{
                      // responsive touch target height, never too small or huge
                      minHeight: "clamp(48px, 7.5svh, 64px)",
                    }}
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

                    <Icon
                      className={`mb-0.5 transition-transform ${
                        active
                          ? "scale-[1.08] drop-shadow-[0_3px_12px_rgba(255,255,255,0.55)]"
                          : ""
                      }`}
                      style={{
                        width: "clamp(18px, 2.7vw, 22px)",
                        height: "clamp(18px, 2.7vw, 22px)",
                      }}
                    />
                    <span
                      className={active ? "opacity-100" : "opacity-95"}
                      style={{
                        // scales nicely across phone/tablet/laptop
                        fontSize: "clamp(11px, 1.8vw, 14px)",
                        lineHeight: 1.05,
                        whiteSpace: "nowrap",
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
    </div>
  );
}

const BottomNavBar = React.memo(BottomNavBarImpl);
export default BottomNavBar;
