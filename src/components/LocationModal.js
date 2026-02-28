// src/components/LocationModal.jsx — GoDavaii 2030 Elite
// ✅ ALL LOGIC 100% UNCHANGED (detect, autocomplete, drop-pin, geocode)
// ✅ NEW: Uses context isDetecting / locationError / refreshLocation
// ✅ NEW: 2030 glassmorphic design, animated GPS state, permission screens
import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { MapPin, LocateFixed, X, Search, Navigation, AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { loadGoogleMaps } from "../utils/googleMaps";
import { useLocation } from "../context/LocationContext";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP   = "#0C5A3E";
const MID    = "#0E7A4F";
const ACCENT = "#00D97E";

// ─── Portal Modal Shell ───────────────────────────────────────
function ModalShell({ open, onClose, children, zIndex = 2600 }) {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && safeClose();
    const onPop = () => onClose?.();
    document.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    try { window.history.pushState({ modal: "location" }, ""); pushedRef.current = true; } catch {}
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const safeClose = () => {
    onClose?.();
    if (pushedRef.current) { try { window.history.back(); } catch {} pushedRef.current = false; }
  };

  if (!open) return null;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={safeClose}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(4,31,21,0.65)",
          backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        }}
      />
      {/* Sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="loc-sheet"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative", zIndex: 1,
              width: "100%", maxWidth: 480,
              background: "#fff",
              borderTopLeftRadius: 32, borderTopRightRadius: 32,
              overflow: "hidden",
              maxHeight: "92svh",
              display: "flex", flexDirection: "column",
              boxShadow: "0 -16px 60px rgba(0,0,0,0.25)",
            }}
          >
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "#E2E8F0" }} />
            </div>
            {/* Close button */}
            <button
              onClick={safeClose}
              style={{
                position: "absolute", top: 14, right: 14,
                width: 34, height: 34, borderRadius: 10,
                background: "#F1F5F9", border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X style={{ width: 16, height: 16, color: "#64748B" }} />
            </button>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}

// ─── GPS Animation Ring ───────────────────────────────────────
function GPSRing({ size = 80, color = ACCENT }) {
  return (
    <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Outer rings */}
      {[1, 2, 3].map((i) => (
        <div key={i} style={{
          position: "absolute",
          width: size * (0.5 + i * 0.18), height: size * (0.5 + i * 0.18),
          borderRadius: "50%",
          border: `1.5px solid ${color}`,
          opacity: 0,
          animation: `gpsRing 2.4s ease-out ${i * 0.6}s infinite`,
        }} />
      ))}
      {/* Center icon */}
      <div style={{
        width: size * 0.5, height: size * 0.5, borderRadius: "50%",
        background: `linear-gradient(135deg, ${DEEP}, ${MID})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 0 20px ${color}60`,
        zIndex: 1,
      }}>
        <Navigation style={{ width: size * 0.22, height: size * 0.22, color: "#fff" }} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function LocationModal({ open, onClose, onSelect }) {
  const { isDetecting: ctxDetecting, locationError: ctxError, refreshLocation } = useLocation();

  const [input, setInput]         = useState("");
  const [options, setOptions]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [detectedSuccess, setDetectedSuccess] = useState(false);

  const [showPinDialog, setShowPinDialog] = useState(false);
  const [manualLatLng, setManualLatLng]   = useState(null);

  const inputTimer     = useRef();
  const wasOpen        = useRef(false);
  const searchRef      = useRef(null);

  const dropPinDivRef  = useRef(null);
  const mapRef         = useRef(null);
  const markerRef      = useRef(null);

  const placesServiceRef = useRef(null);
  const geocoderRef      = useRef(null);

  async function ensurePlacesHelpers() {
    const google = await loadGoogleMaps();
    if (!placesServiceRef.current) placesServiceRef.current = new google.maps.places.AutocompleteService();
    if (!geocoderRef.current) geocoderRef.current = new google.maps.Geocoder();
    return { google, placesService: placesServiceRef.current, geocoder: geocoderRef.current };
  }

  useEffect(() => {
    if (open && !wasOpen.current) { setInput(""); setOptions([]); setDetectedSuccess(false); }
    wasOpen.current = open;
  }, [open]);

  // ── AUTOCOMPLETE — UNCHANGED LOGIC ───────────────────────────
  const handleInput = useCallback((val) => {
    setInput(val);
    if (inputTimer.current) clearTimeout(inputTimer.current);
    if (!val || val.length < 3) { setOptions([]); return; }
    inputTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { placesService } = await ensurePlacesHelpers();
        placesService.getPlacePredictions(
          { input: val, componentRestrictions: { country: "in" } },
          (predictions, status) => {
            setOptions(status === "OK" && predictions
              ? predictions.map((p) => ({ description: p.description, place_id: p.place_id }))
              : []);
            setLoading(false);
          }
        );
      } catch { setOptions([]); setLoading(false); }
    }, 300);
  }, []);

  const handleOptionSelect = async (option) => {
    setLoading(true);
    try {
      const { geocoder } = await ensurePlacesHelpers();
      geocoder.geocode({ placeId: option.place_id }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          const res = results[0];
          const loc = res.geometry.location;
          const lat = typeof loc.lat === "function" ? loc.lat() : loc.lat;
          const lng = typeof loc.lng === "function" ? loc.lng() : loc.lng;
          onSelect({ formatted: res.formatted_address, lat, lng, place_id: option.place_id });
        } else { alert("Could not get address details."); }
        setLoading(false);
      });
    } catch { setLoading(false); alert("Could not get address details."); }
  };

  // ── GPS DETECT — UNCHANGED LOGIC, uses context refreshLocation ──
  const handleDetect = async () => {
    setDetecting(true);
    setDetectedSuccess(false);
    try {
      const addr = await refreshLocation();
      setDetectedSuccess(true);
      setTimeout(() => { onSelect(addr); }, 1200); // brief success flash
    } catch (err) {
      const code = err?.code;
      if (code === 1) alert("Location permission denied. Please enable it in your browser settings.");
      else alert("Could not detect location. Please search manually.");
    } finally {
      setDetecting(false);
    }
  };

  // ── Drop-pin map — UNCHANGED LOGIC ───────────────────────────
  useEffect(() => {
    if (!showPinDialog) return;
    let map = mapRef.current;
    let marker = markerRef.current;
    loadGoogleMaps().then((google) => {
      const div = dropPinDivRef.current;
      if (!div) return;
      const defaultCenter = manualLatLng || { lat: 28.6139, lng: 77.209 };
      if (!map) {
        map = new google.maps.Map(div, { center: defaultCenter, zoom: 16, streetViewControl: false, mapTypeControl: false });
        mapRef.current = map;
      } else { map.setCenter(defaultCenter); }
      if (!marker) {
        marker = new google.maps.Marker({ position: defaultCenter, map, draggable: true, title: "Drag to your entrance" });
        marker.addListener("dragend", (e) => setManualLatLng({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
        markerRef.current = marker;
      } else { marker.setPosition(defaultCenter); }
      google.maps.event.addListener(map, "click", (e) => {
        marker.setPosition(e.latLng);
        setManualLatLng({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });
      if (navigator.geolocation && !manualLatLng) {
        navigator.geolocation.getCurrentPosition((pos) => {
          const userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          map.setCenter(userLoc); marker.setPosition(userLoc); setManualLatLng(userLoc);
        });
      }
    }).catch(console.error);
  }, [showPinDialog, manualLatLng]);

  const openDropPinForInput = async () => {
    setShowPinDialog(true);
    if (!input || input.length < 3) return;
    try {
      const { geocoder } = await ensurePlacesHelpers();
      geocoder.geocode({ address: input }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          const loc = results[0].geometry.location;
          setManualLatLng({ lat: typeof loc.lat === "function" ? loc.lat() : loc.lat, lng: typeof loc.lng === "function" ? loc.lng() : loc.lng });
        }
      });
    } catch {}
  };

  const isCurrentlyDetecting = detecting || ctxDetecting;
  const hasError = ctxError && !detecting;

  // ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes gpsRing {
          0%   { transform: scale(0.6); opacity: 0.8; }
          80%  { opacity: 0.1; }
          100% { transform: scale(2.0); opacity: 0; }
        }
        @keyframes locSpin { to { transform: rotate(360deg); } }
        @keyframes locPulse {
          0%, 100% { box-shadow: 0 0 0 0 ${ACCENT}60; }
          50%      { box-shadow: 0 0 0 12px ${ACCENT}00; }
        }
        @keyframes successBounce {
          0%   { transform: scale(0.7); opacity: 0; }
          60%  { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* ═══ MAIN SEARCH SHEET ═══ */}
      <ModalShell open={open} onClose={onClose} zIndex={2600}>
        {/* Header */}
        <div style={{ padding: "8px 20px 16px", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 13,
              background: `linear-gradient(135deg, ${DEEP}, ${MID})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 4px 14px ${DEEP}40`,
            }}>
              <MapPin style={{ width: 18, height: 18, color: "#fff" }} />
            </div>
            <div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800, color: "#0B1F16", letterSpacing: "-0.3px" }}>
                Set Delivery Location
              </div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
                Where should we deliver?
              </div>
            </div>
          </div>

          {/* Search bar */}
          <motion.div
            animate={{
              boxShadow: searchFocused
                ? `0 0 0 3px ${ACCENT}30, 0 4px 20px rgba(0,0,0,0.10)`
                : "0 2px 10px rgba(0,0,0,0.06)",
            }}
            style={{
              display: "flex", alignItems: "center",
              height: 52, borderRadius: 18,
              background: "#F8FAFC",
              border: `1.5px solid ${searchFocused ? ACCENT + "60" : "transparent"}`,
              padding: "0 14px", gap: 10,
              transition: "border-color 0.2s",
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: searchFocused ? `${DEEP}12` : "#EEF2F7",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "background 0.2s",
            }}>
              {loading
                ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${DEEP}30`, borderTopColor: DEEP, animation: "locSpin 0.7s linear infinite" }} />
                : <Search style={{ width: 15, height: 15, color: searchFocused ? DEEP : "#94A3B8" }} />
              }
            </div>
            <input
              ref={searchRef}
              value={input}
              onChange={(e) => handleInput(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search area, street, landmark..."
              autoFocus={open}
              disabled={isCurrentlyDetecting}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                fontSize: 15, fontWeight: 500, color: "#0B1F16",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            />
            {input && (
              <button onClick={() => { setInput(""); setOptions([]); searchRef.current?.focus(); }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <X style={{ width: 14, height: 14, color: "#94A3B8" }} />
              </button>
            )}
          </motion.div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 0 8px" }}>

          {/* ── Autocomplete results ── */}
          <AnimatePresence>
            {options.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {options.map((opt, i) => (
                  <motion.button
                    key={opt.place_id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleOptionSelect(opt)}
                    style={{
                      width: "100%", textAlign: "left",
                      padding: "14px 20px",
                      background: "none", border: "none",
                      borderBottom: "1px solid #F8FAFC",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 12,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#F8FBFA"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                      background: "linear-gradient(135deg, #E8F5EF, #D1FAE5)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <MapPin style={{ width: 15, height: 15, color: DEEP }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#0B1F16", fontFamily: "'Plus Jakarta Sans',sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {opt.description}
                    </span>
                    <ChevronRight style={{ width: 14, height: 14, color: "#CBD5E1", flexShrink: 0 }} />
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── GPS Detect Section ── */}
          <div style={{ padding: "14px 16px 0" }}>

            {/* Detection animation panel */}
            <AnimatePresence>
              {isCurrentlyDetecting && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  style={{
                    borderRadius: 24, overflow: "hidden",
                    background: `linear-gradient(135deg, ${DEEP}0A, ${ACCENT}08)`,
                    border: `1.5px solid ${ACCENT}30`,
                    padding: "28px 20px",
                    marginBottom: 12,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
                  }}
                >
                  <GPSRing size={88} color={ACCENT} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800, color: DEEP, marginBottom: 4 }}>
                      Detecting your location...
                    </div>
                    <div style={{ fontSize: 12, color: "#6B9E88" }}>
                      Getting your precise GPS coordinates
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success panel */}
            <AnimatePresence>
              {detectedSuccess && !isCurrentlyDetecting && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    borderRadius: 20, background: "#ECFDF5",
                    border: "1.5px solid #A7F3D0",
                    padding: "16px 20px", marginBottom: 12,
                    display: "flex", alignItems: "center", gap: 12,
                  }}
                >
                  <div style={{ animation: "successBounce 0.4s cubic-bezier(0.22,1,0.36,1) forwards" }}>
                    <CheckCircle2 style={{ width: 28, height: 28, color: "#059669" }} />
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 800, color: "#065F46" }}>Location detected!</div>
                    <div style={{ fontSize: 11, color: "#6EE7B7", marginTop: 2 }}>Updating your delivery address...</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error panel */}
            <AnimatePresence>
              {hasError && !isCurrentlyDetecting && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    borderRadius: 16, background: "#FFF5F5",
                    border: "1.5px solid #FECACA",
                    padding: "12px 14px", marginBottom: 12,
                    display: "flex", alignItems: "center", gap: 10,
                  }}
                >
                  <AlertCircle style={{ width: 18, height: 18, color: "#EF4444", flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: "#991B1B", fontWeight: 600 }}>
                    {ctxError === "denied"
                      ? "Location permission denied. Enable it in browser settings."
                      : "Couldn't detect location. Please search manually."}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Use Current Location button */}
            {!isCurrentlyDetecting && !detectedSuccess && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleDetect}
                style={{
                  width: "100%", height: 56, borderRadius: 20,
                  background: `linear-gradient(135deg, ${DEEP}, ${MID})`,
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "0 18px",
                  boxShadow: `0 8px 28px ${DEEP}40`,
                  marginBottom: 10,
                  position: "relative", overflow: "hidden",
                }}
              >
                {/* Sheen */}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(255,255,255,0.12), transparent 60%)", borderRadius: "inherit" }} />
                <div style={{
                  width: 38, height: 38, borderRadius: 13, flexShrink: 0,
                  background: "rgba(255,255,255,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  animation: "locPulse 2s ease-in-out infinite",
                }}>
                  <LocateFixed style={{ width: 18, height: 18, color: ACCENT }} />
                </div>
                <div style={{ textAlign: "left", flex: 1, position: "relative" }}>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 800, color: "#fff" }}>
                    Use My Current Location
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.60)", marginTop: 1 }}>
                    Auto-detect via GPS
                  </div>
                </div>
                <div style={{
                  width: 28, height: 28, borderRadius: 9,
                  background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, position: "relative",
                }}>
                  <Navigation style={{ width: 13, height: 13, color: DEEP }} />
                </div>
              </motion.button>
            )}

            {/* Drop-pin fallback */}
            {input.length >= 3 && !isCurrentlyDetecting && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={openDropPinForInput}
                style={{
                  width: "100%", textAlign: "left",
                  borderRadius: 16,
                  border: `2px dashed ${ACCENT}60`,
                  background: `${ACCENT}08`,
                  padding: "12px 16px",
                  display: "flex", alignItems: "center", gap: 10,
                  cursor: "pointer", marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 20 }}>📍</div>
                <div>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700, color: DEEP }}>
                    Can't find it? Drop Pin on Map
                  </div>
                  <div style={{ fontSize: 11, color: "#6B9E88", marginTop: 1 }}>
                    Drag the map pin to your exact entrance
                  </div>
                </div>
                <ChevronRight style={{ width: 14, height: 14, color: DEEP, marginLeft: "auto", flexShrink: 0 }} />
              </motion.button>
            )}

            {/* Cancel */}
            <button
              onClick={onClose}
              style={{
                width: "100%", height: 46, borderRadius: 14,
                background: "#F8FAFC", color: "#64748B",
                border: "1.5px solid #E2E8F0",
                fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 600,
                cursor: "pointer", marginBottom: 4,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      {/* ═══ DROP PIN SHEET ═══ */}
      <ModalShell open={showPinDialog} onClose={() => setShowPinDialog(false)} zIndex={2700}>
        {/* Header */}
        <div style={{ padding: "8px 20px 16px", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 13,
              background: `linear-gradient(135deg, #D97706, #F59E0B)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <MapPin style={{ width: 18, height: 18, color: "#fff" }} />
            </div>
            <div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800, color: "#0B1F16" }}>
                Drop Pin
              </div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>Drag the pin to your exact entrance</div>
            </div>
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          <div style={{
            borderRadius: 20, overflow: "hidden",
            border: "1.5px solid #E2E8F0",
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            marginBottom: 12,
          }}>
            <div ref={dropPinDivRef} style={{ width: "100%", height: "min(55svh, 360px)" }} />
          </div>

          {manualLatLng && (
            <div style={{
              background: "#F8FAFC", borderRadius: 12, padding: "10px 14px",
              fontSize: 12, color: "#64748B", marginBottom: 12,
              border: "1px solid #E2E8F0",
            }}>
              📍 {manualLatLng.lat.toFixed(5)}, {manualLatLng.lng.toFixed(5)}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setShowPinDialog(false)}
              style={{
                flex: 1, height: 50, borderRadius: 14,
                background: "#F8FAFC", color: "#64748B",
                border: "1.5px solid #E2E8F0",
                fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              Back
            </button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={!manualLatLng}
              onClick={() => {
                setShowPinDialog(false);
                onSelect({ formatted: input || "Pinned Location", lat: manualLatLng?.lat, lng: manualLatLng?.lng, place_id: null, manual: true });
              }}
              style={{
                flex: 2, height: 50, borderRadius: 14, border: "none",
                background: manualLatLng ? `linear-gradient(135deg, ${DEEP}, ${MID})` : "#E2E8F0",
                color: manualLatLng ? "#fff" : "#94A3B8",
                fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700,
                cursor: manualLatLng ? "pointer" : "not-allowed",
                boxShadow: manualLatLng ? `0 4px 16px ${DEEP}40` : "none",
              }}
            >
              Save Pin Location 📍
            </motion.button>
          </div>
        </div>
      </ModalShell>
    </>
  );
}