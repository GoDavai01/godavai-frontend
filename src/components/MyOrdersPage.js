// src/components/MyOrdersPage.js — GoDavaii 2030 Modern UI
// ALL LOGIC UNCHANGED — only UI rewritten
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ReceiptText, X, ChevronRight, Clock, MapPin, Package, RefreshCw } from "lucide-react";
import QuoteReviewModal from "./QuoteReviewModal";
import PrescriptionUploadModal from "./PrescriptionUploadModal";
import { useCart } from "../context/CartContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP  = "#0C5A3E";
const MID   = "#0E7A4F";
const ACCENT = "#00D97E";

// ─── Utils (ALL UNCHANGED) ────────────────────────────────────
const toAbsUrl = (u = "") => u.startsWith("/uploads/") ? `${API_BASE_URL}${u}` : u;
const isSameOriginUrl = (url) => { try { return new URL(url, window.location.origin).origin === window.location.origin; } catch { return false; } };
function collectRxUrls(order) {
  const urls = [];
  if (Array.isArray(order.attachments) && order.attachments.length) urls.push(...order.attachments.map(toAbsUrl));
  else if (Array.isArray(order.prescriptionUrls) && order.prescriptionUrls.length) urls.push(...order.prescriptionUrls.map(toAbsUrl));
  else if (order.prescriptionUrl || order.prescription) urls.push(toAbsUrl(order.prescriptionUrl || order.prescription));
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
        const filename = nameFromUrl.includes(".") ? nameFromUrl : `${nameFromUrl}${extFromType ? "." + extFromType : ""}`;
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
      } catch { window.open(url, "_blank"); }
    } else { window.open(url, "_blank"); }
    await new Promise((r) => setTimeout(r, 120));
  }
}
function getHiddenRejectionIds() { try { return JSON.parse(localStorage.getItem("hiddenRejectionPopupOrderIds") || "[]").map(String); } catch { return []; } }
function addHiddenRejectionId(orderId) { const ids = getHiddenRejectionIds(); const idStr = String(orderId); if (!ids.includes(idStr)) { ids.push(idStr); localStorage.setItem("hiddenRejectionPopupOrderIds", JSON.stringify(ids)); } }
function formatOrderDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const opts = { day: "numeric", month: "short" };
  const date = d.toLocaleDateString("en-IN", opts);
  let hour = d.getHours(); const min = d.getMinutes().toString().padStart(2, "0"); const ampm = hour >= 12 ? "pm" : "am"; hour = hour % 12 || 12;
  return `${date}, ${hour}:${min}${ampm}`;
}
function getTotalPrice(order) {
  if (order.tempQuote && Array.isArray(order.tempQuote.items) && order.tempQuote.items.length) return order.tempQuote.items.filter(i => i.available !== false).reduce((a, b) => a + ((b.price || 0) * (b.quantity || 1)), 0);
  if (order.tempQuote && typeof order.tempQuote.approxPrice === "number") return order.tempQuote.approxPrice;
  if (order.quote && Array.isArray(order.quote.items) && order.quote.items.length) return order.quote.items.filter(i => i.available !== false).reduce((a, b) => a + ((b.price || 0) * (b.quantity || 1)), 0);
  if (order.quote && typeof order.quote.price === "number") return order.quote.price;
  if (Array.isArray(order.quote) && order.quote.length) return order.quote.filter(i => i.available !== false).reduce((a, b) => a + ((b.price || 0) * (b.quantity || 1)), 0);
  if (Array.isArray(order.quotes) && order.quotes.length && typeof order.quotes[order.quotes.length - 1]?.price === "number") return order.quotes[order.quotes.length - 1].price;
  if (order.tempQuote && Array.isArray(order.tempQuote.items)) return order.tempQuote.items.filter(i => i.available !== false).reduce((a, b) => a + ((b.price || 0) * (b.quantity || 1)), 0);
  return 0;
}
function getQuoteType(order) {
  let items = [];
  if (order.tempQuote?.items?.length) items = order.tempQuote.items;
  else if (order.quote?.items?.length) items = order.quote.items;
  else if (Array.isArray(order.quote) && order.quote.length) items = order.quote;
  else if (Array.isArray(order.quotes) && order.quotes.length && order.quotes[order.quotes.length - 1]?.items?.length) items = order.quotes[order.quotes.length - 1].items;
  if (!items.length) return "none";
  if (items.every(i => i.available !== false)) return "full";
  if (items.some(i => i.available === false)) return "partial";
  return "none";
}
function groupSplitOrders(orders) {
  const orderMap = {}; const result = [];
  orders.forEach(order => { orderMap[order._id] = { ...order, splits: [] }; });
  orders.forEach(order => { if (order.parentOrder && orderMap[order.parentOrder]) orderMap[order.parentOrder].splits.push(order); });
  const used = new Set();
  orders.forEach(order => { if (order.parentOrder) { used.add(order._id); } else { result.push(orderMap[order._id]); orderMap[order._id].splits.forEach(split => used.add(split._id)); } });
  orders.forEach(order => { if (!used.has(order._id)) result.push(order); });
  return result;
}
function getDisplayAddress(address) {
  if (!address) return "";
  return address.formatted || [address.addressLine, address.floor, address.area, address.city].filter(Boolean).join(", ") || address.fullAddress || "";
}

// ─── Status config ────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:          { label: "Pending",          color: "#F59E0B", bg: "#FFFBEB", emoji: "🕐" },
  placed:           { label: "Placed",           color: "#3B82F6", bg: "#EFF6FF", emoji: "📋" },
  quoted:           { label: "Quote Ready",      color: "#8B5CF6", bg: "#F5F3FF", emoji: "💬" },
  pending_user_confirm: { label: "Action Needed", color: "#EF4444", bg: "#FEF2F2", emoji: "⚠️" },
  processing:       { label: "Processing",       color: "#F59E0B", bg: "#FFFBEB", emoji: "⚙️" },
  assigned:         { label: "Assigned",         color: "#06B6D4", bg: "#ECFEFF", emoji: "🤝" },
  accepted:         { label: "Accepted",         color: "#10B981", bg: "#ECFDF5", emoji: "✅" },
  picked_up:        { label: "Picked Up",        color: "#10B981", bg: "#ECFDF5", emoji: "📦" },
  out_for_delivery: { label: "On the Way",       color: "#F59E0B", bg: "#FFFBEB", emoji: "🛵" },
  delivered:        { label: "Delivered",        color: "#059669", bg: "#ECFDF5", emoji: "🎉" },
  cancelled:        { label: "Cancelled",        color: "#EF4444", bg: "#FEF2F2", emoji: "❌" },
  rejected:         { label: "Rejected",         color: "#EF4444", bg: "#FEF2F2", emoji: "❌" },
  confirmed:        { label: "Confirmed",        color: "#059669", bg: "#ECFDF5", emoji: "✅" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "#64748B", bg: "#F1F5F9", emoji: "📄" };
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

// ─── Order Card ───────────────────────────────────────────────
function OrderCard({ order, splitBadge, onTrack, onQuoteReview, onReject, onConfirm, onOrderAgain, onRxView }) {
  const price = getTotalPrice(order);
  const quoteType = getQuoteType(order);
  const rxUrls = collectRxUrls(order);
  const isActive = ["placed","processing","assigned","accepted","picked_up","out_for_delivery"].includes(order.status);
  const hasQuote = order.status === "quoted" || order.status === "pending_user_confirm";

  const itemsList = (() => {
    let items = [];
    if (order.tempQuote?.items?.length) items = order.tempQuote.items;
    else if (order.quote?.items?.length) items = order.quote.items;
    else if (Array.isArray(order.quote) && order.quote.length) items = order.quote;
    else if (Array.isArray(order.items) && order.items.length) items = order.items;
    return items.slice(0, 3).map(i => i.name || i.medicineName || i.brand || "Medicine").join(", ");
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "#fff",
        borderRadius: 20,
        border: "1.5px solid rgba(12,90,62,0.10)",
        boxShadow: isActive ? "0 4px 20px rgba(12,90,62,0.12)" : "0 2px 10px rgba(0,0,0,0.05)",
        overflow: "hidden", marginBottom: 14,
      }}
    >
      {/* Active indicator bar */}
      {isActive && (
        <div style={{ height: 3, background: `linear-gradient(90deg, ${DEEP}, ${ACCENT})` }} />
      )}

      <div style={{ padding: "16px 16px 14px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800, color: "#0B1F16" }}>
                {order.pharmacy?.name || order.pharmacy || "Pharmacy"}
              </span>
              {order.orderType === "prescription" && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#D97706", background: "#FFFBEB", padding: "2px 7px", borderRadius: 100, border: "1px solid #FCD34D" }}>
                  Rx
                </span>
              )}
              {splitBadge && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: splitBadge.includes("Parent") ? "#2563EB" : "#059669",
                        background: splitBadge.includes("Parent") ? "#EFF6FF" : "#ECFDF5",
                        padding: "2px 8px", borderRadius: 100, cursor: "help",
                        maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {splitBadge.includes("Parent") ? "🔀 Split" : "📦 Part"}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{splitBadge}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <StatusBadge status={order.status} />
              <span style={{ fontSize: 11, color: "#94A3B8" }}>
                <Clock style={{ width: 10, height: 10, display: "inline", marginRight: 3 }} />
                {formatOrderDate(order.createdAt)}
              </span>
            </div>
          </div>
          {price > 0 && (
            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, color: DEEP }}>₹{price}</div>
              {quoteType === "partial" && <div style={{ fontSize: 10, color: "#F59E0B", fontWeight: 600 }}>Partial</div>}
            </div>
          )}
        </div>

        {/* Items preview */}
        {itemsList && (
          <div style={{
            background: "#F8FBFA", borderRadius: 10, padding: "8px 12px",
            fontSize: 12, color: "#4A6B5A", marginBottom: 12,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Package style={{ width: 12, height: 12, flexShrink: 0, color: DEEP }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {itemsList}{(order.items?.length > 3 || order.quote?.items?.length > 3) ? ` +more` : ""}
            </span>
          </div>
        )}

        {/* Address */}
        {order.address && (
          <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 12, display: "flex", gap: 4 }}>
            <MapPin style={{ width: 11, height: 11, flexShrink: 0, marginTop: 1 }} />
            <span>{getDisplayAddress(order.address)}</span>
          </div>
        )}

        {/* Quote partial warning */}
        {quoteType === "partial" && (
          <div style={{
            background: "#FFFBEB", border: "1px solid #FCD34D",
            borderRadius: 10, padding: "8px 12px", fontSize: 12,
            color: "#92400E", marginBottom: 12,
          }}>
            ⚠️ Some medicines unavailable — review quote to proceed
          </div>
        )}

        {/* Rx link */}
        {order.orderType === "prescription" && rxUrls.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <button
              onClick={(e) => { e.stopPropagation(); openOrDownloadAllRx(order); }}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 700, color: "#2563EB",
                display: "flex", alignItems: "center", gap: 4, padding: 0,
              }}
            >
              📎 View Prescription
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isActive && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onTrack?.(order)}
              style={{
                flex: 1, height: 38, borderRadius: 100, border: "none",
                background: `linear-gradient(135deg, ${DEEP}, ${MID})`,
                color: "#fff", fontSize: 12, fontWeight: 700,
                fontFamily: "'Sora',sans-serif", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                boxShadow: "0 3px 12px rgba(12,90,62,0.28)",
              }}
            >
              🛵 Track Live <ChevronRight style={{ width: 12, height: 12 }} />
            </motion.button>
          )}

          {hasQuote && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onQuoteReview?.(order)}
              style={{
                flex: 1, height: 38, borderRadius: 100, border: "none",
                background: "linear-gradient(135deg,#7C3AED,#8B5CF6)",
                color: "#fff", fontSize: 12, fontWeight: 700,
                fontFamily: "'Sora',sans-serif", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                boxShadow: "0 3px 12px rgba(124,58,237,0.3)",
              }}
            >
              💬 Review Quote
            </motion.button>
          )}

          {order.status === "pending_user_confirm" && (
            <>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => onConfirm?.(order._id, "accepted")}
                style={{ flex: 1, height: 38, borderRadius: 100, border: "none", background: "#059669", color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "'Sora',sans-serif", cursor: "pointer" }}
              >
                ✓ Accept
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => onReject?.(order._id)}
                style={{ height: 38, padding: "0 16px", borderRadius: 100, border: "1.5px solid #EF4444", background: "#FEF2F2", color: "#EF4444", fontSize: 12, fontWeight: 700, fontFamily: "'Sora',sans-serif", cursor: "pointer" }}
              >
                Reject
              </motion.button>
            </>
          )}

          {(order.status === "delivered" || order.status === "confirmed") && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onOrderAgain?.(order)}
              style={{
                height: 38, padding: "0 16px", borderRadius: 100,
                border: `1.5px solid ${DEEP}`,
                background: "#E8F5EF", color: DEEP,
                fontSize: 12, fontWeight: 700, fontFamily: "'Sora',sans-serif",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <RefreshCw style={{ width: 12, height: 12 }} /> Reorder
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
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
  const [showPharmacyRejectionPopup, setShowPharmacyRejectionPopup] = useState(false);
  const [rejectedPrescriptionOrder, setRejectedPrescriptionOrder]   = useState(null);
  const [reuploadModalOpen, setReuploadModalOpen] = useState(false);
  const [reuploadMode, setReuploadMode]           = useState("manual");
  const [reuploadOrderData, setReuploadOrderData] = useState(null);
  const [activeTab, setActiveTab]         = useState("all");

  const prevOrdersRef = useRef([]);
  const { setCart, setSelectedPharmacy } = useCart();
  const navigate = useNavigate();
  const user   = JSON.parse(localStorage.getItem("user") || "{}");
  const userId = user._id || user.userId;

  useEffect(() => {
    const fetchInitial = async () => { setLoading(true); await fetchOrders(); setLoading(false); };
    fetchInitial();
    // eslint-disable-next-line
  }, [userId]);

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
        presRes = await axios.get(`${API_BASE_URL}/api/prescriptions/user-orders`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      } catch {}
      let presOrders = (presRes.data || []).map(p => ({ ...p, orderType: "prescription" }));
      const ids = new Set(res.data.map(o => String(o._id)));
      presOrders = presOrders.filter(po => !ids.has(String(po._id)));
      const allOrders = [...res.data, ...presOrders];
      allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      prevOrdersRef.current = allOrders;
      setOrders(allOrders);
    } catch { setOrders([]); }
  };

  useEffect(() => {
    const hiddenIds = getHiddenRejectionIds();
    let rejected = null;
    for (const o of orders) {
      const oid = String(o._id || (Array.isArray(o) && o[0]) || "");
      const status = o.status || (Array.isArray(o) && o[1]);
      const uploadType = o.uploadType || (Array.isArray(o) && o[2]);
      if (o.orderType === "prescription" && (status === "cancelled" || status === "rejected") && uploadType === "manual") {
        if (!hiddenIds.includes(oid)) { rejected = { ...o, _id: oid }; break; }
      }
    }
    if (!rejected || !rejected._id) { setShowPharmacyRejectionPopup(false); setRejectedPrescriptionOrder(null); return; }
    if (!showPharmacyRejectionPopup || (rejectedPrescriptionOrder && String(rejectedPrescriptionOrder._id) !== String(rejected._id))) {
      setShowPharmacyRejectionPopup(true); setRejectedPrescriptionOrder(rejected);
    }
  }, [orders]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClosePharmacyRejectionPopup = () => {
    if (rejectedPrescriptionOrder?._id) addHiddenRejectionId(String(rejectedPrescriptionOrder._id));
    setShowPharmacyRejectionPopup(false); setRejectedPrescriptionOrder(null);
  };

  const handleOrderAgain = (order) => {
    const pharmacyId = (order.pharmacy && order.pharmacy._id) || order.pharmacyId || order.pharmacy;
    if (pharmacyId) { navigate(`/medicines/${pharmacyId}`); }
    else { setSnackbar({ open: true, message: "Pharmacy info missing.", severity: "error" }); }
  };

  const handleAcceptAndPay = (order) => {
    if (order.quote && order.quote.items) {
      setCart(order.quote.items.filter(i => i.available !== false).map(i => ({
        _id: i._id || i.medicineId || Math.random().toString(),
        name: i.composition || i.medicineName || i.name || i.brand || "Medicine",
        brand: i.brand, price: i.price, quantity: i.quantity, img: "",
      })));
    }
    setSelectedPharmacy(order.pharmacy);
    navigate(`/checkout?orderId=${order._id}`);
    setQuoteModalOpen(false); setSelectedOrder(null);
  };

  const handleUserConfirmRespond = async (orderId, type, reason = "") => {
    try {
      if (type === "rejected" && !reason.trim()) { setSnackbar({ open: true, message: "Reason required for rejection", severity: "error" }); return; }
      const body = type === "rejected" ? { response: "rejected", reason } : { response: "accepted" };
      await axios.post(`${API_BASE_URL}/api/prescriptions/respond/${orderId}`, body);
      setSnackbar({ open: true, message: type === "rejected" ? "Order rejected." : "Order confirmed.", severity: type === "rejected" ? "info" : "success" });
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status: type === "rejected" ? "rejected" : "confirmed" } : o));
    } catch { setSnackbar({ open: true, message: "Failed to submit response", severity: "error" }); }
    setRejectSubmitting(false); setRejectReason(""); setRejectDialogOpen(false); setPendingRejectOrderId(null);
  };

  // Tab filtering
  const activeOrders   = orders.filter(o => ["placed","processing","assigned","accepted","picked_up","out_for_delivery","pending","quoted","pending_user_confirm"].includes(o.status));
  const pastOrders     = orders.filter(o => ["delivered","confirmed","cancelled","rejected"].includes(o.status));
  const displayOrders  = activeTab === "active" ? activeOrders : activeTab === "past" ? pastOrders : orders;
  const grouped        = groupSplitOrders(displayOrders);

  if (orders.length && (!orders[0] || typeof orders[0] !== "object" || Array.isArray(orders[0]))) {
    throw new Error("BUG: orders should be an array of objects. Got: " + JSON.stringify(orders[0]));
  }

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
        <div style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,217,126,0.12) 0%, transparent 70%)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: "#fff" }}>My Orders</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
              {orders.length} order{orders.length !== 1 ? "s" : ""} total
            </div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ReceiptText style={{ width: 20, height: 20, color: "#fff" }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#fff", padding: "0 16px", display: "flex", gap: 4, borderBottom: "1px solid rgba(12,90,62,0.08)", position: "sticky", top: 0, zIndex: 100 }}>
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

      <div style={{ padding: "16px 16px 0" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 130, borderRadius: 20, background: "#fff", border: "1.5px solid rgba(12,90,62,0.1)", animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        ) : grouped.length === 0 ? (
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
              {activeTab === "active" ? "No active orders right now" : activeTab === "past" ? "No completed orders" : "Start by ordering medicines"}
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
          grouped.map((order) => {
            if (order.splits && order.splits.length > 0) {
              return (
                <React.Fragment key={`parent-${order._id}`}>
                  <OrderCard
                    order={order}
                    splitBadge="Parent Order (Split)"
                    onTrack={(o) => navigate(`/order-tracking/${o._id}`)}
                    onQuoteReview={(o) => { setSelectedOrder(o); setQuoteModalOpen(true); }}
                    onReject={(id) => { setPendingRejectOrderId(id); setRejectDialogOpen(true); }}
                    onConfirm={handleUserConfirmRespond}
                    onOrderAgain={handleOrderAgain}
                  />
                  {order.splits.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map(split => (
                    <OrderCard
                      key={`split-${split._id}`}
                      order={split}
                      splitBadge={`Split Order (Part of: #${String(order._id).slice(-6).toUpperCase()})`}
                      onTrack={(o) => navigate(`/order-tracking/${o._id}`)}
                      onQuoteReview={(o) => { setSelectedOrder(o); setQuoteModalOpen(true); }}
                      onReject={(id) => { setPendingRejectOrderId(id); setRejectDialogOpen(true); }}
                      onConfirm={handleUserConfirmRespond}
                      onOrderAgain={handleOrderAgain}
                    />
                  ))}
                </React.Fragment>
              );
            }
            return (
              <OrderCard
                key={order.parentOrder ? `split-${order._id}-parent-${order.parentOrder}` : `single-${order._id}`}
                order={order}
                splitBadge={order.parentOrder ? `Split Order (Part of: #${String(order.parentOrder).slice(-6).toUpperCase()})` : null}
                onTrack={(o) => navigate(`/order-tracking/${o._id}`)}
                onQuoteReview={(o) => { setSelectedOrder(o); setQuoteModalOpen(true); }}
                onReject={(id) => { setPendingRejectOrderId(id); setRejectDialogOpen(true); }}
                onConfirm={handleUserConfirmRespond}
                onOrderAgain={handleOrderAgain}
              />
            );
          })
        )}
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={(open) => { if (!open) { setRejectDialogOpen(false); setRejectReason(""); } }}>
        <DialogContent style={{ borderRadius: 24 }}>
          <DialogHeader><DialogTitle style={{ fontFamily: "'Sora',sans-serif" }}>Reject Order</DialogTitle></DialogHeader>
          <div style={{ fontSize: 14, color: "#64748B", marginBottom: 10 }}>Please provide a reason:</div>
          <textarea
            style={{ width: "100%", minHeight: 72, borderRadius: 12, border: "1.5px solid #EF4444", padding: 12, fontSize: 15, outline: "none", fontFamily: "'Plus Jakarta Sans',sans-serif", boxSizing: "border-box" }}
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Enter reason (required)"
            disabled={rejectSubmitting}
          />
          <DialogFooter style={{ gap: 8 }}>
            <Button variant="ghost" onClick={() => setRejectDialogOpen(false)} disabled={rejectSubmitting}>Cancel</Button>
            <Button
              style={{ background: "#EF4444", borderRadius: 12, fontFamily: "'Sora',sans-serif", fontWeight: 700 }}
              disabled={!rejectReason.trim() || rejectSubmitting}
              onClick={async () => { setRejectSubmitting(true); await handleUserConfirmRespond(pendingRejectOrderId, "rejected", rejectReason.trim()); }}
            >
              Reject Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pharmacy rejection popup */}
      <Dialog open={showPharmacyRejectionPopup} onOpenChange={handleClosePharmacyRejectionPopup}>
        <DialogContent style={{ borderRadius: 24, maxWidth: 360 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800, color: "#0B1F16" }}>Pharmacy Rejected Prescription</div>
            <button onClick={handleClosePharmacyRejectionPopup} style={{ background: "none", border: "none", cursor: "pointer" }}><X style={{ width: 18, height: 18, color: "#94A3B8" }} /></button>
          </div>
          <div style={{ fontSize: 14, color: "#64748B", marginBottom: 16 }}>The pharmacy couldn't fulfill your prescription. What would you like to do?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={() => { if (rejectedPrescriptionOrder?._id) addHiddenRejectionId(rejectedPrescriptionOrder._id); setShowPharmacyRejectionPopup(false); setReuploadMode("manual"); setReuploadOrderData(rejectedPrescriptionOrder); setReuploadModalOpen(true); }}
              style={{ height: 46, borderRadius: 14, border: "none", background: `linear-gradient(135deg,${DEEP},${MID})`, color: "#fff", fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Choose Another Pharmacy
            </button>
            <button onClick={() => { if (rejectedPrescriptionOrder?._id) addHiddenRejectionId(rejectedPrescriptionOrder._id); setShowPharmacyRejectionPopup(false); setReuploadMode("auto"); setReuploadOrderData(rejectedPrescriptionOrder); setReuploadModalOpen(true); }}
              style={{ height: 46, borderRadius: 14, border: `1.5px solid ${DEEP}`, background: "#E8F5EF", color: DEEP, fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Let GoDavaii Handle It
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <PrescriptionUploadModal open={reuploadModalOpen} onClose={() => setReuploadModalOpen(false)} userCity={reuploadOrderData?.address?.city || ""} userArea={reuploadOrderData?.address?.area || ""} afterOrder={() => setReuploadModalOpen(false)} initialMode={reuploadMode} initialNotes={reuploadOrderData?.notes || ""} initialFileUrl={reuploadOrderData?.prescriptionUrl || ""} initialAddress={reuploadOrderData?.address || {}} />
      <QuoteReviewModal open={quoteModalOpen} order={selectedOrder} onClose={() => setQuoteModalOpen(false)} onAccept={() => handleAcceptAndPay(selectedOrder)} />

      {/* Toast */}
      <AnimatePresence>
        {snackbar.open && (
          <motion.div
            initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
            onAnimationComplete={() => setTimeout(() => setSnackbar(s => ({ ...s, open: false })), 2200)}
            style={{
              position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
              zIndex: 9999, borderRadius: 100, padding: "11px 22px",
              background: snackbar.severity === "error" ? "#EF4444" : "#059669",
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