// src/pages/SearchResults.js — GoDavaii 2030 Ultra Modern
// ✅ ALL LOGIC 100% UNCHANGED — pure visual upgrade
// ✅ Fixed: removed 52px top padding (Navbar already above + hides its search on /search)
// ✅ Single search bar — no duplicate. Ultra-modern frosted glass design.
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Clock, X, ChevronRight, ArrowLeft, Sparkles } from "lucide-react";
import { useCart } from "../context/CartContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP  = "#0C5A3E";
const MID   = "#0E7A4F";
const ACCENT = "#00D97E";
const MAX_DISTANCE  = 5000;
const MAX_PHARMACIES = 10;

// ─── Helpers — ALL UNCHANGED ─────────────────────────────────
const getImageUrl = (img) => {
  if (!img) return null;
  if (typeof img === "string" && img.startsWith("/uploads/")) return `${API_BASE_URL}${img}`;
  if (typeof img === "string" && img.startsWith("http")) return img;
  return null;
};

function scoreMatch(q, m) {
  const qn = (q || "").toLowerCase().trim();
  if (!qn) return 0;
  const fields = [m.name, m.brand, m.company, m.composition,
    Array.isArray(m.category) ? m.category.join(" ") : m.category,
    Array.isArray(m.type) ? m.type.join(" ") : m.type,
  ].filter(Boolean).map(String).map(s => s.toLowerCase());
  let score = 0;
  for (const f of fields) {
    if (!f) continue;
    if (f === qn) score += 100;
    if (f.startsWith(qn)) score += 40;
    if (f.includes(qn)) score += 20;
  }
  return score;
}

// ─── Medicine Image — UNCHANGED ──────────────────────────────
function MedImage({ med, size = 68 }) {
  const src = getImageUrl(med?.img || med?.image || med?.imageUrl);
  const [failed, setFailed] = useState(!src);
  if (failed || !src) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 14,
        background: "linear-gradient(135deg,#E8F5EF,#D1EDE0)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, fontSize: size * 0.45,
      }}>💊</div>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 14,
      overflow: "hidden", background: "#F0F9F4",
      flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <img src={src} alt={med?.brand || med?.name} loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </div>
  );
}

// ─── Med Card — 2030 Modern ───────────────────────────────────
function MedCard({ med, onAdd, onOpen }) {
  const price = med.price ?? med.mrp ?? "--";
  const origPrice = med.mrp && med.price && Number(med.price) < Number(med.mrp) ? med.mrp : null;
  const discount = origPrice ? Math.round(((origPrice - price) / origPrice) * 100) : null;

  return (
    <motion.div
      whileTap={{ scale: 0.96 }}
      onClick={() => onOpen?.(med)}
      style={{
        width: 180, flexShrink: 0, cursor: "pointer",
        background: "#fff", borderRadius: 20,
        border: "1.5px solid rgba(12,90,62,0.08)",
        boxShadow: "0 4px 18px rgba(12,90,62,0.08)",
        padding: "14px 12px 12px",
        display: "flex", flexDirection: "column", gap: 8,
        position: "relative", overflow: "hidden",
      }}
    >
      {discount && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          fontSize: 9, fontWeight: 800, color: "#fff",
          background: "linear-gradient(135deg,#059669,#00D97E)",
          padding: "2px 7px", borderRadius: 100,
          boxShadow: "0 2px 6px rgba(5,150,105,0.4)",
        }}>
          -{discount}%
        </div>
      )}
      <MedImage med={med} size={72} />
      <div>
        <div style={{
          fontFamily: "'Sora',sans-serif", fontSize: 12.5, fontWeight: 700,
          color: "#0B1F16", lineHeight: 1.3, marginBottom: 5,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {med.brand || med.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
          <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 900, color: DEEP }}>
            ₹{price}
          </span>
          {origPrice && (
            <span style={{ fontSize: 11, color: "#CBD5E1", textDecoration: "line-through", fontWeight: 500 }}>
              ₹{origPrice}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9.5, color: "#6B9E88", display: "flex", alignItems: "center", gap: 3, fontWeight: 600 }}>
            <Clock style={{ width: 9, height: 9 }} /> ≤30 min
          </span>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={(e) => { e.stopPropagation(); onAdd(med); }}
            style={{
              height: 28, padding: "0 12px", borderRadius: 100, border: "none",
              background: `linear-gradient(135deg,${DEEP},${MID})`,
              color: "#fff", fontSize: 11.5, fontWeight: 800,
              fontFamily: "'Sora',sans-serif", cursor: "pointer",
              boxShadow: "0 3px 10px rgba(12,90,62,0.30)",
            }}
          >
            + Add
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function SearchResults() {
  const location   = useLocation();
  const query      = new URLSearchParams(location.search).get("q") || "";
  const pharmacyId = new URLSearchParams(location.search).get("pharmacyId") || null;
  const navigate   = useNavigate();

  // ── ALL STATE — IDENTICAL ──────────────────────────────────
  const [selectedMed, setSelectedMed]           = useState(null);
  const [activeImg, setActiveImg]               = useState(0);
  const { cart, addToCart }                     = useCart();
  const [autoSuggestions, setAutoSuggestions]   = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [nearbyPharmacies, setNearbyPharmacies] = useState([]);
  const [pharmacySections, setPharmacySections] = useState([]);
  const [localQuery, setLocalQuery]             = useState(query);
  const [searchFocused, setSearchFocused]       = useState(false);
  const inputRef = useRef(null);

  const locationObj = JSON.parse(localStorage.getItem("currentAddress") || "{}");
  const lat = locationObj.lat || null;
  const lng = locationObj.lng || null;

  useEffect(() => { setLocalQuery(query); }, [query]);

  // ── IDENTICAL: Load nearby pharmacies ─────────────────────
  useEffect(() => {
    let cancel = false;
    async function run() {
      if (pharmacyId) {
        try {
          const r = await axios.get(`${API_BASE_URL}/api/pharmacies`, { params: { id: pharmacyId } });
          const ph = Array.isArray(r.data) ? r.data[0] : null;
          if (!cancel) setNearbyPharmacies(ph ? [ph] : []);
        } catch { if (!cancel) setNearbyPharmacies([]); }
        return;
      }
      if (!lat || !lng) { setNearbyPharmacies([]); return; }
      try {
        const r = await fetch(`${API_BASE_URL}/api/pharmacies/nearby?lat=${lat}&lng=${lng}&maxDistance=${MAX_DISTANCE}`);
        const phs = await r.json();
        if (!cancel) setNearbyPharmacies(Array.isArray(phs) ? phs.slice(0, MAX_PHARMACIES) : []);
      } catch { if (!cancel) setNearbyPharmacies([]); }
    }
    run();
    return () => { cancel = true; };
  }, [lat, lng, pharmacyId]);

  // ── IDENTICAL: Load medicine results ──────────────────────
  useEffect(() => {
    let cancel = false;
    async function run() {
      if (!query) { setPharmacySections([]); setAutoSuggestions([]); setLoading(false); return; }
      setLoading(true);
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/medicines/search`, {
          params: { q: query, lat, lng, maxDistance: MAX_DISTANCE, limit: 400, pharmacyId },
        });
        const meds = (Array.isArray(data) ? data : [])
          .map(m => ({ ...m, __score: scoreMatch(query, m) }))
          .sort((a, b) => b.__score - a.__score);
        const chips = Array.from(new Set(
          meds.map(m => m.brand || m.name).filter(Boolean).map(s => String(s))
        )).slice(0, 12);
        if (!cancel) setAutoSuggestions(chips);
        const nearbyIds = new Set(nearbyPharmacies.map(p => String(p._id)));
        const phMap = new Map();
        for (const m of meds) {
          const pid = String(m.pharmacy || "");
          if (!nearbyIds.has(pid)) continue;
          if (!phMap.has(pid)) {
            const ph = nearbyPharmacies.find(p => String(p._id) === pid);
            if (!ph) continue;
            phMap.set(pid, { pharmacy: ph, medicines: [] });
          }
          phMap.get(pid).medicines.push(m);
        }
        const sections = nearbyPharmacies
          .map(ph => phMap.get(String(ph._id))).filter(Boolean)
          .map(sec => ({ ...sec, medicines: sec.medicines.slice(0, 8) }))
          .slice(0, MAX_PHARMACIES);
        if (!cancel) setPharmacySections(sections);
      } catch {
        if (!cancel) { setPharmacySections([]); setAutoSuggestions([]); }
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, lat, lng, nearbyPharmacies, pharmacyId]);

  // ── IDENTICAL handlers ─────────────────────────────────────
  const handleSuggestionClick = (suggestion) => {
    const pid = pharmacyId ? `&pharmacyId=${pharmacyId}` : "";
    navigate(`/search?q=${encodeURIComponent(suggestion)}${pid}`);
  };

  const handleSearchSubmit = () => {
    if (!localQuery.trim()) return;
    const pid = pharmacyId ? `&pharmacyId=${pharmacyId}` : "";
    navigate(`/search?q=${encodeURIComponent(localQuery.trim())}${pid}`);
    inputRef.current?.blur();
  };

  const handleAddToCart = (pharmacy, med) => {
    if ((cart?.length || 0) > 0) {
      const cartPharmacyId = cart[0]?.pharmacy?._id || cart[0]?.pharmacy;
      const targetPhId = pharmacy?._id || med?.pharmacy?._id || med?.pharmacy;
      if (cartPharmacyId && targetPhId && String(cartPharmacyId) !== String(targetPhId)) {
        alert("You can only order from one pharmacy at a time.");
        return;
      }
    }
    addToCart({ ...med, pharmacy });
  };

  const images = useMemo(() => {
    if (!selectedMed) return [];
    const arr = (Array.isArray(selectedMed.images) && selectedMed.images.length
      ? selectedMed.images : [selectedMed.img]).filter(Boolean);
    return arr;
  }, [selectedMed]);

  const totalResults = pharmacySections.reduce((s, sec) => s + sec.medicines.length, 0);

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div style={{
      minHeight: "100vh", maxWidth: 480, margin: "0 auto",
      background: "#EFF6F2", paddingBottom: 100,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>

      {/* ═══ HEADER — 18px top padding only (Navbar is sticky above) ═══ */}
      <div style={{
        background: `linear-gradient(160deg, ${DEEP} 0%, #083D28 70%, #041F14 100%)`,
        padding: "18px 16px 20px",
        position: "relative", overflow: "hidden",
      }}>
        {/* Ambient blobs */}
        <div style={{
          position: "absolute", right: -50, top: -50, width: 200, height: 200,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${ACCENT}14 0%, transparent 65%)`,
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", left: -30, bottom: -30, width: 150, height: 150,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Row: back + title + count */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 16, position: "relative",
        }}>
          <motion.button
            whileTap={{ scale: 0.90 }}
            onClick={() => navigate(-1)}
            style={{
              width: 40, height: 40, borderRadius: 13, flexShrink: 0,
              background: "rgba(255,255,255,0.10)",
              border: "1.5px solid rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ArrowLeft style={{ width: 18, height: 18, color: "#fff" }} />
          </motion.button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 9.5, fontWeight: 700, color: `${ACCENT}BB`,
              textTransform: "uppercase", letterSpacing: "1px", marginBottom: 2,
            }}>
              Search Results
            </div>
            <div style={{
              fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800,
              color: query ? "#fff" : "rgba(255,255,255,0.4)",
              letterSpacing: "-0.3px",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {query ? `"${query}"` : "Search medicines..."}
            </div>
          </div>

          <AnimatePresence>
            {!loading && totalResults > 0 && (
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  fontSize: 11, fontWeight: 800, color: "#041F14",
                  background: ACCENT, padding: "5px 13px", borderRadius: 100,
                  flexShrink: 0, boxShadow: "0 0 12px rgba(0,217,126,0.4)",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <Sparkles style={{ width: 10, height: 10 }} />
                {totalResults}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* ═══ SINGLE Ultra Modern Search Bar ═══ */}
        <motion.div
          animate={{
            boxShadow: searchFocused
              ? `0 0 0 3px rgba(0,217,126,0.25), 0 8px 32px rgba(0,0,0,0.20)`
              : "0 6px 24px rgba(0,0,0,0.16)",
            scale: searchFocused ? 1.01 : 1,
          }}
          transition={{ duration: 0.18 }}
          style={{
            display: "flex", alignItems: "center",
            height: 52, borderRadius: 18,
            background: "rgba(255,255,255,0.97)",
            padding: "0 14px",
            border: searchFocused ? `1.5px solid ${ACCENT}60` : "1.5px solid rgba(255,255,255,0.5)",
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            background: searchFocused ? `linear-gradient(135deg,${DEEP}18,${ACCENT}15)` : "#F1F5F9",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginRight: 10, flexShrink: 0, transition: "all 0.2s",
          }}>
            <Search style={{
              width: 15, height: 15,
              color: searchFocused ? DEEP : "#94A3B8",
              transition: "color 0.2s",
            }} />
          </div>

          <input
            ref={inputRef}
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearchSubmit(); }}
            placeholder="Search medicines, brands..."
            style={{
              flex: 1, height: "100%",
              background: "transparent", border: "none", outline: "none",
              fontSize: 15, fontWeight: 600, color: "#0B1F16",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              letterSpacing: "-0.1px",
            }}
          />

          {localQuery && (
            <motion.button
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              whileTap={{ scale: 0.85 }}
              onClick={() => {
                setLocalQuery("");
                navigate("/search");
                inputRef.current?.focus();
              }}
              style={{
                width: 28, height: 28, borderRadius: "50%",
                flexShrink: 0, marginLeft: 4,
                background: "#F1F5F9", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X style={{ width: 13, height: 13, color: "#94A3B8" }} />
            </motion.button>
          )}

          {pharmacyId && (
            <span style={{
              flexShrink: 0, marginLeft: 8, fontSize: 10, fontWeight: 700,
              color: DEEP, background: "linear-gradient(135deg,#E8F5EF,#D1FAE5)",
              padding: "3px 10px", borderRadius: 100, border: `1px solid ${DEEP}15`,
            }}>
              This pharmacy
            </span>
          )}
        </motion.div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div style={{ padding: "16px 14px 0" }}>

        {/* Suggestion chips — IDENTICAL logic */}
        <AnimatePresence>
          {autoSuggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ marginBottom: 18 }}
            >
              <div style={{
                fontSize: 10, fontWeight: 800, color: "#94A3B8",
                letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8,
              }}>
                Related
              </div>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                {autoSuggestions.map(s => (
                  <motion.button
                    key={s}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => handleSuggestionClick(s)}
                    style={{
                      flexShrink: 0, height: 34, padding: "0 16px", borderRadius: 100,
                      cursor: "pointer",
                      background: s === query ? DEEP : "#fff",
                      color: s === query ? "#fff" : DEEP,
                      border: s === query ? "none" : `1.5px solid rgba(12,90,62,0.14)`,
                      fontSize: 12, fontWeight: 700,
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                      boxShadow: s === query
                        ? "0 4px 14px rgba(12,90,62,0.25)"
                        : "0 2px 8px rgba(0,0,0,0.05)",
                    }}
                  >
                    {s}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "70px 0" }}>
            <div style={{ position: "relative", marginBottom: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                border: `3px solid ${DEEP}20`,
                borderTopColor: DEEP,
                animation: "spin 0.8s linear infinite",
              }} />
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20,
              }}>💊</div>
            </div>
            <div style={{
              fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800,
              color: DEEP, marginBottom: 4,
            }}>
              Searching nearby...
            </div>
            <div style={{ fontSize: 12, color: "#94A3B8" }}>Finding best prices for you</div>
          </div>
        )}

        {/* No results */}
        {!loading && pharmacySections.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: "center", padding: "60px 20px" }}
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontSize: 64, marginBottom: 16 }}
            >🔍</motion.div>
            <div style={{
              fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 900,
              color: "#0B1F16", marginBottom: 8,
            }}>
              No medicines found
            </div>
            <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.7 }}>
              {query
                ? <>No nearby pharmacies have <strong>"{query}"</strong><br />Try a different name or check spelling</>
                : "Start typing to search medicines"
              }
            </div>
          </motion.div>
        )}

        {/* Results by pharmacy — IDENTICAL data logic, modern visual */}
        {!loading && pharmacySections.map(({ pharmacy, medicines }, idx) => (
          <motion.div
            key={pharmacy._id || idx}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.07, ease: [0.22,1,0.36,1] }}
            style={{
              marginBottom: 20,
              background: "#fff",
              borderRadius: 24,
              border: "1.5px solid rgba(12,90,62,0.07)",
              boxShadow: "0 4px 20px rgba(12,90,62,0.07)",
              overflow: "hidden",
            }}
          >
            {/* Green top accent bar */}
            <div style={{
              height: 3,
              background: `linear-gradient(90deg, ${DEEP}, ${ACCENT})`,
            }} />

            <div style={{ padding: "14px 14px 14px" }}>
              {/* Pharmacy header */}
              <div style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between", marginBottom: 14,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 14, flexShrink: 0,
                    background: `linear-gradient(135deg,${DEEP}18,${ACCENT}18)`,
                    border: `1.5px solid ${DEEP}10`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20,
                  }}>🏥</div>
                  <button
                    onClick={() => navigate(`/medicines/${pharmacy._id}`)}
                    style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
                  >
                    <div style={{
                      fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800,
                      color: "#0B1F16", letterSpacing: "-0.2px",
                    }}>
                      {pharmacy.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2, fontWeight: 500 }}>
                      📍 {pharmacy.distanceKm ? `${pharmacy.distanceKm.toFixed(1)} km away` : "< 1 km away"}
                      {" · "}
                      <span style={{ color: DEEP, fontWeight: 700 }}>
                        {medicines.length} match{medicines.length !== 1 ? "es" : ""}
                      </span>
                    </div>
                  </button>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`/medicines/${pharmacy._id}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    fontSize: 11, fontWeight: 700, color: DEEP,
                    background: "#E8F5EF", border: `1px solid ${ACCENT}50`,
                    padding: "5px 12px", borderRadius: 100, cursor: "pointer",
                  }}
                >
                  All items <ChevronRight style={{ width: 12, height: 12 }} />
                </motion.button>
              </div>

              {/* Horizontal medicine cards */}
              <div style={{
                display: "flex", gap: 10,
                overflowX: "auto", scrollbarWidth: "none",
                paddingBottom: 4,
              }}>
                {medicines.map((med, mi) => (
                  <MedCard
                    key={med._id || mi}
                    med={med}
                    onAdd={(m) => handleAddToCart(pharmacy, m)}
                    onOpen={(m) => { setSelectedMed({ ...m, pharmacy }); setActiveImg(0); }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ═══ Med Detail Dialog — IDENTICAL ═══ */}
      <Dialog open={!!selectedMed}
        onOpenChange={(open) => { if (!open) { setSelectedMed(null); setActiveImg(0); } }}
      >
        <DialogContent style={{ width: "min(96vw,520px)", padding: 0, borderRadius: 28, overflow: "hidden" }}>
          {selectedMed && (
            <>
              <DialogHeader style={{ padding: "20px 20px 12px" }}>
                <DialogTitle style={{
                  fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, color: DEEP,
                }}>
                  {selectedMed.brand || selectedMed.name}
                </DialogTitle>
              </DialogHeader>
              <div style={{
                margin: "0 20px", borderRadius: 18, overflow: "hidden",
                height: 200, background: "#F0F9F4",
              }}>
                <div
                  style={{
                    display: "flex", height: "100%",
                    transition: "transform 0.3s",
                    transform: `translateX(-${activeImg * 100}%)`,
                  }}
                  onTouchStart={(e) => (e.currentTarget.dataset.sx = e.touches[0].clientX)}
                  onTouchEnd={(e) => {
                    const dx = e.changedTouches[0].clientX - Number(e.currentTarget.dataset.sx || 0);
                    if (dx < -40 && activeImg < images.length - 1) setActiveImg(i => i + 1);
                    if (dx > 40 && activeImg > 0) setActiveImg(i => i - 1);
                  }}
                >
                  {(images.length ? images : [null]).map((src, i) => {
                    const imgSrc = getImageUrl(src);
                    return (
                      <div key={i} style={{
                        minWidth: "100%", height: "100%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {imgSrc
                          ? <img src={imgSrc} alt={selectedMed.name} draggable={false}
                              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                            />
                          : <div style={{ fontSize: 60 }}>💊</div>
                        }
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ padding: "14px 20px 0" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {Array.isArray(selectedMed.category) && selectedMed.category.map((c, i) => (
                    <span key={i} style={{
                      fontSize: 11, fontWeight: 600, color: DEEP,
                      background: "#E8F5EF", padding: "2px 9px", borderRadius: 100,
                    }}>{c}</span>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{
                    fontFamily: "'Sora',sans-serif", fontSize: 26, fontWeight: 900, color: DEEP,
                  }}>
                    ₹{selectedMed.price ?? selectedMed.mrp ?? "--"}
                  </span>
                  {selectedMed.mrp && (selectedMed.price ?? 0) < selectedMed.mrp && (
                    <>
                      <span style={{ fontSize: 13, color: "#CBD5E1", textDecoration: "line-through" }}>
                        ₹{selectedMed.mrp}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: "#fff",
                        background: "linear-gradient(135deg,#059669,#00D97E)",
                        padding: "2px 9px", borderRadius: 100,
                        boxShadow: "0 2px 8px rgba(5,150,105,0.3)",
                      }}>
                        {Math.round(((selectedMed.mrp - (selectedMed.price ?? 0)) / selectedMed.mrp) * 100)}% OFF
                      </span>
                    </>
                  )}
                </div>
                {selectedMed.composition && (
                  <div style={{ fontSize: 13, color: "#4A6B5A", marginBottom: 4 }}>
                    <strong>Composition:</strong> {selectedMed.composition}
                  </div>
                )}
                {selectedMed.company && (
                  <div style={{ fontSize: 13, color: "#4A6B5A", marginBottom: 8 }}>
                    <strong>Company:</strong> {selectedMed.company}
                  </div>
                )}
                {selectedMed.description && (
                  <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>
                    {selectedMed.description}
                  </div>
                )}
              </div>
              <div style={{ padding: "14px 20px 20px", display: "flex", gap: 10 }}>
                <button
                  onClick={() => setSelectedMed(null)}
                  style={{
                    flex: 1, height: 50, borderRadius: 15,
                    background: "#F8FAFC", color: "#64748B",
                    border: "1.5px solid #E2E8F0",
                    fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => { handleAddToCart(selectedMed.pharmacy, selectedMed); setSelectedMed(null); }}
                  style={{
                    flex: 2, height: 50, borderRadius: 15, border: "none",
                    background: `linear-gradient(135deg,${DEEP},${MID})`,
                    color: "#fff",
                    fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 6px 20px rgba(12,90,62,0.35)",
                  }}
                >
                  Add to Cart 🛒
                </motion.button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}