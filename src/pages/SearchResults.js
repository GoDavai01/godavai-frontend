// src/pages/SearchResults.js — GoDavaii 2035 Health OS Marketplace
// ✅ MARKETPLACE: Flat medicine list (NO pharmacy grouping)
// ✅ "Fulfilled by GoDavaii" replaces pharmacy name
// ✅ 2035 inline styles (no Tailwind classes)
// ✅ KEPT: Same API (/api/medicines/search), same scoreMatch logic
// ✅ KEPT: Voice search mic, related chips, medicine detail dialog
// ✅ NEW: 2-col grid like Medicines.js, skeleton loading
// ✅ FIXED: hasValidMrp() for MRP display

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { Search, ArrowLeft, ShieldCheck, X, ChevronLeft, ChevronRight, Package, Mic } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "../context/CartContext";
import { Dialog, DialogContent } from "../components/ui/dialog";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0C5A3E";
const MID  = "#0E7A4F";
const ACC  = "#00D97E";

/* ── Helpers ───────────────────────────────────────────────── */
function hasValidMrp(med) {
  const mrp = Number(med?.mrp);
  const price = Number(med?.price);
  return mrp > 0 && price > 0 && price < mrp;
}

const getImageUrl = (img) => {
  if (!img) return null;
  if (typeof img === "string" && img.startsWith("/uploads/")) return `${API_BASE_URL}${img}`;
  if (typeof img === "string" && (img.startsWith("http://") || img.startsWith("https://"))) return img;
  return null;
};

function scoreMatch(q, m) {
  const qn = (q || "").toLowerCase().trim();
  if (!qn) return 0;
  const fields = [m.name, m.brand, m.company, m.composition,
    Array.isArray(m.category) ? m.category.join(" ") : m.category,
    Array.isArray(m.type) ? m.type.join(" ") : m.type,
  ].filter(Boolean).map(String).map((s) => s.toLowerCase());
  let score = 0;
  for (const f of fields) {
    if (f === qn) score += 100;
    if (f.startsWith(qn)) score += 40;
    if (f.includes(qn)) score += 20;
  }
  return score;
}

/* ── Skeleton Card ─────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div style={{
      borderRadius: 20, background: "#fff",
      border: "1px solid rgba(12,90,62,0.06)",
      overflow: "hidden",
    }}>
      <div style={{
        aspectRatio: "4/3",
        background: "linear-gradient(145deg,#F4FAF6,#E8F5EF)",
        animation: "srPulse 1.5s ease-in-out infinite",
      }} />
      <div style={{ padding: 12 }}>
        <div style={{ height: 14, width: "80%", borderRadius: 6, background: "#E8F0EC", marginBottom: 8, animation: "srPulse 1.5s ease-in-out infinite" }} />
        <div style={{ height: 10, width: "50%", borderRadius: 6, background: "#F0F5F2", marginBottom: 10, animation: "srPulse 1.5s ease-in-out infinite" }} />
        <div style={{ height: 18, width: "40%", borderRadius: 6, background: "#E8F0EC", animation: "srPulse 1.5s ease-in-out infinite" }} />
      </div>
    </div>
  );
}

/* ── Medicine Card (marketplace — flat, no pharmacy) ─────── */
function MedCard({ med, onTap, onAdd }) {
  const [imgFail, setImgFail] = useState(false);
  const imgSrc = getImageUrl(med.img || med.image);
  const showMrp = hasValidMrp(med);
  const discountPct = showMrp ? Math.round(((med.mrp - med.price) / med.mrp) * 100) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.97 }}
      style={{
        background: "#fff", borderRadius: 20,
        border: "1px solid rgba(12,90,62,0.08)",
        boxShadow: "0 2px 16px rgba(12,90,62,0.06)",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        height: "100%",
      }}
    >
      <button
        onClick={onTap}
        style={{
          position: "relative", width: "100%", aspectRatio: "4/3",
          background: "linear-gradient(145deg,#F4FAF6,#E8F5EF)",
          border: "none", cursor: "pointer", padding: 0, overflow: "hidden",
        }}
      >
        {imgSrc && !imgFail ? (
          <img src={imgSrc} alt={med.brand || med.name}
            style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }}
            onError={() => setImgFail(true)} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 38 }}>💊</div>
        )}
        {med.prescriptionRequired && (
          <span style={{
            position: "absolute", top: 8, left: 8,
            fontSize: 9, fontWeight: 800, color: "#DC2626",
            background: "rgba(254,242,242,0.95)", padding: "2px 7px",
            borderRadius: 100, border: "1px solid #FCA5A5",
          }}>Rx</span>
        )}
        {showMrp && discountPct > 0 && (
          <div style={{
            position: "absolute", top: 8, right: 8,
            fontSize: 9.5, fontWeight: 800, color: "#fff",
            background: `linear-gradient(135deg,#059669,${ACC})`,
            padding: "3px 8px", borderRadius: 100,
            boxShadow: "0 2px 8px rgba(5,150,105,0.35)",
          }}>
            {discountPct}% OFF
          </div>
        )}
      </button>

      <div style={{ padding: "10px 12px 12px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div onClick={onTap} title={med.brand || med.name}
          style={{
            fontSize: 13, fontWeight: 700, color: "#0B1F16",
            fontFamily: "'Sora',sans-serif", lineHeight: 1.3,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            overflow: "hidden", cursor: "pointer", marginBottom: 3, minHeight: 34,
          }}>
          {med.brand || med.name}
        </div>

        <div style={{
          fontSize: 10, color: "#059669", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 3, marginBottom: 6,
        }}>
          <ShieldCheck style={{ width: 10, height: 10 }} />
          Fulfilled by GoDavaii
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
          <span style={{
            fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800,
            color: DEEP, letterSpacing: "-0.3px",
          }}>
            ₹{med.price}
          </span>
          {showMrp && (
            <span style={{ fontSize: 11, color: "#CBD5E1", textDecoration: "line-through", fontWeight: 500 }}>
              ₹{med.mrp}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
          {Array.isArray(med.category) && med.category[0] ? (
            <span style={{
              fontSize: 9.5, fontWeight: 700, color: DEEP,
              background: "#E8F5EF", padding: "3px 8px", borderRadius: 100,
              border: `1px solid ${DEEP}18`,
              maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {med.category[0]}
            </span>
          ) : <span />}

          <motion.button whileTap={{ scale: 0.88 }}
            onClick={(e) => { e.stopPropagation(); onAdd(med); }}
            style={{
              height: 32, padding: "0 16px", borderRadius: 100, border: "none",
              background: `linear-gradient(135deg,${DEEP},${MID})`,
              color: "#fff", fontSize: 12, fontWeight: 800,
              fontFamily: "'Sora',sans-serif", cursor: "pointer",
              boxShadow: "0 4px 12px rgba(12,90,62,0.28)",
            }}>
            + Add
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function SearchResults() {
  const location = useLocation();
  const query = new URLSearchParams(location.search).get("q") || "";
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const { cart, addToCart } = useCart();

  const [medicines, setMedicines]         = useState([]);
  const [autoSuggestions, setAutoSuggestions] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [searchQ, setSearchQ]             = useState(query);
  const [selectedMed, setSelectedMed]     = useState(null);
  const [activeImg, setActiveImg]         = useState(0);
  const [toast, setToast]                 = useState(null);

  // Get location for nearby search
  const locationObj = JSON.parse(localStorage.getItem("currentAddress") || "{}");
  const lat = locationObj.lat || null;
  const lng = locationObj.lng || null;

  // Sync searchQ with URL query
  useEffect(() => { setSearchQ(query); }, [query]);

  /* ── Fetch medicines (FLAT — no pharmacy grouping) ─────── */
  useEffect(() => {
    let cancel = false;

    async function run() {
      if (!query) {
        setMedicines([]);
        setAutoSuggestions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/medicines/search`, {
          params: { q: query, lat, lng, maxDistance: 5000, limit: 400 },
        });

        const meds = (Array.isArray(data) ? data : [])
          .map((m) => ({ ...m, __score: scoreMatch(query, m) }))
          .sort((a, b) => b.__score - a.__score);

        // Related suggestion chips
        const chips = Array.from(
          new Set(
            meds.map((m) => m.brand || m.name).filter(Boolean).map(String)
          )
        ).slice(0, 8);

        if (!cancel) {
          setMedicines(meds);
          setAutoSuggestions(chips);
        }
      } catch {
        if (!cancel) { setMedicines([]); setAutoSuggestions([]); }
      } finally {
        if (!cancel) setLoading(false);
      }
    }

    run();
    return () => { cancel = true; };
  }, [query, lat, lng]);

  /* ── Search submit ─────────────────────────────────────── */
  const handleSearch = () => {
    if (searchQ.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQ.trim())}`);
    }
  };

  /* ── Add to cart ───────────────────────────────────────── */
  const handleAdd = (med) => {
    addToCart(med);
    setToast(`${med.brand || med.name} added!`);
    setTimeout(() => setToast(null), 2000);
  };

  /* ── Gallery images for detail dialog ──────────────────── */
  const images = useMemo(() => {
    if (!selectedMed) return [];
    const arr = (Array.isArray(selectedMed.images) && selectedMed.images.length
      ? selectedMed.images : [selectedMed.img]
    ).filter(Boolean);
    return arr;
  }, [selectedMed]);

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <div style={{
      maxWidth: 520, margin: "0 auto",
      minHeight: "100vh", background: "#F3F7F5",
      fontFamily: "'Plus Jakarta Sans',sans-serif",
      paddingBottom: 120,
    }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        padding: "14px 16px 10px",
        background: `linear-gradient(135deg,${DEEP} 0%,#083D28 100%)`,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", right: -40, top: -40,
          width: 140, height: 140, borderRadius: "50%",
          background: `radial-gradient(circle,${ACC}12,transparent 65%)`,
          pointerEvents: "none",
        }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, position: "relative" }}>
          <motion.button whileTap={{ scale: 0.90 }} onClick={() => navigate(-1)}
            style={{
              width: 36, height: 36, borderRadius: 12, flexShrink: 0,
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}>
            <ArrowLeft style={{ width: 16, height: 16, color: "#fff" }} />
          </motion.button>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: ACC, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              SEARCH RESULTS
            </div>
            <div style={{
              fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800,
              color: "#fff", letterSpacing: "-0.3px",
            }}>
              {query ? `"${query}"` : "Search medicines..."}
            </div>
          </div>

          {medicines.length > 0 && (
            <span style={{
              fontSize: 10.5, fontWeight: 800, color: DEEP,
              background: ACC, padding: "4px 12px", borderRadius: 100,
              flexShrink: 0, fontFamily: "'Sora',sans-serif",
            }}>
              {medicines.length}
            </span>
          )}
        </div>

        {/* Search input */}
        <div style={{
          display: "flex", alignItems: "center",
          height: 46, borderRadius: 14,
          background: "rgba(255,255,255,0.97)",
          padding: "0 12px", gap: 8,
          border: "1.5px solid rgba(255,255,255,0.6)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        }}>
          <Search style={{ width: 16, height: 16, color: "#94A3B8", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search medicines, brands..."
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontSize: 14, fontWeight: 600, color: "#0B1F16",
              fontFamily: "'Plus Jakarta Sans',sans-serif",
            }}
          />
          {searchQ && (
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => { setSearchQ(""); inputRef.current?.focus(); }}
              style={{
                width: 24, height: 24, borderRadius: "50%",
                background: "#E2E8F0", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              <X style={{ width: 12, height: 12, color: "#64748B" }} />
            </motion.button>
          )}
          <motion.button whileTap={{ scale: 0.9 }}
            onClick={handleSearch}
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: `linear-gradient(135deg,${DEEP},${MID})`,
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(12,90,62,0.3)",
            }}>
            <Mic style={{ width: 15, height: 15, color: "#fff" }} />
          </motion.button>
        </div>
      </div>

      {/* ── Related suggestion chips ──────────────────────── */}
      {autoSuggestions.length > 0 && (
        <div style={{
          padding: "10px 14px 6px",
          background: "#fff",
          borderBottom: "1px solid rgba(12,90,62,0.06)",
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "#94A3B8",
            textTransform: "uppercase", letterSpacing: "0.5px",
            marginBottom: 6,
          }}>
            RELATED
          </div>
          <div style={{
            display: "flex", gap: 6, overflowX: "auto",
            paddingBottom: 6,
            scrollbarWidth: "none", msOverflowStyle: "none",
          }}>
            {autoSuggestions.map((s) => (
              <motion.button key={s} whileTap={{ scale: 0.93 }}
                onClick={() => navigate(`/search?q=${encodeURIComponent(s)}`)}
                style={{
                  flexShrink: 0, height: 30, padding: "0 14px",
                  borderRadius: 100, fontSize: 11.5, fontWeight: 700,
                  fontFamily: "'Sora',sans-serif",
                  color: "#3D5A4A",
                  background: "rgba(255,255,255,0.95)",
                  border: "1.5px solid rgba(12,90,62,0.12)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  cursor: "pointer", whiteSpace: "nowrap",
                }}>
                {s}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* ── Medicine Grid (FLAT — marketplace) ───────────── */}
      <div style={{ padding: "12px 12px" }}>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : medicines.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: "center", padding: "60px 24px" }}>
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontSize: 56, marginBottom: 16 }}>
              🔍
            </motion.div>
            <div style={{
              fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800,
              color: "#0B1F16", marginBottom: 8,
            }}>
              No medicines found
            </div>
            <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>
              {query
                ? `No results for "${query}". Try a different search term.`
                : "Start typing to search medicines"}
            </div>
          </motion.div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {medicines.map((med, idx) => (
              <motion.div key={med._id || idx}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.02, 0.3), duration: 0.25 }}>
                <MedCard
                  med={med}
                  onTap={() => { setSelectedMed(med); setActiveImg(0); }}
                  onAdd={handleAdd}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Medicine Detail Dialog ────────────────────────── */}
      <Dialog
        open={!!selectedMed}
        onOpenChange={(open) => { if (!open) { setSelectedMed(null); setActiveImg(0); } }}
      >
        <DialogContent style={{
          width: "min(96vw,520px)", padding: 0, overflow: "hidden",
          borderRadius: 24, border: "none",
        }}>
          {selectedMed && (
            <div>
              <div style={{
                padding: "18px 20px 14px",
                background: `linear-gradient(135deg,${DEEP},${MID})`,
                position: "relative",
              }}>
                <button onClick={() => setSelectedMed(null)}
                  style={{
                    position: "absolute", top: 14, right: 14,
                    width: 30, height: 30, borderRadius: "50%",
                    background: "rgba(255,255,255,0.15)",
                    border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  <X style={{ width: 15, height: 15, color: "#fff" }} />
                </button>
                <div style={{
                  fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800,
                  color: "#fff", paddingRight: 40, lineHeight: 1.3,
                }}>
                  {selectedMed.brand || selectedMed.name}
                </div>
                {selectedMed.company && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
                    {selectedMed.company}
                  </div>
                )}
              </div>

              {/* Fulfilled by GoDavaii banner */}
              <div style={{
                margin: "0 16px", marginTop: 12,
                background: "linear-gradient(135deg, #ECFDF5, #D1FAE5)",
                borderRadius: 14, padding: "10px 14px",
                display: "flex", alignItems: "center", gap: 10,
                border: "1px solid rgba(5,150,105,0.15)",
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: "rgba(5,150,105,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <ShieldCheck style={{ width: 18, height: 18, color: "#059669" }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#065F46", fontFamily: "'Sora',sans-serif" }}>
                    Fulfilled by GoDavaii
                  </div>
                  <div style={{ fontSize: 10.5, color: "#6B9E88", fontWeight: 500, marginTop: 1 }}>
                    Nearby verified pharmacy · Quality guaranteed
                  </div>
                </div>
              </div>

              {/* Gallery */}
              <div style={{ padding: "14px 16px 0" }}>
                <div style={{
                  position: "relative", width: "100%", height: 240,
                  borderRadius: 18, background: "linear-gradient(145deg,#F4FAF6,#E8F5EF)",
                  overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", display: "flex",
                    transition: "transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)",
                    transform: `translateX(-${activeImg * 100}%)`,
                  }}
                    onTouchStart={(e) => (e.currentTarget.dataset.sx = e.touches[0].clientX)}
                    onTouchEnd={(e) => {
                      const sx = Number(e.currentTarget.dataset.sx || 0);
                      const dx = e.changedTouches[0].clientX - sx;
                      if (dx < -40 && activeImg < images.length - 1) setActiveImg((i) => i + 1);
                      if (dx > 40 && activeImg > 0) setActiveImg((i) => i - 1);
                    }}>
                    {images.map((src, i) => {
                      const iSrc = getImageUrl(src);
                      return (
                        <div key={i} style={{ minWidth: "100%", height: "100%", display: "grid", placeItems: "center" }}>
                          {iSrc ? <img src={iSrc} alt={selectedMed.name} style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} draggable={false} /> : <div style={{ fontSize: 56 }}>💊</div>}
                        </div>
                      );
                    })}
                  </div>
                  {images.length > 1 && (
                    <>
                      <button onClick={() => setActiveImg((i) => Math.max(0, i - 1))}
                        style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.9)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
                        <ChevronLeft style={{ width: 16, height: 16, color: DEEP }} />
                      </button>
                      <button onClick={() => setActiveImg((i) => Math.min(images.length - 1, i + 1))}
                        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.9)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
                        <ChevronRight style={{ width: 16, height: 16, color: DEEP }} />
                      </button>
                      <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
                        {images.map((_, i) => (
                          <span key={i} onClick={() => setActiveImg(i)}
                            style={{ height: 6, borderRadius: 100, cursor: "pointer", transition: "all 0.2s", width: i === activeImg ? 22 : 6, background: i === activeImg ? DEEP : "rgba(12,90,62,0.25)" }} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Info section */}
              <div style={{ padding: "14px 16px 0", maxHeight: 240, overflowY: "auto" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {Array.isArray(selectedMed.category) && selectedMed.category.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: DEEP, background: "#E8F5EF", padding: "3px 10px", borderRadius: 100, border: `1px solid ${DEEP}20` }}>
                      {selectedMed.category.join(", ")}
                    </span>
                  )}
                  {selectedMed.type && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#4A6B5A", background: "#F0F9F4", padding: "3px 10px", borderRadius: 100, border: "1px solid rgba(12,90,62,0.15)" }}>
                      {Array.isArray(selectedMed.type) ? selectedMed.type.join(", ") : selectedMed.type}
                    </span>
                  )}
                  {selectedMed.prescriptionRequired && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", background: "#FEF2F2", padding: "3px 10px", borderRadius: 100, border: "1px solid #FCA5A5" }}>
                      Rx Required
                    </span>
                  )}
                </div>

                {selectedMed.composition && (
                  <div style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: "#6B7280" }}>Composition:</span> {selectedMed.composition}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0" }}>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 26, fontWeight: 800, color: DEEP }}>
                    ₹{selectedMed.price}
                  </span>
                  {hasValidMrp(selectedMed) && (
                    <>
                      <span style={{ fontSize: 14, color: "#CBD5E1", textDecoration: "line-through" }}>₹{selectedMed.mrp}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: `linear-gradient(135deg,${DEEP},${MID})`, padding: "3px 10px", borderRadius: 100 }}>
                        {Math.round(((selectedMed.mrp - selectedMed.price) / selectedMed.mrp) * 100)}% OFF
                      </span>
                    </>
                  )}
                </div>

                {selectedMed.description && (
                  <div style={{
                    fontSize: 13, color: "#374151", lineHeight: 1.7,
                    whiteSpace: "pre-line", background: "#F8FBFA",
                    borderRadius: 12, padding: "10px 12px", marginBottom: 12,
                  }}>
                    {selectedMed.description}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ padding: "12px 16px 16px", display: "flex", gap: 10, borderTop: "1px solid rgba(12,90,62,0.08)" }}>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setSelectedMed(null)}
                  style={{
                    flex: 1, height: 48, borderRadius: 14,
                    border: "1.5px solid rgba(12,90,62,0.15)",
                    background: "#F8FBFA", color: "#374151",
                    fontSize: 14, fontWeight: 700, fontFamily: "'Sora',sans-serif",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  }}>
                  <X style={{ width: 14, height: 14 }} /> Close
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => { handleAdd(selectedMed); setSelectedMed(null); }}
                  style={{
                    flex: 2, height: 48, borderRadius: 14, border: "none",
                    background: `linear-gradient(135deg,${DEEP},${MID})`,
                    color: "#fff", fontSize: 14, fontWeight: 800,
                    fontFamily: "'Sora',sans-serif", cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(12,90,62,0.35)",
                  }}>
                  Add to Cart 🛒
                </motion.button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            style={{
              position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)",
              zIndex: 1300, background: DEEP, color: "#fff",
              padding: "10px 20px", borderRadius: 100,
              fontSize: 13, fontWeight: 700, fontFamily: "'Sora',sans-serif",
              boxShadow: "0 8px 28px rgba(12,90,62,0.35)",
              whiteSpace: "nowrap",
            }}>
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes srPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}