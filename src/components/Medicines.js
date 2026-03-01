// src/pages/Medicines.js — GoDavaii 2030 Ultra-Modern Full-Width UI
// ✅ ALL LOGIC 100% UNCHANGED — zero business logic changes
// ✅ REMOVED: 88px sidebar → horizontal category chips
// ✅ NEW: Full-width 2-column grid, consistent card heights
// ✅ NEW: Smooth scroll, modern glassmorphism, no congestion
import React, { useEffect, useMemo, useState, useRef } from "react";
import { Dialog, DialogContent } from "../components/ui/dialog";
import { UploadCloud, X, ChevronLeft, ChevronRight, Package, ArrowLeft, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "../context/CartContext";
import { useParams, useNavigate } from "react-router-dom";
import PrescriptionUploadModal from "../components/PrescriptionUploadModal";
import axios from "axios";
import { useLocation } from "../context/LocationContext";
import { CUSTOMER_CATEGORIES } from "../constants/customerCategories";
import { TYPE_OPTIONS } from "../constants/packSizes";
import GenericSuggestionModal from "../components/generics/GenericSuggestionModal";
import { buildCompositionKey } from "../lib/composition";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0C5A3E";
const MID  = "#0E7A4F";
const ACC  = "#00D97E";

const bottomDock = (hasCart) =>
  `calc(${hasCart ? 144 : 72}px + env(safe-area-inset-bottom,0px) + 12px)`;

/* ── Image util (UNCHANGED logic) ─────────────────────────── */
const getImageUrl = (img) => {
  if (!img) return null;
  if (img.startsWith("/uploads/")) return `${API}${img}`;
  if (img.startsWith("http://") || img.startsWith("https://")) return img;
  return null;
};

/* ── MedCardImage ─────────────────────────────────────────── */
function MedCardImage({ src, alt }) {
  const [fail, setFail] = useState(!src);
  if (fail || !src)
    return (
      <div style={{ height: "100%", width: "100%", display: "grid", placeItems: "center", fontSize: 38, background: "linear-gradient(145deg,#EEF7F1,#D8EDE2)", borderRadius: "inherit" }}>
        💊
      </div>
    );
  return <img src={src} alt={alt} style={{ height: "100%", width: "100%", objectFit: "contain", padding: 8 }} onError={() => setFail(true)} />;
}

/* ── ensureDescription (UNCHANGED) ────────────────────────── */
async function ensureDescription(apiBase, medId) {
  try {
    const r = await axios.post(`${apiBase}/api/medicines/${medId}/ensure-description`);
    return r.data?.description || "";
  } catch { return ""; }
}

const allCategories = ["All", ...CUSTOMER_CATEGORIES];

/* ── typeToGroup (UNCHANGED) ──────────────────────────────── */
const typeToGroup = (t) => {
  if (!t) return "Other";
  const s = String(Array.isArray(t) ? t[0] : t).trim();
  if (/^drops?\s*\(/i.test(s)) return "Drops";
  if (/^drop(s)?$/i.test(s)) return "Drops";
  return s;
};

/* ── packLabel (UNCHANGED) ────────────────────────────────── */
const packLabel = (count, unit) => {
  const c = String(count || "").trim();
  const u = String(unit || "").trim().toLowerCase();
  if (!c && !u) return "";
  if (!u) return c;
  const printable =
    u === "ml" || u === "g" ? u
    : Number(c) === 1 ? u.replace(/s$/, "")
    : u.endsWith("s") ? u : `${u}s`;
  return `${c} ${printable}`.trim();
};

/* ── useMedTypeChips (UNCHANGED) ──────────────────────────── */
const useMedTypeChips = (medicines) =>
  useMemo(() => {
    const base = TYPE_OPTIONS.map(typeToGroup).filter((t) => t !== "Other");
    const inv = medicines
      .flatMap((m) => (Array.isArray(m?.type) ? m.type : [m?.type]))
      .map(typeToGroup);
    const unique = Array.from(new Set(["All", ...base, ...inv]));
    const out = unique.filter((t) => t !== "Other");
    out.push("Other");
    return out;
  }, [medicines]);

/* ── Chip component ───────────────────────────────────────── */
function Chip({ label, active, onClick, icon }) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      style={{
        flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5,
        height: 34, padding: icon ? "0 14px 0 10px" : "0 15px",
        borderRadius: 100,
        fontSize: 12, fontWeight: active ? 800 : 600,
        fontFamily: "'Sora',sans-serif",
        color: active ? "#fff" : "#3D5A4A",
        background: active ? `linear-gradient(135deg,${DEEP},${MID})` : "rgba(255,255,255,0.95)",
        border: active ? "none" : "1.5px solid rgba(12,90,62,0.12)",
        boxShadow: active ? "0 4px 14px rgba(12,90,62,0.30)" : "0 1px 4px rgba(0,0,0,0.04)",
        cursor: "pointer", transition: "all 0.15s",
      }}
    >
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      {label}
    </motion.button>
  );
}

/* ── Medicine Card — 2030 Ultra Modern ────────────────────── */
function MedCard({ med, canDeliver, onTap, onAdd }) {
  const hasDiscount = med.mrp && Number(med.price) < Number(med.mrp);
  const discountPct = hasDiscount ? Math.round(((med.mrp - med.price) / med.mrp) * 100) : null;
  const isGeneric = !med.brand || String(med.brand).trim() === "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.97 }}
      style={{
        background: "#fff",
        borderRadius: 20,
        border: "1px solid rgba(12,90,62,0.08)",
        boxShadow: "0 2px 16px rgba(12,90,62,0.06)",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Image area — fixed aspect ratio for consistency */}
      <button
        onClick={onTap}
        style={{
          position: "relative",
          width: "100%", aspectRatio: "4/3",
          background: "linear-gradient(145deg,#F4FAF6,#E8F5EF)",
          border: "none", cursor: "pointer",
          padding: 0, overflow: "hidden",
        }}
      >
        <MedCardImage src={getImageUrl(med.img)} alt={med.name} />

        {/* Top-left badges */}
        <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4 }}>
          {med.prescriptionRequired && (
            <span style={{
              fontSize: 9, fontWeight: 800,
              color: "#DC2626", background: "rgba(254,242,242,0.95)",
              padding: "2px 7px", borderRadius: 100,
              border: "1px solid #FCA5A5",
              backdropFilter: "blur(8px)",
            }}>Rx</span>
          )}
          {isGeneric && (
            <span style={{
              fontSize: 9, fontWeight: 800,
              color: "#065F46", background: "rgba(209,250,229,0.95)",
              padding: "2px 7px", borderRadius: 100,
              border: "1px solid #6EE7B7",
              backdropFilter: "blur(8px)",
            }}>Generic</span>
          )}
        </div>

        {/* Discount badge */}
        {hasDiscount && (
          <div style={{
            position: "absolute", top: 8, right: 8,
            fontSize: 9.5, fontWeight: 800,
            color: "#fff",
            background: `linear-gradient(135deg,#059669,${ACC})`,
            padding: "3px 8px", borderRadius: 100,
            boxShadow: "0 2px 8px rgba(5,150,105,0.35)",
          }}>
            {discountPct}% OFF
          </div>
        )}
      </button>

      {/* Info area */}
      <div style={{ padding: "10px 12px 12px", flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Name */}
        <div
          onClick={onTap}
          title={med.brand || med.name}
          style={{
            fontSize: 13, fontWeight: 700,
            color: "#0B1F16",
            fontFamily: "'Sora',sans-serif",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            cursor: "pointer",
            marginBottom: 3,
            minHeight: 34,
          }}
        >
          {med.brand || med.name}
        </div>

        {/* Company */}
        {med.company && (
          <div style={{
            fontSize: 10.5, color: "#94A3B8", fontWeight: 500,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            marginBottom: 6,
          }}>
            {med.company}
          </div>
        )}

        {/* Price row */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
          <span style={{
            fontFamily: "'Sora',sans-serif",
            fontSize: 17, fontWeight: 800, color: DEEP,
            letterSpacing: "-0.3px",
          }}>
            ₹{med.price}
          </span>
          {med.mrp && Number(med.price) < Number(med.mrp) && (
            <span style={{ fontSize: 11, color: "#CBD5E1", textDecoration: "line-through", fontWeight: 500 }}>
              ₹{med.mrp}
            </span>
          )}
        </div>

        {/* Bottom row: category + add button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
          {Array.isArray(med.category) && med.category[0] ? (
            <span style={{
              fontSize: 9.5, fontWeight: 700,
              color: DEEP, background: "#E8F5EF",
              padding: "3px 8px", borderRadius: 100,
              border: `1px solid ${DEEP}18`,
              maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {med.category[0]}
            </span>
          ) : <span />}

          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => onAdd(med)}
            disabled={!canDeliver}
            style={{
              height: 32, padding: "0 16px",
              borderRadius: 100, border: "none",
              background: canDeliver
                ? `linear-gradient(135deg,${DEEP},${MID})`
                : "#E2E8F0",
              color: canDeliver ? "#fff" : "#94A3B8",
              fontSize: 12, fontWeight: 800,
              fontFamily: "'Sora',sans-serif",
              cursor: canDeliver ? "pointer" : "not-allowed",
              boxShadow: canDeliver ? "0 4px 12px rgba(12,90,62,0.28)" : "none",
            }}
          >
            + Add
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

/* ═════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═════════════════════════════════════════════════════════════ */
export default function Medicines() {
  const { pharmacyId } = useParams();
  const navigate = useNavigate();
  const { cart, addToCart, removeFromCart } = useCart();
  const { currentAddress } = useLocation();
  const scrollRef = useRef(null);

  /* ── State (ALL UNCHANGED) ─────────────────────────────── */
  const [pharmacy, setPharmacy]         = useState(null);
  const [medicines, setMedicines]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const BRAND_KINDS = ["All", "Branded", "Generic"];
  const [selectedKind, setSelectedKind] = useState("All");
  const [selectedMed, setSelectedMed]   = useState(null);
  const [uploadOpen, setUploadOpen]     = useState(false);
  const [canDeliver, setCanDeliver]     = useState(true);
  const [genericSugg, setGenericSugg]   = useState({ open: false, brand: null, generics: [] });
  const [activeImg, setActiveImg]       = useState(0);
  const [showSearch, setShowSearch]     = useState(false);
  const [searchQ, setSearchQ]           = useState("");

  /* ── Generic helpers (ALL UNCHANGED) ───────────────────── */
  const isGenericItem = (m) =>
    m?.productKind === "generic" || !m?.brand || String(m.brand).trim() === "";
  const compKeyOf = (m) => buildCompositionKey(m?.composition || "");
  const samePack = (a, b) => {
    if (!a || !b) return true;
    const ac = Number(a.packCount || 0), bc = Number(b.packCount || 0);
    const au = String(a.packUnit || "").toLowerCase();
    const bu = String(b.packUnit || "").toLowerCase();
    if (ac && bc && ac !== bc) return false;
    if (au && bu && au !== bu) return false;
    return true;
  };
  async function fetchGenericsFromApi(phId, key, brandId) {
    try {
      const url = `${API}/api/pharmacies/${phId}/alternatives?compositionKey=${encodeURIComponent(key)}${brandId ? `&brandId=${brandId}` : ""}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("bad");
      return await r.json();
    } catch { return null; }
  }
  function findGenericsLocally(all, brand) {
    const key = compKeyOf(brand);
    const list = all.filter(
      (m) => !isGenericItem(brand) && isGenericItem(m) && compKeyOf(m) === key &&
        m.status !== "unavailable" && m.available !== false && samePack(m, brand)
    ).sort((a, b) => Number(a.price || a.mrp || 0) - Number(b.price || b.mrp || 0));
    return { brand, generics: list.slice(0, 5) };
  }
  const askedKey = (phId, key) => `GENERIC_ASKED_${phId}_${key}`;
  function shouldAsk(med) {
    if (isGenericItem(med)) return false;
    const key = compKeyOf(med);
    if (!key) return false;
    return !sessionStorage.getItem(askedKey(pharmacyId, key));
  }
  function markAsked(med) {
    const key = compKeyOf(med);
    if (key) sessionStorage.setItem(askedKey(pharmacyId, key), "1");
  }
  async function addWithGenericCheck(med) {
    if (!canDeliver) { alert("Delivery isn't available right now."); return; }
    addToCart(med);
    if (!shouldAsk(med)) return;
    markAsked(med);
    const key = compKeyOf(med);
    let data = await fetchGenericsFromApi(pharmacyId, key, med._id);
    if (!data || !Array.isArray(data.generics) || data.generics.length === 0) {
      data = findGenericsLocally(medicines, med);
    } else { data.brand = data.brand || med; }
    if (data.generics && data.generics.length) {
      setGenericSugg({ open: true, brand: data.brand || med, generics: data.generics });
    }
  }

  const medTypes = useMedTypeChips(medicines);

  /* ── Effects (ALL UNCHANGED) ───────────────────────────── */
  useEffect(() => {
    const lat = Number(currentAddress?.lat);
    const lng = Number(currentAddress?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    fetch(`${API}/api/delivery/active-partner-nearby?lat=${lat}&lng=${lng}`)
      .then((r) => r.json())
      .then((d) => setCanDeliver(!!d.activePartnerExists))
      .catch(() => setCanDeliver(false));
  }, [currentAddress]);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/api/pharmacies?id=${pharmacyId}`);
        if (Array.isArray(r.data)) setPharmacy(r.data[0]);
      } catch { setPharmacy(null); }
    })();
  }, [pharmacyId]);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API}/api/medicines?pharmacyId=${pharmacyId}&onlyAvailable=1`)
      .then((res) => setMedicines(res.data || []))
      .catch(() => setMedicines([]))
      .finally(() => setLoading(false));
  }, [pharmacyId]);

  /* ── Filters (ALL UNCHANGED) ───────────────────────────── */
  const matchCategory = (med, selected) => {
    if (selected === "All") return true;
    if (!med.category) return false;
    if (Array.isArray(med.category)) return med.category.includes(selected);
    return med.category === selected;
  };
  const matchType = (med, selected) => {
    if (selected === "All") return true;
    const types = Array.isArray(med.type) ? med.type : [med.type];
    const groups = types.map(typeToGroup);
    return groups.includes(selected);
  };
  const matchKind = (med, kind) => {
    if (kind === "All") return true;
    if (kind === "Generic") return isGenericItem(med);
    if (kind === "Branded") return !isGenericItem(med);
    return true;
  };

  const filteredMeds = useMemo(() => {
    let meds = medicines
      .filter((m) => m.status !== "unavailable" && m.available !== false)
      .filter((m) => matchCategory(m, selectedCategory) && matchType(m, selectedType))
      .filter((m) => matchKind(m, selectedKind));
    // Local search filter (visual only, no API change)
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase();
      meds = meds.filter((m) => {
        const fields = [m.name, m.brand, m.company, m.composition,
          Array.isArray(m.category) ? m.category.join(" ") : m.category].filter(Boolean).map(String).join(" ").toLowerCase();
        return fields.includes(q);
      });
    }
    return meds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicines, selectedCategory, selectedType, selectedKind, searchQ]);

  /* ── Gallery (UNCHANGED) ───────────────────────────────── */
  const images = useMemo(() => {
    if (!selectedMed) return [];
    const arr = (Array.isArray(selectedMed.images) && selectedMed.images.length
      ? selectedMed.images : [selectedMed.img]
    ).filter(Boolean);
    return arr;
  }, [selectedMed]);

  /* ── openMed helper ────────────────────────────────────── */
  const openMed = async (med) => {
    setSelectedMed(med);
    setActiveImg(0);
    if (!med.description || !med.description.trim()) {
      const desc = await ensureDescription(API, med._id);
      if (desc) {
        setSelectedMed((prev) => (prev ? { ...prev, description: desc } : prev));
        setMedicines((ms) => ms.map((m) => (m._id === med._id ? { ...m, description: desc } : m)));
      }
    }
  };

  const totalCount = filteredMeds.length;

  /* ═══════════════════════════════════════════════════════════
     RENDER — Full-width, no sidebar
     ═══════════════════════════════════════════════════════════ */
  return (
    <div style={{
      position: "relative", height: "100dvh",
      width: "100%", maxWidth: 480, margin: "0 auto",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      background: "#F3F7F5",
      fontFamily: "'Plus Jakarta Sans',sans-serif",
    }}>

      {/* ═══ STICKY HEADER ═══ */}
      <div style={{ flexShrink: 0, zIndex: 20 }}>
        {/* Pharmacy info bar */}
        <div style={{
          padding: "14px 16px 10px",
          background: `linear-gradient(135deg,${DEEP} 0%,#083D28 100%)`,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", right: -40, top: -40, width: 140, height: 140, borderRadius: "50%", background: `radial-gradient(circle,${ACC}12,transparent 65%)`, pointerEvents: "none" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
            <motion.button whileTap={{ scale: 0.90 }} onClick={() => navigate(-1)}
              style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <ArrowLeft style={{ width: 16, height: 16, color: "#fff" }} />
            </motion.button>

            <div style={{ flex: 1, minWidth: 0 }}>
              {pharmacy ? (
                <>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {pharmacy.name}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 1, fontWeight: 500 }}>
                    📍 {pharmacy.area}, {pharmacy.city}
                  </div>
                </>
              ) : (
                <div style={{ height: 20, width: 140, borderRadius: 8, background: "rgba(255,255,255,0.15)", animation: "medPulse 1.5s infinite" }} />
              )}
            </div>

            <motion.button whileTap={{ scale: 0.90 }}
              onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQ(""); }}
              style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0, background: showSearch ? ACC : "rgba(255,255,255,0.10)", border: `1px solid ${showSearch ? ACC : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Search style={{ width: 16, height: 16, color: showSearch ? DEEP : "#fff" }} />
            </motion.button>

            {!loading && totalCount > 0 && (
              <span style={{ fontSize: 10.5, fontWeight: 800, color: DEEP, background: ACC, padding: "4px 12px", borderRadius: 100, flexShrink: 0, fontFamily: "'Sora',sans-serif" }}>
                {totalCount}
              </span>
            )}
          </div>

          {!canDeliver && (
            <div style={{
              marginTop: 10,
              background: "rgba(254,226,226,0.15)", color: "#FCA5A5",
              fontSize: 11.5, fontWeight: 700,
              padding: "7px 12px", borderRadius: 10,
              border: "1px solid rgba(252,165,165,0.25)",
            }}>
              ⛔ No delivery partner available at your location right now.
            </div>
          )}
        </div>

        {/* Inline search bar */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: "hidden", background: "#fff", borderBottom: "1px solid rgba(12,90,62,0.06)" }}
            >
              <div style={{ padding: "8px 16px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", height: 40, borderRadius: 12, background: "#F3F7F5", border: "1.5px solid rgba(12,90,62,0.10)", padding: "0 12px", gap: 8 }}>
                  <Search style={{ width: 14, height: 14, color: "#94A3B8", flexShrink: 0 }} />
                  <input
                    autoFocus
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="Search in this pharmacy..."
                    style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13.5, fontWeight: 600, color: "#0B1F16", fontFamily: "'Plus Jakarta Sans',sans-serif" }}
                  />
                  {searchQ && (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSearchQ("")}
                      style={{ width: 22, height: 22, borderRadius: "50%", background: "#E2E8F0", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <X style={{ width: 11, height: 11, color: "#64748B" }} />
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── FILTER ROWS (replaces 88px sidebar) ──────────── */}
        <div style={{ background: "#fff", borderBottom: "1px solid rgba(12,90,62,0.06)" }}>
          {/* Row 1: Category chips */}
          <div style={{
            display: "flex", gap: 7, overflowX: "auto", padding: "8px 14px 6px",
            scrollbarWidth: "none", msOverflowStyle: "none",
            WebkitMaskImage: "linear-gradient(90deg,#000 90%,transparent)",
            maskImage: "linear-gradient(90deg,#000 90%,transparent)",
          }}>
            {allCategories.map((c) => (
              <Chip
                key={c} label={c}
                active={c === selectedCategory}
                onClick={() => { setSelectedCategory(c); if (scrollRef.current) scrollRef.current.scrollTop = 0; }}
              />
            ))}
          </div>

          {/* Row 2: Kind + Type chips */}
          <div style={{
            display: "flex", gap: 7, overflowX: "auto", padding: "4px 14px 8px",
            scrollbarWidth: "none", msOverflowStyle: "none",
            WebkitMaskImage: "linear-gradient(90deg,#000 90%,transparent)",
            maskImage: "linear-gradient(90deg,#000 90%,transparent)",
          }}>
            {BRAND_KINDS.map((k) => (
              <Chip key={`k-${k}`} label={k} active={k === selectedKind}
                onClick={() => setSelectedKind(k)} />
            ))}
            <div style={{ width: 1.5, height: 22, background: "rgba(12,90,62,0.12)", borderRadius: 1, flexShrink: 0, alignSelf: "center" }} />
            {medTypes.map((t) => (
              <Chip key={`t-${t}`} label={t} active={t === selectedType}
                onClick={() => setSelectedType(t)} />
            ))}
          </div>
        </div>
      </div>

      {/* ═══ SCROLLABLE CONTENT — Full width! ═══ */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: "auto", overflowX: "hidden",
          padding: "12px 12px 140px",
          scrollbarWidth: "none", msOverflowStyle: "none",
        }}
      >
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} style={{
                borderRadius: 20, background: "#fff",
                border: "1px solid rgba(12,90,62,0.06)",
                overflow: "hidden",
              }}>
                <div style={{ aspectRatio: "4/3", background: "linear-gradient(145deg,#F4FAF6,#E8F5EF)", animation: "medPulse 1.5s ease-in-out infinite" }} />
                <div style={{ padding: 12 }}>
                  <div style={{ height: 14, width: "80%", borderRadius: 6, background: "#E8F0EC", marginBottom: 8, animation: "medPulse 1.5s ease-in-out infinite" }} />
                  <div style={{ height: 10, width: "50%", borderRadius: 6, background: "#F0F5F2", marginBottom: 10, animation: "medPulse 1.5s ease-in-out infinite" }} />
                  <div style={{ height: 18, width: "40%", borderRadius: 6, background: "#E8F0EC", animation: "medPulse 1.5s ease-in-out infinite" }} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredMeds.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: "center", padding: "60px 24px" }}>
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontSize: 56, marginBottom: 16 }}>🔍</motion.div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800, color: "#0B1F16", marginBottom: 8 }}>
              No medicines found
            </div>
            <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>
              Try a different category, type, or clear your filters
            </div>
            <motion.button whileTap={{ scale: 0.95 }}
              onClick={() => { setSelectedCategory("All"); setSelectedType("All"); setSelectedKind("All"); setSearchQ(""); }}
              style={{ marginTop: 18, height: 40, padding: "0 24px", borderRadius: 100, border: "none", background: `linear-gradient(135deg,${DEEP},${MID})`, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'Sora',sans-serif", cursor: "pointer", boxShadow: "0 4px 14px rgba(12,90,62,0.25)" }}>
              Clear all filters
            </motion.button>
          </motion.div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {filteredMeds.map((med, idx) => (
              <motion.div
                key={med._id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.02, 0.3), duration: 0.25 }}
              >
                <MedCard
                  med={med}
                  canDeliver={canDeliver}
                  onTap={() => openMed(med)}
                  onAdd={(m) => addWithGenericCheck(m)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ Medicine Detail Dialog (UNCHANGED logic) ═══ */}
      <Dialog
        open={!!selectedMed}
        onOpenChange={(open) => { if (!open) { setSelectedMed(null); setActiveImg(0); } }}
      >
        <DialogContent style={{
          width: "min(96vw,520px)",
          padding: 0, overflow: "hidden",
          borderRadius: 24, border: "none",
        }}>
          {selectedMed && (
            <div>
              <div style={{
                padding: "18px 20px 14px",
                background: `linear-gradient(135deg,${DEEP},${MID})`,
                position: "relative",
              }}>
                <button
                  onClick={() => setSelectedMed(null)}
                  style={{
                    position: "absolute", top: 14, right: 14,
                    width: 30, height: 30, borderRadius: "50%",
                    background: "rgba(255,255,255,0.15)",
                    border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <X style={{ width: 15, height: 15, color: "#fff" }} />
                </button>
                <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, color: "#fff", paddingRight: 40, lineHeight: 1.3 }}>
                  {selectedMed.brand || selectedMed.name}
                </div>
                {selectedMed.company && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{selectedMed.company}</div>
                )}
              </div>

              <div style={{ padding: "14px 16px 0" }}>
                <div style={{
                  position: "relative", width: "100%", height: 240,
                  borderRadius: 18,
                  background: "linear-gradient(145deg,#F4FAF6,#E8F5EF)",
                  overflow: "hidden",
                }}>
                  <div
                    style={{
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
                    }}
                  >
                    {images.map((src, i) => {
                      const imgSrc = getImageUrl(src);
                      return (
                        <div key={i} style={{ minWidth: "100%", height: "100%", display: "grid", placeItems: "center" }}>
                          {imgSrc ? <img src={imgSrc} alt={selectedMed.name} style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} draggable={false} /> : <div style={{ fontSize: 56 }}>💊</div>}
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
                    </>
                  )}

                  {images.length > 1 && (
                    <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
                      {images.map((_, i) => (
                        <span key={i} onClick={() => setActiveImg(i)}
                          style={{ height: 6, borderRadius: 100, cursor: "pointer", transition: "all 0.2s", width: i === activeImg ? 22 : 6, background: i === activeImg ? DEEP : "rgba(12,90,62,0.25)" }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: "14px 16px 0", maxHeight: 280, overflowY: "auto" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
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
                  {(selectedMed.packCount || selectedMed.packUnit) && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#4A6B5A", background: "#F0F9F4", padding: "3px 10px", borderRadius: 100, border: "1px solid rgba(12,90,62,0.15)", display: "flex", alignItems: "center", gap: 4 }}>
                      <Package style={{ width: 10, height: 10 }} />
                      {packLabel(selectedMed.packCount, selectedMed.packUnit)}
                    </span>
                  )}
                  {selectedMed.prescriptionRequired && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", background: "#FEF2F2", padding: "3px 10px", borderRadius: 100, border: "1px solid #FCA5A5" }}>
                      Rx Required
                    </span>
                  )}
                </div>

                {[
                  selectedMed.composition && { label: "Composition", val: selectedMed.composition },
                  selectedMed.company && { label: "Company", val: selectedMed.company },
                  (selectedMed.packCount || selectedMed.packUnit) && { label: "Pack Size", val: packLabel(selectedMed.packCount, selectedMed.packUnit) },
                  { label: "Prescription", val: selectedMed.prescriptionRequired ? "Required" : "Not Required" },
                ].filter(Boolean).map(({ label, val }) => (
                  <div key={label} style={{ fontSize: 13, color: "#374151", marginBottom: 6, display: "flex", gap: 6 }}>
                    <span style={{ fontWeight: 700, color: "#6B7280", minWidth: 90, flexShrink: 0 }}>{label}:</span>
                    <span>{val}</span>
                  </div>
                ))}

                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0" }}>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 26, fontWeight: 800, color: DEEP }}>
                    ₹{selectedMed.price}
                  </span>
                  {selectedMed.mrp && selectedMed.price < selectedMed.mrp && (
                    <>
                      <span style={{ fontSize: 14, color: "#CBD5E1", textDecoration: "line-through" }}>₹{selectedMed.mrp}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: `linear-gradient(135deg,${DEEP},${MID})`, padding: "3px 10px", borderRadius: 100 }}>
                        {Math.round(((selectedMed.mrp - selectedMed.price) / selectedMed.mrp) * 100)}% OFF
                      </span>
                    </>
                  )}
                </div>

                <div style={{
                  fontSize: 13, color: "#374151", lineHeight: 1.7, marginBottom: 16,
                  whiteSpace: "pre-line", background: "#F8FBFA", borderRadius: 12, padding: "10px 12px",
                }}>
                  {selectedMed.description || <span style={{ color: "#94A3B8" }}>No description available.</span>}
                </div>
              </div>

              <div style={{ padding: "12px 16px 16px", display: "flex", gap: 10, borderTop: "1px solid rgba(12,90,62,0.08)" }}>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setSelectedMed(null)}
                  style={{ flex: 1, height: 48, borderRadius: 14, border: "1.5px solid rgba(12,90,62,0.15)", background: "#F8FBFA", color: "#374151", fontSize: 14, fontWeight: 700, fontFamily: "'Sora',sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  <X style={{ width: 14, height: 14 }} /> Close
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} disabled={!canDeliver}
                  onClick={async () => { await addWithGenericCheck(selectedMed); setSelectedMed(null); }}
                  style={{ flex: 2, height: 48, borderRadius: 14, border: "none", background: canDeliver ? `linear-gradient(135deg,${DEEP},${MID})` : "#E2E8F0", color: canDeliver ? "#fff" : "#94A3B8", fontSize: 14, fontWeight: 800, fontFamily: "'Sora',sans-serif", cursor: canDeliver ? "pointer" : "not-allowed", boxShadow: canDeliver ? "0 4px 16px rgba(12,90,62,0.35)" : "none" }}>
                  Add to Cart 🛒
                </motion.button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Generic Suggestion Modal (UNCHANGED) ═══ */}
      <GenericSuggestionModal
        open={genericSugg.open}
        onOpenChange={(o) => setGenericSugg((s) => ({ ...s, open: o }))}
        brand={genericSugg.brand}
        generics={genericSugg.generics}
        onReplace={(g) => {
          const qty = (cart.find((i) => (i._id || i.id) === (genericSugg.brand?._id || genericSugg.brand?.id))?.quantity) || 1;
          const phId = genericSugg.brand?.pharmacy || pharmacyId || cart[0]?.pharmacy;
          const withPharmacy = { ...g, pharmacy: g.pharmacy || phId };
          removeFromCart(genericSugg.brand);
          for (let k = 0; k < qty; k++) addToCart(withPharmacy);
          setGenericSugg({ open: false, brand: null, generics: [] });
        }}
        onAddAlso={(g) => {
          const phId = genericSugg.brand?.pharmacy || pharmacyId || cart[0]?.pharmacy;
          const withPharmacy = { ...g, pharmacy: g.pharmacy || phId };
          addToCart(withPharmacy);
          setGenericSugg({ open: false, brand: null, generics: [] });
        }}
        onKeep={() => setGenericSugg({ open: false, brand: null, generics: [] })}
      />

      {/* ═══ Upload Prescription FAB (UNCHANGED logic) ═══ */}
      <motion.div
        style={{
          position: "fixed", left: 0, right: 0, zIndex: 1201,
          display: "flex", justifyContent: "flex-end",
          paddingRight: 16,
          bottom: bottomDock((cart?.length || 0) > 0),
          pointerEvents: uploadOpen ? "none" : "auto",
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {!uploadOpen && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            aria-label="Upload Prescription"
            onClick={() => setUploadOpen(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              height: 50, paddingLeft: 12, paddingRight: 22,
              borderRadius: 100, border: "none",
              background: `linear-gradient(135deg,${DEEP},${MID})`,
              color: "#fff", cursor: "pointer",
              boxShadow: "0 8px 28px rgba(12,90,62,0.40)",
              fontFamily: "'Sora',sans-serif",
              position: "relative", overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,rgba(255,255,255,0.12),transparent 60%)", pointerEvents: "none" }} />
            <span style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.15)" }}>
              <UploadCloud style={{ width: 16, height: 16, color: "#fff" }} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, position: "relative", zIndex: 1 }}>Upload Prescription</span>
          </motion.button>
        )}
      </motion.div>

      <PrescriptionUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        userCity={localStorage.getItem("city") || "Delhi"}
      />

      <style>{`
        @keyframes medPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}