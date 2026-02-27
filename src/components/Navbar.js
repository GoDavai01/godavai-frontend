// src/components/Navbar.js — GoDavaii 2030 Ultra-Futuristic UI
// ALL LOGIC 100% UNCHANGED — pure visual upgrade only
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation as useRouterLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, CircleUserRound, Search, Loader2, ChevronDown } from "lucide-react";
import LocationModal from "./LocationModal";
import { useLocation } from "../context/LocationContext";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP  = "#0C5A3E";
const ACCENT = "#00D97E";

// Pages where the search bar should be hidden
const NO_SEARCH_PATHS = ["/orders", "/profile", "/checkout", "/payment", "/payment-success"];

export default function Navbar({
  search: searchProp = "",
  onSearchChange = () => {},
  onSearchEnter = () => {},
  onProfile = () => (window.location.href = "/profile"),
}) {
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const { currentAddress, setCurrentAddress } = useLocation();

  // ── ALL STATE UNCHANGED ──────────────────────────────────────
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [search, setSearch] = useState(searchProp);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pharmacyName, setPharmacyName] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const boxRef   = useRef(null);
  const inputRef = useRef(null);

  // Hide search bar on certain pages
  const hideSearch = NO_SEARCH_PATHS.some(p => routerLocation.pathname.startsWith(p));

  // Detect if we're on /medicines/:pharmacyId — UNCHANGED
  const activePharmacyId = useMemo(() => {
    const m = routerLocation.pathname.match(/^\/medicines\/([a-fA-F0-9]{24})/);
    return m?.[1] || null;
  }, [routerLocation.pathname]);

  // Load pharmacy name for placeholder — UNCHANGED
  useEffect(() => {
    let cancel = false;
    async function run() {
      if (!activePharmacyId) { setPharmacyName(""); return; }
      try {
        const r = await axios.get(`${API_BASE_URL}/api/pharmacies`, { params: { id: activePharmacyId } });
        const ph = Array.isArray(r.data) ? r.data[0] : null;
        if (!cancel) setPharmacyName(ph?.name || "");
      } catch {
        if (!cancel) setPharmacyName("");
      }
    }
    run();
    return () => { cancel = true; };
  }, [activePharmacyId]);

  // Dynamic placeholder — UNCHANGED
  const placeholder = useMemo(() => {
    if (routerLocation.pathname.startsWith("/medicines")) {
      return pharmacyName ? `Search in ${pharmacyName}` : "Search in this pharmacy";
    }
    if (routerLocation.pathname.startsWith("/doctors")) return "Search Doctors";
    if (routerLocation.pathname.startsWith("/labs"))    return "Search Labs";
    return "Search Medicines";
  }, [routerLocation.pathname, pharmacyName]);

  const handleAddressChange = (addrObj) => {
    setCurrentAddress(addrObj);
    setLocationModalOpen(false);
  };

  useEffect(() => setSearch(searchProp), [searchProp]);

  // Autocomplete — UNCHANGED LOGIC
  useEffect(() => {
    if (!search) { setOptions([]); setDropdownOpen(false); return; }
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      const type = routerLocation.pathname.startsWith("/medicines") ? "medicine"
        : routerLocation.pathname.startsWith("/doctors") ? "doctor"
        : routerLocation.pathname.startsWith("/labs")    ? "lab"
        : "all";
      const tryReq = async (url, params) =>
        axios.get(url, { params, signal: controller.signal }).then((r) => r.data);
      try {
        if (type === "medicine" || type === "all") {
          const city = (currentAddress?.city || "").trim();
          const data = await tryReq(`${API_BASE_URL}/api/medicines/autocomplete`, {
            q: search, city, limit: 12,
            pharmacyId: activePharmacyId || undefined,
          });
          setOptions(data || []); setDropdownOpen(true); return;
        }
        const city = (currentAddress?.city || "").trim();
        const data = await tryReq(`${API_BASE_URL}/api/search/search-autocomplete`, {
          q: search, type, city,
        });
        setOptions(data || []); setDropdownOpen(true);
      } catch {
        try {
          const data = await tryReq(`${API_BASE_URL}/api/search/autocomplete`, { q: search, type });
          setOptions(data || []); setDropdownOpen(true);
        } catch {
          if (type === "medicine" || type === "all") {
            try {
              const meds = await tryReq(`${API_BASE_URL}/api/medicines/search`, {
                q: search, pharmacyId: activePharmacyId || undefined,
              });
              const names = Array.from(new Set((meds || []).map((m) => m.name))).slice(0, 10);
              setOptions(names); setDropdownOpen(true);
            } catch { setOptions([]); setDropdownOpen(false); }
          } else { setOptions([]); setDropdownOpen(false); }
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    const t = setTimeout(load, 160);
    return () => { controller.abort(); clearTimeout(t); };
  }, [search, routerLocation.pathname, currentAddress?.city, activePharmacyId]);

  // Click outside — UNCHANGED
  useEffect(() => {
    const onDown = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  // Handlers — ALL UNCHANGED
  const handleInput = (val) => { setSearch(val); onSearchChange(val); };

  const handleSelect = (val) => {
    const v = typeof val === "string" ? val : val?.label || val?.value || "";
    setSearch(v); setDropdownOpen(false);
    if (v) {
      const pid = activePharmacyId ? `&pharmacyId=${activePharmacyId}` : "";
      navigate(`/search?q=${encodeURIComponent(v)}${pid}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      onSearchEnter(search);
      if (search) {
        const pid = activePharmacyId ? `&pharmacyId=${activePharmacyId}` : "";
        navigate(`/search?q=${encodeURIComponent(search)}${pid}`);
      }
      setDropdownOpen(false);
      inputRef.current?.blur();
    }
  };

  // ── Formatted address display ─────────────────────────────────
  const addressLabel = currentAddress?.formatted
    ? currentAddress.formatted.length > 32
      ? currentAddress.formatted.slice(0, 32) + "..."
      : currentAddress.formatted
    : null;

  // Page label for no-search pages
  const pageLabel = routerLocation.pathname.startsWith("/orders") ? "My Orders"
    : routerLocation.pathname.startsWith("/profile") ? "Profile"
    : routerLocation.pathname.startsWith("/checkout") ? "Checkout"
    : routerLocation.pathname.startsWith("/payment") ? "Payment"
    : null;

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "sticky", top: 0, zIndex: 1200, width: "100%",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* ── Main navbar container — Frosted Glass ── */}
      <div
        style={{
          maxWidth: 520, margin: "0 auto",
          background: "rgba(12, 90, 62, 0.92)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderBottomLeftRadius: hideSearch ? 0 : 32,
          borderBottomRightRadius: hideSearch ? 0 : 32,
          boxShadow: "0 12px 40px rgba(0,0,0,0.20), 0 0 0 1px rgba(0,217,126,0.06)",
          position: "relative", overflow: "hidden",
        }}
      >
        {/* Ambient glow orbs */}
        <div style={{
          position: "absolute", right: -40, top: -40,
          width: 160, height: 160, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,217,126,0.12) 0%, rgba(0,229,255,0.04) 40%, transparent 70%)",
          pointerEvents: "none", animation: "orbFloat 8s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", left: -30, bottom: -30,
          width: 120, height: 120, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)",
          pointerEvents: "none", animation: "orbFloat 10s ease-in-out infinite reverse",
        }} />

        {/* Top sheen */}
        <div style={{
          position: "absolute", inset: "0 0 auto 0", height: 50,
          background: "linear-gradient(180deg, rgba(255,255,255,0.08), transparent)",
          pointerEvents: "none",
        }} />

        {/* ── Top row: location + profile ── */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: hideSearch ? "12px 16px 12px" : "14px 16px 10px",
          position: "relative",
        }}>
          {/* Location button — glass morphism */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              if (window?.navigator?.vibrate) navigator.vibrate(8);
              setLocationModalOpen(true);
            }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              flex: 1, minWidth: 0,
              background: "rgba(255,255,255,0.07)",
              backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 16, padding: "9px 13px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {/* Pin icon with glow ring */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: `linear-gradient(135deg, ${ACCENT}, #00E5FF)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 16px rgba(0,217,126,0.30)",
              }}>
                <MapPin style={{ width: 15, height: 15, color: "#041F15" }} />
              </div>
              {/* Live pulse dot */}
              <div style={{
                position: "absolute", top: -2, right: -2,
                width: 8, height: 8, borderRadius: "50%",
                background: "#00FFB2",
                border: "1.5px solid rgba(4,31,21,0.8)",
                animation: "navPulse 2s ease-in-out infinite",
              }} />
            </div>

            <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
              <div style={{
                fontSize: 9, fontWeight: 700, color: `${ACCENT}CC`,
                textTransform: "uppercase", letterSpacing: "1px",
                marginBottom: 1,
              }}>
                Delivering to
              </div>
              <div style={{
                fontSize: 13, fontWeight: 800,
                color: "#fff",
                fontFamily: "'Sora', sans-serif",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                letterSpacing: "-0.2px",
              }}>
                {addressLabel || "Set delivery location"}
              </div>
            </div>

            <ChevronDown style={{ width: 14, height: 14, color: "rgba(255,255,255,0.40)", flexShrink: 0 }} />
          </motion.button>

          {/* Right side: page label OR profile button */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 10, flexShrink: 0 }}>
            {pageLabel && (
              <span style={{
                fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 700,
                color: "rgba(255,255,255,0.55)",
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                padding: "5px 12px", borderRadius: 100,
                border: "1px solid rgba(255,255,255,0.10)",
              }}>
                {pageLabel}
              </span>
            )}
            {/* Profile button — glass */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={onProfile}
              style={{
                width: 44, height: 44, borderRadius: 14,
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                border: "1.5px solid rgba(255,255,255,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                transition: "all 0.2s",
              }}
              aria-label="Profile"
            >
              <CircleUserRound style={{ width: 22, height: 22, color: "#fff" }} />
            </motion.button>
          </div>
        </div>

        {/* ── Search bar — Glass morphism ── */}
        <AnimatePresence>
          {!hideSearch && (
            <motion.div
              initial={false}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              ref={boxRef}
              style={{ margin: "0 14px 14px", position: "relative", overflow: "visible" }}
            >
              <motion.div
                animate={{
                  boxShadow: searchFocused
                    ? `0 0 0 3px rgba(0,217,126,0.25), 0 8px 32px rgba(0,0,0,0.18)`
                    : "0 4px 20px rgba(0,0,0,0.12)",
                  scale: searchFocused ? 1.01 : 1,
                }}
                transition={{ duration: 0.18 }}
                style={{
                  display: "flex", alignItems: "center",
                  height: 50, borderRadius: 18,
                  background: "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                  padding: "0 14px",
                  border: "1px solid rgba(255,255,255,0.4)",
                }}
              >
                {/* Search icon */}
                <div style={{
                  width: 34, height: 34, borderRadius: 11,
                  background: searchFocused
                    ? `linear-gradient(135deg, ${DEEP}15, #00E5FF10)`
                    : "#F1F5F9",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginRight: 10, flexShrink: 0,
                  transition: "background 0.2s",
                }}>
                  {loading
                    ? <Loader2 style={{ width: 15, height: 15, color: DEEP, animation: "spin 0.8s linear infinite" }} />
                    : <Search style={{ width: 15, height: 15, color: searchFocused ? DEEP : "#94A3B8" }} />
                  }
                </div>

                <input
                  ref={inputRef}
                  value={search}
                  onChange={(e) => handleInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => { setSearchFocused(true); options.length > 0 && setDropdownOpen(true); }}
                  onBlur={() => setSearchFocused(false)}
                  placeholder={placeholder}
                  style={{
                    flex: 1, height: "100%",
                    background: "transparent",
                    border: "none", outline: "none",
                    fontSize: 15, fontWeight: 600,
                    color: "#0B1F16",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    letterSpacing: "-0.1px",
                  }}
                />

                {/* "This pharmacy" chip */}
                {activePharmacyId && !loading && (
                  <span style={{
                    flexShrink: 0, marginLeft: 8,
                    fontSize: 10, fontWeight: 700,
                    color: DEEP,
                    background: "linear-gradient(135deg, #E8F5EF, #D1FAE5)",
                    padding: "3px 10px", borderRadius: 100,
                    border: `1px solid ${DEEP}15`,
                  }}>
                    This pharmacy
                  </span>
                )}
              </motion.div>

              {/* ── Autocomplete dropdown — Glass ── */}
              <AnimatePresence>
                {dropdownOpen && options.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    style={{
                      position: "absolute", left: 0, right: 0, zIndex: 1300,
                      marginTop: 8,
                      background: "rgba(255,255,255,0.95)",
                      backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
                      borderRadius: 20,
                      border: "1px solid rgba(12,90,62,0.06)",
                      boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,217,126,0.04)",
                      overflow: "hidden",
                      maxHeight: 280, overflowY: "auto",
                    }}
                  >
                    <div style={{
                      padding: "10px 14px 6px",
                      fontSize: 10, fontWeight: 700,
                      color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.8px",
                      borderBottom: "1px solid rgba(0,0,0,0.04)",
                    }}>
                      Suggestions
                    </div>
                    {options
                      .map((opt) => typeof opt === "string" ? opt : opt?.label || opt?.value || opt?.name || "")
                      .filter((label) => label && label.trim().length > 0)
                      .filter((label, i, arr) => arr.indexOf(label) === i)
                      .slice(0, 10)
                      .map((label, idx) => (
                        <motion.button
                          key={`${label}-${idx}`}
                          type="button"
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSelect(label)}
                          style={{
                            display: "flex", width: "100%",
                            alignItems: "center", gap: 10,
                            padding: "12px 14px",
                            background: "none", border: "none",
                            cursor: "pointer", textAlign: "left",
                            borderBottom: idx < 9 ? "1px solid rgba(0,0,0,0.03)" : "none",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(12,90,62,0.03)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                        >
                          <div style={{
                            width: 32, height: 32, borderRadius: 10,
                            background: "linear-gradient(135deg, #E8F5EF, #D1EDE0)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                          }}>
                            <Search style={{ width: 13, height: 13, color: DEEP }} />
                          </div>
                          <span style={{
                            fontSize: 14, fontWeight: 600, color: "#0B1F16",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                          }}>
                            {label}
                          </span>
                        </motion.button>
                      ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Location modal — UNCHANGED */}
      <LocationModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onSelect={handleAddressChange}
      />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes navPulse {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 4px rgba(0,255,178,0.4); }
          50% { opacity: 0.7; transform: scale(0.85); box-shadow: 0 0 8px rgba(0,255,178,0.6); }
        }
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(10px, -15px) scale(1.05); }
          66%      { transform: translate(-8px, 10px) scale(0.95); }
        }
      `}</style>
    </div>
  );
}
