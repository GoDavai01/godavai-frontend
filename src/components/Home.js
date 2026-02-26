// ============================================================
//  Home.js — GoDavaii 2026 Modern UI
//  Design: Premium emerald-dark system, Sora typography,
//          framer-motion micro-interactions, mobile-first
// ============================================================
import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import { useLocation } from "../context/LocationContext";
import BottomNavBar from "./BottomNavBar";
import PrescriptionUploadModal from "./PrescriptionUploadModal";
import Navbar from "./Navbar";
import {
  UploadCloud, Pill, Stethoscope, Clock, ChevronRight, MapPin,
  X, Search, Mic, Zap, Gift, Star, Package, ArrowRight,
  TrendingUp, RefreshCw, AlertTriangle,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

// ─── Constants ───────────────────────────────────────────────
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0C5A3E";
const ACCENT = "#00C875";

const ICONS = {
  pharmacy: "/images/pharmacy-modern.png",
  medicine: "https://img.freepik.com/free-vector/medicine-bottle-pills-isolated_1284-42391.jpg?w=400",
};

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
    grad: "linear-gradient(135deg,#064E3B,#065F46)",
  },
  {
    tag: "⚡ Express",
    title: "30-Minute\nDelivery Guarantee",
    sub: "Or next order free",
    emoji: "🛵",
    grad: "linear-gradient(135deg,#1E3A5F,#2563EB)",
  },
  {
    tag: "🤖 AI Rx",
    title: "Smart Prescription\nReader",
    sub: "Upload & auto-order",
    emoji: "📱",
    grad: "linear-gradient(135deg,#4C1D95,#7C3AED)",
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

function getImageUrl(img) {
  if (!img) return ICONS.medicine;
  if (typeof img === "string" && img.startsWith("/uploads/")) return `${API_BASE_URL}${img}`;
  if (typeof img === "string" && (img.startsWith("http://") || img.startsWith("https://"))) return img;
  return ICONS.medicine;
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

// ─── Reusable primitives ──────────────────────────────────────

/** Pill chip for section headers */
function SectionChip({ children, color = DEEP }) {
  return (
    <span
      className="inline-block text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full"
      style={{ background: `${color}18`, color }}
    >
      {children}
    </span>
  );
}

/** Section header row */
function SectionRow({ title, badge, onSeeAll }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span
          className="font-extrabold text-[15px] tracking-tight"
          style={{ color: "#0B1F16", fontFamily: "'Sora', sans-serif" }}
        >
          {title}
        </span>
        {badge && <SectionChip>{badge}</SectionChip>}
      </div>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="flex items-center gap-0.5 text-[13px] font-bold"
          style={{ color: DEEP }}
        >
          See all <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── MedCard ─────────────────────────────────────────────────
function MedCard({ med, onAdd, onOpen, canDeliver }) {
  const [src, setSrc] = useState(
    getImageUrl(med.img || med.image || med.imageUrl)
  );
  const price = med.price ?? med.mrp ?? med.sellingPrice ?? med.salePrice ?? "--";
  const origPrice = med.mrp && med.price && med.price < med.mrp ? med.mrp : null;
  const discount = origPrice
    ? Math.round(((origPrice - price) / origPrice) * 100)
    : null;

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={() => onOpen?.(med)}
      className="cursor-pointer flex-shrink-0"
      style={{
        width: 230,
        background: "#fff",
        borderRadius: 20,
        border: "1.5px solid rgba(12,90,62,0.10)",
        boxShadow: "0 2px 14px rgba(12,90,62,0.07)",
        padding: 14,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Image */}
      <div
        style={{
          width: 72, height: 72, borderRadius: 14, overflow: "hidden",
          background: "#E8F5EF", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <img
          src={src}
          alt={med.brand || med.name || "Medicine"}
          loading="lazy"
          onError={() => setSrc(ICONS.medicine)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 13, fontWeight: 700, color: "#0B1F16",
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.35,
          }}
        >
          {med.brand || med.name || med.medicineName || "Medicine"}
        </div>

        {/* Price row */}
        <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800, color: DEEP }}>
            ₹{price}
          </span>
          {origPrice && (
            <span style={{ fontSize: 11, color: "#94A3B8", textDecoration: "line-through" }}>
              ₹{origPrice}
            </span>
          )}
          {discount && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#059669",
              background: "#E8F5EF", padding: "1px 6px", borderRadius: 100,
            }}>
              {discount}% OFF
            </span>
          )}
        </div>

        {/* Bottom row */}
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{
            fontSize: 10, fontWeight: 600, color: "#4A6B5A",
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
              borderRadius: 100, border: "none", cursor: canDeliver ? "pointer" : "not-allowed",
              background: canDeliver ? DEEP : "#CBD5E1",
              color: "#fff",
              fontSize: 12, fontWeight: 700, fontFamily: "'Sora',sans-serif",
              boxShadow: canDeliver ? "0 2px 8px rgba(12,90,62,0.25)" : "none",
            }}
          >
            + Add
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── PharmacyCard ────────────────────────────────────────────
function PharmacyCard({ ph, onClick }) {
  return (
    <motion.div
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      style={{
        flexShrink: 0, width: 130,
        background: "#fff",
        borderRadius: 20,
        border: "1.5px solid rgba(12,90,62,0.10)",
        boxShadow: "0 2px 12px rgba(12,90,62,0.07)",
        padding: "18px 12px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        cursor: "pointer",
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: "#E8F5EF",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 24,
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
        <span style={{ fontSize: 10, color: "#8BA898", fontWeight: 500 }}>
          📍 {formatDist(ph)}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 700, color: ACCENT,
          background: "rgba(0,200,117,0.1)",
          padding: "2px 8px", borderRadius: 100,
          fontFamily: "'Sora',sans-serif",
        }}>
          Open
        </span>
      </div>
    </motion.div>
  );
}

// ─── Banner Card ─────────────────────────────────────────────
function BannerCard({ banner, onClick }) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        flexShrink: 0, width: 280, height: 118,
        borderRadius: 20,
        background: banner.grad,
        position: "relative", overflow: "hidden",
        cursor: "pointer",
      }}
    >
      {/* decorative circles */}
      <div style={{
        position: "absolute", right: -20, top: -20,
        width: 110, height: 110, borderRadius: "50%",
        background: "rgba(255,255,255,0.07)",
      }} />
      <div style={{
        position: "absolute", right: 22, bottom: -30,
        width: 70, height: 70, borderRadius: "50%",
        background: "rgba(255,255,255,0.05)",
      }} />
      <div style={{ padding: "16px 18px", position: "relative", zIndex: 1 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.8px",
          textTransform: "uppercase", color: ACCENT,
          background: "rgba(0,200,117,0.15)",
          padding: "2px 8px", borderRadius: 100,
          display: "inline-block", marginBottom: 7,
          fontFamily: "'Sora',sans-serif",
        }}>
          {banner.tag}
        </div>
        <div style={{
          fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800,
          color: "#fff", lineHeight: 1.25, whiteSpace: "pre-line",
        }}>
          {banner.title}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>
          {banner.sub}
        </div>
      </div>
      <div style={{
        position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
        fontSize: 44, opacity: 0.7,
      }}>
        {banner.emoji}
      </div>
    </motion.div>
  );
}

// ─── Active Order Track Bar ───────────────────────────────────
function ActiveOrderBar({ order, onClick }) {
  const steps = [
    { key: "placed",          label: "Placed" },
    { key: "processing",      label: "Processing" },
    { key: "picked_up",       label: "Packed" },
    { key: "out_for_delivery",label: "On Way" },
    { key: "delivered",       label: "Done" },
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
        background: "linear-gradient(135deg,#0C5A3E,#0A7A50)",
        boxShadow: "0 6px 24px rgba(12,90,62,0.25)",
        border: "none", cursor: "pointer", textAlign: "left",
      }}
    >
      {/* Header */}
      <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🛵</span>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800, color: "#fff" }}>
              Live Order Tracking
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
              {statusLabel(order.status)} · Tap to view map
            </div>
          </div>
        </div>
        <div style={{
          background: ACCENT, color: DEEP,
          fontSize: 11, fontWeight: 700,
          padding: "5px 12px", borderRadius: 100,
          fontFamily: "'Sora',sans-serif",
        }}>
          Track →
        </div>
      </div>

      {/* Track steps */}
      <div style={{ padding: "4px 16px 14px" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {steps.map((step, i) => {
            const stepStatusIdx = statusOrder.indexOf(step.key);
            const done = stepStatusIdx <= currentIdx;
            const active = step.key === order.status || (i === steps.length - 1 && order.status === "out_for_delivery");
            return (
              <React.Fragment key={step.key}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: done ? ACCENT : "rgba(255,255,255,0.2)",
                    border: active ? `2px solid ${ACCENT}` : "none",
                    boxShadow: active ? `0 0 0 4px rgba(0,200,117,0.2)` : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, color: done ? DEEP : "transparent",
                    fontWeight: 700, transition: "all 0.3s",
                  }}>
                    {done ? "✓" : ""}
                  </div>
                  <span style={{ fontSize: 8, color: "rgba(255,255,255,0.55)", fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: done ? ACCENT : "rgba(255,255,255,0.15)", borderRadius: 1, marginBottom: 14 }} />
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
        flexShrink: 0, width: 180,
        background: "#fff",
        borderRadius: 20,
        border: "1.5px solid rgba(12,90,62,0.10)",
        boxShadow: "0 2px 12px rgba(12,90,62,0.07)",
        padding: "14px 14px",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "#E8F5EF",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
          flexShrink: 0,
        }}>
          👨‍⚕️
        </div>
        <div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700, color: "#0B1F16" }}>
            {doctor.name}
          </div>
          <div style={{ fontSize: 11, color: "#8BA898", marginTop: 2 }}>{doctor.spec}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: DEEP,
          background: "#E8F5EF", padding: "4px 10px", borderRadius: 100,
          display: "flex", alignItems: "center", gap: 4,
          fontFamily: "'Sora',sans-serif",
        }}>
          <Clock style={{ width: 10, height: 10 }} /> Slots today
        </span>
      </div>
    </motion.div>
  );
}

// ─── Medicine Detail Dialog ───────────────────────────────────
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
  const origPrice = med.mrp && med.price && med.price < med.mrp ? med.mrp : null;
  const discount = origPrice ? Math.round(((origPrice - price) / origPrice) * 100) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        style={{ width: "min(96vw,520px)", padding: 0, borderRadius: 24, overflow: "hidden" }}
      >
        {/* Header */}
        <DialogHeader style={{ padding: "20px 20px 12px" }}>
          <DialogTitle
            style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 800, color: DEEP }}
          >
            {med.brand || med.name}
          </DialogTitle>
        </DialogHeader>

        {/* Gallery */}
        <div style={{ margin: "0 20px", borderRadius: 16, overflow: "hidden", height: 220, position: "relative", background: "#E8F5EF" }}>
          <div
            style={{ display: "flex", height: "100%", transition: "transform 0.3s", transform: `translateX(-${activeImg * 100}%)` }}
            onTouchStart={(e) => (e.currentTarget.dataset.sx = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              const dx = e.changedTouches[0].clientX - Number(e.currentTarget.dataset.sx || 0);
              if (dx < -40 && activeImg < images.length - 1) setActiveImg((i) => i + 1);
              if (dx > 40 && activeImg > 0) setActiveImg((i) => i - 1);
            }}
          >
            {images.map((src, i) => (
              <div key={i} style={{ minWidth: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img
                  src={getImageUrl(src)}
                  alt={med.name}
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  draggable={false}
                />
              </div>
            ))}
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

        {/* Info */}
        <div style={{ padding: "16px 20px 0" }}>
          {/* Tags */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {Array.isArray(med.category) && med.category.map((c, i) => (
              <span key={i} style={{
                fontSize: 11, fontWeight: 600, color: DEEP,
                background: "#E8F5EF", padding: "3px 10px", borderRadius: 100,
                border: "1px solid rgba(12,90,62,0.15)",
              }}>{c}</span>
            ))}
            {med.type && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: "#4A6B5A",
                background: "#F1F5F9", padding: "3px 10px", borderRadius: 100,
              }}>
                {Array.isArray(med.type) ? med.type.join(", ") : med.type}
              </span>
            )}
          </div>

          {/* Price */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 26, fontWeight: 800, color: DEEP }}>₹{price}</span>
            {origPrice && <span style={{ fontSize: 14, color: "#94A3B8", textDecoration: "line-through" }}>₹{origPrice}</span>}
            {discount && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#059669", background: "#E8F5EF", padding: "3px 10px", borderRadius: 100 }}>
                {discount}% OFF
              </span>
            )}
          </div>

          {med.composition && (
            <div style={{ fontSize: 13, color: "#4A6B5A", marginBottom: 6 }}>
              <strong>Composition:</strong> {med.composition}
            </div>
          )}
          {med.company && (
            <div style={{ fontSize: 13, color: "#4A6B5A", marginBottom: 10 }}>
              <strong>Manufacturer:</strong> {med.company}
            </div>
          )}
          {med.description && (
            <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, marginBottom: 4 }}>
              {med.description}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: 20, paddingTop: 12, display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, height: 50, borderRadius: 14,
              background: "#F1F5F9", color: "#64748B",
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
              background: canDeliver ? `linear-gradient(135deg,${DEEP},#0A7A50)` : "#CBD5E1",
              color: "#fff",
              fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 700, cursor: canDeliver ? "pointer" : "not-allowed",
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
  const [selectedMed, setSelectedMed] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const popupTimeout = useRef(null);
  const noMedicinesTimer = useRef(null);

  const { user } = useAuth();
  const { cart, addToCart } = useCart();
  const navigate = useNavigate();
  const { currentAddress } = useLocation();

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
  const locationDisplay = currentAddress?.shortAddress
    || currentAddress?.area
    || currentAddress?.city
    || "your location";

  // ── Render ────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh", width: "100%", maxWidth: 480,
        margin: "0 auto",
        background: "#F0F5F2",
        paddingBottom: 120,
        position: "relative",
        overflowX: "hidden",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >

      {/* ══════════ HERO HEADER ══════════ */}
      <div style={{
        background: `linear-gradient(160deg, ${DEEP} 0%, #0A4631 100%)`,
        paddingBottom: 28,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative blobs */}
        <div style={{
          position: "absolute", right: -40, top: -40,
          width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,200,117,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", left: -60, bottom: -40,
          width: 180, height: 180, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,0,0,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Top row — location + avatar */}
        <Navbar />

        <div style={{ padding: "4px 20px 0" }}>
          {/* Location chip */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 100, padding: "5px 12px 5px 8px",
              cursor: "pointer", marginBottom: 12,
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: ACCENT,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <MapPin style={{ width: 12, height: 12, color: DEEP }} />
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                DELIVERING TO
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "'Sora',sans-serif" }}>
                {locationDisplay.length > 28 ? locationDisplay.slice(0, 28) + "…" : locationDisplay} ▾
              </div>
            </div>
          </motion.button>

          {/* Greeting */}
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 24, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 4 }}>
            Hi, {userName}! <span style={{ color: ACCENT }}>👋</span>
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 16 }}>
            What medicine do you need today?
          </div>

          {/* Search Bar */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/search")}
            style={{
              width: "100%", height: 52,
              background: "#fff",
              borderRadius: 16,
              display: "flex", alignItems: "center", gap: 12,
              padding: "0 14px",
              boxShadow: "0 6px 24px rgba(0,0,0,0.14)",
              border: "none", cursor: "pointer", textAlign: "left",
            }}
          >
            <Search style={{ width: 18, height: 18, color: "#8BA898", flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 14, color: "#8BA898", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
              Search medicines, brands, generics…
            </span>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: "#E8F5EF",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Mic style={{ width: 14, height: 14, color: DEEP }} />
            </div>
          </motion.button>
        </div>

        {/* Stats strip */}
        <div style={{ margin: "16px 20px 0", display: "flex", gap: 8 }}>
          {[
            { icon: "🏥", label: `${pharmaciesNearby.length || "10"}+ Pharmacies`, sub: "near you" },
            { icon: "⚡", label: "≤ 30 min", sub: "delivery" },
            { icon: "💰", label: "Upto 80%", sub: "savings" },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1, background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 14, padding: "8px 0",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              backdropFilter: "blur(8px)",
            }}>
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 10, fontWeight: 800, color: "#fff" }}>{s.label}</span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{s.sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════ CONTENT ══════════ */}
      <div style={{ padding: "20px 20px 0" }}>

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
                marginBottom: 16,
              }}
            >
              <AlertTriangle style={{ width: 18, height: 18, color: "#EF4444", flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#991B1B" }}>
                No delivery partner nearby right now. Check back soon!
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── QUICK ACTIONS GRID ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {[
              { label: "Upload Rx", emoji: "📋", bg: "linear-gradient(135deg,#0C5A3E,#0E9A5E)", onClick: () => setPrescriptionModalOpen(true) },
              { label: "Medicines", emoji: "💊", bg: "linear-gradient(135deg,#0891B2,#06B6D4)", onClick: () => navigate("/pharmacies-near-you") },
              { label: "Consult", emoji: "🩺", bg: "linear-gradient(135deg,#D97706,#F59E0B)", onClick: () => navigate("/doctors") },
              { label: "Offers", emoji: "🎁", bg: "linear-gradient(135deg,#DC2626,#F87171)", onClick: () => {} },
            ].map((act) => (
              <motion.button
                key={act.label}
                whileTap={{ scale: 0.92 }}
                whileHover={{ y: -3 }}
                onClick={act.onClick}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: 18,
                  background: act.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                }}>
                  {act.emoji}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#4A6B5A", fontFamily: "'Sora',sans-serif", textAlign: "center", lineHeight: 1.3 }}>
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
        <div style={{ marginBottom: 24 }}>
          <SectionRow title="Deals & Offers" badge="Hot 🔥" />
          <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
            {BANNERS.map((b, i) => (
              <BannerCard key={i} banner={b} onClick={() => {}} />
            ))}
          </div>
        </div>

        {/* ── NEARBY PHARMACIES ── */}
        {pharmaciesNearby.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <SectionRow title="Pharmacies Nearby" onSeeAll={() => navigate("/pharmacies-near-you")} />
            <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none" }}>
              {pharmaciesNearby.slice(0, 10).map((ph) => (
                <PharmacyCard
                  key={ph._id}
                  ph={ph}
                  onClick={() => navigate(`/medicines/${ph._id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── CATEGORY FILTER CHIPS ── */}
        <div style={{ marginBottom: 20 }}>
          <SectionRow title="Browse by Category" />
          <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
            {/* All chip */}
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setSelectedCategory("")}
              style={{
                flexShrink: 0, height: 38, padding: "0 16px",
                borderRadius: 100, border: "none", cursor: "pointer",
                fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700,
                background: !selectedCategory ? DEEP : "#fff",
                color: !selectedCategory ? "#fff" : "#4A6B5A",
                boxShadow: !selectedCategory ? `0 3px 10px rgba(12,90,62,0.3)` : "0 1px 6px rgba(0,0,0,0.07)",
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
                    borderRadius: 100, border: "none", cursor: "pointer",
                    fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600,
                    background: active ? DEEP : "#fff",
                    color: active ? "#fff" : "#4A6B5A",
                    boxShadow: active ? `0 3px 10px rgba(12,90,62,0.3)` : "0 1px 6px rgba(0,0,0,0.07)",
                    border: active ? "none" : "1.5px solid rgba(12,90,62,0.12)",
                    display: "flex", alignItems: "center", gap: 6,
                    transition: "all 0.2s",
                  }}
                >
                  <span>{emoji}</span>
                  <span>{label}</span>
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
                <SectionRow
                  title={`Medicines at ${ph.name}`}
                  onSeeAll={() => navigate(`/medicines/${ph._id}`)}
                />
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
            <div style={{ fontSize: 13, color: "#8BA898" }}>
              Searching nearby pharmacies...
            </div>
          </motion.div>
        )}

        {/* ── DOCTORS ── */}
        <div style={{ marginBottom: 28 }}>
          <SectionRow title="Consult a Doctor" onSeeAll={() => navigate("/doctors")} />
          <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none" }}>
            {[
              { name: "Dr. Sharma", spec: "General Physician" },
              { name: "Dr. Gupta", spec: "Pediatrics" },
              { name: "Dr. Iyer", spec: "Dermatology" },
              { name: "Dr. Mehta", spec: "Cardiology" },
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
              background: "#fff",
              borderRadius: 20,
              border: "1.5px solid rgba(12,90,62,0.10)",
              boxShadow: "0 2px 14px rgba(12,90,62,0.07)",
              padding: "18px 18px",
              display: "flex", alignItems: "center", gap: 14,
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: "#E8F5EF",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, flexShrink: 0,
            }}>
              📦
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700, color: "#0B1F16", marginBottom: 4 }}>
                Last Order
              </div>
              <div style={{ fontSize: 12, color: "#8BA898", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                  flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
                  boxShadow: "0 3px 10px rgba(12,90,62,0.25)",
                }}
              >
                <RefreshCw style={{ width: 12, height: 12 }} /> Reorder
              </motion.button>
            )}
          </motion.div>
        </div>

      </div>{/* /content */}

      {/* ══════════ FLOATING UPLOAD Rx CTA ══════════ */}
      <motion.div
        className="fixed z-[1201] flex justify-end"
        style={{ bottom: dockBottom, left: 0, right: 0, padding: "0 20px", pointerEvents: "none" }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setPrescriptionModalOpen(true)}
          style={{
            pointerEvents: "auto",
            display: "inline-flex", alignItems: "center", gap: 10,
            height: 50, paddingLeft: 12, paddingRight: 20,
            borderRadius: 100, border: "none", cursor: "pointer",
            background: `linear-gradient(135deg,${DEEP},#0A7A50)`,
            boxShadow: "0 8px 28px rgba(12,90,62,0.38)",
            fontFamily: "'Sora',sans-serif",
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(255,255,255,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <UploadCloud style={{ width: 16, height: 16, color: "#fff" }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Upload Prescription</span>
        </motion.button>
      </motion.div>

      {/* ══════════ MODALS ══════════ */}
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