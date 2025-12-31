// src/components/PharmacyDashboard.js
import React, { useEffect, useState, useRef } from "react";
import {
  Box, Typography, Button, Card, CardContent, TextField, Stack, Chip,
  Snackbar, Alert, ThemeProvider, createTheme, CssBaseline, Divider, IconButton,
  MenuItem, Select, InputLabel, FormControl, Dialog, DialogTitle, DialogContent,
  DialogActions, Switch, Table, TableHead, TableRow, TableCell, TableBody,
  Tabs, Tab, Checkbox, ListItemText, ToggleButton, ToggleButtonGroup,
  Grid
} from "@mui/material";
// (MUI Autocomplete stays imported though unused by design)
import Autocomplete from "@mui/material/Autocomplete";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PhotoCamera from "@mui/icons-material/PhotoCamera";
import SearchIcon from "@mui/icons-material/Search";
import BrandAutocomplete from "./fields/BrandAutocomplete";
import CompositionAutocomplete from "./fields/CompositionAutocomplete";
import { postSuggestLearn } from "../api/suggest";

import { motion } from "framer-motion";
import {
  Pill,
  MapPin,
  Wallet,
  FileDown,
  BadgeCheck,
  Loader2,
  LogOut
} from "lucide-react";

// Minimal shadcn usage (hero card wrapper) – no logic changed
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

// Light theme: deep emerald accents, light surfaces
const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#059669" },   // emerald-600
    secondary: { main: "#10b981" }, // emerald-500
    success: { main: "#059669" },
    background: {
      default: "#f7fcf9",
      paper: "#ffffff",
    },
    text: {
      primary: "#0f172a",  // slate-900
      secondary: "#334155" // slate-700
    }
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
function getStatusColor(status) {
  if (status === "quoted") return "warning";
  if (status === 3 || status === "delivered") return "success";
  if (status === 2 || status === "out_for_delivery") return "secondary";
  if (status === 1 || status === "processing") return "primary";
  if (status === -1 || status === "rejected") return "error";
  return "default";
}

const linkBrandToName = (val) => val;

/* ---------------------------- EARNINGS TAB ---------------------------- */

function EarningsTab({ payouts }) {
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

  // fetch order details for payouts (unchanged)
  const [ordersById, setOrdersById] = useState({});
  useEffect(() => {
    const ids = payouts.map(p => p?.orderId?._id).filter(Boolean);
    const toFetch = ids.filter(id => !ordersById[id]);
    if (!toFetch.length) return;

    Promise.all(
      toFetch.map(id =>
        axios
          .get(`${API_BASE_URL}/api/orders/${id}`)
          .then(res => [id, res.data])
          .catch(() => [id, null])
      )
    ).then(entries => {
      setOrdersById(prev => {
        const out = { ...prev };
        for (const [id, data] of entries) if (data) out[id] = data;
        return out;
      });
    });
  }, [payouts]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box className="mt-2">
      {/* KPI row */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ mb: 2 }}
        className="[&>*]:rounded-2xl"
      >
        {[{
          label: "Total Earnings (All Time)",
          value: formatRupees(totalAll),
          Icon: Wallet
        },{
          label: "Payouts",
          value: payouts.length,
          Icon: BadgeCheck
        },{
          label: "Average Payout",
          value: formatRupees(avg),
          Icon: Wallet
        },{
          label: "Largest Payout",
          value: formatRupees(largest),
          Icon: Wallet
        }].map(({label, value, Icon}, idx) => (
          <motion.div
            key={idx}
            initial={{opacity:0, y:8, scale:.98}}
            animate={{opacity:1, y:0, scale:1}}
            transition={{duration:.25, delay: idx*0.05}}
            style={{ flex: 1 }}
          >
            <Card className="bg-white border border-emerald-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-emerald-700 uppercase tracking-wide text-xs font-bold">
                  <Icon size={16} />
                  {label}
                </div>
                <div className="mt-2 text-2xl font-extrabold text-slate-900">{value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </Stack>

      {/* View switcher */}
      <div className="mb-3 flex items-center gap-3">
        <span className="text-emerald-700 text-xs uppercase font-bold">View:</span>
        <ToggleButtonGroup
          exclusive
          color="primary"
          size="small"
          value={view}
          onChange={(_, v) => v && setView(v)}
          sx={{ "& .MuiToggleButton-root": { fontWeight: 700 } }}
        >
          <ToggleButton value="daily">Daily</ToggleButton>
          <ToggleButton value="weekly">Weekly</ToggleButton>
          <ToggleButton value="monthly">Monthly</ToggleButton>
        </ToggleButtonGroup>
      </div>

      {/* Aggregated table */}
      <motion.div
        initial={{opacity:0, y:8}}
        animate={{opacity:1, y:0}}
        transition={{duration:.25}}
      >
        <Card className="bg-white border border-emerald-200 rounded-2xl mb-4">
          <CardContent>
            <Typography variant="h6" className="mb-2 font-extrabold">
              {view === "daily" ? "Daily totals (last 30 days)" :
               view === "weekly" ? "Weekly totals (last 12 weeks)" :
               "Monthly totals (last 12 months)"}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{view === "weekly" ? "Week" : view === "monthly" ? "Month" : "Date"}</TableCell>
                  <TableCell align="right">Earnings</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(view === "daily" ? daily : view === "weekly" ? weekly : monthly).map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      {view === "weekly" ? weekLabel(row.date) : row.key}
                    </TableCell>
                    <TableCell align="right">{formatRupees(row.amount)}</TableCell>
                  </TableRow>
                ))}
                {(view === "daily" ? daily : view === "weekly" ? weekly : monthly).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2}><Typography color="warning.main">No data yet.</Typography></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      {/* Raw payouts table — horizontally scrollable + extra cols (unchanged logic) */}
      <motion.div
        initial={{opacity:0, y:8}}
        animate={{opacity:1, y:0}}
        transition={{duration:.25, delay:.05}}
      >
        <Card className="bg-white border border-emerald-200 rounded-2xl">
          <CardContent>
            <div className="mb-2 flex items-center gap-2">
              <Wallet size={18} className="text-emerald-700" />
              <Typography variant="h6" className="font-extrabold">All Payouts</Typography>
            </div>

            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 980 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Order</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Order Detail</TableCell>
                    <TableCell>Invoice</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payouts
                    .slice()
                    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .map((pay) => {
                      const orderId = pay.orderId?._id;
                      const order   = orderId ? (ordersById[orderId] || pay.orderId) : null;
                      const itemsText = order?.items?.length
                        ? order.items.map(i => `${i.name} x${i.qty || i.quantity || 1}`).join(", ")
                        : "—";
                      return (
                        <TableRow key={pay._id}>
                          <TableCell className="font-semibold">{orderId ? orderId.slice(-5) : "—"}</TableCell>
                          <TableCell>{new Date(pay.createdAt).toLocaleString()}</TableCell>
                          <TableCell>{formatRupees(pay.pharmacyAmount)}</TableCell>
                          <TableCell className="capitalize">{pay.status}</TableCell>
                          <TableCell title={itemsText} className="max-w-[360px] truncate">{itemsText}</TableCell>
                          <TableCell>
                            {order?.invoiceFile ? (
                              <a href={order.invoiceFile} target="_blank" rel="noopener noreferrer" className="inline-flex">
                                <Button
                                  variant="outlined"
                                  size="small"
                                  className="rounded-xl"
                                  startIcon={<FileDown size={16} />}
                                >
                                  Download
                                </Button>
                              </a>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {payouts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography color="warning.main">No payouts yet.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
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
  const [isEditing, setIsEditing] = useState(false);

  const [showMeds, setShowMeds] = useState(false); // kept for compatibility (no longer used)
  const [medicines, setMedicines] = useState([]);
  const [medMsg, setMedMsg] = useState("");
  const [editMedId, setEditMedId] = useState(null);
  const [editMedImages, setEditMedImages] = useState([]);
  const [medImages, setMedImages] = useState([]);
  const fileInputRef = useRef();
  const editFileInputRef = useRef();
  const cameraEditInputRef = useRef();
  const cameraInputRef = useRef();

  const [payouts, setPayouts] = useState([]);

  // ▼▼ ADDED: local search state for Medicines tab ▼▼
  const [medSearchOpen, setMedSearchOpen] = useState(false);
  const [medSearch, setMedSearch] = useState("");
  // ▲▲ ADDED END ▲▲
  const [usePackPreset, setUsePackPreset] = useState(true);
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
  const [inventory, setInventory] = useState([]);
  const [invMsg, setInvMsg] = useState("");

  const fetchCatalog = async () => {
    const res = await axios.get(`${API_BASE_URL}/api/medicine-master?q=${encodeURIComponent(catalogQ)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setCatalog(res.data || []);
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
    }
    // eslint-disable-next-line
  }, [token, tab]);

  const addToInventory = async (m) => {
    try {
      setInvMsg("Adding...");
      await axios.post(
        `${API_BASE_URL}/api/pharmacies/inventory/add`,
        {
          medicineMasterId: m._id,
          sellingPrice: m.price || 0, // default from master
          mrp: m.mrp || 0,
          discount: m.discount || 0,
          stockQty: 1,
          images: [], // empty means use master images
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInvMsg("✅ Added to inventory!");
      fetchInventory();
    } catch (e) {
      setInvMsg(e?.response?.data?.error || "❌ Failed to add.");
    }
  };

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

      if (medImages && medImages.length) {
        data = new FormData();
        data.append("name", medForm.name);
        data.append("brand", safeBrand);
        data.append("composition", compositionValue || "");
        data.append("company", medForm.company || "");
        data.append("price", medForm.price);
        data.append("mrp", medForm.mrp);
        data.append("discount", medForm.discount);
        data.append("stock", medForm.stock);
        data.append("category", JSON.stringify(finalCategories));
        data.append("type", medForm.type || "Tablet");
        if (medForm.type === "Other") data.append("customType", medForm.customType || "");
        data.append("prescriptionRequired", medForm.prescriptionRequired);

        data.append("productKind", medForm.productKind);
        data.append("hsn", medForm.hsn);
        data.append("gstRate", medForm.gstRate);
        data.append("packCount", medForm.packCount);
        data.append("packUnit", medForm.packUnit);

        medImages.forEach(img => data.append("images", img));
        headers = { Authorization: `Bearer ${token}` };
      } else {
        data = {
          name: medForm.name,
          brand: safeBrand,
          composition: compositionValue || "",
          company: medForm.company || "",
          price: medForm.price,
          mrp: medForm.mrp,
          discount: medForm.discount,
          stock: medForm.stock,
          category: finalCategories,
          type: medForm.type || "Tablet",
          ...(medForm.type === "Other" && { customType: medForm.customType || "" }),
          prescriptionRequired: medForm.prescriptionRequired,

          productKind: medForm.productKind,
          hsn: medForm.hsn,
          gstRate: medForm.gstRate,
          packCount: medForm.packCount,
          packUnit: medForm.packUnit
        };
        headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      }

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
  const closeEditDialog = () => {
    setEditMedId(null);
    setEditMedImages([]);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  };
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

  if (!token) {
    return (
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <Box className="min-h-screen" sx={{ bgcolor: "background.default" }}>
          <Box className="mt-10 w-full max-w-[420px] mx-auto rounded-2xl border border-emerald-200 bg-white p-5 shadow">
            <div className="flex items-center gap-2 mb-3">
              <Pill className="text-emerald-700" size={22} />
              <Typography variant="h5" className="font-extrabold">Pharmacy Login</Typography>
            </div>
            <TextField
              label="Mobile number or Email"
              fullWidth sx={{ mb: 2 }}
              value={login.email}
              onChange={e => setLogin({ ...login, email: e.target.value })}
              onFocus={() => setIsEditing(true)}
              onBlur={() => setIsEditing(false)}
            />
            <TextField
              label="Password"
              type="password"
              fullWidth sx={{ mb: 2 }}
              value={login.password}
              onChange={e => setLogin({ ...login, password: e.target.value })}
              onFocus={() => setIsEditing(true)}
              onBlur={() => setIsEditing(false)}
            />
            <Button variant="outlined" fullWidth onClick={handleSendOtp} disabled={loading} sx={{ mb: 2 }}>
              {loading ? "Sending OTP..." : "Send OTP"}
            </Button>
            <Button variant="contained" fullWidth onClick={handleLogin} disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>

            <Snackbar open={!!msg} autoHideDuration={2400} onClose={() => setMsg("")}>
              <Alert onClose={() => setMsg("")} severity={
                /fail|error|not found|invalid|incorrect|missing|unable/i.test(msg) ? "error" : "success"
              }>
                {msg}
              </Alert>
            </Snackbar>
          </Box>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <Box className="p-2 md:p-3 max-w-[980px] mx-auto relative min-h-[95vh] pb-8">

        {/* Hero header using shadcn Card */}
        <motion.div initial={{opacity:0, y:-6}} animate={{opacity:1, y:0}} transition={{duration:.25}}>
          <SCard className="mb-3 border border-emerald-200 bg-white rounded-2xl shadow">
            <SCardHeader className="pb-2">
              <SCardTitle className="flex items-center gap-2 text-2xl md:text-3xl font-extrabold text-slate-900">
                <Pill size={22} className="text-emerald-700" />
                Pharmacy Dashboard
              </SCardTitle>
            </SCardHeader>
            <SCardContent className="pt-0 text-slate-600 text-sm">
              Manage orders, payouts & inventory — fast.
            </SCardContent>
          </SCard>
        </motion.div>

        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          textColor="primary"
          indicatorColor="primary"
          sx={{ mb: 2 }}
        >
          <Tab label="Overview" />
          <Tab label="Earnings" />
          <Tab label="Medicines" /> {/* NEW */}
        </Tabs>

        {/* ================== OVERVIEW TAB ================== */}
        {tab === 0 && (
          <>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
              <Typography variant="h5" className="font-extrabold">
                {pharmacy?.name || "Pharmacy"}
              </Typography>
              <Chip
                label={active ? "Active" : "Inactive"}
                color={active ? "success" : "default"}
                className="font-semibold"
              />
              <Switch
                checked={active}
                onChange={async (e) => {
                  setActive(e.target.checked);
                  await axios.patch(
                    `${API_BASE_URL}/api/pharmacies/active`,
                    { active: e.target.checked },
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                }}
                inputProps={{ 'aria-label': 'Active Status' }}
                color="success"
              />
            </Stack>

            {/* Location button */}
            <Button
              variant={pharmacy.location && pharmacy.location.coordinates && pharmacy.location.coordinates[0] !== 0 ? "contained" : "outlined"}
              color="primary"
              sx={{ mt: 1, mb: 2 }}
              className="rounded-xl"
              onClick={async () => {
                if (!navigator.geolocation) {
                  alert("Geolocation is not supported on this device/browser.");
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  async (pos) => {
                    try {
                      const { latitude, longitude } = pos.coords;
                      const res = await axios.get(`${API_BASE_URL}/api/geocode?lat=${latitude}&lng=${longitude}`);
                      const formatted = res.data.results?.[0]?.formatted_address || "";
                      await axios.patch(`${API_BASE_URL}/api/pharmacies/set-location`, {
                        lat: latitude, lng: longitude, formatted
                      }, {
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      setMsg("Location updated!");
                    } catch {
                      setMsg("Failed to update location!");
                    }
                  },
                  (err) => alert("Could not fetch location: " + err.message)
                );
              }}
              startIcon={<MapPin size={16} />}
            >
              {pharmacy.location && pharmacy.location.coordinates && pharmacy.location.coordinates[0] !== 0
                ? "Location Set"
                : "Set Current Location"}
            </Button>
            {pharmacy.location && (
              <>
                {pharmacy.location.formatted && (
                  <Typography fontSize={13} className="text-emerald-700 mb-1">
                    {pharmacy.location.formatted}
                  </Typography>
                )}
                {pharmacy.location.coordinates && pharmacy.location.coordinates[0] !== 0 && (
                  <Typography fontSize={11} className="text-slate-500 mb-1">
                    (Lat {pharmacy.location.coordinates[1]}, Lng {pharmacy.location.coordinates[0]})
                  </Typography>
                )}
              </>
            )}

            {/* Stats row */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
              <Card className="bg-white border border-emerald-200 rounded-2xl shadow-sm" sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="subtitle2" className="text-emerald-700 uppercase font-bold">Orders Today</Typography>
                  <Typography variant="h5" className="font-extrabold">{ordersToday.length}</Typography>
                </CardContent>
              </Card>
              <Card className="bg-white border border-emerald-200 rounded-2xl shadow-sm" sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="subtitle2" className="text-emerald-700 uppercase font-bold">Completed Orders</Typography>
                  <Typography variant="h5" className="font-extrabold">{completedOrders.length}</Typography>
                </CardContent>
              </Card>
            </Stack>

            <Divider className="mb-3" />
            
            {/* Orders List */}
            <Typography variant="h6" className="mb-1 font-extrabold">Orders</Typography>
            {!orders.length && <Typography className="text-slate-600">No orders yet.</Typography>}
            <Box sx={{ maxHeight: 450, overflowY: "auto", mb: 2 }}>
              {[...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((order, idx) => (
                <motion.div
                  key={order.id || order._id}
                  initial={{opacity:0, y:6}}
                  animate={{opacity:1, y:0}}
                  transition={{duration:.2, delay: Math.min(idx*0.03, .3)}}
                >
                  <Card className="mb-2 bg-white border border-emerald-200 rounded-2xl shadow-sm">
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6" className="font-semibold">Order #{order.id || order._id}</Typography>
                        <Chip
                          label={getStatusLabel(order.status)}
                          color={getStatusColor(order.status)}
                          className="font-bold"
                          sx={{ cursor: "default", pointerEvents: "none" }}
                        />
                      </Stack>

                      <Typography className="text-slate-700 text-[15px]">
                        Items: {order.items && order.items.map(i => `${i.name} x${i.qty || i.quantity || 1}`).join(", ")}
                      </Typography>
                      <Typography className="text-slate-900 text-[14px]">
                        Total: {formatRupees(order.total)}
                      </Typography>
                      <Typography className="text-slate-600 text-[13px]">
                        Placed: {order.createdAt ? new Date(order.createdAt).toLocaleString() : "-" }
                      </Typography>

                      {/* Dosage/Note editing */}
                      {editOrderId === (order.id || order._id) ? (
                        (order.status !== 3 && order.status !== "delivered" && order.status !== -1 && order.status !== "rejected") ? (
                          <Box sx={{ mt: 1 }}>
                            <TextField
                              label="Dosage"
                              fullWidth
                              value={edit.dosage}
                              onChange={e => setEdit({ ...edit, dosage: e.target.value })}
                              sx={{ mb: 1 }}
                              onFocus={() => setIsEditing(true)}
                              onBlur={() => setIsEditing(false)}
                            />
                            <TextField
                              label="Note"
                              fullWidth
                              value={edit.note}
                              onChange={e => setEdit({ ...edit, note: e.target.value })}
                              sx={{ mb: 1 }}
                              onFocus={() => setIsEditing(true)}
                              onBlur={() => setIsEditing(false)}
                            />
                            <Button size="small" variant="contained" onClick={handleSave} sx={{ mr: 1 }} disabled={loading} startIcon={loading ? <Loader2 className="animate-spin" size={16}/> : null}>Save</Button>
                            <Button size="small" onClick={() => setEditOrderId("")} disabled={loading}>Cancel</Button>
                          </Box>
                        ) : (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2">Dosage: {order.dosage || "-"}</Typography>
                            <Typography variant="body2">Note: {order.note || "-"}</Typography>
                          </Box>
                        )
                      ) : (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2">Dosage: {order.dosage || "-"}</Typography>
                          <Typography variant="body2">Note: {order.note || "-"}</Typography>
                          {(order.status !== 3 && order.status !== "delivered" && order.status !== -1 && order.status !== "rejected") && (
                            <Button size="small" className="mt-2 rounded-xl" onClick={() => setEditOrderId(order.id || order._id)} disabled={loading}>
                              Edit Dosage/Note
                            </Button>
                          )}
                        </Box>
                      )}

                      {/* Status Actions */}
                      <Box sx={{ mt: 2 }}>
                        {(order.status === "placed" || order.status === 0 || order.status === "pending") && (
                          // ========== (E) SWAPPED + RESTYLED BUTTONS ==========
                          <Stack direction="row" spacing={2}>
                            {/* LEFT: REJECT (red, filled) */}
                            <Button
                              size="small"
                              variant="contained"
                              className="rounded-xl"
                              sx={{
                                bgcolor: "#dc2626",
                                color: "white",
                                fontWeight: 800,
                                "&:hover": { bgcolor: "#b91c1c" }
                              }}
                              onClick={async () => {
                                setLoading(true);
                                try {
                                  await axios.patch(
                                    `${API_BASE_URL}/api/pharmacy/orders/${order.id || order._id}`,
                                    { status: "rejected", pharmacyAccepted: false },
                                    { headers: { Authorization: `Bearer ${token}` } }
                                  );
                                  setMsg("Order rejected!");
                                } catch {
                                  setMsg("Failed to reject order!");
                                }
                                setLoading(false);
                              }}
                              disabled={loading}
                            >
                              REJECT ORDER
                            </Button>

                            {/* RIGHT: ACCEPT (deep green, filled) */}
                            <Button
                              size="small"
                              variant="contained"
                              className="rounded-xl"
                              sx={{
                                bgcolor: "#065f46",        // deep emerald-800
                                color: "white",
                                fontWeight: 800,
                                "&:hover": { bgcolor: "#064e3b" }
                              }}
                              onClick={async () => {
                                setLoading(true);
                                try {
                                  await axios.patch(
                                    `${API_BASE_URL}/api/pharmacy/orders/${order.id || order._id}`,
                                    { status: "processing", pharmacyAccepted: true },
                                    { headers: { Authorization: `Bearer ${token}` } }
                                  );
                                  setMsg("Order accepted!");
                                } catch {
                                  setMsg("Failed to accept order!");
                                }
                                setLoading(false);
                              }}
                              disabled={loading}
                            >
                              ACCEPT ORDER
                            </Button>
                          </Stack>
                          // =====================================================
                        )}
                        {(order.status === 1 || order.status === "processing") && (
                          <Chip label="Processing" color="primary" className="mt-2 font-bold" sx={{ pointerEvents: "none" }} />
                        )}
                        {(order.status === 3 || order.status === "delivered") && (
                          <Chip label="Delivered" color="success" className="mt-2 font-bold" sx={{ pointerEvents: "none" }} />
                        )}
                      </Box>

                      {/* Invoice (if available) */}
                      {order.invoiceFile && (
                        <a href={order.invoiceFile} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 no-underline">
                          <Button
                            variant="outlined"
                            className="rounded-xl font-bold"
                            startIcon={<ReceiptLongIcon />}
                            size="small"
                          >
                            Download Invoice
                          </Button>
                        </a>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </Box>
            <Divider className="my-3" />

            {/* ========== (F) INCOMING ORDER POPUP DIALOG ========== */}
            <Dialog open={incomingOpen} onClose={() => setIncomingOpen(false)} fullWidth maxWidth="xs">
              <DialogTitle>New Order</DialogTitle>
              <DialogContent dividers>
                {incomingOrder ? (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      Order #{String(incomingOrder._id || incomingOrder.id).slice(-5)}
                    </Typography>
                    <Typography sx={{ mb: 0.5 }}>
                      <b>Items:</b>{" "}
                      {incomingOrder.items?.map(i => `${i.name} x${i.qty || i.quantity || 1}`).join(", ") || "—"}
                    </Typography>
                    <Typography sx={{ mb: 0.5 }}>
                      <b>Total:</b> {formatRupees(incomingOrder.total || 0)}
                    </Typography>
                    <Typography sx={{ color: "text.secondary" }}>
                      Placed: {incomingOrder.createdAt ? new Date(incomingOrder.createdAt).toLocaleString() : "-"}
                    </Typography>
                  </Box>
                ) : <Typography>No details.</Typography>}
              </DialogContent>
              <DialogActions sx={{ px: 2, pb: 2 }}>
                {/* Reject on LEFT */}
                <Button
                  variant="contained"
                  sx={{ bgcolor: "#dc2626", color: "#fff", fontWeight: 800, "&:hover": { bgcolor: "#b91c1c" } }}
                  onClick={async () => {
                    if (!incomingOrder) return setIncomingOpen(false);
                    try {
                      await axios.patch(
                        `${API_BASE_URL}/api/pharmacy/orders/${incomingOrder._id || incomingOrder.id}`,
                        { status: "rejected", pharmacyAccepted: false },
                        { headers: { Authorization: `Bearer ${token}` } }
                      );
                      setMsg("Order rejected!");
                    } catch { setMsg("Failed to reject order!"); }
                    setIncomingOpen(false);
                  }}
                >
                  REJECT ORDER
                </Button>

                {/* Accept on RIGHT */}
                <Button
                  variant="contained"
                  sx={{ bgcolor: "#065f46", color: "#fff", fontWeight: 800, "&:hover": { bgcolor: "#064e3b" } }}
                  onClick={async () => {
                    if (!incomingOrder) return setIncomingOpen(false);
                    try {
                      await axios.patch(
                        `${API_BASE_URL}/api/pharmacy/orders/${incomingOrder._id || incomingOrder.id}`,
                        { status: "processing", pharmacyAccepted: true },
                        { headers: { Authorization: `Bearer ${token}` } }
                      );
                      setMsg("Order accepted!");
                    } catch { setMsg("Failed to accept order!"); }
                    setIncomingOpen(false);
                  }}
                >
                  ACCEPT ORDER
                </Button>
              </DialogActions>
            </Dialog>
            {/* ========== END INCOMING ORDER POPUP ========== */}

            {/* PRESCRIPTION ORDERS (quotes flow) */}
            <Typography variant="h6" className="mb-1 font-extrabold">Prescription Orders</Typography>
            <PrescriptionOrdersTab token={token} medicines={medicines} />

            {/* Logout */}
            <Box sx={{ width: "100%", position: "relative", pb: 7, textAlign: "center" }}>
              <Button variant="outlined" color="error" size="large" onClick={handleLogout} sx={{ width: 200, mx: "auto", mb: 2 }} className="rounded-xl" startIcon={<LogOut size={16}/>}>
                Logout
              </Button>
            </Box>
          </>
        )}

        {/* ================== EARNINGS TAB ================== */}
        {tab === 1 && (
          <EarningsTab payouts={payouts} />
        )}

        {/* ================== MEDICINES TAB ================== */}
        {tab === 2 && (
          <Box sx={{ mt: 2, mb: 10 }}>
            {/* ✅ Panel 1: Master Catalog */}
            <Card sx={{ mb: 2, bgcolor: "#ffffff", border: "1px solid #d1fae5", borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800}>Master Catalog</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
                  <TextField
                    fullWidth
                    placeholder="Search medicine in master catalog..."
                    value={catalogQ}
                    onChange={(e) => setCatalogQ(e.target.value)}
                  />
                  <Button variant="contained" onClick={fetchCatalog}>Search</Button>
                </Stack>

                <Stack spacing={1} sx={{ mt: 2 }}>
                  {catalog.map((m) => (
                    <Card key={m._id} sx={{ bgcolor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 3 }}>
                      <CardContent>
                        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                          <Stack direction="row" spacing={2} alignItems="center">
                            {m.images?.[0] ? (
                              <img src={m.images[0]} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover" }} />
                            ) : (
                              <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: "#e2e8f0" }} />
                            )}
                            <Box>
                              <Typography fontWeight={800}>{m.name}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                ₹{m.price} • MRP ₹{m.mrp} • {m.productKind}
                              </Typography>
                              {m.prescriptionRequired ? (
                                <Typography variant="caption" color="warning.main">Prescription Required</Typography>
                              ) : null}
                            </Box>
                          </Stack>

                          <Button variant="outlined" onClick={() => addToInventory(m)}>
                            Add to Inventory
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                  {invMsg ? <Typography sx={{ mt: 1 }}>{invMsg}</Typography> : null}
                </Stack>
              </CardContent>
            </Card>

            {/* ✅ Panel 2: My Inventory */}
            <Card sx={{ mb: 2, bgcolor: "#ffffff", border: "1px solid #d1fae5", borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" fontWeight={800}>My Inventory</Typography>
                  <Button variant="outlined" onClick={fetchInventory}>Refresh</Button>
                </Stack>

                <Stack spacing={1} sx={{ mt: 2 }}>
                  {inventory.map((it) => (
                    <Card key={it._id} sx={{ bgcolor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 3 }}>
                      <CardContent>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                          <Box>
                            <Typography fontWeight={800}>{it.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              ₹{Number(it.sellingPrice ?? it.price ?? 0)} • MRP ₹{Number(it.mrp ?? 0)} • Stock {Number(it.stockQty ?? it.stock ?? 0)}
                            </Typography>
                          </Box>

                          <Stack direction="row" spacing={1}>
                            <Button
                              variant="outlined"
                              onClick={() => openEditInventory(it)}
                              sx={{ fontWeight: 800 }}
                            >
                              Edit
                            </Button>

                            <Button
                              variant="outlined"
                              color="error"
                              onClick={() => removeFromInventory(it._id)}
                              sx={{ fontWeight: 800 }}
                            >
                              Remove
                            </Button>
                          </Stack>
                        </Stack>

                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                          Note: Ye changes sirf aapki pharmacy ke liye hain. Master catalog change nahi hoga.
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}

                  {inventory.length === 0 && (
                    <Typography color="text.secondary">No inventory yet. Search master and add medicines.</Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* ✅ Edit Inventory Dialog (My Inventory → Edit) */}
            <Dialog open={editInvOpen} onClose={() => setEditInvOpen(false)} fullWidth maxWidth="sm">
              <DialogTitle>Edit Inventory</DialogTitle>
              <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                  <TextField
                    label="Selling Price"
                    type="number"
                    value={editInvForm.sellingPrice}
                    onChange={(e) => setEditInvForm(f => ({ ...f, sellingPrice: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="MRP"
                    type="number"
                    value={editInvForm.mrp}
                    onChange={(e) => setEditInvForm(f => ({ ...f, mrp: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Stock"
                    type="number"
                    value={editInvForm.stockQty}
                    onChange={(e) => setEditInvForm(f => ({ ...f, stockQty: e.target.value }))}
                    fullWidth
                  />
                  <Typography variant="caption" color="text.secondary">
                    Note: Ye changes sirf aapki pharmacy ke liye hain. Master catalog change nahi hoga.
                  </Typography>
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setEditInvOpen(false)}>Cancel</Button>
                <Button variant="contained" onClick={saveEditInventory} sx={{ fontWeight: 800 }}>
                  Save
                </Button>
              </DialogActions>
            </Dialog>

            {/* ✅ Panel 3: Request New Medicine */}
            <Card sx={{ bgcolor: "#ffffff", border: "1px solid #d1fae5", borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800}>Request New Medicine (If not in Master)</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Same form as “Add Medicine”, but it will go to admin for approval.
                </Typography>

                {/* ✅ Existing medForm UI (unchanged) but submit calls handleRequestMedicine */}
                <Box sx={{ mt: 1, pb: 2, position: "relative" }} className="bg-white rounded-2xl border border-emerald-200 p-3 shadow-sm">
                  <Stack spacing={2}>
                    {/* BRAND TYPE */}
                    <FormControl fullWidth>
                      <InputLabel>Brand Type</InputLabel>
                      <Select
                        label="Brand Type"
                        value={medForm.productKind}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMedForm(f => ({
                            ...f,
                            productKind: v,
                            // hide/clear brand if generic
                            brand: v === "generic" ? "" : f.brand,
                            // optional: ensure name fallback
                            name: v === "generic" ? (f.name || f.composition || "") : (f.name || f.brand || "")
                          }));
                        }}
                      >
                        <MenuItem value="branded">Branded</MenuItem>
                        <MenuItem value="generic">Generic</MenuItem>
                      </Select>
                    </FormControl>

                    {/* BRAND (hidden for Generic) */}
                    {medForm.productKind === "branded" && (
                      <BrandAutocomplete
                        value={medForm.brand}
                        onValueChange={(val) =>
                          setMedForm(f => {
                            const nextBrand = keepUnlessExplicitClear(f.brand, val);
                            return { ...f, brand: nextBrand, name: f.name || nextBrand };
                          })
                        }
                        onPrefill={(p) =>
                          setMedForm(f => ({
                            ...f,
                            productKind: "branded",
                            name: f.name || p.name || f.brand,
                            type: p.type ?? f.type,
                            packCount: p.packCount ?? f.packCount,
                            packUnit: p.packUnit ?? f.packUnit,
                            hsn: p.hsn ?? f.hsn,
                            gstRate: p.gstRate ?? f.gstRate,
                          }))
                        }
                      />
                    )}

                    {/* COMPOSITION with + chips (ADD) */}
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="flex-start">
                      <Box sx={{ flex: 1, width: "100%" }}>
                        <CompositionAutocomplete
                          value={medForm.composition}
                          onValueChange={(val) =>
                            setMedForm(f => ({ ...f, composition: keepUnlessExplicitClear(f.composition, val) }))
                          }
                          onPrefill={(p) =>
                            setMedForm(f => ({
                              ...f,
                              productKind: f.productKind === "generic" ? "generic" : (p.productKind || f.productKind),
                              name: f.productKind === "generic" ? (f.name || p.name || f.composition || "") : f.name,
                              type: p.type ?? f.type,
                              packUnit: p.packUnit ?? f.packUnit,
                              hsn: p.hsn ?? f.hsn,
                              gstRate: p.gstRate ?? f.gstRate,
                            }))
                          }
                        />
                      </Box>
                      <Button
                        variant="outlined"
                        onClick={() =>
                          setMedForm(f => {
                            const toAdd = (f.composition || "").trim();
                            if (!toAdd) return f;
                            const set = new Set((f.compositions || []).map(s => s.toLowerCase()));
                            if (!set.has(toAdd.toLowerCase())) {
                              return { ...f, compositions: [...(f.compositions || []), toAdd], composition: "" };
                            }
                            return { ...f, composition: "" };
                          })
                        }
                      >
                        +
                      </Button>
                    </Stack>
                    {(medForm.compositions || []).length > 0 && (
                      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                        {medForm.compositions.map((c) => (
                          <Chip
                            key={c}
                            label={c}
                            onDelete={() =>
                              setMedForm(f => ({
                                ...f,
                                compositions: (f.compositions || []).filter(x => x.toLowerCase() !== c.toLowerCase())
                              }))
                            }
                          />
                        ))}
                      </Stack>
                    )}

                    <TextField
                      label="Company / Manufacturer"
                      value={medForm.company}
                      onChange={e => setMedForm(f => ({ ...f, company: e.target.value }))}
                    />
                    <TextField
                      label="Selling Price"
                      type="number"
                      value={medForm.price}
                      onChange={e => setMedForm(f => ({ ...f, price: e.target.value }))}
                      onFocus={() => setIsEditing(true)}
                      onBlur={() => setIsEditing(false)}
                    />
                    <TextField
                      label="MRP"
                      type="number"
                      value={medForm.mrp}
                      onChange={e => setMedForm(f => ({ ...f, mrp: e.target.value }))}
                      onFocus={() => setIsEditing(true)}
                      onBlur={() => setIsEditing(false)}
                    />
                    <TextField
                      label="Discount (%)"
                      type="number"
                      value={medForm.discount}
                      onChange={(e) => setMedForm(f => ({ ...f, discount: e.target.value }))}
                      inputProps={{ min: 0, max: 90 }}
                      onFocus={() => setIsEditing(true)}
                      onBlur={() => setIsEditing(false)}
                    />
                    <TextField
                      label="Stock"
                      type="number"
                      value={medForm.stock}
                      onChange={e => setMedForm(f => ({ ...f, stock: e.target.value }))}
                      onFocus={() => setIsEditing(true)}
                      onBlur={() => setIsEditing(false)}
                    />

                    <FormControl fullWidth>
                      <InputLabel>Category</InputLabel>
                      <Select
                        multiple
                        value={Array.isArray(medForm.category) ? medForm.category : (medForm.category ? [medForm.category] : [])}
                        label="Category"
                        onChange={e => setMedForm(f => ({ ...f, category: e.target.value }))}
                        renderValue={(selected) => selected.join(', ')}
                        MenuProps={{ PaperProps: { style: { zIndex: 2000 } } }}
                      >
                        {allPharmacyCategories.map(opt => (
                          <MenuItem key={opt} value={opt}>
                            <Checkbox checked={medForm.category.indexOf(opt) > -1} />
                            <ListItemText primary={opt} />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {((Array.isArray(medForm.category) ? medForm.category.includes("Other") : medForm.category === "Other")) && (
                      <TextField
                        label="Custom Category"
                        value={medForm.customCategory}
                        onChange={e => setMedForm(f => ({ ...f, customCategory: e.target.value }))}
                        onFocus={() => setIsEditing(true)}
                        onBlur={e => { setIsEditing(false); handleCustomCategoryBlur(e.target.value); }}
                        error={!!medMsg && medMsg.toLowerCase().includes('category')}
                        helperText={!!medMsg && medMsg.toLowerCase().includes('category') ? medMsg : ''}
                      />
                    )}

                    <FormControl fullWidth>
                      <InputLabel>Type</InputLabel>
                      <Select value={medForm.type} label="Type" onChange={(e) => {
                        const t = e.target.value;
                        setMedForm(f => ({ ...f, type: t, packCount: "", packUnit: "" }));
                        setUsePackPreset(t !== "Other");   // "Other" → manual fields
                      }}>
                        {TYPE_OPTIONS.map(opt => (<MenuItem key={opt} value={opt}>{opt}</MenuItem>))}
                      </Select>
                    </FormControl>
                    {medForm.type === "Other" && (
                      <TextField
                        label="Custom Type"
                        fullWidth
                        value={medForm.customType}
                        onChange={e => setMedForm(f => ({ ...f, customType: e.target.value }))}
                        onFocus={() => setIsEditing(true)}
                        onBlur={() => setIsEditing(false)}
                      />
                    )}

                    {/* PACK SIZE */}
                    {medForm.type !== "Other" && usePackPreset && (
                      <FormControl fullWidth>
                        <InputLabel>Pack Size</InputLabel>
                        <Select
                          label="Pack Size"
                          value={packLabel(medForm.packCount, medForm.packUnit) || ""}
                          onChange={(e) => {
                            if (e.target.value === "__CUSTOM__") {
                              setUsePackPreset(false);
                              setMedForm(f => ({ ...f, packCount: "", packUnit: "" }));
                              return;
                            }
                            const opt = normalizePackOpt(e.target.value);
                            setMedForm(f => ({ ...f, packCount: opt.count, packUnit: opt.unit }));
                          }}
                        >
                          {(PACK_SIZES_BY_TYPE[medForm.type] || []).map((raw) => {
                            const o = normalizePackOpt(raw);
                            return (
                              <MenuItem key={o.label} value={o.label}>{o.label}</MenuItem>
                            );
                          })}
                          <MenuItem value="__CUSTOM__">Custom…</MenuItem>
                        </Select>
                      </FormControl>
                    )}

                    {(medForm.type === "Other" || !usePackPreset) && (
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <TextField
                          label="Pack Count"
                          type="number"
                          value={medForm.packCount}
                          onChange={e => setMedForm(f => ({ ...f, packCount: e.target.value }))}
                          fullWidth
                        />
                        <FormControl fullWidth>
                          <InputLabel>Pack Unit</InputLabel>
                          <Select
                            label="Pack Unit"
                            value={medForm.packUnit}
                            onChange={e => setMedForm(f => ({ ...f, packUnit: e.target.value }))}
                          >
                            {["tablets","capsules","ml","g","units","sachets","drops"].map(u =>
                              <MenuItem key={u} value={u}>{u}</MenuItem>
                            )}
                          </Select>
                        </FormControl>
                      </Stack>
                    )}

                    {/* Prescription Required toggle */}
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography>Prescription Required</Typography>
                      <Switch
                        checked={!!medForm.prescriptionRequired}
                        onChange={e =>
                          setMedForm(f => ({ ...f, prescriptionRequired: e.target.checked }))
                        }
                        color="success"
                      />
                    </Stack>

                    {/* TAX */}
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        label="HSN Code"
                        value={medForm.hsn}
                        onChange={e => setMedForm(f => ({ ...f, hsn: e.target.value.replace(/[^\d]/g, "") }))}
                        helperText="e.g., 3004"
                        fullWidth
                      />
                      <FormControl fullWidth>
                        <InputLabel>GST Rate</InputLabel>
                        <Select
                          label="GST Rate"
                          value={medForm.gstRate}
                          onChange={e => setMedForm(f => ({ ...f, gstRate: Number(e.target.value) }))}
                        >
                          {[0,5,12,18].map(r => <MenuItem key={r} value={r}>{r}%</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Stack>

                    <Stack direction="row" spacing={2} alignItems="center">
                      {/* Hidden file inputs */}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        ref={fileInputRef}
                        onChange={handleImagesChange}
                      />
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        capture="environment"
                        hidden
                        ref={cameraInputRef}
                        onChange={handleImagesChange}
                      />

                      <Stack direction="row" spacing={1}>
                        {/* Gallery Upload */}
                        <Button
                          startIcon={<PhotoCamera />}
                          variant={medImages && medImages.length ? "contained" : "outlined"}
                          onClick={() => fileInputRef.current && fileInputRef.current.click()}
                          color={medImages && medImages.length ? "success" : "primary"}
                          sx={{ minWidth: 120 }}
                        >
                          {medImages && medImages.length ? `${medImages.length} Image${medImages.length > 1 ? "s" : ""}` : "Upload"}
                        </Button>

                        {/* Camera Capture */}
                        <IconButton
                          color="primary"
                          onClick={() => cameraInputRef.current && cameraInputRef.current.click()}
                        >
                          <PhotoCamera />
                        </IconButton>
                      </Stack>
                    </Stack>

                    {medImages && medImages.length > 0 && (
                      <Stack direction="row" spacing={1} sx={{ my: 1 }}>
                        {medImages.map((img, i) => (
                          <Box key={i} component="img" src={URL.createObjectURL(img)}
                            sx={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", border: "1px solid #e2e8f0" }} />
                        ))}
                      </Stack>
                    )}

                    <Button
                      variant="contained"
                      onClick={handleRequestMedicine}
                      disabled={loading}
                      sx={{ width: "100%", mt: 1 }}
                      className="rounded-xl"
                    >
                      Request Medicine
                    </Button>
                    <Typography color={ medMsg.toLowerCase().includes("fail") || medMsg.toLowerCase().includes("error") ? "error" : "success.main"} variant="body2">
                      {medMsg}
                    </Typography>
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Snackbars */}
        <Snackbar open={!!msg} autoHideDuration={2500} onClose={() => setMsg("")}>
          <Alert onClose={() => setMsg("")} severity={msg.includes("fail") ? "error" : "success"}>{msg}</Alert>
        </Snackbar>
        <Snackbar open={!!medMsg} autoHideDuration={2200} onClose={() => setMedMsg("")}>
          <Alert onClose={() => setMedMsg("")} severity={isErrorText(medMsg) ? "error" : "success"}>
            {medMsg}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
