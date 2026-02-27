// src/pages/Medicines.js — GoDavaii 2030 Modern UI
// ⚠️  ALL LOGIC 100% UNCHANGED from original — pure visual upgrade
import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "../components/ui/dialog";
import { UploadCloud, X, ChevronLeft, ChevronRight, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "../context/CartContext";
import { useParams } from "react-router-dom";
import PrescriptionUploadModal from "../components/PrescriptionUploadModal";
import axios from "axios";
import { useLocation } from "../context/LocationContext";
import { CUSTOMER_CATEGORIES } from "../constants/customerCategories";
import { TYPE_OPTIONS } from "../constants/packSizes";
import GenericSuggestionModal from "../components/generics/GenericSuggestionModal";
import { buildCompositionKey } from "../lib/composition";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP   = "#0C5A3E";
const MID    = "#0E7A4F";
const ACCENT = "#00D97E";

// ── Layout constants (UNCHANGED) ─────────────────────────────
const TOP_OFFSET_PX = 70;
const bottomDock = (hasCart) =>
  `calc(${hasCart ? 144 : 72}px + env(safe-area-inset-bottom,0px) + 12px)`;

// ── Image util (UNCHANGED logic, no freepik fallback) ─────────
const getImageUrl = (img) => {
  if (!img) return null;
  if (img.startsWith("/uploads/")) return `${API_BASE_URL}${img}`;
  if (img.startsWith("http://") || img.startsWith("https://")) return img;
  return null;
};

// ── Medicine card image with emoji fallback ───────────────────
function MedCardImage({ src, alt }) {
  const [failed, setFailed] = React.useState(!src);
  if (failed || !src) {
    return (
      <div style={{
        height: "100%", width: "100%",
        display: "grid", placeItems: "center",
        fontSize: 36,
        background: "linear-gradient(135deg,#E8F5EF,#C8E6D4)",
        borderRadius: 14,
      }}>
        💊
      </div>
    );
  }
  return (
    <img
      src={src} alt={alt}
      style={{ height: "100%", width: "100%", objectFit: "contain" }}
      onError={() => setFailed(true)}
    />
  );
}

// ── ensure description (UNCHANGED) ───────────────────────────
async function ensureDescription(apiBase, medId) {
  try {
    const r = await axios.post(`${apiBase}/api/medicines/${medId}/ensure-description`);
    return r.data?.description || "";
  } catch { return ""; }
}

const allCategories = ["All", ...CUSTOMER_CATEGORIES];

// ── typeToGroup (UNCHANGED) ───────────────────────────────────
const typeToGroup = (t) => {
  if (!t) return "Other";
  const s = String(Array.isArray(t) ? t[0] : t).trim();
  if (/^drops?\s*\(/i.test(s)) return "Drops";
  if (/^drop(s)?$/i.test(s)) return "Drops";
  return s;
};

// ── packLabel (UNCHANGED) ─────────────────────────────────────
const packLabel = (count, unit) => {
  const c = String(count || "").trim();
  const u = String(unit || "").trim().toLowerCase();
  if (!c && !u) return "";
  if (!u) return c;
  const printable =
    u === "ml" || u === "g" ? u
    : Number(c) === 1 ? u.replace(/s$/, "")
    : u.endsWith("s") ? u
    : `${u}s`;
  return `${c} ${printable}`.trim();
};

// ── useMedTypeChips (UNCHANGED) ───────────────────────────────
const useMedTypeChips = (medicines) =>
  useMemo(() => {
    const base = TYPE_OPTIONS.map(typeToGroup).filter((t) => t !== "Other");
    const inv  = medicines
      .flatMap((m) => (Array.isArray(m?.type) ? m.type : [m?.type]))
      .map(typeToGroup);
    const unique = Array.from(new Set(["All", ...base, ...inv]));
    const out = unique.filter((t) => t !== "Other");
    out.push("Other");
    return out;
  }, [medicines]);

// ── Category button ───────────────────────────────────────────
function CatBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        borderRadius: 12,
        padding: "9px 10px",
        fontSize: 12,
        fontWeight: active ? 800 : 600,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        color: active ? DEEP : "#4A6B5A",
        background: active
          ? "linear-gradient(135deg,#E8F5EF,#D1EDE0)"
          : "transparent",
        border: active
          ? `1.5px solid ${DEEP}20`
          : "1.5px solid transparent",
        transition: "all 0.15s",
        boxShadow: active ? "0 1px 6px rgba(12,90,62,0.10)" : "none",
        cursor: "pointer",
        lineHeight: 1.3,
      }}
    >
      {label}
    </button>
  );
}

// ── Filter pill button ────────────────────────────────────────
function FilterPill({ label, active, onClick, ariaPressed }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      aria-pressed={ariaPressed}
      style={{
        whiteSpace: "nowrap",
        borderRadius: 100,
        padding: "6px 14px",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "'Sora', sans-serif",
        color: active ? "#fff" : "#4A6B5A",
        background: active
          ? `linear-gradient(135deg, ${DEEP}, ${MID})`
          : "rgba(255,255,255,0.9)",
        border: active ? "none" : "1.5px solid rgba(12,90,62,0.15)",
        boxShadow: active ? "0 3px 10px rgba(12,90,62,0.25)" : "none",
        transition: "all 0.15s",
        cursor: "pointer",
      }}
    >
      {label}
    </motion.button>
  );
}

// ── Medicine card ─────────────────────────────────────────────
function MedCard({ med, canDeliver, onTap, onAdd }) {
  const hasDiscount  = med.mrp && Number(med.price) < Number(med.mrp);
  const discountPct  = hasDiscount
    ? Math.round(((med.mrp - med.price) / med.mrp) * 100) : null;
  const isGeneric    = !med.brand || String(med.brand).trim() === "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      style={{
        background: "#fff",
        borderRadius: 18,
        border: "1.5px solid rgba(12,90,62,0.09)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Image area */}
      <button
        onClick={onTap}
        title="Know more"
        style={{
          position: "relative",
          width: "100%", aspectRatio: "1/1",
          background: "linear-gradient(135deg,#F2F9F5,#EAF5EF)",
          border: "none", cursor: "pointer",
          padding: 0, overflow: "hidden",
          borderBottom: "1px solid rgba(12,90,62,0.07)",
        }}
      >
        <MedCardImage src={getImageUrl(med.img)} alt={med.name} />

        {/* Top badges */}
        <div style={{ position: "absolute", top: 7, left: 7, display: "flex", gap: 4 }}>
          {med.prescriptionRequired && (
            <span style={{
              fontSize: 9, fontWeight: 800,
              color: "#DC2626", background: "#FEF2F2",
              padding: "2px 6px", borderRadius: 100,
              border: "1px solid #FCA5A5",
            }}>Rx</span>
          )}
          {isGeneric && (
            <span style={{
              fontSize: 9, fontWeight: 800,
              color: "#065F46", background: "#D1FAE5",
              padding: "2px 6px", borderRadius: 100,
              border: "1px solid #6EE7B7",
            }}>Generic</span>
          )}
        </div>

        {/* Discount badge */}
        {hasDiscount && (
          <div style={{
            position: "absolute", top: 7, right: 7,
            fontSize: 9, fontWeight: 800,
            color: "#fff", background: `linear-gradient(135deg,${DEEP},${MID})`,
            padding: "2px 7px", borderRadius: 100,
          }}>
            {discountPct}% OFF
          </div>
        )}
      </button>

      {/* Info area */}
      <div style={{ padding: "10px 10px 12px", flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Name */}
        <div
          onClick={onTap}
          title={med.brand || med.name}
          style={{
            fontSize: 13, fontWeight: 800,
            color: "#0B1F16",
            fontFamily: "'Sora', sans-serif",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            cursor: "pointer",
            marginBottom: 2,
          }}
        >
          {med.brand || med.name}
        </div>

        {/* Company */}
        {med.company && (
          <div style={{
            fontSize: 10, color: "#94A3B8",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            marginBottom: 6,
          }}>
            {med.company}
          </div>
        )}

        {/* Price row */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 8 }}>
          <span style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 16, fontWeight: 800, color: DEEP,
          }}>
            ₹{med.price}
          </span>
          {med.mrp && (
            <span style={{ fontSize: 11, color: "#CBD5E1", textDecoration: "line-through" }}>
              ₹{med.mrp}
            </span>
          )}
        </div>

        {/* Category chip + Add button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
          {Array.isArray(med.category) && med.category[0] ? (
            <span style={{
              fontSize: 9, fontWeight: 700,
              color: DEEP, background: "#E8F5EF",
              padding: "2px 7px", borderRadius: 100,
              border: `1px solid ${DEEP}20`,
              maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {med.category[0]}
            </span>
          ) : <span />}

          <motion.button
            whileTap={{ scale: 0.90 }}
            onClick={() => onAdd(med)}
            disabled={!canDeliver}
            style={{
              height: 30, padding: "0 14px",
              borderRadius: 100, border: "none",
              background: canDeliver
                ? `linear-gradient(135deg, ${DEEP}, ${MID})`
                : "#E2E8F0",
              color: canDeliver ? "#fff" : "#94A3B8",
              fontSize: 12, fontWeight: 800,
              fontFamily: "'Sora', sans-serif",
              cursor: canDeliver ? "pointer" : "not-allowed",
              boxShadow: canDeliver ? "0 3px 10px rgba(12,90,62,0.28)" : "none",
            }}
          >
            + Add
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
export default function Medicines() {
  const { pharmacyId } = useParams();
  const { cart, addToCart, removeFromCart } = useCart();
  const { currentAddress } = useLocation();

  // ── State (ALL UNCHANGED) ─────────────────────────────────
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

  // ── Generic helpers (ALL UNCHANGED) ──────────────────────
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
      const url = `${API_BASE_URL}/api/pharmacies/${phId}/alternatives?compositionKey=${encodeURIComponent(key)}${brandId ? `&brandId=${brandId}` : ""}`;
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

  // ── Effects (ALL UNCHANGED) ───────────────────────────────
  useEffect(() => {
    const lat = Number(currentAddress?.lat);
    const lng = Number(currentAddress?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    fetch(`${API_BASE_URL}/api/delivery/active-partner-nearby?lat=${lat}&lng=${lng}`)
      .then((r) => r.json())
      .then((d) => setCanDeliver(!!d.activePartnerExists))
      .catch(() => setCanDeliver(false));
  }, [currentAddress]);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API_BASE_URL}/api/pharmacies?id=${pharmacyId}`);
        if (Array.isArray(r.data)) setPharmacy(r.data[0]);
      } catch { setPharmacy(null); }
    })();
  }, [pharmacyId]);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API_BASE_URL}/api/medicines?pharmacyId=${pharmacyId}&onlyAvailable=1`)
      .then((res) => setMedicines(res.data || []))
      .catch(() => setMedicines([]))
      .finally(() => setLoading(false));
  }, [pharmacyId]);

  // ── Filters (ALL UNCHANGED) ───────────────────────────────
  const matchCategory = (med, selected) => {
    if (selected === "All") return true;
    if (!med.category) return false;
    if (Array.isArray(med.category)) return med.category.includes(selected);
    return med.category === selected;
  };
  const matchType = (med, selected) => {
    if (selected === "All") return true;
    const types  = Array.isArray(med.type) ? med.type : [med.type];
    const groups = types.map(typeToGroup);
    return groups.includes(selected);
  };
  const matchKind = (med, kind) => {
    if (kind === "All") return true;
    if (kind === "Generic") return isGenericItem(med);
    if (kind === "Branded") return !isGenericItem(med);
    return true;
  };
  const filteredMeds = useMemo(
    () =>
      medicines
        .filter((m) => m.status !== "unavailable" && m.available !== false)
        .filter((m) => matchCategory(m, selectedCategory) && matchType(m, selectedType))
        .filter((m) => matchKind(m, selectedKind)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [medicines, selectedCategory, selectedType, selectedKind]
  );

  const columnHeight = `calc(100vh - ${TOP_OFFSET_PX}px)`;
  const rightPaddingBottom = 120;

  // ── Gallery (UNCHANGED) ───────────────────────────────────
  const images = useMemo(() => {
    if (!selectedMed) return [];
    const arr = (Array.isArray(selectedMed.images) && selectedMed.images.length
      ? selectedMed.images : [selectedMed.img]
    ).filter(Boolean);
    return arr;
  }, [selectedMed]);

  // ── Open med detail helper ────────────────────────────────
  const openMed = async (med) => {
    setSelectedMed(med);
    setActiveImg(0);
    if (!med.description || !med.description.trim()) {
      const desc = await ensureDescription(API_BASE_URL, med._id);
      if (desc) {
        setSelectedMed((prev) => (prev ? { ...prev, description: desc } : prev));
        setMedicines((ms) => ms.map((m) => (m._id === med._id ? { ...m, description: desc } : m)));
      }
    }
  };

  // ─────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "relative", height: "100vh",
      width: "100%", maxWidth: 420, margin: "0 auto",
      overflow: "hidden",
      background: "linear-gradient(180deg, #F2F7F4 0%, #fff 100%)",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ padding: "14px 16px 8px" }}>
        {pharmacy ? (
          <div>
            <div style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: 18, fontWeight: 800, color: DEEP,
              letterSpacing: "-0.3px",
            }}>
              {pharmacy.name}
            </div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
              📍 {pharmacy.area}, {pharmacy.city}
            </div>
            {!canDeliver && (
              <div style={{
                marginTop: 8,
                background: "#FEF2F2", color: "#DC2626",
                fontSize: 12, fontWeight: 700,
                padding: "8px 12px", borderRadius: 12,
                border: "1px solid #FCA5A5",
              }}>
                ⛔ No delivery partner available at your location right now.
              </div>
            )}
          </div>
        ) : (
          <div style={{ height: 24, width: 160, borderRadius: 8, background: "#E2E8F0", animation: "pulse 1.5s infinite" }} />
        )}
      </div>

      {/* ── Two-column layout ──────────────────────────────── */}
      <div style={{ paddingLeft: 0, paddingRight: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "88px 1fr", gap: 10, alignItems: "start" }}>

          {/* LEFT: Category rail */}
          <aside style={{
            position: "sticky", top: TOP_OFFSET_PX, alignSelf: "start",
            height: columnHeight,
          }}>
            <div style={{
              height: "100%", borderRadius: 18, padding: "10px 6px",
              display: "flex", flexDirection: "column",
              background: "rgba(255,255,255,0.92)",
              border: "1.5px solid rgba(12,90,62,0.09)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
              backdropFilter: "blur(8px)",
            }}>
              <div style={{
                fontSize: 10, fontWeight: 800, color: "#94A3B8",
                textTransform: "uppercase", letterSpacing: "0.6px",
                marginBottom: 8, paddingLeft: 4,
              }}>
                Category
              </div>
              <div style={{
                flex: 1, display: "flex", flexDirection: "column", gap: 2,
                overflowY: "auto",
              }}
                className="no-scrollbar"
              >
                {allCategories.map((c) => (
                  <CatBtn
                    key={c} label={c}
                    active={c === selectedCategory}
                    onClick={() => setSelectedCategory(c)}
                  />
                ))}
              </div>
            </div>
          </aside>

          {/* RIGHT: Products */}
          <section
            style={{ minWidth: 0, overflowY: "auto", height: columnHeight, paddingBottom: rightPaddingBottom }}
            className="no-scrollbar"
          >
            {/* Sticky filter bar */}
            <div style={{
              position: "sticky", top: 0, zIndex: 10,
              paddingBottom: 10,
              background: "linear-gradient(180deg, #F2F7F4 80%, transparent)",
            }}>
              {/* Branded / Generic toggle */}
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {BRAND_KINDS.map((k) => (
                  <FilterPill
                    key={k} label={k}
                    active={k === selectedKind}
                    onClick={() => setSelectedKind(k)}
                    ariaPressed={k === selectedKind}
                  />
                ))}
              </div>

              {/* Type chips (fade edges) */}
              <div
                style={{
                  display: "flex", gap: 7,
                  overflowX: "auto", paddingBottom: 4, paddingRight: 4,
                  WebkitMaskImage: "linear-gradient(90deg, transparent, #000 12px, #000 calc(100% - 12px), transparent)",
                  maskImage: "linear-gradient(90deg, transparent, #000 12px, #000 calc(100% - 12px), transparent)",
                }}
                className="no-scrollbar"
              >
                {medTypes.map((t) => (
                  <FilterPill
                    key={t} label={t}
                    active={t === selectedType}
                    onClick={() => setSelectedType(t)}
                  />
                ))}
              </div>
            </div>

            {/* Product grid */}
            {loading ? (
              /* Skeleton */
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{
                    height: 200, borderRadius: 18,
                    background: "#fff",
                    border: "1.5px solid rgba(12,90,62,0.08)",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }} />
                ))}
              </div>
            ) : filteredMeds.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800, color: "#0B1F16", marginBottom: 6 }}>
                  No medicines found
                </div>
                <div style={{ fontSize: 13, color: "#94A3B8" }}>Try a different category or filter</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {filteredMeds.map((med, idx) => (
                  <motion.div
                    key={med._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.25 }}
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
          </section>
        </div>
      </div>

      {/* ── Medicine Detail Dialog (UNCHANGED logic) ─────────── */}
      <Dialog
        open={!!selectedMed}
        onOpenChange={(open) => { if (!open) { setSelectedMed(null); setActiveImg(0); } }}
      >
        <DialogContent style={{
          width: "min(96vw,740px)",
          padding: 0, overflow: "hidden",
          borderRadius: 24,
          border: "none",
        }}>
          {selectedMed && (
            <div>
              {/* Dialog header */}
              <div style={{
                padding: "20px 20px 12px",
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
                  <X style={{ width: 16, height: 16, color: "#fff" }} />
                </button>

                <div style={{
                  fontFamily: "'Sora',sans-serif",
                  fontSize: 20, fontWeight: 800, color: "#fff",
                  paddingRight: 36,
                }}>
                  {selectedMed.brand || selectedMed.name}
                </div>
                {selectedMed.company && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 3 }}>
                    {selectedMed.company}
                  </div>
                )}
              </div>

              {/* Gallery (UNCHANGED swipe logic) */}
              <div style={{ padding: "14px 16px 0" }}>
                <div style={{
                  position: "relative", width: "100%", height: 280,
                  borderRadius: 16,
                  background: "linear-gradient(135deg,#F0F9F4,#E8F5EF)",
                  overflow: "hidden",
                }}>
                  {/* swipeable rail — UNCHANGED */}
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
                    {images.map((src, i) => (
                      <div key={i} style={{ minWidth: "100%", height: "100%", display: "grid", placeItems: "center" }}>
                        <img
                          src={getImageUrl(src)}
                          alt={selectedMed.name}
                          style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                          draggable={false}
                        />
                      </div>
                    ))}
                  </div>

                  {/* prev/next (UNCHANGED logic) */}
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={() => setActiveImg((i) => Math.max(0, i - 1))}
                        style={{
                          position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                          width: 32, height: 32, borderRadius: "50%",
                          background: "rgba(255,255,255,0.9)",
                          border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                        }}
                      >
                        <ChevronLeft style={{ width: 16, height: 16, color: DEEP }} />
                      </button>
                      <button
                        onClick={() => setActiveImg((i) => Math.min(images.length - 1, i + 1))}
                        style={{
                          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                          width: 32, height: 32, borderRadius: "50%",
                          background: "rgba(255,255,255,0.9)",
                          border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                        }}
                      >
                        <ChevronRight style={{ width: 16, height: 16, color: DEEP }} />
                      </button>
                    </>
                  )}

                  {/* dots (UNCHANGED logic) */}
                  {images.length > 1 && (
                    <div style={{
                      position: "absolute", bottom: 10, left: 0, right: 0,
                      display: "flex", justifyContent: "center", gap: 6,
                    }}>
                      {images.map((_, i) => (
                        <span
                          key={i} onClick={() => setActiveImg(i)}
                          style={{
                            height: 6, borderRadius: 100, cursor: "pointer",
                            transition: "all 0.2s",
                            width: i === activeImg ? 20 : 6,
                            background: i === activeImg ? DEEP : "rgba(12,90,62,0.25)",
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tags + info (UNCHANGED conditions) */}
              <div style={{ padding: "14px 16px 0", maxHeight: 300, overflowY: "auto" }}>
                {/* Badges row */}
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

                {/* Info rows */}
                {[
                  selectedMed.composition && { label: "Composition", val: selectedMed.composition },
                  selectedMed.company && { label: "Company", val: selectedMed.company },
                  (selectedMed.packCount || selectedMed.packUnit) && { label: "Pack Size", val: packLabel(selectedMed.packCount, selectedMed.packUnit) },
                  { label: "Prescription", val: selectedMed.prescriptionRequired ? "Required" : "Not Required" },
                ].filter(Boolean).map(({ label, val }) => (
                  <div key={label} style={{
                    fontSize: 13, color: "#374151", marginBottom: 6,
                    display: "flex", gap: 6,
                  }}>
                    <span style={{ fontWeight: 700, color: "#6B7280", minWidth: 90 }}>{label}:</span>
                    <span>{val}</span>
                  </div>
                ))}

                {/* Price */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0" }}>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 26, fontWeight: 800, color: DEEP }}>
                    ₹{selectedMed.price}
                  </span>
                  {selectedMed.mrp && selectedMed.price < selectedMed.mrp && (
                    <>
                      <span style={{ fontSize: 14, color: "#CBD5E1", textDecoration: "line-through" }}>
                        ₹{selectedMed.mrp}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 800, color: "#fff",
                        background: `linear-gradient(135deg,${DEEP},${MID})`,
                        padding: "3px 10px", borderRadius: 100,
                      }}>
                        {Math.round(((selectedMed.mrp - selectedMed.price) / selectedMed.mrp) * 100)}% OFF
                      </span>
                    </>
                  )}
                </div>

                {/* Description */}
                <div style={{
                  fontSize: 13, color: "#374151",
                  lineHeight: 1.7, marginBottom: 16,
                  whiteSpace: "pre-line",
                  background: "#F8FBFA", borderRadius: 12, padding: "10px 12px",
                }}>
                  {selectedMed.description || (
                    <span style={{ color: "#94A3B8" }}>No description available.</span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{
                padding: "12px 16px 16px",
                display: "flex", gap: 10,
                borderTop: "1px solid rgba(12,90,62,0.08)",
              }}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedMed(null)}
                  style={{
                    flex: 1, height: 46, borderRadius: 14,
                    border: "1.5px solid rgba(12,90,62,0.2)",
                    background: "#F8FBFA", color: "#374151",
                    fontSize: 14, fontWeight: 700,
                    fontFamily: "'Sora',sans-serif", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  }}
                >
                  <X style={{ width: 14, height: 14 }} /> Close
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={!canDeliver}
                  onClick={async () => {
                    await addWithGenericCheck(selectedMed);
                    setSelectedMed(null);
                  }}
                  style={{
                    flex: 2, height: 46, borderRadius: 14, border: "none",
                    background: canDeliver
                      ? `linear-gradient(135deg, ${DEEP}, ${MID})`
                      : "#E2E8F0",
                    color: canDeliver ? "#fff" : "#94A3B8",
                    fontSize: 14, fontWeight: 800,
                    fontFamily: "'Sora',sans-serif",
                    cursor: canDeliver ? "pointer" : "not-allowed",
                    boxShadow: canDeliver ? "0 4px 16px rgba(12,90,62,0.35)" : "none",
                  }}
                >
                  Add to Cart 🛒
                </motion.button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Generic Suggestion Modal (UNCHANGED) ─────────────── */}
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

      {/* ── Upload Prescription FAB (UNCHANGED logic) ─────────── */}
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
              height: 50, paddingLeft: 10, paddingRight: 20,
              borderRadius: 100, border: "none",
              background: `linear-gradient(135deg, ${DEEP}, ${MID})`,
              color: "#fff", cursor: "pointer",
              boxShadow: "0 8px 24px rgba(12,90,62,0.40)",
              fontFamily: "'Sora',sans-serif",
            }}
          >
            <span style={{
              width: 34, height: 34, borderRadius: "50%",
              background: "rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <UploadCloud style={{ width: 17, height: 17, color: "#fff" }} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 800 }}>Upload Prescription</span>
          </motion.button>
        )}
      </motion.div>

      {/* ── Prescription Upload Modal (UNCHANGED) ────────────── */}
      <PrescriptionUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        userCity={localStorage.getItem("city") || "Delhi"}
      />

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}