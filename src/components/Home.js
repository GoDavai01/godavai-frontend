// ============================================================
//  Home.js — GoDavaii 2030 Ultra-Modern UI (TYPICAL MEDICINE APP)
//  ✅ FIXED: Autocomplete dropdown clipping issue (Portal -> document.body)
//  ✅ FIXED: Cleaner homepage (no pharmacy-name spam in feed)
//  ✅ SAME LOGIC: APIs, cart rules, delivery checks preserved
// ============================================================

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import { useLocation } from "../context/LocationContext";
import BottomNavBar from "./BottomNavBar";
import PrescriptionUploadModal from "./PrescriptionUploadModal";
import LocationModal from "./LocationModal";
import axios from "axios";
import {
  UploadCloud,
  Clock,
  ChevronRight,
  MapPin,
  Search,
  Mic,
  MicOff,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  User,
  X,
  TrendingUp,
  Sparkles,
  Star,
  ShieldCheck,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

// ─── Constants ───────────────────────────────────────────────
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const DEEP = "#0C5A3E";
const MID = "#0E7A4F";
const ACCENT = "#00D97E";

const CATEGORIES = [
  { label: "Fever", emoji: "🌡️" },
  { label: "Diabetes", emoji: "💉" },
  { label: "Cold", emoji: "🤧" },
  { label: "Heart", emoji: "❤️" },
  { label: "Antibiotic", emoji: "💊" },
  { label: "Ayurveda", emoji: "🌿" },
  { label: "Painkiller", emoji: "🔵" },
  { label: "Cough", emoji: "🫁" },
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
    tag: "🛡️ Trusted",
    title: "Verified Local\nPharmacies Only",
    sub: "Reliable & authentic meds",
    emoji: "✅",
    grad: "linear-gradient(135deg,#4C1D95 0%,#7C3AED 100%)",
  },
];

const ACTIVE_STATUSES = new Set([
  "pending",
  "placed",
  "quoted",
  "processing",
  "assigned",
  "accepted",
  "picked_up",
  "out_for_delivery",
]);

const TRENDING_SEARCHES = [
  "Paracetamol",
  "Vitamin D3",
  "Pantoprazole",
  "Cetirizine",
  "Azithromycin",
  "Metformin",
];

// ─── Helpers ─────────────────────────────────────────────────
function isMedicineInCategory(med, cat) {
  if (!med || !cat) return false;
  const t = cat.trim().toLowerCase();
  let cats = [];
  if (typeof med.category === "string") cats.push(med.category);
  if (Array.isArray(med.category)) cats = cats.concat(med.category);
  if (Array.isArray(med.categories)) cats = cats.concat(med.categories);
  return cats
    .filter(Boolean)
    .map((x) => x.toLowerCase())
    .some((c) => c.includes(t) || t.includes(c));
}

function getImageUrl(img) {
  if (!img) return null;
  if (typeof img === "string" && img.startsWith("/uploads/")) return `${API_BASE_URL}${img}`;
  if (typeof img === "string" && img.startsWith("http")) return img;
  return null;
}

function formatDist(ph) {
  const km =
    typeof ph?.distanceKm === "number"
      ? ph.distanceKm
      : typeof ph?.distanceMeters === "number"
        ? ph.distanceMeters / 1000
        : typeof ph?.dist?.calculated === "number"
          ? ph.dist.calculated / 1000
          : null;
  if (km == null || Number.isNaN(km)) return "--";
  return km < 1 ? "<1 km" : `${km.toFixed(1)} km`;
}

function statusLabel(s) {
  const map = {
    pending: "Pending",
    placed: "Order Placed",
    quoted: "Quoted",
    processing: "Processing",
    assigned: "Assigned",
    accepted: "Accepted",
    picked_up: "Picked Up",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
  };
  return map[s] || s;
}

// ─── UI atoms ────────────────────────────────────────────────
function GlassCard({ children, style }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.82)",
        border: "1px solid rgba(12,90,62,0.08)",
        borderRadius: 22,
        boxShadow: "0 10px 34px rgba(2,10,7,0.06)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionRow({ title, badge, onSeeAll }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 16,
            fontWeight: 900,
            color: "#0B1F16",
            letterSpacing: "-0.3px",
          }}
        >
          {title}
        </span>
        {badge && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: DEEP,
              background: `${DEEP}12`,
              padding: "3px 10px",
              borderRadius: 999,
              letterSpacing: "0.5px",
              border: `1px solid ${DEEP}18`,
            }}
          >
            {badge}
          </span>
        )}
      </div>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            fontSize: 13,
            fontWeight: 800,
            color: DEEP,
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          See all <ChevronRight style={{ width: 14, height: 14 }} />
        </button>
      )}
    </div>
  );
}

// ─── Med image ────────────────────────────────────────────────
function MedImage({ med, size = 72 }) {
  const src = getImageUrl(med?.img || med?.image || med?.imageUrl);
  const [failed, setFailed] = useState(!src);
  if (failed || !src)
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 16,
          background: "linear-gradient(135deg,#E8F5EF,#D1EDE0)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: size * 0.52,
        }}
      >
        💊
      </div>
    );

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 16,
        overflow: "hidden",
        background: "#F0F9F4",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
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

// ─── Medicine card (uniform height, clean) ───────────────────
function MedCard({ med, onAdd, onOpen, canDeliver }) {
  const price = med.price ?? med.mrp ?? "--";
  const origPrice = med.mrp && med.price && Number(med.price) < Number(med.mrp) ? med.mrp : null;
  const discount = origPrice ? Math.round(((origPrice - price) / origPrice) * 100) : null;

  const title = med.brand || med.name || "Medicine";
  const sub = med.company || med.composition || "";

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      whileHover={{ y: -3 }}
      onClick={() => onOpen?.(med)}
      style={{
        width: 200,
        flexShrink: 0,
        cursor: "pointer",
      }}
    >
      <GlassCard style={{ padding: 14, position: "relative", overflow: "hidden", height: 132 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, rgba(0,217,126,0.035), transparent 55%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ display: "flex", gap: 12 }}>
          <MedImage med={med} size={62} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "'Sora', sans-serif",
                fontSize: 13,
                fontWeight: 900,
                color: "#0B1F16",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                lineHeight: 1.25,
                marginBottom: 6,
              }}
            >
              {title}
            </div>

            {sub ? (
              <div
                style={{
                  fontSize: 10.5,
                  color: "#94A3B8",
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginBottom: 8,
                }}
              >
                {sub}
              </div>
            ) : (
              <div style={{ height: 18 }} />
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 1000, color: DEEP }}>
                ₹{price}
              </span>
              {origPrice && (
                <span style={{ fontSize: 11, color: "#CBD5E1", textDecoration: "line-through", fontWeight: 800 }}>
                  ₹{origPrice}
                </span>
              )}
              {discount && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    color: "#059669",
                    background: "#ECFDF5",
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}
                >
                  {discount}% OFF
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#6B9E88",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Clock style={{ width: 11, height: 11 }} /> ≤30 min
              </span>

              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canDeliver) onAdd(med);
                }}
                disabled={!canDeliver}
                style={{
                  height: 30,
                  paddingLeft: 14,
                  paddingRight: 14,
                  borderRadius: 999,
                  border: "none",
                  cursor: canDeliver ? "pointer" : "not-allowed",
                  background: canDeliver ? `linear-gradient(135deg,${DEEP},${MID})` : "#E2E8F0",
                  color: canDeliver ? "#fff" : "#94A3B8",
                  fontSize: 12,
                  fontWeight: 900,
                  fontFamily: "'Sora',sans-serif",
                  boxShadow: canDeliver ? "0 6px 18px rgba(12,90,62,0.22)" : "none",
                }}
              >
                + Add
              </motion.button>
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ─── Pharmacy card ───────────────────────────────────────────
function PharmacyCard({ ph, onClick }) {
  return (
    <motion.div whileTap={{ scale: 0.96 }} whileHover={{ y: -2 }} onClick={onClick} style={{ width: 150, flexShrink: 0 }}>
      <GlassCard style={{ padding: 14, cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 16,
              background: "linear-gradient(135deg,#E8F5EF,#C6E8D8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            🏥
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: "'Sora',sans-serif",
                fontSize: 12.5,
                fontWeight: 900,
                color: "#0B1F16",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginBottom: 4,
              }}
            >
              {ph.name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: "#94A3B8" }}>📍 {formatDist(ph)}</span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  color: "#059669",
                  background: "linear-gradient(135deg,#ECFDF5,#D1FAE5)",
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                ● Open
              </span>
            </div>
          </div>
          <ChevronRight style={{ width: 16, height: 16, color: "#CBD5E1" }} />
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ─── Banner card ─────────────────────────────────────────────
function BannerCard({ banner }) {
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      whileHover={{ y: -2 }}
      style={{
        flexShrink: 0,
        width: 280,
        height: 128,
        borderRadius: 24,
        background: banner.grad,
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: "0 12px 36px rgba(0,0,0,0.16)",
      }}
    >
      <div style={{ position: "absolute", right: -24, top: -24, width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.10)" }} />
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 60, background: "linear-gradient(180deg,rgba(255,255,255,0.10),transparent)" }} />
      <div style={{ padding: "16px 18px", position: "relative", zIndex: 1 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.8px",
            textTransform: "uppercase",
            color: "#00FFB2",
            background: "rgba(0,255,178,0.12)",
            padding: "3px 10px",
            borderRadius: 999,
            display: "inline-block",
            marginBottom: 8,
            fontFamily: "'Sora',sans-serif",
            border: "1px solid rgba(0,255,178,0.16)",
          }}
        >
          {banner.tag}
        </div>
        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 1000, color: "#fff", lineHeight: 1.25, whiteSpace: "pre-line" }}>
          {banner.title}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.58)", marginTop: 4, fontWeight: 700 }}>{banner.sub}</div>
      </div>
      <div style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", fontSize: 44, opacity: 0.85 }}>
        {banner.emoji}
      </div>
    </motion.div>
  );
}

// ─── Active Order Bar ─────────────────────────────────────────
function ActiveOrderBar({ order, onClick }) {
  const steps = [
    { key: "placed", label: "Placed" },
    { key: "processing", label: "Processing" },
    { key: "picked_up", label: "Packed" },
    { key: "out_for_delivery", label: "On Way" },
    { key: "delivered", label: "Done" },
  ];
  const statusOrder = ["placed", "quoted", "processing", "assigned", "accepted", "picked_up", "out_for_delivery", "delivered"];
  const currentIdx = statusOrder.indexOf(order.status);

  return (
    <motion.button
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      style={{
        width: "100%",
        borderRadius: 24,
        overflow: "hidden",
        background: "linear-gradient(135deg,#0C5A3E 0%,#041F15 55%,#0E7A4F 100%)",
        boxShadow: "0 14px 38px rgba(12,90,62,0.30)",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        position: "relative",
      }}
    >
      <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 14, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
            🛵
          </div>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 1000, color: "#fff" }}>Live Order Tracking</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.62)", marginTop: 1, fontWeight: 700 }}>
              {statusLabel(order.status)} · Tap to view map
            </div>
          </div>
        </div>
        <div style={{ background: ACCENT, color: DEEP, fontSize: 11, fontWeight: 1000, padding: "7px 14px", borderRadius: 999, fontFamily: "'Sora',sans-serif" }}>
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
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: done ? ACCENT : "rgba(255,255,255,0.2)",
                      border: active ? `2.5px solid ${ACCENT}` : "none",
                      boxShadow: active ? `0 0 0 5px rgba(0,217,126,0.2)` : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      color: done ? DEEP : "transparent",
                      fontWeight: 1000,
                    }}
                  >
                    {done ? "✓" : ""}
                  </div>
                  <span style={{ fontSize: 8, color: "rgba(255,255,255,0.55)", fontWeight: 800, textAlign: "center" }}>{step.label}</span>
                </div>
                {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: done ? ACCENT : "rgba(255,255,255,0.15)", borderRadius: 1, marginBottom: 14 }} />}
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
    <motion.div whileTap={{ scale: 0.98 }} onClick={onClick} style={{ width: 190, flexShrink: 0, cursor: "pointer" }}>
      <GlassCard style={{ padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 18,
              background: "linear-gradient(135deg,#E8F5EF,#C6E8D8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            👨‍⚕️
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 1000, color: "#0B1F16" }}>{doctor.name}</div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2, fontWeight: 800 }}>{doctor.spec}</div>
          </div>
        </div>

        <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 900, color: DEEP, background: "#E8F5EF", padding: "5px 10px", borderRadius: 999 }}>
            <Clock style={{ width: 11, height: 11 }} /> Slots today
          </span>
          <ChevronRight style={{ width: 16, height: 16, color: "#CBD5E1" }} />
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ─── Med Detail Dialog ────────────────────────────────────────
function MedDetailDialog({ med, open, onClose, onAddToCart, canDeliver }) {
  const [activeImg, setActiveImg] = useState(0);
  const images = useMemo(() => {
    if (!med) return [];
    const arr = (Array.isArray(med.images) && med.images.length ? med.images : [med.img]).filter(Boolean);
    return arr.length ? arr : [null];
  }, [med]);

  useEffect(() => {
    if (open) setActiveImg(0);
  }, [open]);

  if (!med) return null;

  const price = med.price ?? med.mrp ?? "--";
  const origPrice = med.mrp && med.price && Number(med.price) < Number(med.mrp) ? med.mrp : null;
  const discount = origPrice ? Math.round(((origPrice - price) / origPrice) * 100) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent style={{ width: "min(96vw,520px)", padding: 0, borderRadius: 24, overflow: "hidden" }}>
        <DialogHeader style={{ padding: "20px 20px 12px" }}>
          <DialogTitle style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 1000, color: DEEP }}>
            {med.brand || med.name}
          </DialogTitle>
        </DialogHeader>

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
        </div>

        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 26, fontWeight: 1000, color: DEEP }}>₹{price}</span>
            {origPrice && <span style={{ fontSize: 14, color: "#CBD5E1", textDecoration: "line-through", fontWeight: 900 }}>₹{origPrice}</span>}
            {discount && <span style={{ fontSize: 12, fontWeight: 900, color: "#059669", background: "#ECFDF5", padding: "3px 10px", borderRadius: 999 }}>{discount}% OFF</span>}
          </div>

          {med.composition && <div style={{ fontSize: 13, color: "#4A6B5A", marginBottom: 6, fontWeight: 700 }}><strong>Composition:</strong> {med.composition}</div>}
          {med.company && <div style={{ fontSize: 13, color: "#4A6B5A", marginBottom: 10, fontWeight: 700 }}><strong>Manufacturer:</strong> {med.company}</div>}
          {med.description && <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, fontWeight: 650 }}>{med.description}</div>}
        </div>

        <div style={{ padding: 20, paddingTop: 12, display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              height: 50,
              borderRadius: 14,
              background: "#F8FAFC",
              color: "#64748B",
              border: "1.5px solid #E2E8F0",
              fontFamily: "'Sora',sans-serif",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Close
          </button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={!canDeliver}
            onClick={() => {
              if (canDeliver) {
                onAddToCart(med);
                onClose();
              }
            }}
            style={{
              flex: 2,
              height: 50,
              borderRadius: 14,
              border: "none",
              background: canDeliver ? `linear-gradient(135deg,${DEEP},${MID})` : "#E2E8F0",
              color: canDeliver ? "#fff" : "#94A3B8",
              fontFamily: "'Sora',sans-serif",
              fontSize: 15,
              fontWeight: 1000,
              cursor: canDeliver ? "pointer" : "not-allowed",
              boxShadow: canDeliver ? "0 6px 18px rgba(12,90,62,0.25)" : "none",
            }}
          >
            {canDeliver ? "Add to Cart 🛒" : "Delivery Unavailable"}
          </motion.button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
//  HomeSearch — FIXED dropdown (Portal + proper positioning)
// ═══════════════════════════════════════════════════════════════
function HomeSearch({ currentAddress, navigate }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [micSupported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));

  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const recognitionRef = useRef(null);

  // Dropdown anchor position
  const [anchor, setAnchor] = useState({ top: 0, left: 0, width: 0 });

  const updateAnchor = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchor({ top: r.bottom + 8, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!focused) return;
    updateAnchor();
    const onScroll = () => updateAnchor();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [focused, updateAnchor]);

  // Autocomplete fetch
  useEffect(() => {
    if (!query.trim()) {
      setOptions([]);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const city = (currentAddress?.city || "").trim();
        const r = await axios.get(`${API_BASE_URL}/api/medicines/autocomplete`, {
          params: { q: query.trim(), city, limit: 10 },
          signal: controller.signal,
        });
        if (r.data?.length) {
          setOptions(r.data);
          setLoading(false);
          return;
        }
        // fallback
        const r2 = await axios.get(`${API_BASE_URL}/api/search/search-autocomplete`, {
          params: { q: query.trim(), city, type: "all" },
          signal: controller.signal,
        });
        setOptions(r2.data || []);
      } catch (e) {
        if (!axios.isCancel(e)) setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 160);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [query, currentAddress?.city]);

  // Click outside closes
  useEffect(() => {
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setFocused(false);
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("touchstart", h, { passive: true });
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("touchstart", h);
    };
  }, []);

  // Voice
  const startMic = useCallback(() => {
    if (!micSupported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "hi-IN,en-IN";
    rec.interimResults = false;
    recognitionRef.current = rec;
    setMicActive(true);
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setQuery(t);
      setMicActive(false);
      setTimeout(() => navigate(`/search?q=${encodeURIComponent(t)}`), 250);
    };
    rec.onerror = () => setMicActive(false);
    rec.onend = () => setMicActive(false);
    rec.start();
  }, [micSupported, navigate]);

  const stopMic = useCallback(() => {
    recognitionRef.current?.stop();
    setMicActive(false);
  }, []);

  const handleSelect = (val) => {
    const v = typeof val === "string" ? val : val?.name || val?.label || val?.brand || "";
    if (!v) return;
    setQuery(v);
    setFocused(false);
    navigate(`/search?q=${encodeURIComponent(v)}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && query.trim()) {
      setFocused(false);
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
    if (e.key === "Escape") setFocused(false);
  };

  const optionLabels = options
    .map((o) => (typeof o === "string" ? o : o?.name || o?.label || o?.brand || ""))
    .filter((l) => l && l.trim())
    .filter((l, i, a) => a.indexOf(l) === i)
    .slice(0, 8);

  const dropdownOpen = focused && (loading || optionLabels.length > 0 || !query);

  const dropdown = (
    <AnimatePresence>
      {dropdownOpen && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          style={{
            position: "fixed",
            top: anchor.top,
            left: anchor.left,
            width: anchor.width,
            zIndex: 99999, // ✅ always on top
            borderRadius: 20,
            background: "rgba(255,255,255,0.98)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1.5px solid rgba(12,90,62,0.12)",
            boxShadow: "0 28px 70px rgba(0,0,0,0.24)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "10px 16px 6px", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            {query ? <Sparkles style={{ width: 11, height: 11, color: ACCENT }} /> : <TrendingUp style={{ width: 11, height: 11, color: "#94A3B8" }} />}
            <span style={{ fontSize: 10, fontWeight: 1000, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.7px" }}>
              {query ? "Suggestions" : "Trending Searches"}
            </span>
          </div>

          {(query ? optionLabels : TRENDING_SEARCHES).map((label, i) => (
            <motion.button
              key={`${label}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => handleSelect(label)}
              style={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                gap: 12,
                padding: "11px 16px",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                borderBottom: i < (query ? optionLabels : TRENDING_SEARCHES).length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FBF9")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <div style={{ width: 34, height: 34, borderRadius: 12, background: query ? "#E8F5EF" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {query ? <Search style={{ width: 14, height: 14, color: DEEP }} /> : <TrendingUp style={{ width: 14, height: 14, color: "#94A3B8" }} />}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#0B1F16", fontFamily: "'Plus Jakarta Sans',sans-serif", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {label}
                </span>
                {!query && <span style={{ fontSize: 10, color: "#CBD5E1", fontWeight: 700 }}>Popular search</span>}
              </div>

              <ChevronRight style={{ width: 14, height: 14, color: "#CBD5E1", flexShrink: 0 }} />
            </motion.button>
          ))}

          {query && optionLabels.length === 0 && !loading && (
            <div style={{ padding: "16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 12, background: "#FFF5F5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                🔍
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 1000, color: "#0B1F16" }}>Search for "{query}"</div>
                <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 750 }}>Press Enter to see all results</div>
              </div>
            </div>
          )}

          {query && (
            <div style={{ padding: "10px 12px 12px" }}>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setFocused(false);
                  navigate(`/search?q=${encodeURIComponent(query.trim())}`);
                }}
                style={{
                  width: "100%",
                  height: 44,
                  borderRadius: 14,
                  border: "none",
                  background: `linear-gradient(135deg,${DEEP},${MID})`,
                  color: "#fff",
                  fontFamily: "'Sora',sans-serif",
                  fontSize: 14,
                  fontWeight: 1000,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: "0 6px 18px rgba(12,90,62,0.25)",
                }}
              >
                <Search style={{ width: 15, height: 15 }} /> Search "{query}"
              </motion.button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div ref={wrapRef} style={{ position: "relative" }}>
        <motion.div
          animate={{
            boxShadow: focused ? `0 0 0 3px rgba(0,217,126,0.25), 0 16px 44px rgba(0,0,0,0.22)` : "0 10px 34px rgba(0,0,0,0.18)",
            scale: focused ? 1.005 : 1,
          }}
          transition={{ duration: 0.2 }}
          style={{
            display: "flex",
            alignItems: "center",
            height: 56,
            borderRadius: 18,
            background: "rgba(255,255,255,0.97)",
            padding: "0 8px 0 14px",
            border: focused ? `1.5px solid rgba(0,217,126,0.55)` : "1.5px solid rgba(255,255,255,0.35)",
          }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 14, flexShrink: 0, background: focused ? `${DEEP}12` : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
            {loading ? (
              <div style={{ width: 16, height: 16, border: `2.5px solid ${DEEP}30`, borderTopColor: DEEP, borderRadius: "50%", animation: "hmSpin 0.7s linear infinite" }} />
            ) : (
              <Search style={{ width: 16, height: 16, color: focused ? DEEP : "#94A3B8" }} />
            )}
          </div>

          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setFocused(true);
              requestAnimationFrame(updateAnchor);
            }}
            onFocus={() => {
              setFocused(true);
              requestAnimationFrame(updateAnchor);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search medicines, brands, generics..."
            style={{
              flex: 1,
              height: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 15,
              fontWeight: 800,
              color: "#0B1F16",
              fontFamily: "'Plus Jakarta Sans',sans-serif",
              letterSpacing: "-0.1px",
            }}
          />

          <AnimatePresence>
            {query && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setQuery("");
                  setOptions([]);
                  inputRef.current?.focus();
                  requestAnimationFrame(updateAnchor);
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#F1F5F9",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginRight: 6,
                }}
              >
                <X style={{ width: 13, height: 13, color: "#94A3B8" }} />
              </motion.button>
            )}
          </AnimatePresence>

          <div style={{ width: 1, height: 24, background: "rgba(0,0,0,0.08)", marginRight: 8, flexShrink: 0 }} />

          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={micActive ? stopMic : startMic}
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              flexShrink: 0,
              background: micActive ? "linear-gradient(135deg,#DC2626,#EF4444)" : `linear-gradient(135deg,${ACCENT}20,#00E5FF18)`,
              border: micActive ? "none" : `1px solid ${ACCENT}30`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: micSupported ? "pointer" : "not-allowed",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {micActive && <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.22)", animation: "micPulse 0.8s ease-in-out infinite" }} />}
            {micActive ? <MicOff style={{ width: 16, height: 16, color: "#fff", position: "relative", zIndex: 1 }} /> : <Mic style={{ width: 16, height: 16, color: DEEP }} />}
          </motion.button>
        </motion.div>
      </div>

      {/* ✅ FIX: dropdown rendered to BODY (no clipping) */}
      {createPortal(dropdown, document.body)}
    </>
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

  // ✅ same: profile completion redirect
  useEffect(() => {
    if (!user) return;
    const localDone = localStorage.getItem("profileCompleted") === "1";
    const missingRequired = !user.name || !user.email || !user.dob;
    if (!localDone && (!user.profileCompleted || missingRequired)) navigate("/profile?setup=1", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // ✅ same: coords
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

  // ✅ same: delivery availability
  useEffect(() => {
    const lat = Number(currentAddress?.lat ?? userCoords?.lat);
    const lng = Number(currentAddress?.lng ?? userCoords?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    fetch(`${API_BASE_URL}/api/delivery/active-partner-nearby?lat=${lat}&lng=${lng}`)
      .then((r) => r.json())
      .then((d) => setCanDeliver(!!d.activePartnerExists))
      .catch(() => setCanDeliver(false));
  }, [currentAddress, userCoords]);

  // ✅ same: last order
  useEffect(() => {
    if (!user?._id && !user?.userId) return;
    fetch(`${API_BASE_URL}/api/allorders/myorders-userid/${user._id || user.userId}`)
      .then((r) => r.json())
      .then((orders) => {
        if (Array.isArray(orders) && orders.length) setLastOrder(orders[0]);
      })
      .catch(() => {});
  }, [user]);

  // ✅ same: active order
  useEffect(() => {
    async function getActive() {
      const idFromLS = localStorage.getItem("activeOrderId");
      try {
        if (idFromLS) {
          const r = await fetch(`${API_BASE_URL}/api/orders/${idFromLS}`);
          if (r.ok) {
            const o = await r.json();
            if (ACTIVE_STATUSES.has(o.status)) {
              setActiveOrder(o);
              return;
            }
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
          if (active) {
            setActiveOrder(active);
            localStorage.setItem("activeOrderId", active._id);
            return;
          }
        }
        setActiveOrder(null);
      } catch {}
    }
    getActive();
  }, [user]);

  // ✅ same: nearby pharmacies + top meds per pharmacy
  useEffect(() => {
    if (!userCoords) return;
    fetch(`${API_BASE_URL}/api/pharmacies/nearby?lat=${userCoords.lat}&lng=${userCoords.lng}&maxDistance=8000`)
      .then((r) => r.json())
      .then((pharmacies) => {
        const active = pharmacies.filter((ph) => ph.active !== false).slice(0, 10);
        setPharmaciesNearby(active);

        Promise.all(
          active.slice(0, 6).map((ph) =>
            fetch(`${API_BASE_URL}/api/medicines?pharmacyId=${ph._id}`)
              .then((r) => r.json())
              .then((meds) => ({ pharmacyId: ph._id, medicines: meds.slice(0, 10) }))
              .catch(() => ({ pharmacyId: ph._id, medicines: [] }))
          )
        ).then((results) => {
          const map = {};
          results.forEach((r) => {
            map[r.pharmacyId] = r.medicines;
          });
          setMostOrderedByPharmacy(map);
        });
      })
      .catch(() => {});
  }, [userCoords]);

  // ✅ same: category fetch full meds
  useEffect(() => {
    if (!selectedCategory || pharmaciesNearby.length === 0) return;
    const toFetch = pharmaciesNearby.slice(0, 6).filter((ph) => !allMedsByPharmacy[ph._id]);
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
        results.forEach((r) => {
          m[r.pharmacyId] = r.medicines;
        });
        return m;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, pharmaciesNearby]);

  // ✅ same: fallback timer
  useEffect(() => {
    if (!selectedCategory) {
      setShowFallbackMeds(false);
      return;
    }
    const noneHave = pharmaciesNearby.slice(0, 6).every((ph) => {
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

  useEffect(
    () => () => {
      clearTimeout(popupTimeout.current);
      clearTimeout(noMedicinesTimer.current);
    },
    []
  );

  // ✅ same: cart rule (single pharmacy)
  const handleAddToCart = (med) => {
    if (!canDeliver) {
      alert("Sorry, delivery isn't available at your location right now.");
      return;
    }
    if (cartCount > 0) {
      const cartPharmacyId = cart[0]?.pharmacy?._id || cart[0]?.pharmacy;
      if (med.pharmacy?._id !== cartPharmacyId && med.pharmacy !== cartPharmacyId) {
        alert("You can only order medicines from one pharmacy at a time.");
        return;
      }
    }
    addToCart(med);
  };

  // ✅ NEW UI FEED (logic same data):
  // Top medicines near you (flatten from pharmacies, keep unique-ish)
  const topMedsNearYou = useMemo(() => {
    const phs = pharmaciesNearby.slice(0, 6);

    const pickFrom = phs.flatMap((ph) => {
      const base = selectedCategory ? (allMedsByPharmacy[ph._id] || []) : (mostOrderedByPharmacy[ph._id] || []);
      let meds = selectedCategory ? base.filter((m) => isMedicineInCategory(m, selectedCategory)) : base;

      if (selectedCategory && meds.length === 0 && showFallbackMeds) meds = base.slice(0, 10);
      return meds.slice(0, 8);
    });

    // unique by _id / name+brand
    const seen = new Set();
    const out = [];
    for (const m of pickFrom) {
      const k = m?._id || `${m?.brand || ""}|${m?.name || ""}|${m?.company || ""}`;
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(m);
      if (out.length >= 16) break;
    }
    return out;
  }, [pharmaciesNearby, mostOrderedByPharmacy, selectedCategory, allMedsByPharmacy, showFallbackMeds]);

  const userName = user?.name?.split(" ")?.[0] || "there";
  const locationText = currentAddress?.formatted
    ? currentAddress.formatted.length > 36
      ? currentAddress.formatted.slice(0, 36) + "…"
      : currentAddress.formatted
    : "Set delivery location";

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        maxWidth: 480,
        margin: "0 auto",
        background: "linear-gradient(180deg,#F2F7F4 0%,#E8F5EF 30%,#F0F9FF 60%,#F5F3FF 80%,#F2F7F4 100%)",
        paddingBottom: 120,
        position: "relative",
        overflowX: "hidden",
        fontFamily: "'Plus Jakarta Sans',sans-serif",
      }}
    >
      {/* ══════════ HERO HEADER (typical modern) ══════════ */}
      <div
        style={{
          background: `linear-gradient(160deg,${DEEP} 0%,#041F15 42%,#0A4631 100%)`,
          paddingBottom: 18,
          position: "relative",
          borderBottomLeftRadius: 34,
          borderBottomRightRadius: 34,
          boxShadow: "0 18px 54px rgba(12,90,62,0.24)",
        }}
      >
        {/* Orbs */}
        <div style={{ position: "absolute", right: -70, top: -70, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,217,126,0.18) 0%,rgba(0,229,255,0.05) 45%,transparent 72%)", pointerEvents: "none", animation: "orbFloat 8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", left: -90, bottom: -80, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,0.08) 0%,transparent 70%)", pointerEvents: "none", animation: "orbFloat 10s ease-in-out infinite reverse" }} />

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", padding: "16px 18px 12px", gap: 10 }}>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setLocationModalOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 18,
              padding: "10px 13px",
              cursor: "pointer",
              flex: 1,
              minWidth: 0,
            }}
          >
            <div style={{ position: "relative", width: 34, height: 34, borderRadius: 14, background: `linear-gradient(135deg,${ACCENT},#00E5FF)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 18px rgba(0,217,126,0.35)" }}>
              <MapPin style={{ width: 15, height: 15, color: "#041F15" }} />
              <div style={{ position: "absolute", top: -2, right: -2, width: 9, height: 9, borderRadius: "50%", background: "#00FFB2", border: "1.5px solid #041F15", animation: "glowPulse 2s ease-in-out infinite" }} />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: `${ACCENT}CC`, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 1 }}>
                DELIVERING TO
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", fontFamily: "'Sora',sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {locationText}
              </div>
            </div>

            <ChevronDown style={{ width: 14, height: 14, color: "rgba(255,255,255,0.45)", flexShrink: 0 }} />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate("/profile")}
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(12px)",
              border: "1.5px solid rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <User style={{ width: 18, height: 18, color: "#fff" }} />
          </motion.button>
        </div>

        {/* Greeting + Search */}
        <div style={{ padding: "0 18px 16px" }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 1000, color: "#fff", lineHeight: 1.2, marginBottom: 6 }}>
            Hi, {userName}! <span style={{ color: ACCENT }}>👋</span>
          </div>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.62)", marginBottom: 14, fontWeight: 700 }}>
            Search medicine, upload Rx, or consult a doctor.
          </div>

          <HomeSearch currentAddress={currentAddress} navigate={navigate} />

          {/* Micro trust row */}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            {[
              { icon: <ShieldCheck style={{ width: 14, height: 14, color: ACCENT }} />, text: "Verified pharmacies" },
              { icon: <Clock style={{ width: 14, height: 14, color: ACCENT }} />, text: "Fast delivery" },
              { icon: <Star style={{ width: 14, height: 14, color: ACCENT }} />, text: "Best offers" },
            ].map((b, i) => (
              <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 16, padding: "10px 10px" }}>
                <div style={{ width: 30, height: 30, borderRadius: 12, background: "rgba(0,217,126,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {b.icon}
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 900, color: "rgba(255,255,255,0.78)", lineHeight: 1.1 }}>
                  {b.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════ CONTENT ══════════ */}
      <div style={{ padding: "18px 18px 0" }}>
        <AnimatePresence>
          {!canDeliver && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                background: "#FFF5F5",
                border: "1.5px solid #FECACA",
                borderRadius: 18,
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <AlertTriangle style={{ width: 18, height: 18, color: "#EF4444", flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 850, color: "#991B1B" }}>No delivery partner nearby right now. Check back soon!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Actions */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {[
              { label: "Upload Rx", emoji: "📋", bg: `linear-gradient(135deg,${DEEP},${MID})`, glow: "rgba(12,90,62,0.30)", onClick: () => setPrescriptionModalOpen(true) },
              { label: "Medicines", emoji: "💊", bg: "linear-gradient(135deg,#0891B2,#0EA5E9)", glow: "rgba(8,145,178,0.26)", onClick: () => navigate("/pharmacies-near-you") },
              { label: "Consult", emoji: "🩺", bg: "linear-gradient(135deg,#D97706,#F59E0B)", glow: "rgba(217,119,6,0.26)", onClick: () => navigate("/doctors") },
              { label: "Offers", emoji: "🎁", bg: "linear-gradient(135deg,#DC2626,#F87171)", glow: "rgba(220,38,38,0.24)", onClick: () => {} },
            ].map((act) => (
              <motion.button key={act.label} whileTap={{ scale: 0.90 }} whileHover={{ y: -2 }} onClick={act.onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <div style={{ width: 60, height: 60, borderRadius: 22, background: act.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: `0 10px 28px ${act.glow}`, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,rgba(255,255,255,0.20),transparent 60%)", borderRadius: "inherit" }} />
                  <span style={{ position: "relative", zIndex: 1 }}>{act.emoji}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 950, color: "#1C3327", fontFamily: "'Sora',sans-serif", textAlign: "center", lineHeight: 1.2 }}>{act.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Active order */}
        <AnimatePresence>
          {activeOrder && (
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} style={{ marginBottom: 18 }}>
              <ActiveOrderBar order={activeOrder} onClick={() => navigate(`/order-tracking/${activeOrder._id}`)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Deals */}
        <div style={{ marginBottom: 20 }}>
          <SectionRow title="Deals & Offers" badge="HOT 🔥" />
          <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
            {BANNERS.map((b, i) => (
              <BannerCard key={i} banner={b} />
            ))}
          </div>
        </div>

        {/* Categories */}
        <div style={{ marginBottom: 18 }}>
          <SectionRow title="Browse Categories" />
          <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCategory("")}
              style={{
                flexShrink: 0,
                height: 38,
                padding: "0 18px",
                borderRadius: 999,
                cursor: "pointer",
                fontFamily: "'Sora',sans-serif",
                fontSize: 13,
                fontWeight: 950,
                background: !selectedCategory ? DEEP : "#fff",
                color: !selectedCategory ? "#fff" : "#4A6B5A",
                boxShadow: !selectedCategory ? `0 6px 16px rgba(12,90,62,0.25)` : "0 2px 10px rgba(0,0,0,0.06)",
                border: !selectedCategory ? "none" : "1.5px solid rgba(12,90,62,0.12)",
              }}
            >
              All
            </motion.button>

            {CATEGORIES.map(({ label, emoji }) => {
              const active = selectedCategory === label;
              return (
                <motion.button
                  key={label}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setSelectedCategory(label);
                    setShowFallbackMeds(false);
                  }}
                  style={{
                    flexShrink: 0,
                    height: 38,
                    padding: "0 16px",
                    borderRadius: 999,
                    cursor: "pointer",
                    fontFamily: "'Sora',sans-serif",
                    fontSize: 13,
                    fontWeight: 850,
                    background: active ? DEEP : "#fff",
                    color: active ? "#fff" : "#4A6B5A",
                    boxShadow: active ? `0 6px 16px rgba(12,90,62,0.25)` : "0 2px 10px rgba(0,0,0,0.06)",
                    border: active ? "none" : "1.5px solid rgba(12,90,62,0.12)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>{emoji}</span>
                  <span>{label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Top medicines near you (clean, typical feed) */}
        <div style={{ marginBottom: 20 }}>
          <SectionRow
            title={selectedCategory ? `${selectedCategory} picks near you` : "Top medicines near you"}
            onSeeAll={() => navigate("/pharmacies-near-you")}
          />
          {topMedsNearYou.length > 0 ? (
            <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 6 }}>
              {topMedsNearYou.map((med, i) => (
                <MedCard key={med._id || i} med={med} canDeliver={canDeliver} onAdd={handleAddToCart} onOpen={(m) => setSelectedMed(m)} />
              ))}
            </div>
          ) : (
            <GlassCard style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 16, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                  🔍
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 1000, color: "#0B1F16" }}>No medicines loaded yet</div>
                  <div style={{ fontSize: 11.5, fontWeight: 750, color: "#94A3B8" }}>Try searching above or change category.</div>
                </div>
              </div>
            </GlassCard>
          )}
        </div>

        {/* Pharmacies nearby (separate) */}
        {pharmaciesNearby.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionRow title="Pharmacies Nearby" onSeeAll={() => navigate("/pharmacies-near-you")} />
            <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 6 }}>
              {pharmaciesNearby.slice(0, 10).map((ph) => (
                <PharmacyCard key={ph._id} ph={ph} onClick={() => navigate(`/medicines/${ph._id}`)} />
              ))}
            </div>
          </div>
        )}

        {/* Doctors */}
        <div style={{ marginBottom: 20 }}>
          <SectionRow title="Consult a Doctor" onSeeAll={() => navigate("/doctors")} />
          <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 6 }}>
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

        {/* Order again */}
        <div style={{ marginBottom: 32 }}>
          <SectionRow title="Order Again" badge="Quick Reorder" />
          <GlassCard style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 18, background: "linear-gradient(135deg,#E8F5EF,#C6E8D8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>
                📦
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 1000, color: "#0B1F16", marginBottom: 4 }}>Last Order</div>
                <div style={{ fontSize: 12, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 750 }}>
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
                    height: 40,
                    padding: "0 16px",
                    background: `linear-gradient(135deg,${DEEP},${MID})`,
                    color: "#fff",
                    borderRadius: 999,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "'Sora',sans-serif",
                    fontSize: 12,
                    fontWeight: 1000,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 6px 18px rgba(12,90,62,0.25)",
                  }}
                >
                  <RefreshCw style={{ width: 14, height: 14 }} />
                  Reorder
                </motion.button>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Floating upload Rx */}
      <motion.div className="fixed z-[1201] flex justify-end" style={{ bottom: dockBottom, left: 0, right: 0, padding: "0 18px", pointerEvents: "none" }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={() => setPrescriptionModalOpen(true)}
          style={{
            pointerEvents: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            height: 54,
            paddingLeft: 14,
            paddingRight: 22,
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            background: `linear-gradient(135deg,${DEEP},${MID})`,
            boxShadow: "0 14px 36px rgba(12,90,62,0.38)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,rgba(255,255,255,0.12),transparent 60%)", pointerEvents: "none" }} />
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.15)" }}>
            <UploadCloud style={{ width: 17, height: 17, color: "#fff" }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 1000, color: "#fff", fontFamily: "'Sora',sans-serif", position: "relative", zIndex: 1 }}>
            Upload Prescription
          </span>
        </motion.button>
      </motion.div>

      {/* Modals */}
      <LocationModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onSelect={(addr) => {
          setCurrentAddress(addr);
          setLocationModalOpen(false);
        }}
      />
      <PrescriptionUploadModal open={prescriptionModalOpen} onClose={() => setPrescriptionModalOpen(false)} userCity={localStorage.getItem("city") || "Mumbai"} />
      <MedDetailDialog med={selectedMed} open={!!selectedMed} onClose={() => setSelectedMed(null)} onAddToCart={handleAddToCart} canDeliver={canDeliver} />
      <BottomNavBar />

      <style>{`
        @keyframes orbFloat { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(10px,-15px) scale(1.05)} 66%{transform:translate(-8px,10px) scale(0.95)} }
        @keyframes glowPulse { 0%,100%{box-shadow:0 0 10px rgba(0,255,178,0.28)} 50%{box-shadow:0 0 18px rgba(0,255,178,0.50)} }
        @keyframes hmSpin { to{transform:rotate(360deg)} }
        @keyframes micPulse { 0%,100%{opacity:0;transform:scale(1)} 50%{opacity:1;transform:scale(1.35)} }
      `}</style>
    </div>
  );
}