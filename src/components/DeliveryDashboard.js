// src/components/DeliveryDashboard.js
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import dayjs from "dayjs";
import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";

// shadcn/ui
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

// framer-motion
import { motion, AnimatePresence } from "framer-motion";

// lucide-react
import {
  Bike, CheckCheck, Pill, LogOut, MessageSquare, MapPin, Map, Route, Loader2,
  AlarmClock, ShieldAlert, TimerReset, Navigation, Gauge, DollarSign
} from "lucide-react";

// other components (existing logic)
import ChatModal from "./ChatModal";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

/* ------------------------- helpers (unchanged logic) ------------------------ */

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

const getRouteAndDistance = async (origin, destination) => {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  let poly = [];
  let distanceKm = null;

  if (data.routes && data.routes[0]) {
    if (data.routes[0].overview_polyline) {
      poly = decodePolyline(data.routes[0].overview_polyline.points);
    }
    if (data.routes[0].legs && data.routes[0].legs[0] && data.routes[0].legs[0].distance) {
      distanceKm = data.routes[0].legs[0].distance.value / 1000;
    }
  }
  return { poly, distanceKm };
};

function decodePolyline(encoded) {
  let points = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;
  while (index < len) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

const mmss = (secs) => {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

/* --------------------------- payouts sub-section --------------------------- */

function DeliveryPayoutsSection({ partner }) {
  const [payouts, setPayouts] = useState([]);
  const [tab, setTab] = useState(0); // 0 today, 1 yesterday

  useEffect(() => {
    if (!partner?._id) return;
    axios.get(`${API_BASE_URL}/api/payments?deliveryPartnerId=${partner._id}&status=paid`)
      .then(res => setPayouts(res.data));
  }, [partner]);

  const today = dayjs().format("YYYY-MM-DD");
  const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");

  const filtered = payouts.filter(pay => {
    const payDay = dayjs(pay.createdAt).format("YYYY-MM-DD");
    return tab === 0 ? payDay === today : payDay === yesterday;
  });

  const total = filtered.reduce((sum, p) => sum + (p.deliveryAmount || 0), 0);

  if (!partner?._id) return null;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-emerald-200/60 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-emerald-900 font-extrabold text-lg">
            Your Delivery Earnings {tab === 0 ? "Today" : "Yesterday"}
          </h3>
          <div className="flex gap-2">
            <Button size="sm" variant={tab === 0 ? "default" : "outline"} className="!font-bold" onClick={() => setTab(0)}>Today</Button>
            <Button size="sm" variant={tab === 1 ? "default" : "outline"} className="!font-bold" onClick={() => setTab(1)}>Yesterday</Button>
          </div>
        </div>

        <div className="mt-3 text-3xl font-extrabold text-emerald-700">₹{total.toLocaleString("en-IN")}</div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">Order</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Fee</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(pay => (
                <tr key={pay._id} className="border-t">
                  <td className="px-3 py-2">#{pay.orderId?._id?.slice(-5) || "NA"}</td>
                  <td className="px-3 py-2">{dayjs(pay.createdAt).format("DD/MM/YYYY")}</td>
                  <td className="px-3 py-2">₹{pay.deliveryAmount}</td>
                  <td className="px-3 py-2">{pay.status}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-3 py-3 text-amber-600">No payouts yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- component -------------------------------- */

export default function DeliveryDashboard() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem("deliveryToken"));
  const [partner, setPartner] = useState(null);
  const [active, setActive] = useState(false);
  const [tab, setTab] = useState(0);
  const [orders, setOrders] = useState([]);
  const [pastOrders, setPastOrders] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatOrder, setChatOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const firstLoad = useRef(true);
  const unreadTimerRef = useRef(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [loginDialog, setLoginDialog] = useState(!loggedIn);
  const [loginForm, setLoginForm] = useState({ mobile: "", password: "" });
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetPhase, setResetPhase] = useState(0);
  const [forgotForm, setForgotForm] = useState({ mobile: "", otp: "", newPassword: "" });
  const [polylines, setPolylines] = useState({});
  const [orderDistances, setOrderDistances] = useState({});
  const [orderUnreadCounts, setOrderUnreadCounts] = useState({});

  // NEW: Live Ops & Availability (UI only)
  const [autoAccept, setAutoAccept] = useState(() => localStorage.getItem("gd_auto_accept") === "1");
  const [onBreak, setOnBreak] = useState(false);
  const [breakRemaining, setBreakRemaining] = useState(0); // seconds

  // NEW: Performance glance (UI only; fetch payments for today)
  const [todayEarnings, setTodayEarnings] = useState(null); // ₹
  const [cashDue, setCashDue] = useState(0); // UI-only stub

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });

  // Auto-refresh orders (existing)
  useEffect(() => {
    if (!loggedIn || loading) return;
    const interval = setInterval(() => { fetchProfileAndOrders(); }, 3000);
    return () => clearInterval(interval);
  }, [loggedIn, tab, loading]);

  // Send driver location while ACTIVE (existing)
  useEffect(() => {
    if (!loggedIn || !partner?._id || !active) return;

    let watchId;
    const send = async (coords) => {
      const { latitude, longitude } = coords;
      try {
        await axios.post(`${API_BASE_URL}/api/delivery/update-location`, {
          partnerId: partner._id, lat: latitude, lng: longitude,
        });
      } catch {}
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => send(pos.coords), () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
      );
      watchId = navigator.geolocation.watchPosition(
        (pos) => send(pos.coords), () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
      );
    }
    return () => { if (navigator.geolocation && watchId) navigator.geolocation.clearWatch(watchId); };
  }, [loggedIn, partner?._id, active]);

  useEffect(() => {
    if (loggedIn) {
      setLoading(true);
      fetchProfileAndOrders().finally(() => {
        setLoading(false);
        firstLoad.current = false;
      });
    }
    // eslint-disable-next-line
  }, [loggedIn]);

  // Unread chat counts (existing)
  useEffect(() => {
  if (!loggedIn || !orders.length) return;

  const token = localStorage.getItem("deliveryToken");
  if (!token) return; // <-- avoid 401 spam when not logged in / token missing

  let cancelled = false;

  const fetchUnread = async () => {
    const counts = {};
    await Promise.all(
      orders.map(async (order) => {
        try {
          const res = await axios.get(
            `${API_BASE_URL}/api/chat/${order._id}/user-unread-count`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          counts[order._id] = res.data.unreadCount || 0;
        } catch (err) {
          // If unauthorized, stop polling to avoid console flood
          if (err?.response?.status === 401 && unreadTimerRef.current) {
            clearInterval(unreadTimerRef.current);
            unreadTimerRef.current = null;
          }
          counts[order._id] = 0;
        }
      })
    );
    if (!cancelled) setOrderUnreadCounts(counts);
  };

  fetchUnread();
  unreadTimerRef.current = setInterval(fetchUnread, 7000); // a bit lighter than 3s
  return () => {
    cancelled = true;
    if (unreadTimerRef.current) clearInterval(unreadTimerRef.current);
  };
}, [orders, loggedIn]);


  // NEW: Persist auto-accept toggle locally
  useEffect(() => {
    localStorage.setItem("gd_auto_accept", autoAccept ? "1" : "0");
  }, [autoAccept]);

  // NEW: Break timer countdown (UI only)
  useEffect(() => {
    if (!onBreak || breakRemaining <= 0) return;
    const t = setInterval(() => setBreakRemaining((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [onBreak, breakRemaining]);

  // When break completes
  useEffect(() => {
    if (onBreak && breakRemaining <= 0) {
      setOnBreak(false);
      setSnackbar({ open: true, message: "Break finished — back online!", severity: "success" });
    }
  }, [onBreak, breakRemaining]);

  // NEW: fetch today's earnings (UI glance)
  useEffect(() => {
    const fetchToday = async () => {
      try {
        if (!partner?._id) return;
        const res = await axios.get(`${API_BASE_URL}/api/payments?deliveryPartnerId=${partner._id}&status=paid`);
        const today = dayjs().format("YYYY-MM-DD");
        const todays = (res.data || []).filter(p => dayjs(p.createdAt).format("YYYY-MM-DD") === today);
        const total = todays.reduce((s, p) => s + (p.deliveryAmount || 0), 0);
        setTodayEarnings(total);
      } catch {
        setTodayEarnings(null);
      }
    };
    fetchToday();
  }, [partner?._id]);

  const fetchProfileAndOrders = async () => {
    try {
      const token = localStorage.getItem("deliveryToken");
      const partnerId = localStorage.getItem("deliveryPartnerId");
      const resProfile = await axios.get(`${API_BASE_URL}/api/delivery/partner/${partnerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPartner(resProfile.data.partner || {});
      setActive(resProfile.data.partner?.active || false);

      const resOrders = await axios.get(`${API_BASE_URL}/api/delivery/orders`, {
        headers: { Authorization: `Bearer ${token}`, deliverypartnerid: partnerId }
      });
      const activeOrders = resOrders.data || [];
      setOrders(activeOrders);
      setPastOrders(resProfile.data.pastOrders || []);

      let newPolys = {};
      let newDistances = {};
      for (const o of activeOrders) {
        if (o.pharmacy?.location?.lat && o.pharmacy?.location?.lng && o.address?.lat && o.address?.lng) {
          if (!polylines[o._id] || orderDistances[o._id] == null) {
            const { poly, distanceKm } = await getRouteAndDistance(o.pharmacy.location, o.address);
            newPolys[o._id] = poly;
            newDistances[o._id] = distanceKm;
          } else {
            newPolys[o._id] = polylines[o._id];
            newDistances[o._id] = orderDistances[o._id];
          }
        }
      }
      setPolylines(newPolys);
      setOrderDistances(newDistances);
    } catch (err) {
      setSnackbar({ open: true, message: "Failed to load profile/orders", severity: "error" });
      setLoggedIn(false);
      setLoginDialog(true);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const token = localStorage.getItem("deliveryToken");
      await axios.patch(`${API_BASE_URL}/api/delivery/orders/${orderId}/status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSnackbar({ open: true, message: `Order marked as ${newStatus}`, severity: "success" });
      fetchProfileAndOrders();
    } catch {
      setSnackbar({ open: true, message: "Failed to update order status", severity: "error" });
    }
  };

  // Auth (existing)
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE_URL}/api/delivery/login`, loginForm);
      localStorage.setItem("deliveryToken", res.data.token);
      localStorage.setItem("deliveryPartnerId", res.data.partner._id);
      setPartner(res.data.partner);
      setActive(res.data.partner.active || false);
      setLoggedIn(true);
      setLoginDialog(false);
      setSnackbar({ open: true, message: "Logged in!", severity: "success" });
    } catch {
      setSnackbar({ open: true, message: "Login failed. Check mobile/password.", severity: "error" });
    }
  };
  const handleLogout = () => {
    localStorage.removeItem("deliveryToken");
    localStorage.removeItem("deliveryPartnerId");
    setLoggedIn(false);
    setPartner(null);
    setOrders([]);
    setPastOrders([]);
    setLoginDialog(true);
  };

  // Forgot / Reset handlers (add back)
const handleForgotStart = async () => {
  try {
    await axios.post(`${API_BASE_URL}/api/delivery/forgot-password`, {
      mobile: forgotForm.mobile,
    });
    setSnackbar({ open: true, message: "OTP sent to mobile!", severity: "success" });
    setResetPhase(1);
  } catch {
    setSnackbar({ open: true, message: "Mobile not found!", severity: "error" });
  }
};

const handleResetPassword = async () => {
  try {
    await axios.post(`${API_BASE_URL}/api/delivery/reset-password`, {
      mobile: forgotForm.mobile,
      otp: forgotForm.otp,
      newPassword: forgotForm.newPassword,
    });
    setSnackbar({ open: true, message: "Password reset! Please log in.", severity: "success" });
    setForgotOpen(false);
    setResetPhase(0);
    setForgotForm({ mobile: "", otp: "", newPassword: "" });
  } catch {
    setSnackbar({ open: true, message: "Invalid OTP or error", severity: "error" });
  }
};

  /* ------------------------------ login dialog ------------------------------ */
  if (!loggedIn) {
    return (
      <Dialog open={loginDialog} onOpenChange={() => {}}>
        <DialogContent className="force-light sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-800 font-extrabold">Delivery Partner Login</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLogin} className="space-y-3">
            <div className="grid gap-1.5">
              <Label>Mobile Number</Label>
              <Input value={loginForm.mobile} onChange={e => setLoginForm(f => ({ ...f, mobile: e.target.value }))} required className="gd-input" />
            </div>
            <div className="grid gap-1.5">
              <Label>Password</Label>
              <Input type="password" value={loginForm.password} onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))} required className="gd-input" />
            </div>
            <Button type="submit" className="w-full btn-primary-emerald !font-bold mt-1">Login</Button>
            <Button type="button" variant="ghost" className="w-full btn-ghost-soft !font-bold" onClick={() => setForgotOpen(true)}>
              Forgot Password?
            </Button>
          </form>

          {/* Forgot / Reset Modal */}
          <Dialog open={forgotOpen} onOpenChange={(open) => { setForgotOpen(open); if (!open) setResetPhase(0); }}>
            <DialogContent className="force-light sm:max-w-md">
              <DialogHeader><DialogTitle>Forgot Password</DialogTitle></DialogHeader>
              {resetPhase === 0 ? (
                <div className="space-y-3">
                  <div className="grid gap-1.5">
                    <Label>Registered Mobile</Label>
                    <Input value={forgotForm.mobile} onChange={e => setForgotForm(f => ({ ...f, mobile: e.target.value }))} />
                  </div>
                  <DialogFooter>
                    <Button onClick={handleForgotStart} className="btn-primary-emerald !font-bold">Send OTP</Button>
                  </DialogFooter>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-1.5">
                    <Label>OTP</Label>
                    <Input value={forgotForm.otp} onChange={e => setForgotForm(f => ({ ...f, otp: e.target.value }))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>New Password</Label>
                    <Input type="password" value={forgotForm.newPassword} onChange={e => setForgotForm(f => ({ ...f, newPassword: e.target.value }))} />
                  </div>
                  <DialogFooter>
                    <Button onClick={handleResetPassword} className="btn-primary-emerald !font-bold">Reset Password</Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Snackbar mimic */}
          <AnimatePresence>
            {snackbar.open && (
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 30, opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[2000] rounded-full px-4 py-2 font-semibold shadow-lg ${
                  snackbar.severity === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
                }`}
                onAnimationComplete={() => setTimeout(() => setSnackbar(s => ({ ...s, open: false })), 2200)}
              >
                {snackbar.message}
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    );
  }

  /* -------------------------------- dashboard ------------------------------- */
  const tabsValue = tab === 0 ? "active" : tab === 1 ? "past" : "earnings";

  // glance metrics (UI only)
  const todayStr = dayjs().format("YYYY-MM-DD");
  const deliveriesToday = (pastOrders || []).filter(o =>
    o.status === "delivered" && dayjs(o.createdAt).format("YYYY-MM-DD") === todayStr
  ).length;
  const rph = null; // ₹/hr (needs backend session time) – showing as "—" below

  return (
    <div className="mx-auto max-w-[900px] px-3 pt-4 pb-16">
      {/* header */}
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/60 bg-white p-3 shadow-sm">
        <Avatar className="h-14 w-14 ring-2 ring-emerald-100">
          {partner?.avatar ? (
            <AvatarImage src={partner.avatar} alt={partner?.name || "Partner"} />
          ) : (
            <AvatarFallback className="bg-emerald-600 text-white font-bold">
              {(partner?.name || "D").charAt(0).toUpperCase()}
            </AvatarFallback>
          )}
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="text-lg font-extrabold text-emerald-900 truncate">{partner?.name}</div>
          <div className="text-sm text-slate-600 truncate">
            {partner?.mobile} <span className="mx-2">|</span> {partner?.city}, {partner?.area}
          </div>

          {/* Live Ops & Availability row */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* Online/Offline (existing switch) */}
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-white px-3 py-2">
              <Switch
                checked={active}
                onCheckedChange={async (next) => {
                  setActive(next);
                  const token = localStorage.getItem("deliveryToken");
                  if (navigator.geolocation && next) {
                    navigator.geolocation.getCurrentPosition((pos) => {
                      axios.patch(`${API_BASE_URL}/api/delivery/partner/${partner._id}/active`, {
                        active: next, lat: pos.coords.latitude, lng: pos.coords.longitude,
                      }, { headers: { Authorization: `Bearer ${token}` } });
                    });
                  } else {
                    await axios.patch(`${API_BASE_URL}/api/delivery/partner/${partner._id}/active`,
                      { active: next }, { headers: { Authorization: `Bearer ${token}` } });
                  }
                }}
              />
              <span className={`text-sm font-bold ${active ? "text-emerald-600" : "text-red-600"}`}>
                {active ? "Active" : "Inactive"}
              </span>
            </div>

            {/* Auto-accept toggle (UI only) */}
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-white px-3 py-2">
              <span className="text-sm font-semibold text-emerald-900">Auto-accept</span>
              <Switch
                checked={autoAccept}
                onCheckedChange={async (v) => {
                  setAutoAccept(v);
                  setSnackbar({
                    open: true,
                    message: v ? "Auto-accept enabled" : "Auto-accept disabled",
                    severity: v ? "success" : "error"
                  });
                  // ⬇️ persist to backend (keeps your localStorage useEffect as-is)
                  try {
                    const token = localStorage.getItem("deliveryToken");
                    await axios.patch(
                      `${API_BASE_URL}/api/delivery/partner/${partner?._id}/active`,
                      { autoAccept: v },
                      { headers: { Authorization: `Bearer ${token}` } }
                      );
                      } catch {}
                }}
              />
            </div>

            {/* Cash due chip (UI stub) */}
            <Badge className="bg-amber-400 text-emerald-900 font-bold">
              Cash to deposit: ₹{cashDue ?? 0}
            </Badge>
          </div>

          {/* Break timer (UI only) */}
          <div className="mt-2 flex items-center gap-2">
            {!onBreak ? (
              <Button size="sm" variant="outline" className="!font-bold"
                onClick={() => { setOnBreak(true); setBreakRemaining(10 * 60); }}>
                <AlarmClock className="h-4 w-4 mr-1" /> Start 10-min Break
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600"><TimerReset className="h-3.5 w-3.5 mr-1" /> {mmss(breakRemaining)}</Badge>
                <Button size="sm" variant="outline" className="!font-bold"
                  onClick={() => { setOnBreak(false); setBreakRemaining(0); }}>
                  Resume Now
                </Button>
              </div>
            )}
          </div>
        </div>

        <Button variant="outline" className="btn-danger-outline !font-bold" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" /> Logout
        </Button>
      </div>

      {/* Performance / Earnings at a glance */}
      <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl border border-emerald-200/60 bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <DollarSign className="h-4 w-4 text-emerald-600" /> Today
          </div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-700">
            {todayEarnings == null ? "—" : `₹${todayEarnings.toLocaleString("en-IN")}`}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200/60 bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <CheckCheck className="h-4 w-4 text-emerald-600" /> Deliveries (Today)
          </div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-700">{deliveriesToday}</div>
        </div>
        <div className="rounded-xl border border-emerald-200/60 bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <Gauge className="h-4 w-4 text-emerald-600" /> ₹ / hr
          </div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-700">{rph == null ? "—" : rph}</div>
        </div>
      </div>

      {/* tabs */}
      <div className="mt-4">
        <Tabs value={tabsValue} onValueChange={(v) => setTab(v === "active" ? 0 : v === "past" ? 1 : 2)}>
          <TabsList className="grid w-full grid-cols-3 rounded-xl bg-transparent p-0">
            <TabsTrigger
              value="active"
              className="bg-transparent data-[state=active]:bg-emerald-600 data-[state=active]:text-white
                         data-[state=active]:shadow-none data-[state=inactive]:text-slate-600 !font-extrabold">
              Active Orders
            </TabsTrigger>
            <TabsTrigger
              value="past"
              className="bg-transparent data-[state=active]:bg-emerald-600 data-[state=active]:text-white
                         data-[state=active]:shadow-none data-[state=inactive]:text-slate-600 !font-extrabold">
              Past Orders
            </TabsTrigger>
            <TabsTrigger
              value="earnings"
              className="bg-transparent data-[state=active]:bg-emerald-600 data-[state=active]:text-white
                         data-[state=active]:shadow-none data-[state=inactive]:text-slate-600 !font-extrabold">
              Earnings
            </TabsTrigger>
          </TabsList>

          {/* ACTIVE */}
          <TabsContent value="active" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading...
              </div>
            ) : (
              <div className="space-y-4">
                {orders.length === 0 && (
                  <div className="text-center text-slate-500">No active orders assigned to you.</div>
                )}

                {orders.map((order) => {
                  const pharmacyLoc = order.pharmacy?.location;
                  const userLoc = order.address;

                  // GeoJSON safeguard -> lat/lng
                  let patchedPharmacyLoc = pharmacyLoc;
                  if (pharmacyLoc && Array.isArray(pharmacyLoc.coordinates) && pharmacyLoc.coordinates.length === 2) {
                    patchedPharmacyLoc = { ...pharmacyLoc, lat: pharmacyLoc.coordinates[1], lng: pharmacyLoc.coordinates[0] };
                  }
                  let patchedUserLoc = userLoc;
                  if (userLoc && Array.isArray(userLoc.coordinates) && userLoc.coordinates.length === 2) {
                    patchedUserLoc = { ...userLoc, lat: userLoc.coordinates[1], lng: userLoc.coordinates[0] };
                  }

                  const poly = polylines[order._id] || [];
                  const mapCenter = patchedPharmacyLoc?.lat && patchedPharmacyLoc?.lng
                    ? { lat: patchedPharmacyLoc.lat, lng: patchedPharmacyLoc.lng }
                    : { lat: 19.076, lng: 72.877 };

                  // Navigation & Status: simple ETA from distance (UI only, assumes ~22 km/h)
                  const dist = orderDistances[order._id];
                  const etaMin = dist != null ? Math.max(3, Math.round((dist / 22) * 60)) : null;

                  return (
                    <motion.div
                      key={order._id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-emerald-200/60 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Pill className="h-5 w-5 text-emerald-600" />
                        <div className="font-semibold">
                          Pharmacy: <span className="text-emerald-700 font-extrabold">{order.pharmacy?.name || order.pharmacy}</span>
                        </div>

                        {/* Distance & ETA pills */}
                        <div className="ml-auto flex items-center gap-2">
                          {dist != null && (
                            <Badge className="bg-emerald-100 text-emerald-800 font-bold">
                              {dist.toFixed(2)} km
                            </Badge>
                          )}
                          {etaMin != null && (
                            <Badge className="bg-emerald-600">ETA ~ {etaMin} min</Badge>
                          )}
                          <Badge className="bg-emerald-600">{order.status}</Badge>
                        </div>
                      </div>

                      <div className="mt-2 text-sm text-slate-700">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 mt-0.5 text-slate-500" />
                          <span>Pharmacy Address: <b>{order.pharmacy?.address}</b></span>
                        </div>
                        <div className="flex items-start gap-2 mt-1">
                          <MapPin className="h-4 w-4 mt-0.5 text-slate-500" />
                          <span>
                            Deliver to: <b>
                              {order.address?.formatted ||
                                order.address?.fullAddress ||
                                [order.address?.addressLine, order.address?.floor, order.address?.landmark, order.address?.area, order.address?.city, order.address?.state, order.address?.pin]
                                  .filter(Boolean).join(", ")}
                            </b>
                          </span>
                        </div>
                        <div className="mt-1">Amount: ₹{order.total || order.amount || 0}</div>
                        <div className="mt-1">
                          Items: {order.items.map((item, i) => (
                            <span key={i} className="text-slate-800">{item.name} x{item.qty || item.quantity}; </span>
                          ))}
                        </div>
                      </div>

                      {/* map */}
                      {isLoaded ? (
                        !patchedPharmacyLoc?.lat ? (
                          <div className="text-xs text-slate-400 mt-2">Pharmacy location missing</div>
                        ) : !patchedUserLoc?.lat ? (
                          <div className="text-xs text-slate-400 mt-2">Customer location missing</div>
                        ) : (
                          <div className="mt-3">
                            <GoogleMap
                              mapContainerStyle={{ width: "100%", height: "230px", borderRadius: 18 }}
                              center={mapCenter}
                              zoom={13}
                              options={{ streetViewControl: false, mapTypeControl: false }}
                            >
                              <Marker
                                position={{ lat: patchedPharmacyLoc.lat, lng: patchedPharmacyLoc.lng }}
                                label="P"
                                title="Pharmacy"
                                icon={{ url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png", scaledSize: { width: 40, height: 40 } }}
                              />
                              <Marker
                                position={{ lat: patchedUserLoc.lat, lng: patchedUserLoc.lng }}
                                label="U"
                                title="Delivery Address"
                                icon={{ url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png", scaledSize: { width: 40, height: 40 } }}
                              />
                              {poly.length > 0 && (
                                <Polyline path={poly} options={{ strokeColor: "#0ea5a4", strokeOpacity: 0.9, strokeWeight: 4 }} />
                              )}
                            </GoogleMap>

                            {/* Navigation picker */}
<div className="mt-2 grid grid-cols-2 gap-2">
  <Button asChild variant="outline" className="!font-bold h-9 w-full">
    <a
      target="_blank"
      href={`https://www.google.com/maps/dir/?api=1&origin=${patchedPharmacyLoc.lat},${patchedPharmacyLoc.lng}&destination=${patchedUserLoc.lat},${patchedUserLoc.lng}`}
      rel="noreferrer"
    >
      <Navigation className="h-4 w-4 mr-2" /> Google Maps
    </a>
  </Button>
  <Button asChild variant="outline" className="!font-bold h-9 w-full">
    <a
      target="_blank"
      href={`http://maps.apple.com/?saddr=${patchedPharmacyLoc.lat},${patchedPharmacyLoc.lng}&daddr=${patchedUserLoc.lat},${patchedUserLoc.lng}`}
      rel="noreferrer"
    >
      <Navigation className="h-4 w-4 mr-2" /> Apple Maps
    </a>
  </Button>
</div>
                          </div>
                        )
                      ) : (
                        <div className="text-xs text-slate-400 mt-2">Loading map...</div>
                      )}

                      {/* actions */}
<div className="mt-3 flex flex-wrap items-center gap-2">
  {order.status === "assigned" && (
    <>
      <Button
        className="btn-primary-emerald !font-extrabold"
        onClick={() => handleUpdateStatus(order._id, "accepted")}
      >
        Accept Order
      </Button>

      {/* REJECT — solid RED box, bold white text */}
      <Button
        onClick={() => handleUpdateStatus(order._id, "rejected")}
        className="
          !font-extrabold
          bg-red-600 hover:bg-red-700 active:bg-red-800
          text-white
          border border-red-700/80
          shadow-sm
        "
      >
        Reject
      </Button>
    </>
  )}

  {order.status === "accepted" && (
    /* OUT FOR DELIVERY — bright AMBER so it's very visible */
    <Button
      onClick={() => handleUpdateStatus(order._id, "out_for_delivery")}
      className="
        !font-extrabold
        bg-amber-400 hover:bg-amber-500 active:bg-amber-600
        text-emerald-950
        border border-amber-500/70
        shadow-sm
      "
    >
      <Bike className="h-4 w-4 mr-2" />
      MARK AS OUT FOR DELIVERY
    </Button>
  )}

  {order.status === "out_for_delivery" && (
    <Button
      onClick={() => handleUpdateStatus(order._id, "delivered")}
      className="bg-emerald-600 hover:bg-emerald-700 !font-extrabold text-white"
    >
      <CheckCheck className="h-4 w-4 mr-2" /> Mark as Delivered
    </Button>
  )}

  {order.status === "delivered" && <Badge className="bg-emerald-600">Delivered</Badge>}

  {/* line break */}
  <div className="basis-full h-0" />

  {/* canned replies row */}
  <div className="w-full flex flex-wrap gap-2">
    {["Reaching in 5–7 mins","Outside your gate","Call me if needed"].map((txt) => (
      <Button
        key={txt}
        size="sm"
        variant="secondary"
        className="rounded-full !font-bold"
        onClick={async () => { try { await navigator.clipboard.writeText(txt); } catch {} ; setSnackbar({ open:true, message:"Canned reply copied", severity:"success" }); }}
      >
        {txt}
      </Button>
    ))}
  </div>

  {/* chat button on its own line on mobile */}
  {order.status !== "delivered" && (
    <div className="w-full sm:w-auto sm:ml-auto relative">
      {!!(orderUnreadCounts[order._id]) && (
        <span className="absolute -right-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">
          {orderUnreadCounts[order._id]}
        </span>
      )}
      <Button
        className="bg-amber-300 text-slate-900 hover:bg-amber-400 !font-bold w-full sm:w-auto"
        onClick={async () => {
          setChatOrder(order);
          setChatOpen(true);
          const token = localStorage.getItem("deliveryToken");
          try {
            await axios.patch(`${API_BASE_URL}/api/chat/${order._id}/user-chat-seen`, {}, { headers: { Authorization: `Bearer ${token}` } });
          } catch {}
          setOrderUnreadCounts((c) => ({ ...c, [order._id]: 0 }));
        }}
      >
        <MessageSquare className="h-4 w-4 mr-2" /> Chat
      </Button>
    </div>
  )}
</div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* PAST */}
          <TabsContent value="past" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading...
              </div>
            ) : (
              <div className="space-y-4">
                {pastOrders.length === 0 && (
                  <div className="text-center text-slate-500">No past orders delivered yet.</div>
                )}
                {pastOrders.map((order) => (
                  <motion.div
                    key={order._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-emerald-200/60 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCheck className="h-5 w-5 text-emerald-600" />
                      <div className="font-semibold">Delivered #{order._id?.slice(-5)}</div>
                      <Badge className="ml-auto bg-emerald-600">{order.status}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-slate-700">Pharmacy: {order.pharmacy?.name || order.pharmacy}</div>
                    <div className="text-sm text-slate-700">Delivered to: {order.address?.addressLine}</div>
                    <div className="text-sm text-slate-700">Amount: ₹{order.total || order.amount || 0}</div>
                    <div className="text-xs text-slate-500">{order.createdAt && new Date(order.createdAt).toLocaleString()}</div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* EARNINGS */}
          <TabsContent value="earnings" className="mt-4">
            <DeliveryPayoutsSection partner={partner} />
          </TabsContent>
        </Tabs>
      </div>

      {/* CHAT MODAL (existing) */}
      <ChatModal
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        orderId={chatOrder?._id}
        thread="delivery"
        orderStatus={chatOrder?.status}
        partnerName={chatOrder?.address?.name}
        partnerType="user"
        currentRole="delivery"
      />

      {/* Safety: SOS sticky (UI only) */}
      <Button
        className="fixed bottom-24 right-4 z-[2000] bg-red-600 hover:bg-red-700 font-extrabold shadow-lg"
        onClick={() => setSnackbar({ open: true, message: "SOS sent to support (demo)", severity: "error" })}
      >
        <ShieldAlert className="h-4 w-4 mr-2" /> SOS
      </Button>

      {/* Snackbar mimic */}
      <AnimatePresence>
        {snackbar.open && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[2000] rounded-full px-4 py-2 font-semibold shadow-lg ${
              snackbar.severity === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
            }`}
            onAnimationComplete={() => setTimeout(() => setSnackbar(s => ({ ...s, open: false })), 2200)}
          >
            {snackbar.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
