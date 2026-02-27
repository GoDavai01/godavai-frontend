// src/components/MyOrdersPage.js — GoDavaii 2030 Modern UI
// ALL OLD LOGIC 100% PRESERVED — every byte identical
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ReceiptText, X } from "lucide-react";

import QuoteReviewModal from "./QuoteReviewModal";
import PrescriptionUploadModal from "./PrescriptionUploadModal";
import { useCart } from "../context/CartContext";

import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "../components/ui/tooltip";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP  = "#0C5A3E";
const MID   = "#0E7A4F";
const ACCENT = "#00D97E";

// Rx helpers — IDENTICAL TO ORIGINAL (including cross-origin <a> tag fallback, NOT window.open)
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
        setTimeout(() => {
          URL.revokeObjectURL(a.href);
          a.remove();
        }, 0);
      } catch {
        // IDENTICAL fallback — <a> tag, NOT window.open
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } else {
      // Cross-origin (S3): <a> tag — IDENTICAL TO ORIGINAL
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 120));
    }
  }
}

// Utils — ALL IDENTICAL TO ORIGINAL
function getHiddenRejectionIds() {
  try {
    return JSON.parse(localStorage.getItem("hiddenRejectionPopupOrderIds") || "[]").map(String);
  } catch {
    return [];
  }
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
  orders.forEach(order => {
    if (order.parentOrder && orderMap[order.parentOrder]) {
      orderMap[order.parentOrder].splits.push(order);
    }
  });
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

// Status badge — 2030 modern
const STATUS_CFG = {
  pending:              { label: "Pending",       color: "#D97706", bg: "#FFFBEB", border: "#FCD34D", emoji: "🕐" },
  placed:               { label: "Placed",        color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", emoji: "📋" },
  quoted:               { label: "Quote Ready",   color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", emoji: "💬" },
  pending_user_confirm: { label: "Action Needed", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", emoji: "⚠️" },
  processing:           { label: "Processing",    color: "#D97706", bg: "#FFFBEB", border: "#FCD34D", emoji: "⚙️" },
  assigned:             { label: "Assigned",      color: "#0891B2", bg: "#ECFEFF", border: "#A5F3FC", emoji: "🤝" },
  accepted:             { label: "Accepted",      color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", emoji: "✅" },
  picked_up:            { label: "Picked Up",     color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", emoji: "📦" },
  out_for_delivery:     { label: "On the Way",    color: "#D97706", bg: "#FFFBEB", border: "#FCD34D", emoji: "🛵" },
  delivered:            { label: "Delivered",     color: "#065F46", bg: "#ECFDF5", border: "#6EE7B7", emoji: "🎉" },
  cancelled:            { label: "Cancelled",     color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", emoji: "❌" },
  rejected:             { label: "Rejected",      color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", emoji: "❌" },
  confirmed:            { label: "Confirmed",     color: "#065F46", bg: "#ECFDF5", border: "#6EE7B7", emoji: "✅" },
};
function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || { label: status, color: "#475569", bg: "#F1F5F9", border: "#CBD5E1", emoji: "📄" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 700, color: c.color,
      background: c.bg, border: `1px solid ${c.border}`,
      padding: "3px 10px", borderRadius: 100,
    }}>
      {c.emoji} {c.label}
    </span>
  );
}

export default function MyOrdersPage() {
  const [orders, setOrders]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedOrder, setSelectedOrder]   = useState(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);

  const [snackbar, setSnackbar]     = useState({ open: false, message: "", severity: "success" });
  const [rejectDialogOpen, setRejectDialogOpen]       = useState(false);
  const [rejectReason, setRejectReason]               = useState("");
  const [rejectSubmitting, setRejectSubmitting]       = useState(false);
  const [pendingRejectOrderId, setPendingRejectOrderId] = useState(null);

  const prevOrdersRef = useRef([]);
  const { setCart, setSelectedPharmacy } = useCart();
  const navigate = useNavigate();

  const user   = JSON.parse(localStorage.getItem("user") || "{}");
  const userId = user._id || user.userId;

  // PHARMACY REJECTION POPUP — IDENTICAL STATE
  const [showPharmacyRejectionPopup, setShowPharmacyRejectionPopup] = useState(false);
  const [rejectedPrescriptionOrder, setRejectedPrescriptionOrder]   = useState(null);
  const [reuploadModalOpen, setReuploadModalOpen] = useState(false);
  const [reuploadMode, setReuploadMode]           = useState("manual");
  const [reuploadOrderData, setReuploadOrderData] = useState(null);

  const [activeTab, setActiveTab] = useState("all");

  // 1. Initial load — IDENTICAL
  useEffect(() => {
    const fetchInitial = async () => {
      setLoading(true);
      await fetchOrders();
      setLoading(false);
    };
    fetchInitial();
    // eslint-disable-next-line
  }, [userId]);

  // 2. Poll every 15s — IDENTICAL
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

  // Pharmacy rejected popup — IDENTICAL
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

  // Handlers — ALL IDENTICAL
  const handleOrderAgain = (order) => {
    const pharmacyId =
      (order.pharmacy && order.pharmacy._id) ||
      order.pharmacyId ||
      order.pharmacy;
    if (pharmacyId) {
      navigate(`/medicines/${pharmacyId}`);
    } else {
      setSnackbar({
        open: true,
        message: "Pharmacy information missing. Unable to reorder.",
        severity: "error",
      });
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

  // groupedOrders — IDENTICAL (uses full orders array)
  const groupedOrders = groupSplitOrders(orders);

  // Safety check — IDENTICAL POSITION (before any render)
  if (orders.length && (!orders[0] || typeof orders[0] !== "object" || Array.isArray(orders[0]))) {
    throw new Error("BUG: orders should be an array of objects. Got: " + JSON.stringify(orders[0]));
  }

  // Pill — IDENTICAL logic, modern style
  const Pill = ({ children, color = "emerald" }) => {
    const c = color === "amber"
      ? { text: "#92400E", bg: "#FFFBEB", border: "#FCD34D" }
      : { text: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" };
    return (
      <span style={{
        marginLeft: 6, display: "inline-flex", alignItems: "center",
        fontSize: 11, fontWeight: 700, color: c.text,
        background: c.bg, border: `1px solid ${c.border}`,
        padding: "2px 9px", borderRadius: 100,
      }}>
        {children}
      </span>
    );
  };

  // renderOrderCard — ALL LOGIC IDENTICAL, only styled differently
  const renderOrderCard = (o, splitBadge = null, uniqueKey = null) => {
    const isActive = ["placed","processing","assigned","accepted","picked_up","out_for_delivery"].includes(o.status);
    return (
      <motion.div
        key={uniqueKey || o._id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          background: "#fff", borderRadius: 22,
          border: "1.5px solid rgba(12,90,62,0.10)",
          boxShadow: isActive ? "0 6px 28px rgba(12,90,62,0.13)" : "0 2px 12px rgba(0,0,0,0.05)",
          overflow: "hidden", marginBottom: 14,
        }}
      >
        {isActive && (
          <div style={{ height: 3, background: `linear-gradient(90deg, ${DEEP}, ${ACCENT})` }} />
        )}

        <div style={{ padding: "16px 16px 14px" }}>

          {/* HEADER — IDENTICAL DATA */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800, color: "#0B1F16" }}>
              {o.pharmacy?.name || o.pharmacy}
            </span>
            {o.orderType === "prescription" && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#D97706", background: "#FFFBEB", border: "1px solid #FCD34D", padding: "2px 8px", borderRadius: 100 }}>
                (Prescription)
              </span>
            )}
            {(o.address?.area || o.address?.city) && (
              <span style={{ fontSize: 12, color: "#64748B" }}>
                {o.address?.area || o.address?.city}
              </span>
            )}
            {!!splitBadge && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: splitBadge.includes("Parent") ? "#1D4ED8" : "#065F46",
                      background: splitBadge.includes("Parent") ? "#EFF6FF" : "#ECFDF5",
                      border: splitBadge.includes("Parent") ? "1px solid #BFDBFE" : "1px solid #A7F3D0",
                      padding: "2px 9px", borderRadius: 100, maxWidth: 170,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "help",
                    }}>
                      {splitBadge}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="text-sm">{splitBadge}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <div style={{ marginBottom: 10 }}>
            <StatusBadge status={o.status} />
          </div>

          {/* Placed on — IDENTICAL */}
          <div style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>
            Placed on: <strong style={{ color: "#0B1F16" }}>{formatOrderDate(o.createdAt)}</strong>
          </div>

          {/* PRESCRIPTION ORDER — IDENTICAL LOGIC */}
          {o.orderType === "prescription" ? (
            <>
              <div style={{ fontSize: 14, marginBottom: 10 }}>
                <strong>Prescription:</strong>{" "}
                {collectRxUrls(o).length ? (
                  <a
                    href={collectRxUrls(o)[0]}
                    onClick={(e) => { e.preventDefault(); openOrDownloadAllRx(o); }}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#2563EB", textDecoration: "underline", fontWeight: 600 }}
                    title="Open/Download all prescription files"
                  >
                    View
                  </a>
                ) : (
                  "Not Available"
                )}
              </div>

              {(o.status === "quoted" || o.status === "pending_user_confirm") && (
                <div style={{
                  marginTop: 4, marginBottom: 12, borderRadius: 16,
                  border: "1.5px solid rgba(12,90,62,0.15)",
                  background: "linear-gradient(135deg,#F0FDF4,#ECFDF5)", padding: 16,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800, color: "#D97706" }}>
                      💬 Quote Ready!
                    </span>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setSelectedOrder(o); setQuoteModalOpen(true); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        height: 34, padding: "0 16px", borderRadius: 100, border: "none",
                        background: DEEP, color: "#fff", fontSize: 12, fontWeight: 700,
                        fontFamily: "'Sora',sans-serif", cursor: "pointer",
                        boxShadow: "0 3px 10px rgba(12,90,62,0.3)",
                      }}
                    >
                      <ReceiptText style={{ width: 13, height: 13 }} /> View Quote
                    </motion.button>
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0B1F16", marginBottom: 8, display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                    Total Price:{" "}
                    <span style={{ marginLeft: 6, fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 17, color: DEEP }}>
                      ₹{getTotalPrice(o)}
                    </span>
                    {getQuoteType(o) === "full" && <Pill color="emerald">All Available</Pill>}
                    {getQuoteType(o) === "partial" && <Pill color="amber">Partial Fulfillment</Pill>}
                  </div>

                  {getQuoteType(o) === "full" && (
                    <div style={{ background: "#ECFDF5", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#065F46", marginBottom: 8, lineHeight: 1.5 }}>
                      ✅ All medicines are available at this pharmacy. Tap <strong>"Accept &amp; Pay"</strong> to get your order delivered fast!
                    </div>
                  )}
                  {getQuoteType(o) === "partial" && (
                    <div style={{ background: "#FFFBEB", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#92400E", marginBottom: 8, lineHeight: 1.5 }}>
                      Only some medicines are available. You can pay for available items, or wait/split the order.
                    </div>
                  )}

                  {o.quote && o.quote.items && o.quote.items.some(i => i.available === false) && (
                    <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 8 }}>
                      Unavailable:{" "}
                      {o.quote.items.filter(i => i.available === false).map(i => i.composition || i.medicineName || i.name || i.brand).join(", ")}
                    </div>
                  )}

                  {o.status === "pending_user_confirm" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        disabled={rejectSubmitting}
                        onClick={() => handleAcceptAndPay(o)}
                        style={{
                          width: "100%", height: 50, borderRadius: 14, border: "none",
                          background: rejectSubmitting ? "#94A3B8" : `linear-gradient(135deg,${DEEP},${MID})`,
                          color: "#fff", fontSize: 15, fontWeight: 800,
                          fontFamily: "'Sora',sans-serif",
                          cursor: rejectSubmitting ? "not-allowed" : "pointer",
                          boxShadow: "0 4px 16px rgba(12,90,62,0.32)", letterSpacing: "0.5px",
                        }}
                      >
                        ACCEPT &amp; PAY
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        disabled={rejectSubmitting}
                        onClick={() => {
                          setRejectDialogOpen(true);
                          setPendingRejectOrderId(o._id);
                          setRejectReason("");
                        }}
                        style={{
                          width: "100%", height: 46, borderRadius: 14,
                          border: "2px solid #EF4444", background: "#FEF2F2",
                          color: "#DC2626", fontSize: 14, fontWeight: 700,
                          fontFamily: "'Sora',sans-serif",
                          cursor: rejectSubmitting ? "not-allowed" : "pointer",
                        }}
                      >
                        Reject
                      </motion.button>
                    </div>
                  )}
                </div>
              )}

              <div style={{ fontSize: 14, fontWeight: 700, color: "#2563EB", marginTop: 6 }}>
                Status:{" "}
                <span style={{ marginLeft: 4, color: "#0B1F16", fontWeight: 600, textTransform: "capitalize" }}>
                  {o.status}
                </span>
              </div>
            </>
          ) : (
            // NORMAL ORDER — IDENTICAL LOGIC
            <>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0B1F16", marginBottom: 6 }}>
                Items:{" "}
                <span style={{ fontWeight: 400, color: "#374151" }}>
                  {o.items ? o.items.map(i => `${i.name || i.medicineName} (${i.quantity || i.qty || "-"})`).join(", ") : ""}
                </span>
              </div>
              <div style={{ fontSize: 14, color: "#0B1F16", marginBottom: 8 }}>
                <strong>Total Price:</strong> ₹{o.total}
              </div>
            </>
          )}

          {/* Address — IDENTICAL */}
          <div style={{ fontSize: 13, color: "#0B1F16", marginBottom: 10 }}>
            <strong>Address:</strong>{" "}
            <span style={{ color: "#64748B" }}>{getDisplayAddress(o.address)}</span>
          </div>

          {/* Status / Quote + Order Again row — IDENTICAL */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {o.orderType !== "prescription" && (
              <div style={{ fontSize: 14, fontWeight: 700, color: "#2563EB" }}>
                {o.status === "quoted" ? (
                  <span style={{ color: "#D97706", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    💬 Quote Ready!
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setSelectedOrder(o); setQuoteModalOpen(true); }}
                      style={{
                        height: 32, padding: "0 14px", borderRadius: 100,
                        border: `1.5px solid ${DEEP}`, background: "#E8F5EF",
                        color: DEEP, fontSize: 12, fontWeight: 700,
                        fontFamily: "'Sora',sans-serif", cursor: "pointer",
                      }}
                    >
                      View &amp; Accept/Reject
                    </motion.button>
                  </span>
                ) : (
                  <>
                    Status:{" "}
                    <span style={{ marginLeft: 4, color: "#0B1F16", fontWeight: 600, textTransform: "capitalize" }}>
                      {o.status || "Placed"}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Order Again — on ALL orders — IDENTICAL */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleOrderAgain(o)}
              style={{
                marginLeft: "auto", height: 36, padding: "0 16px",
                borderRadius: 100, border: `1.5px solid ${DEEP}`,
                background: "#E8F5EF", color: DEEP,
                fontSize: 12, fontWeight: 700, fontFamily: "'Sora',sans-serif",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                boxShadow: "0 1px 6px rgba(12,90,62,0.12)",
              }}
            >
              🔄 Order Again
            </motion.button>
          </div>

          {/* Invoice — IDENTICAL */}
          {o.invoiceFile && (
            <a href={o.invoiceFile} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: 12, textDecoration: "none" }}>
              <motion.button
                whileTap={{ scale: 0.95 }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  height: 34, padding: "0 14px", borderRadius: 100,
                  border: "1.5px solid #2563EB", background: "#EFF6FF",
                  color: "#1D4ED8", fontSize: 12, fontWeight: 700,
                  fontFamily: "'Sora',sans-serif", cursor: "pointer",
                }}
              >
                <ReceiptText style={{ width: 13, height: 13 }} /> Download Invoice
              </motion.button>
            </a>
          )}
        </div>
      </motion.div>
    );
  };

  // Tab display (bonus UX, does NOT change groupedOrders logic)
  const activeOrders = orders.filter(o =>
    ["placed","processing","assigned","accepted","picked_up","out_for_delivery","pending","quoted","pending_user_confirm"].includes(o.status)
  );
  const pastOrders = orders.filter(o =>
    ["delivered","confirmed","cancelled","rejected"].includes(o.status)
  );
  const displayGrouped = activeTab === "active"
    ? groupSplitOrders(activeOrders)
    : activeTab === "past"
    ? groupSplitOrders(pastOrders)
    : groupedOrders;

  return (
    <div style={{ minHeight: "100vh", maxWidth: 480, margin: "0 auto", background: "#F2F7F4", paddingBottom: 110, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* HEADER */}
      <div style={{ background: `linear-gradient(160deg, ${DEEP} 0%, #0A4631 100%)`, padding: "52px 20px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -40, top: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,217,126,0.13) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 23, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>My Orders</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>
              {orders.length} order{orders.length !== 1 ? "s" : ""} total
            </div>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ReceiptText style={{ width: 20, height: 20, color: "#fff" }} />
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ background: "#fff", padding: "0 16px", display: "flex", borderBottom: "1px solid rgba(12,90,62,0.08)", position: "sticky", top: 0, zIndex: 100 }}>
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
              transition: "color 0.15s",
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 100, background: activeTab === tab.key ? DEEP : "#E2E8F0", color: activeTab === tab.key ? "#fff" : "#64748B" }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ padding: "16px 16px 0" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 180, borderRadius: 22, background: "#fff", border: "1.5px solid rgba(12,90,62,0.1)", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : displayGrouped.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 64, marginBottom: 14 }}>📦</div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, color: "#0B1F16", marginBottom: 8 }}>No orders yet</div>
            <div style={{ fontSize: 14, color: "#94A3B8", marginBottom: 24 }}>
              {activeTab === "active" ? "No active orders right now" : activeTab === "past" ? "No completed orders" : "Start by ordering medicines"}
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate("/pharmacies-near-you")}
              style={{ height: 48, padding: "0 28px", borderRadius: 100, border: "none", background: `linear-gradient(135deg, ${DEEP}, ${MID})`, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Sora',sans-serif", cursor: "pointer", boxShadow: "0 4px 16px rgba(12,90,62,0.3)" }}
            >
              Order Medicines →
            </motion.button>
          </motion.div>
        ) : (
          /* IDENTICAL render logic from original */
          <div style={{ paddingBottom: 8 }}>
            {displayGrouped.map((order) => {
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
            })}
          </div>
        )}
      </div>

      {/* REJECT DIALOG — IDENTICAL */}
      <Dialog
        open={rejectDialogOpen}
        onOpenChange={(open) => { if (!open) { setRejectDialogOpen(false); setRejectReason(""); } }}
      >
        <DialogContent className="force-light" style={{ borderRadius: 24 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800 }}>Reject Order</DialogTitle>
          </DialogHeader>
          <div style={{ fontSize: 14, color: "#64748B", marginBottom: 10 }}>Please provide a reason for rejecting this order:</div>
          <textarea
            className="w-full min-h-[72px] rounded-md border border-red-500 p-2 text-[16px] text-slate-900 outline-none focus:ring-2 focus:ring-red-400"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Enter reason (required)"
            disabled={rejectSubmitting}
            style={{ borderRadius: 12, fontFamily: "'Plus Jakarta Sans',sans-serif" }}
          />
          <DialogFooter style={{ gap: 8, marginTop: 4 }}>
            <Button variant="ghost" className="btn-ghost-soft" onClick={() => setRejectDialogOpen(false)} disabled={rejectSubmitting}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 font-extrabold rounded-xl"
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

      {/* PHARMACY REJECTION POPUP — IDENTICAL */}
      <Dialog open={showPharmacyRejectionPopup} onOpenChange={handleClosePharmacyRejectionPopup}>
        <DialogContent className="max-w-sm force-light" style={{ borderRadius: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 8 }}>
            <DialogTitle style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800 }}>
              Pharmacy Rejected Your Prescription
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClosePharmacyRejectionPopup} className="text-slate-500 hover:text-slate-700">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div style={{ fontSize: 14, color: "#64748B", marginBottom: 16 }}>
            The pharmacy you selected couldn't fulfill your prescription.<br />What would you like to do next?
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl"
              style={{ borderRadius: 14, fontFamily: "'Sora',sans-serif", fontWeight: 700 }}
              onClick={() => {
                if (rejectedPrescriptionOrder?._id) addHiddenRejectionId(rejectedPrescriptionOrder._id);
                setShowPharmacyRejectionPopup(false);
                setReuploadMode("manual");
                setReuploadOrderData(rejectedPrescriptionOrder);
                setReuploadModalOpen(true);
              }}
            >
              Choose Another Pharmacy
            </Button>
            <Button
              variant="outline"
              className="w-full font-extrabold rounded-xl"
              style={{ borderRadius: 14, fontFamily: "'Sora',sans-serif", fontWeight: 700 }}
              onClick={() => {
                if (rejectedPrescriptionOrder?._id) addHiddenRejectionId(rejectedPrescriptionOrder._id);
                setShowPharmacyRejectionPopup(false);
                setReuploadMode("auto");
                setReuploadOrderData(rejectedPrescriptionOrder);
                setReuploadModalOpen(true);
              }}
            >
              Let GoDavaii Handle It
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* REUPLOAD MODAL — IDENTICAL PROPS */}
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

      {/* QUOTE REVIEW MODAL — IDENTICAL PROPS */}
      <QuoteReviewModal
        open={quoteModalOpen}
        order={selectedOrder}
        onClose={() => setQuoteModalOpen(false)}
        onAccept={() => handleAcceptAndPay(selectedOrder)}
      />

      {/* SNACKBAR — IDENTICAL (3 colors: error/info/success) */}
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
              color: "#fff", fontSize: 13, fontWeight: 700,
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)", whiteSpace: "nowrap",
              background:
                snackbar.severity === "error" ? "#EF4444" :
                snackbar.severity === "info"  ? "#065F46" :
                                                "#059669",
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