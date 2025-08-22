// src/components/OrderTracking.js
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { motion, AnimatePresence } from "framer-motion";

// shadcn/ui
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";

// Icons (lucide-react)
import {
  ShoppingCart,
  Store,
  Bike,
  CheckCheck,
  MessageCircle,
  Phone,
  Smile,
  Headset,
  FileText,
  Timer,
  Star,
} from "lucide-react";

// External modals you already have
import ChatModal from "./ChatModal";
import ChatSupportModal from "./ChatSupportModal";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Palette
const DEEP = "#0f6e51";
const AMBER = "#FFD43B";

const steps = [
  { label: "Order Placed", icon: ShoppingCart },
  { label: "Processing", icon: Store },
  { label: "Out for Delivery", icon: Bike },
  { label: "Delivered", icon: CheckCheck },
];

// ---------- helpers (UNCHANGED LOGIC) ----------
function formatAddress(address) {
  if (!address) return "";
  if (typeof address === "object") {
    if (address.formatted) {
      return `${address.name ? address.name + ", " : ""}${address.formatted}${address.floor ? ", Floor: " + address.floor : ""}${address.landmark ? ", " + address.landmark : ""}${address.phone ? ", " + address.phone : ""}`;
    }
    return `${address.name || ""}, ${address.addressLine || ""}${address.floor ? ", Floor: " + address.floor : ""}${address.landmark ? ", " + address.landmark : ""}, ${address.phone || ""}`;
  }
  return address;
}

function formatTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// simple inline toast
function InlineToast({ open, kind = "success", children, onClose }) {
  if (!open) return null;
  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[1200] rounded-xl px-4 py-3 text-sm font-semibold shadow-lg
      ${kind === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"}`}
      onClick={onClose}
    >
      {children}
    </div>
  );
}

// Clickable star rating (controlled)
function Stars({ value = 0, onChange, disabled }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange && onChange(n)}
          className="disabled:cursor-not-allowed"
        >
          <Star
            className={`h-5 w-5 ${n <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
          />
        </button>
      ))}
    </div>
  );
}

export default function OrderTracking() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const [quoteDialog, setQuoteDialog] = useState(false);
  const [quoteActionLoading, setQuoteActionLoading] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatThread, setChatThread] = useState(null);
  const [chatPartner, setChatPartner] = useState({ name: "", type: "" });

  const [supportChatOpen, setSupportChatOpen] = useState(false);

  const [eta, setEta] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  const [pharmacyRating, setPharmacyRating] = useState(null);
  const [deliveryRating, setDeliveryRating] = useState(null);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [deliveryBehavior, setDeliveryBehavior] = useState([]);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const [deliveryUnreadCount, setDeliveryUnreadCount] = useState(0);
  const getToken = () => localStorage.getItem("token") || "";

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || "",
  });

  // --- INITIAL LOAD (UNCHANGED LOGIC) ---
  useEffect(() => {
    let didCancel = false;
    setLoading(true);
    axios
      .get(`${API_BASE_URL}/api/orders/${orderId}`)
      .then((res) => {
        if (didCancel) return;
        setOrder({ ...res.data, __type: "order" });
        setLoading(false);

        if (res.data.deliveryRating && res.data.pharmacyRating && res.data.deliveryBehavior) {
          setFeedbackSubmitted(true);
        }
        if (res.data.deliveryRating) setDeliveryRating(res.data.deliveryRating);
        if (res.data.pharmacyRating) setPharmacyRating(res.data.pharmacyRating);
      })
      .catch(() => {
        if (didCancel) return;
        axios
          .get(`${API_BASE_URL}/api/prescriptions/order/${orderId}`, {
            headers: { Authorization: `Bearer ${getToken()}` },
          })
          .then((res) => {
            if (didCancel) return;
            setOrder({ ...res.data, __type: "prescription" });
            setLoading(false);
          })
          .catch(() => {
            if (didCancel) return;
            setOrder(null);
            setLoading(false);
          });
      });
    return () => {
      didCancel = true;
    };
  }, [orderId, quoteActionLoading]);

  // --- POLLING (UNCHANGED LOGIC) ---
  useEffect(() => {
    if (!order || order.status === "rejected" || order.status === "cancelled") return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/orders/${orderId}`);
        if (!cancelled) {
          setOrder((prev) => {
            if (!prev || prev.updatedAt !== res.data.updatedAt || prev.status !== res.data.status) {
              return { ...res.data, __type: "order" };
            }
            return prev;
          });
        }
      } catch {}
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, order && order.status]);

  // delivery unread count
  useEffect(() => {
    if (!order) return;
    axios
      .get(`${API_BASE_URL}/api/chat/${order._id}/delivery-unread-count`, { withCredentials: true })
      .then((res) => setDeliveryUnreadCount(res.data.unreadCount || 0))
      .catch(() => setDeliveryUnreadCount(0));
  }, [order, refreshTick, chatOpen]);

  // ETA (UNCHANGED LOGIC)
  useEffect(() => {
    let interval;
    const fetchETA = async () => {
      if (order && order.driverLocation && order.address && order.status === "out_for_delivery") {
        try {
          const res = await axios.get(`${API_BASE_URL}/api/orders/${order._id}/eta`);
          setEta(res.data.eta || "N/A");
        } catch {
          setEta("N/A");
        }
      } else {
        setEta("");
      }
    };
    fetchETA();
    interval = setInterval(fetchETA, 3000);
    return () => clearInterval(interval);
  }, [order]);

  // quote modal controller
  useEffect(() => {
    if (order && order.status === "quoted") setQuoteDialog(true);
    else setQuoteDialog(false);
  }, [order]);

  // clear active order on delivered/cancelled
  useEffect(() => {
    if (order && (order.status === "delivered" || order.status === "cancelled")) {
      localStorage.removeItem("activeOrderId");
    }
  }, [order]);

  const handleAcceptQuote = async () => {
    setQuoteActionLoading(true);
    await axios.post(`${API_BASE_URL}/api/orders/${order._id}/accept`);
    setQuoteActionLoading(false);
    setQuoteDialog(false);
    window.location.reload();
  };

  const handleRejectQuote = async () => {
    setQuoteActionLoading(true);
    await axios.put(`${API_BASE_URL}/api/orders/${order._id}/status`, {
      status: "rejected",
      statusText: "Rejected by User",
    });
    setQuoteActionLoading(false);
    setQuoteDialog(false);
    window.location.reload();
  };

  const handleRatingSubmit = async () => {
    setRatingSubmitting(true);
    try {
      await axios.post(`${API_BASE_URL}/api/orders/${order._id}/ratings`, {
        pharmacyRating,
        deliveryRating,
        deliveryBehavior,
      });
      setSnackbarMsg("Feedback submitted successfully!");
      setSnackbarOpen(true);
      setFeedbackSubmitted(true);
      if (order && order.status === "delivered") {
        localStorage.removeItem("activeOrderId");
      }
    } catch (e) {
      setSnackbarMsg("Failed to submit feedback!");
      setSnackbarOpen(true);
    }
    setRatingSubmitting(false);
  };

  const handleOpenDeliveryChat = () => {
    setChatPartner({
      name: (order?.deliveryPartner && order.deliveryPartner.name) || "Delivery Partner",
      type: "delivery",
    });
    setChatThread("delivery");
    setChatOpen(true);
    axios.patch(`${API_BASE_URL}/api/chat/${order._id}/delivery-chat-seen`, {}, { withCredentials: true });
    setDeliveryUnreadCount(0);
  };

  if (loading)
    return (
      <div className="w-full min-h-[70vh] grid place-items-center">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-lg font-extrabold"
          style={{ color: "#13C0A2" }}
        >
          Loading…
        </motion.div>
      </div>
    );

  if (!order)
    return (
      <div className="mt-16 text-center">
        <div className="text-red-600 font-semibold">Order not found</div>
        <Button
          className="mt-3 font-bold"
          style={{ backgroundColor: "#13C0A2", color: "#fff" }}
          onClick={() => navigate("/orders")}
        >
          Go to My Orders
        </Button>
      </div>
    );

  if (order.status === "rejected" || order.status === "cancelled") {
    localStorage.setItem(`order:${order._id}:cancelSeen`, "true");
    return (
      <div className="mt-16 text-center">
        <div className="text-red-600 font-semibold">
          This order was {order.status === "rejected" ? "rejected" : "cancelled"} by the pharmacy.
        </div>
        <Button
          className="mt-3 font-bold"
          style={{ backgroundColor: "#13C0A2", color: "#fff" }}
          onClick={() => navigate("/orders")}
        >
          Go to My Orders
        </Button>
      </div>
    );
  }

  const currentStep =
    typeof order.status === "number"
      ? order.status
      : order.status === "placed"
      ? 0
      : order.status === "processing"
      ? 1
      : order.status === "out_for_delivery"
      ? 2
      : order.status === "delivered"
      ? 3
      : order.status === "rejected" || order.status === "cancelled"
      ? -1
      : 0;

  const isDelivered = currentStep === 3;

  const stepTimes = [order.placedAt || order.createdAt, order.processingAt, order.outForDeliveryAt, order.deliveredAt];

  const deliveryPartner =
    order.deliveryPartner && typeof order.deliveryPartner === "object"
      ? order.deliveryPartner
      : {
          name: "Delivery Partner",
          avatar: "/images/delivery-partner.png",
          rating: 4.7,
          phone: "******0000",
          vehicle: "Bike",
        };

  // ------ PRESCRIPTION QUOTE LOGIC (UNCHANGED) ------
  let prescriptionQuote = null;
  if (order.__type === "prescription") {
    if (order.quote?.items?.length > 0) {
      prescriptionQuote = order.quote;
    } else if (order.tempQuote?.items?.length > 0) {
      prescriptionQuote = {
        ...order.tempQuote,
        price: order.tempQuote.approxPrice,
        items: order.tempQuote.items,
      };
    } else if (Array.isArray(order.quotes) && order.quotes.length > 0) {
      prescriptionQuote = order.quotes[order.quotes.length - 1];
    }
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-24 pt-3">
      <div className="max-w-md mx-auto px-2 sm:px-4">
        <Card className="border-emerald-100/70 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            {/* Title + ETA */}
            <div className="text-center mb-3">
              <h1
                className="text-2xl font-black tracking-tight"
                style={{ color: "#13C0A2" }}
              >
                Track Your Order
              </h1>

              {eta && order.status === "out_for_delivery" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 mt-2 text-sm font-extrabold shadow"
                  style={{ backgroundColor: AMBER, color: "#1d4335" }}
                >
                  <Timer className="h-4 w-4" />
                  Arriving in {eta}
                </motion.div>
              )}

              <div className="mt-2 flex items-center justify-center gap-2">
                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[13px]">
                  Order #{order.id || order._id?.slice(-5)}
                </Badge>
                <Badge
                  className={`font-bold text-[13px] ${isDelivered ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700"}`}
                >
                  {order.statusText || steps[currentStep]?.label}
                </Badge>
              </div>
            </div>

            {/* Stepper (2026 clean) */}
            <div className="relative bg-emerald-50/60 rounded-2xl px-3 py-3 mb-4 overflow-hidden">
              <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-1.5 bg-emerald-100 rounded-full" />
              <div
                className="absolute left-3 top-1/2 -translate-y-1/2 h-1.5 bg-emerald-500 rounded-full transition-all"
                style={{
                  width:
                    currentStep <= 0
                      ? "0%"
                      : currentStep === 1
                      ? "33%"
                      : currentStep === 2
                      ? "66%"
                      : "100%",
                  right: "3",
                }}
              />
              <div className="relative grid grid-cols-4 gap-2">
                {steps.map((s, i) => {
                  const ActiveIcon = s.icon;
                  const active = i <= currentStep;
                  return (
                    <div key={s.label} className="flex flex-col items-center">
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0.6 }}
                        animate={{ scale: active ? 1 : 0.95, opacity: active ? 1 : 0.6 }}
                        className={`grid place-items-center h-9 w-9 rounded-full border text-white shadow-sm ${
                          active ? "bg-emerald-600 border-emerald-600" : "bg-emerald-200 border-emerald-200"
                        }`}
                      >
                        <ActiveIcon className="h-4 w-4" />
                      </motion.div>
                      <div
                        className={`mt-1 text-[11px] font-semibold ${
                          i === currentStep ? "text-emerald-700" : active ? "text-emerald-500" : "text-gray-400"
                        } text-center leading-tight`}
                      >
                        {s.label}
                      </div>
                      {stepTimes[i] && (
                        <div className="text-[10px] font-semibold text-emerald-700/80">{formatTimestamp(stepTimes[i])}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Delivery partner card (when OFD) */}
            {order.status === "out_for_delivery" && (
              <div className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-full bg-white border border-emerald-100 overflow-hidden grid place-items-center">
                    <img
                      src={deliveryPartner.avatar || "/images/delivery-partner.png"}
                      alt="Delivery Partner"
                      className="h-full w-full object-cover"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                    {!deliveryPartner.avatar && (
                      <div className="text-emerald-700 font-black">
                        {(deliveryPartner.name || "D").charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[17px] font-extrabold">{deliveryPartner.name || "Delivery Partner"}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="font-semibold">★ {deliveryPartner.rating || 4.7}</span>
                      <span>•</span>
                      <span>{deliveryPartner.vehicle || "Bike"}</span>
                    </div>
                    <div className="text-[13px] text-gray-500">
                      Phone:{" "}
                      {(deliveryPartner.phone ? deliveryPartner.phone : "******").replace(/.(?=.{4})/g, "*")}
                    </div>
                    <div className="mt-0.5 text-emerald-700 font-bold text-sm flex items-center gap-1">
                      Arriving in {eta || "Calculating..."} <Bike className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 ml-2">
                  <Button
                    size="icon"
                    className="rounded-full h-12 w-12 shadow"
                    style={{ backgroundColor: "#13C0A2", color: "#fff" }}
                    onClick={() =>
                      window.open(`tel:${deliveryPartner.mobile || deliveryPartner.phone || ""}`)
                    }
                  >
                    <Phone className="h-5 w-5" />
                  </Button>

                  <div className="relative">
                    {deliveryUnreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 grid place-items-center rounded-full bg-red-600 text-white text-[10px] font-bold">
                        {deliveryUnreadCount}
                      </span>
                    )}
                    <Button
                      size="icon"
                      className="rounded-full h-12 w-12 shadow"
                      style={{ backgroundColor: AMBER, color: "#222" }}
                      onClick={handleOpenDeliveryChat}
                    >
                      <MessageCircle className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ORDER SUMMARY */}
            <div className="rounded-xl bg-white">
              <div className="rounded-xl bg-emerald-50/40 p-3">
                {/* PRESCRIPTION ORDER */}
                {order.__type === "prescription" ? (
                  <>
                    <div className="text-sm font-bold">
                      Pharmacy:
                      <span className="text-emerald-700 ml-1">
                        {prescriptionQuote && (prescriptionQuote.pharmacyName || prescriptionQuote.pharmacy?.name)
                          ? (prescriptionQuote.pharmacyName || prescriptionQuote.pharmacy?.name)
                          : "Pharmacy not assigned yet"}
                      </span>
                    </div>
                    <div className="text-sm text-slate-700">
                      Deliver to:
                      <span className="text-emerald-700 ml-1">{formatAddress(order.address)}</span>
                    </div>
                    <div className="text-sm text-slate-700">
                      Amount: <b>₹{prescriptionQuote ? (prescriptionQuote.price || prescriptionQuote.approxPrice || 0) : 0}</b>
                    </div>
                    <div className="text-sm text-slate-500">
                      Items:
                      {prescriptionQuote?.items?.length > 0 ? (
                        prescriptionQuote.items.map((item, i) => (
                          <span key={i} className="text-emerald-700 font-semibold">
                            {" "}
                            {item.medicineName} x{item.quantity || 1} [{item.available !== false ? "Available" : "Unavailable"}];
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400"> Quote not received yet</span>
                      )}
                    </div>

                    {order.prescriptionUrl && (
                      <div className="mt-3">
                        <div className="text-sm text-emerald-700 font-semibold mb-1 flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          Prescription Uploaded:
                        </div>
                        <img
                          src={
                            order.prescriptionUrl.startsWith("http")
                              ? order.prescriptionUrl
                              : `${API_BASE_URL}${order.prescriptionUrl}`
                          }
                          alt="Prescription"
                          className="w-[90%] max-h-[190px] rounded-lg shadow"
                        />
                      </div>
                    )}

                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        className="font-semibold"
                        style={{ borderColor: "#0ea5a2", color: "#0b7669" }}
                        onClick={() => setSupportChatOpen(true)}
                      >
                        <Headset className="h-4 w-4 mr-2" />
                        Contact Support
                      </Button>
                    </div>
                  </>
                ) : (
                  // NORMAL ORDER (UNCHANGED DATA)
                  <>
                    <div className="text-sm font-bold">
                      Pharmacy:
                      <span className="text-emerald-700 ml-1">
                        {order.pharmacyName || (typeof order.pharmacy === "object" ? order.pharmacy?.name : order.pharmacy)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-700">
                      Deliver to:
                      <span className="text-emerald-700 ml-1">{formatAddress(order.address)}</span>
                    </div>
                    <div className="text-sm text-slate-700">
                      Amount: <b>₹{order.amount || order.total || 0}</b>
                    </div>
                    <div className="text-sm text-slate-500">
                      Items:
                      {(order.items || []).map((item, i) => (
                        <span key={i} className="text-emerald-700 font-semibold">
                          {" "}
                          {item.name} x{item.qty || item.quantity};
                        </span>
                      ))}
                    </div>

                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        className="font-semibold"
                        style={{ borderColor: "#0ea5a2", color: "#0b7669" }}
                        onClick={() => setSupportChatOpen(true)}
                      >
                        <Headset className="h-4 w-4 mr-2" />
                        Contact Support
                      </Button>
                    </div>

                    {order.dosage && (
                      <div className="mt-2 flex items-center text-sm text-emerald-700">
                        <FileText className="h-4 w-4 mr-1" />
                        Dosage: {order.dosage}
                      </div>
                    )}
                    {order.note && (
                      <div className="text-sm text-slate-500">
                        <b>Note:</b> {order.note}
                      </div>
                    )}

                    {order.prescription && (
                      <div className="mt-3">
                        <div className="text-sm text-emerald-700 font-semibold mb-1 flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          Prescription Uploaded:
                        </div>
                        <img
                          src={
                            order.prescription.startsWith("http")
                              ? order.prescription
                              : `${API_BASE_URL}${order.prescription}`
                          }
                          alt="Prescription"
                          className="w-[90%] max-h-[190px] rounded-lg shadow"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Map */}
              {isLoaded && order.driverLocation && currentStep >= 2 && currentStep < 3 && (
                <div className="mt-3">
                  <div className="text-sm text-emerald-700 mb-1">Live Delivery Location:</div>
                  <div className="rounded-2xl overflow-hidden">
                    <GoogleMap
                      mapContainerStyle={{
                        width: "100%",
                        height: "230px",
                        borderRadius: "18px",
                        marginTop: "4px",
                      }}
                      center={{
                        lat: order.driverLocation.lat || 28.4595,
                        lng: order.driverLocation.lng || 77.0266,
                      }}
                      zoom={14}
                    >
                      <Marker
                        position={{
                          lat: order.driverLocation.lat,
                          lng: order.driverLocation.lng,
                        }}
                      />
                    </GoogleMap>
                  </div>
                  <div className="text-sm font-bold text-emerald-700 mt-2">
                    Estimated time to delivery: {eta || "Calculating..."}
                  </div>
                </div>
              )}

              {/* Delivered cheer */}
              {isDelivered && (
                <div className="mt-3 flex items-center justify-center text-center gap-2">
                  <Smile className="h-7 w-7" style={{ color: AMBER }} />
                  <div className="text-emerald-700 font-extrabold">
                    Fastest medicine, happiest you! Get well soon! 💊❤️
                  </div>
                </div>
              )}

              {/* Ratings */}
              {isDelivered && (
                <div className="mt-4">
                  {feedbackSubmitted ? (
                    <div className="text-center py-6">
                      <Smile className="h-14 w-14 mx-auto mb-2" style={{ color: "#18c5ad" }} />
                      <div className="text-2xl font-black" style={{ color: "#18c5ad" }}>
                        Thank you for your feedback!
                      </div>
                      <div className="text-slate-600 font-medium">
                        We&apos;re glad you chose GoDavaii. <br />
                        Wishing you a speedy recovery!
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Pharmacy rating card */}
                      <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
                        <div className="flex items-center gap-3">
                          <div className="h-14 w-14 rounded-full border-2 border-emerald-500 bg-emerald-50 grid place-items-center overflow-hidden">
                            <img
                              src="/images/pharmacy.png"
                              alt="Pharmacy"
                              className="h-full w-full object-cover"
                              onError={(e) => (e.currentTarget.style.display = "none")}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="text-[17px] font-extrabold text-emerald-800">
                              {order.pharmacyName ||
                                (typeof order.pharmacy === "object" ? order.pharmacy?.name : order.pharmacy)}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Stars
                                value={pharmacyRating || 0}
                                onChange={(v) => setPharmacyRating(v)}
                                disabled={ratingSubmitting}
                              />
                              <div className="text-sm font-semibold text-slate-600">Rate Pharmacy</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Delivery rating card */}
                      <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
                        <div className="flex items-center gap-3">
                          <div className="h-14 w-14 rounded-full border-2 border-amber-400 bg-amber-50 grid place-items-center overflow-hidden">
                            <img
                              src={deliveryPartner.avatar || "/images/delivery-partner.png"}
                              alt="Partner"
                              className="h-full w-full object-cover"
                              onError={(e) => (e.currentTarget.style.display = "none")}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="text-[17px] font-extrabold text-emerald-800">
                              {deliveryPartner.name || "Delivery Partner"}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Stars
                                value={deliveryRating || 0}
                                onChange={(v) => setDeliveryRating(v)}
                                disabled={ratingSubmitting}
                              />
                              <div className="text-sm font-semibold text-slate-600">Rate Partner</div>
                            </div>

                            <div className="flex flex-wrap gap-2 mt-2 max-w-[260px]">
                              {["Polite", "Helpful", "Rude"].map((label) => {
                                const selected = deliveryBehavior.includes(label.toLowerCase());
                                const isBad = label === "Rude";
                                return (
                                  <button
                                    key={label}
                                    type="button"
                                    onClick={() =>
                                      setDeliveryBehavior((prev) =>
                                        prev.includes(label.toLowerCase())
                                          ? prev.filter((b) => b !== label.toLowerCase())
                                          : [...prev, label.toLowerCase()]
                                      )
                                    }
                                    className={`px-3 py-1.5 text-sm font-bold rounded-full border transition
                                      ${
                                        selected
                                          ? isBad
                                            ? "bg-red-50 text-red-700 border-red-200"
                                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                          : "bg-slate-50 text-slate-600 border-slate-200"
                                      }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-center">
                        <Button
                          variant="outline"
                          className="font-semibold mr-2"
                          style={{ borderColor: "#0ea5a2", color: "#0b7669" }}
                          onClick={() => setSupportChatOpen(true)}
                        >
                          <Headset className="h-4 w-4 mr-2" />
                          Contact Support
                        </Button>
                        <Button
                          disabled={!(pharmacyRating && deliveryRating && deliveryBehavior.length > 0) || ratingSubmitting}
                          onClick={handleRatingSubmit}
                          className="font-black text-base px-6 py-5 rounded-xl shadow"
                          style={{ backgroundColor: AMBER, color: "#222" }}
                        >
                          {ratingSubmitting ? "Submitting..." : "Submit Feedback"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Back button */}
            <Button
              onClick={() => navigate("/orders")}
              className="w-full mt-4 font-bold text-[16px]"
              style={{ backgroundColor: "#13C0A2", color: "#fff" }}
            >
              Back to My Orders
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* QUOTE MODAL (UNCHANGED FLOW) */}
      <Dialog open={quoteDialog} onOpenChange={setQuoteDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Quote Available</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-700">
            {prescriptionQuote && (
              <>
                <div className="mb-2">Pharmacy has sent you a quote for your prescription:</div>
                <ul className="list-disc pl-5 space-y-1">
                  {prescriptionQuote.items?.map((item, idx) => (
                    <li key={idx}>
                      {item.medicineName} – {item.brand} – ₹{item.price} × {item.quantity} [
                      {item.available !== false ? "Available" : "Unavailable"}]
                    </li>
                  ))}
                </ul>
                <div className="mt-2 font-bold">
                  Total: ₹{prescriptionQuote.price || prescriptionQuote.approxPrice}
                </div>
                {prescriptionQuote.message && (
                  <div className="mt-1 text-slate-500">Note: {prescriptionQuote.message}</div>
                )}
              </>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={handleRejectQuote}
              disabled={quoteActionLoading}
            >
              Reject
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleAcceptQuote}
              disabled={quoteActionLoading}
            >
              Accept & Pay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Chat Modal */}
      <ChatModal
        open={chatOpen && chatThread === "delivery"}
        onClose={() => setChatOpen(false)}
        orderId={order._id}
        thread="delivery"
        orderStatus={order.status}
        partnerName={chatPartner.name}
        partnerType={chatPartner.type}
        currentRole="user"
      />

      {/* Support Chat */}
      <ChatSupportModal open={supportChatOpen} onClose={() => setSupportChatOpen(false)} orderId={order._id} />

      {/* Inline toast */}
      <InlineToast
        open={snackbarOpen}
        kind={snackbarMsg.toLowerCase().includes("fail") ? "error" : "success"}
        onClose={() => setSnackbarOpen(false)}
      >
        {snackbarMsg}
      </InlineToast>
    </div>
  );
}
