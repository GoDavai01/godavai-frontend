// src/pages/AllMedicines.js — GoDavaii 2035 Health OS
// ✅ UPGRADED: Old MUI → 2035 inline styles (zero MUI dependency)
// ✅ NEW: "Fulfilled by GoDavaii" trust badge (marketplace model)
// ✅ NEW: Skeleton loading, error state, empty state
// ✅ KEPT: 100% API logic (selectedCity, selectedArea, addToCart)
// ✅ HIDDEN: Pharmacy name (marketplace model — user doesn't see which pharmacy)

import React, { useEffect, useState } from "react";
import { useCart } from "../context/CartContext";
import { ShieldCheck, ShoppingCart, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0C5A3E";
const MID  = "#0E7A4F";
const ACC  = "#00D97E";

const getImageUrl = (img) => {
  if (!img) return null;
  if (img.startsWith("/uploads/")) return `${API_BASE_URL}${img}`;
  if (img.startsWith("http")) return img;
  return null;
};

function hasValidMrp(med) {
  const mrp = Number(med?.mrp);
  const price = Number(med?.price);
  return mrp > 0 && price < mrp;
}

/* ── Skeleton Card ─────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div style={{
      background: "#fff", borderRadius: 20,
      border: "1px solid rgba(12,90,62,0.06)",
      padding: 14, display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 16, flexShrink: 0,
        background: "linear-gradient(145deg,#F4FAF6,#E8F5EF)",
        animation: "amPulse 1.5s ease-in-out infinite",
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 14, width: "70%", borderRadius: 6, background: "#E8F0EC", marginBottom: 8, animation: "amPulse 1.5s ease-in-out infinite" }} />
        <div style={{ height: 10, width: "40%", borderRadius: 6, background: "#F0F5F2", marginBottom: 10, animation: "amPulse 1.5s ease-in-out infinite" }} />
        <div style={{ height: 16, width: "30%", borderRadius: 6, background: "#E8F0EC", animation: "amPulse 1.5s ease-in-out infinite" }} />
      </div>
      <div style={{ width: 80, height: 36, borderRadius: 100, background: "#E8F0EC", animation: "amPulse 1.5s ease-in-out infinite" }} />
    </div>
  );
}

/* ── Medicine Card ─────────────────────────────────────────── */
function MedCard({ med, onAdd }) {
  const [imgFail, setImgFail] = useState(false);
  const imgSrc = getImageUrl(med.img);
  const showMrp = hasValidMrp(med);
  const discountPct = showMrp ? Math.round(((med.mrp - med.price) / med.mrp) * 100) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "#fff", borderRadius: 20,
        border: "1px solid rgba(12,90,62,0.08)",
        boxShadow: "0 2px 12px rgba(12,90,62,0.05)",
        padding: 14,
        display: "flex", alignItems: "center", gap: 14,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Discount badge */}
      {discountPct && discountPct > 0 && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          fontSize: 9, fontWeight: 800, color: "#fff",
          background: `linear-gradient(135deg,#059669,${ACC})`,
          padding: "2px 8px", borderRadius: 100,
          boxShadow: "0 2px 6px rgba(5,150,105,0.3)",
        }}>
          {discountPct}% OFF
        </div>
      )}

      {/* Image */}
      <div style={{
        width: 72, height: 72, borderRadius: 16, flexShrink: 0,
        background: "linear-gradient(145deg,#F4FAF6,#E8F5EF)",
        display: "grid", placeItems: "center",
        overflow: "hidden",
      }}>
        {imgSrc && !imgFail ? (
          <img
            src={imgSrc} alt={med.brand || med.name}
            style={{ width: "100%", height: "100%", objectFit: "contain", padding: 6 }}
            onError={() => setImgFail(true)}
          />
        ) : (
          <span style={{ fontSize: 32 }}>💊</span>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700,
          color: "#0B1F16", lineHeight: 1.3,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          marginBottom: 3,
        }}>
          {med.brand || med.name}
        </div>

        {/* Fulfilled by GoDavaii — replaces pharmacy name */}
        <div style={{
          fontSize: 10, color: "#059669", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 3,
          marginBottom: 6,
        }}>
          <ShieldCheck style={{ width: 10, height: 10 }} />
          Fulfilled by GoDavaii
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{
            fontFamily: "'Sora',sans-serif",
            fontSize: 17, fontWeight: 800, color: DEEP,
            letterSpacing: "-0.3px",
          }}>
            ₹{med.price}
          </span>
          {showMrp && (
            <span style={{
              fontSize: 11, color: "#CBD5E1",
              textDecoration: "line-through", fontWeight: 500,
            }}>
              ₹{med.mrp}
            </span>
          )}
        </div>
      </div>

      {/* Add button */}
      <motion.button
        whileTap={{ scale: 0.90 }}
        onClick={() => onAdd(med)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          height: 38, padding: "0 16px",
          borderRadius: 100, border: "none",
          background: `linear-gradient(135deg,${DEEP},${MID})`,
          color: "#fff",
          fontSize: 12, fontWeight: 800,
          fontFamily: "'Sora',sans-serif",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(12,90,62,0.28)",
          flexShrink: 0,
        }}
      >
        <ShoppingCart style={{ width: 13, height: 13 }} />
        Add
      </motion.button>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function AllMedicines() {
  const { selectedCity, selectedArea, addToCart } = useCart();
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setFetchError(false);
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCity) params.append("city", selectedCity);
    if (selectedArea) params.append("area", selectedArea);
    fetch(`${API_BASE_URL}/api/medicines/all?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Network error");
        return res.json();
      })
      .then((data) => { setMedicines(data); setLoading(false); })
      .catch(() => {
        setMedicines([]);
        setFetchError(true);
        setLoading(false);
      });
  }, [selectedCity, selectedArea]);

  const handleAdd = (med) => {
    addToCart(med);
    setToast(`${med.brand || med.name} added!`);
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <div style={{
      maxWidth: 520, margin: "0 auto",
      minHeight: "100vh",
      background: "#F3F7F5",
      fontFamily: "'Plus Jakarta Sans',sans-serif",
      paddingBottom: 120,
    }}>
      {/* Header */}
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{
          fontFamily: "'Sora',sans-serif",
          fontSize: 22, fontWeight: 800,
          color: "#0B1F16",
          letterSpacing: "-0.5px",
          marginBottom: 4,
        }}>
          All Medicines
        </div>
        <div style={{ fontSize: 13, color: "#64748B", fontWeight: 500 }}>
          {selectedCity ? (
            <>in <span style={{ color: DEEP, fontWeight: 700 }}>{selectedCity}</span></>
          ) : (
            "near you"
          )}
          {selectedArea ? ` · ${selectedArea}` : ""}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : fetchError ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: "center", padding: "60px 24px" }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 18,
              background: "rgba(254,226,226,0.3)",
              border: "1.5px solid rgba(239,68,68,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 14px",
            }}>
              <AlertTriangle style={{ width: 24, height: 24, color: "#EF4444" }} />
            </div>
            <div style={{
              fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800,
              color: "#0B1F16", marginBottom: 8,
            }}>
              Failed to load medicines
            </div>
            <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>
              Please check your connection and try again
            </div>
          </motion.div>
        ) : medicines.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: "center", padding: "60px 24px" }}
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontSize: 56, marginBottom: 16 }}
            >
              📦
            </motion.div>
            <div style={{
              fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800,
              color: "#0B1F16", marginBottom: 8,
            }}>
              No medicines available
            </div>
            <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>
              {selectedCity
                ? `No medicines found in ${selectedCity}. Try changing your location.`
                : "Set your delivery location to see available medicines."}
            </div>
          </motion.div>
        ) : (
          medicines.map((med, idx) => (
            <motion.div
              key={med._id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.4), duration: 0.25 }}
            >
              <MedCard med={med} onAdd={handleAdd} />
            </motion.div>
          ))
        )}
      </div>

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          style={{
            position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)",
            zIndex: 1300,
            background: DEEP, color: "#fff",
            padding: "10px 20px", borderRadius: 100,
            fontSize: 13, fontWeight: 700,
            fontFamily: "'Sora',sans-serif",
            boxShadow: "0 8px 28px rgba(12,90,62,0.35)",
            whiteSpace: "nowrap",
          }}
        >
          ✓ {toast}
        </motion.div>
      )}

      <style>{`
        @keyframes amPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  );
}