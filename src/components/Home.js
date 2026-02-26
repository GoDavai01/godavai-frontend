// ============================================================
//  Home.js — GoDavaii 2030 Ultra-Modern UI
//  ✅ LocationModal integrated (tapping location opens modal)
//  ✅ Medicine images from med.img (same as Medicines.js)
//  ✅ No double navbar — Home manages its own header
//  ✅ Sora + Plus Jakarta Sans typography
//  ✅ Zero logic changes — only UI upgraded
// ============================================================
import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import { useLocation } from "../context/LocationContext";
import BottomNavBar from "./BottomNavBar";
import PrescriptionUploadModal from "./PrescriptionUploadModal";
import LocationModal from "./LocationModal";
import {
  UploadCloud, Clock, ChevronRight, MapPin,
  Search, Mic, RefreshCw, AlertTriangle,
  ChevronDown, User,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

// ─── Constants ───────────────────────────────────────────────
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0C5A3E";
const MID  = "#0E7A4F";
const ACCENT = "#00D97E";

const CATEGORIES = [
  { label: "Fever",      emoji: "🌡️" },
  { label: "Diabetes",   emoji: "💉" },
  { label: "Cold",       emoji: "🤧" },
  { label: "Heart",      emoji: "❤️" },
  { label: "Antibiotic", emoji: "💊" },
  { label: "Ayurveda",   emoji: "🌿" },
  { label: "Painkiller", emoji: "🔵" },
  { label: "Cough",      emoji: "🫁" },
];

const BANNERS = [
  {
    tag: "💰 Save Big",
    title: "Generic = Same\nMedicine, 80% Off",
    sub: "Switch & save today",
    emoji: "💊",
    grad: "linear-gradient(135deg,#064E3B 0%,#0A6B4A 100%)",
  },
  {
    tag: "⚡ Express",
    title: "30-Minute\nDelivery Guarantee",
    sub: "Or next order free",
    emoji: "🛵",
    grad: "linear-gradient(135deg,#1A3A6B 0%,#2563EB 100%)",
  },
  {
    tag: "🤖 AI Rx",
    title: "Smart Prescription\nReader",
    sub: "Upload & auto-order",
    emoji: "📱",
    grad: "linear-gradient(135deg,#4C1D95 0%,#7C3AED 100%)",
  },
];

const ACTIVE_STATUSES = new Set([
  "pending","placed","quoted","processing","assigned",
  "accepted","picked_up","out_for_delivery",
]);

// ─── Helpers ─────────────────────────────────────────────────
function isMedicineInCategory(med, cat) {
  if (!med || !cat) return false;
  const t = cat.trim().toLowerCase();
  let cats = [];
  if (typeof med.category === "string") cats.push(med.category);
  if (Array.isArray(med.category)) cats = cats.concat(med.category);
  if (Array.isArray(med.categories)) cats = cats.concat(med.categories);
  return cats.filter(Boolean).map((x) => x.toLowerCase())
    .some((c) => c.includes(t) || t.includes(c));
}

// Same as Medicines.js — uses med.img field
function getImageUrl(img) {
  if (!img) return null;
  if (typeof img === "string" && img.startsWith("/uploads/")) return `${API_BASE_URL}${img}`;
  if (typeof img === "string" && img.startsWith("http")) return img;
  return null;
}

function formatDist(ph) {
  const km =
    typeof ph?.distanceKm === "number" ? ph.distanceKm
    : typeof ph?.distanceMeters === "number" ? ph.distanceMeters / 1000
    : typeof ph?.dist?.calculated === "number" ? ph.dist.calculated / 1000
    : null;
  if (km == null || Number.isNaN(km)) return "--";
  return km < 1 ? "<1 km" : `${km.toFixed(1)} km`;
}

function statusLabel(s) {
  const map = {
    pending:"Pending", placed:"Order Placed", quoted:"Quoted",
    processing:"Processing", assigned:"Assigned", accepted:"Accepted",
    picked_up:"Picked Up", out_for_delivery:"Out for Delivery", delivered:"Delivered",
  };
  return map[s] || s;
}

// ─── MedImage — smart image with no-image fallback (no flag!) ─
function MedImage({ med, size = 72 }) {
  const src = getImageUrl(med?.img || med?.image || med?.imageUrl);
  const [failed, setFailed] = useState(!src);

  if (failed || !src) {
    // Clean pill graphic fallback
    return (
      <div style={{
        width: size, height: size, borderRadius: 14,
        background: "linear-gradient(135deg,#E8F5EF,#D1EDE0)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, fontSize: size * 0.5,
      }}>
        💊
      </div>
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: 14, overflow: "hidden",
      background: "#F0F9F4", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <img
        src={src}
        alt={med?.brand || med?.name || "Medicine"}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </div>
  );
}

// ─── Section Row ─────────────────────────────────────────────
function SectionRow({ title, badge, onSeeAll }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontFamily: "'Sora', sans-serif",
          fontSize: 17, fontWeight: 800, color: "#0B1F16", letterSpacing: "-0.3px",
        }}>
          {title}
        </span>
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: DEEP,
            background: `${DEEP}15`, padding: "2px 8px",
            borderRadius: 100, letterSpacing: "0.5px",
          }}>
            {badge}
          </span>
        )}
      </div>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          style={{
            display: "flex", alignItems: "center", gap: 2,
            fontSize: 13, fontWeight: 700, color: DEEP,
            background: "none", border: "none", cursor: "pointer",
          }}
        >
          See all <ChevronRight style={{ width: 14, height: 14 }} />
        </button>
      )}
    </div>
  );
}

// ─── Med Card ────────────────────────────────────────────────
function MedCard({ med, onAdd, onOpen, canDeliver }) {
  const price = med.price ?? med.mrp ?? med.sellingPrice ?? med.salePrice ?? "--";
  const origPrice = med.mrp && med.price && Number(med.price) < Number(med.mrp) ? med.mrp : null;
  const discount = origPrice ? Math.round(((origPrice - price) / origPrice) * 100) : null;

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={() => onOpen?.(med)}
      style={{
        width: 220, flexShrink: 0, cursor: "pointer",
        background: "#fff",
        borderRadius: 20,
        border: "1.5px solid rgba(12,90,62,0.10)",
        boxShadow: "0 2px 16px rgba(12,90,62,0.08)",
        padding: 14,
        display: "flex", alignItems: "center", gap: 12,
      }}
    >
      <MedImage med={med} size={70} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Sora', sans-serif",
          fontSize: 13, fontWeight: 700, color: "#0B1F16",
          display: "-webkit-box", WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.35,
          marginBottom: 5,
        }}>
          {med.brand || med.name || med.medicineName || "Medicine"}
        </div>
        {med.company && (
          <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 4, fontWeight: 500 }}>
            {med.company}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
          <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800, color: DEEP }}>
            ₹{price}
          </span>
          {origPrice && (
            <span style={{ fontSize: 11, color: "#CBD5E1", textDecoration: "line-through" }}>₹{origPrice}</span>
          )}
          {discount && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#059669",
              background: "#ECFDF5", padding: "1px 6px", borderRadius: 100,
            }}>
              {discount}% OFF
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{
            fontSize: 10, fontWeight: 600, color: "#6B9E88",
            display: "flex", alignItems: "center", gap: 3,
          }}>
            <Clock style={{ width: 10, height: 10 }} /> ≤30 min
          </span>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={(e) => { e.stopPropagation(); if (canDeliver) onAdd(med); }}
            disabled={!canDeliver}
            style={{
              height: 28, paddingLeft: 12, paddingRight: 12,
              borderRadius: 100, border: "none",
              cursor: canDeliver ? "pointer" : "not-allowed",
              background: canDeliver ? DEEP : "#E2E8F0",
              color: canDeliver ? "#fff" : "#94A3B8",
              fontSize: 12, fontWeight: 700, fontFamily: "'Sora',sans-serif",
              boxShadow: canDeliver ? "0 2px 8px rgba(12,90,62,0.3)" : "none",
            }}
          >
            + Add
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Pharmacy Card ───────────────────────────────────────────
function PharmacyCard({ ph, onClick }) {
  return (
    <motion.div
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      style={{
        flexShrink: 0, width: 130, cursor: "pointer",
        background: "#fff",
        borderRadius: 20,
        border: "1.5px solid rgba(12,90,62,0.10)",
        boxShadow: "0 2px 12px rgba(12,90,62,0.07)",
        padding: "18px 12px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      }}
    >
      <div style={{
        width: 50, height: 50, borderRadius: 16,
        background: "linear-gradient(135deg,#E8F5EF,#C6E8D8)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 26,
      }}>
        🏥
      </div>
      <div style={{
        fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 700,
        color: "#0B1F16", textAlign: "center", lineHeight: 1.3,
        overflow: "hidden", textOverflow: "ellipsis",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
      }}>
        {ph.name}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 500 }}>
          📍 {formatDist(ph)}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 700, color: "#059669",
          background: "#ECFDF5", padding: "2px 8px", borderRadius: 100,
        }}>
          ● Open
        </span>
      </div>
    </motion.div>
  );
}

// ─── Banner Card ─────────────────────────────────────────────
function BannerCard({ banner }) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      style={{
        flexShrink: 0, width: 268, height: 122,
        borderRadius: 20,
        background: banner.grad,
        position: "relative", overflow: "hidden",
        cursor: "pointer",
      }}
    >
      <div style={{
        position: "absolute", right: -24, top: -24,
        width: 120, height: 120, borderRadius: "50%",
        background: "rgba(255,255,255,0.07)",
      }} />
      <div style={{
        position: "absolute", right: 16, bottom: -28,
        width: 70, height: 70, borderRadius: "50%",
        background: "rgba(255,255,255,0.04)",
      }} />
      <div style={{ padding: "16px 18px", position: "relative", zIndex: 1 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.6px",
          textTransform: "uppercase", color: ACCENT,
          background: "rgba(0,217,126,0.15)",
          padding: "2px 8px", borderRadius: 100,
          display: "inline-block", marginBottom: 8,
          fontFamily: "'Sora',sans-serif",
        }}>
          {banner.tag}
        </div>
        <div style={{
          fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800,
          color: "#fff", lineHeight: 1.3, whiteSpace: "pre-line",
        }}>
          {banner.title}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>
          {banner.sub}
        </div>
      </div>
      <div style={{
        position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
        fontSize: 42, opacity: 0.75, lineHeight: 1,
      }}>
        {banner.emoji}
      </div>
    </motion.div>
  );
}

// ─── Active Order Bar ─────────────────────────────────────────
function ActiveOrderBar({ order, onClick }) {
  const steps = [
    { key: "placed",           label: "Placed" },
    { key: "processing",       label: "Processing" },
    { key: "picked_up",        label: "Packed" },
    { key: "out_for_delivery", label: "On Way" },
    { key: "delivered",        label: "Done" },
  ];
  const statusOrder = ["placed","quoted","processing","assigned","accepted","picked_up","out_for_delivery","delivered"];
  const currentIdx = statusOrder.indexOf(order.status);

  return (
    <motion.button
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        width: "100%", borderRadius: 20, overflow: "hidden",
        background: "linear-gradient(135deg,#0C5A3E,#0E7A4F)",
        boxShadow: "0 8px 28px rgba(12,90,62,0.30)",
        border: "none", cursor: "pointer", textAlign: "left",
      }}
    >
      <div style={{ padding: "14px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            background: "rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>🛵</div>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800, color: "#fff" }}>
              Live Order Tracking
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>
              {statusLabel(order.status)} · Tap to view map
            </div>
          </div>
        </div>
        <div style={{
          background: ACCENT, color: DEEP,
          fontSize: 11, fontWeight: 800,
          padding: "6px 14px", borderRadius: 100,
          fontFamily: "'Sora',sans-serif",
        }}>
          Track →
        </div>
      </div>
      <div style={{ padding: "4px 16px 14px" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {steps.map((step, i) => {
            const stepIdx = statusOrder.indexOf(step.key);
            const done = stepIdx <= currentIdx;
            const active = step.key === order.status;
            return (
              <React.Fragment key={step.key}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: done ? ACCENT : "rgba(255,255,255,0.2)",
                    border: active ? `2.5px solid ${ACCENT}` : "none",
                    boxShadow: active ? `0 0 0 5px rgba(0,217,126,0.2)` : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, color: done ? DEEP : "transparent",
                    fontWeight: 800, transition: "all 0.3s",
                  }}>
                    {done ? "✓" : ""}
                  </div>
                  <span style={{ fontSize: 8, color: "rgba(255,255,255,0.5)", fontWeight: 600, textAlign: "center" }}>
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{
                    flex: 1, height: 2,
                    background: done ? ACCENT : "rgba(255,255,255,0.15)",
                    borderRadius: 1, marginBottom: 14,
                  }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </motion.button>
  );
}

// ─── Doctor Card ─────────────────────────────────────────────
function DoctorCard({ doctor, onClick }) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        flexShrink: 0, width: 175, cursor: "pointer",
        background: "#fff",
        borderRadius: 20,
        border: "1.5px solid rgba(12,90,62,0.10)",
        boxShadow: "0 2px 12px rgba(12,90,62,0.07)",
        padding: "14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "linear-gradient(135deg,#E8F5EF,#C6E8D8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, flexShrink: 0,
        }}>
          👨‍⚕️
        </div>
        <div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700, color: "#0B1F16" }}>
            {doctor.name}
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{doctor.spec}</div>
        </div>
      </div>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 11, fontWeight: 600, color: DEEP,
        background: "#E8F5EF", padding: "4px 10px", borderRadius: 100,
      }}>
        <Clock style={{ width: 10, height: 10 }} /> Slots today
      </div>
    </motion.div>
  );
}

// ─── Med Detail Dialog ────────────────────────────────────────
function MedDetailDialog({ med, open, onClose, onAddToCart, canDeliver }) {
  const [activeImg, setActiveImg] = useState(0);
  const images = useMemo(() => {
    if (!med) return [];
    const arr = (Array.isArray(med.images) && med.images.length
      ? med.images : [med.img]).filter(Boolean);
    return arr.length ? arr : [null];
  }, [med]);

  useEffect(() => { if (open) setActiveImg(0); }, [open]);
  if (!med) return null;

  const price = med.price ?? med.mrp ?? "--";
  const origPrice = med.mrp && med.price && Number(med.price) < Number(med.mrp) ? med.mrp : null;
  const discount = origPrice ? Math.round(((origPrice - price) / origPrice) * 100) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent style={{ width: "min(96vw,520px)", padding: 0, borderRadius: 24, overflow: "hidden" }}>
        <DialogHeader style={{ padding: "20px 20px 12px" }}>
          <DialogTitle style={{ fontFamily: "'Sora',sans-serif", fontSize: 19, fontWeight: 800, color: DEEP }}>
            {med.brand || med.name}
          </DialogTitle>
        </DialogHeader>

        {/* Gallery */}
        <div style={{ margin: "0 20px", borderRadius: 16, overflow: "hidden", height: 200, position: "relative", background: "#F0F9F4" }}>
          <div
            style={{ display: "flex", height: "100%", transition: "transform 0.3s", transform: `translateX(-${activeImg * 100}%)` }}
            onTouchStart={(e) => (e.currentTarget.dataset.sx = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              const dx = e.changedTouches[0].clientX - Number(e.currentTarget.dataset.sx || 0);
              if (dx < -40 && activeImg < images.length - 1) setActiveImg((i) => i + 1);
              if (dx > 40 && activeImg > 0) setActiveImg((i) => i - 1);
            }}
          >
            {images.map((src, i) => {
              const imgSrc = getImageUrl(src);
              return (
                <div key={i} style={{ minWidth: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {imgSrc ? (
                    <img src={imgSrc} alt={med.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} draggable={false} />
                  ) : (
                    <div style={{ fontSize: 64 }}>💊</div>
                  )}
                </div>
              );
            })}
          </div>
          {images.length > 1 && (
            <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
              {images.map((_, i) => (
                <div key={i} onClick={() => setActiveImg(i)} style={{
                  height: 6, width: i === activeImg ? 20 : 6,
                  borderRadius: 3, background: i === activeImg ? DEEP : "#CBD5E1",
                  cursor: "pointer", transition: "all 0.2s",
                }} />
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {Array.isArray(med.category) && med.category.map((c, i) => (
              <span key={i} style={{
                fontSize: 11, fontWeight: 600, color: DEEP,
                background: "#E8F5EF", padding: "3px 10px", borderRadius: 100,
              }}>{c}</span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 26, fontWeight: 800, color: DEEP }}>₹{price}</span>
            {origPrice && <span style={{ fontSize: 14, color: "#CBD5E1", textDecoration: "line-through" }}>₹{origPrice}</span>}
            {discount && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#059669", background: "#ECFDF5", padding: "3px 10px", borderRadius: 100 }}>
                {discount}% OFF
              </span>
            )}
          </div>
          {med.composition && <div style={{ fontSize: 13, color: "#4A6B5A", marginBottom: 6 }}><strong>Composition:</strong> {med.composition}</div>}
          {med.company && <div style={{ fontSize: 13, color: "#4A6B5A", marginBottom: 10 }}><strong>Manufacturer:</strong> {med.company}</div>}
          {med.description && <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, marginBottom: 4 }}>{med.description}</div>}
        </div>

        <div style={{ padding: 20, paddingTop: 12, display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, height: 50, borderRadius: 14,
              background: "#F8FAFC", color: "#64748B",
              border: "1.5px solid #E2E8F0",
              fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Close
          </button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            disabled={!canDeliver}
            onClick={() => { if (canDeliver) { onAddToCart(med); onClose(); } }}
            style={{
              flex: 2, height: 50, borderRadius: 14, border: "none",
              background: canDeliver ? `linear-gradient(135deg,${DEEP},${MID})` : "#E2E8F0",
              color: canDeliver ? "#fff" : "#94A3B8",
              fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 700,
              cursor: canDeliver ? "pointer" : "not-allowed",
              boxShadow: canDeliver ? "0 4px 16px rgba(12,90,62,0.3)" : "none",
            }}
          >
            {canDeliver ? "Add to Cart 🛒" : "Delivery Unavailable"}
          </motion.button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function Home() {
  const [pharmaciesNearby, setPharmaciesNearby] = useState([]);
  const [mostOrderedByPharmacy, setMostOrderedByPharmacy] = useState({});
  const [allMedsByPharmacy, setAllMedsByPharmacy] = useState({});
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showFallbackMeds, setShowFallbackMeds] = useState(false);
  const [canDeliver, setCanDeliver] = useState(true);
  const [lastOrder, setLastOrder] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [selectedMed, setSelectedMed] = useState(null);
  const [userCoords, setUserCoords] = useState(null);

  const popupTimeout = useRef(null);
  const noMedicinesTimer = useRef(null);

  const { user } = useAuth();
  const { cart, addToCart } = useCart();
  const navigate = useNavigate();
  const { currentAddress, setCurrentAddress } = useLocation();

  const cartCount = cart?.length || 0;
  const dockBottom = `calc(${cartCount > 0 ? 144 : 72}px + env(safe-area-inset-bottom,0px) + 12px)`;

  // ── Profile redirect ──
  useEffect(() => {
    if (!user) return;
    const localDone = localStorage.getItem("profileCompleted") === "1";
    const missingRequired = !user.name || !user.email || !user.dob;
    if (!localDone && (!user.profileCompleted || missingRequired)) {
      navigate("/profile?setup=1", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // ── Location ──
  useEffect(() => {
    if (currentAddress?.lat && currentAddress?.lng) {
      setUserCoords({ lat: currentAddress.lat, lng: currentAddress.lng });
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserCoords(null)
      );
    }
  }, [currentAddress]);

  // ── Delivery partner check ──
  useEffect(() => {
    const lat = Number(currentAddress?.lat ?? userCoords?.lat);
    const lng = Number(currentAddress?.lng ?? userCoords?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    fetch(`${API_BASE_URL}/api/delivery/active-partner-nearby?lat=${lat}&lng=${lng}`)
      .then((r) => r.json())
      .then((d) => setCanDeliver(!!d.activePartnerExists))
      .catch(() => setCanDeliver(false));
  }, [currentAddress, userCoords]);

  // ── Last order ──
  useEffect(() => {
    if (!user?._id && !user?.userId) return;
    fetch(`${API_BASE_URL}/api/allorders/myorders-userid/${user._id || user.userId}`)
      .then((r) => r.json())
      .then((orders) => {
        if (Array.isArray(orders) && orders.length) setLastOrder(orders[0]);
      })
      .catch(() => {});
  }, [user]);

  // ── Active order ──
  useEffect(() => {
    async function getActive() {
      const idFromLS = localStorage.getItem("activeOrderId");
      try {
        if (idFromLS) {
          const r = await fetch(`${API_BASE_URL}/api/orders/${idFromLS}`);
          if (r.ok) {
            const o = await r.json();
            if (ACTIVE_STATUSES.has(o.status)) { setActiveOrder(o); return; }
          }
          localStorage.removeItem("activeOrderId");
        }
      } catch {}
      if (!user?._id && !user?.userId) return;
      try {
        const r = await fetch(`${API_BASE_URL}/api/allorders/myorders-userid/${user._id || user.userId}`);
        const orders = await r.json();
        if (Array.isArray(orders)) {
          const active = orders
            .filter((o) => ACTIVE_STATUSES.has(o.status))
            .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))[0];
          if (active) { setActiveOrder(active); localStorage.setItem("activeOrderId", active._id); return; }
        }
        setActiveOrder(null);
      } catch {}
    }
    getActive();
  }, [user]);

  // ── Nearby pharmacies ──
  useEffect(() => {
    if (!userCoords) return;
    fetch(`${API_BASE_URL}/api/pharmacies/nearby?lat=${userCoords.lat}&lng=${userCoords.lng}&maxDistance=8000`)
      .then((r) => r.json())
      .then((pharmacies) => {
        const active = pharmacies.filter((ph) => ph.active !== false).slice(0, 10);
        setPharmaciesNearby(active);
        Promise.all(
          active.slice(0, 5).map((ph) =>
            fetch(`${API_BASE_URL}/api/medicines?pharmacyId=${ph._id}`)
              .then((r) => r.json())
              .then((meds) => ({ pharmacyId: ph._id, medicines: meds.slice(0, 8) }))
              .catch(() => ({ pharmacyId: ph._id, medicines: [] }))
          )
        ).then((results) => {
          const map = {};
          results.forEach((r) => { map[r.pharmacyId] = r.medicines; });
          setMostOrderedByPharmacy(map);
        });
      })
      .catch(() => {});
  }, [userCoords]);

  // ── All meds by category ──
  useEffect(() => {
    if (!selectedCategory || pharmaciesNearby.length === 0) return;
    const toFetch = pharmaciesNearby.slice(0, 5).filter((ph) => !allMedsByPharmacy[ph._id]);
    if (!toFetch.length) return;
    Promise.all(
      toFetch.map((ph) =>
        fetch(`${API_BASE_URL}/api/medicines?pharmacyId=${ph._id}`)
          .then((r) => r.json())
          .then((meds) => ({ pharmacyId: ph._id, medicines: meds }))
          .catch(() => ({ pharmacyId: ph._id, medicines: [] }))
      )
    ).then((results) => {
      setAllMedsByPharmacy((prev) => {
        const m = { ...prev };
        results.forEach((r) => { m[r.pharmacyId] = r.medicines; });
        return m;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, pharmaciesNearby]);

  // ── Fallback meds timer ──
  useEffect(() => {
    if (!selectedCategory) { setShowFallbackMeds(false); return; }
    const noneHave = pharmaciesNearby.slice(0, 5).every((ph) => {
      const meds = allMedsByPharmacy[ph._id] || [];
      return !meds.some((med) => isMedicineInCategory(med, selectedCategory));
    });
    if (noneHave) {
      noMedicinesTimer.current = setTimeout(() => setShowFallbackMeds(true), 500);
    } else {
      setShowFallbackMeds(false);
    }
    return () => clearTimeout(noMedicinesTimer.current);
  }, [selectedCategory, pharmaciesNearby, allMedsByPharmacy]);

  useEffect(() => () => {
    clearTimeout(popupTimeout.current);
    clearTimeout(noMedicinesTimer.current);
  }, []);

  // ── Handlers ──
  const handleAddToCart = (med) => {
    if (!canDeliver) { alert("Sorry, delivery isn't available at your location right now."); return; }
    if (cartCount > 0) {
      const cartPharmacyId = cart[0]?.pharmacy?._id || cart[0]?.pharmacy;
      if (med.pharmacy?._id !== cartPharmacyId && med.pharmacy !== cartPharmacyId) {
        alert("You can only order medicines from one pharmacy at a time."); return;
      }
    }
    addToCart(med);
  };

  const handleCategoryClick = (label) => {
    setSelectedCategory(label);
    setShowFallbackMeds(false);
  };

  // ── Filtered pharmacies ──
  const filteredPharmacies = pharmaciesNearby
    .slice(0, 5)
    .map((ph) => {
      const allMeds = selectedCategory ? allMedsByPharmacy[ph._id] || [] : mostOrderedByPharmacy[ph._id] || [];
      let meds = selectedCategory ? allMeds.filter((m) => isMedicineInCategory(m, selectedCategory)) : allMeds;
      if (selectedCategory && meds.length === 0 && showFallbackMeds) meds = allMeds.slice(0, 8);
      return { ...ph, medicines: meds };
    })
    .sort((a, b) => b.medicines.length - a.medicines.length);

  const userName = user?.name?.split(" ")?.[0] || "there";
  const locationText = currentAddress?.formatted
    ? currentAddress.formatted.length > 36
      ? currentAddress.formatted.slice(0, 36) + "…"
      : currentAddress.formatted
    : "Set delivery location";

  // ── Render ──────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", width: "100%", maxWidth: 480,
      margin: "0 auto",
      background: "#F2F7F4",
      paddingBottom: 120,
      position: "relative",
      overflowX: "hidden",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>

      {/* ══════════ HERO HEADER ══════════ */}
      <div style={{
        background: `linear-gradient(160deg, ${DEEP} 0%, #0A4631 100%)`,
        paddingBottom: 24,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative ambient blobs */}
        <div style={{
          position: "absolute", right: -50, top: -50,
          width: 220, height: 220, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,217,126,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", left: -70, bottom: -60,
          width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,0,0,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* ── TOP BAR ── */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "16px 18px 12px",
          gap: 10,
        }}>
          {/* Location button — opens LocationModal */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setLocationModalOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 14, padding: "8px 12px",
              cursor: "pointer", flex: 1, minWidth: 0,
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: ACCENT,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <MapPin style={{ width: 14, height: 14, color: DEEP }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 1 }}>
                DELIVERING TO
              </div>
              <div style={{
                fontSize: 12, fontWeight: 700, color: "#fff",
                fontFamily: "'Sora',sans-serif",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {locationText}
              </div>
            </div>
            <ChevronDown style={{ width: 14, height: 14, color: "rgba(255,255,255,0.5)", flexShrink: 0 }} />
          </motion.button>

          {/* Profile avatar */}
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => navigate("/profile")}
            style={{
              width: 40, height: 40, borderRadius: 13,
              background: "rgba(255,255,255,0.15)",
              border: "1.5px solid rgba(255,255,255,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            <User style={{ width: 18, height: 18, color: "#fff" }} />
          </motion.button>
        </div>

        {/* ── GREETING + SEARCH ── */}
        <div style={{ padding: "0 18px" }}>
          <div style={{
            fontFamily: "'Sora',sans-serif",
            fontSize: 23, fontWeight: 800, color: "#fff",
            lineHeight: 1.25, marginBottom: 3,
          }}>
            Hi, {userName}! <span style={{ color: ACCENT }}>👋</span>
          </div>
          <div style={{
            fontSize: 13, color: "rgba(255,255,255,0.55)",
            marginBottom: 16, fontFamily: "'Plus Jakarta Sans',sans-serif",
          }}>
            What medicine do you need today?
          </div>

          {/* Search bar — tapping goes to /search */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/search")}
            style={{
              width: "100%", height: 50,
              background: "#fff", borderRadius: 15,
              display: "flex", alignItems: "center", gap: 10,
              padding: "0 14px",
              boxShadow: "0 8px 28px rgba(0,0,0,0.16)",
              border: "none", cursor: "pointer",
            }}
          >
            <Search style={{ width: 17, height: 17, color: "#94A3B8", flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 14, color: "#94A3B8", textAlign: "left", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
              Search medicines, brands, generics…
            </span>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: "#E8F5EF",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Mic style={{ width: 14, height: 14, color: DEEP }} />
            </div>
          </motion.button>
        </div>

        {/* ── STATS STRIP ── */}
        <div style={{ margin: "16px 18px 0", display: "flex", gap: 8 }}>
          {[
            { icon: "🏥", label: `${pharmaciesNearby.length || "—"}+ Pharmacies`, sub: "near you" },
            { icon: "⚡", label: "≤ 30 min",   sub: "delivery" },
            { icon: "💰", label: "Upto 80%", sub: "savings" },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1,
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 14, padding: "9px 0",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              backdropFilter: "blur(10px)",
            }}>
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 10, fontWeight: 800, color: "#fff" }}>{s.label}</span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>{s.sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════ CONTENT ══════════ */}
      <div style={{ padding: "20px 18px 0" }}>

        {/* No delivery warning */}
        <AnimatePresence>
          {!canDeliver && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                background: "#FFF5F5", border: "1.5px solid #FECACA",
                borderRadius: 16, padding: "12px 14px",
                display: "flex", alignItems: "center", gap: 10,
                marginBottom: 18,
              }}
            >
              <AlertTriangle style={{ width: 18, height: 18, color: "#EF4444", flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#991B1B" }}>
                No delivery partner nearby right now. Check back soon!
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── QUICK ACTIONS ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {[
              { label: "Upload Rx",  emoji: "📋", bg: `linear-gradient(135deg,${DEEP},${MID})`,     onClick: () => setPrescriptionModalOpen(true) },
              { label: "Medicines",  emoji: "💊", bg: "linear-gradient(135deg,#0891B2,#0EA5E9)",  onClick: () => navigate("/pharmacies-near-you") },
              { label: "Consult",    emoji: "🩺", bg: "linear-gradient(135deg,#D97706,#F59E0B)",  onClick: () => navigate("/doctors") },
              { label: "Offers",     emoji: "🎁", bg: "linear-gradient(135deg,#DC2626,#F87171)",  onClick: () => {} },
            ].map((act) => (
              <motion.button
                key={act.label}
                whileTap={{ scale: 0.90 }}
                onClick={act.onClick}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                }}
              >
                <div style={{
                  width: 58, height: 58, borderRadius: 20,
                  background: act.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26,
                  boxShadow: "0 6px 18px rgba(0,0,0,0.13)",
                }}>
                  {act.emoji}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: "#374151",
                  fontFamily: "'Sora',sans-serif", textAlign: "center", lineHeight: 1.2,
                }}>
                  {act.label}
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* ── ACTIVE ORDER TRACKER ── */}
        <AnimatePresence>
          {activeOrder && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              style={{ marginBottom: 24 }}
            >
              <ActiveOrderBar
                order={activeOrder}
                onClick={() => navigate(`/order-tracking/${activeOrder._id}`)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── OFFER BANNERS ── */}
        <div style={{ marginBottom: 26 }}>
          <SectionRow title="Deals & Offers" badge="HOT 🔥" />
          <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
            {BANNERS.map((b, i) => <BannerCard key={i} banner={b} />)}
          </div>
        </div>

        {/* ── NEARBY PHARMACIES ── */}
        {pharmaciesNearby.length > 0 && (
          <div style={{ marginBottom: 26 }}>
            <SectionRow title="Pharmacies Nearby" onSeeAll={() => navigate("/pharmacies-near-you")} />
            <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none" }}>
              {pharmaciesNearby.slice(0, 10).map((ph) => (
                <PharmacyCard key={ph._id} ph={ph} onClick={() => navigate(`/medicines/${ph._id}`)} />
              ))}
            </div>
          </div>
        )}

        {/* ── CATEGORY CHIPS ── */}
        <div style={{ marginBottom: 20 }}>
          <SectionRow title="Browse by Category" />
          <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setSelectedCategory("")}
              style={{
                flexShrink: 0, height: 38, padding: "0 18px",
                borderRadius: 100, cursor: "pointer",
                fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700,
                background: !selectedCategory ? DEEP : "#fff",
                color: !selectedCategory ? "#fff" : "#4A6B5A",
                boxShadow: !selectedCategory ? `0 4px 12px rgba(12,90,62,0.3)` : "0 1px 6px rgba(0,0,0,0.06)",
                border: !selectedCategory ? "none" : "1.5px solid rgba(12,90,62,0.12)",
                transition: "all 0.2s",
              }}
            >
              All
            </motion.button>
            {CATEGORIES.map(({ label, emoji }) => {
              const active = selectedCategory === label;
              return (
                <motion.button
                  key={label}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => handleCategoryClick(label)}
                  style={{
                    flexShrink: 0, height: 38, padding: "0 16px",
                    borderRadius: 100, cursor: "pointer",
                    fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600,
                    background: active ? DEEP : "#fff",
                    color: active ? "#fff" : "#4A6B5A",
                    boxShadow: active ? `0 4px 12px rgba(12,90,62,0.3)` : "0 1px 6px rgba(0,0,0,0.06)",
                    border: active ? "none" : "1.5px solid rgba(12,90,62,0.12)",
                    display: "flex", alignItems: "center", gap: 6,
                    transition: "all 0.2s",
                  }}
                >
                  <span>{emoji}</span><span>{label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ── MEDICINES BY PHARMACY ── */}
        {(!selectedCategory || showFallbackMeds || filteredPharmacies.some((ph) => ph.medicines.length > 0)) &&
          filteredPharmacies.map((ph) =>
            ph.medicines.length > 0 ? (
              <div key={ph._id} style={{ marginBottom: 28 }}>
                <SectionRow title={`Medicines at ${ph.name}`} onSeeAll={() => navigate(`/medicines/${ph._id}`)} />
                <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                  {ph.medicines.map((med, mi) => (
                    <MedCard
                      key={med._id || mi}
                      med={med}
                      canDeliver={canDeliver}
                      onAdd={handleAddToCart}
                      onOpen={(m) => setSelectedMed(m)}
                    />
                  ))}
                </div>
              </div>
            ) : null
          )}

        {/* No meds fallback */}
        {selectedCategory && filteredPharmacies.every((ph) => ph.medicines.length === 0) && !showFallbackMeds && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              textAlign: "center", padding: "40px 20px",
              background: "#fff", borderRadius: 20,
              border: "1.5px solid rgba(12,90,62,0.1)",
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: "#0B1F16", marginBottom: 6 }}>
              No "{selectedCategory}" medicines
            </div>
            <div style={{ fontSize: 13, color: "#94A3B8" }}>Searching nearby pharmacies...</div>
          </motion.div>
        )}

        {/* ── DOCTORS ── */}
        <div style={{ marginBottom: 28 }}>
          <SectionRow title="Consult a Doctor" onSeeAll={() => navigate("/doctors")} />
          <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none" }}>
            {[
              { name: "Dr. Sharma", spec: "General Physician" },
              { name: "Dr. Gupta",  spec: "Pediatrics" },
              { name: "Dr. Iyer",   spec: "Dermatology" },
              { name: "Dr. Mehta",  spec: "Cardiology" },
            ].map((d, i) => (
              <DoctorCard key={i} doctor={d} onClick={() => navigate("/doctors")} />
            ))}
          </div>
        </div>

        {/* ── ORDER AGAIN ── */}
        <div style={{ marginBottom: 32 }}>
          <SectionRow title="Order Again" badge="Quick Reorder" />
          <motion.div
            whileTap={{ scale: 0.98 }}
            style={{
              background: "#fff", borderRadius: 20,
              border: "1.5px solid rgba(12,90,62,0.10)",
              boxShadow: "0 2px 14px rgba(12,90,62,0.07)",
              padding: "18px",
              display: "flex", alignItems: "center", gap: 14,
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: "linear-gradient(135deg,#E8F5EF,#C6E8D8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, flexShrink: 0,
            }}>
              📦
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700, color: "#0B1F16", marginBottom: 4 }}>
                Last Order
              </div>
              <div style={{ fontSize: 12, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {lastOrder && Array.isArray(lastOrder.items) && lastOrder.items.length
                  ? lastOrder.items.map((i) => `${i.name || i.medicineName} ×${i.quantity || 1}`).join(", ")
                  : "No recent orders yet"}
              </div>
            </div>
            {lastOrder && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => navigate("/orders")}
                style={{
                  height: 38, padding: "0 16px",
                  background: DEEP, color: "#fff",
                  borderRadius: 100, border: "none", cursor: "pointer",
                  fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 700,
                  flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
                  boxShadow: "0 3px 12px rgba(12,90,62,0.28)",
                }}
              >
                <RefreshCw style={{ width: 12, height: 12 }} /> Reorder
              </motion.button>
            )}
          </motion.div>
        </div>

      </div>

      {/* ══════════ FLOATING UPLOAD Rx CTA ══════════ */}
      <motion.div
        className="fixed z-[1201] flex justify-end"
        style={{ bottom: dockBottom, left: 0, right: 0, padding: "0 18px", pointerEvents: "none" }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setPrescriptionModalOpen(true)}
          style={{
            pointerEvents: "auto",
            display: "inline-flex", alignItems: "center", gap: 10,
            height: 52, paddingLeft: 14, paddingRight: 22,
            borderRadius: 100, border: "none", cursor: "pointer",
            background: `linear-gradient(135deg,${DEEP},${MID})`,
            boxShadow: "0 10px 32px rgba(12,90,62,0.42)",
          }}
        >
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: "rgba(255,255,255,0.20)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <UploadCloud style={{ width: 17, height: 17, color: "#fff" }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "'Sora',sans-serif" }}>
            Upload Prescription
          </span>
        </motion.button>
      </motion.div>

      {/* ══════════ MODALS ══════════ */}
      <LocationModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onSelect={(addr) => {
          setCurrentAddress(addr);
          setLocationModalOpen(false);
        }}
      />

      <PrescriptionUploadModal
        open={prescriptionModalOpen}
        onClose={() => setPrescriptionModalOpen(false)}
        userCity={localStorage.getItem("city") || "Mumbai"}
      />

      <MedDetailDialog
        med={selectedMed}
        open={!!selectedMed}
        onClose={() => setSelectedMed(null)}
        onAddToCart={handleAddToCart}
        canDeliver={canDeliver}
      />

      <BottomNavBar />
    </div>
  );
}