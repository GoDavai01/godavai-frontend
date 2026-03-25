import React from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  CalendarClock,
  Stethoscope,
  Wallet,
  Settings2,
} from "lucide-react";

const TABS = [
  { key: "home", label: "Home", icon: LayoutDashboard },
  { key: "appointments", label: "Consults", icon: CalendarClock },
  { key: "prescriptions", label: "Rx", icon: Stethoscope, isCenter: true },
  { key: "earnings", label: "Earnings", icon: Wallet },
  { key: "settings", label: "Settings", icon: Settings2 },
];

const DEEP = "#0A5A3B";

const spring = { type: "spring", stiffness: 520, damping: 34, mass: 0.55 };

export default function DoctorBottomNav({ activeTab, onTabChange, unreadCount = 0 }) {
  return (
    <div style={styles.wrap}>
      <div style={styles.bar}>
        {TABS.map((tab, idx) => {
          const active = activeTab === tab.key;
          const Icon = tab.icon;
          const isCenter = !!tab.isCenter;

          return (
            <motion.button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              whileTap={{ scale: 0.9 }}
              transition={spring}
              style={{
                ...styles.tabBtn,
                ...(isCenter ? styles.centerBtn : {}),
                ...(active && !isCenter ? styles.activeBtn : {}),
                ...(active && isCenter ? styles.centerActive : {}),
              }}
            >
              {/* Active burst */}
              {active && (
                <motion.div
                  initial={{ opacity: 0.45, scale: 0.2 }}
                  animate={{ opacity: 0, scale: 1.6 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  style={styles.burst}
                />
              )}

              <div style={{ position: "relative" }}>
                <Icon
                  style={{
                    width: isCenter ? 22 : 20,
                    height: isCenter ? 22 : 20,
                    color: active
                      ? isCenter
                        ? DEEP
                        : "#fff"
                      : "rgba(255,255,255,0.55)",
                    transition: "all .2s",
                  }}
                />
                {/* Notification badge for consults */}
                {tab.key === "appointments" && unreadCount > 0 && (
                  <div style={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</div>
                )}
              </div>

              <span
                style={{
                  fontSize: isCenter ? 10 : 9.5,
                  fontWeight: active ? 800 : 600,
                  fontFamily: "'Sora', sans-serif",
                  color: active
                    ? isCenter
                      ? DEEP
                      : "#fff"
                    : "rgba(255,255,255,0.55)",
                  marginTop: 2,
                  letterSpacing: "-0.2px",
                  transition: "all .2s",
                }}
              >
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1201,
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
  },
  bar: {
    width: "100%",
    maxWidth: 520,
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    alignItems: "end",
    background: `linear-gradient(160deg, ${DEEP} 0%, #083D28 65%, #0F7A53 100%)`,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    padding: "6px 4px",
    paddingBottom: "calc(6px + env(safe-area-inset-bottom, 0px))",
    pointerEvents: "auto",
    backdropFilter: "blur(20px)",
  },
  tabBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    padding: "6px 2px 4px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    position: "relative",
    borderRadius: 14,
    transition: "all .2s",
    WebkitTapHighlightColor: "transparent",
  },
  activeBtn: {
    background: "rgba(255,255,255,0.10)",
    borderRadius: 14,
  },
  centerBtn: {
    position: "relative",
    marginTop: -14,
    padding: "10px 8px 6px",
    borderRadius: 18,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  centerActive: {
    background: "linear-gradient(135deg, #CFFFF0, #18E2A1)",
    border: "1px solid rgba(24,226,161,0.3)",
    boxShadow: "0 10px 24px rgba(24,226,161,0.22)",
  },
  burst: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.2)",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    background: "#EF4444",
    color: "#fff",
    fontSize: 9,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 4px",
    border: "2px solid #083D28",
  },
};
