// src/pages/SearchResults.js — GoDavaii 2030 Modern UI
// ALL LOGIC UNCHANGED — only UI upgraded
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Clock, X, ChevronRight, ArrowLeft } from "lucide-react";
import { useCart } from "../context/CartContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP  = "#0C5A3E";
const MID   = "#0E7A4F";
const ACCENT = "#00D97E";
const MAX_DISTANCE  = 5000;
const MAX_PHARMACIES = 10;

// ─── Helpers (UNCHANGED) ─────────────────────────────────────
const getImageUrl = (img) => {
  if (!img) return null;
  if (typeof img === "string" && img.startsWith("/uploads/")) return `${API_BASE_URL}${img}`;
  if (typeof img === "string" && img.startsWith("http")) return img;
  return null;
};

function scoreMatch(q, m) {
  const qn = (q || "").toLowerCase().trim();
  if (!qn) return 0;
  const fields = [m.name, m.brand, m.company, m.composition, Array.isArray(m.category) ? m.category.join(" ") : m.category, Array.isArray(m.type) ? m.type.join(" ") : m.type].filter(Boolean).map(String).map(s => s.toLowerCase());
  let score = 0;
  for (const f of fields) {
    if (!f) continue;
    if (f === qn) score += 100;
    if (f.startsWith(qn)) score += 40;
    if (f.includes(qn)) score += 20;
  }
  return score;
}

// ─── Medicine Image ───────────────────────────────────────────
function MedImage({ med, size = 68 }) {
  const src = getImageUrl(med?.img || med?.image || med?.imageUrl);
  const [failed, setFailed] = useState(!src);
  if (failed || !src) {
    return (
      <div style={{ width: size, height: size, borderRadius: 12, background: "linear-gradient(135deg,#E8F5EF,#D1EDE0)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: size * 0.45 }}>
        💊
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 12, overflow: "hidden", background: "#F0F9F4", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img src={src} alt={med?.brand || med?.name} loading="lazy" onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    </div>
  );
}

// ─── Med Card ─────────────────────────────────────────────────
function MedCard({ med, onAdd, onOpen }) {
  const price = med.price ?? med.mrp ?? "--";
  const origPrice = med.mrp && med.price && Number(med.price) < Number(med.mrp) ? med.mrp : null;
  const discount = origPrice ? Math.round(((origPrice - price) / origPrice) * 100) : null;

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={() => onOpen?.(med)}
      style={{
        width: 200, flexShrink: 0, cursor: "pointer",
        background: "#fff", borderRadius: 18,
        border: "1.5px solid rgba(12,90,62,0.10)",
        boxShadow: "0 2px 12px rgba(12,90,62,0.07)",
        padding: "12px",
        display: "flex", alignItems: "center", gap: 10,
      }}
    >
      <MedImage med={med} size={64} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 700,
          color: "#0B1F16", lineHeight: 1.3, marginBottom: 4,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {med.brand || med.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
          <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 800, color: DEEP }}>₹{price}</span>
          {discount && <span style={{ fontSize: 9, fontWeight: 700, color: "#059669", background: "#ECFDF5", padding: "1px 5px", borderRadius: 100 }}>{discount}%</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, color: "#6B9E88", display: "flex", alignItems: "center", gap: 2 }}>
            <Clock style={{ width: 9, height: 9 }} /> ≤30m
          </span>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={(e) => { e.stopPropagation(); onAdd(med); }}
            style={{
              height: 26, padding: "0 10px", borderRadius: 100, border: "none",
              background: DEEP, color: "#fff", fontSize: 11, fontWeight: 700,
              fontFamily: "'Sora',sans-serif", cursor: "pointer",
            }}
          >
            +Add
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function SearchResults() {
  const location  = useLocation();
  const query     = new URLSearchParams(location.search).get("q") || "";
  const pharmacyId = new URLSearchParams(location.search).get("pharmacyId") || null;
  const navigate  = useNavigate();
  const [selectedMed, setSelectedMed]             = useState(null);
  const [activeImg, setActiveImg]                 = useState(0);
  const { cart, addToCart }                       = useCart();
  const [autoSuggestions, setAutoSuggestions]     = useState([]);
  const [loading, setLoading]                     = useState(true);
  const [nearbyPharmacies, setNearbyPharmacies]   = useState([]);
  const [pharmacySections, setPharmacySections]   = useState([]);
  const locationObj = JSON.parse(localStorage.getItem("currentAddress") || "{}");
  const lat = locationObj.lat || null;
  const lng = locationObj.lng || null;

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

  useEffect(() => {
    let cancel = false;
    async function run() {
      if (!query) { setPharmacySections([]); setAutoSuggestions([]); setLoading(false); return; }
      setLoading(true);
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/medicines/search`, { params: { q: query, lat, lng, maxDistance: MAX_DISTANCE, limit: 400, pharmacyId } });
        const meds = (Array.isArray(data) ? data : []).map(m => ({ ...m, __score: scoreMatch(query, m) })).sort((a, b) => b.__score - a.__score);
        const chips = Array.from(new Set(meds.map(m => m.brand || m.name).filter(Boolean).map(s => String(s)))).slice(0, 12);
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
        const sections = nearbyPharmacies.map(ph => phMap.get(String(ph._id))).filter(Boolean).map(sec => ({ ...sec, medicines: sec.medicines.slice(0, 8) })).slice(0, MAX_PHARMACIES);
        if (!cancel) setPharmacySections(sections);
      } catch { if (!cancel) { setPharmacySections([]); setAutoSuggestions([]); } }
      finally { if (!cancel) setLoading(false); }
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, lat, lng, nearbyPharmacies, pharmacyId]);

  const handleSuggestionClick = (suggestion) => {
    const pid = pharmacyId ? `&pharmacyId=${pharmacyId}` : "";
    navigate(`/search?q=${encodeURIComponent(suggestion)}${pid}`);
  };

  const handleAddToCart = (pharmacy, med) => {
    if ((cart?.length || 0) > 0) {
      const cartPharmacyId = cart[0]?.pharmacy?._id || cart[0]?.pharmacy;
      const targetPhId = pharmacy?._id || med?.pharmacy?._id || med?.pharmacy;
      if (cartPharmacyId && targetPhId && String(cartPharmacyId) !== String(targetPhId)) { alert("You can only order from one pharmacy at a time."); return; }
    }
    addToCart({ ...med, pharmacy });
  };

  const images = useMemo(() => {
    if (!selectedMed) return [];
    const arr = (Array.isArray(selectedMed.images) && selectedMed.images.length ? selectedMed.images : [selectedMed.img]).filter(Boolean);
    return arr;
  }, [selectedMed]);

  const totalResults = pharmacySections.reduce((s, sec) => s + sec.medicines.length, 0);

  return (
    <div style={{ minHeight: "100vh", maxWidth: 480, margin: "0 auto", background: "#F2F7F4", paddingBottom: 100, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(160deg, ${DEEP} 0%, #0A4631 100%)`,
        padding: "52px 18px 20px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,217,126,0.12) 0%, transparent 70%)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
          >
            <ArrowLeft style={{ width: 18, height: 18, color: "#fff" }} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>
              Search Results
            </div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, color: "#fff" }}>
              "{query}"
            </div>
          </div>
          {!loading && totalResults > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: DEEP, background: ACCENT, padding: "4px 12px", borderRadius: 100 }}>
              {totalResults} found
            </span>
          )}
        </div>

        {/* Search bar */}
        <div
          onClick={() => navigate("/search")}
          style={{
            height: 46, background: "#fff", borderRadius: 13,
            display: "flex", alignItems: "center", gap: 10, padding: "0 14px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)", cursor: "pointer",
          }}
        >
          <Search style={{ width: 16, height: 16, color: "#94A3B8", flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 14, color: "#94A3B8", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
            {query || "Search medicines..."}
          </span>
          {query && (
            <button onClick={(e) => { e.stopPropagation(); navigate("/search"); }} style={{ background: "none", border: "none", cursor: "pointer" }}>
              <X style={{ width: 14, height: 14, color: "#94A3B8" }} />
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        {/* Suggestions */}
        <AnimatePresence>
          {autoSuggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              style={{ marginBottom: 18 }}
            >
              <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                {autoSuggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => handleSuggestionClick(s)}
                    style={{
                      flexShrink: 0, height: 32, padding: "0 14px",
                      borderRadius: 100, cursor: "pointer",
                      background: "#fff", color: DEEP,
                      border: `1.5px solid rgba(12,90,62,0.18)`,
                      fontSize: 12, fontWeight: 600,
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                      boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", border: `3px solid ${DEEP}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite", marginBottom: 14 }} />
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700, color: DEEP }}>Searching...</div>
          </div>
        )}

        {/* No results */}
        {!loading && pharmacySections.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: "center", padding: "50px 20px" }}
          >
            <div style={{ fontSize: 56, marginBottom: 14 }}>🔍</div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800, color: "#0B1F16", marginBottom: 8 }}>
              No medicines found
            </div>
            <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 4 }}>
              No nearby pharmacies have "<strong>{query}</strong>"
            </div>
            <div style={{ fontSize: 12, color: "#94A3B8" }}>Try a different name or check spelling</div>
          </motion.div>
        )}

        {/* Results by pharmacy */}
        {!loading && pharmacySections.map(({ pharmacy, medicines }, idx) => (
          <motion.div
            key={pharmacy._id || idx}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            style={{ marginBottom: 28 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button
                onClick={() => navigate(`/medicines/${pharmacy._id}`)}
                style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
              >
                <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800, color: "#0B1F16", marginBottom: 2 }}>
                  {pharmacy.name}
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>
                  📍 {pharmacy.distanceKm ? `${pharmacy.distanceKm.toFixed(1)} km` : "<1 km"} · {medicines.length} match{medicines.length !== 1 ? "es" : ""}
                </div>
              </button>
              <button
                onClick={() => navigate(`/medicines/${pharmacy._id}`)}
                style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 12, fontWeight: 700, color: DEEP, background: "none", border: "none", cursor: "pointer" }}
              >
                See all <ChevronRight style={{ width: 13, height: 13 }} />
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
              {medicines.map((med, mi) => (
                <MedCard
                  key={med._id || mi}
                  med={med}
                  onAdd={(m) => handleAddToCart(pharmacy, m)}
                  onOpen={(m) => { setSelectedMed({ ...m, pharmacy }); setActiveImg(0); }}
                />
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Med Detail Dialog */}
      <Dialog open={!!selectedMed} onOpenChange={(open) => { if (!open) { setSelectedMed(null); setActiveImg(0); } }}>
        <DialogContent style={{ width: "min(96vw,520px)", padding: 0, borderRadius: 24, overflow: "hidden" }}>
          {selectedMed && (
            <>
              <DialogHeader style={{ padding: "20px 20px 12px" }}>
                <DialogTitle style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, color: DEEP }}>
                  {selectedMed.brand || selectedMed.name}
                </DialogTitle>
              </DialogHeader>
              {/* Gallery */}
              <div style={{ margin: "0 20px", borderRadius: 16, overflow: "hidden", height: 200, background: "#F0F9F4", position: "relative" }}>
                <div
                  style={{ display: "flex", height: "100%", transition: "transform 0.3s", transform: `translateX(-${activeImg * 100}%)` }}
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
                      <div key={i} style={{ minWidth: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {imgSrc ? <img src={imgSrc} alt={selectedMed.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} draggable={false} /> : <div style={{ fontSize: 60 }}>💊</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ padding: "14px 20px 0" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {Array.isArray(selectedMed.category) && selectedMed.category.map((c, i) => <span key={i} style={{ fontSize: 11, fontWeight: 600, color: DEEP, background: "#E8F5EF", padding: "2px 9px", borderRadius: 100 }}>{c}</span>)}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 24, fontWeight: 800, color: DEEP }}>₹{selectedMed.price ?? selectedMed.mrp ?? "--"}</span>
                  {selectedMed.mrp && (selectedMed.price ?? 0) < selectedMed.mrp && (
                    <>
                      <span style={{ fontSize: 13, color: "#CBD5E1", textDecoration: "line-through" }}>₹{selectedMed.mrp}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", background: "#ECFDF5", padding: "2px 8px", borderRadius: 100 }}>
                        {Math.round(((selectedMed.mrp - (selectedMed.price ?? 0)) / selectedMed.mrp) * 100)}% OFF
                      </span>
                    </>
                  )}
                </div>
                {selectedMed.composition && <div style={{ fontSize: 13, color: "#4A6B5A", marginBottom: 4 }}><strong>Composition:</strong> {selectedMed.composition}</div>}
                {selectedMed.company && <div style={{ fontSize: 13, color: "#4A6B5A", marginBottom: 8 }}><strong>Company:</strong> {selectedMed.company}</div>}
                {selectedMed.description && <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>{selectedMed.description}</div>}
              </div>
              <div style={{ padding: "14px 20px 20px", display: "flex", gap: 10 }}>
                <button onClick={() => setSelectedMed(null)} style={{ flex: 1, height: 48, borderRadius: 13, background: "#F8FAFC", color: "#64748B", border: "1.5px solid #E2E8F0", fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Close
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => { handleAddToCart(selectedMed.pharmacy, selectedMed); setSelectedMed(null); }}
                  style={{ flex: 2, height: 48, borderRadius: 13, border: "none", background: `linear-gradient(135deg,${DEEP},${MID})`, color: "#fff", fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(12,90,62,0.3)" }}
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