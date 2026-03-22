// ============================================================
//  Home.js — GoDavaii 2035 Premium Health OS
//  ✅ SAME core API/cart/search/order logic preserved
//  ✅ Visual language aligned with GoDavaii AI page
//  ✅ Softer premium background + frosted header/cards
//  ✅ Less cartoonish, less rainbow, more medical-luxury
//  ✅ Added Daily Care strip: Step / Water / Medicine Reminder
//  ✅ Kept product-first medicine feed and trust messaging
//  ✅ Integrated Doctor Consultations section into NEW layout
//  ✅ Shows LIVE badge, Join button, Prescription link, pending indicator
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
  ShieldCheck,
  Brain,
  Shield,
  Pill,
  FlaskConical,
  Stethoscope,
  FolderHeart,
  Droplets,
  Footprints,
  BellRing,
  Activity,
  ShoppingCart,
  FileText,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import DoctorPrescriptionViewDialog from "./DoctorPrescriptionViewDialog";
import { getDoctorPrescriptionCartSummary } from "../lib/doctorPrescriptionCart";
import { getUserAuthHeaders, getUserAuthToken } from "../lib/userAuth";
import { mergeConsultBookings, readStoredConsultBookings, sortConsultBookings, upsertStoredConsultBooking } from "../utils/consultBookings";

// ─── Constants ───────────────────────────────────────────────
const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const DEEP = "#0A5A3B";
const MID = "#0F7A53";
const ACCENT = "#18E2A1";
const BG_TOP = "#F4FBF8";
const BG_MID = "#EEF8F4";
const BG_BOT = "#F7FAFF";
const GLASS = "rgba(255,255,255,0.92)";
const BORDER = "rgba(12,90,62,0.08)";
const TEXT = "#10231A";
const SUB = "#6A7A73";

const CATEGORIES = [
  { label: "Fever" },
  { label: "Cold" },
  { label: "Diabetes" },
  { label: "Heart" },
  { label: "Antibiotic" },
  { label: "Ayurveda" },
  { label: "Pain Relief" },
  { label: "Cough" },
];

const ACTIVE_STATUSES = new Set([
  "pending",
  "placed",
  "quoted",
  "substitute_confirmation_pending",
  "price_confirmation_pending",
  "partial_confirmation",
  "pharmacy_confirmation_requested",
  "chemist_confirmed",
  "admin_review_required",
  "processing",
  "assigned",
  "accepted",
  "picked_up",
  "out_for_delivery",
]);

const TRENDING = ["Paracetamol", "Vitamin D3", "Pantoprazole", "Cetirizine", "Azithromycin", "Metformin"];

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
  if (typeof img === "string" && img.startsWith("/uploads/")) return `${API}${img}`;
  if (typeof img === "string" && img.startsWith("http")) return img;
  return null;
}

function statusLabel(s) {
  const m = {
    pending: "Pending",
    placed: "Order Placed",
    quoted: "Quoted",
    substitute_confirmation_pending: "Substitute Approval Needed",
    price_confirmation_pending: "Reviewing availability",
    partial_confirmation: "Reviewing availability",
    pharmacy_confirmation_requested: "Reviewing availability",
    chemist_confirmed: "Pharmacy confirmed",
    admin_review_required: "Reviewing availability",
    processing: "Processing",
    assigned: "Assigned",
    accepted: "Accepted",
    picked_up: "Picked Up",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
  };
  return m[s] || s;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getConsultDateLabel(consult) {
  if (consult?.dateLabel) return consult.dateLabel;
  if (!consult?.date) return "Scheduled";
  try {
    const dt = new Date(consult.date);
    if (Number.isNaN(dt.getTime())) return consult.date;
    return dt.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return consult.date;
  }
}

// ─── Atoms ───────────────────────────────────────────────────
function Glass({ children, style }) {
  return (
    <div
      style={{
        background: GLASS,
        border: `1px solid ${BORDER}`,
        borderRadius: 24,
        boxShadow: "0 16px 34px rgba(16,24,40,0.05)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Section({ title, badge, onSeeAll }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontFamily: "'Sora',sans-serif",
            fontSize: 16,
            fontWeight: 900,
            color: TEXT,
            letterSpacing: "-0.25px",
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
              background: "rgba(24,226,161,0.10)",
              padding: "3px 10px",
              borderRadius: 999,
              border: "1px solid rgba(24,226,161,0.16)",
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

function MedImage({ med, size = 62 }) {
  const src = getImageUrl(med?.img || med?.image || med?.imageUrl);
  const [failed, setFailed] = useState(!src);

  if (failed || !src) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 18,
          background: "linear-gradient(135deg,#EAF7F1,#D8F3E7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Pill style={{ width: size * 0.42, height: size * 0.42, color: DEEP }} />
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 18,
        overflow: "hidden",
        background: "#F5FBF7",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img
        src={src}
        alt={med?.brand || med?.name || ""}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </div>
  );
}

// ─── Medicine Card ───────────────────────────────────────────
function MedCard({ med, onAdd, onOpen, canDeliver }) {
  const price = med.price ?? med.mrp ?? "--";
  const origPrice = med.mrp && med.price && Number(med.price) < Number(med.mrp) ? med.mrp : null;
  const discount = origPrice ? Math.round(((origPrice - price) / origPrice) * 100) : null;
  const title = med.brand || med.name || "Medicine";
  const sub = med.company || med.composition || "";

  return (
    <motion.div
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -2 }}
      onClick={() => onOpen?.(med)}
      style={{ width: 206, flexShrink: 0, cursor: "pointer" }}
    >
      <Glass style={{ padding: 14, position: "relative", overflow: "hidden", minHeight: 150 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg,rgba(24,226,161,0.035),transparent 58%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <MedImage med={med} size={60} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "'Sora',sans-serif",
                fontSize: 12.5,
                fontWeight: 900,
                color: TEXT,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                lineHeight: 1.28,
                marginBottom: 4,
              }}
            >
              {title}
            </div>

            {sub ? (
              <div
                style={{
                  fontSize: 10,
                  color: "#90A19A",
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginBottom: 7,
                }}
              >
                {sub}
              </div>
            ) : (
              <div style={{ height: 17 }} />
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
              <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 1000, color: DEEP }}>
                ₹{price}
              </span>
              {origPrice && (
                <span
                  style={{
                    fontSize: 10.5,
                    color: "#C3D0CB",
                    textDecoration: "line-through",
                    fontWeight: 800,
                  }}
                >
                  ₹{origPrice}
                </span>
              )}
              {discount && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 900,
                    color: "#059669",
                    background: "#ECFDF5",
                    padding: "2px 6px",
                    borderRadius: 999,
                  }}
                >
                  {discount}% OFF
                </span>
              )}
            </div>

            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: "#6B9E88",
                marginBottom: 7,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Shield style={{ width: 9, height: 9 }} /> Fulfilled by GoDavaii
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  color: "#97A8A2",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Clock style={{ width: 10, height: 10 }} /> ≤30 min
              </span>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canDeliver) onAdd(med);
                }}
                disabled={!canDeliver}
                style={{
                  height: 29,
                  padding: "0 12px",
                  borderRadius: 999,
                  border: "none",
                  cursor: canDeliver ? "pointer" : "not-allowed",
                  background: canDeliver ? `linear-gradient(135deg,${DEEP},${MID})` : "#E2E8F0",
                  color: canDeliver ? "#fff" : "#94A3B8",
                  fontSize: 11,
                  fontWeight: 900,
                  fontFamily: "'Sora',sans-serif",
                  boxShadow: canDeliver ? "0 6px 16px rgba(10,90,59,0.16)" : "none",
                }}
              >
                + Add
              </motion.button>
            </div>
          </div>
        </div>
      </Glass>
    </motion.div>
  );
}

// ─── Active Order Bar ────────────────────────────────────────
function ActiveOrderBar({ order, onClick }) {
  const steps = [
    { key: "placed", label: "Placed" },
    { key: "processing", label: "Processing" },
    { key: "picked_up", label: "Packed" },
    { key: "out_for_delivery", label: "On Way" },
    { key: "delivered", label: "Done" },
  ];
  const statusOrder = ["placed", "quoted", "processing", "assigned", "accepted", "picked_up", "out_for_delivery", "delivered"];
  const ci = statusOrder.indexOf(order.status);

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
        background: "linear-gradient(135deg,#0A5A3B 0%,#0A4631 55%,#0F7A53 100%)",
        boxShadow: "0 16px 34px rgba(10,90,59,0.22)",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div style={{ padding: "13px 15px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 14,
              background: "rgba(255,255,255,0.13)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Activity style={{ width: 17, height: 17, color: "#C9FFEB" }} />
          </div>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 12.5, fontWeight: 1000, color: "#fff" }}>
              Live Order Tracking
            </div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.65)", marginTop: 1, fontWeight: 700 }}>
              {statusLabel(order.status)} · Tap to view
            </div>
          </div>
        </div>
        <div
          style={{
            background: ACCENT,
            color: DEEP,
            fontSize: 10.5,
            fontWeight: 1000,
            padding: "6px 12px",
            borderRadius: 999,
            fontFamily: "'Sora',sans-serif",
          }}
        >
          Track →
        </div>
      </div>

      <div style={{ padding: "2px 15px 13px" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {steps.map((step, i) => {
            const si = statusOrder.indexOf(step.key);
            const done = si <= ci;
            const active = step.key === order.status;
            return (
              <React.Fragment key={step.key}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: 1 }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: done ? ACCENT : "rgba(255,255,255,0.2)",
                      border: active ? `2px solid ${ACCENT}` : "none",
                      boxShadow: active ? "0 0 0 4px rgba(24,226,161,0.18)" : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 8,
                      color: done ? DEEP : "transparent",
                      fontWeight: 1000,
                    }}
                  >
                    {done ? "✓" : ""}
                  </div>
                  <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.55)", fontWeight: 800 }}>{step.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      background: done ? ACCENT : "rgba(255,255,255,0.15)",
                      borderRadius: 1,
                      marginBottom: 12,
                    }}
                  />
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
    <motion.div whileTap={{ scale: 0.985 }} onClick={onClick} style={{ width: 188, flexShrink: 0, cursor: "pointer" }}>
      <Glass style={{ padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              background: "linear-gradient(135deg,#EEF8F4,#DDF5EA)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Stethoscope style={{ width: 18, height: 18, color: DEEP }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 12.5, fontWeight: 1000, color: TEXT }}>
              {doctor.name}
            </div>
            <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 1, fontWeight: 800 }}>{doctor.spec}</div>
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10.5,
              fontWeight: 900,
              color: DEEP,
              background: "#EEF9F3",
              padding: "4px 10px",
              borderRadius: 999,
            }}
          >
            <Clock style={{ width: 10, height: 10 }} /> Slots today
          </span>
          <ChevronRight style={{ width: 14, height: 14, color: "#CBD5E1" }} />
        </div>
      </Glass>
    </motion.div>
  );
}

// ─── Lab Test Card ───────────────────────────────────────────
function LabTestCard({ test, onClick }) {
  return (
    <motion.div whileTap={{ scale: 0.985 }} onClick={onClick} style={{ width: 176, flexShrink: 0, cursor: "pointer" }}>
      <Glass style={{ padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              background: "linear-gradient(135deg,#EEF8F4,#DDF5EA)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <FlaskConical style={{ width: 18, height: 18, color: DEEP }} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: "'Sora',sans-serif",
                fontSize: 12,
                fontWeight: 900,
                color: TEXT,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {test.name}
            </div>
            <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 1, fontWeight: 700 }}>{test.sub}</div>
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 1000, color: DEEP }}>₹{test.price}</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: DEEP,
              background: "rgba(24,226,161,0.12)",
              padding: "4px 10px",
              borderRadius: 999,
            }}
          >
            Book
          </span>
        </div>
      </Glass>
    </motion.div>
  );
}

// ─── Daily Care Card ─────────────────────────────────────────
function DailyCareCard({ icon, title, value, helper, accent, onClick }) {
  const Icon = icon;

  const content = (
    <Glass style={{ padding: 14, minHeight: 132 }}>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 16,
          background: accent || "rgba(24,226,161,0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <Icon style={{ width: 18, height: 18, color: DEEP }} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 800, color: SUB, marginBottom: 4 }}>{title}</div>
      <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 1000, color: TEXT, marginBottom: 5 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#8A9A94", lineHeight: 1.45 }}>{helper}</div>
    </Glass>
  );

  if (!onClick) return content;

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -1 }}
      onClick={onClick}
      style={{
        width: "100%",
        display: "block",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {content}
    </motion.button>
  );
}

// ─── Cart Conflict Bottom Sheet ──────────────────────────────
// --- Med Detail Dialog ───────────────────────────────────────
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

        <div
          style={{
            margin: "0 20px",
            borderRadius: 16,
            overflow: "hidden",
            height: 200,
            position: "relative",
            background: "#F0F9F4",
          }}
        >
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
                    <Pill style={{ width: 64, height: 64, color: DEEP }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 26, fontWeight: 1000, color: DEEP }}>₹{price}</span>
            {origPrice && (
              <span style={{ fontSize: 14, color: "#CBD5E1", textDecoration: "line-through", fontWeight: 900 }}>₹{origPrice}</span>
            )}
            {discount && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: "#059669",
                  background: "#ECFDF5",
                  padding: "3px 10px",
                  borderRadius: 999,
                }}
              >
                {discount}% OFF
              </span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 12,
              padding: "8px 12px",
              background: "#F0FDF4",
              borderRadius: 12,
              border: "1px solid #BBF7D0",
            }}
          >
            <Shield style={{ width: 14, height: 14, color: "#059669" }} />
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "#065F46" }}>
              Fulfilled by GoDavaii · Nearby verified pharmacy
            </span>
          </div>

          {med.composition && (
            <div style={{ fontSize: 13, color: "#4A6B5A", marginBottom: 6, fontWeight: 700 }}>
              <strong>Composition:</strong> {med.composition}
            </div>
          )}

          {med.company && (
            <div style={{ fontSize: 13, color: "#4A6B5A", marginBottom: 10, fontWeight: 700 }}>
              <strong>Manufacturer:</strong> {med.company}
            </div>
          )}

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
              boxShadow: canDeliver ? "0 6px 18px rgba(10,90,59,0.22)" : "none",
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
//  HomeSearch — Portal dropdown
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
  const dropdownRef = useRef(null);
  const recognitionRef = useRef(null);
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
    const fn = () => updateAnchor();
    window.addEventListener("scroll", fn, true);
    window.addEventListener("resize", fn);
    return () => {
      window.removeEventListener("scroll", fn, true);
      window.removeEventListener("resize", fn);
    };
  }, [focused, updateAnchor]);

  useEffect(() => {
    if (!query.trim()) {
      setOptions([]);
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const city = (currentAddress?.city || "").trim();
        const r = await axios.get(`${API}/api/medicines/autocomplete`, {
          params: { q: query.trim(), city, limit: 10 },
          signal: ac.signal,
        });
        if (r.data?.length) {
          setOptions(r.data);
          setLoading(false);
          return;
        }
        const r2 = await axios.get(`${API}/api/search/search-autocomplete`, {
          params: { q: query.trim(), city, type: "all" },
          signal: ac.signal,
        });
        setOptions(r2.data || []);
      } catch (e) {
        if (!axios.isCancel(e)) setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 160);
    return () => {
      ac.abort();
      clearTimeout(t);
    };
  }, [query, currentAddress?.city]);

  useEffect(() => {
    const h = (e) => {
      const inInput = wrapRef.current?.contains(e.target);
      const inDropdown = dropdownRef.current?.contains(e.target);
      if (!inInput && !inDropdown) setFocused(false);
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("touchstart", h, { passive: true });
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("touchstart", h);
    };
  }, []);

  const navigateToMedicineSearch = useCallback(
    (term) => {
      const q = String(term || "").trim();
      if (!q) return;
      navigate(`/all-medicines?q=${encodeURIComponent(q)}`);
    },
    [navigate]
  );

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
      setTimeout(() => navigateToMedicineSearch(t), 250);
    };
    rec.onerror = () => setMicActive(false);
    rec.onend = () => setMicActive(false);
    rec.start();
  }, [micSupported, navigateToMedicineSearch]);

  const stopMic = useCallback(() => {
    recognitionRef.current?.stop();
    setMicActive(false);
  }, []);

  const handleSelect = (val) => {
    const v = typeof val === "string" ? val : val?.name || val?.label || val?.brand || "";
    if (!v) return;
    setQuery(v);
    setFocused(false);
    navigateToMedicineSearch(v);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && query.trim()) {
      setFocused(false);
      navigateToMedicineSearch(query.trim());
    }
    if (e.key === "Escape") setFocused(false);
  };

  const labels = options
    .map((o) => (typeof o === "string" ? o : o?.name || o?.label || o?.brand || ""))
    .filter((l) => l?.trim())
    .filter((l, i, a) => a.indexOf(l) === i)
    .slice(0, 8);

  const dropOpen = focused && (loading || labels.length > 0 || !query);

  const dropdown = (
    <AnimatePresence>
      {dropOpen && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.16 }}
          style={{
            position: "fixed",
            top: anchor.top,
            left: anchor.left,
            width: anchor.width,
            zIndex: 99999,
            borderRadius: 20,
            background: "rgba(255,255,255,0.98)",
            backdropFilter: "blur(20px)",
            border: `1.5px solid ${BORDER}`,
            boxShadow: "0 28px 70px rgba(0,0,0,0.16)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "10px 16px 6px", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            {query ? <Sparkles style={{ width: 11, height: 11, color: ACCENT }} /> : <TrendingUp style={{ width: 11, height: 11, color: "#94A3B8" }} />}
            <span style={{ fontSize: 10, fontWeight: 1000, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.7px" }}>
              {query ? "Suggestions" : "Trending"}
            </span>
          </div>

          {(query ? labels : TRENDING).map((label, i) => (
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
                borderBottom: i < (query ? labels : TRENDING).length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FBF9")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 12,
                  background: query ? "#E8F5EF" : "#F1F5F9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {query ? <Search style={{ width: 13, height: 13, color: DEEP }} /> : <TrendingUp style={{ width: 13, height: 13, color: "#94A3B8" }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: TEXT, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {label}
                </span>
              </div>
              <ChevronRight style={{ width: 13, height: 13, color: "#CBD5E1", flexShrink: 0 }} />
            </motion.button>
          ))}

          {query && (
            <div style={{ padding: "10px 12px 12px" }}>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setFocused(false);
                  navigateToMedicineSearch(query.trim());
                }}
                style={{
                  width: "100%",
                  height: 42,
                  borderRadius: 14,
                  border: "none",
                  background: `linear-gradient(135deg,${DEEP},${MID})`,
                  color: "#fff",
                  fontFamily: "'Sora',sans-serif",
                  fontSize: 13,
                  fontWeight: 1000,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  boxShadow: "0 6px 18px rgba(10,90,59,0.18)",
                }}
              >
                <Search style={{ width: 14, height: 14 }} /> Search "{query}"
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
            boxShadow: focused ? "0 0 0 3px rgba(24,226,161,0.16), 0 12px 28px rgba(16,24,40,0.08)" : "0 10px 28px rgba(16,24,40,0.06)",
            scale: focused ? 1.004 : 1,
          }}
          transition={{ duration: 0.2 }}
          style={{
            display: "flex",
            alignItems: "center",
            height: 54,
            borderRadius: 18,
            background: "rgba(255,255,255,0.97)",
            padding: "0 8px 0 14px",
            border: focused ? "1.5px solid rgba(24,226,161,0.35)" : `1.5px solid ${BORDER}`,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 13,
              flexShrink: 0,
              background: focused ? "rgba(24,226,161,0.12)" : "#F1F5F9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10,
            }}
          >
            {loading ? (
              <div
                style={{
                  width: 15,
                  height: 15,
                  border: "2.5px solid rgba(10,90,59,0.20)",
                  borderTopColor: DEEP,
                  borderRadius: "50%",
                  animation: "hmSpin 0.7s linear infinite",
                }}
              />
            ) : (
              <Search style={{ width: 15, height: 15, color: focused ? DEEP : "#94A3B8" }} />
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
            placeholder="Search medicines, doctors, tests..."
            style={{
              flex: 1,
              height: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 14.5,
              fontWeight: 800,
              color: TEXT,
              fontFamily: "'Plus Jakarta Sans',sans-serif",
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
                <X style={{ width: 12, height: 12, color: "#94A3B8" }} />
              </motion.button>
            )}
          </AnimatePresence>

          <div style={{ width: 1, height: 22, background: "rgba(0,0,0,0.08)", marginRight: 8, flexShrink: 0 }} />

          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={micActive ? stopMic : startMic}
            style={{
              width: 40,
              height: 40,
              borderRadius: 13,
              flexShrink: 0,
              background: micActive ? "linear-gradient(135deg,#DC2626,#EF4444)" : "rgba(24,226,161,0.12)",
              border: micActive ? "none" : "1px solid rgba(24,226,161,0.20)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: micSupported ? "pointer" : "not-allowed",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {micActive && <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.22)", animation: "micPulse 0.8s ease-in-out infinite" }} />}
            {micActive ? <MicOff style={{ width: 15, height: 15, color: "#fff", position: "relative", zIndex: 1 }} /> : <Mic style={{ width: 15, height: 15, color: DEEP }} />}
          </motion.button>
        </motion.div>
      </div>
      {createPortal(dropdown, document.body)}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
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
  const [myConsults, setMyConsults] = useState([]);
  const [prescriptionFeedback, setPrescriptionFeedback] = useState({ prescriptionId: "", message: "" });
  const [viewingDoctorPrescription, setViewingDoctorPrescription] = useState(null);

  const popupTimeout = useRef(null);
  const noMedicinesTimer = useRef(null);
  const prescriptionFeedbackTimer = useRef(null);

  const { user, token: authToken } = useAuth();
  const cartCtx = useCart();
  const { cart, addToCart } = cartCtx;

  const navigate = useNavigate();
  const { currentAddress, setCurrentAddress } = useLocation();

  const cartCount = cart?.length || 0;
  const dockBottom = `calc(${cartCount > 0 ? 144 : 72}px + env(safe-area-inset-bottom,0px) + 12px)`;

  // Profile completion redirect
  useEffect(() => {
    if (!user) return;
    const localDone = localStorage.getItem("profileCompleted") === "1";
    const missingRequired = !user.name || !user.email || !user.dob;
    if (!localDone && (!user.profileCompleted || missingRequired)) navigate("/profile?setup=1", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // Coords
  useEffect(() => {
    if (currentAddress?.lat && currentAddress?.lng) setUserCoords({ lat: currentAddress.lat, lng: currentAddress.lng });
    else if (navigator.geolocation) navigator.geolocation.getCurrentPosition((pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }), () => setUserCoords(null));
  }, [currentAddress]);

  // Delivery availability
  useEffect(() => {
    const lat = Number(currentAddress?.lat ?? userCoords?.lat);
    const lng = Number(currentAddress?.lng ?? userCoords?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    fetch(`${API}/api/delivery/active-partner-nearby?lat=${lat}&lng=${lng}`)
      .then((r) => r.json())
      .then((d) => setCanDeliver(!!d.activePartnerExists))
      .catch(() => setCanDeliver(false));
  }, [currentAddress, userCoords]);

  // Last order
  useEffect(() => {
    if (!user?._id && !user?.userId) return;
    const token = getUserAuthToken(authToken);
    const headers = token ? getUserAuthHeaders(token) : undefined;
    fetch(
      `${API}/api/allorders/myorders-userid/${user._id || user.userId}`,
      headers ? { headers } : undefined
    )
      .then((r) => r.json())
      .then((orders) => {
        if (Array.isArray(orders) && orders.length) setLastOrder(orders[0]);
      })
      .catch(() => {});
  }, [user, authToken]);

  // Active order
  useEffect(() => {
    async function getActive() {
      const token = getUserAuthToken(authToken);
      const headers = token ? getUserAuthHeaders(token) : undefined;
      const idFromLS = localStorage.getItem("activeOrderId");
      try {
        if (idFromLS) {
          const r = await fetch(
            `${API}/api/orders/${idFromLS}`,
            headers ? { headers } : undefined
          );
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
        const r = await fetch(
          `${API}/api/allorders/myorders-userid/${user._id || user.userId}`,
          headers ? { headers } : undefined
        );
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
  }, [user, authToken]);

  // My consults for home doctor section
  useEffect(() => {
    const token = getUserAuthToken(authToken);
    const headers = token ? getUserAuthHeaders(token) : undefined;
    let cancelled = false;

    async function loadHomeConsults() {
      const localBookings = readStoredConsultBookings();

      try {
        let serverBookings = [];
        if (token) {
          try {
            const response = await axios.get(`${API}/api/consults/my`, { headers });
            serverBookings = Array.isArray(response?.data?.consults) ? response.data.consults : [];
          } catch {
            serverBookings = [];
          }
        }

        let publicSyncedBookings = [];
        if (localBookings.length) {
          try {
            const syncResponse = await axios.post(
              `${API}/api/consults/lookup/batch`,
              {
                items: localBookings.map((item) => ({
                  bookingId: item.id || item.bookingId || "",
                  paymentRef: item.paymentRef || "",
                  doctorId: item.doctorId || "",
                  date: item.date || "",
                  slot: item.slot || "",
                  mode: item.mode || "",
                })),
              },
              headers ? { headers } : undefined
            );
            publicSyncedBookings = Array.isArray(syncResponse?.data?.consults) ? syncResponse.data.consults : [];
          } catch {
            publicSyncedBookings = [];
          }
        }

        const syncedById = new Map(
          publicSyncedBookings.map((item) => [String(item?.id || item?.bookingId || item?._id || ""), item])
        );
        const mergedServer = mergeConsultBookings(serverBookings, publicSyncedBookings);
        const merged = sortConsultBookings(
          mergeConsultBookings(mergedServer, localBookings).map((item) => {
            const key = String(item?.id || item?.bookingId || item?._id || "");
            const syncedItem = syncedById.get(key) || null;
            return {
              ...item,
              doctorPrescription: item?.doctorPrescription || syncedItem?.doctorPrescription || null,
              prescription: item?.prescription || syncedItem?.prescription || null,
              updatedAt: item?.updatedAt || syncedItem?.updatedAt || item?.createdAt || "",
            };
          })
        );

        merged.forEach((item) => {
          const bookingId = item?.id || item?.bookingId || item?._id;
          if (bookingId) {
            upsertStoredConsultBooking({
              ...item,
              id: bookingId,
              bookingId: item?.bookingId || bookingId,
            });
          }
        });

        if (!cancelled) setMyConsults(merged);
      } catch {
        if (!cancelled) setMyConsults(localBookings);
      }
    }

    loadHomeConsults();
    return () => {
      cancelled = true;
    };
  }, [authToken, user?._id, user?.userId]);

  // Storefront-first medicine feed (customer should not pick a pharmacy first).
  useEffect(() => {
    if (!userCoords) return;
    fetch(`${API}/api/medicines?onlyAvailable=1`)
      .then((r) => r.json())
      .then((meds) => {
        const list = Array.isArray(meds) ? meds : [];
        const storefrontId = "storefront_catalog";
        const storefrontBucket = [{ _id: storefrontId, active: true, name: "GoDavaii Storefront" }];
        setPharmaciesNearby(storefrontBucket);
        setMostOrderedByPharmacy({ [storefrontId]: list.slice(0, 60) });
        setAllMedsByPharmacy({ [storefrontId]: list.slice(0, 220) });
      })
      .catch(() => {});
  }, [userCoords]);

  // Fallback
  useEffect(() => {
    if (!selectedCategory) {
      setShowFallbackMeds(false);
      return;
    }
    const noneHave = pharmaciesNearby
      .slice(0, 6)
      .every((ph) => {
        const meds = allMedsByPharmacy[ph._id] || [];
        return !meds.some((med) => isMedicineInCategory(med, selectedCategory));
      });

    if (noneHave) noMedicinesTimer.current = setTimeout(() => setShowFallbackMeds(true), 500);
    else setShowFallbackMeds(false);

    return () => clearTimeout(noMedicinesTimer.current);
  }, [selectedCategory, pharmaciesNearby, allMedsByPharmacy]);

  useEffect(() => {
    const popupTimer = popupTimeout.current;
    const medicinesTimer = noMedicinesTimer.current;
    const feedbackTimer = prescriptionFeedbackTimer.current;

    return () => {
      clearTimeout(popupTimer);
      clearTimeout(medicinesTimer);
      clearTimeout(feedbackTimer);
    };
  }, []);

  const handleAddToCart = (med) => {
    if (!canDeliver) {
      alert("Sorry, delivery isn't available at your location right now.");
      return;
    }
    addToCart(med);
  };

  const showPrescriptionFeedback = useCallback((prescriptionId, message) => {
    setPrescriptionFeedback({ prescriptionId, message });
    clearTimeout(prescriptionFeedbackTimer.current);
    prescriptionFeedbackTimer.current = setTimeout(() => {
      setPrescriptionFeedback({ prescriptionId: "", message: "" });
    }, 2400);
  }, []);

  const handleAddDoctorPrescription = useCallback(
    (doctorPrescription) => {
      const summary = getDoctorPrescriptionCartSummary(doctorPrescription);
      if (!summary.addableProducts.length) {
        showPrescriptionFeedback(summary.prescriptionId, "Mapped medicines abhi medicine page par available nahi hain.");
        return;
      }
      summary.addableProducts.forEach((product) => addToCart(product));
      showPrescriptionFeedback(
        summary.prescriptionId,
        `${summary.addableProducts.length} doctor-suggested medicines cart me add ho gayi.`
      );
    },
    [addToCart, showPrescriptionFeedback]
  );

  const openDoctorPrescriptionView = useCallback((doctorPrescription) => {
    if (!doctorPrescription) return;
    setViewingDoctorPrescription(doctorPrescription);
  }, []);

  const openDoctorPrescriptionMedicines = useCallback(
    (doctorPrescription) => {
      const summary = getDoctorPrescriptionCartSummary(doctorPrescription);
      if (!summary.prescriptionId) return;
      try {
        if (typeof window !== "undefined") {
          window.sessionStorage?.setItem(`doctorPrescription:${summary.prescriptionId}`, JSON.stringify(doctorPrescription));
        }
      } catch (_) {}
      navigate(`/all-medicines?prescriptionId=${summary.prescriptionId}`, {
        state: { doctorPrescription },
      });
    },
    [navigate]
  );

  const topMedsNearYou = useMemo(() => {
    const phs = pharmaciesNearby.slice(0, 6);
    const pickFrom = phs.flatMap((ph) => {
      const base = selectedCategory ? allMedsByPharmacy[ph._id] || [] : mostOrderedByPharmacy[ph._id] || [];
      let meds = selectedCategory ? base.filter((m) => isMedicineInCategory(m, selectedCategory)) : base;
      if (selectedCategory && meds.length === 0 && showFallbackMeds) meds = base.slice(0, 10);
      return meds.slice(0, 8);
    });
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

  const featuredDoctorPrescription = useMemo(() => {
    return myConsults
      .map((consult) => {
        const summary = getDoctorPrescriptionCartSummary(consult?.doctorPrescription);
        return {
          consult,
          summary,
          sortTime: new Date(summary.createdAt || consult?.updatedAt || consult?.createdAt || 0).getTime(),
        };
      })
      .filter((entry) => !!entry.summary.prescriptionId)
      .sort((a, b) => b.sortTime - a.sortTime)[0] || null;
  }, [myConsults]);

  const visibleConsults = useMemo(() => {
    const allowedStatuses = new Set(["confirmed", "accepted", "upcoming", "live_now", "completed"]);
    return myConsults
      .map((consult) => {
        const summary = getDoctorPrescriptionCartSummary(consult?.doctorPrescription);
        const hasDoctorPrescription = !!summary.prescriptionId;
        const hasUploadedPrescription = !!consult?.prescription?.fileUrl;
        const isLive = consult?.callState === "live" || consult?.status === "live_now";
        return {
          consult,
          hasDoctorPrescription,
          hasUploadedPrescription,
          isLive,
          sortTime: new Date(summary.createdAt || consult?.updatedAt || consult?.createdAt || 0).getTime(),
        };
      })
      .filter((entry) => allowedStatuses.has(entry.consult?.status) || entry.hasDoctorPrescription || entry.hasUploadedPrescription)
      .sort((a, b) => {
        if (Number(b.hasDoctorPrescription) !== Number(a.hasDoctorPrescription)) {
          return Number(b.hasDoctorPrescription) - Number(a.hasDoctorPrescription);
        }
        if (Number(b.isLive) !== Number(a.isLive)) {
          return Number(b.isLive) - Number(a.isLive);
        }
        return b.sortTime - a.sortTime;
      })
      .slice(0, 3)
      .map((entry) => {
        // Don't show prescription card inside consultation if it's already the featured prescription at the top
        const featuredRxId = featuredDoctorPrescription?.summary?.prescriptionId || "";
        const thisRxId = getDoctorPrescriptionCartSummary(entry.consult?.doctorPrescription)?.prescriptionId || "";
        const isAlreadyFeatured = featuredRxId && thisRxId && featuredRxId === thisRxId;
        return { ...entry.consult, _showPrescription: entry.hasDoctorPrescription && !isAlreadyFeatured };
      });
  }, [myConsults, featuredDoctorPrescription]);

  const featuredDoctorPrescriptionConsult = featuredDoctorPrescription?.consult || null;
  const featuredDoctorPrescriptionSummary = featuredDoctorPrescription?.summary || null;
  const viewedDoctorPrescription = viewingDoctorPrescription;
  const isDoctorPrescriptionDialogOpen = !!viewingDoctorPrescription;
  const DoctorPrescriptionDialogComponent = DoctorPrescriptionViewDialog;

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
        background: `linear-gradient(180deg,${BG_TOP} 0%,${BG_MID} 48%,${BG_BOT} 100%)`,
        paddingBottom: 120,
        position: "relative",
        overflowX: "hidden",
        fontFamily: "'Plus Jakarta Sans',sans-serif",
      }}
    >
      {/* Ambient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at top right, rgba(24,226,161,0.08), transparent 26%), radial-gradient(circle at bottom left, rgba(15,122,83,0.05), transparent 30%)",
        }}
      />

      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          padding: "14px 18px 16px",
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
          background: "linear-gradient(180deg, rgba(244,251,248,0.94), rgba(244,251,248,0.82))",
          borderBottom: "1px solid rgba(12,90,62,0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setLocationModalOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: GLASS,
              border: `1px solid ${BORDER}`,
              borderRadius: 18,
              padding: "10px 13px",
              cursor: "pointer",
              flex: 1,
              minWidth: 0,
              boxShadow: "0 12px 28px rgba(16,24,40,0.04)",
            }}
          >
            <div
              style={{
                position: "relative",
                width: 34,
                height: 34,
                borderRadius: 14,
                background: "rgba(24,226,161,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <MapPin style={{ width: 15, height: 15, color: DEEP }} />
              <div
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: ACCENT,
                  border: "1.5px solid #fff",
                  animation: "glowPulse 2s ease-in-out infinite",
                }}
              />
            </div>

            <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: "#83A797", textTransform: "uppercase", letterSpacing: "0.9px", marginBottom: 1 }}>
                Delivering to
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: TEXT,
                  fontFamily: "'Sora',sans-serif",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {locationText}
              </div>
            </div>

            <ChevronDown style={{ width: 14, height: 14, color: "#9BA8A3", flexShrink: 0 }} />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate("/profile")}
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              background: GLASS,
              border: `1px solid ${BORDER}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              boxShadow: "0 12px 28px rgba(16,24,40,0.04)",
            }}
          >
            <User style={{ width: 18, height: 18, color: TEXT }} />
          </motion.button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 21, fontWeight: 1000, color: TEXT, lineHeight: 1.18, marginBottom: 5 }}>
            {getGreeting()}, {userName}
          </div>
          <div style={{ fontSize: 12, color: SUB, fontWeight: 700 }}>Your personal health OS</div>
        </div>

        <HomeSearch currentAddress={currentAddress} navigate={navigate} />

        <div style={{ display: "flex", gap: 8, marginTop: 12, overflowX: "auto", scrollbarWidth: "none" }}>
          {[
            { icon: <ShieldCheck style={{ width: 13, height: 13, color: DEEP }} />, text: "Verified" },
            { icon: <Clock style={{ width: 13, height: 13, color: DEEP }} />, text: "30 min" },
            { icon: <Brain style={{ width: 13, height: 13, color: DEEP }} />, text: "AI Health" },
          ].map((b, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: GLASS,
                border: `1px solid ${BORDER}`,
                borderRadius: 999,
                padding: "8px 11px",
                flexShrink: 0,
              }}
            >
              {b.icon}
              <span style={{ fontSize: 10.5, fontWeight: 900, color: TEXT, lineHeight: 1.1 }}>{b.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "18px 18px 0", position: "relative", zIndex: 1 }}>
        <AnimatePresence>
          {!canDeliver && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                background: "#FFF8F6",
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
              <span style={{ fontSize: 13, fontWeight: 850, color: "#991B1B" }}>No delivery partner nearby. Check back soon.</span>
            </motion.div>
          )}
        </AnimatePresence>

        {featuredDoctorPrescriptionConsult && featuredDoctorPrescriptionSummary && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 18 }}>
            <Glass style={{ padding: 16, border: "1px solid #BBF7D0", background: "linear-gradient(135deg,#F0FDF4,#ECFDF5)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 16,
                    background: "#DCFCE7",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    color: "#15803D",
                    fontSize: 15,
                    fontWeight: 1000,
                    fontFamily: "'Sora',sans-serif",
                  }}
                >
                  Rx
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 1000,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: "#166534",
                          background: "#DCFCE7",
                          borderRadius: 999,
                          padding: "4px 8px",
                        }}
                      >
                        Latest Prescription
                      </span>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: "#4B7A62" }}>
                        {featuredDoctorPrescriptionConsult.doctorName || "Doctor"} sent this to your home
                      </span>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      onClick={() => openDoctorPrescriptionView(featuredDoctorPrescriptionConsult.doctorPrescription)}
                      aria-label="View doctor prescription"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        border: "1px solid #BBF7D0",
                        background: "#FFFFFF",
                        color: "#166534",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                        flexShrink: 0,
                        boxShadow: "0 6px 16px rgba(15,23,42,0.05)",
                      }}
                    >
                      <FileText style={{ width: 15, height: 15 }} />
                    </motion.button>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 15, fontWeight: 1000, color: "#14532D", fontFamily: "'Sora',sans-serif" }}>
                    Doctor provided your prescription
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, fontWeight: 800, color: "#4B7A62" }}>
                    {featuredDoctorPrescriptionSummary.medicineCount} medicines suggested
                    {featuredDoctorPrescriptionSummary.addableCount > 0
                      ? ` • ${featuredDoctorPrescriptionSummary.addableCount} available to add in one tap`
                      : " • Review availability on medicine page"}
                  </div>
                  {featuredDoctorPrescriptionSummary.diagnosis ? (
                    <div style={{ marginTop: 6, fontSize: 10.5, fontWeight: 800, color: "#335B4B" }}>
                      Diagnosis: {featuredDoctorPrescriptionSummary.diagnosis}
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                {featuredDoctorPrescriptionSummary.addableCount > 0 && (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleAddDoctorPrescription(featuredDoctorPrescriptionConsult.doctorPrescription)}
                    style={{
                      height: 38,
                      padding: "0 14px",
                      borderRadius: 999,
                      border: "none",
                      background: "linear-gradient(135deg,#059669,#10B981)",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 900,
                      fontFamily: "'Sora',sans-serif",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                    }}
                  >
                    <ShoppingCart style={{ width: 14, height: 14 }} />
                    Add all available to cart
                  </motion.button>
                )}

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => openDoctorPrescriptionMedicines(featuredDoctorPrescriptionConsult?.doctorPrescription)}
                  style={{
                    height: 38,
                    padding: "0 14px",
                    borderRadius: 999,
                    border: "1px solid #86EFAC",
                    background: "#fff",
                    color: "#166534",
                    fontSize: 11,
                    fontWeight: 900,
                    fontFamily: "'Sora',sans-serif",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  Medicines Page
                  <ChevronRight style={{ width: 14, height: 14 }} />
                </motion.button>
              </div>

              {prescriptionFeedback.prescriptionId === featuredDoctorPrescriptionSummary.prescriptionId && prescriptionFeedback.message ? (
                <div style={{ marginTop: 10, fontSize: 10.5, fontWeight: 800, color: "#166534" }}>
                  {prescriptionFeedback.message}
                </div>
              ) : null}
            </Glass>
          </motion.div>
        )}

        {/* Primary actions */}
        <div style={{ marginBottom: 20 }}>
          <Section title="Primary Care" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[
              { label: "Medicines", icon: Pill, onClick: () => navigate("/all-medicines") },
              { label: "Lab Tests", icon: FlaskConical, onClick: () => navigate("/lab-tests") },
              { label: "Doctors", icon: Stethoscope, onClick: () => navigate("/doctors") },
              { label: "GoDavaii AI", icon: Brain, onClick: () => navigate("/ai") },
              { label: "Health Vault", icon: FolderHeart, onClick: () => navigate("/health") },
              { label: "Upload Rx", icon: UploadCloud, onClick: () => setPrescriptionModalOpen(true) },
            ].map((act) => {
              const Icon = act.icon;
              return (
                <motion.button
                  key={act.label}
                  whileTap={{ scale: 0.96 }}
                  whileHover={{ y: -1 }}
                  onClick={act.onClick}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    textAlign: "left",
                  }}
                >
                  <Glass style={{ padding: 14, minHeight: 110 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 16,
                        background: "rgba(24,226,161,0.10)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 10,
                      }}
                    >
                      <Icon style={{ width: 18, height: 18, color: DEEP }} />
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 900, color: TEXT, fontFamily: "'Sora',sans-serif", lineHeight: 1.25 }}>
                      {act.label}
                    </div>
                  </Glass>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Daily care */}
        <div style={{ marginBottom: 20 }}>
          <Section title="Daily Care" badge="Phase 1" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            <DailyCareCard
              icon={Footprints}
              title="Step Tracker"
              value="Start walk"
              helper="Live route, steps, calories, pace."
              onClick={() => navigate("/step-tracker")}
            />
            <DailyCareCard
              icon={Droplets}
              title="Water Tracker"
              value="5 / 8 glasses"
              helper="Stay hydrated through the day."
            />
            <DailyCareCard
              icon={BellRing}
              title="Medicine Reminder"
              value="2 reminders"
              helper="Morning and evening medicines."
            />
          </div>
        </div>

        <AnimatePresence>
          {activeOrder && (
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} style={{ marginBottom: 18 }}>
              <ActiveOrderBar order={activeOrder} onClick={() => navigate(`/order-tracking/${activeOrder._id}`)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Doctor Consultations */}
        {visibleConsults.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <Section title="Doctor Consultations" badge="LIVE" onSeeAll={() => navigate("/doctors")} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visibleConsults.map((c) => {
                const isLive = c.callState === "live" || c.status === "live_now";
                const canJoin =
                  ["confirmed", "accepted", "live_now"].includes(c.status) &&
                  c.paymentStatus === "paid" &&
                  c.mode !== "inperson";
                const hasPrescription = !!c?.prescription?.fileUrl;
                const doctorRxSummary = getDoctorPrescriptionCartSummary(c?.doctorPrescription);
                const hasDoctorPrescription = !!c._showPrescription && !!doctorRxSummary.prescriptionId;
                const dateLabel = getConsultDateLabel(c);

                return (
                  <Glass key={c.id || c._id} style={{ padding: 14, overflow: "hidden", position: "relative" }}>
                    {isLive && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 3,
                          background: "linear-gradient(90deg,#10B981,#34D399,#10B981)",
                          backgroundSize: "200% 100%",
                          animation: "hmLiveBar 1.5s linear infinite",
                        }}
                      />
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 16,
                          background: "linear-gradient(135deg,#EEF8F4,#DDF5EA)",
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Stethoscope style={{ width: 18, height: 18, color: DEEP }} />
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13.5, fontWeight: 1000, color: TEXT }}>
                          {c.doctorName}
                        </div>
                        <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>
                          {c.specialty} · {dateLabel} · {c.slot}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        {isLive && (
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: "#10B981",
                              animation: "glowPulse 1.5s ease-in-out infinite",
                            }}
                          />
                        )}
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            color: isLive ? "#065F46" : c.status === "completed" ? "#065F46" : "#92400E",
                            background: isLive ? "#D1FAE5" : c.status === "completed" ? "#ECFDF5" : "#FEF3C7",
                            padding: "4px 10px",
                            borderRadius: 999,
                            border: `1px solid ${isLive ? "#A7F3D0" : c.status === "completed" ? "#A7F3D0" : "#FDE68A"}`,
                          }}
                        >
                          {isLive ? "LIVE" : c.status === "completed" ? "Done" : "Upcoming"}
                        </span>
                      </div>
                    </div>

                    {c.mode === "inperson" && (
                      <div
                        style={{
                          marginBottom: 10,
                          fontSize: 10.8,
                          fontWeight: 800,
                          color: "#0F172A",
                          background: "#F8FAFC",
                          borderRadius: 12,
                          padding: "8px 10px",
                          border: "1px solid #E2E8F0",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <MapPin style={{ width: 12, height: 12 }} />
                        <span>
                          {c?.clinicLocation?.locality || c?.clinicLocation?.fullAddress || "Clinic address unavailable"}
                        </span>
                        {c?.clinicLocation?.exactUnlocked && c?.clinicLocation?.coordinates?.lat ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${c.clinicLocation.coordinates.lat},${c.clinicLocation.coordinates.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: DEEP,
                              fontWeight: 900,
                              fontSize: 10.5,
                              textDecoration: "none",
                              marginLeft: "auto",
                            }}
                          >
                            Maps →
                          </a>
                        ) : null}
                      </div>
                    )}

                    {hasDoctorPrescription && (
                      <div
                        style={{
                          background: "linear-gradient(135deg,#F0FDF4,#ECFDF5)",
                          border: "1px solid #BBF7D0",
                          borderRadius: 12,
                          padding: "10px 12px",
                          marginBottom: 10,
                        }}
                      >
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 10,
                              background: "#DCFCE7",
                              display: "grid",
                              placeItems: "center",
                              flexShrink: 0,
                              color: "#15803D",
                              fontSize: 12,
                              fontWeight: 900,
                            }}
                          >
                            Rx
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11.5, fontWeight: 900, color: "#166534" }}>
                              Doctor provided your prescription
                            </div>
                            <div style={{ fontSize: 10, color: "#4B7A62", fontWeight: 700, marginTop: 2 }}>
                              {doctorRxSummary.medicineCount} medicines ·{" "}
                              {doctorRxSummary.addableCount > 0
                                ? `${doctorRxSummary.addableCount} available to add instantly`
                                : "Open medicine page to review availability"}
                            </div>
                            {doctorRxSummary.diagnosis ? (
                              <div style={{ fontSize: 10, color: "#335B4B", fontWeight: 700, marginTop: 5 }}>
                                Diagnosis: {doctorRxSummary.diagnosis}
                              </div>
                            ) : null}
                            {doctorRxSummary.unavailableCount > 0 ? (
                              <div style={{ fontSize: 9.75, color: "#4B7A62", fontWeight: 700, marginTop: 4 }}>
                                {doctorRxSummary.unavailableCount} medicines abhi unavailable hain, baaki one tap se add ho sakti hain.
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                          {doctorRxSummary.addableCount > 0 && (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleAddDoctorPrescription(c.doctorPrescription)}
                              style={{
                                height: 34,
                                padding: "0 12px",
                                borderRadius: 999,
                                border: "none",
                                background: "linear-gradient(135deg,#059669,#10B981)",
                                color: "#fff",
                                fontSize: 10.5,
                                fontWeight: 900,
                                fontFamily: "'Sora',sans-serif",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                              }}
                            >
                              <ShoppingCart style={{ width: 13, height: 13 }} />
                              Add {doctorRxSummary.addableCount} to cart
                            </motion.button>
                          )}

                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => openDoctorPrescriptionView(c.doctorPrescription)}
                            style={{
                              height: 34,
                              padding: "0 12px",
                              borderRadius: 999,
                              border: "1px solid #BBF7D0",
                              background: "#fff",
                              color: "#166534",
                              fontSize: 10.5,
                              fontWeight: 900,
                              fontFamily: "'Sora',sans-serif",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                            }}
                          >
                            <FileText style={{ width: 13, height: 13 }} />
                            View Rx
                          </motion.button>

                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => openDoctorPrescriptionMedicines(c.doctorPrescription)}
                            style={{
                              height: 34,
                              padding: "0 12px",
                              borderRadius: 999,
                              border: "1px solid #86EFAC",
                              background: "#fff",
                              color: "#166534",
                              fontSize: 10.5,
                              fontWeight: 900,
                              fontFamily: "'Sora',sans-serif",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            Medicine Page
                          </motion.button>
                        </div>

                        {prescriptionFeedback.prescriptionId === doctorRxSummary.prescriptionId && prescriptionFeedback.message ? (
                          <div style={{ marginTop: 8, fontSize: 10.5, fontWeight: 800, color: "#166534" }}>
                            {prescriptionFeedback.message}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {hasPrescription && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          background: "#F0FDF4",
                          border: "1px solid #BBF7D0",
                          borderRadius: 12,
                          padding: "9px 12px",
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 10,
                            background: "#DCFCE7",
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                            color: "#15803D",
                            fontSize: 14,
                            fontWeight: 900,
                          }}
                        >
                          📋
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 900, color: "#166534" }}>Prescription Available</div>
                          <div style={{ fontSize: 10, color: "#4B7A62", fontWeight: 700 }}>Uploaded by doctor</div>
                        </div>

                        <a
                          href={c.prescription.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            height: 32,
                            padding: "0 12px",
                            borderRadius: 999,
                            background: "linear-gradient(135deg,#15803D,#22C55E)",
                            color: "#fff",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            textDecoration: "none",
                            fontSize: 10.5,
                            fontWeight: 900,
                            fontFamily: "'Sora',sans-serif",
                            flexShrink: 0,
                          }}
                        >
                          View
                        </a>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8 }}>
                      {canJoin && (
                        <>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              const roomId = c.consultRoomId || `consult_${(c.id || c._id || "").toString().slice(-8)}`;
                              window.open(`https://meet.jit.si/${roomId}`, "_blank");
                            }}
                            style={{
                              flex: 1,
                              height: 38,
                              border: "none",
                              borderRadius: 12,
                              background: isLive ? "linear-gradient(135deg,#059669,#10B981)" : `linear-gradient(135deg,${DEEP},${MID})`,
                              color: "#fff",
                              fontFamily: "'Sora',sans-serif",
                              fontWeight: 900,
                              fontSize: 11.5,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              boxShadow: "0 6px 18px rgba(12,90,62,0.2)",
                            }}
                          >
                            📹 {isLive ? "Join Now" : "Join Consultation"}
                          </motion.button>

                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              const roomId = c.consultRoomId || `consult_${(c.id || c._id || "").toString().slice(-8)}`;
                              window.open(
                                `https://meet.jit.si/${roomId}#config.startWithVideoMuted=true&config.startWithAudioMuted=true`,
                                "_blank"
                              );
                            }}
                            style={{
                              width: 42,
                              height: 38,
                              borderRadius: 12,
                              border: "1px solid #E2E8F0",
                              background: "#fff",
                              cursor: "pointer",
                              display: "grid",
                              placeItems: "center",
                              fontSize: 16,
                            }}
                            title="Open chat room"
                          >
                            💬
                          </motion.button>
                        </>
                      )}

                      {!canJoin && !hasPrescription && !hasDoctorPrescription && c.status === "completed" && (
                        <div
                          style={{
                            flex: 1,
                            height: 38,
                            borderRadius: 12,
                            background: "#FFFBEB",
                            border: "1px solid #FDE68A",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 800,
                            color: "#92400E",
                          }}
                        >
                          ⏳ Prescription pending
                        </div>
                      )}
                    </div>
                  </Glass>
                );
              })}

              {/* View All Prescriptions link */}
              {myConsults.some((c) => !!getDoctorPrescriptionCartSummary(c?.doctorPrescription)?.prescriptionId) && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate("/health", { state: { openTab: "prescriptions" } })}
                  style={{
                    width: "100%",
                    marginTop: 6,
                    padding: "10px 16px",
                    borderRadius: 14,
                    border: "1px solid #BBF7D0",
                    background: "linear-gradient(135deg,#F0FDF4,#ECFDF5)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 900,
                    fontFamily: "'Sora',sans-serif",
                    color: "#166534",
                  }}
                >
                  <FolderHeart style={{ width: 14, height: 14 }} />
                  View All Prescriptions in Health Vault
                  <ChevronRight style={{ width: 14, height: 14 }} />
                </motion.button>
              )}
            </div>
          </div>
        )}

        {/* AI card */}
        <div style={{ marginBottom: 20 }}>
          <motion.button
            whileTap={{ scale: 0.985 }}
            onClick={() => navigate("/ai")}
            style={{
              width: "100%",
              borderRadius: 24,
              overflow: "hidden",
              background: "linear-gradient(135deg,#0A5A3B 0%,#0A4631 55%,#0F7A53 100%)",
              boxShadow: "0 18px 34px rgba(10,90,59,0.18)",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              padding: "16px 18px",
              position: "relative",
            }}
          >
            <div style={{ position: "absolute", right: -18, top: -18, width: 120, height: 120, borderRadius: "50%", background: "rgba(24,226,161,0.10)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 18,
                  background: "rgba(24,226,161,0.14)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Brain style={{ width: 22, height: 22, color: ACCENT }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14.5, fontWeight: 1000, color: "#fff", marginBottom: 3 }}>
                  Ask GoDavaii AI
                </div>
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.68)", fontWeight: 700 }}>
                  Symptoms, medicines, lab reports, health guidance
                </div>
              </div>
              <ChevronRight style={{ width: 18, height: 18, color: "rgba(255,255,255,0.45)" }} />
            </div>
          </motion.button>
        </div>

        {/* Categories */}
        <div style={{ marginBottom: 18 }}>
          <Section title="Browse Categories" />
          <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCategory("")}
              style={{
                flexShrink: 0,
                height: 36,
                padding: "0 16px",
                borderRadius: 999,
                cursor: "pointer",
                fontFamily: "'Sora',sans-serif",
                fontSize: 12.5,
                fontWeight: 900,
                background: !selectedCategory ? DEEP : "#fff",
                color: !selectedCategory ? "#fff" : "#4A6B5A",
                boxShadow: !selectedCategory ? "0 8px 20px rgba(10,90,59,0.16)" : "0 2px 10px rgba(0,0,0,0.04)",
                border: !selectedCategory ? "none" : `1.5px solid ${BORDER}`,
              }}
            >
              All
            </motion.button>

            {CATEGORIES.map(({ label }) => {
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
                    height: 36,
                    padding: "0 14px",
                    borderRadius: 999,
                    cursor: "pointer",
                    fontFamily: "'Sora',sans-serif",
                    fontSize: 12.5,
                    fontWeight: 850,
                    background: active ? DEEP : "#fff",
                    color: active ? "#fff" : "#4A6B5A",
                    boxShadow: active ? "0 8px 20px rgba(10,90,59,0.16)" : "0 2px 10px rgba(0,0,0,0.04)",
                    border: active ? "none" : `1.5px solid ${BORDER}`,
                  }}
                >
                  {label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Medicines */}
        <div style={{ marginBottom: 20 }}>
          <Section title={selectedCategory ? `${selectedCategory} picks near you` : "Top Medicines Near You"} onSeeAll={() => navigate("/all-medicines")} />
          {topMedsNearYou.length > 0 ? (
            <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 6 }}>
              {topMedsNearYou.map((med, i) => (
                <MedCard key={med._id || i} med={med} canDeliver={canDeliver} onAdd={handleAddToCart} onOpen={(m) => setSelectedMed(m)} />
              ))}
            </div>
          ) : (
            <Glass style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 16,
                    background: "#F1F5F9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Search style={{ width: 17, height: 17, color: "#7A8B85" }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 1000, color: TEXT }}>No medicines loaded yet</div>
                  <div style={{ fontSize: 11.5, fontWeight: 750, color: "#94A3B8" }}>Try searching above or change category.</div>
                </div>
              </div>
            </Glass>
          )}
        </div>

        {/* Doctors */}
        <div style={{ marginBottom: 20 }}>
          <Section title="Consult a Doctor" onSeeAll={() => navigate("/doctors")} />
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

        {/* Lab tests */}
        <div style={{ marginBottom: 20 }}>
          <Section title="Popular Lab Tests" onSeeAll={() => navigate("/lab-tests")} />
          <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 6 }}>
            {[
              { name: "Complete Blood Count", sub: "CBC · 12hr report", price: 299 },
              { name: "Thyroid Profile", sub: "T3, T4, TSH", price: 399 },
              { name: "HbA1c", sub: "Diabetes monitor", price: 349 },
              { name: "Lipid Profile", sub: "Cholesterol check", price: 449 },
              { name: "Vitamin D", sub: "25-OH Vitamin D", price: 599 },
            ].map((t, i) => (
              <LabTestCard key={i} test={t} onClick={() => navigate("/lab-tests")} />
            ))}
          </div>
        </div>

        {/* Order again */}
        <div style={{ marginBottom: 32 }}>
          <Section title="Order Again" badge="Quick Reorder" />
          <Glass style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 18,
                  background: "linear-gradient(135deg,#EAF7F1,#D8F3E7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <RefreshCw style={{ width: 20, height: 20, color: DEEP }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13.5, fontWeight: 1000, color: TEXT, marginBottom: 3 }}>
                  Last Order
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "#94A3B8",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: 750,
                  }}
                >
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
                    height: 38,
                    padding: "0 14px",
                    background: `linear-gradient(135deg,${DEEP},${MID})`,
                    color: "#fff",
                    borderRadius: 999,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "'Sora',sans-serif",
                    fontSize: 11.5,
                    fontWeight: 1000,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    boxShadow: "0 6px 18px rgba(10,90,59,0.16)",
                  }}
                >
                  <RefreshCw style={{ width: 13, height: 13 }} /> Reorder
                </motion.button>
              )}
            </div>
          </Glass>
        </div>
      </div>

      {/* Floating Upload Rx */}
      <motion.div
        className="fixed z-[1201] flex justify-end"
        style={{ bottom: dockBottom, left: 0, right: 0, padding: "0 18px", pointerEvents: "none" }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={() => setPrescriptionModalOpen(true)}
          style={{
            pointerEvents: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            height: 52,
            paddingLeft: 12,
            paddingRight: 20,
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            background: `linear-gradient(135deg,${DEEP},${MID})`,
            boxShadow: "0 16px 30px rgba(10,90,59,0.22)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,rgba(255,255,255,0.12),transparent 60%)", pointerEvents: "none" }} />
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <UploadCloud style={{ width: 16, height: 16, color: "#fff" }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 1000, color: "#fff", fontFamily: "'Sora',sans-serif", position: "relative", zIndex: 1 }}>
            Upload Prescription
          </span>
        </motion.button>
      </motion.div>

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
      <MedDetailDialog med={selectedMed} open={!!selectedMed} onClose={() => setSelectedMed(null)} onAddToCart={handleAddToCart} canDeliver={canDeliver} />
      <DoctorPrescriptionDialogComponent
        prescription={viewedDoctorPrescription}
        open={isDoctorPrescriptionDialogOpen}
        onOpenChange={(open) => {
          if (!open) setViewingDoctorPrescription(null);
        }}
      />
      <BottomNavBar />

      <style>{`
        @keyframes glowPulse {
          0%,100%{box-shadow:0 0 10px rgba(24,226,161,0.22)}
          50%{box-shadow:0 0 18px rgba(24,226,161,0.38)}
        }
        @keyframes hmSpin { to{transform:rotate(360deg)} }
        @keyframes micPulse { 0%,100%{opacity:0;transform:scale(1)} 50%{opacity:1;transform:scale(1.35)} }
        @keyframes hmLiveBar { 0%{background-position:0% 0} 100%{background-position:200% 0} }
      `}</style>
    </div>
  );
}
