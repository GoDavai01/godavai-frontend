// src/components/PharmacyDashboard.js
import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Box, Button, TextField, Stack, Chip,
  Snackbar, Alert, createTheme, IconButton,
  MenuItem, Select, InputLabel, FormControl, Dialog, DialogContent,
  DialogActions, Switch,
  Checkbox, ListItemText
} from "@mui/material";
// eslint-disable-next-line no-unused-vars
import Autocomplete from "@mui/material/Autocomplete";
// eslint-disable-next-line no-unused-vars
import EditIcon from "@mui/icons-material/Edit";
// eslint-disable-next-line no-unused-vars
import DeleteIcon from "@mui/icons-material/Delete";
// eslint-disable-next-line no-unused-vars
import CloseIcon from "@mui/icons-material/Close";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PhotoCamera from "@mui/icons-material/PhotoCamera";
// eslint-disable-next-line no-unused-vars
import SearchIcon from "@mui/icons-material/Search";
import BrandAutocomplete from "./fields/BrandAutocomplete";
import CompositionAutocomplete from "./fields/CompositionAutocomplete";
import { postSuggestLearn } from "../api/suggest";
import PharmacySettlementTab from "./PharmacySettlementTab";

import { motion, AnimatePresence } from "framer-motion";
import {
  Pill,
  MapPin,
  Wallet,
  FileDown,
  BadgeCheck,
  LogOut,
  Package,
  Settings,
  RefreshCw,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  ShieldCheck
} from "lucide-react";

// eslint-disable-next-line no-unused-vars
import { Card as SCard, CardHeader as SCardHeader, CardTitle as SCardTitle, CardContent as SCardContent } from "./ui/card";

import stringSimilarity from "string-similarity";
import PrescriptionOrdersTab from "./PrescriptionOrdersTab";
import axios from "axios";
import { TYPE_OPTIONS, PACK_SIZES_BY_TYPE } from "../constants/packSizes";
import { CUSTOMER_CATEGORIES } from "../constants/customerCategories";

// ========== (A) NEW IMPORTS ==========
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
// =====================================

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

/* ---------------------------- UTILITIES ---------------------------- */

// Theme kept for MUI components that need it
// eslint-disable-next-line no-unused-vars
const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#059669" },
    secondary: { main: "#10b981" },
    success: { main: "#059669" },
    background: { default: "#f7fcf9", paper: "#ffffff" },
    text: { primary: "#0f172a", secondary: "#334155" }
  }
});

function formatRupees(val) {
  const n = Number(val || 0);
  const isInt = Number.isInteger(n);
  return "₹" + n.toLocaleString("en-IN", {
    minimumFractionDigits: isInt ? 0 : 2,
    maximumFractionDigits: isInt ? 0 : 2,
  });
}
function todayString() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d) { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x; }
function ymd(date) { const d = new Date(date); return d.toISOString().slice(0,10); }
function ym(date) { const d = new Date(date); const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2,"0"); return `${y}-${m}`; }
function weekLabel(date) { const s = startOfWeek(date); return `Week of ${ymd(s)}`; }

// Accept "60 ml" or "10 tablets" or an object {count, unit, label}
const normalizePackOpt = (raw) => {
  if (!raw) return { count: "", unit: "", label: "" };
  if (typeof raw === "string") {
    // accept "10" or "10 tab" or "60 ml"
    const m = raw.trim().match(/^(\d+)(?:\s*([A-Za-z]+)s?)?$/);
    if (!m) return { count: "", unit: "", label: raw };
    const [, count, unit = "" ] = m;
    const u = unit.toLowerCase();
    const label = u ? `${count} ${u}` : `${count}`;
    return { count, unit: u, label };
  }
  const count = String(raw.count ?? "").trim();
  const unit  = String(raw.unit ?? "").trim().toLowerCase();
  const label = raw.label || (count && unit ? `${count} ${unit}` : `${count}`);
  return { count, unit, label };
};

const packLabel = (count, unit) => {
  if (!count) return "";
  const u = String(unit || "").toLowerCase();
  if (!u) return String(count); // <- key fix: allow plain "10" etc for Tablet/Capsule
  const printable = (u === "ml" || u === "g")
    ? u
    : (Number(count) === 1 ? u.replace(/s$/, "") : (u.endsWith("s") ? u : u + "s"));
  return `${count} ${printable}`;
};

const keepUnlessExplicitClear = (prev, next) =>
  next === null ? "" : (typeof next === "string" && next.trim() === "" ? prev : next);

// ▼▼ NEW: utilities for multi-composition ▼▼
const splitComps = (s = "") =>
  String(s).split("+").map(x => x.trim()).filter(Boolean);

const joinComps = (arr = []) =>
  arr.map(s => s.trim()).filter(Boolean).join(" + ");
// ▲▲ END NEW ▲▲

/* ----------------------- STATUS / MISC HELPERS ---------------------- */

function getStatusLabel(status) {
  if (status === "quoted") return "Quote Sent - Awaiting User";
  if (status === 0 || status === "placed" || status === "pending") return "Placed";
  if (status === 1 || status === "processing") return "Processing";
  if (status === 2 || status === "out_for_delivery") return "Out for Delivery";
  if (status === 3 || status === "delivered") return "Delivered";
  if (status === -1 || status === "rejected") return "Rejected";
  return "Unknown";
}
// eslint-disable-next-line no-unused-vars
function getStatusColor(status) {
  if (status === "quoted") return "warning";
  if (status === 3 || status === "delivered") return "success";
  if (status === 2 || status === "out_for_delivery") return "secondary";
  if (status === 1 || status === "processing") return "primary";
  if (status === -1 || status === "rejected") return "error";
  return "default";
}

// eslint-disable-next-line no-unused-vars
const linkBrandToName = (val) => val;

/* ---------------------------- EARNINGS TAB ---------------------------- */

function EarningsTab({ payouts, token }) {
  // unchanged logic
  const totalAll = payouts.reduce((s, p) => s + (p.pharmacyAmount || 0), 0);
  const largest = payouts.reduce((m, p) => Math.max(m, Number(p.pharmacyAmount || 0)), 0);
  const avg = payouts.length ? totalAll / payouts.length : 0;

  const byDayMap = new Map();
  const byWeekMap = new Map();
  const byMonthMap = new Map();

  payouts.forEach((p) => {
    const d = new Date(p.createdAt);
    const kDay = ymd(d);
    const kWeek = ymd(startOfWeek(d));
    const kMonth = ym(d);

    byDayMap.set(kDay, (byDayMap.get(kDay) || 0) + (p.pharmacyAmount || 0));
    byWeekMap.set(kWeek, (byWeekMap.get(kWeek) || 0) + (p.pharmacyAmount || 0));
    byMonthMap.set(kMonth, (byMonthMap.get(kMonth) || 0) + (p.pharmacyAmount || 0));
  });

  const daily = Array.from(byDayMap.entries())
    .map(([key, amount]) => ({ key, date: new Date(key), amount }))
    .sort((a,b) => b.date - a.date)
    .slice(0, 30);

  const weekly = Array.from(byWeekMap.entries())
    .map(([key, amount]) => ({ key, date: new Date(key), amount }))
    .sort((a,b) => b.date - a.date)
    .slice(0, 12);

  const monthly = Array.from(byMonthMap.entries())
    .map(([key, amount]) => ({ key, date: new Date(key + "-01"), amount }))
    .sort((a,b) => b.date - a.date)
    .slice(0, 12);

  const [view, setView] = useState("daily");
  const [payoutsPage, setPayoutsPage] = useState(1);
  const PAYOUTS_PER_PAGE = 10;

  // Order details come pre-populated from pay.orderId (no individual fetch needed)

  const rows = view === "daily" ? daily : view === "weekly" ? weekly : monthly;

  return (
    <div>
      {/* KPI Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Total Earnings", value: formatRupees(totalAll), Icon: Wallet },
          { label: "Payouts", value: payouts.length, Icon: BadgeCheck },
          { label: "Avg Payout", value: formatRupees(avg), Icon: Wallet },
          { label: "Largest", value: formatRupees(largest), Icon: Wallet },
        ].map(({ label, value, Icon }, idx) => (
          <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
            <div style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(12,90,62,0.08)", borderRadius: 18, padding: "14px 16px", boxShadow: "0 4px 16px rgba(16,24,40,0.03)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Icon size={14} color="#0A5A3B" />
                <span style={{ fontSize: 10, fontWeight: 800, color: "#6A7A73", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</span>
              </div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 900, color: "#10231A" }}>{value}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* View Switcher */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {["daily", "weekly", "monthly"].map((v) => (
          <motion.button key={v} whileTap={{ scale: 0.95 }} onClick={() => setView(v)}
            style={{
              padding: "8px 18px", borderRadius: 100, cursor: "pointer",
              background: view === v ? "#0A5A3B" : "rgba(255,255,255,0.92)",
              color: view === v ? "#fff" : "#6A7A73",
              fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 800,
              boxShadow: view === v ? "0 4px 14px rgba(10,90,59,0.25)" : "0 2px 8px rgba(16,24,40,0.03)",
              border: view === v ? "none" : "1px solid rgba(12,90,62,0.08)",
            }}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </motion.button>
        ))}
      </div>

      {/* Aggregated Rows */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(12,90,62,0.08)", borderRadius: 20, padding: 16, marginBottom: 16, boxShadow: "0 4px 16px rgba(16,24,40,0.03)" }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 900, color: "#10231A", marginBottom: 12 }}>
            {view === "daily" ? "Daily (last 30 days)" : view === "weekly" ? "Weekly (last 12 weeks)" : "Monthly (last 12 months)"}
          </div>
          {rows.length === 0 && <div style={{ color: "#6A7A73", fontSize: 13, fontWeight: 600, textAlign: "center", padding: 20 }}>No data yet.</div>}
          {rows.map((row, i) => (
            <div key={row.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < rows.length - 1 ? "1px solid rgba(12,90,62,0.06)" : "none" }}>
              <span style={{ fontSize: 12, color: "#6A7A73", fontWeight: 600 }}>{view === "weekly" ? weekLabel(row.date) : row.key}</span>
              <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 800, color: "#0A5A3B" }}>{formatRupees(row.amount)}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Payout Cards */}
      <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 900, color: "#10231A", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <Wallet size={16} color="#0A5A3B" /> All Payouts
      </div>
      {payouts.length === 0 && <div style={{ color: "#6A7A73", fontSize: 13, fontWeight: 600, textAlign: "center", padding: 30 }}>No payouts yet.</div>}
      {payouts
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, payoutsPage * PAYOUTS_PER_PAGE)
        .map((pay) => {
          const orderId = pay.orderId?._id;
          const order = pay.orderId || null;
          const itemsText = order?.items?.length ? order.items.map(i => `${i.name} x${i.qty || i.quantity || 1}`).join(", ") : "";
          return (
            <motion.div key={pay._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(12,90,62,0.08)", borderRadius: 16, padding: "12px 14px", marginBottom: 8, boxShadow: "0 2px 8px rgba(16,24,40,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800, color: "#10231A" }}>#{orderId ? orderId.slice(-5) : "—"}</span>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 900, color: "#0A5A3B" }}>{formatRupees(pay.pharmacyAmount)}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, color: "#6A7A73", fontWeight: 600 }}>{new Date(pay.createdAt).toLocaleDateString()}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: pay.status === "paid" ? "rgba(10,90,59,0.08)" : "rgba(245,158,11,0.1)", color: pay.status === "paid" ? "#0A5A3B" : "#d97706", textTransform: "capitalize" }}>{pay.status}</span>
                </div>
                {itemsText && <div style={{ fontSize: 11, color: "#6A7A73", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{itemsText}</div>}
                {order?.invoiceFile && (
                  <a href={order.invoiceFile} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 11, fontWeight: 700, color: "#0A5A3B", textDecoration: "none" }}>
                    <FileDown size={12} /> Invoice
                  </a>
                )}
              </div>
            </motion.div>
          );
        })}
      {payouts.length > payoutsPage * PAYOUTS_PER_PAGE && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setPayoutsPage(p => p + 1)}
            style={{ padding: "8px 24px", borderRadius: 100, border: "1px solid rgba(12,90,62,0.15)", background: "rgba(10,90,59,0.04)", color: "#0A5A3B", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Load More ({payouts.length - payoutsPage * PAYOUTS_PER_PAGE} remaining)
          </motion.button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- MAIN DASHBOARD ---------------------------- */

export default function PharmacyDashboard() {
  // ======== all logic below is IDENTICAL to your original file (with the requested additions) ========
  const [token, setToken] = useState(localStorage.getItem("pharmacyToken") || "");
  const [tab, setTab] = useState(0); // 0: Overview, 1: Earnings, 2: Medicines

  const [orders, setOrders] = useState([]);
  const [login, setLogin] = useState({ email: "", password: "" });
  const [editOrderId, setEditOrderId] = useState("");
  const [edit, setEdit] = useState({ dosage: "", note: "" });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [pharmacy, setPharmacy] = useState({});
  const [active, setActive] = useState(false);
  const [liveConfig, setLiveConfig] = useState({
    rxEnabled: true,
    otcOnly: false,
  });
  const [savingLiveConfig, setSavingLiveConfig] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // eslint-disable-next-line no-unused-vars
  const [showMeds, setShowMeds] = useState(false); // kept for compatibility (no longer used)
  const [medicines, setMedicines] = useState([]);
  const [medMsg, setMedMsg] = useState("");
  const [editMedId, setEditMedId] = useState(null);
  const [editMedImages, setEditMedImages] = useState([]);
  const [medImages, setMedImages] = useState([]);
  const fileInputRef = useRef();
  const editFileInputRef = useRef();
  // eslint-disable-next-line no-unused-vars
  const cameraEditInputRef = useRef();
  const cameraInputRef = useRef();

  const [payouts, setPayouts] = useState([]);

  // ▼▼ ADDED: local search state for Medicines tab ▼▼
  // eslint-disable-next-line no-unused-vars
  const [medSearchOpen, setMedSearchOpen] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [medSearch, setMedSearch] = useState("");
  // ▲▲ ADDED END ▲▲
  const [usePackPreset, setUsePackPreset] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [usePackPresetEdit, setUsePackPresetEdit] = useState(true);

  const today = todayString();
  const ordersToday = orders.filter(o => (o.createdAt || "").slice(0, 10) === today);
  const completedOrders = orders.filter(o => o.status === 3 || o.status === "delivered");
  const isErrorText = (t = "") =>
  /fail|error|not found|invalid|incorrect|missing|required|empty|incomplete|fill all/i.test(t);

  const allPharmacyCategories = React.useMemo(() => {
  const allCats = medicines.flatMap(m =>
      Array.isArray(m.category) ? m.category : (m.category ? [m.category] : [])
    );
    // Start with Excel categories, add any legacy/custom categories from inventory,
    // then ensure "Other" is always the last option.
    const unique = Array.from(new Set([
      ...CUSTOMER_CATEGORIES,
      ...allCats.filter(c => !!c && !CUSTOMER_CATEGORIES.includes(c))
    ]));
    return unique.filter(c => c !== "Other").concat("Other");
  }, [medicines]);

  // ========== (B) NEW STATE + HELPERS ==========
  // Incoming order popup + alerts
  const seenOrderIdsRef = useRef(new Set());
  const [incomingOrder, setIncomingOrder] = useState(null);
  const [incomingOpen, setIncomingOpen] = useState(false);
  const incomingAudioRef = useRef(null);
  // ============================================

  // ====== MEDICINES TAB: MASTER CATALOG + INVENTORY + REQUEST ======
  const [catalogQ, setCatalogQ] = useState("");
  const [catalog, setCatalog] = useState([]);
  const [catalogHasMore, setCatalogHasMore] = useState(true);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [inventory, setInventory] = useState([]);
  const [invMsg, setInvMsg] = useState("");
  // eslint-disable-next-line no-unused-vars
  const catalogObserverRef = useRef(null);

  const fetchCatalog = async (reset = true, pageOverride) => {
    if (catalogLoading) return;
    setCatalogLoading(true);
    try {
      const pg = reset ? 1 : (pageOverride || catalogPage);
      const res = await axios.get(`${API_BASE_URL}/api/medicine-master?q=${encodeURIComponent(catalogQ)}&page=${pg}&limit=80`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data;
      // Support both old format (array) and new format ({ meds, total, hasMore })
      if (Array.isArray(data)) {
        setCatalog(data);
        setCatalogHasMore(false);
        setCatalogTotal(data.length);
      } else {
        if (reset) {
          setCatalog(data.meds || []);
        } else {
          setCatalog(prev => [...prev, ...(data.meds || [])]);
        }
        setCatalogHasMore(data.hasMore ?? false);
        setCatalogTotal(data.total || 0);
        setCatalogPage(pg + 1);
      }
    } catch (e) {
      console.error("Catalog fetch error:", e);
    }
    setCatalogLoading(false);
  };

  const loadMoreCatalog = () => {
    if (catalogHasMore && !catalogLoading) fetchCatalog(false);
  };

  const fetchInventory = async () => {
    const res = await axios.get(`${API_BASE_URL}/api/pharmacies/inventory`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setInventory(res.data || []);
  };

  useEffect(() => {
    if (token && tab === 2) {
      fetchInventory();
      if (catalog.length === 0) fetchCatalog(true);
    }
    // eslint-disable-next-line
  }, [token, tab]);

  // addToInventory replaced by addToInventoryWithPrice (with price override support)

  const updateInventory = async (invId, patch) => {
    try {
      await axios.patch(`${API_BASE_URL}/api/pharmacies/inventory/${invId}`, patch, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchInventory();
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to update inventory");
    }
  };

  const removeFromInventory = async (invId) => {
    // ✅ optimistic UI remove (instant)
    const prev = inventory;
    setInventory((cur) => cur.filter((x) => x._id !== invId));

    try {
      setInvMsg("Removing...");
      await axios.delete(`${API_BASE_URL}/api/pharmacies/inventory/${invId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInvMsg("✅ Removed from inventory!");
    } catch (e) {
      // ✅ revert if failed
      setInventory(prev);
      setInvMsg(e?.response?.data?.error || "❌ Failed to remove.");
    }
  };

  // ✅ EDIT INVENTORY MODAL STATE
  const [editInvOpen, setEditInvOpen] = useState(false);
  const [editInv, setEditInv] = useState(null);
  const [editInvForm, setEditInvForm] = useState({ sellingPrice: 0, mrp: 0, stockQty: 0 });

  const openEditInventory = (it) => {
    setEditInv(it);
    setEditInvForm({
      sellingPrice: Number(it.sellingPrice ?? it.price ?? 0),
      mrp: Number(it.mrp ?? 0),
      stockQty: Number(it.stockQty ?? it.stock ?? 0),
    });
    setEditInvOpen(true);
  };

  const saveEditInventory = async () => {
    if (!editInv?._id) return;
    await updateInventory(editInv._id, {
      sellingPrice: Number(editInvForm.sellingPrice || 0),
      mrp: Number(editInvForm.mrp || 0),
      stockQty: Number(editInvForm.stockQty || 0),
      // discount backend auto-calc logic stays as-is
    });
    setEditInvOpen(false);
  };

  const saveLiveConfig = async (patch = {}) => {
    const next = { ...liveConfig, ...patch };
    setLiveConfig(next);
    setSavingLiveConfig(true);
    try {
      const res = await axios.patch(
        `${API_BASE_URL}/api/pharmacies/live-config`,
        next,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res?.data?.pharmacy) {
        const ph = res.data.pharmacy;
        setLiveConfig({
          rxEnabled: !!ph.rxEnabled,
          otcOnly: !!ph.otcOnly,
        });
      }
      setMsg("Live settings updated.");
    } catch {
      setMsg("Failed to update live settings.");
    } finally {
      setSavingLiveConfig(false);
    }
  };

  // ====== END MEDICINES TAB BLOCK ======

  useEffect(() => {
    if (!token) return;
    const fetchAll = () => {
      axios.get(`${API_BASE_URL}/api/pharmacy/orders`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setOrders(res.data))
        .catch(() => setOrders([]));

      axios.get(`${API_BASE_URL}/api/pharmacies/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          setActive(res.data.active);
          setPharmacy(res.data);
          setLiveConfig({
            rxEnabled: res.data?.rxEnabled !== false,
            otcOnly: !!res.data?.otcOnly,
          });

          if (res.data?._id) {
            const payRes = await axios.get(
              `${API_BASE_URL}/api/payments?pharmacyId=${res.data._id}&status=paid`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            setPayouts(payRes.data || []);
          }
        });
    };
    fetchAll();
    const interval = setInterval(() => {
      if (!isEditing) fetchAll();
    }, 3000);
    return () => clearInterval(interval);
  }, [token, msg, isEditing]);

  // ========== (C) ASK PERMISSION & REGISTER PUSH TOKEN (NATIVE) ==========
  useEffect(() => {
    if (!token) return;
    // Web: ask once
    if ("Notification" in window && Notification.permission === "default") {
      try { Notification.requestPermission(); } catch {}
    }
    // Native: register for push (Android/iOS)
    if (Capacitor?.isNativePlatform?.()) {
      (async () => {
        try {
          const perm = await PushNotifications.requestPermissions();
          if (perm.receive === "granted") {
            await PushNotifications.register();
          }
          const reg = PushNotifications.addListener("registration", async (t) => {
            try {
              await axios.post(`${API_BASE_URL}/api/pharmacies/register-device-token`, {
                token: t.value,
                platform: "android"
              }, { headers: { Authorization: `Bearer ${token}` }});
            } catch {}
          });
          const err = PushNotifications.addListener("registrationError", () => {});
          const recv = PushNotifications.addListener("pushNotificationReceived", () => {});
          return () => { reg.remove(); err.remove(); recv.remove(); };
        } catch {}
      })();
    }
  }, [token]);
  // ======================================================================

  useEffect(() => {
    if (!token) return;
    axios.get(`${API_BASE_URL}/api/pharmacy/medicines`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        const fixed = (res.data || []).map(m => ({
          ...m,
          category: Array.isArray(m.category) ? m.category : m.category ? [m.category] : [],
        }));
        setMedicines(fixed);
      })
      .catch(() => setMedicines([]));
  }, [token, medMsg]);

  // ========== (D) POP DIALOG + NOTIFY ON NEW "PLACED/PENDING" ORDERS ==========
  useEffect(() => {
    if (!orders?.length) return;
    // build set of current ids
    const current = new Set(orders.map(o => String(o._id || o.id)));
    // find an order that is NEW to us and "placed/pending"
    const newlyPlaced = orders.find(o => {
      const id = String(o._id || o.id);
      const wasSeen = seenOrderIdsRef.current.has(id);
      const isPlaced = (o.status === "placed" || o.status === "pending" || o.status === 0);
      return !wasSeen && isPlaced;
    });
    // always keep seen ids up to date
    current.forEach(id => seenOrderIdsRef.current.add(id));
    if (!newlyPlaced) return;

    setIncomingOrder(newlyPlaced);
    setIncomingOpen(true);
    try {
      if (!incomingAudioRef.current) incomingAudioRef.current = new Audio("/sounds/offer.mp3");
      incomingAudioRef.current.currentTime = 0;
      incomingAudioRef.current.play().catch(() => {});
    } catch {}
    try { if (navigator?.vibrate) navigator.vibrate([120, 80, 120]); } catch {}
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        const items = (newlyPlaced.items || []).map(i => `${i.name} x${i.qty || i.quantity || 1}`).join(", ");
        new Notification("New Pharmacy Order", { body: items ? items : "Tap to view", tag: "pharmacy-new-order" });
      }
    } catch {}
  }, [orders]);
  // ==========================================================================

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/pharmacy/login`, login);
      setToken(res.data.token);
      localStorage.setItem("pharmacyToken", res.data.token);
      setMsg("Logged in as pharmacy!");
    } catch {
      setMsg("Login failed. Check credentials.");
    }
    setLoading(false);
  };
  const handleLogout = () => {
    localStorage.removeItem("pharmacyToken");
    setToken("");
    setMsg("Logged out.");
    // Redirect to pharmacy login page
    window.location.href = "/pharmacy/login";
  };
  const handleSendOtp = async () => {
    if (!login.email || !login.password) {
      setMsg("Enter mobile/email & PIN.");
      return;
    }
    setLoading(true);
    try {
      const isEmail = login.email.includes("@");
      await axios.post(`${API_BASE_URL}/api/pharmacy/send-otp`, { contact: login.email, pin: login.password });
      setMsg("OTP sent! " + (isEmail ? "Check your email." : "Check your mobile.") );
    } catch (err) {
      setMsg(err.response?.data?.message || "Failed to send OTP");
    }
    setLoading(false);
  };

  // eslint-disable-next-line no-unused-vars
  const handleEditOrder = (order) => {
    setEditOrderId(order.id || order._id);
    setEdit({ dosage: order.dosage || "", note: order.note || "" });
  };
  const handleSave = async () => {
    setLoading(true);
    try {
      await axios.patch(
        `${API_BASE_URL}/api/pharmacy/orders/${editOrderId}`,
        edit,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditOrderId("");
      setMsg("Order updated!");
    } catch {
      setMsg("Update failed!");
    }
    setLoading(false);
  };

  const handleCatalogDecision = async (order, decision) => {
    if (!order?._id && !order?.id) return;
    setLoading(true);
    try {
      await axios.post(
        `${API_BASE_URL}/api/orders/${order._id || order.id}/pharmacy-confirm`,
        { decision },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (decision === "full") setMsg("Order confirmed.");
      if (decision === "partial") setMsg("Partial availability sent.");
      if (decision === "unavailable") setMsg("Order marked unavailable.");
    } catch (e) {
      setMsg(e?.response?.data?.error || "Failed to update order decision.");
    } finally {
      setLoading(false);
    }
  };

  // --------------------- (a) EXTEND FORM STATE (two places) ---------------------
  const [medForm, setMedForm] = useState({
    name: "", brand: "", composition: "", company: "",
    price: "", mrp: "", stock: "", category: "", discount: "",
    customCategory: "", type: "Tablet", customType: "", prescriptionRequired: false,
    // NEW:
    productKind: "branded",      // "branded" | "generic"
    hsn: "3004",                 // sensible default for many medicines
    gstRate: 5,                  // 0 / 5 / 12 / 18
    packCount: "",               // numeric string is fine for inputs
    packUnit: "",                // '', 'tablets', 'capsules', 'ml', 'g', 'units', 'sachets', 'drops'
    compositions: []             // NEW: multi composition chips
  });
  const [editMedForm, setEditMedForm] = useState({
    name: "", brand: "", composition: "", company: "",
    price: "", mrp: "", stock: "", category: "", customCategory: "",
    type: "Tablet", customType: "", prescriptionRequired: false,
    // NEW:
    productKind: "branded",
    hsn: "3004",
    gstRate: 5,
    packCount: "",
    packUnit: "",
    compositions: []            // NEW
  });

  const handleImagesChange = (e) => {
    if (e.target.files && e.target.files.length) setMedImages(Array.from(e.target.files));
  };
  // eslint-disable-next-line no-unused-vars
  const handleEditImagesChange = (e) => {
    if (e.target.files && e.target.files.length) setEditMedImages(Array.from(e.target.files));
  };
  const handleCustomCategoryBlur = (customCategory) => {
    if (!customCategory) return;
    const match = stringSimilarity.findBestMatch(customCategory.trim(), allPharmacyCategories);
    if (match.bestMatch.rating > 0.75) {
      setMedMsg(`Category "${customCategory}" looks similar to "${match.bestMatch.target}". Please check or select from list.`);
    } else {
      if (medMsg.toLowerCase().includes("category")) setMedMsg("");
    }
  };

  const uploadMany = async (files) => {
  const urls = [];
  for (const f of files) {
    const fd = new FormData();
    fd.append("file", f);

    const resp = await fetch(`${API_BASE_URL}/api/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.message || data?.error || `Upload failed (HTTP ${resp.status})`);
    if (data?.url) urls.push(data.url);
  }
  return urls;
};

  // ✅ NEW: Request medicine to master approval (same UI, different API)
  const handleRequestMedicine = async () => {
    if (
      !medForm.price || !medForm.mrp || !medForm.stock ||
      !medForm.category ||
      (
        (Array.isArray(medForm.category) && medForm.category.includes("Other") && !medForm.customCategory) ||
        (medForm.category === "Other" && !medForm.customCategory)
      )
    ) {
      setMedMsg("Fill all medicine fields.");
      return;
    }
    setLoading(true);

    let finalCategories = Array.isArray(medForm.category)
      ? [...medForm.category]
      : (medForm.category ? [medForm.category] : []);
    if (finalCategories.includes("Other")) {
      finalCategories = finalCategories.filter(c => c !== "Other");
      if (medForm.customCategory) finalCategories.push(medForm.customCategory);
    }
    if (finalCategories.length === 0) finalCategories.push("Miscellaneous");

    try {
      let data, headers;

      const safeBrand = medForm.productKind === "generic" ? "" : (medForm.brand || "");
      const compositionValue =
        (medForm.compositions?.length
          ? joinComps(medForm.compositions)
          : (medForm.composition || "")
        );

      const computedName = (medForm.name || safeBrand || compositionValue || "").trim();
if (!computedName) {
  setMedMsg("Medicine name is required.");
  setLoading(false);
  return;
}

let imageUrls = [];
if (medImages && medImages.length) {
  imageUrls = await uploadMany(medImages); // ✅ upload first
}

data = {
  name: computedName,
  brand: safeBrand,
  composition: compositionValue || "",
  company: medForm.company || "",
  price: medForm.price,
  mrp: medForm.mrp,
  discount: medForm.discount,
  stock: medForm.stock,
  category: finalCategories,
  type: medForm.type || "Tablet",
  ...(medForm.type === "Other" ? { customType: medForm.customType || "" } : {}),
  prescriptionRequired: medForm.prescriptionRequired,

  productKind: medForm.productKind,
  hsn: medForm.hsn,
  gstRate: medForm.gstRate,
  packCount: medForm.packCount,
  packUnit: medForm.packUnit,

  images: imageUrls, // ✅ urls in JSON
};

headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      await axios.post(`${API_BASE_URL}/api/medicine-master/request`, data, { headers });

      await postSuggestLearn({
        brand: (medForm.productKind === "branded" ? medForm.brand : "") || undefined,
        composition: compositionValue || undefined,
        type: medForm.type || undefined,
        packUnit: medForm.packUnit || undefined,
        packCount: medForm.packCount || undefined,
      });

      setMedMsg("✅ Request sent to admin for approval!");
      setMedForm({
        name: "", brand: "", composition: "", company: "",
        price: "", mrp: "", stock: "", category: "", discount: "",
        customCategory: "", type: "Tablet", customType: "", prescriptionRequired: false,
        productKind: "branded", hsn: "3004", gstRate: 5, packCount: "", packUnit: "", compositions: []
      });
      setMedImages([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    } catch (err) {
      setMedMsg(err?.response?.data?.error || "Failed to request medicine.");
    }
    setLoading(false);
  };

  // eslint-disable-next-line no-unused-vars
  const handleEditMedicine = (med) => {
    const medCats = Array.isArray(med.category) ? med.category : med.category ? [med.category] : [];
    const customCats = medCats.filter(c => !CUSTOMER_CATEGORIES.includes(c));
    let newCategory = [...medCats];
    let customCategory = "";
    if (customCats.length > 0) {
      newCategory = [...medCats.filter(c => CUSTOMER_CATEGORIES.includes(c)), "Other"];
      customCategory = customCats[0];
    }
    setEditMedId(med.id || med._id);
    setEditMedForm({
      name: med.name,
      brand: med.brand || "",
      composition: med.composition || "",
      company: med.company || "",
      price: med.price,
      mrp: med.mrp,
      stock: med.stock,
      category: newCategory,
      customCategory,
      type: TYPE_OPTIONS.includes(med.type) ? med.type : "Other",
      customType: TYPE_OPTIONS.includes(med.type) ? "" : (med.type || ""),
      prescriptionRequired: !!med.prescriptionRequired,
      // --------------------- (b) HYDRATE NEW FIELDS ---------------------
      productKind: med.productKind || (med.brand ? "branded" : "generic"),
      hsn: med.hsn || "3004",
      gstRate: typeof med.gstRate === "number" ? med.gstRate : 5,
      packCount: (med.packCount ?? "") + "",
      packUnit: med.packUnit || "",
      compositions: splitComps(med.composition || "")
    });
  };

  // mark a medicine available/unavailable — optimistic + new endpoint
  // eslint-disable-next-line no-unused-vars
  const toggleAvailability = async (med) => {
    const goingUnavailable = med.status !== "unavailable"; // if currently available → make unavailable
    const newStatus = goingUnavailable ? "unavailable" : "active";

    // optimistic UI update
    setMedicines((ms) =>
      ms.map((m) =>
        (m._id || m.id) === (med._id || med.id)
          ? { ...m, status: newStatus, available: !goingUnavailable }
          : m
      )
    );

    try {
      await axios.patch(
        `${API_BASE_URL}/api/pharmacy/medicines/${med._id || med.id}/availability`,
        { status: newStatus },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      setMedMsg(`Marked as ${newStatus}.`);
    } catch (e) {
      // revert on failure
      setMedicines((ms) =>
        ms.map((m) =>
          (m._id || m.id) === (med._id || med.id)
            ? { ...m, status: med.status, available: med.available }
            : m
        )
      );
      setMedMsg("Failed to update availability.");
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleSaveMedicine = async () => {
    if (!editMedForm.price || !editMedForm.stock ||
        !editMedForm.category ||
        (
          (Array.isArray(editMedForm.category) && editMedForm.category.includes("Other") && !editMedForm.customCategory) ||
          (editMedForm.category === "Other" && !editMedForm.customCategory)
        )
    ) {
      setMedMsg("Fill all fields to edit.");
      return;
    }
    setLoading(true);

    let finalCategories = Array.isArray(editMedForm.category)
      ? [...editMedForm.category]
      : editMedForm.category ? [editMedForm.category] : [];
    if (finalCategories.includes("Other")) {
      finalCategories = finalCategories.filter(c => c !== "Other");
      if (editMedForm.customCategory) finalCategories.push(editMedForm.customCategory);
    }
    if (finalCategories.length === 0) finalCategories.push("Miscellaneous");

    try {
      let data, headers;
      const makeActive = editMedForm.price > 0 && editMedForm.mrp > 0 && (editMedForm.stock ?? 0) >= 0;

      // NOTE: if switching to generic, brand must be blank
      const safeBrand = editMedForm.productKind === "generic" ? "" : (editMedForm.brand || "");

      // NEW: join compositions (or fall back)
      const editCompositionValue =
        (editMedForm.compositions?.length
          ? joinComps(editMedForm.compositions)
          : (editMedForm.composition || "")
        );

      if (editMedImages && editMedImages.length) {
        data = new FormData();
        data.append("name", editMedForm.name);
        data.append("brand", safeBrand);
        data.append("composition", editCompositionValue || "");
        data.append("company", editMedForm.company || "");
        data.append("price", editMedForm.price);
        data.append("mrp", editMedForm.mrp);
        data.append("stock", editMedForm.stock);
        data.append("category", JSON.stringify(finalCategories));
        data.append("type", editMedForm.type);
        if (editMedForm.type === "Other") data.append("customType", editMedForm.customType || "");
        data.append("prescriptionRequired", editMedForm.prescriptionRequired);
        if (makeActive) data.append("status", "active");

        // ------- (d) send new fields on edit -------
        data.append("productKind", editMedForm.productKind);
        data.append("hsn", editMedForm.hsn);
        data.append("gstRate", editMedForm.gstRate);
        data.append("packCount", editMedForm.packCount);
        data.append("packUnit", editMedForm.packUnit);

        editMedImages.forEach(img => data.append("images", img));
        headers = { Authorization: `Bearer ${token}` };
      } else {
        data = {
          name: editMedForm.name,
          brand: safeBrand,
          composition: editCompositionValue || "",
          company: editMedForm.company || "",
          price: editMedForm.price,
          mrp: editMedForm.mrp,
          stock: editMedForm.stock,
          category: finalCategories,
          type: editMedForm.type,
          ...(editMedForm.type === "Other" && { customType: editMedForm.customType }),
          prescriptionRequired: editMedForm.prescriptionRequired,
          ...(makeActive ? { status: "active" } : {}),
          // ------- (d) send new fields on edit -------
          productKind: editMedForm.productKind,
          hsn: editMedForm.hsn,
          gstRate: editMedForm.gstRate,
          packCount: editMedForm.packCount,
          packUnit: editMedForm.packUnit
        };
        headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      }

      await axios.patch(`${API_BASE_URL}/api/pharmacy/medicines/${editMedId}`, data, { headers });
      // ✳️ teach the suggester from this edit
      await postSuggestLearn({
        brand: (editMedForm.productKind === "branded" ? editMedForm.brand : "") || undefined,
        composition: editCompositionValue || undefined,
        type: editMedForm.type || undefined,
        packUnit: editMedForm.packUnit || undefined,
        packCount: editMedForm.packCount || undefined,
      });
      setMedMsg("Medicine updated!");
      setEditMedId(null);
      setEditMedImages([]);
      if (editFileInputRef.current) editFileInputRef.current.value = "";
    } catch {
      setMedMsg("Failed to update medicine.");
    }
    setLoading(false);
  };
  // eslint-disable-next-line no-unused-vars
  const closeEditDialog = () => {
    setEditMedId(null);
    setEditMedImages([]);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  };
  // eslint-disable-next-line no-unused-vars
  const handleDeleteMedicine = async (medId) => {
    setLoading(true);
    try {
      await axios.delete(`${API_BASE_URL}/api/pharmacy/medicines/${medId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMedMsg("Medicine deleted!");
    } catch {
      setMedMsg("Failed to delete medicine.");
    }
    setLoading(false);
  };

  // Hooks MUST be above all conditional returns
  const catalogTimerRef = useRef(null);
  const [priceOverride, setPriceOverride] = useState({});
  const [requestMedOpen, setRequestMedOpen] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const ORDERS_PER_PAGE = 10;

  // ─── Catalog full-page overlay & filters ───
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catFilter, setCatFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [medTypeFilter, setMedTypeFilter] = useState("All");
  const [catalogDetail, setCatalogDetail] = useState(null);
  const [detailImgIdx, setDetailImgIdx] = useState(0);
  const [detailDesc, setDetailDesc] = useState("");

  // ─── Design constants (match Home.js) ───
  const DEEP = "#0A5A3B";
  const MID_ = "#0F7A53";
  const ACCENT = "#18E2A1";
  const BG_ = "#F4FBF8";
  const GLASS = "rgba(255,255,255,0.92)";
  const BORDER_ = "rgba(12,90,62,0.08)";
  const TEXT_ = "#10231A";
  const SUB_ = "#6A7A73";

  // Client-side filtered catalog (must be before conditional returns)
  const filteredCatalog = useMemo(() => {
    return catalog.filter(m => {
      if (catFilter !== "All") {
        const cats = Array.isArray(m.category) ? m.category : (m.category ? [m.category] : []);
        if (!cats.some(c => c === catFilter)) return false;
      }
      if (typeFilter === "Branded" && !m.brand) return false;
      if (typeFilter === "Generic" && m.brand) return false;
      if (medTypeFilter !== "All" && m.type !== medTypeFilter) return false;
      return true;
    });
  }, [catalog, catFilter, typeFilter, medTypeFilter]);

  // Unique medicine types from catalog for filter chips
  const catalogMedTypes = useMemo(() => {
    const types = new Set();
    catalog.forEach(m => { if (m.type) types.add(m.type); });
    return ["All", ...Array.from(types).sort()];
  }, [catalog]);

  // Image URL helper (same as Medicines.js)
  const getImgUrl = (img) => {
    if (!img) return null;
    if (img.startsWith("/uploads/")) return `${API_BASE_URL}${img}`;
    if (img.startsWith("http")) return img;
    return null;
  };

  if (!token) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: `linear-gradient(180deg, ${BG_}, #EEF8F4)`, position: "relative", overflow: "hidden" }}>
        {/* Decorative orbs */}
        <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, ${ACCENT}15, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -40, left: -40, width: 140, height: 140, borderRadius: "50%", background: `radial-gradient(circle, ${MID_}10, transparent 70%)`, pointerEvents: "none" }} />

        <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: "100%", maxWidth: 420, background: GLASS, border: `1px solid ${BORDER_}`, borderRadius: 28, padding: "32px 24px", boxShadow: "0 24px 64px rgba(16,24,40,0.06), 0 0 0 1px rgba(12,90,62,0.04)" }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ width: 56, height: 56, borderRadius: 20, background: `${DEEP}10`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <Pill size={24} color={DEEP} />
            </div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 900, color: TEXT_, letterSpacing: -0.5 }}>Partner Portal</div>
            <div style={{ fontSize: 13, color: SUB_, fontWeight: 600, marginTop: 4 }}>Sign in to your pharmacy dashboard</div>
          </div>

          <TextField label="Mobile number or Email" fullWidth value={login.email} onChange={e => setLogin({ ...login, email: e.target.value })} onFocus={() => setIsEditing(true)} onBlur={() => setIsEditing(false)}
            sx={{ mb: 2, "& .MuiOutlinedInput-root": { borderRadius: "14px", background: "rgba(244,251,248,0.6)", "& fieldset": { borderColor: BORDER_ } } }} />
          <TextField label="Password" type="password" fullWidth value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} onFocus={() => setIsEditing(true)} onBlur={() => setIsEditing(false)}
            sx={{ mb: 2.5, "& .MuiOutlinedInput-root": { borderRadius: "14px", background: "rgba(244,251,248,0.6)", "& fieldset": { borderColor: BORDER_ } } }} />

          <motion.button whileTap={{ scale: 0.97 }} onClick={handleSendOtp} disabled={loading}
            style={{ width: "100%", height: 48, borderRadius: 14, border: `2px solid ${MID_}`, background: "transparent", color: MID_, fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 800, cursor: "pointer", marginBottom: 10 }}>
            {loading ? "Sending OTP..." : "Send OTP"}
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleLogin} disabled={loading}
            style={{ width: "100%", height: 48, borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${DEEP}, ${MID_})`, color: "#fff", fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: `0 6px 20px ${DEEP}30` }}>
            {loading ? "Logging in..." : "Login"}
          </motion.button>

          <Snackbar open={!!msg} autoHideDuration={2400} onClose={() => setMsg("")}>
            <Alert onClose={() => setMsg("")} severity={/fail|error|not found|invalid|incorrect|missing|unable/i.test(msg) ? "error" : "success"}>{msg}</Alert>
          </Snackbar>
        </motion.div>
      </div>
    );
  }

const pendingOrders = orders.filter(o => o.status === "placed" || o.status === 0 || o.status === "pending");
  const totalEarnings = payouts.reduce((s, p) => s + (p.pharmacyAmount || 0), 0);

  // Master catalog: auto-load on tab switch + search-as-you-type
  const handleCatalogSearch = (q) => {
    setCatalogQ(q);
    setCatalogPage(1);
    if (catalogTimerRef.current) clearTimeout(catalogTimerRef.current);
    catalogTimerRef.current = setTimeout(() => {
      if (q.length >= 2 || q.length === 0) fetchCatalog(true);
    }, 350);
  };

  // Open detail dialog + lazy-load description
  const openCatalogDetail = async (m) => {
    setCatalogDetail(m);
    setDetailImgIdx(0);
    setDetailDesc(m.description || "");
    if (!m.description && m._id) {
      try {
        const res = await axios.post(`${API_BASE_URL}/api/medicines/${m._id}/ensure-description`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.description) setDetailDesc(res.data.description);
      } catch {}
    }
  };

  // Price override quick-add handler
  const addToInventoryWithPrice = async (m) => {
    const override = priceOverride[m._id];
    try {
      setInvMsg("Adding...");
      await axios.post(
        `${API_BASE_URL}/api/pharmacies/inventory/add`,
        {
          medicineMasterId: m._id,
          sellingPrice: override?.price ? Number(override.price) : (m.price || 0),
          mrp: override?.mrp ? Number(override.mrp) : (m.mrp || 0),
          discount: m.discount || 0,
          stockQty: override?.stock ? Number(override.stock) : 1,
          images: [],
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const hasOverride = override?.price && Number(override.price) !== (m.price || 0);
      setInvMsg(hasOverride ? "Added! Price change sent for admin approval." : "Added!");
      setPriceOverride(p => { const n = { ...p }; delete n[m._id]; return n; });
      fetchInventory();
      setTimeout(() => setInvMsg(""), hasOverride ? 3000 : 1500);
    } catch (e) {
      setInvMsg(e?.response?.data?.error || "Failed to add.");
    }
  };

  const nonPendingOrders = [...orders]
    .filter(o => o.status !== "placed" && o.status !== 0 && o.status !== "pending")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const visibleOrders = nonPendingOrders.slice(0, ordersPage * ORDERS_PER_PAGE);

  // ─── Bottom nav config ───
  const navItems = [
    { icon: Package, label: "Orders", idx: 0 },
    { icon: Pill, label: "Medicines", idx: 2 },
    { icon: Wallet, label: "Earnings", idx: 1 },
    { icon: Settings, label: "More", idx: 3 },
  ];

  return (
    <div style={{ background: BG_, minHeight: "100vh", position: "relative" }}>
      {/* Subtle background gradient */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at top right, rgba(24,226,161,0.06), transparent 26%), radial-gradient(circle at bottom left, rgba(15,122,83,0.04), transparent 30%)" }} />

      <div style={{ maxWidth: 520, margin: "0 auto", paddingBottom: 88, position: "relative" }}>

        {/* ===== STICKY HEADER ===== */}
        <div style={{ position: "sticky", top: 0, zIndex: 20, padding: "14px 18px 0", backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", background: "linear-gradient(180deg, rgba(244,251,248,0.94), rgba(244,251,248,0.82))", borderBottom: `1px solid ${BORDER_}` }}>
          {/* Top row: name + status */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 900, color: SUB_, textTransform: "uppercase", letterSpacing: 1.5 }}>GoDavaii Partner</div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 1000, color: TEXT_, lineHeight: 1.15, letterSpacing: -0.5 }}>{pharmacy?.name || "Pharmacy"}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 100, background: active ? "rgba(24,226,161,0.12)" : "rgba(248,113,113,0.12)", border: `1px solid ${active ? "rgba(24,226,161,0.2)" : "rgba(248,113,113,0.2)"}` }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: active ? ACCENT : "#f87171", boxShadow: active ? `0 0 8px ${ACCENT}` : "0 0 8px #f87171", animation: "glowPulse 2s ease-in-out infinite" }} />
                <span style={{ fontSize: 10, fontWeight: 800, color: active ? DEEP : "#dc2626" }}>{active ? "ONLINE" : "OFFLINE"}</span>
              </div>
              <Switch checked={active} size="small"
                onChange={async (e) => {
                  const next = e.target.checked;
                  setActive(next);
                  try { await axios.patch(`${API_BASE_URL}/api/pharmacies/active`, { active: next }, { headers: { Authorization: `Bearer ${token}` } }); }
                  catch { setActive(!next); setMsg("Failed to update."); }
                }}
                sx={{ "& .MuiSwitch-thumb": { bgcolor: "#fff" }, "& .Mui-checked .MuiSwitch-thumb": { bgcolor: ACCENT }, "& .Mui-checked+.MuiSwitch-track": { bgcolor: `${DEEP} !important` } }} />
            </div>
          </div>

          {/* Quick stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, paddingBottom: 14 }}>
            {[
              { label: "Today", value: ordersToday.length },
              { label: "Pending", value: pendingOrders.length },
              { label: "Delivered", value: completedOrders.length },
              { label: "Earned", value: `₹${Math.round(totalEarnings).toLocaleString("en-IN")}` },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.04 }}>
                <div style={{ background: GLASS, border: `1px solid ${BORDER_}`, borderRadius: 14, padding: "10px 8px", textAlign: "center", boxShadow: "0 4px 12px rgba(16,24,40,0.02)" }}>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 900, color: TEXT_, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: SUB_, textTransform: "uppercase", letterSpacing: 0.7, marginTop: 3 }}>{s.label}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ===== TAB CONTENT ===== */}
        <div style={{ padding: "16px 18px" }}>
          <AnimatePresence mode="wait">

            {/* ================== ORDERS TAB ================== */}
            {tab === 0 && (
              <motion.div key="orders" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {/* Fulfillment Controls */}
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {[
                    { label: "Rx Enabled", key: "rxEnabled" },
                    { label: "OTC Only", key: "otcOnly" },
                  ].map((ctrl) => (
                    <div key={ctrl.key} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", background: liveConfig[ctrl.key] ? `${DEEP}08` : GLASS, border: `1px solid ${liveConfig[ctrl.key] ? `${DEEP}20` : BORDER_}`, borderRadius: 14, padding: "8px 12px" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: liveConfig[ctrl.key] ? DEEP : SUB_ }}>{ctrl.label}</span>
                      <Switch size="small" checked={!!liveConfig[ctrl.key]} disabled={savingLiveConfig} onChange={(e) => saveLiveConfig({ [ctrl.key]: e.target.checked })}
                        sx={{ "& .Mui-checked": { color: DEEP }, "& .Mui-checked+.MuiSwitch-track": { bgcolor: `${DEEP} !important` } }} />
                    </div>
                  ))}
                </div>

                {/* Location */}
                <motion.button whileTap={{ scale: 0.97 }} onClick={async () => {
                  if (!navigator.geolocation) { alert("Geolocation not supported."); return; }
                  navigator.geolocation.getCurrentPosition(async (pos) => {
                    try {
                      const { latitude, longitude } = pos.coords;
                      const res = await axios.get(`${API_BASE_URL}/api/geocode?lat=${latitude}&lng=${longitude}`);
                      const formatted = res.data.results?.[0]?.formatted_address || "";
                      await axios.patch(`${API_BASE_URL}/api/pharmacies/set-location`, { lat: latitude, lng: longitude, formatted }, { headers: { Authorization: `Bearer ${token}` } });
                      setMsg("Location updated!");
                    } catch { setMsg("Failed to update location!"); }
                  }, (err) => alert("Could not fetch location: " + err.message));
                }} style={{ width: "100%", marginBottom: 16, padding: "12px 16px", borderRadius: 16, border: `1px solid ${pharmacy.location?.coordinates?.[0] ? `${ACCENT}30` : "rgba(245,158,11,0.25)"}`, background: pharmacy.location?.coordinates?.[0] ? `${ACCENT}08` : "rgba(255,251,235,0.6)", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <MapPin size={16} color={pharmacy.location?.coordinates?.[0] ? DEEP : "#d97706"} />
                  <div style={{ textAlign: "left", flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: pharmacy.location?.coordinates?.[0] ? DEEP : "#92400e" }}>{pharmacy.location?.coordinates?.[0] ? "Location Set" : "Set Your Location"}</div>
                    {pharmacy.location?.formatted && <div style={{ fontSize: 10, color: SUB_, marginTop: 2, lineHeight: 1.3 }}>{pharmacy.location.formatted}</div>}
                  </div>
                </motion.button>

                {/* Pending Orders */}
                {pendingOrders.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#dc2626", animation: "glowPulse 1.5s ease-in-out infinite" }} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", letterSpacing: 0.8 }}>{pendingOrders.length} Pending {pendingOrders.length === 1 ? "Order" : "Orders"}</span>
                    </div>
                    {pendingOrders.map((order, idx) => (
                      <motion.div key={order._id || order.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}>
                        <div style={{ background: GLASS, border: `1px solid rgba(245,158,11,0.2)`, borderLeft: "4px solid #fbbf24", borderRadius: 18, padding: 16, marginBottom: 10, boxShadow: "0 4px 16px rgba(234,179,8,0.06)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 900, color: TEXT_ }}>#{String(order._id || order.id).slice(-5)}</span>
                            <span style={{ fontSize: 10, color: SUB_, fontWeight: 600 }}>{order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                          </div>
                          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 100, background: `${DEEP}08`, color: DEEP }}>{order.items?.length || 0} items</span>
                            {order.address?.area && <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 10px", borderRadius: 100, background: "rgba(14,165,233,0.08)", color: "#0369a1" }}>{order.address.area}</span>}
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 100, background: "rgba(245,158,11,0.08)", color: "#92400e" }}>₹{Math.round((order.total || 0) * 0.84)}</span>
                          </div>
                          <div style={{ fontSize: 12, color: "#475569", marginBottom: 12, lineHeight: 1.5 }}>{order.items?.map(i => `${i.name} x${i.qty || i.quantity || 1}`).join(" | ") || "No items"}</div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleCatalogDecision(order, "full")} disabled={loading}
                              style={{ flex: 2, height: 40, borderRadius: 12, border: "none", background: `linear-gradient(135deg, ${DEEP}, ${MID_})`, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: `0 4px 14px ${DEEP}30` }}>
                              Confirm All
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleCatalogDecision(order, "partial")} disabled={loading}
                              style={{ flex: 1, height: 40, borderRadius: 12, border: `2px solid ${DEEP}`, background: "#fff", color: DEEP, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                              Partial
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleCatalogDecision(order, "unavailable")} disabled={loading}
                              style={{ flex: 1, height: 40, borderRadius: 12, border: "2px solid #fecaca", background: "#fff", color: "#dc2626", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                              Skip
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Recent Orders */}
                <div style={{ fontSize: 11, fontWeight: 800, color: SUB_, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Recent Orders</div>
                {!orders.length && (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <Package size={40} color="#d1d5db" style={{ margin: "0 auto 8px" }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: SUB_ }}>No orders yet</div>
                  </div>
                )}
                {visibleOrders.map((order, idx) => (
                  <motion.div key={order._id || order.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.03, 0.15) }}>
                    <div style={{ background: GLASS, border: `1px solid ${BORDER_}`, borderRadius: 16, padding: "12px 14px", marginBottom: 8, boxShadow: "0 2px 8px rgba(16,24,40,0.02)", transition: "box-shadow 0.2s" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800, color: TEXT_ }}>#{String(order._id || order.id).slice(-5)}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 100, background: (order.status === 3 || order.status === "delivered") ? `${DEEP}08` : (order.status === -1 || order.status === "rejected") ? "rgba(220,38,38,0.08)" : "rgba(245,158,11,0.08)", color: (order.status === 3 || order.status === "delivered") ? DEEP : (order.status === -1 || order.status === "rejected") ? "#dc2626" : "#d97706" }}>
                            {getStatusLabel(order.status)}
                          </span>
                        </div>
                        <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800, color: DEEP }}>{formatRupees(order.total)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: SUB_, marginTop: 4 }}>{order.items?.map(i => i.name).join(", ") || "-"}</div>
                      {editOrderId === (order.id || order._id) ? (
                        <div style={{ marginTop: 8 }}>
                          <TextField size="small" label="Dosage" fullWidth value={edit.dosage} onChange={e => setEdit({ ...edit, dosage: e.target.value })} sx={{ mb: 0.5 }} onFocus={() => setIsEditing(true)} onBlur={() => setIsEditing(false)} />
                          <TextField size="small" label="Note" fullWidth value={edit.note} onChange={e => setEdit({ ...edit, note: e.target.value })} sx={{ mb: 0.5 }} onFocus={() => setIsEditing(true)} onBlur={() => setIsEditing(false)} />
                          <Button size="small" variant="contained" onClick={handleSave} disabled={loading} sx={{ mr: 0.5, fontSize: 11, bgcolor: DEEP }}>Save</Button>
                          <Button size="small" onClick={() => setEditOrderId("")} sx={{ fontSize: 11 }}>Cancel</Button>
                        </div>
                      ) : (
                        (order.status !== 3 && order.status !== "delivered" && order.status !== -1 && order.status !== "rejected") && (
                          <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setEditOrderId(order._id || order.id); setEdit({ dosage: order.dosage || "", note: order.note || "" }); }}
                            style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: DEEP, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Edit Note</motion.button>
                        )
                      )}
                      {order.invoiceFile && (
                        <a href={order.invoiceFile} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 10, fontWeight: 700, color: DEEP, textDecoration: "none" }}>
                          <ReceiptLongIcon sx={{ fontSize: 13 }} /> Invoice
                        </a>
                      )}
                    </div>
                  </motion.div>
                ))}
                {nonPendingOrders.length > ordersPage * ORDERS_PER_PAGE && (
                  <div style={{ textAlign: "center", marginTop: 12 }}>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => setOrdersPage(p => p + 1)}
                      style={{ padding: "8px 24px", borderRadius: 100, border: `1px solid ${DEEP}20`, background: `${DEEP}06`, color: DEEP, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Load More ({nonPendingOrders.length - ordersPage * ORDERS_PER_PAGE} more)
                    </motion.button>
                  </div>
                )}

                {/* Incoming Order Dialog */}
                <Dialog open={incomingOpen} onClose={() => setIncomingOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: "24px", overflow: "hidden" } }}>
                  <div style={{ background: `linear-gradient(135deg, ${DEEP}, ${MID_})`, padding: "18px 22px" }}>
                    <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 900, color: "#fff" }}>New Order Received!</div>
                  </div>
                  <DialogContent sx={{ pt: 2.5 }}>
                    {incomingOrder ? (
                      <div>
                        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Order #{String(incomingOrder._id || incomingOrder.id).slice(-5)}</div>
                        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: `${DEEP}08`, color: DEEP }}>{incomingOrder.items?.length || 0} items</span>
                          {incomingOrder.address?.area && <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: "rgba(14,165,233,0.08)", color: "#0369a1" }}>{incomingOrder.address.area}</span>}
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: "rgba(245,158,11,0.08)", color: "#92400e" }}>Est. ₹{Math.round((incomingOrder.total || 0) * 0.84)} payout</span>
                        </div>
                        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{incomingOrder.items?.map(i => `${i.name} x${i.qty || i.quantity || 1}`).join(", ") || "No items"}</div>
                        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800, color: DEEP, marginTop: 8 }}>Total: {formatRupees(incomingOrder.total || 0)}</div>
                      </div>
                    ) : <div>No details.</div>}
                  </DialogContent>
                  <DialogActions sx={{ px: 2.5, pb: 2.5, gap: 1 }}>
                    <Button fullWidth sx={{ borderColor: "#fecaca", color: "#dc2626", fontWeight: 800, borderRadius: 3, py: 1.2, border: "2px solid #fecaca" }}
                      onClick={async () => { if (!incomingOrder) return setIncomingOpen(false); await handleCatalogDecision(incomingOrder, "unavailable"); setIncomingOpen(false); }}>Skip</Button>
                    <Button fullWidth variant="contained" sx={{ bgcolor: DEEP, fontWeight: 800, borderRadius: 3, py: 1.2, boxShadow: `0 4px 12px ${DEEP}40`, "&:hover": { bgcolor: "#064e3b" } }}
                      onClick={async () => { if (!incomingOrder) return setIncomingOpen(false); await handleCatalogDecision(incomingOrder, "full"); setIncomingOpen(false); }}>Accept Order</Button>
                  </DialogActions>
                </Dialog>

                {/* Prescription Orders */}
                <div style={{ fontSize: 11, fontWeight: 800, color: SUB_, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, marginTop: 20 }}>Prescription Orders</div>
                <PrescriptionOrdersTab token={token} medicines={medicines} />
              </motion.div>
            )}

            {/* ================== EARNINGS TAB ================== */}
            {tab === 1 && (
              <motion.div key="earnings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <EarningsTab payouts={payouts} token={token} />
              </motion.div>
            )}

            {/* ================== MEDICINES TAB ================== */}
            {tab === 2 && (
              <motion.div key="medicines" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>

                {/* ─── Master Catalog Button (opens full-page) ─── */}
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setCatalogOpen(true); if (catalog.length === 0) fetchCatalog(true); }}
                  style={{ width: "100%", background: `linear-gradient(135deg, ${DEEP}, ${MID_})`, borderRadius: 20, padding: "18px 16px", marginBottom: 14, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, boxShadow: `0 6px 20px ${DEEP}30` }}>
                  <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(255,255,255,0.15)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Search size={22} color="#fff" />
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 900, color: "#fff" }}>Browse Master Catalog</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 600, marginTop: 2 }}>Search & add medicines to your inventory</div>
                  </div>
                  <ChevronRight size={20} color="rgba(255,255,255,0.5)" style={{ marginLeft: "auto" }} />
                </motion.button>

                {/* ─── Full-Page Catalog Overlay ─── */}
                <AnimatePresence>
                {catalogOpen && (
                  <motion.div key="catalog-overlay" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 300 }}
                    style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: BG_, overflowY: "auto", overflowX: "hidden" }}>

                    {/* Sticky Header */}
                    <div style={{ position: "sticky", top: 0, zIndex: 10, background: `linear-gradient(135deg, ${DEEP}, ${MID_})`, padding: "12px 14px 10px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <motion.button whileTap={{ scale: 0.85 }} onClick={() => setCatalogOpen(false)}
                          style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 12, width: 36, height: 36, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}>
                          <ChevronLeft size={20} color="#fff" />
                        </motion.button>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 900, color: "#fff" }}>Master Catalog</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Browse & add to inventory</div>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.18)", borderRadius: 100, padding: "4px 12px", fontSize: 11, fontWeight: 800, color: "#fff" }}>
                          {filteredCatalog.length}/{catalogTotal || catalog.length}
                        </div>
                      </div>
                      {/* Search */}
                      <div style={{ position: "relative" }}>
                        <Search size={15} color="rgba(255,255,255,0.5)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", zIndex: 1 }} />
                        <input value={catalogQ} onChange={(e) => handleCatalogSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchCatalog()}
                          placeholder="Search medicine name, brand, composition..."
                          style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 13, fontWeight: 600, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                      </div>
                    </div>

                    {/* Filter Chips */}
                    <div style={{ background: GLASS, borderBottom: `1px solid ${BORDER_}`, padding: "10px 12px 6px" }}>
                  {/* Category row */}
                  <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
                    {["All", ...CUSTOMER_CATEGORIES].map(c => (
                      <motion.button key={c} whileTap={{ scale: 0.93 }} onClick={() => setCatFilter(c)}
                        style={{ padding: "6px 14px", borderRadius: 100, border: catFilter === c ? "none" : `1px solid ${BORDER_}`, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                          background: catFilter === c ? DEEP : "#fff", color: catFilter === c ? "#fff" : SUB_,
                          fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 700 }}>
                        {c}
                      </motion.button>
                    ))}
                  </div>
                  {/* Type row (Branded/Generic) */}
                  <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
                    {["All", "Branded", "Generic"].map(t => (
                      <motion.button key={t} whileTap={{ scale: 0.93 }} onClick={() => setTypeFilter(t)}
                        style={{ padding: "6px 14px", borderRadius: 100, border: typeFilter === t ? "none" : `1px solid ${BORDER_}`, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                          background: typeFilter === t ? MID_ : "#fff", color: typeFilter === t ? "#fff" : SUB_,
                          fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 700 }}>
                        {t}
                      </motion.button>
                    ))}
                  </div>
                  {/* Medicine type row (Tablet/Capsule etc) */}
                  <div style={{ display: "flex", gap: 6, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
                    {catalogMedTypes.map(t => (
                      <motion.button key={t} whileTap={{ scale: 0.93 }} onClick={() => setMedTypeFilter(t)}
                        style={{ padding: "5px 12px", borderRadius: 100, border: medTypeFilter === t ? `2px solid ${MID_}` : `1px solid ${BORDER_}`, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                          background: medTypeFilter === t ? `${ACCENT}15` : "#fff", color: medTypeFilter === t ? DEEP : SUB_,
                          fontSize: 10, fontWeight: 700 }}>
                        {t}
                      </motion.button>
                    ))}
                  </div>
                </div>

                    {/* ─── 2-Column Medicine Card Grid ─── */}
                    <div style={{ flex: 1, padding: "12px 12px 24px", overflowY: "auto" }}>
                    {invMsg && <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 700, color: invMsg.includes("Failed") || invMsg.includes("❌") ? "#dc2626" : DEEP, textAlign: "center" }}>{invMsg}</div>}

                {filteredCatalog.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <Pill size={36} color="#d1d5db" style={{ margin: "0 auto 10px" }} />
                    <div style={{ fontSize: 13, color: SUB_, fontWeight: 600 }}>{catalog.length === 0 ? "Loading catalog..." : "No medicines match filters."}</div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 14, width: "100%" }}>
                    {filteredCatalog.map((m) => {
                      const inInv = inventory.some(inv => String(inv.medicineMasterId) === String(m._id));
                      const hasOverride = priceOverride[m._id];
                      const imgSrc = getImgUrl(m.images?.[0]);
                      const mrp = Number(m.mrp || 0);
                      const price = Number(m.price || 0);
                      const discPct = mrp > 0 && price > 0 && price < mrp ? Math.round(((mrp - price) / mrp) * 100) : 0;
                      const invItem = inInv ? inventory.find(inv => String(inv.medicineMasterId) === String(m._id)) : null;
                      return (
                        <motion.div key={m._id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} style={{ minWidth: 0, overflow: "hidden" }}>
                          <div style={{ background: GLASS, border: `1px solid ${inInv ? `${ACCENT}30` : BORDER_}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 16px rgba(16,24,40,0.04)", position: "relative", transition: "all 0.2s" }}>
                            {/* Image Area */}
                            <div onClick={() => openCatalogDetail(m)} style={{ position: "relative", width: "100%", paddingTop: "75%", cursor: "pointer", background: "linear-gradient(145deg,#EEF7F1,#D8EDE2)", overflow: "hidden" }}>
                              {imgSrc ? (
                                <img src={imgSrc} alt={m.name} loading="lazy" onError={(e) => { e.target.style.display = "none"; e.target.nextSibling && (e.target.nextSibling.style.display = "grid"); }}
                                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain", padding: 6 }} />
                              ) : null}
                              <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: imgSrc ? "none" : "grid", placeItems: "center", fontSize: 28 }}>💊</div>
                              {/* Badges */}
                              <div style={{ position: "absolute", top: 4, left: 4, display: "flex", flexDirection: "column", gap: 2, zIndex: 2 }}>
                                {m.prescriptionRequired && <span style={{ fontSize: 8, fontWeight: 900, padding: "2px 6px", borderRadius: 6, background: "#dc2626", color: "#fff" }}>Rx</span>}
                                {!m.brand && <span style={{ fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 6, background: ACCENT, color: DEEP }}>Generic</span>}
                              </div>
                              {discPct > 0 && (
                                <span style={{ position: "absolute", top: 4, right: 4, fontSize: 8, fontWeight: 900, padding: "2px 6px", borderRadius: 6, background: `linear-gradient(135deg, ${DEEP}, ${MID_})`, color: "#fff", zIndex: 2 }}>
                                  {discPct}% OFF
                                </span>
                              )}
                              {inInv && (
                                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: `linear-gradient(0deg, ${DEEP}dd, transparent)`, padding: "10px 6px 4px", textAlign: "center", zIndex: 2 }}>
                                  <span style={{ fontSize: 9, fontWeight: 900, color: "#fff", letterSpacing: 0.5 }}>✓ IN INVENTORY</span>
                                </div>
                              )}
                            </div>
                            {/* Card Content */}
                            <div style={{ padding: "8px 8px 7px" }}>
                              <div onClick={() => openCatalogDetail(m)} style={{ fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 800, color: TEXT_, cursor: "pointer",
                                overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.3, minHeight: 28 }}>
                                {m.name}
                              </div>
                              {m.composition && <div style={{ fontSize: 8, color: SUB_, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.composition}</div>}
                              {/* Price */}
                              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 3 }}>
                                <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 900, color: TEXT_ }}>₹{price}</span>
                                {mrp > price && <span style={{ fontSize: 9, color: SUB_, textDecoration: "line-through" }}>₹{mrp}</span>}
                              </div>
                              {/* Actions */}
                              {!inInv && !hasOverride && (
                                <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                                  <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); addToInventoryWithPrice(m); }}
                                    style={{ flex: 1, padding: "6px 0", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${DEEP}, ${MID_})`, color: "#fff", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>+ Add</motion.button>
                                  <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); setPriceOverride(p => ({ ...p, [m._id]: { price: m.price, mrp: m.mrp, stock: 1 } })); }}
                                    style={{ padding: "6px 8px", borderRadius: 10, border: `1px solid ${DEEP}25`, background: "#fff", color: DEEP, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>Set Price</motion.button>
                                </div>
                              )}
                              {/* In Inventory — Remove option */}
                              {inInv && invItem && (
                                <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); removeFromInventory(invItem._id); }}
                                  style={{ width: "100%", padding: "5px 0", marginTop: 6, borderRadius: 8, border: "1px solid #fecaca", background: "#fff", color: "#dc2626", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>Remove from Inventory</motion.button>
                              )}
                              {/* Price Override inline */}
                              {!inInv && hasOverride && (
                                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                    <div style={{ position: "relative" }}>
                                      <span style={{ position: "absolute", top: 2, left: 6, fontSize: 7, fontWeight: 700, color: SUB_ }}>Selling Price</span>
                                      <input type="number" value={hasOverride.price} onChange={(e) => setPriceOverride(p => ({ ...p, [m._id]: { ...p[m._id], price: e.target.value } }))}
                                        style={{ width: "100%", padding: "14px 6px 4px", borderRadius: 8, border: `1px solid ${DEEP}20`, fontSize: 12, fontWeight: 700, outline: "none", boxSizing: "border-box", color: DEEP }} />
                                    </div>
                                    <div style={{ position: "relative" }}>
                                      <span style={{ position: "absolute", top: 2, left: 6, fontSize: 7, fontWeight: 700, color: SUB_ }}>MRP</span>
                                      <input type="number" value={hasOverride.mrp} onChange={(e) => setPriceOverride(p => ({ ...p, [m._id]: { ...p[m._id], mrp: e.target.value } }))}
                                        style={{ width: "100%", padding: "14px 6px 4px", borderRadius: 8, border: `1px solid ${BORDER_}`, fontSize: 12, fontWeight: 700, outline: "none", boxSizing: "border-box" }} />
                                    </div>
                                    <div style={{ position: "relative" }}>
                                      <span style={{ position: "absolute", top: 2, left: 6, fontSize: 7, fontWeight: 700, color: SUB_ }}>Stock Qty</span>
                                      <input type="number" value={hasOverride.stock} onChange={(e) => setPriceOverride(p => ({ ...p, [m._id]: { ...p[m._id], stock: e.target.value } }))}
                                        style={{ width: "100%", padding: "14px 6px 4px", borderRadius: 8, border: `1px solid ${BORDER_}`, fontSize: 12, fontWeight: 700, outline: "none", boxSizing: "border-box" }} />
                                    </div>
                                  </div>
                                  <div style={{ display: "flex", gap: 4 }}>
                                    <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); addToInventoryWithPrice(m); }}
                                      style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${DEEP}, ${MID_})`, color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>Add</motion.button>
                                    <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); setPriceOverride(p => { const n = { ...p }; delete n[m._id]; return n; }); }}
                                      style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${BORDER_}`, background: "#fff", color: SUB_, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>✕</motion.button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Load More / Loading */}
                {catalogHasMore && (
                  <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={loadMoreCatalog} disabled={catalogLoading}
                      style={{ padding: "12px 32px", borderRadius: 100, border: `1px solid ${DEEP}20`, background: GLASS, color: DEEP, fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 12px rgba(16,24,40,0.04)" }}>
                      {catalogLoading ? "Loading..." : "Load More Medicines"}
                    </motion.button>
                  </div>
                )}
                {catalogLoading && catalog.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <div style={{ fontSize: 13, color: SUB_, fontWeight: 600 }}>Loading catalog...</div>
                  </div>
                )}

                    </div>
                    {/* ─── Medicine Detail Dialog ─── */}
                <Dialog open={!!catalogDetail} onClose={() => setCatalogDetail(null)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: "24px", overflow: "hidden", maxHeight: "90vh", m: 1 } }}>
                  {catalogDetail && (() => {
                    const m = catalogDetail;
                    const imgs = (m.images || []).map(getImgUrl).filter(Boolean);
                    const inInv = inventory.some(inv => String(inv.medicineMasterId) === String(m._id));
                    const mrp = Number(m.mrp || 0);
                    const price = Number(m.price || 0);
                    const discPct = mrp > 0 && price > 0 && price < mrp ? Math.round(((mrp - price) / mrp) * 100) : 0;
                    const cats = Array.isArray(m.category) ? m.category : (m.category ? [m.category] : []);
                    return (
                      <>
                        {/* Header */}
                        <div style={{ background: `linear-gradient(135deg, ${DEEP}, ${MID_})`, padding: "18px 18px 14px", position: "relative" }}>
                          <motion.button whileTap={{ scale: 0.85 }} onClick={() => setCatalogDetail(null)}
                            style={{ position: "absolute", top: 12, right: 12, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 100, width: 32, height: 32, display: "grid", placeItems: "center", cursor: "pointer" }}>
                            <X size={16} color="#fff" />
                          </motion.button>
                          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1.25, paddingRight: 36 }}>{m.name}</div>
                          {m.company && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 600, marginTop: 2 }}>{m.company}</div>}
                        </div>

                        {/* Trust badge — matching Medicines.js */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "linear-gradient(135deg, #ECFDF5, #D1FAE5)", borderBottom: `1px solid ${BORDER_}` }}>
                          <ShieldCheck size={16} color={DEEP} />
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: DEEP }}>Fulfilled by GoDavaii</div>
                            <div style={{ fontSize: 9, color: SUB_ }}>Verified pharmacy partner · Quality guaranteed</div>
                          </div>
                        </div>

                        {/* Image Carousel */}
                        {imgs.length > 0 && (
                          <div style={{ position: "relative", background: "linear-gradient(145deg,#EEF7F1,#D8EDE2)", aspectRatio: "4/3" }}>
                            <img src={imgs[detailImgIdx % imgs.length]} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 12 }} />
                            {imgs.length > 1 && (
                              <>
                                <button onClick={() => setDetailImgIdx(i => (i - 1 + imgs.length) % imgs.length)}
                                  style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.85)", border: "none", borderRadius: 100, width: 30, height: 30, display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                                  <ChevronLeft size={16} color={DEEP} />
                                </button>
                                <button onClick={() => setDetailImgIdx(i => (i + 1) % imgs.length)}
                                  style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.85)", border: "none", borderRadius: 100, width: 30, height: 30, display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                                  <ChevronRight size={16} color={DEEP} />
                                </button>
                                <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5 }}>
                                  {imgs.map((_, i) => <div key={i} style={{ width: 7, height: 7, borderRadius: 100, background: i === (detailImgIdx % imgs.length) ? DEEP : "rgba(0,0,0,0.15)", transition: "background 0.2s" }} />)}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        {imgs.length === 0 && (
                          <div style={{ background: "linear-gradient(145deg,#EEF7F1,#D8EDE2)", aspectRatio: "4/3", display: "grid", placeItems: "center", fontSize: 54 }}>💊</div>
                        )}

                        {/* Info Section */}
                        <div style={{ padding: 16 }}>
                          {/* Info chips */}
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                            {cats.map(c => <span key={c} style={{ fontSize: 9, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: `${ACCENT}12`, color: DEEP }}>{c}</span>)}
                            {m.type && <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: "rgba(248,250,252,1)", color: SUB_, border: `1px solid ${BORDER_}` }}>{m.type}</span>}
                            {m.packCount && <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: "rgba(248,250,252,1)", color: SUB_, border: `1px solid ${BORDER_}` }}>{m.packCount} {m.packUnit || ""}</span>}
                            {m.prescriptionRequired && <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 10px", borderRadius: 100, background: "#fef2f2", color: "#dc2626" }}>Rx Required</span>}
                          </div>

                          {/* Price */}
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                            <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 24, fontWeight: 900, color: TEXT_ }}>₹{price}</span>
                            {mrp > price && <span style={{ fontSize: 14, color: SUB_, textDecoration: "line-through" }}>₹{mrp}</span>}
                            {discPct > 0 && <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 100, background: `linear-gradient(135deg, ${DEEP}, ${MID_})`, color: "#fff" }}>{discPct}% OFF</span>}
                          </div>

                          {/* Composition */}
                          {m.composition && (
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: SUB_, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Composition</div>
                              <div style={{ fontSize: 12, color: TEXT_, fontWeight: 600, lineHeight: 1.4 }}>{m.composition}</div>
                            </div>
                          )}

                          {/* Brand */}
                          {m.brand && (
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: SUB_, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Brand</div>
                              <div style={{ fontSize: 12, color: TEXT_, fontWeight: 600 }}>{m.brand}</div>
                            </div>
                          )}

                          {/* Description */}
                          {detailDesc && (
                            <div style={{ marginBottom: 10, background: `${BG_}`, borderRadius: 14, padding: 12 }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: SUB_, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Description</div>
                              <div style={{ fontSize: 11, color: TEXT_, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{detailDesc}</div>
                            </div>
                          )}

                          {/* Actions */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                            {inInv ? (
                              <>
                                <div style={{ padding: "12px 0", borderRadius: 14, background: `${ACCENT}15`, textAlign: "center", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800, color: DEEP }}>
                                  ✓ Already in Inventory
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setCatalogDetail(null)}
                                    style={{ flex: 1, padding: "12px 0", borderRadius: 14, border: `1.5px solid rgba(12,90,62,0.15)`, background: "#F8FBFA", color: "#374151", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                    <X size={14} /> Close
                                  </motion.button>
                                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => { const inv = inventory.find(i => String(i.medicineMasterId) === String(m._id)); if (inv) removeFromInventory(inv._id); setCatalogDetail(null); }}
                                    style={{ flex: 1, padding: "12px 0", borderRadius: 14, border: "1.5px solid #fecaca", background: "#fff", color: "#dc2626", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                                    Remove
                                  </motion.button>
                                </div>
                              </>
                            ) : (
                              <div style={{ display: "flex", gap: 8 }}>
                                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setCatalogDetail(null)}
                                  style={{ flex: 1, padding: "12px 0", borderRadius: 14, border: `1.5px solid rgba(12,90,62,0.15)`, background: "#F8FBFA", color: "#374151", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                  <X size={14} /> Close
                                </motion.button>
                                <motion.button whileTap={{ scale: 0.95 }} onClick={() => { addToInventoryWithPrice(m); setCatalogDetail(null); }}
                                  style={{ flex: 2, padding: "12px 0", borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${DEEP}, ${MID_})`, color: "#fff", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: `0 4px 16px rgba(12,90,62,0.35)` }}>
                                  + Add to Inventory
                                </motion.button>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </Dialog>

                  </motion.div>
                )}
                </AnimatePresence>

                {/* My Inventory */}
                <div style={{ background: GLASS, border: `1px solid ${BORDER_}`, borderRadius: 20, padding: 16, marginBottom: 14, boxShadow: "0 4px 16px rgba(16,24,40,0.03)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 900, color: DEEP }}>My Inventory</div>
                      <div style={{ fontSize: 11, color: SUB_ }}>{inventory.length} medicines stocked</div>
                    </div>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={fetchInventory}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 10, border: `1px solid ${DEEP}20`, background: `${DEEP}06`, color: DEEP, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      <RefreshCw size={12} /> Refresh
                    </motion.button>
                  </div>
                  {inventory.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px 0" }}>
                      <Pill size={36} color="#d1d5db" style={{ margin: "0 auto 8px" }} />
                      <div style={{ fontSize: 13, color: SUB_, fontWeight: 600 }}>No inventory yet. Add from catalog above.</div>
                    </div>
                  ) : (
                    <div style={{ maxHeight: 420, overflowY: "auto" }}>
                      {inventory.map((it) => (
                        <div key={it._id} style={{ padding: 12, marginBottom: 8, borderRadius: 14, background: "rgba(248,250,252,0.8)", border: `1px solid ${BORDER_}`, borderLeft: `3px solid ${MID_}`, transition: "all 0.2s" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800, color: TEXT_, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                              <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 100, background: `${DEEP}08`, color: DEEP }}>₹{Number(it.sellingPrice ?? it.price ?? 0)}</span>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: "rgba(248,250,252,1)", color: SUB_ }}>MRP ₹{Number(it.mrp ?? 0)}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: Number(it.stockQty ?? it.stock ?? 0) > 0 ? `${DEEP}08` : "rgba(220,38,38,0.08)", color: Number(it.stockQty ?? it.stock ?? 0) > 0 ? DEEP : "#dc2626" }}>Stock: {Number(it.stockQty ?? it.stock ?? 0)}</span>
                              </div>
                              {(it.composition || it.type) && <div style={{ fontSize: 10, color: SUB_, marginTop: 4 }}>{it.type && <strong>{it.type}</strong>}{it.type && it.composition ? " · " : ""}{it.composition ? it.composition.slice(0, 50) : ""}</div>}
                              {it.priceOverrideStatus === "pending" && <div style={{ fontSize: 9, fontWeight: 800, color: "#d97706", background: "#fef3c7", display: "inline-block", padding: "1px 8px", borderRadius: 100, marginTop: 4 }}>Price ₹{it.requestedPrice} pending</div>}
                              {it.priceOverrideStatus === "approved" && it.requestedPrice > 0 && <div style={{ fontSize: 9, fontWeight: 800, color: DEEP, background: `${ACCENT}15`, display: "inline-block", padding: "1px 8px", borderRadius: 100, marginTop: 4 }}>Override approved</div>}
                              {it.priceOverrideStatus === "rejected" && <div style={{ fontSize: 9, fontWeight: 800, color: "#dc2626", background: "#fee2e2", display: "inline-block", padding: "1px 8px", borderRadius: 100, marginTop: 4 }}>Override rejected</div>}
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <motion.button whileTap={{ scale: 0.9 }} onClick={() => openEditInventory(it)}
                                style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${DEEP}20`, background: "#fff", color: DEEP, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Edit</motion.button>
                              <motion.button whileTap={{ scale: 0.9 }} onClick={() => removeFromInventory(it._id)}
                                style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #fecaca", background: "#fff", color: "#dc2626", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Remove</motion.button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Edit Inventory Dialog */}
                <Dialog open={editInvOpen} onClose={() => setEditInvOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: "24px", overflow: "hidden" } }}>
                  <div style={{ background: `linear-gradient(135deg, ${DEEP}, ${MID_})`, padding: "16px 22px" }}>
                    <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 900, color: "#fff" }}>Edit Price & Stock</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Changes apply only to your pharmacy</div>
                  </div>
                  <DialogContent sx={{ pt: 2.5 }}>
                    <Stack spacing={2}>
                      <TextField label="Selling Price" type="number" value={editInvForm.sellingPrice} onChange={(e) => setEditInvForm(f => ({ ...f, sellingPrice: e.target.value }))} fullWidth sx={{ "& .MuiOutlinedInput-root": { borderRadius: "14px" } }} />
                      <TextField label="MRP" type="number" value={editInvForm.mrp} onChange={(e) => setEditInvForm(f => ({ ...f, mrp: e.target.value }))} fullWidth sx={{ "& .MuiOutlinedInput-root": { borderRadius: "14px" } }} />
                      <TextField label="Stock Quantity" type="number" value={editInvForm.stockQty} onChange={(e) => setEditInvForm(f => ({ ...f, stockQty: e.target.value }))} fullWidth sx={{ "& .MuiOutlinedInput-root": { borderRadius: "14px" } }} />
                    </Stack>
                  </DialogContent>
                  <DialogActions sx={{ px: 2.5, pb: 2 }}>
                    <Button onClick={() => setEditInvOpen(false)} sx={{ color: SUB_ }}>Cancel</Button>
                    <Button variant="contained" onClick={saveEditInventory} sx={{ bgcolor: DEEP, fontWeight: 800, borderRadius: 3, px: 3, "&:hover": { bgcolor: "#064e3b" } }}>Save</Button>
                  </DialogActions>
                </Dialog>

                {/* Request Medicine Button */}
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setRequestMedOpen(true)}
                  style={{ width: "100%", height: 52, borderRadius: 16, border: "2px dashed rgba(245,158,11,0.3)", background: "linear-gradient(135deg, rgba(255,251,235,0.8), rgba(254,243,199,0.6))", color: "#92400e", fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 2px 12px rgba(146,64,14,0.06)" }}>
                  <Plus size={16} /> Request New Medicine
                </motion.button>

                {/* Request Medicine Dialog */}
                <Dialog open={requestMedOpen} onClose={() => setRequestMedOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: "24px", overflow: "hidden", maxHeight: "85vh" } }}>
                  <div style={{ background: "linear-gradient(135deg, #92400e, #b45309)", padding: "16px 22px" }}>
                    <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 900, color: "#fff" }}>Request New Medicine</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Not in catalog? Submit for admin approval.</div>
                  </div>
                  <DialogContent sx={{ pt: 2, pb: 1 }}>
                    <Stack spacing={2}>
                      <FormControl fullWidth size="small"><InputLabel>Brand Type</InputLabel>
                        <Select label="Brand Type" value={medForm.productKind} onChange={(e) => { const v = e.target.value; setMedForm(f => ({ ...f, productKind: v, brand: v === "generic" ? "" : f.brand, name: v === "generic" ? (f.name || f.composition || "") : (f.name || f.brand || "") })); }}>
                          <MenuItem value="branded">Branded</MenuItem><MenuItem value="generic">Generic</MenuItem>
                        </Select>
                      </FormControl>
                      {medForm.productKind === "branded" && <BrandAutocomplete value={medForm.brand} onValueChange={(val) => setMedForm(f => { const nb = keepUnlessExplicitClear(f.brand, val); return { ...f, brand: nb, name: f.name || nb }; })} onPrefill={(p) => setMedForm(f => ({ ...f, productKind: "branded", name: f.name || p.name || f.brand, type: p.type ?? f.type, packCount: p.packCount ?? f.packCount, packUnit: p.packUnit ?? f.packUnit, hsn: p.hsn ?? f.hsn, gstRate: p.gstRate ?? f.gstRate }))} />}
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <Box sx={{ flex: 1 }}><CompositionAutocomplete value={medForm.composition} onValueChange={(val) => setMedForm(f => ({ ...f, composition: keepUnlessExplicitClear(f.composition, val) }))} onPrefill={(p) => setMedForm(f => ({ ...f, productKind: f.productKind === "generic" ? "generic" : (p.productKind || f.productKind), name: f.productKind === "generic" ? (f.name || p.name || f.composition || "") : f.name, type: p.type ?? f.type, packUnit: p.packUnit ?? f.packUnit, hsn: p.hsn ?? f.hsn, gstRate: p.gstRate ?? f.gstRate }))} /></Box>
                        <Button variant="outlined" size="small" onClick={() => setMedForm(f => { const a = (f.composition || "").trim(); if (!a) return f; const s = new Set((f.compositions || []).map(x => x.toLowerCase())); if (!s.has(a.toLowerCase())) return { ...f, compositions: [...(f.compositions || []), a], composition: "" }; return { ...f, composition: "" }; })}>+</Button>
                      </Stack>
                      {(medForm.compositions || []).length > 0 && <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>{medForm.compositions.map((c) => <Chip key={c} size="small" label={c} onDelete={() => setMedForm(f => ({ ...f, compositions: (f.compositions || []).filter(x => x.toLowerCase() !== c.toLowerCase()) }))} />)}</Stack>}
                      <TextField size="small" label="Company" value={medForm.company} onChange={e => setMedForm(f => ({ ...f, company: e.target.value }))} />
                      <Stack direction="row" spacing={1}>
                        <TextField size="small" label="Price" type="number" value={medForm.price} onChange={e => setMedForm(f => ({ ...f, price: e.target.value }))} fullWidth onFocus={() => setIsEditing(true)} onBlur={() => setIsEditing(false)} />
                        <TextField size="small" label="MRP" type="number" value={medForm.mrp} onChange={e => setMedForm(f => ({ ...f, mrp: e.target.value }))} fullWidth onFocus={() => setIsEditing(true)} onBlur={() => setIsEditing(false)} />
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        <TextField size="small" label="Stock" type="number" value={medForm.stock} onChange={e => setMedForm(f => ({ ...f, stock: e.target.value }))} fullWidth onFocus={() => setIsEditing(true)} onBlur={() => setIsEditing(false)} />
                        <TextField size="small" label="Discount %" type="number" value={medForm.discount} onChange={e => setMedForm(f => ({ ...f, discount: e.target.value }))} inputProps={{ min: 0, max: 90 }} fullWidth onFocus={() => setIsEditing(true)} onBlur={() => setIsEditing(false)} />
                      </Stack>
                      <FormControl fullWidth size="small"><InputLabel>Category</InputLabel>
                        <Select multiple value={Array.isArray(medForm.category) ? medForm.category : (medForm.category ? [medForm.category] : [])} label="Category" onChange={e => setMedForm(f => ({ ...f, category: e.target.value }))} renderValue={(sel) => sel.join(", ")} MenuProps={{ PaperProps: { style: { zIndex: 2000 } } }}>
                          {allPharmacyCategories.map(opt => <MenuItem key={opt} value={opt}><Checkbox size="small" checked={Array.isArray(medForm.category) && medForm.category.indexOf(opt) > -1} /><ListItemText primary={opt} /></MenuItem>)}
                        </Select>
                      </FormControl>
                      {((Array.isArray(medForm.category) ? medForm.category.includes("Other") : medForm.category === "Other")) && <TextField size="small" label="Custom Category" value={medForm.customCategory} onChange={e => setMedForm(f => ({ ...f, customCategory: e.target.value }))} onFocus={() => setIsEditing(true)} onBlur={e => { setIsEditing(false); handleCustomCategoryBlur(e.target.value); }} error={!!medMsg && medMsg.toLowerCase().includes("category")} helperText={!!medMsg && medMsg.toLowerCase().includes("category") ? medMsg : ""} />}
                      <FormControl fullWidth size="small"><InputLabel>Type</InputLabel>
                        <Select value={medForm.type} label="Type" onChange={(e) => { setMedForm(f => ({ ...f, type: e.target.value, packCount: "", packUnit: "" })); setUsePackPreset(e.target.value !== "Other"); }}>
                          {TYPE_OPTIONS.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                        </Select>
                      </FormControl>
                      {medForm.type === "Other" && <TextField size="small" label="Custom Type" fullWidth value={medForm.customType} onChange={e => setMedForm(f => ({ ...f, customType: e.target.value }))} onFocus={() => setIsEditing(true)} onBlur={() => setIsEditing(false)} />}
                      {medForm.type !== "Other" && usePackPreset && <FormControl fullWidth size="small"><InputLabel>Pack Size</InputLabel><Select label="Pack Size" value={packLabel(medForm.packCount, medForm.packUnit) || ""} onChange={(e) => { if (e.target.value === "__CUSTOM__") { setUsePackPreset(false); setMedForm(f => ({ ...f, packCount: "", packUnit: "" })); return; } const opt = normalizePackOpt(e.target.value); setMedForm(f => ({ ...f, packCount: opt.count, packUnit: opt.unit })); }}>{(PACK_SIZES_BY_TYPE[medForm.type] || []).map((raw) => { const o = normalizePackOpt(raw); return <MenuItem key={o.label} value={o.label}>{o.label}</MenuItem>; })}<MenuItem value="__CUSTOM__">Custom...</MenuItem></Select></FormControl>}
                      {(medForm.type === "Other" || !usePackPreset) && <Stack direction="row" spacing={1}><TextField size="small" label="Pack Count" type="number" value={medForm.packCount} onChange={e => setMedForm(f => ({ ...f, packCount: e.target.value }))} fullWidth /><FormControl fullWidth size="small"><InputLabel>Pack Unit</InputLabel><Select label="Pack Unit" value={medForm.packUnit} onChange={e => setMedForm(f => ({ ...f, packUnit: e.target.value }))}>{["tablets","capsules","ml","g","units","sachets","drops"].map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}</Select></FormControl></Stack>}
                      <Stack direction="row" alignItems="center" justifyContent="space-between"><span style={{ fontSize: 13 }}>Prescription Required</span><Switch checked={!!medForm.prescriptionRequired} onChange={e => setMedForm(f => ({ ...f, prescriptionRequired: e.target.checked }))} color="success" size="small" /></Stack>
                      <Stack direction="row" spacing={1}><TextField size="small" label="HSN" value={medForm.hsn} onChange={e => setMedForm(f => ({ ...f, hsn: e.target.value.replace(/[^\d]/g, "") }))} fullWidth /><FormControl fullWidth size="small"><InputLabel>GST</InputLabel><Select label="GST" value={medForm.gstRate} onChange={e => setMedForm(f => ({ ...f, gstRate: Number(e.target.value) }))}>{[0, 5, 12, 18].map(r => <MenuItem key={r} value={r}>{r}%</MenuItem>)}</Select></FormControl></Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <input type="file" accept="image/*" multiple hidden ref={fileInputRef} onChange={handleImagesChange} />
                        <input type="file" accept="image/*" multiple capture="environment" hidden ref={cameraInputRef} onChange={handleImagesChange} />
                        <Button size="small" startIcon={<PhotoCamera />} variant={medImages?.length ? "contained" : "outlined"} onClick={() => fileInputRef.current?.click()} color={medImages?.length ? "success" : "primary"} sx={{ fontSize: 11 }}>{medImages?.length ? `${medImages.length} Image${medImages.length > 1 ? "s" : ""}` : "Upload"}</Button>
                        <IconButton size="small" color="primary" onClick={() => cameraInputRef.current?.click()}><PhotoCamera fontSize="small" /></IconButton>
                      </Stack>
                      {medImages?.length > 0 && <Stack direction="row" spacing={0.5}>{medImages.map((img, i) => <Box key={i} component="img" src={URL.createObjectURL(img)} sx={{ width: 44, height: 44, borderRadius: 2, objectFit: "cover", border: `1px solid ${BORDER_}` }} />)}</Stack>}
                    </Stack>
                  </DialogContent>
                  <DialogActions sx={{ px: 2.5, pb: 2, pt: 1 }}>
                    <Button onClick={() => setRequestMedOpen(false)} sx={{ color: SUB_, fontWeight: 700 }}>Cancel</Button>
                    <Button variant="contained" onClick={handleRequestMedicine} disabled={loading} sx={{ bgcolor: "#92400e", fontWeight: 800, borderRadius: 3, px: 3, boxShadow: "0 4px 14px rgba(146,64,14,0.3)", "&:hover": { bgcolor: "#b45309" } }}>{loading ? "Submitting..." : "Submit for Approval"}</Button>
                  </DialogActions>
                </Dialog>
              </motion.div>
            )}

            {/* ================== MORE/SETTINGS TAB ================== */}
            {tab === 3 && (
              <motion.div key="more" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <PharmacySettlementTab token={token} />

                {/* Logout */}
                <div style={{ textAlign: "center", marginTop: 32, marginBottom: 16 }}>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={handleLogout}
                    style={{ padding: "12px 32px", borderRadius: 100, border: "2px solid #fecaca", background: "#fff", color: "#dc2626", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <LogOut size={14} /> Logout
                  </motion.button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* ===== FIXED BOTTOM NAV BAR ===== */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", background: "rgba(255,255,255,0.88)", borderTop: `1px solid ${BORDER_}`, boxShadow: "0 -4px 20px rgba(16,24,40,0.04)" }}>
          <div style={{ maxWidth: 520, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
            {navItems.map(({ icon: Icon, label, idx }) => (
              <motion.button key={idx} whileTap={{ scale: 0.9 }} onClick={() => setTab(idx)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 0 8px", background: "none", border: "none", cursor: "pointer", position: "relative" }}>
                {tab === idx && <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 20, height: 3, borderRadius: 100, background: `linear-gradient(90deg, ${DEEP}, ${ACCENT})`, boxShadow: `0 2px 8px ${ACCENT}40` }} />}
                <Icon size={20} color={tab === idx ? DEEP : "#94a3b8"} strokeWidth={tab === idx ? 2.5 : 1.8} />
                <span style={{ fontSize: 10, fontWeight: tab === idx ? 800 : 600, color: tab === idx ? DEEP : "#94a3b8", marginTop: 3, fontFamily: "'Sora',sans-serif" }}>{label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Snackbars */}
        <Snackbar open={!!msg} autoHideDuration={2500} onClose={() => setMsg("")}>
          <Alert onClose={() => setMsg("")} severity={msg.includes("fail") || msg.includes("Failed") ? "error" : "success"}>{msg}</Alert>
        </Snackbar>
        <Snackbar open={!!medMsg} autoHideDuration={2200} onClose={() => setMedMsg("")}>
          <Alert onClose={() => setMedMsg("")} severity={isErrorText(medMsg) ? "error" : "success"}>{medMsg}</Alert>
        </Snackbar>
      </div>
    </div>
  );
}

