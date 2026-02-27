// src/components/MyOrdersPage.js — GoDavaii 2030 Modern UI
// ⚠️  ALL ORIGINAL LOGIC FULLY PRESERVED — zero logic changes, pure UI upgrade
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ReceiptText, X, ChevronRight, Clock, MapPin, Package, RefreshCw } from "lucide-react";
import QuoteReviewModal from "./QuoteReviewModal";
import PrescriptionUploadModal from "./PrescriptionUploadModal";
import { useCart } from "../context/CartContext";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP  = "#0C5A3E";
const MID   = "#0E7A4F";
const ACCENT = "#00D97E";

// ─── Rx helpers (UNCHANGED) ───────────────────────────────────
const toAbsUrl = (u = "") =>
  u.startsWith("/uploads/") ? `${API_BASE_URL}${u}` : u;

const isSameOriginUrl = (url) => {
  try {
    return new URL(url, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
};

function collectRxUrls(order) {
  const urls = [];
  if (Array.isArray(order.attachments) && order.attachments.length) {
    urls.push(...order.attachments.map(toAbsUrl));
  } else if (Array.isArray(order.prescriptionUrls) && order.prescriptionUrls.length) {
    urls.push(...order.prescriptionUrls.map(toAbsUrl));
  } else if (order.prescriptionUrl || order.prescription) {
    urls.push(toAbsUrl(order.prescriptionUrl || order.prescription));
  }
  return [...new Set(urls.filter(Boolean))];
}

async function openOrDownloadAllRx(order) {
  const urls = collectRxUrls(order);
  if (!urls.length) return;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (isSameOriginUrl(url)) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("fetch failed");
        const blob = await resp.blob();
        const a = document.createElement("a");
        const nameFromUrl = url.split("/").pop()?.split("?")[0] || `prescription_${i + 1}`;
        const extFromType = blob.type?.split("/").pop() || "";
        const filename = nameFromUrl.includes(".")
          ? nameFromUrl
          : `${nameFromUrl}${extFromType ? "." + extFromType : ""}`;
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
      } catch {
        const a = document.createElement("a");
        a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
        document.body.appendChild(a); a.click(); a.remove();
      }
    } else {
      const a = document.createElement("a");
      a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
      document.body.appendChild(a); a.click(); a.remove();
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 120));
    }
  }
}

// ─── Utils (ALL UNCHANGED) ────────────────────────────────────
function getHiddenRejectionIds() {
  try { return JSON.parse(localStorage.getItem("hiddenRejectionPopupOrderIds") || "[]").map(String); }
  catch { return []; }
}
function addHiddenRejectionId(orderId) {
  const ids = getHiddenRejectionIds();
  const idStr = String(orderId);
  if (!ids.includes(idStr)) {
    ids.push(idStr);
    localStorage.setItem("hiddenRejectionPopupOrderIds", JSON.stringify(ids));
  }
}
function formatOrderDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const opts = { day: "numeric", month: "long" };
  const date = d.toLocaleDateString("en-IN", opts);
  let hour = d.getHours();
  const min = d.getMinutes().toString().padStart(2, "0");
  const ampm = hour >= 12 ? "pm" : "am";
  hour = hour % 12 || 12;
  return `${date}, ${hour}:${min}${ampm}`;
}
function getTotalPrice(order) {
  if (order.tempQuote && Array.isArray(order.tempQuote.items) && order.tempQuote.items.length)
    return order.tempQuote.items.filter(i => i.available !== false).reduce((a, b) => a + ((b.price || 0) * (b.quantity || 1)), 0);
  if (order.tempQuote && typeof order.tempQuote.approxPrice === "number")
    return order.tempQuote.approxPrice;
  if (order.quote && Array.isArray(order.quote.items) && order.quote.items.length)
    return order.quote.items.filter(i => i.available !== false).reduce((a, b) => a + ((b.price || 0) * (b.quantity || 1)), 0);
  if (order.quote && typeof order.quote.price === "number")
    return order.quote.price;
  if (Array.isArray(order.quote) && order.quote.length)
    return order.quote.filter(i => i.available !== false).reduce((a, b) => a + ((b.price || 0) * (b.quantity || 1)), 0);
  if (Array.isArray(order.quotes) && order.quotes.length && typeof order.quotes[order.quotes.length - 1]?.price === "number")
    return order.quotes[order.quotes.length - 1].price;
  if (order.tempQuote && Array.isArray(order.tempQuote.items))
    return order.tempQuote.items.filter(i => i.available !== false).reduce((a, b) => a + ((b.price || 0) * (b.quantity || 1)), 0);
  return 0;
}
function getQuoteType(order) {
  let items = [];
  if (order.tempQuote && order.tempQuote.items && order.tempQuote.items.length) {
    items = order.tempQuote.items;
  } else if (order.quote && order.quote.items && order.quote.items.length) {
    items = order.quote.items;
  } else if (Array.isArray(order.quote) && order.quote.length) {
    items = order.quote;
  } else if (Array.isArray(order.quotes) && order.quotes.length && order.quotes[order.quotes.length - 1]?.items?.length) {
    items = order.quotes[order.quotes.length - 1].items;
  }
  if (!items.length) return "none";
  if (items.every(i => i.available !== false)) return "full";
  if (items.some(i => i.available === false)) return "partial";
  return "none";
}
function groupSplitOrders(orders) {
  const orderMap = {};
  const result = [];
  orders.forEach(order => { orderMap[order._id] = { ...order, splits: [] }; });
  orders.forEach(order => { if (order.parentOrder && orderMap[order.parentOrder]) { orderMap[order.parentOrder].splits.push(order); } });
  const used = new Set();
  orders.forEach(order => {
    if (order.parentOrder) {
      used.add(order._id);
    } else {
      result.push(orderMap[order._id]);
      orderMap[order._id].splits.forEach(split => used.add(split._id));
    }
  });
  orders.forEach(order => { if (!used.has(order._id)) result.push(order); });
  return result;
}
function getDisplayAddress(address) {
  if (!address) return "";
  return (
    address.formatted ||
    [address.addressLine, address.floor, address.area, address.city].filter(Boolean).join(", ") ||
    address.fullAddress ||
    JSON.stringify(address)
  );
}

// ─── UI Helpers ───────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:              { label: "Pending",        color: "#F59E0B", bg: "#FFFBEB", emoji: "🕐" },
  placed:               { label: "Placed",         color: "#3B82F6", bg: "#EFF6FF", emoji: "📋" },
  quoted:               { label: "Quote Ready",    color: "#8B5CF6", bg: "#F5F3FF", emoji: "💬" },
  pending_user_confirm: { label: "Action Needed",  color: "#EF4444", bg: "#FEF2F2", emoji: "⚠️" },
  processing:           { label: "Processing",     color: "#F59E0B", bg: "#FFFBEB", emoji: "⚙️" },
  assigned:             { label: "Assigned",       color: "#06B6D4", bg: "#ECFEFF", emoji: "🤝" },
  accepted:             { label: "Accepted",       color: "#10B981", bg: "#ECFDF5", emoji: "✅" },
  picked_up:            { label: "Picked Up",      color: "#10B981", bg: "#ECFDF5", emoji: "📦" },
  out_for_delivery:     { label: "On the Way",     color: "#F59E0B", bg: "#FFFBEB", emoji: "🛵" },
  delivered:            { label: "Delivered",      color: "#059669", bg: "#ECFDF5", emoji: "🎉" },
  cancelled:            { label: "Cancelled",      color: "#EF4444", bg: "#FEF2F2", emoji: "❌" },
  rejected:             { label: "Rejected",       color: "#EF4444", bg: "#FEF2F2", emoji: "❌" },
  confirmed:            { label: "Confirmed",      color: "#059669", bg: "#ECFDF5", emoji: "✅" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status || "Placed", color: "#64748B", bg: "#F1F5F9", emoji: "📄" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 700,
      color: cfg.color, background: cfg.bg,
      padding: "3px 10px", borderRadius: 100,
      border: `1px solid ${cfg.color}25`,
    }}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

// Modern "Pill" chip — replaces the old Tailwind Pill component
function InfoChip({ children, color = "green" }) {
  const colors = {
    green:  { bg: "#ECFDF5", text: "#059669", border: "#6EE7B7" },
    amber:  { bg: "#FFFBEB", text: "#B45309", border: "#FCD34D" },
    red:    { bg: "#FEF2F2", text: "#DC2626", border: "#FCA5A5" },
  };
  const c = colors[color] || colors.green;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      fontSize: 11, fontWeight: 700,
      color: c.text, background: c.bg,
      padding: "3px 10px", borderRadius: 100,
      border: `1px solid ${c.border}`,
      marginLeft: 6,
    }}>
      {children}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function MyOrdersPage() {
  const [orders, setOrders]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);

  const [snackbar, setSnackbar]           = useState({ open: false, message: "", severity: "success" });
  const [rejectDialogOpen, setRejectDialogOpen]   = useState(false);
  const [rejectReason, setRejectReason]           = useState("");
  const [rejectSubmitting, setRejectSubmitting]   = useState(false);
  const [pendingRejectOrderId, setPendingRejectOrderId] = useState(null);

  const prevOrdersRef = useRef([]);
  const { setCart, setSelectedPharmacy } = useCart();
  const navigate = useNavigate();

  const user   = JSON.parse(localStorage.getItem("user") || "{}");
  const userId = user._id || user.userId;

  // PHARMACY REJECTION POPUP
  const [showPharmacyRejectionPopup, setShowPharmacyRejectionPopup] = useState(false);
  const [rejectedPrescriptionOrder, setRejectedPrescriptionOrder]   = useState(null);
  const [reuploadModalOpen, setReuploadModalOpen] = useState(false);
  const [reuploadMode, setReuploadMode]           = useState("manual");
  const [reuploadOrderData, setReuploadOrderData] = useState(null);

  // Tab UI state (new — no logic impact)
  const [activeTab, setActiveTab] = useState("all");

  // 1. Initial load spinner (logic UNCHANGED)
  useEffect(() => {
    const fetchInitial = async () => {
      setLoading(true);
      await fetchOrders();
      setLoading(false);
    };
    fetchInitial();
    // eslint-disable-next-line
  }, [userId]);

  // 2. Poll (logic UNCHANGED)
  useEffect(() => {
    const poll = setInterval(() => { fetchOrders(); }, 15000);
    return () => clearInterval(poll);
    // eslint-disable-next-line
  }, [userId]);

  const fetchOrders = async () => {
    try {
      if (!userId) return;
      const res = await axios.get(`${API_BASE_URL}/api/allorders/myorders-userid/${userId}`);
      let presRes = [];
      try {
        presRes = await axios.get(`${API_BASE_URL}/api/prescriptions/user-orders`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
      } catch {}
      let presOrders = (presRes.data || []).map(p => ({ ...p, orderType: "prescription" }));
      const ids = new Set(res.data.map(o => String(o._id)));
      presOrders = presOrders.filter(po => !ids.has(String(po._id)));
      const allOrders = [...res.data, ...presOrders];
      allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      prevOrdersRef.current = allOrders;
      setOrders(allOrders);
    } catch (err) {
      setOrders([]);
    }
  };

  // Pharmacy rejected popup (logic UNCHANGED)
  useEffect(() => {
    const hiddenIds = getHiddenRejectionIds();
    let rejected = null;
    for (const o of orders) {
      const oid = String(o._id || (Array.isArray(o) && o[0]) || "");
      const status = o.status || (Array.isArray(o) && o[1]);
      const uploadType = o.uploadType || (Array.isArray(o) && o[2]);
      if (
        o.orderType === "prescription" &&
        (status === "cancelled" || status === "rejected") &&
        uploadType === "manual"
      ) {
        if (!hiddenIds.includes(oid)) {
          rejected = { ...o, _id: oid };
          break;
        }
      }
    }
    if (!rejected || !rejected._id) {
      setShowPharmacyRejectionPopup(false);
      setRejectedPrescriptionOrder(null);
      return;
    }
    if (!showPharmacyRejectionPopup || (rejectedPrescriptionOrder && String(rejectedPrescriptionOrder._id) !== String(rejected._id))) {
      setShowPharmacyRejectionPopup(true);
      setRejectedPrescriptionOrder(rejected);
    }
  }, [orders]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClosePharmacyRejectionPopup = () => {
    if (rejectedPrescriptionOrder?._id) {
      addHiddenRejectionId(String(rejectedPrescriptionOrder._id));
    }
    setShowPharmacyRejectionPopup(false);
    setRejectedPrescriptionOrder(null);
  };

  // Handlers (ALL LOGIC UNCHANGED)
  const handleOrderAgain = (order) => {
    const pharmacyId =
      (order.pharmacy && order.pharmacy._id) ||
      order.pharmacyId ||
      order.pharmacy;
    if (pharmacyId) {
      navigate(`/medicines/${pharmacyId}`);
    } else {
      setSnackbar({ open: true, message: "Pharmacy information missing. Unable to reorder.", severity: "error" });
    }
  };

  const handleAcceptAndPay = (order) => {
    if (order.quote && order.quote.items) {
      setCart(
        order.quote.items.filter(i => i.available !== false).map(i => ({
          _id: i._id || i.medicineId || Math.random().toString(),
          name: i.composition || i.medicineName || i.name || i.brand || "Medicine",
          brand: i.brand,
          price: i.price,
          quantity: i.quantity,
          img: "",
        }))
      );
    }
    setSelectedPharmacy(order.pharmacy);
    navigate(`/checkout?orderId=${order._id}`);
    setQuoteModalOpen(false);
    setSelectedOrder(null);
  };

  const handleUserConfirmRespond = async (orderId, type, reason = "") => {
    try {
      if (type === "rejected" && !reason.trim()) {
        setSnackbar({ open: true, message: "Reason is required for rejection", severity: "error" });
        return;
      }
      const body = type === "rejected" ? { response: "rejected", reason } : { response: "accepted" };
      await axios.post(`${API_BASE_URL}/api/prescriptions/respond/${orderId}`, body);
      setSnackbar({
        open: true,
        message: type === "rejected" ? "Order rejected." : "Order confirmed.",
        severity: type === "rejected" ? "info" : "success",
      });
      setOrders((prev) =>
        prev.map((o) =>
          o._id === orderId
            ? { ...o, status: type === "rejected" ? "rejected" : "confirmed" }
            : o
        )
      );
    } catch {
      setSnackbar({ open: true, message: "Failed to submit response", severity: "error" });
    }
    setRejectSubmitting(false);
    setRejectReason("");
    setRejectDialogOpen(false);
    setPendingRejectOrderId(null);
  };

  // Safety check (UNCHANGED)
  if (orders.length && (!orders[0] || typeof orders[0] !== "object" || Array.isArray(orders[0]))) {
    throw new Error("BUG: orders should be an array of objects. Got: " + JSON.stringify(orders[0]));
  }

  // ── Tab filter (UI only — all orders still fetched the same way) ──
  const activeOrders = orders.filter(o => ["placed","processing","assigned","accepted","picked_up","out_for_delivery","pending","quoted","pending_user_confirm"].includes(o.status));
  const pastOrders   = orders.filter(o => ["delivered","confirmed","cancelled","rejected"].includes(o.status));
  const displayOrders = activeTab === "active" ? activeOrders : activeTab === "past" ? pastOrders : orders;

  // ── RENDER ORDER CARD — all original logic inside, 2030 styling ──
  const renderOrderCard = (o, splitBadge = null, uniqueKey = null) => {
    const isActive = ["placed","processing","assigned","accepted","picked_up","out_for_delivery"].includes(o.status);
    const hasQuote = o.status === "quoted" || o.status === "pending_user_confirm";

    // items preview (from quote or items array)
    const previewItems = (() => {
      let items = [];
      if (o.tempQuote?.items?.length) items = o.tempQuote.items;
      else if (o.quote?.items?.length) items = o.quote.items;
      else if (Array.isArray(o.quote) && o.quote.length) items = o.quote;
      else if (Array.isArray(o.items) && o.items.length) items = o.items;
      return items;
    })();

    return (
      <motion.div
        key={uniqueKey || o._id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: "#fff",
          borderRadius: 20,
          border: "1.5px solid rgba(12,90,62,0.10)",
          boxShadow: isActive ? "0 4px 20px rgba(12,90,62,0.12)" : "0 2px 10px rgba(0,0,0,0.05)",
          overflow: "hidden",
          marginBottom: 14,
        }}
      >
        {/* Active gradient top bar */}
        {isActive && (
          <div style={{ height: 3, background: `linear-gradient(90deg, ${DEEP}, ${ACCENT})` }} />
        )}

        <div style={{ padding: "16px 16px 14px" }}>

          {/* ── Header: pharmacy name + status + badges ── */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800, color: "#0B1F16" }}>
                  {o.pharmacy?.name || o.pharmacy}
                </span>

                {o.orderType === "prescription" && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#D97706", background: "#FFFBEB", padding: "2px 7px", borderRadius: 100, border: "1px solid #FCD34D" }}>
                    Rx
                  </span>
                )}

                {/* split badge — same tooltip logic as original */}
                {!!splitBadge && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: splitBadge.includes("Parent") ? "#2563EB" : "#059669",
                          background: splitBadge.includes("Parent") ? "#EFF6FF" : "#ECFDF5",
                          padding: "2px 8px", borderRadius: 100, cursor: "help",
                          maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {splitBadge.includes("Parent") ? "🔀 Split" : "📦 Part"}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="text-sm">{splitBadge}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <StatusBadge status={o.status} />
                <span style={{ fontSize: 11, color: "#94A3B8", display: "flex", alignItems: "center", gap: 2 }}>
                  <Clock style={{ width: 10, height: 10 }} />
                  {formatOrderDate(o.createdAt)}
                </span>
                {/* address area inline (from original) */}
                {(o.address?.area || o.address?.city) && (
                  <span style={{ fontSize: 11, color: "#94A3B8", display: "flex", alignItems: "center", gap: 2 }}>
                    <MapPin style={{ width: 10, height: 10 }} />
                    {o.address?.area || o.address?.city}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── PRESCRIPTION ORDER BLOCK (exact same logic as original) ── */}
          {o.orderType === "prescription" ? (
            <>
              {/* Prescription file link — unchanged */}
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                <strong>Prescription: </strong>
                {collectRxUrls(o).length ? (
                  <a
                    href={collectRxUrls(o)[0]}
                    onClick={(e) => { e.preventDefault(); openOrDownloadAllRx(o); }}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#2563EB", fontWeight: 700, textDecoration: "underline" }}
                    title="Open/Download all prescription files"
                  >
                    📎 View
                  </a>
                ) : (
                  <span style={{ color: "#94A3B8" }}>Not Available</span>
                )}
              </div>

              {/* Quote Ready block — exact same conditions as original */}
              {(o.status === "quoted" || o.status === "pending_user_confirm") && (
                <div style={{
                  background: "linear-gradient(135deg,#F0FDF4,#ECFDF5)",
                  border: "1.5px solid rgba(16,185,129,0.2)",
                  borderRadius: 14, padding: "14px 14px 12px", marginBottom: 12,
                }}>
                  {/* Quote header + View Quote button */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#D97706" }}>✨ Quote Ready!</span>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setSelectedOrder(o); setQuoteModalOpen(true); }}
                      style={{
                        height: 30, padding: "0 14px", borderRadius: 100, border: "none",
                        background: `linear-gradient(135deg, ${DEEP}, ${MID})`,
                        color: "#fff", fontSize: 11, fontWeight: 700,
                        fontFamily: "'Sora',sans-serif", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 4,
                      }}
                    >
                      <ReceiptText style={{ width: 11, height: 11 }} /> View Quote
                    </motion.button>
                  </div>

                  {/* Total price + availability chips */}
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                      Total Price:{" "}
                      <strong style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, color: DEEP }}>
                        ₹{getTotalPrice(o)}
                      </strong>
                    </span>
                    {getQuoteType(o) === "full"    && <InfoChip color="green">All Available</InfoChip>}
                    {getQuoteType(o) === "partial" && <InfoChip color="amber">Partial Fulfillment</InfoChip>}
                  </div>

                  {/* Full availability message */}
                  {getQuoteType(o) === "full" && (
                    <div style={{
                      fontSize: 12, color: "#065F46", background: "#D1FAE5",
                      borderRadius: 8, padding: "7px 10px", marginBottom: 8,
                    }}>
                      ✅ All medicines available! Tap <strong>"Accept &amp; Pay"</strong> for fast delivery.
                    </div>
                  )}

                  {/* Partial availability message */}
                  {getQuoteType(o) === "partial" && (
                    <div style={{
                      fontSize: 12, color: "#92400E", background: "#FEF3C7",
                      borderRadius: 8, padding: "7px 10px", marginBottom: 8,
                    }}>
                      ⚠️ Only some medicines available. You can pay for available items or wait/split the order.
                    </div>
                  )}

                  {/* Unavailable list — unchanged condition */}
                  {o.quote && o.quote.items && o.quote.items.some(i => i.available === false) && (
                    <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 8 }}>
                      <strong>Unavailable:</strong>{" "}
                      {o.quote.items.filter(i => i.available === false).map(i => i.composition || i.medicineName || i.name || i.brand).join(", ")}
                    </div>
                  )}

                  {/* Accept & Pay + Reject — exact same condition as original */}
                  {o.status === "pending_user_confirm" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleAcceptAndPay(o)}
                        style={{
                          height: 46, borderRadius: 13, border: "none",
                          background: `linear-gradient(135deg, ${DEEP}, ${MID})`,
                          color: "#fff", fontSize: 14, fontWeight: 800,
                          fontFamily: "'Sora',sans-serif", cursor: "pointer",
                          boxShadow: "0 4px 16px rgba(12,90,62,0.35)",
                        }}
                      >
                        ACCEPT &amp; PAY 💳
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => { setRejectDialogOpen(true); setPendingRejectOrderId(o._id); setRejectReason(""); }}
                        style={{
                          height: 40, borderRadius: 12,
                          border: "2px solid #EF4444",
                          background: "#FEF2F2", color: "#DC2626",
                          fontSize: 13, fontWeight: 700,
                          fontFamily: "'Sora',sans-serif", cursor: "pointer",
                        }}
                      >
                        Reject
                      </motion.button>
                    </div>
                  )}
                </div>
              )}

              {/* Prescription status line — same as original */}
              <div style={{ fontSize: 13, fontWeight: 700, color: "#2563EB", marginBottom: 6 }}>
                Status:{" "}
                <span style={{ color: "#0B1F16", fontWeight: 800, textTransform: "capitalize" }}>
                  {o.status}
                </span>
              </div>
            </>
          ) : (
            <>
              {/* ── REGULAR ORDER BLOCK (unchanged logic) ── */}
              {/* Items list */}
              {o.items && o.items.length > 0 && (
                <div style={{
                  background: "#F8FBFA", borderRadius: 10, padding: "8px 12px",
                  fontSize: 12, color: "#4A6B5A", marginBottom: 10,
                  display: "flex", alignItems: "flex-start", gap: 6,
                }}>
                  <Package style={{ width: 12, height: 12, flexShrink: 0, color: DEEP, marginTop: 1 }} />
                  <span>
                    <strong>Items: </strong>
                    {o.items.map(i => `${i.name || i.medicineName} (${i.quantity || i.qty || "-"})`).join(", ")}
                  </span>
                </div>
              )}

              {/* Total price */}
              <div style={{ fontSize: 13, color: "#0B1F16", marginBottom: 6 }}>
                <strong>Total Price:</strong>{" "}
                <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800, color: DEEP }}>₹{o.total}</span>
              </div>
            </>
          )}

          {/* ── Address — unchanged ── */}
          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 10, display: "flex", gap: 4, alignItems: "flex-start" }}>
            <MapPin style={{ width: 11, height: 11, flexShrink: 0, marginTop: 1, color: "#9CA3AF" }} />
            <span>{getDisplayAddress(o.address)}</span>
          </div>

          {/* ── Bottom action row (exact same logic as original) ── */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>

            {/* Status + Quote button for non-prescription orders */}
            {o.orderType !== "prescription" && (
              <div style={{ flex: 1, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                {o.status === "quoted" ? (
                  <>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#D97706" }}>✨ Quote Ready!</span>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setSelectedOrder(o); setQuoteModalOpen(true); }}
                      style={{
                        height: 30, padding: "0 14px", borderRadius: 100, border: "none",
                        background: "#8B5CF6", color: "#fff",
                        fontSize: 11, fontWeight: 700,
                        fontFamily: "'Sora',sans-serif", cursor: "pointer",
                      }}
                    >
                      View &amp; Accept/Reject
                    </motion.button>
                  </>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#2563EB" }}>
                    Status:{" "}
                    <span style={{ color: "#0B1F16", textTransform: "capitalize" }}>
                      {o.status || "Placed"}
                    </span>
                  </span>
                )}
              </div>
            )}

            {/* Track Live button — for active orders */}
            {isActive && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/order-tracking/${o._id}`)}
                style={{
                  height: 36, padding: "0 16px", borderRadius: 100, border: "none",
                  background: `linear-gradient(135deg, ${DEEP}, ${MID})`,
                  color: "#fff", fontSize: 11, fontWeight: 700,
                  fontFamily: "'Sora',sans-serif", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                  boxShadow: "0 3px 10px rgba(12,90,62,0.28)",
                }}
              >
                🛵 Track <ChevronRight style={{ width: 11, height: 11 }} />
              </motion.button>
            )}

            {/* Order Again button — same as original */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleOrderAgain(o)}
              style={{
                height: 36, padding: "0 14px", borderRadius: 100,
                border: `1.5px solid ${DEEP}`,
                background: "#E8F5EF", color: DEEP,
                fontSize: 11, fontWeight: 700,
                fontFamily: "'Sora',sans-serif", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <RefreshCw style={{ width: 11, height: 11 }} /> Order Again
            </motion.button>
          </div>

          {/* ── Invoice download — same condition as original ── */}
          {o.invoiceFile && (
            <a
              href={o.invoiceFile}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: 10, textDecoration: "none" }}
            >
              <motion.button
                whileTap={{ scale: 0.95 }}
                style={{
                  height: 34, padding: "0 14px", borderRadius: 100,
                  border: "1.5px solid #2563EB",
                  background: "#EFF6FF", color: "#2563EB",
                  fontSize: 11, fontWeight: 700,
                  fontFamily: "'Sora',sans-serif", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                <ReceiptText style={{ width: 11, height: 11 }} /> Download Invoice
              </motion.button>
            </a>
          )}
        </div>
      </motion.div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", maxWidth: 480, margin: "0 auto",
      background: "#F2F7F4", paddingBottom: 100,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>

      {/* Header */}
      <div style={{
        background: `linear-gradient(160deg, ${DEEP} 0%, #0A4631 100%)`,
        padding: "52px 20px 24px", position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", right: -40, top: -40, width: 160, height: 160,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,217,126,0.12) 0%, transparent 70%)",
        }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: "#fff" }}>
              My Orders
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
              {orders.length} order{orders.length !== 1 ? "s" : ""} total
            </div>
          </div>
          <div style={{
            width: 42, height: 42, borderRadius: 14,
            background: "rgba(255,255,255,0.15)",
            border: "1.5px solid rgba(255,255,255,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ReceiptText style={{ width: 20, height: 20, color: "#fff" }} />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        background: "#fff", padding: "0 16px",
        display: "flex", gap: 4,
        borderBottom: "1px solid rgba(12,90,62,0.08)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        {[
          { key: "all",    label: "All",    count: orders.length },
          { key: "active", label: "Active", count: activeOrders.length },
          { key: "past",   label: "Past",   count: pastOrders.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, height: 46, border: "none", background: "none", cursor: "pointer",
              fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700,
              color: activeTab === tab.key ? DEEP : "#94A3B8",
              borderBottom: activeTab === tab.key ? `2.5px solid ${DEEP}` : "2.5px solid transparent",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "all 0.15s",
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                background: activeTab === tab.key ? DEEP : "#E2E8F0",
                color: activeTab === tab.key ? "#fff" : "#64748B",
                padding: "1px 6px", borderRadius: 100,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "16px 16px 0" }}>
        {loading ? (
          /* Skeleton loader */
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: 140, borderRadius: 20, background: "#fff",
                border: "1.5px solid rgba(12,90,62,0.08)",
                animation: "pulse 1.5s ease-in-out infinite",
              }} />
            ))}
          </div>
        ) : groupSplitOrders(displayOrders).length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: "center", padding: "60px 20px" }}
          >
            <div style={{ fontSize: 64, marginBottom: 16 }}>📦</div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, color: "#0B1F16", marginBottom: 8 }}>
              No orders yet
            </div>
            <div style={{ fontSize: 14, color: "#94A3B8", marginBottom: 24 }}>
              {activeTab === "active" ? "No active orders right now"
                : activeTab === "past" ? "No completed orders yet"
                : "Start by ordering medicines"}
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate("/pharmacies-near-you")}
              style={{
                height: 48, padding: "0 28px", borderRadius: 100, border: "none",
                background: `linear-gradient(135deg, ${DEEP}, ${MID})`,
                color: "#fff", fontSize: 14, fontWeight: 700,
                fontFamily: "'Sora',sans-serif", cursor: "pointer",
                boxShadow: "0 4px 16px rgba(12,90,62,0.3)",
              }}
            >
              Order Medicines →
            </motion.button>
          </motion.div>
        ) : (
          /* Order list — same groupSplitOrders logic as original */
          groupSplitOrders(displayOrders).map((order) => {
            if (order.splits && order.splits.length > 0) {
              return (
                <React.Fragment key={`parent-${order._id}`}>
                  {renderOrderCard(order, "Parent Order (Split)", `parent-${order._id}`)}
                  {order.splits
                    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                    .map((split) =>
                      renderOrderCard(
                        split,
                        `Split Order (Part of: #${String(order._id).slice(-6).toUpperCase()})`,
                        `split-${split._id}-parent-${order._id}`
                      )
                    )}
                </React.Fragment>
              );
            } else {
              return renderOrderCard(
                order,
                order.parentOrder
                  ? `Split Order (Part of: #${String(order.parentOrder).slice(-6).toUpperCase()})`
                  : null,
                order.parentOrder
                  ? `split-${order._id}-parent-${order.parentOrder}`
                  : `single-${order._id}`
              );
            }
          })
        )}
      </div>

      {/* ── Reject Dialog (same logic as original) ── */}
      <Dialog
        open={rejectDialogOpen}
        onOpenChange={(open) => { if (!open) { setRejectDialogOpen(false); setRejectReason(""); } }}
      >
        <DialogContent style={{ borderRadius: 24 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800 }}>Reject Order</DialogTitle>
          </DialogHeader>
          <div style={{ fontSize: 14, color: "#64748B", marginBottom: 10 }}>
            Please provide a reason for rejecting this order:
          </div>
          <textarea
            style={{
              width: "100%", minHeight: 72, borderRadius: 12,
              border: "1.5px solid #EF4444", padding: 12, fontSize: 15,
              outline: "none", fontFamily: "'Plus Jakarta Sans',sans-serif",
              boxSizing: "border-box", color: "#0B1F16",
              resize: "vertical",
            }}
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Enter reason (required)"
            disabled={rejectSubmitting}
          />
          <DialogFooter style={{ gap: 8 }}>
            <Button variant="ghost" onClick={() => setRejectDialogOpen(false)} disabled={rejectSubmitting}>
              Cancel
            </Button>
            <Button
              style={{ background: "#EF4444", borderRadius: 12, fontFamily: "'Sora',sans-serif", fontWeight: 700 }}
              disabled={!rejectReason.trim() || rejectSubmitting}
              onClick={async () => {
                setRejectSubmitting(true);
                await handleUserConfirmRespond(pendingRejectOrderId, "rejected", rejectReason.trim());
                setRejectSubmitting(false);
              }}
            >
              Reject Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Pharmacy Rejection Popup (same logic as original) ── */}
      <Dialog open={showPharmacyRejectionPopup} onOpenChange={handleClosePharmacyRejectionPopup}>
        <DialogContent style={{ borderRadius: 24, maxWidth: 360 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800, color: "#0B1F16" }}>
              Pharmacy Rejected Your Prescription
            </div>
            <button onClick={handleClosePharmacyRejectionPopup} style={{ background: "none", border: "none", cursor: "pointer" }}>
              <X style={{ width: 18, height: 18, color: "#94A3B8" }} />
            </button>
          </div>
          <div style={{ fontSize: 14, color: "#64748B", marginBottom: 16 }}>
            The pharmacy you selected couldn't fulfill your prescription.
            <br />What would you like to do next?
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (rejectedPrescriptionOrder?._id) addHiddenRejectionId(rejectedPrescriptionOrder._id);
                setShowPharmacyRejectionPopup(false);
                setReuploadMode("manual");
                setReuploadOrderData(rejectedPrescriptionOrder);
                setReuploadModalOpen(true);
              }}
              style={{
                height: 46, borderRadius: 14, border: "none",
                background: `linear-gradient(135deg,${DEEP},${MID})`,
                color: "#fff", fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              Choose Another Pharmacy
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (rejectedPrescriptionOrder?._id) addHiddenRejectionId(rejectedPrescriptionOrder._id);
                setShowPharmacyRejectionPopup(false);
                setReuploadMode("auto");
                setReuploadOrderData(rejectedPrescriptionOrder);
                setReuploadModalOpen(true);
              }}
              style={{
                height: 46, borderRadius: 14,
                border: `1.5px solid ${DEEP}`,
                background: "#E8F5EF", color: DEEP,
                fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              Let GoDavaii Handle It
            </motion.button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reupload Modal (unchanged) ── */}
      <PrescriptionUploadModal
        open={reuploadModalOpen}
        onClose={() => setReuploadModalOpen(false)}
        userCity={reuploadOrderData?.address?.city || ""}
        userArea={reuploadOrderData?.address?.area || ""}
        afterOrder={() => setReuploadModalOpen(false)}
        initialMode={reuploadMode}
        initialNotes={reuploadOrderData?.notes || ""}
        initialFileUrl={reuploadOrderData?.prescriptionUrl || ""}
        initialAddress={reuploadOrderData?.address || {}}
      />

      {/* ── Quote Review Modal (unchanged) ── */}
      <QuoteReviewModal
        open={quoteModalOpen}
        order={selectedOrder}
        onClose={() => setQuoteModalOpen(false)}
        onAccept={() => handleAcceptAndPay(selectedOrder)}
      />

      {/* ── Toast/Snackbar ── */}
      <AnimatePresence>
        {snackbar.open && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            onAnimationComplete={() => setTimeout(() => setSnackbar((s) => ({ ...s, open: false })), 2200)}
            style={{
              position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
              zIndex: 9999, borderRadius: 100, padding: "11px 22px",
              background: snackbar.severity === "error" ? "#EF4444"
                : snackbar.severity === "info" ? "#0E7A4F"
                : "#059669",
              color: "#fff", fontSize: 13, fontWeight: 700,
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)", whiteSpace: "nowrap",
            }}
          >
            {snackbar.message}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}