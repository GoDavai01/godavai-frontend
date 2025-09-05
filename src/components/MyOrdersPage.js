// src/components/MyOrdersPage.js
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ReceiptText,
  X,
} from "lucide-react";

import QuoteReviewModal from "./QuoteReviewModal";
import PrescriptionUploadModal from "./PrescriptionUploadModal";
import { useCart } from "../context/CartContext";

// shadcn/ui
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

// --- Rx helpers: open/download all attachments in one click ---
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
  // de-dupe
  return [...new Set(urls.filter(Boolean))];
}

async function openOrDownloadAllRx(order) {
  const urls = collectRxUrls(order);
  if (!urls.length) return;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];

    if (isSameOriginUrl(url)) {
      // Same-origin: safe to fetch as blob (no CORS noise)
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
        // if something odd happens, fall back to opening
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } else {
      // Cross-origin (e.g., S3): open without fetch -> no CORS errors
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // tiny delay helps some popup blockers treat all as user-initiated
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 120));
    }
  }
}


/* ------------------- utils (UNCHANGED LOGIC) ------------------- */
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
    return order.tempQuote.items
      .filter(i => i.available !== false)
      .reduce((a, b) => a + ((b.price || 0) * (b.quantity || 1)), 0);
  if (order.tempQuote && typeof order.tempQuote.approxPrice === "number")
    return order.tempQuote.approxPrice;
  if (order.quote && Array.isArray(order.quote.items) && order.quote.items.length)
    return order.quote.items
      .filter(i => i.available !== false)
      .reduce((a, b) => a + ((b.price || 0) * (b.quantity || 1)), 0);
  if (order.quote && typeof order.quote.price === "number")
    return order.quote.price;
  if (Array.isArray(order.quote) && order.quote.length)
    return order.quote
      .filter(i => i.available !== false)
      .reduce((a, b) => a + ((b.price || 0) * (b.quantity || 1)), 0);
  if (Array.isArray(order.quotes) && order.quotes.length && typeof order.quotes[order.quotes.length - 1]?.price === "number")
    return order.quotes[order.quotes.length - 1].price;
  if (order.tempQuote && Array.isArray(order.tempQuote.items))
    return order.tempQuote.items
      .filter(i => i.available !== false)
      .reduce((a, b) => a + ((b.price || 0) * (b.quantity || 1)), 0);
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

/* ------------------- component ------------------- */
export default function MyOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);

  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [pendingRejectOrderId, setPendingRejectOrderId] = useState(null);

  const prevOrdersRef = useRef([]);
  const { setCart, setSelectedPharmacy } = useCart();
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userId = user._id || user.userId;

  // PHARMACY REJECTION POPUP
  const [showPharmacyRejectionPopup, setShowPharmacyRejectionPopup] = useState(false);
  const [rejectedPrescriptionOrder, setRejectedPrescriptionOrder] = useState(null);
  const [reuploadModalOpen, setReuploadModalOpen] = useState(false);
  const [reuploadMode, setReuploadMode] = useState("manual");
  const [reuploadOrderData, setReuploadOrderData] = useState(null);

  // 1. Initial load spinner (logic unchanged)
  useEffect(() => {
    const fetchInitial = async () => {
      setLoading(true);
      await fetchOrders();
      setLoading(false);
    };
    fetchInitial();
    // eslint-disable-next-line
  }, [userId]);

  // 2. Poll (logic unchanged)
  useEffect(() => {
    const poll = setInterval(() => {
      fetchOrders();
    }, 15000);
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

  // Pharmacy rejected popup (logic unchanged)
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

  // Handlers (UNCHANGED LOGIC)
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
          name: i.medicineName,
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

  const groupedOrders = groupSplitOrders(orders);

  // Safety check (UNCHANGED)
  if (orders.length && (!orders[0] || typeof orders[0] !== "object" || Array.isArray(orders[0]))) {
    throw new Error("BUG: orders should be an array of objects. Got: " + JSON.stringify(orders[0]));
  }

  /* ------------------- view helpers (styling only) ------------------- */
  const Pill = ({ children, color = "emerald" }) => (
    <span className={`ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[13px] font-semibold bg-${color}-50 text-${color}-600`} >
      {children}
    </span>
  );

  // Renders as before (content/flow identical); just styled with Tailwind/shadcn
  const renderOrderCard = (o, splitBadge = null, uniqueKey = null) => (
    <Card key={uniqueKey || o._id} className="rounded-2xl border border-emerald-100 shadow-sm bg-white">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-[17px] font-extrabold text-emerald-700">
            {o.pharmacy?.name || o.pharmacy}
          </CardTitle>
          {o.orderType === "prescription" && (
            <span className="ml-1 text-[13px] font-bold text-amber-600">(Prescription)</span>
          )}
          <span className="ml-1 text-[13px] text-slate-600">
            {o.address?.area || o.address?.city || ""}
          </span>

          {!!splitBadge && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    className={`ml-2 max-w-[170px] truncate ${splitBadge.includes("Parent") ? "bg-blue-600 hover:bg-blue-600" : "bg-emerald-600 hover:bg-emerald-600"}`}
                  >
                    {splitBadge}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="text-sm">{splitBadge}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="text-[14px] text-slate-700 mb-1.5">
          Placed on: <b className="text-slate-900">{formatOrderDate(o.createdAt)}</b>
        </div>

        {/* PRESCRIPTION ORDER */}
        {o.orderType === "prescription" ? (
          <>
            <div className="text-[14px] mt-2">
  <b>Prescription:</b>{" "}
  {collectRxUrls(o).length ? (
    <a
      href={collectRxUrls(o)[0]}
      onClick={(e) => { e.preventDefault(); openOrDownloadAllRx(o); }}
      target="_blank"
      rel="noreferrer"
      className="text-blue-600 underline font-semibold"
      title="Open/Download all prescription files"
    >
      View
    </a>
  ) : (
    "Not Available"
  )}
</div>


            {(o.status === "quoted" || o.status === "pending_user_confirm") && (
              <div className="mt-3 mb-1.5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[15px] font-extrabold text-yellow-500">Quote Ready!</span>
                  <Button
                    size="sm"
                    className="ml-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow"
                    onClick={() => { setSelectedOrder(o); setQuoteModalOpen(true); }}
                  >
                    <ReceiptText className="mr-1 h-4 w-4" /> View Quote
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold">
                    Total Price: <span className="text-slate-900">₹{getTotalPrice(o)}</span>
                  </span>
                  {getQuoteType(o) === "full" && <Pill>All Available</Pill>}
                  {getQuoteType(o) === "partial" && <Pill color="amber">Partial Fulfillment</Pill>}
                </div>

                {getQuoteType(o) === "full" && (
                  <div className="mt-2 text-[13.7px] font-semibold text-emerald-700 bg-emerald-50 rounded-md px-2 py-1">
                    ✅ All medicines are available at this pharmacy. Tap <b>"Accept &amp; Pay"</b> to get your order delivered fast!
                  </div>
                )}
                {getQuoteType(o) === "partial" && (
                  <div className="mt-2 text-[13.3px] text-amber-600 bg-amber-50 rounded-md px-2 py-1">
                    Only some medicines are available. You can pay for available items, or wait/split the order.
                  </div>
                )}

                {o.quote && o.quote.items && o.quote.items.some(i => i.available === false) && (
                  <div className="mt-1 text-[13px] text-red-600">
                    Unavailable: {o.quote.items.filter(i => i.available === false).map(i => i.medicineName).join(", ")}
                  </div>
                )}

                {o.status === "pending_user_confirm" && (
                  <div className="mt-3">
                    <div className="flex flex-col gap-2">
                      <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl py-3 shadow"
                        disabled={rejectSubmitting}
                        onClick={() => handleAcceptAndPay(o)}
                      >
                        ACCEPT &amp; PAY
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full border-2 border-red-500 text-red-600 bg-white hover:bg-red-50 font-extrabold rounded-xl py-2.5"
                        disabled={rejectSubmitting}
                        onClick={() => {
                          setRejectDialogOpen(true);
                          setPendingRejectOrderId(o._id);
                          setRejectReason("");
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-2 text-[15px] font-extrabold text-blue-600">
              Status: <span className="ml-1 capitalize text-slate-900 font-bold">{o.status}</span>
            </div>
          </>
        ) : (
          <>
            <div className="text-[15px] font-bold mb-1">
              Items:
              <span className="font-normal ml-1">
                {o.items ? o.items.map(i => `${i.name || i.medicineName} (${i.quantity || i.qty || "-"})`).join(", ") : ""}
              </span>
            </div>
            <div className="text-[15px] text-slate-900">
              <b>Total Price:</b> ₹{o.total}
            </div>
          </>
        )}

        <div className="text-[14px] text-slate-900 mt-1">
          <b>Address:</b> {getDisplayAddress(o.address)}
        </div>

        <div className="mt-2 flex items-center">
          {o.orderType !== "prescription" && (
            <div className="text-[15px] font-bold text-blue-600 mr-2">
              {o.status === "quoted" ? (
                <span className="text-yellow-500">
                  Quote Ready!
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2 rounded-lg font-semibold"
                    onClick={() => { setSelectedOrder(o); setQuoteModalOpen(true); }}
                  >
                    View &amp; Accept/Reject
                  </Button>
                </span>
              ) : (
                <>
                  Status:{" "}
                  <span className="ml-1 capitalize text-slate-900 font-bold">{o.status || "Placed"}</span>
                </>
              )}
            </div>
          )}

          <Button
            size="sm"
            className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow"
            onClick={() => handleOrderAgain(o)}
          >
            Order Again
          </Button>
        </div>

        {/* Invoice button */}
        {o.invoiceFile && (
          <a
            href={o.invoiceFile}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 no-underline"
          >
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg font-bold text-blue-700 border-blue-700"
            >
              <ReceiptText className="mr-1 h-4 w-4" />
              Download Invoice
            </Button>
          </a>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-12 pt-3">
      <div className="mx-auto w-full max-w-[480px] px-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 mt-1 mb-3">My Orders</h1>

        {loading ? (
          <div className="text-slate-500">Loading...</div>
        ) : groupSplitOrders(orders).length === 0 ? (
          <div className="text-slate-500">No orders yet.</div>
        ) : (
          <div className="space-y-3">
            {groupSplitOrders(orders).map((order) => {
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

        {/* Reject dialog (same logic, shadcn UI) */}
        <Dialog
          open={rejectDialogOpen}
          onOpenChange={(open) => {
            if (!open) { setRejectDialogOpen(false); setRejectReason(""); }
          }}
        >
          <DialogContent className="force-light">
            <DialogHeader>
              <DialogTitle>Reject Order</DialogTitle>
            </DialogHeader>
            <div className="mb-2 text-slate-700">Please provide a reason for rejecting this order:</div>
            <textarea
              className="w-full min-h-[72px] rounded-md border border-red-500 p-2 text-[16px] text-slate-900 outline-none focus:ring-2 focus:ring-red-400"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Enter reason (required)"
              disabled={rejectSubmitting}
            />
            <DialogFooter>
              <Button
                variant="ghost"
                className="btn-ghost-soft"
                onClick={() => setRejectDialogOpen(false)}
                disabled={rejectSubmitting}
              >
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

        {/* Pharmacy Rejection Popup */}
        <Dialog open={showPharmacyRejectionPopup} onOpenChange={handleClosePharmacyRejectionPopup}>
          <DialogContent className="max-w-sm force-light">
            <div className="flex items-center justify-between pb-1">
              <DialogTitle className="text-lg font-extrabold">Pharmacy Rejected Your Prescription</DialogTitle>
              <Button variant="ghost" size="icon" onClick={handleClosePharmacyRejectionPopup} className="text-slate-500 hover:text-slate-700">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="text-slate-700">
              The pharmacy you selected couldn't fulfill your prescription.
              <br />
              What would you like to do next?
            </div>
            <div className="mt-4 space-y-2">
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl"
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

        {/* Reupload Prescription Modal (unchanged) */}
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

        {/* Quote Review Modal (unchanged) */}
        <QuoteReviewModal
          open={quoteModalOpen}
          order={selectedOrder}
          onClose={() => setQuoteModalOpen(false)}
          onAccept={() => handleAcceptAndPay(selectedOrder)}
        />

        {/* Snackbar (Tailwind + framer-motion) */}
        <AnimatePresence>
          {snackbar.open && (
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              onAnimationComplete={() => setTimeout(() => setSnackbar((s) => ({ ...s, open: false })), 2200)}
              className={`fixed top-4 left-1/2 -translate-x-1/2 z-[2000] rounded-full px-4 py-2 text-white shadow-lg
              ${snackbar.severity === "error" ? "bg-red-600" :
                snackbar.severity === "info" ? "bg-emerald-800" : "bg-emerald-600"}`}
            >
              {snackbar.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
