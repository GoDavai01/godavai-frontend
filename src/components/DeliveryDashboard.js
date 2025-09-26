// src/components/DeliveryDashboard.js
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import dayjs from "dayjs";
import { loadGoogleMaps } from "../utils/googleMaps";

// shadcn/ui
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { BackgroundGeolocation } from "@capacitor-community/background-geolocation";

// framer-motion
import { motion, AnimatePresence } from "framer-motion";

// icons
import {
  Bike, CheckCheck, Pill, LogOut, MessageSquare, MapPin, Loader2,
  AlarmClock, ShieldAlert, TimerReset, Navigation, Gauge, DollarSign, BellRing
} from "lucide-react";

// native push (Capacitor) — safe on web too
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";

// other components
import ChatModal from "./ChatModal";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

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

// Directions using Maps JS SDK (future-friendly; no REST fetch)
const getRouteAndDistance = async (origin, destination) => {
  const google = await loadGoogleMaps(["marker"]);
  return new Promise((resolve) => {
    const svc = new google.maps.DirectionsService();
    svc.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        travelMode: google.maps.TravelMode.DRIVING, // preview; we open 2-wheeler for real nav
        provideRouteAlternatives: false,
      },
      (result, status) => {
        if (status !== "OK" || !result?.routes?.[0]) {
          resolve({ poly: [], distanceKm: null });
          return;
        }
        const r = result.routes[0];
        const leg = r.legs?.[0];
        const path = (r.overview_path || []).map(p => ({ lat: p.lat(), lng: p.lng() }));
        resolve({
          poly: path,
          distanceKm: leg?.distance ? leg.distance.value / 1000 : null,
        });
      }
    );
  });
};

// Obfuscate a coordinate by ~400m (privacy circle center)
function jitterLatLng(lat, lng, meters = 400) {
  const earth = 111320; // meters per degree latitude
  const dLat = (meters / earth) * (Math.random() < 0.5 ? -1 : 1);
  const dLng = (meters / (earth * Math.cos((lat * Math.PI) / 180))) * (Math.random() < 0.5 ? -1 : 1);
  return { lat: lat + dLat * 0.4, lng: lng + dLng * 0.4 }; // pull it in a bit
}

const mmss = (secs) => {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

/* --------------------------- payouts sub-section --------------------------- */
function DeliveryPayoutsSection({ partner }) {
  const [payouts, setPayouts] = useState([]);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (!partner?._id) return;
    axios.get(`${API_BASE_URL}/api/payments?deliveryPartnerId=${partner._id}&status=paid`)
      .then(res => setPayouts(res.data))
      .catch(() => setPayouts([]));
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
          <h3 className="text-emerald-900 font-extrabold text-lg">Your Delivery Earnings {tab === 0 ? "Today" : "Yesterday"}</h3>
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
                <tr><td colSpan="4" className="px-3 py-3 text-amber-600">No payouts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---- Tiny per-order map (unchanged UI; safe updates) ---- */
function OrderMiniMap({ center, pharmacyLoc, userLoc, path, showPharmacy = true, showUser = true, approxDrop = null }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const pharmMarkerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const circleRef = useRef(null);
  const polyRef = useRef(null);
  const fitTimeoutRef = useRef(null);
  const lastSigRef = useRef("");

  // Create map once
  useEffect(() => {
    let mounted = true;
    (async () => {
      const google = await loadGoogleMaps(["marker", "places"]);
      if (!mounted || !containerRef.current || mapRef.current) return;

      mapRef.current = new google.maps.Map(containerRef.current, {
        center: center || { lat: 19.076, lng: 72.877 },
        zoom: 14,
        mapId: "godavaii-map",
        streetViewControl: false,
        mapTypeControl: false,
        gestureHandling: "greedy",
      });

      // pre-create polyline
      polyRef.current = new google.maps.Polyline({
        map: mapRef.current,
        strokeOpacity: 0.9,
        strokeWeight: 4,
        strokeColor: "#0ea5a4",
        path: [],
      });
    })();

    return () => {
      mounted = false;
      if (fitTimeoutRef.current) {
        clearTimeout(fitTimeoutRef.current);
        fitTimeoutRef.current = null;
      }
      polyRef.current = null;
      pharmMarkerRef.current = null;
      userMarkerRef.current = null;
      circleRef.current = null;
      mapRef.current = null;
    };
    // eslint-disable-next-line
  }, []);

  // Update markers / path / circle only when inputs change
  useEffect(() => {
    const gmap = mapRef.current;
    if (!gmap) return;

    const pLat = showPharmacy ? pharmacyLoc?.lat : null;
    const pLng = showPharmacy ? pharmacyLoc?.lng : null;
    const uLat = showUser ? userLoc?.lat : null;
    const uLng = showUser ? userLoc?.lng : null;
    const pathLen = Array.isArray(path) ? path.length : 0;
    const cLat = approxDrop?.lat ?? null;
    const cLng = approxDrop?.lng ?? null;
    const cRad = approxDrop?.radius ?? null;

    const sig = [pLat, pLng, uLat, uLng, pathLen, cLat, cLng, cRad]
      .map(v => (v == null ? "x" : String(+Number(v).toFixed(6))))
      .join("|");
    if (sig === lastSigRef.current) return;
    lastSigRef.current = sig;

    const google = window.google;

    // FIXED (marker update safe for both classic and AdvancedMarker)
    const addOrMove = (ref, pos, title, label) => {
      if (!pos?.lat || !pos?.lng || !mapRef.current) return;

      if (ref.current) {
        if ("setPosition" in ref.current) {
          ref.current.setPosition(pos); // classic Marker
        } else {
          ref.current.position = pos;   // AdvancedMarkerElement
        }
        return;
      }

      try {
        const pill = document.createElement("div");
        pill.style.cssText =
          "background:#0ea5a4;color:#fff;font-weight:800;border-radius:9999px;padding:4px 8px;font-size:12px";
        pill.textContent = label;
        ref.current = new google.maps.marker.AdvancedMarkerElement({
          map: mapRef.current,
          position: pos,
          title,
          content: pill,
        });
      } catch {
        ref.current = new google.maps.Marker({
          map: mapRef.current,
          position: pos,
          title,
          label,
        });
      }
    };

    // Pharmacy marker
    if (pLat && pLng) {
      addOrMove(pharmMarkerRef, { lat: pLat, lng: pLng }, "Pharmacy", "P");
    } else if (pharmMarkerRef.current) {
      if ("setMap" in pharmMarkerRef.current) pharmMarkerRef.current.setMap(null);
      else pharmMarkerRef.current.map = null;
      pharmMarkerRef.current = null;
    }

    // User marker
    if (uLat && uLng) {
      addOrMove(userMarkerRef, { lat: uLat, lng: uLng }, "Delivery Address", "U");
    } else if (userMarkerRef.current) {
      if ("setMap" in userMarkerRef.current) userMarkerRef.current.setMap(null);
      else userMarkerRef.current.map = null;
      userMarkerRef.current = null;
    }

    // Approximate drop circle
    if (cLat && cLng && cRad) {
      if (!circleRef.current) {
        circleRef.current = new google.maps.Circle({
          map: gmap,
          center: { lat: cLat, lng: cLng },
          radius: cRad,
          strokeColor: "#0ea5a4",
          strokeOpacity: 0.55,
          strokeWeight: 2,
          fillColor: "#0ea5a4",
          fillOpacity: 0.15,
        });
      } else {
        circleRef.current.setCenter({ lat: cLat, lng: cLng });
        circleRef.current.setRadius(cRad);
      }
    } else if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }

    // Polyline
    if (polyRef.current) {
      polyRef.current.setPath(Array.isArray(path) ? path : []);
    }

    // Fit bounds softly
    if (fitTimeoutRef.current) clearTimeout(fitTimeoutRef.current);
    fitTimeoutRef.current = setTimeout(() => {
      const bounds = new google.maps.LatLngBounds();
      if (pLat && pLng) bounds.extend({ lat: pLat, lng: pLng });
      if (uLat && uLng) bounds.extend({ lat: uLat, lng: uLng });
      (Array.isArray(path) ? path : []).forEach(pt => bounds.extend(pt));
      if (cLat && cLng && cRad) {
        const lat = cLat, lng = cLng;
        const dLat = cRad / 111320;
        const dLng = cRad / (111320 * Math.cos((lat * Math.PI) / 180));
        bounds.extend({ lat: lat + dLat, lng });
        bounds.extend({ lat: lat - dLat, lng });
        bounds.extend({ lat, lng: lng + dLng });
        bounds.extend({ lat, lng: lng - dLng });
      }

      if (!bounds.isEmpty()) {
        gmap.fitBounds(bounds, { top: 20, right: 20, bottom: 20, left: 20 });
        const once = google.maps.event.addListenerOnce(gmap, "idle", () => {
          const z = gmap.getZoom();
          if (z > 16) gmap.setZoom(16);
        });
        setTimeout(() => google.maps.event.removeListener(once), 0);
      }
    }, 120);
  }, [center, pharmacyLoc, userLoc, path, showPharmacy, showUser, approxDrop]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "230px", borderRadius: 18, overflow: "hidden" }}
    />
  );
}

/* -------------------------------- component -------------------------------- */
export default function DeliveryDashboard() {
  const [loggedIn, setLoggedIn] = useState(() => {
    const t = localStorage.getItem("deliveryToken");
    const id = localStorage.getItem("deliveryPartnerId");
    return !!(t && id);
  });
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
  const inflightRef = useRef(false); // <<< prevent overlapping polls
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [loginDialog, setLoginDialog] = useState(!loggedIn);
  const [loginForm, setLoginForm] = useState({ mobile: "", password: "" });
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetPhase, setResetPhase] = useState(0);
  const [forgotForm, setForgotForm] = useState({ mobile: "", otp: "", newPassword: "" });
  const [polylines, setPolylines] = useState({});
  const [orderDistances, setOrderDistances] = useState({});
  const [orderUnreadCounts, setOrderUnreadCounts] = useState({});

  // NEW: driver live location
  const [driverLoc, setDriverLoc] = useState(null); // {lat, lng}

  // NEW: masked approximate drop centers per order (privacy)
  const [maskedDrops, setMaskedDrops] = useState({}); // { [orderId]: {lat, lng, radius} }

  // Live Ops UI
  const [autoAccept, setAutoAccept] = useState(() => localStorage.getItem("gd_auto_accept") === "1");
  const [onBreak, setOnBreak] = useState(false);
  const [breakRemaining, setBreakRemaining] = useState(0);

  // glance UI
  const [todayEarnings, setTodayEarnings] = useState(null);
  const [cashDue, setCashDue] = useState(0);

  // NEW: Instant offer popup state + audio
  const [offer, setOffer] = useState(null); // {orderId, pharmacy, total, ...}
  const [offerDeadline, setOfferDeadline] = useState(null); // epoch ms
  const [left, setLeft] = useState(0);
  const offerAudioRef = useRef(null);
  const offerLoopRef = useRef(null);

  // Auto-refresh orders (poll)
  useEffect(() => {
    if (!loggedIn) return;
    const tick = async () => {
      if (inflightRef.current) return;
      inflightRef.current = true;
      try {
        await fetchProfileAndOrders();
      } finally {
        inflightRef.current = false;
      }
    };
    // run immediately, then every 3s
    tick();
    const interval = setInterval(tick, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, tab]);

  // Send driver location while ACTIVE + keep local copy for routing to pickup
  useEffect(() => {
    if (!loggedIn || !partner?._id || !active) return;
    let watchId;
    const send = async (coords) => {
      const { latitude, longitude } = coords;
      setDriverLoc({ lat: latitude, lng: longitude }); // local
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
  if (!loggedIn || !partner?._id) return;

  let watcherId;

  (async () => {
    try {
      if (!active) return; // only track when rider is active

      // Start background location (Android keeps running when app is minimized/locked)
      watcherId = await BackgroundGeolocation.addWatcher(
        {
          // shown while running as a foreground service
          backgroundTitle: 'GoDavaii Delivery',
          backgroundMessage: 'Sharing your live location',
          // tuning
          distanceFilter: 25,          // meters between updates
          stale: false,
          requestPermissions: true,    // ask on first run
          stopOnTerminate: false       // keep tracking after app is killed (Android)
          // Some versions also accept: interval: 8000, fastestInterval: 5000
        },
        async (position, error) => {
          if (error) return; // ignore transient errors
          const { latitude, longitude } = position;
          setDriverLoc({ lat: latitude, lng: longitude });
          try {
            await axios.post(`${API_BASE_URL}/api/delivery/update-location`, {
              partnerId: partner._id,
              lat: latitude,
              lng: longitude,
            });
          } catch {}
        }
      );
    } catch {
      // likely running on web or no permission — silently ignore
    }
  })();

  return () => {
    // stop background watcher when leaving the screen or toggling inactive
    if (watcherId) BackgroundGeolocation.removeWatcher({ id: watcherId });
  };
}, [active, loggedIn, partner?._id]);


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

  // Unread chat counts
  useEffect(() => {
    if (!loggedIn || !orders.length) return;
    const token = localStorage.getItem("deliveryToken");
    if (!token) return;
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
          } catch {
            counts[order._id] = 0; // don't logout on chat errors
          }
        })
      );
      if (!cancelled) setOrderUnreadCounts(counts);
    };

    fetchUnread();
    unreadTimerRef.current = setInterval(fetchUnread, 7000);
    return () => {
      cancelled = true;
      if (unreadTimerRef.current) clearInterval(unreadTimerRef.current);
    };
  }, [orders, loggedIn]);

  // Persist auto-accept
  useEffect(() => {
    localStorage.setItem("gd_auto_accept", autoAccept ? "1" : "0");
  }, [autoAccept]);

  // Break timer
  useEffect(() => {
    if (!onBreak || breakRemaining <= 0) return;
    const t = setInterval(() => setBreakRemaining((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [onBreak, breakRemaining]);

  useEffect(() => {
    if (onBreak && breakRemaining <= 0) {
      setOnBreak(false);
      setSnackbar({ open: true, message: "Break finished — back online!", severity: "success" });
    }
  }, [onBreak, breakRemaining]);

  // Today earnings glance
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

  // central fetch (SAFE: only logout on 401/403 or missing creds)
  const fetchProfileAndOrders = async () => {
    const token = localStorage.getItem("deliveryToken");
    const partnerId = localStorage.getItem("deliveryPartnerId");
    if (!token || !partnerId) {
      hardLogout("Session missing. Please login again.");
      return;
    }

    let resProfile, resOrders;
    try {
      resProfile = await axios.get(`${API_BASE_URL}/api/delivery/partner/${partnerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      resOrders = await axios.get(`${API_BASE_URL}/api/delivery/orders`, {
        headers: { Authorization: `Bearer ${token}`, deliverypartnerid: partnerId }
      });
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        hardLogout("Session expired. Please login again.");
      } else {
        // transient/server error — DO NOT logout
        setSnackbar({ open: true, message: "Network issue. Retrying…", severity: "error" });
      }
      return;
    }

    // basic state set from API
    setPartner(resProfile.data.partner || {});
    setActive(resProfile.data.partner?.active || false);
    const activeOrders = resOrders.data || [];
    setOrders(activeOrders);
    setPastOrders(resProfile.data.pastOrders || []);

    // Build masked drop cache once per order (non-fatal)
    try {
      const nextMasked = { ...maskedDrops };
      for (const o of activeOrders) {
        const user = o.address;
        if (!nextMasked[o._id] && user?.lat && user?.lng) {
          const j = jitterLatLng(user.lat, user.lng, 400);
          nextMasked[o._id] = { lat: j.lat, lng: j.lng, radius: 400 };
        }
      }
      setMaskedDrops(nextMasked);
    } catch {}

    // Build polylines & distances (non-fatal; isolated try so errors cannot log out)
    try {
      const newPolys = {};
      const newDistances = {};
      for (const o of activeOrders) {
        const pharm = o.pharmacy?.location;
        const user  = o.address;
        const hasPharm = pharm?.lat && pharm?.lng;
        const hasUser  = user?.lat && user?.lng;

        let origin = null;
        let destination = null;

        if (o.status === "out_for_delivery") {
          if (hasPharm && hasUser) {
            origin = pharm;
            destination = user;
          }
        } else if (hasPharm) {
          origin = driverLoc || pharm;
          destination = pharm;
        }

        if (origin && destination && (!polylines[o._id] || orderDistances[o._id] == null)) {
          const { poly, distanceKm } = await getRouteAndDistance(origin, destination);
          newPolys[o._id] = poly;
          newDistances[o._id] = distanceKm;
        } else {
          if (polylines[o._id]) newPolys[o._id] = polylines[o._id];
          if (orderDistances[o._id] != null) newDistances[o._id] = orderDistances[o._id];
        }
      }
      setPolylines(newPolys);
      setOrderDistances(newDistances);
    } catch {
      // Maps/route errors should not affect session
    }
  };

  function hardLogout(message) {
    localStorage.removeItem("deliveryToken");
    localStorage.removeItem("deliveryPartnerId");
    setLoggedIn(false);
    setPartner(null);
    setOrders([]);
    setPastOrders([]);
    setLoginDialog(true);
    setSnackbar({ open: true, message: message || "Logged out", severity: "error" });
  }

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const token = localStorage.getItem("deliveryToken");
      await axios.patch(`${API_BASE_URL}/api/delivery/orders/${orderId}/status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSnackbar({ open: true, message: `Order marked as ${newStatus}`, severity: "success" });
      await fetchProfileAndOrders();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) return hardLogout("Session expired. Please login again.");
      setSnackbar({ open: true, message: "Failed to update order status", severity: "error" });
    }
  };

  // Auth
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
    hardLogout("Logged out");
  };

  // Forgot / Reset
  const handleForgotStart = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/delivery/forgot-password`, { mobile: forgotForm.mobile });
      setSnackbar({ open: true, message: "OTP sent to mobile!", severity: "success" });
      setResetPhase(1);
    } catch {
      setSnackbar({ open: true, message: "Mobile not found!", severity: "error" });
    }
  };
  const handleResetPassword = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/delivery/reset-password`, {
        mobile: forgotForm.mobile, otp: forgotForm.otp, newPassword: forgotForm.newPassword,
      });
      setSnackbar({ open: true, message: "Password reset! Please log in.", severity: "success" });
      setForgotOpen(false);
      setResetPhase(0);
      setForgotForm({ mobile: "", otp: "", newPassword: "" });
    } catch {
      setSnackbar({ open: true, message: "Invalid OTP or error", severity: "error" });
    }
  };

  /* ------------------------------- NEW: PUSH ------------------------------- */
  useEffect(() => {
    (async () => {
      if (!loggedIn || !partner?._id) return;
      // web gets Notification API; native gets FCM via Capacitor
      if (Capacitor.isNativePlatform?.()) {
        try {
          const perm = await PushNotifications.requestPermissions();
          if (perm.receive === "granted") {
            await PushNotifications.register();
          }
          const onReg = PushNotifications.addListener("registration", async (token) => {
            try {
              await axios.post(`${API_BASE_URL}/api/delivery/register-device-token`, {
                partnerId: partner._id,
                token: token.value,
                platform: "android",
              });
            } catch {}
          });
          const onError = PushNotifications.addListener("registrationError", () => {});
          const onReceive = PushNotifications.addListener("pushNotificationReceived", () => {});
          return () => {
            onReg.remove();
            onError.remove();
            onReceive.remove();
          };
        } catch {}
      } else {
        // Ask web Notification permission once
        if ("Notification" in window && Notification.permission === "default") {
          try { await Notification.requestPermission(); } catch {}
        }
      }
    })();
  }, [loggedIn, partner?._id]);

  /* ------------------------------- NEW: SSE ------------------------------- */
  useEffect(() => {
    if (!loggedIn || !partner?._id) return;
    let es;
    try {
      es = new EventSource(`${API_BASE_URL}/api/delivery/stream/${partner._id}`);
      es.addEventListener("offer", (ev) => {
        const payload = JSON.parse(ev.data || "{}");
        if (!payload?.orderId) return;
        // avoid duplicate modal if already fetched via polling
        const alreadyHave = orders.some(o => String(o._id) === String(payload.orderId));
        if (alreadyHave) return;

        setOffer(payload);
        const deadline = Date.now() + 25_000; // 25s to respond
        setOfferDeadline(deadline);
        setLeft(Math.ceil((deadline - Date.now()) / 1000));

        // play sound + vibrate + optional web heads-up
        try {
          if (!offerAudioRef.current) {
            offerAudioRef.current = new Audio("/sounds/offer.mp3");
          }
          // loop every ~3s while modal is open
          offerAudioRef.current.currentTime = 0;
          offerAudioRef.current.play().catch(() => {});
          if (offerLoopRef.current) clearInterval(offerLoopRef.current);
          offerLoopRef.current = setInterval(() => {
            if (offerAudioRef.current) {
              offerAudioRef.current.currentTime = 0;
              offerAudioRef.current.play().catch(() => {});
            }
          }, 3000);
        } catch {}
        try { if (navigator.vibrate) navigator.vibrate([150, 80, 150, 80, 300]); } catch {}
        try {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("New delivery offer", { body: "Tap to open GoDavaii", tag: "gd-offer" });
          }
        } catch {}
      });
    } catch {}

    return () => {
      if (es) es.close();
    };
    // include orders.length so if new order appears via poll, we won't keep stale modal
  }, [loggedIn, partner?._id, orders.length]);

  // NEW: countdown for offer
  useEffect(() => {
    if (!offerDeadline) return;
    const t = setInterval(async () => {
      const secs = Math.max(0, Math.ceil((offerDeadline - Date.now()) / 1000));
      setLeft(secs);
      if (secs === 0) {
        // auto-dismiss + attempt reject (non-fatal)
        const id = offer?.orderId;
        setOffer(null);
        setOfferDeadline(null);
        try {
          if (id) {
            const token = localStorage.getItem("deliveryToken");
            await axios.patch(`${API_BASE_URL}/api/delivery/orders/${id}/reject`, {}, {
              headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
          }
        } catch {}
      }
    }, 200);
    return () => clearInterval(t);
  }, [offerDeadline, offer?.orderId]);

  // Stop audio when modal closes
  useEffect(() => {
    if (!offer) {
      if (offerLoopRef.current) {
        clearInterval(offerLoopRef.current);
        offerLoopRef.current = null;
      }
      try { offerAudioRef.current && offerAudioRef.current.pause(); } catch {}
    }
  }, [offer]);

  // Ask web Notification permission on mount (no-op if already granted/denied)
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      try { Notification.requestPermission(); } catch {}
    }
  }, []);

  if (!loggedIn) {
    return (
      <Dialog open={loginDialog} onOpenChange={() => {}}>
        <DialogContent className="force-light sm:max-w-md">
          <DialogHeader><DialogTitle className="text-emerald-800 font-extrabold">Delivery Partner Login</DialogTitle></DialogHeader>
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
            <Button type="button" variant="ghost" className="w-full btn-ghost-soft !font-bold" onClick={() => setForgotOpen(true)}>Forgot Password?</Button>
          </form>

          <Dialog open={forgotOpen} onOpenChange={(open) => { setForgotOpen(open); if (!open) setResetPhase(0); }}>
            <DialogContent className="force-light sm:max-w-md">
              <DialogHeader><DialogTitle>Forgot Password</DialogTitle></DialogHeader>
              {resetPhase === 0 ? (
                <div className="space-y-3">
                  <div className="grid gap-1.5">
                    <Label>Registered Mobile</Label>
                    <Input value={forgotForm.mobile} onChange={e => setForgotForm(f => ({ ...f, mobile: e.target.value }))} />
                  </div>
                  <DialogFooter><Button onClick={handleForgotStart} className="btn-primary-emerald !font-bold">Send OTP</Button></DialogFooter>
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
                  <DialogFooter><Button onClick={handleResetPassword} className="btn-primary-emerald !font-bold">Reset Password</Button></DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <AnimatePresence>
            {snackbar.open && (
              <motion.div
                initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
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

  const tabsValue = tab === 0 ? "active" : tab === 1 ? "past" : "earnings";
  const todayStr = dayjs().format("YYYY-MM-DD");
  const deliveriesToday = (pastOrders || []).filter(o => o.status === "delivered" && dayjs(o.createdAt).format("YYYY-MM-DD") === todayStr).length;
  const rph = null;

  return (
    <div className="mx-auto max-w-[900px] px-3 pt-4 pb-16">
      {/* header */}
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/60 bg-white p-3 shadow-sm">
        <Avatar className="h-14 w-14 ring-2 ring-emerald-100">
          {partner?.avatar ? <AvatarImage src={partner.avatar} alt={partner?.name || "Partner"} /> :
            <AvatarFallback className="bg-emerald-600 text-white font-bold">{(partner?.name || "D").charAt(0).toUpperCase()}</AvatarFallback>}
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="text-lg font-extrabold text-emerald-900 truncate">{partner?.name}</div>
          <div className="text-sm text-slate-600 truncate">{partner?.mobile} <span className="mx-2">|</span> {partner?.city}, {partner?.area}</div>

          {/* Live Ops & Availability */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-white px-3 py-2">
              <Switch
                checked={active}
                onCheckedChange={async (next) => {
                  setActive(next);
                  const token = localStorage.getItem("deliveryToken");
                  if (navigator.geolocation && next) {
                    navigator.geolocation.getCurrentPosition((pos) => {
                      axios.patch(`${API_BASE_URL}/api/delivery/partner/${partner._id}/active`,
                        { active: next, lat: pos.coords.latitude, lng: pos.coords.longitude },
                        { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
                    });
                  } else {
                    await axios.patch(`${API_BASE_URL}/api/delivery/partner/${partner._id}/active`,
                      { active: next }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
                  }
                }}
              />
              <span className={`text-sm font-bold ${active ? "text-emerald-600" : "text-red-600"}`}>{active ? "Active" : "Inactive"}</span>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-white px-3 py-2">
              <span className="text-sm font-semibold text-emerald-900">Auto-accept</span>
              <Switch
                checked={autoAccept}
                onCheckedChange={async (v) => {
                  setAutoAccept(v);
                  setSnackbar({ open: true, message: v ? "Auto-accept enabled" : "Auto-accept disabled", severity: v ? "success" : "error" });
                  try {
                    const token = localStorage.getItem("deliveryToken");
                    await axios.patch(`${API_BASE_URL}/api/delivery/partner/${partner?._id}/active`,
                      { autoAccept: v }, { headers: { Authorization: `Bearer ${token}` } });
                  } catch {}
                }}
              />
            </div>

            <Badge className="bg-amber-400 text-emerald-900 font-bold">Cash to deposit: ₹{cashDue ?? 0}</Badge>
          </div>

          <div className="mt-2 flex items-center gap-2">
            {!onBreak ? (
              <Button size="sm" variant="outline" className="!font-bold" onClick={() => { setOnBreak(true); setBreakRemaining(10 * 60); }}>
                <AlarmClock className="h-4 w-4 mr-1" /> Start 10-min Break
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600"><TimerReset className="h-3.5 w-3.5 mr-1" /> {mmss(breakRemaining)}</Badge>
                <Button size="sm" variant="outline" className="!font-bold" onClick={() => { setOnBreak(false); setBreakRemaining(0); }}>
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

      {/* glance */}
      <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl border border-emerald-200/60 bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><DollarSign className="h-4 w-4 text-emerald-600" /> Today</div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-700">{todayEarnings == null ? "—" : `₹${todayEarnings.toLocaleString("en-IN")}`}</div>
        </div>
        <div className="rounded-xl border border-emerald-200/60 bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><CheckCheck className="h-4 w-4 text-emerald-600" /> Deliveries (Today)</div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-700">{deliveriesToday}</div>
        </div>
        <div className="rounded-xl border border-emerald-200/60 bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Gauge className="h-4 w-4 text-emerald-600" /> ₹ / hr</div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-700">—</div>
        </div>
      </div>

      {/* tabs */}
      <div className="mt-4">
        <Tabs value={tabsValue} onValueChange={(v) => setTab(v === "active" ? 0 : v === "past" ? 1 : 2)}>
          <TabsList className="grid w-full grid-cols-3 rounded-xl bg-transparent p-0">
            <TabsTrigger value="active" className="bg-transparent data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=inactive]:text-slate-600 !font-extrabold">Active Orders</TabsTrigger>
            <TabsTrigger value="past" className="bg-transparent data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=inactive]:text-slate-600 !font-extrabold">Past Orders</TabsTrigger>
            <TabsTrigger value="earnings" className="bg-transparent data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=inactive]:text-slate-600 !font-extrabold">Earnings</TabsTrigger>
          </TabsList>

          {/* ACTIVE */}
          <TabsContent value="active" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading...
              </div>
            ) : (
              <div className="space-y-4">
                {orders.length === 0 && <div className="text-center text-slate-500">No active orders assigned to you.</div>}

                {orders.map((order) => {
                  const pharmacyLoc = order.pharmacy?.location;
                  const userLoc = order.address;

                  // GeoJSON safeguard
                  let patchedPharmacyLoc = pharmacyLoc;
                  if (pharmacyLoc && Array.isArray(pharmacyLoc.coordinates) && pharmacyLoc.coordinates.length === 2) {
                    patchedPharmacyLoc = { ...pharmacyLoc, lat: pharmacyLoc.coordinates[1], lng: pharmacyLoc.coordinates[0] };
                  }
                  let patchedUserLoc = userLoc;
                  if (userLoc && Array.isArray(userLoc.coordinates) && userLoc.coordinates.length === 2) {
                    patchedUserLoc = { ...userLoc, lat: userLoc.coordinates[1], lng: userLoc.coordinates[0] };
                  }

                  const poly = polylines[order._id] || [];

                  // Phase flags
                  const isOFD = order.status === "out_for_delivery";
                  const showPharmacy = !isOFD && order.status !== "delivered";
                  const showUser     = isOFD; // exact pin only after OFD

                  // Approximate drop (privacy) before OFD
                  const approxDrop = !isOFD ? maskedDrops[order._id] : null;

                  // Map center preference
                  const mapCenter =
                    (showPharmacy && patchedPharmacyLoc?.lat && patchedPharmacyLoc?.lng)
                      ? { lat: patchedPharmacyLoc.lat, lng: patchedPharmacyLoc.lng }
                      : (showUser && patchedUserLoc?.lat && patchedUserLoc?.lng)
                        ? { lat: patchedUserLoc.lat, lng: patchedUserLoc.lng }
                        : { lat: 19.076, lng: 72.877 };

                  // ETA estimate (~22 km/h)
                  const dist = orderDistances[order._id];
                  const etaMin = dist != null ? Math.max(3, Math.round((dist / 22) * 60)) : null;

                  // Navigation targets:
                  const navOrigin = isOFD
                    ? `${patchedPharmacyLoc?.lat},${patchedPharmacyLoc?.lng}`
                    : (driverLoc ? `${driverLoc.lat},${driverLoc.lng}` : `${patchedPharmacyLoc?.lat},${patchedPharmacyLoc?.lng}`);

                  const navDestination = isOFD
                    ? `${patchedUserLoc?.lat},${patchedUserLoc?.lng}`
                    : `${patchedPharmacyLoc?.lat},${patchedPharmacyLoc?.lng}`;

                  return (
                    <motion.div key={order._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-emerald-200/60 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Pill className="h-5 w-5 text-emerald-600" />
                        <div className="font-semibold">
                          Pharmacy: <span className="text-emerald-700 font-extrabold">{order.pharmacy?.name || order.pharmacy}</span>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          {dist != null && <Badge className="bg-emerald-100 text-emerald-800 font-bold">{dist.toFixed(2)} km</Badge>}
                          {etaMin != null && <Badge className="bg-emerald-600">ETA ~ {etaMin} min</Badge>}
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
                              {isOFD
                                ? (order.address?.formatted || order.address?.fullAddress ||
                                  [order.address?.addressLine, order.address?.floor, order.address?.landmark, order.address?.area, order.address?.city, order.address?.state, order.address?.pin]
                                    .filter(Boolean).join(", "))
                                : (order.address?.area || order.address?.city || "Nearby area")}
                            </b>
                          </span>
                        </div>
                        <div className="mt-1">Amount: ₹{order.total || order.amount || 0}</div>
                        <div className="mt-1">
                          Items: {order.items.map((item, i) => (<span key={i} className="text-slate-800">{item.name} x{item.qty || item.quantity}; </span>))}
                        </div>
                      </div>

                      {/* map */}
                      {!patchedPharmacyLoc?.lat ? (
                        <div className="text-xs text-slate-400 mt-2">Pharmacy location missing</div>
                      ) : !patchedUserLoc?.lat ? (
                        <div className="text-xs text-slate-400 mt-2">Customer location missing</div>
                      ) : (
                        <div className="mt-3">
                          <OrderMiniMap
                            center={mapCenter}
                            pharmacyLoc={patchedPharmacyLoc}
                            userLoc={patchedUserLoc}
                            path={poly}
                            showPharmacy={showPharmacy}
                            showUser={showUser}
                            approxDrop={approxDrop}
                          />

                          {/* Navigation: default two_wheeler */}
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <Button asChild variant="outline" className="!font-bold h-9 w-full">
                              <a
                                target="_blank"
                                rel="noreferrer"
                                href={
                                  `https://www.google.com/maps/dir/?api=1` +
                                  `&origin=${navOrigin}` +
                                  `&destination=${navDestination}` +
                                  `&travelmode=two_wheeler`
                                }
                              >
                                <Navigation className="h-4 w-4 mr-2" /> Google Maps
                              </a>
                            </Button>
                            <Button asChild variant="outline" className="!font-bold h-9 w-full">
                              <a
                                target="_blank"
                                rel="noreferrer"
                                href={`http://maps.apple.com/?saddr=${navOrigin}&daddr=${navDestination}`}
                              >
                                <Navigation className="h-4 w-4 mr-2" /> Apple Maps
                              </a>
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* actions */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {order.status === "assigned" && (
                          <>
                            <Button className="btn-primary-emerald !font-extrabold" onClick={() => handleUpdateStatus(order._id, "accepted")}>Accept Order</Button>
                            <Button onClick={() => handleUpdateStatus(order._id, "rejected")}
                              className="!font-extrabold bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border border-red-700/80 shadow-sm">
                              Reject
                            </Button>
                          </>
                        )}
                        {order.status === "accepted" && (
                          <Button onClick={() => handleUpdateStatus(order._id, "out_for_delivery")}
                            className="!font-extrabold bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-emerald-950 border border-amber-500/70 shadow-sm">
                            <Bike className="h-4 w-4 mr-2" /> MARK AS OUT FOR DELIVERY
                          </Button>
                        )}
                        {order.status === "out_for_delivery" && (
                          <Button onClick={() => handleUpdateStatus(order._id, "delivered")}
                            className="bg-emerald-600 hover:bg-emerald-700 !font-extrabold text-white">
                            <CheckCheck className="h-4 w-4 mr-2" /> Mark as Delivered
                          </Button>
                        )}
                        {order.status === "delivered" && <Badge className="bg-emerald-600">Delivered</Badge>}

                        <div className="basis-full h-0" />
                        <div className="w-full flex flex-wrap gap-2">
                          {["Reaching in 5–7 mins","Outside your gate","Call me if needed"].map((txt) => (
                            <Button key={txt} size="sm" variant="secondary" className="rounded-full !font-bold"
                              onClick={async () => { try { await navigator.clipboard.writeText(txt); } catch {} ; setSnackbar({ open:true, message:"Canned reply copied", severity:"success" }); }}>
                              {txt}
                            </Button>
                          ))}
                        </div>

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
                                try { await axios.patch(`${API_BASE_URL}/api/chat/${order._id}/user-chat-seen`, {}, { headers: { Authorization: `Bearer ${token}` } }); } catch {}
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
                {pastOrders.length === 0 && <div className="text-center text-slate-500">No past orders delivered yet.</div>}
                {pastOrders.map((order) => (
                  <motion.div key={order._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-emerald-200/60 bg-white p-4 shadow-sm">
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

      {/* NEW: Incoming Offer Modal */}
      <Dialog open={!!offer} onOpenChange={(o)=>{ if(!o){ setOffer(null); setOfferDeadline(null); }}}>
        <DialogContent className="force-light sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-emerald-600" />
              New Delivery Offer
            </DialogTitle>
          </DialogHeader>

          {offer && (
            <div className="space-y-2">
              <div className="text-sm text-slate-600">
                Pharmacy: <b>{offer?.pharmacy?.name || "Pharmacy"}</b>
              </div>
              <div className="text-sm text-slate-600">
                Payout estimate: <b>₹{Math.round((offer.total || 0) * 0.08)}</b>
              </div>
              <div className="mt-2">
                <Badge className="bg-emerald-600 text-white font-bold">
                  Respond in {left}s
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  className="btn-primary-emerald !font-extrabold"
                  onClick={async () => {
                    try {
                      await handleUpdateStatus(offer.orderId, "accepted");
                    } finally {
                      setOffer(null); setOfferDeadline(null);
                    }
                  }}
                >
                  Accept
                </Button>
                <Button
                  className="!font-extrabold bg-red-600 hover:bg-red-700 text-white"
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem("deliveryToken");
                      await axios.patch(`${API_BASE_URL}/api/delivery/orders/${offer.orderId}/reject`, {}, {
                        headers: token ? { Authorization: `Bearer ${token}` } : undefined
                      });
                    } catch {}
                    setOffer(null); setOfferDeadline(null);
                  }}
                >
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CHAT MODAL */}
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

      {/* SOS */}
      <Button
        className="fixed bottom-24 right-4 z-[2000] bg-red-600 hover:bg-red-700 font-extrabold shadow-lg"
        onClick={() => setSnackbar({ open: true, message: "SOS sent to support (demo)", severity: "error" })}
      >
        <ShieldAlert className="h-4 w-4 mr-2" /> SOS
      </Button>

      {/* Snackbar */}
      <AnimatePresence>
        {snackbar.open && (
          <motion.div
            initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
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
