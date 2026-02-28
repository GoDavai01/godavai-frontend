// src/components/Navbar.js — GoDavaii 2030 Modern UI
// ⚠️ ALL LOGIC 100% UNCHANGED — pure visual upgrade only
// ✅ NEW: searchbar hidden on /my-orders, /profile, /checkout, /payment pages
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
const NO_SEARCH_PATHS = ["/orders", "/profile", "/checkout", "/payment", "/payment-success", "/search"];

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
      ? currentAddress.formatted.slice(0, 32) + "…"
      : currentAddress.formatted
    : null;

  // Page label for no-search pages
  const pageLabel = routerLocation.pathname.startsWith("/search") ? "Search Results"
    : routerLocation.pathname.startsWith("/orders") ? "My Orders"
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
      {/* ── Main navbar container ── */}
      <div
        style={{
          maxWidth: 520, margin: "0 auto",
          background: `linear-gradient(160deg, ${DEEP} 0%, #0A4631 100%)`,
          borderBottomLeftRadius: hideSearch ? 0 : 28,
          borderBottomRightRadius: hideSearch ? 0 : 28,
          boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
          position: "relative", overflow: "hidden",
        }}
      >
        {/* Ambient glow blobs */}
        <div style={{
          position: "absolute", right: -30, top: -30,
          width: 140, height: 140, borderRadius: "50%",
          background: `radial-gradient(circle, ${ACCENT}18 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", left: -20, bottom: -20,
          width: 100, height: 100, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Top sheen */}
        <div style={{
          position: "absolute", inset: "0 0 auto 0", height: 40,
          background: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0))",
          pointerEvents: "none",
        }} />

        {/* ── Top row: location + profile ── */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: hideSearch ? "12px 16px 12px" : "14px 16px 10px",
          position: "relative",
        }}>
          {/* Location button */}
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
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 14, padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            {/* Pin icon with pulse ring */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: `${ACCENT}25`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <MapPin style={{ width: 16, height: 16, color: ACCENT }} />
              </div>
              {/* Live pulse dot */}
              <div style={{
                position: "absolute", top: -1, right: -1,
                width: 9, height: 9, borderRadius: "50%",
                background: ACCENT,
                border: "1.5px solid #0A4631",
                animation: "pulse-dot 2s ease-in-out infinite",
              }} />
            </div>

            <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: `${ACCENT}CC`,
                textTransform: "uppercase", letterSpacing: "0.6px",
                marginBottom: 1,
              }}>
                Delivering to
              </div>
              <div style={{
                fontSize: 14, fontWeight: 800,
                color: "#fff",
                fontFamily: "'Sora', sans-serif",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                letterSpacing: "-0.2px",
              }}>
                {addressLabel || "Set delivery location"}
              </div>
            </div>

            <ChevronDown style={{ width: 14, height: 14, color: "rgba(255,255,255,0.5)", flexShrink: 0 }} />
          </motion.button>

          {/* Right side: page label (on no-search pages) OR profile button */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 10, flexShrink: 0 }}>
            {pageLabel && (
              <span style={{
                fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 700,
                color: "rgba(255,255,255,0.60)",
                background: "rgba(255,255,255,0.10)",
                padding: "4px 10px", borderRadius: 100,
                border: "1px solid rgba(255,255,255,0.14)",
              }}>
                {pageLabel}
              </span>
            )}
            {/* Profile button */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.90 }}
              onClick={onProfile}
              style={{
                width: 42, height: 42, borderRadius: "50%",
                background: "rgba(255,255,255,0.12)",
                border: "1.5px solid rgba(255,255,255,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
              }}
              aria-label="Profile"
            >
              <CircleUserRound style={{ width: 22, height: 22, color: "#fff" }} />
            </motion.button>
          </div>
        </div>

        {/* ── Search bar — hidden on no-search pages ── */}
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
                    ? `0 0 0 2.5px ${ACCENT}60, 0 4px 20px rgba(0,0,0,0.15)`
                    : "0 4px 16px rgba(0,0,0,0.12)",
                  scale: searchFocused ? 1.01 : 1,
                }}
                transition={{ duration: 0.18 }}
                style={{
                  display: "flex", alignItems: "center",
                  height: 48, borderRadius: 16,
                  background: "rgba(255,255,255,0.97)",
                  padding: "0 14px",
                  border: "1.5px solid rgba(255,255,255,0.6)",
                }}
              >
                {/* Search icon */}
                <div style={{
                  width: 30, height: 30, borderRadius: 10,
                  background: searchFocused ? `${DEEP}15` : "#F1F5F9",
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
                    color: DEEP, background: "#E8F5EF",
                    padding: "2px 8px", borderRadius: 100,
                    border: `1px solid ${DEEP}25`,
                  }}>
                    This pharmacy
                  </span>
                )}
              </motion.div>

              {/* ── Autocomplete dropdown ── */}
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
                      background: "#fff",
                      borderRadius: 18,
                      border: "1.5px solid rgba(12,90,62,0.10)",
                      boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
                      overflow: "hidden",
                      maxHeight: 280, overflowY: "auto",
                    }}
                  >
                    <div style={{
                      padding: "10px 14px 6px",
                      fontSize: 10, fontWeight: 700,
                      color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px",
                      borderBottom: "1px solid #F1F5F9",
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
                            padding: "11px 14px",
                            background: "none", border: "none",
                            cursor: "pointer", textAlign: "left",
                            borderBottom: idx < 9 ? "1px solid #F8FAFC" : "none",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#F8FBFA"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                        >
                          <div style={{
                            width: 30, height: 30, borderRadius: 9,
                            background: "#E8F5EF",
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
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}