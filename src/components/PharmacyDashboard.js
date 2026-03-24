// src/components/PharmacyDashboard.js
import React, { useEffect, useState, useRef } from "react";
import {
  Box, Typography, Button, Card, CardContent, TextField, Stack, Chip,
  Snackbar, Alert, ThemeProvider, createTheme, CssBaseline, Divider, IconButton,
  MenuItem, Select, InputLabel, FormControl, Dialog, DialogTitle, DialogContent,
  DialogActions, Switch, Table, TableHead, TableRow, TableCell, TableBody,
  Tabs, Tab, Checkbox, ListItemText, ToggleButton, ToggleButtonGroup
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

// eslint-disable-next-line no-unused-vars
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
  const [liveConfig, setLiveConfig] = useState({
    rxEnabled: true,
    otcOnly: false,
    busy: false,
    serviceRadiusMeters: 5000,
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

  const saveLiveConfig = async (patch = {}) => {
    const next = {
      ...liveConfig,
      ...patch,
      serviceRadiusMeters: Number(
        patch.serviceRadiusMeters ?? liveConfig.serviceRadiusMeters ?? 5000
      ),
    };
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
          busy: !!ph.busy,
          serviceRadiusMeters: Number(ph.serviceRadiusMeters || 5000),
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
            busy: !!res.data?.busy,
            serviceRadiusMeters: Number(res.data?.serviceRadiusMeters || 5000),
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

  // Premium style constants
const GD = "#065f46";
const GDL = "#059669";
const GDB = "#064e3b";
const pendingOrders = orders.filter(o => o.status === "placed" || o.status === 0 || o.status === "pending");
const processingOrders = orders.filter(o => o.status === 1 || o.status === "processing");
  const totalEarnings = payouts.reduce((s, p) => s + (p.pharmacyAmount || 0), 0);

  // Master catalog: auto-load on tab switch + search-as-you-type
  const handleCatalogSearch = (q) => {
    setCatalogQ(q);
    if (catalogTimerRef.current) clearTimeout(catalogTimerRef.current);
    catalogTimerRef.current = setTimeout(() => {
      if (q.length >= 2 || q.length === 0) fetchCatalog();
    }, 350);
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

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <Box sx={{ bgcolor: "#f0faf5", minHeight: "100vh" }}>
        <Box sx={{ maxWidth: 520, mx: "auto", px: 1.5, pb: 10 }}>

          {/* ===== PREMIUM HERO HEADER ===== */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Box sx={{
              background: `linear-gradient(135deg, ${GD} 0%, ${GDL} 50%, #10b981 100%)`,
              borderRadius: "0 0 28px 28px",
              px: 2.5, pt: 3, pb: 2.5,
              position: "relative", overflow: "hidden"
            }}>
              {/* Decorative circles */}
              <Box sx={{ position: "absolute", right: -30, top: -30, width: 120, height: 120, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.06)" }} />
              <Box sx={{ position: "absolute", right: 40, bottom: -20, width: 80, height: 80, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.04)" }} />

              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 1.2, textTransform: "uppercase", mb: 0.3 }}>
                    GoDavaii Partner
                  </Typography>
                  <Typography sx={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>
                    {pharmacy?.name || "Pharmacy"}
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{
                    px: 1.5, py: 0.5, borderRadius: 100,
                    bgcolor: active ? "rgba(255,255,255,0.2)" : "rgba(255,100,100,0.25)",
                    display: "flex", alignItems: "center", gap: 0.5,
                  }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: active ? "#4ade80" : "#f87171", boxShadow: active ? "0 0 8px #4ade80" : "0 0 8px #f87171" }} />
                    <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>{active ? "ONLINE" : "OFFLINE"}</Typography>
                  </Box>
                  <Switch
                    checked={active}
                    size="small"
                    onChange={async (e) => {
                      const next = e.target.checked;
                      setActive(next);
                      try { await axios.patch(`${API_BASE_URL}/api/pharmacies/active`, { active: next }, { headers: { Authorization: `Bearer ${token}` } }); }
                      catch { setActive(!next); setMsg("Failed to update."); }
                    }}
                    sx={{ "& .MuiSwitch-thumb": { bgcolor: "#fff" }, "& .Mui-checked .MuiSwitch-thumb": { bgcolor: "#4ade80" } }}
                  />
                </Stack>
              </Stack>

              {/* Quick stats row */}
              <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                {[
                  { label: "Today", value: ordersToday.length, icon: "📦" },
                  { label: "Pending", value: pendingOrders.length, icon: "⏳" },
                  { label: "Delivered", value: completedOrders.length, icon: "✅" },
                  { label: "Earned", value: `₹${Math.round(totalEarnings).toLocaleString("en-IN")}`, icon: "💰" },
                ].map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} style={{ flex: 1 }}>
                    <Box sx={{ bgcolor: "rgba(255,255,255,0.12)", backdropFilter: "blur(10px)", borderRadius: 3, px: 1.5, py: 1.2, textAlign: "center" }}>
                      <Typography sx={{ fontSize: 16, mb: 0.2 }}>{s.icon}</Typography>
                      <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{s.value}</Typography>
                      <Typography sx={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</Typography>
                    </Box>
                  </motion.div>
                ))}
              </Stack>
            </Box>
          </motion.div>

          {/* ===== PILL TABS ===== */}
          <Box sx={{ display: "flex", gap: 0.8, mt: 2, mb: 2, px: 0.5, overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
            {["Overview", "Earnings", "Medicines", "Settlement"].map((label, i) => (
              <motion.button
                key={label}
                whileTap={{ scale: 0.95 }}
                onClick={() => setTab(i)}
                style={{
                  padding: "8px 18px", borderRadius: 100, border: "none", cursor: "pointer",
                  background: tab === i ? GD : "#fff",
                  color: tab === i ? "#fff" : "#334155",
                  fontWeight: 800, fontSize: 13, whiteSpace: "nowrap",
                  boxShadow: tab === i ? `0 4px 14px ${GD}40` : "0 1px 4px rgba(0,0,0,0.06)",
                  transition: "all 0.2s",
                }}
              >
                {label}
              </motion.button>
            ))}
          </Box>

          {/* ================== OVERVIEW TAB ================== */}
          {tab === 0 && (
            <>
              {/* Live Controls Card */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Box sx={{ bgcolor: "#fff", borderRadius: 4, border: "1px solid #d1fae5", p: 2, mb: 2, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color: GD, mb: 1.5, textTransform: "uppercase", letterSpacing: 0.8 }}>
                    Fulfillment Controls
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                    {[
                      { label: "Rx Enabled", key: "rxEnabled", color: GDL },
                      { label: "OTC Only", key: "otcOnly", color: "#0ea5e9" },
                      { label: "Busy Mode", key: "busy", color: "#f59e0b" },
                    ].map((ctrl) => (
                      <Box key={ctrl.key} sx={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        bgcolor: liveConfig[ctrl.key] ? `${ctrl.color}10` : "#f8fafc",
                        border: `1.5px solid ${liveConfig[ctrl.key] ? `${ctrl.color}30` : "#e2e8f0"}`,
                        borderRadius: 3, px: 1.5, py: 1,
                      }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: liveConfig[ctrl.key] ? ctrl.color : "#94a3b8" }}>{ctrl.label}</Typography>
                        <Switch
                          size="small"
                          checked={!!liveConfig[ctrl.key]}
                          disabled={savingLiveConfig}
                          onChange={(e) => saveLiveConfig({ [ctrl.key]: e.target.checked })}
                          sx={{ "& .Mui-checked": { color: ctrl.color } }}
                        />
                      </Box>
                    ))}
                    <Box sx={{
                      display: "flex", alignItems: "center", gap: 1,
                      bgcolor: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 3, px: 1.5, py: 0.5,
                    }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748b", whiteSpace: "nowrap" }}>Radius</Typography>
                      <TextField
                        size="small" type="number" variant="standard"
                        value={liveConfig.serviceRadiusMeters}
                        onChange={(e) => setLiveConfig(prev => ({ ...prev, serviceRadiusMeters: Number(e.target.value || 0) }))}
                        onBlur={() => saveLiveConfig({ serviceRadiusMeters: Number(liveConfig.serviceRadiusMeters || 0) })}
                        InputProps={{ disableUnderline: true, sx: { fontSize: 13, fontWeight: 800, color: GD, textAlign: "right" } }}
                        sx={{ width: 60 }}
                      />
                      <Typography sx={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>m</Typography>
                    </Box>
                  </Box>

                  {/* Location */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={async () => {
                      if (!navigator.geolocation) { alert("Geolocation not supported."); return; }
                      navigator.geolocation.getCurrentPosition(
                        async (pos) => {
                          try {
                            const { latitude, longitude } = pos.coords;
                            const res = await axios.get(`${API_BASE_URL}/api/geocode?lat=${latitude}&lng=${longitude}`);
                            const formatted = res.data.results?.[0]?.formatted_address || "";
                            await axios.patch(`${API_BASE_URL}/api/pharmacies/set-location`, { lat: latitude, lng: longitude, formatted }, { headers: { Authorization: `Bearer ${token}` } });
                            setMsg("Location updated!");
                          } catch { setMsg("Failed to update location!"); }
                        },
                        (err) => alert("Could not fetch location: " + err.message)
                      );
                    }}
                    style={{
                      width: "100%", marginTop: 14, padding: "10px 16px", borderRadius: 14,
                      border: `1.5px solid ${pharmacy.location?.coordinates?.[0] ? "#d1fae5" : "#fde68a"}`,
                      background: pharmacy.location?.coordinates?.[0] ? "#f0fdf4" : "#fffbeb",
                      display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                    }}
                  >
                    <MapPin size={16} color={pharmacy.location?.coordinates?.[0] ? GD : "#d97706"} />
                    <div style={{ textAlign: "left", flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: pharmacy.location?.coordinates?.[0] ? GD : "#92400e" }}>
                        {pharmacy.location?.coordinates?.[0] ? "Location Set" : "Set Your Location"}
                      </div>
                      {pharmacy.location?.formatted && (
                        <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{pharmacy.location.formatted}</div>
                      )}
                    </div>
                  </motion.button>
                </Box>
              </motion.div>

              {/* Pending Orders — Priority */}
              {pendingOrders.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", letterSpacing: 0.8, mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
                    <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#dc2626", animation: "pulse 1.5s infinite" }} />
                    {pendingOrders.length} Pending {pendingOrders.length === 1 ? "Order" : "Orders"}
                  </Typography>
                  {pendingOrders.map((order, idx) => (
                    <motion.div key={order._id || order.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.06 }}>
                      <Box sx={{
                        bgcolor: "#fff", borderRadius: 4, border: "2px solid #fde68a", p: 2, mb: 1.5,
                        boxShadow: "0 4px 16px rgba(234,179,8,0.12)",
                      }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
                            #{String(order._id || order.id).slice(-5)}
                          </Typography>
                          <Typography sx={{ fontSize: 10, color: "#94a3b8" }}>
                            {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                          </Typography>
                        </Stack>

                        {/* Info chips */}
                        <Stack direction="row" spacing={0.8} sx={{ mb: 1.5, flexWrap: "wrap", gap: 0.5 }}>
                          <Chip size="small" icon={<Pill size={12} />} label={`${order.items?.length || 0} items`} sx={{ bgcolor: "#ecfdf5", color: GD, fontWeight: 700, fontSize: 11, height: 26 }} />
                          {order.address?.area && <Chip size="small" icon={<MapPin size={12} />} label={order.address.area} sx={{ bgcolor: "#f0f9ff", color: "#0369a1", fontWeight: 600, fontSize: 11, height: 26 }} />}
                          <Chip size="small" icon={<Wallet size={12} />} label={`₹${Math.round((order.total || 0) * 0.84)}`} sx={{ bgcolor: "#fef9c3", color: "#92400e", fontWeight: 700, fontSize: 11, height: 26 }} />
                        </Stack>

                        {/* Items */}
                        <Typography sx={{ fontSize: 12, color: "#475569", mb: 1.5, lineHeight: 1.5 }}>
                          {order.items?.map(i => `${i.name} x${i.qty || i.quantity || 1}`).join(" | ") || "No items"}
                        </Typography>

                        {/* Action buttons */}
                        <Stack direction="row" spacing={1}>
                          <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleCatalogDecision(order, "full")} disabled={loading}
                            style={{ flex: 2, height: 40, borderRadius: 12, border: "none", background: GD, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: `0 4px 12px ${GD}40` }}>
                            Confirm All
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleCatalogDecision(order, "partial")} disabled={loading}
                            style={{ flex: 1, height: 40, borderRadius: 12, border: `2px solid ${GD}`, background: "#fff", color: GD, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                            Partial
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleCatalogDecision(order, "unavailable")} disabled={loading}
                            style={{ flex: 1, height: 40, borderRadius: 12, border: "2px solid #fecaca", background: "#fff", color: "#dc2626", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            Skip
                          </motion.button>
                        </Stack>
                      </Box>
                    </motion.div>
                  ))}
                </Box>
              )}

              {/* Recent Orders */}
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, mb: 1 }}>
                All Orders
              </Typography>
              {!orders.length && (
                <Box sx={{ textAlign: "center", py: 6 }}>
                  <Typography sx={{ fontSize: 48, mb: 1 }}>📦</Typography>
                  <Typography sx={{ fontSize: 15, fontWeight: 800, color: "#94a3b8" }}>No orders yet</Typography>
                </Box>
              )}
              <Box sx={{ maxHeight: 400, overflowY: "auto", mb: 2 }}>
                {[...orders].filter(o => o.status !== "placed" && o.status !== 0 && o.status !== "pending")
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((order, idx) => (
                  <motion.div key={order._id || order.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.03, 0.2) }}>
                    <Box sx={{ bgcolor: "#fff", borderRadius: 3, border: "1px solid #e2e8f0", p: 1.5, mb: 1, boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>#{String(order._id || order.id).slice(-5)}</Typography>
                          <Chip size="small" label={getStatusLabel(order.status)} color={getStatusColor(order.status)}
                            sx={{ fontWeight: 700, fontSize: 10, height: 22 }} />
                        </Stack>
                        <Typography sx={{ fontSize: 13, fontWeight: 800, color: GD }}>{formatRupees(order.total)}</Typography>
                      </Stack>
                      <Typography sx={{ fontSize: 11, color: "#94a3b8", mt: 0.5 }}>
                        {order.items?.map(i => i.name).join(", ") || "-"}
                      </Typography>
                      {/* Dosage/Note edit for non-delivered */}
                      {editOrderId === (order.id || order._id) ? (
                        <Box sx={{ mt: 1 }}>
                          <TextField size="small" label="Dosage" fullWidth value={edit.dosage} onChange={e => setEdit({ ...edit, dosage: e.target.value })} sx={{ mb: 0.5 }} onFocus={() => setIsEditing(true)} onBlur={() => setIsEditing(false)} />
                          <TextField size="small" label="Note" fullWidth value={edit.note} onChange={e => setEdit({ ...edit, note: e.target.value })} sx={{ mb: 0.5 }} onFocus={() => setIsEditing(true)} onBlur={() => setIsEditing(false)} />
                          <Button size="small" variant="contained" onClick={handleSave} disabled={loading} sx={{ mr: 0.5, fontSize: 11 }}>Save</Button>
                          <Button size="small" onClick={() => setEditOrderId("")} sx={{ fontSize: 11 }}>Cancel</Button>
                        </Box>
                      ) : (
                        (order.status !== 3 && order.status !== "delivered" && order.status !== -1 && order.status !== "rejected") && (
                          <Button size="small" sx={{ mt: 0.5, fontSize: 10, fontWeight: 700 }} onClick={() => { setEditOrderId(order._id || order.id); setEdit({ dosage: order.dosage || "", note: order.note || "" }); }}>
                            Edit Note
                          </Button>
                        )
                      )}
                      {order.invoiceFile && (
                        <a href={order.invoiceFile} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                          <Button size="small" variant="outlined" startIcon={<ReceiptLongIcon sx={{ fontSize: 14 }} />} sx={{ mt: 0.5, fontSize: 10, fontWeight: 700 }}>Invoice</Button>
                        </a>
                      )}
                    </Box>
                  </motion.div>
                ))}
              </Box>

              {/* Incoming Order Dialog */}
              <Dialog open={incomingOpen} onClose={() => setIncomingOpen(false)} fullWidth maxWidth="xs"
                PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}>
                <Box sx={{ background: `linear-gradient(135deg, ${GD}, ${GDL})`, px: 2.5, py: 2 }}>
                  <Typography sx={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>New Order Received!</Typography>
                </Box>
                <DialogContent sx={{ pt: 2.5 }}>
                  {incomingOrder ? (
                    <Box>
                      <Typography sx={{ fontSize: 15, fontWeight: 800, mb: 1 }}>Order #{String(incomingOrder._id || incomingOrder.id).slice(-5)}</Typography>
                      <Stack direction="row" spacing={0.8} sx={{ mb: 1.5, flexWrap: "wrap", gap: 0.5 }}>
                        <Chip size="small" icon={<Pill size={12} />} label={`${incomingOrder.items?.length || 0} items`} sx={{ bgcolor: "#ecfdf5", color: GD, fontWeight: 700 }} />
                        {incomingOrder.address?.area && <Chip size="small" icon={<MapPin size={12} />} label={incomingOrder.address.area} sx={{ bgcolor: "#f0f9ff", color: "#0369a1", fontWeight: 600 }} />}
                        <Chip size="small" icon={<Wallet size={12} />} label={`Est. ₹${Math.round((incomingOrder.total || 0) * 0.84)} payout`} sx={{ bgcolor: "#fef9c3", color: "#92400e", fontWeight: 700 }} />
                      </Stack>
                      <Typography sx={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
                        {incomingOrder.items?.map(i => `${i.name} x${i.qty || i.quantity || 1}`).join(", ") || "No items"}
                      </Typography>
                      <Typography sx={{ fontSize: 15, fontWeight: 800, color: GD, mt: 1 }}>Total: {formatRupees(incomingOrder.total || 0)}</Typography>
                    </Box>
                  ) : <Typography>No details.</Typography>}
                </DialogContent>
                <DialogActions sx={{ px: 2.5, pb: 2.5, gap: 1 }}>
                  <Button fullWidth variant="outlined" sx={{ borderColor: "#fecaca", color: "#dc2626", fontWeight: 800, borderRadius: 3, py: 1.2 }}
                    onClick={async () => { if (!incomingOrder) return setIncomingOpen(false); await handleCatalogDecision(incomingOrder, "unavailable"); setIncomingOpen(false); }}>
                    Skip
                  </Button>
                  <Button fullWidth variant="contained" sx={{ bgcolor: GD, fontWeight: 800, borderRadius: 3, py: 1.2, boxShadow: `0 4px 12px ${GD}40`, "&:hover": { bgcolor: GDB } }}
                    onClick={async () => { if (!incomingOrder) return setIncomingOpen(false); await handleCatalogDecision(incomingOrder, "full"); setIncomingOpen(false); }}>
                    Accept Order
                  </Button>
                </DialogActions>
              </Dialog>

              {/* Prescription Orders */}
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, mb: 1, mt: 2 }}>
                Prescription Orders
              </Typography>
              <PrescriptionOrdersTab token={token} medicines={medicines} />

              {/* Logout */}
              <Box sx={{ textAlign: "center", mt: 4, mb: 2 }}>
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleLogout}
                  style={{ padding: "10px 32px", borderRadius: 100, border: "2px solid #fecaca", background: "#fff", color: "#dc2626", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                  <LogOut size={14} style={{ marginRight: 6, verticalAlign: "middle" }} /> Logout
                </motion.button>
              </Box>
            </>
          )}

          {/* ================== EARNINGS TAB ================== */}
          {tab === 1 && <EarningsTab payouts={payouts} />}

          {/* ================== MEDICINES TAB ================== */}
          {tab === 2 && (
            <Box sx={{ mb: 10 }}>

              {/* ===== MASTER CATALOG — Browse & Add ===== */}
              <Box sx={{ bgcolor: "#fff", borderRadius: 4, border: "1px solid #d1fae5", p: 2, mb: 2, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <Typography sx={{ fontSize: 14, fontWeight: 900, color: GD, mb: 0.5 }}>
                  Add from Master Catalog
                </Typography>
                <Typography sx={{ fontSize: 11, color: "#94a3b8", mb: 1.5 }}>
                  Search and add medicines instantly. Override price if needed.
                </Typography>

                {/* Search */}
                <TextField
                  fullWidth size="small"
                  placeholder="Search medicine name, brand, composition..."
                  value={catalogQ}
                  onChange={(e) => handleCatalogSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchCatalog()}
                  InputProps={{
                    sx: { borderRadius: 3, bgcolor: "#f8fafc", fontWeight: 600, fontSize: 13 },
                  }}
                />

                {/* Catalog Results */}
                <Box sx={{ mt: 1.5, maxHeight: 420, overflowY: "auto" }}>
                  {catalog.map((m) => {
                    const inInv = inventory.some(inv => String(inv.medicineMasterId) === String(m._id));
                    const hasOverride = priceOverride[m._id];
                    return (
                      <motion.div key={m._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <Box sx={{
                          display: "flex", alignItems: "center", gap: 1.5, p: 1.5, mb: 1,
                          bgcolor: inInv ? "#f0fdf4" : "#fafafa", borderRadius: 3,
                          border: `1.5px solid ${inInv ? "#bbf7d0" : "#f1f5f9"}`,
                          transition: "all 0.15s",
                        }}>
                          {/* Image */}
                          {m.images?.[0] ? (
                            <img src={m.images[0]} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                          ) : (
                            <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: "#e2e8f0", flexShrink: 0, display: "grid", placeItems: "center" }}>
                              <Pill size={18} color="#94a3b8" />
                            </Box>
                          )}

                          {/* Info */}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</Typography>
                            <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                              ₹{m.price} | MRP ₹{m.mrp} {m.composition ? `| ${m.composition.slice(0,30)}` : ""}
                            </Typography>
                            {m.prescriptionRequired && <Typography sx={{ fontSize: 9, color: "#ea580c", fontWeight: 700, mt: 0.2 }}>Rx Required</Typography>}
                          </Box>

                          {/* Action */}
                          {inInv ? (
                            <Chip size="small" label="Added" sx={{ bgcolor: "#dcfce7", color: GD, fontWeight: 800, fontSize: 10 }} />
                          ) : (
                            <Stack spacing={0.5} alignItems="flex-end">
                              {!hasOverride ? (
                                <Stack direction="row" spacing={0.5}>
                                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => addToInventoryWithPrice(m)}
                                    style={{ padding: "6px 14px", borderRadius: 10, border: "none", background: GD, color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                                    + Add
                                  </motion.button>
                                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setPriceOverride(p => ({ ...p, [m._id]: { price: m.price, mrp: m.mrp, stock: 1 } }))}
                                    style={{ padding: "6px 10px", borderRadius: 10, border: `1.5px solid ${GD}40`, background: "#fff", color: GD, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                                    Set Price
                                  </motion.button>
                                </Stack>
                              ) : (
                                <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexWrap: "wrap" }}>
                                  <TextField size="small" type="number" label="Price" value={hasOverride.price}
                                    onChange={(e) => setPriceOverride(p => ({ ...p, [m._id]: { ...p[m._id], price: e.target.value } }))}
                                    sx={{ width: 70, "& input": { fontSize: 11, p: "6px 8px" } }} />
                                  <TextField size="small" type="number" label="Stock" value={hasOverride.stock}
                                    onChange={(e) => setPriceOverride(p => ({ ...p, [m._id]: { ...p[m._id], stock: e.target.value } }))}
                                    sx={{ width: 60, "& input": { fontSize: 11, p: "6px 8px" } }} />
                                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => addToInventoryWithPrice(m)}
                                    style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: GD, color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                                    Add
                                  </motion.button>
                                </Box>
                              )}
                            </Stack>
                          )}
                        </Box>
                      </motion.div>
                    );
                  })}
                  {catalog.length === 0 && catalogQ.length >= 2 && (
                    <Box sx={{ textAlign: "center", py: 3 }}>
                      <Typography sx={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>No medicines found. Try different keywords.</Typography>
                    </Box>
                  )}
                </Box>
                {invMsg && <Typography sx={{ mt: 1, fontSize: 12, fontWeight: 700, color: invMsg.includes("Failed") || invMsg.includes("❌") ? "#dc2626" : GD }}>{invMsg}</Typography>}
              </Box>

              {/* ===== MY INVENTORY ===== */}
              <Box sx={{ bgcolor: "#fff", borderRadius: 4, border: "1px solid #d1fae5", p: 2, mb: 2, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 900, color: GD }}>My Inventory</Typography>
                    <Typography sx={{ fontSize: 11, color: "#94a3b8" }}>{inventory.length} medicines stocked</Typography>
                  </Box>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={fetchInventory}
                    style={{ padding: "6px 14px", borderRadius: 10, border: `1.5px solid ${GD}30`, background: "#f0fdf4", color: GD, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    Refresh
                  </motion.button>
                </Stack>

                {inventory.length === 0 ? (
                  <Box sx={{ textAlign: "center", py: 4 }}>
                    <Typography sx={{ fontSize: 36, mb: 1 }}>💊</Typography>
                    <Typography sx={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>No inventory yet. Search master catalog above to add medicines.</Typography>
                  </Box>
                ) : (
                  <Box sx={{ maxHeight: 380, overflowY: "auto" }}>
                    {inventory.map((it) => (
                      <Box key={it._id} sx={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1,
                        p: 1.5, mb: 1, bgcolor: "#fafafa", borderRadius: 3, border: "1px solid #f1f5f9",
                      }}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</Typography>
                          <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                            ₹{Number(it.sellingPrice ?? it.price ?? 0)} | MRP ₹{Number(it.mrp ?? 0)} | Stock: {Number(it.stockQty ?? it.stock ?? 0)}
                          </Typography>
                          {it.priceOverrideStatus === "pending" && (
                            <Typography sx={{ fontSize: 9, fontWeight: 800, color: "#d97706", bgcolor: "#fef3c7", display: "inline-block", px: 1, py: 0.2, borderRadius: 2, mt: 0.3 }}>
                              Price change ₹{it.requestedPrice} pending admin approval
                            </Typography>
                          )}
                          {it.priceOverrideStatus === "approved" && it.requestedPrice > 0 && (
                            <Typography sx={{ fontSize: 9, fontWeight: 800, color: "#059669", bgcolor: "#d1fae5", display: "inline-block", px: 1, py: 0.2, borderRadius: 2, mt: 0.3 }}>
                              Price override approved
                            </Typography>
                          )}
                          {it.priceOverrideStatus === "rejected" && (
                            <Typography sx={{ fontSize: 9, fontWeight: 800, color: "#dc2626", bgcolor: "#fee2e2", display: "inline-block", px: 1, py: 0.2, borderRadius: 2, mt: 0.3 }}>
                              Price override rejected — using master catalog price
                            </Typography>
                          )}
                        </Box>
                        <Stack direction="row" spacing={0.5}>
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => openEditInventory(it)}
                            style={{ padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${GD}30`, background: "#fff", color: GD, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            Edit
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => removeFromInventory(it._id)}
                            style={{ padding: "5px 10px", borderRadius: 8, border: "1.5px solid #fecaca", background: "#fff", color: "#dc2626", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            Remove
                          </motion.button>
                        </Stack>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              {/* Edit Inventory Dialog */}
              <Dialog open={editInvOpen} onClose={() => setEditInvOpen(false)} fullWidth maxWidth="xs"
                PaperProps={{ sx: { borderRadius: 4 } }}>
                <Box sx={{ background: `linear-gradient(135deg, ${GD}, ${GDL})`, px: 2.5, py: 1.5 }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>Edit Price & Stock</Typography>
                  <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Changes apply only to your pharmacy</Typography>
                </Box>
                <DialogContent sx={{ pt: 2.5 }}>
                  <Stack spacing={2}>
                    <TextField label="Selling Price" type="number" value={editInvForm.sellingPrice}
                      onChange={(e) => setEditInvForm(f => ({ ...f, sellingPrice: e.target.value }))} fullWidth />
                    <TextField label="MRP" type="number" value={editInvForm.mrp}
                      onChange={(e) => setEditInvForm(f => ({ ...f, mrp: e.target.value }))} fullWidth />
                    <TextField label="Stock Quantity" type="number" value={editInvForm.stockQty}
                      onChange={(e) => setEditInvForm(f => ({ ...f, stockQty: e.target.value }))} fullWidth />
                  </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 2.5, pb: 2 }}>
                  <Button onClick={() => setEditInvOpen(false)} sx={{ color: "#94a3b8" }}>Cancel</Button>
                  <Button variant="contained" onClick={saveEditInventory} sx={{ bgcolor: GD, fontWeight: 800, borderRadius: 3, px: 3, "&:hover": { bgcolor: GDB } }}>Save</Button>
                </DialogActions>
              </Dialog>

              {/* ===== REQUEST NEW MEDICINE ===== */}
              <Box sx={{ bgcolor: "#fff", borderRadius: 4, border: "1px solid #fde68a", p: 2, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#92400e", mb: 0.3 }}>
                  Request New Medicine
                </Typography>
                <Typography sx={{ fontSize: 11, color: "#94a3b8", mb: 2 }}>
                  Medicine not in master catalog? Submit for admin approval.
                </Typography>

                <Stack spacing={2}>
                  {/* BRAND TYPE */}
                  <FormControl fullWidth size="small">
                    <InputLabel>Brand Type</InputLabel>
                    <Select label="Brand Type" value={medForm.productKind}
                      onChange={(e) => { const v = e.target.value; setMedForm(f => ({ ...f, productKind: v, brand: v === "generic" ? "" : f.brand, name: v === "generic" ? (f.name || f.composition || "") : (f.name || f.brand || "") })); }}>
                      <MenuItem value="branded">Branded</MenuItem>
                      <MenuItem value="generic">Generic</MenuItem>
                    </Select>
                  </FormControl>

                  {medForm.productKind === "branded" && (
                    <BrandAutocomplete value={medForm.brand}
                      onValueChange={(val) => setMedForm(f => { const nb = keepUnlessExplicitClear(f.brand, val); return { ...f, brand: nb, name: f.name || nb }; })}
                      onPrefill={(p) => setMedForm(f => ({ ...f, productKind: "branded", name: f.name || p.name || f.brand, type: p.type ?? f.type, packCount: p.packCount ?? f.packCount, packUnit: p.packUnit ?? f.packUnit, hsn: p.hsn ?? f.hsn, gstRate: p.gstRate ?? f.gstRate }))} />
                  )}

                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Box sx={{ flex: 1 }}>
                      <CompositionAutocomplete value={medForm.composition}
                        onValueChange={(val) => setMedForm(f => ({ ...f, composition: keepUnlessExplicitClear(f.composition, val) }))}
                        onPrefill={(p) => setMedForm(f => ({ ...f, productKind: f.productKind === "generic" ? "generic" : (p.productKind || f.productKind), name: f.productKind === "generic" ? (f.name || p.name || f.composition || "") : f.name, type: p.type ?? f.type, packUnit: p.packUnit ?? f.packUnit, hsn: p.hsn ?? f.hsn, gstRate: p.gstRate ?? f.gstRate }))} />
                    </Box>
                    <Button variant="outlined" size="small" onClick={() => setMedForm(f => { const a = (f.composition || "").trim(); if (!a) return f; const s = new Set((f.compositions || []).map(x => x.toLowerCase())); if (!s.has(a.toLowerCase())) return { ...f, compositions: [...(f.compositions || []), a], composition: "" }; return { ...f, composition: "" }; })}>+</Button>
                  </Stack>
                  {(medForm.compositions || []).length > 0 && (
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
                      {medForm.compositions.map((c) => <Chip key={c} size="small" label={c} onDelete={() => setMedForm(f => ({ ...f, compositions: (f.compositions || []).filter(x => x.toLowerCase() !== c.toLowerCase()) }))} />)}
                    </Stack>
                  )}

                  <TextField size="small" label="Company" value={medForm.company} onChange={e => setMedForm(f => ({ ...f, company: e.target.value }))} />

                  <Stack direction="row" spacing={1}>
                    <TextField size="small" label="Price" type="number" value={medForm.price} onChange={e => setMedForm(f => ({ ...f, price: e.target.value }))} fullWidth onFocus={() => setIsEditing(true)} onBlur={() => setIsEditing(false)} />
                    <TextField size="small" label="MRP" type="number" value={medForm.mrp} onChange={e => setMedForm(f => ({ ...f, mrp: e.target.value }))} fullWidth onFocus={() => setIsEditing(true)} onBlur={() => setIsEditing(false)} />
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <TextField size="small" label="Stock" type="number" value={medForm.stock} onChange={e => setMedForm(f => ({ ...f, stock: e.target.value }))} fullWidth onFocus={() => setIsEditing(true)} onBlur={() => setIsEditing(false)} />
                    <TextField size="small" label="Discount %" type="number" value={medForm.discount} onChange={e => setMedForm(f => ({ ...f, discount: e.target.value }))} inputProps={{ min: 0, max: 90 }} fullWidth onFocus={() => setIsEditing(true)} onBlur={() => setIsEditing(false)} />
                  </Stack>

                  <FormControl fullWidth size="small">
                    <InputLabel>Category</InputLabel>
                    <Select multiple value={Array.isArray(medForm.category) ? medForm.category : (medForm.category ? [medForm.category] : [])} label="Category"
                      onChange={e => setMedForm(f => ({ ...f, category: e.target.value }))} renderValue={(sel) => sel.join(", ")} MenuProps={{ PaperProps: { style: { zIndex: 2000 } } }}>
                      {allPharmacyCategories.map(opt => <MenuItem key={opt} value={opt}><Checkbox size="small" checked={Array.isArray(medForm.category) && medForm.category.indexOf(opt) > -1} /><ListItemText primary={opt} /></MenuItem>)}
                    </Select>
                  </FormControl>
                  {((Array.isArray(medForm.category) ? medForm.category.includes("Other") : medForm.category === "Other")) && (
                    <TextField size="small" label="Custom Category" value={medForm.customCategory}
                      onChange={e => setMedForm(f => ({ ...f, customCategory: e.target.value }))}
                      onFocus={() => setIsEditing(true)} onBlur={e => { setIsEditing(false); handleCustomCategoryBlur(e.target.value); }}
                      error={!!medMsg && medMsg.toLowerCase().includes("category")} helperText={!!medMsg && medMsg.toLowerCase().includes("category") ? medMsg : ""} />
                  )}

                  <FormControl fullWidth size="small">
                    <InputLabel>Type</InputLabel>
                    <Select value={medForm.type} label="Type" onChange={(e) => { setMedForm(f => ({ ...f, type: e.target.value, packCount: "", packUnit: "" })); setUsePackPreset(e.target.value !== "Other"); }}>
                      {TYPE_OPTIONS.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                    </Select>
                  </FormControl>
                  {medForm.type === "Other" && <TextField size="small" label="Custom Type" fullWidth value={medForm.customType} onChange={e => setMedForm(f => ({ ...f, customType: e.target.value }))} onFocus={() => setIsEditing(true)} onBlur={() => setIsEditing(false)} />}

                  {medForm.type !== "Other" && usePackPreset && (
                    <FormControl fullWidth size="small">
                      <InputLabel>Pack Size</InputLabel>
                      <Select label="Pack Size" value={packLabel(medForm.packCount, medForm.packUnit) || ""}
                        onChange={(e) => { if (e.target.value === "__CUSTOM__") { setUsePackPreset(false); setMedForm(f => ({ ...f, packCount: "", packUnit: "" })); return; } const opt = normalizePackOpt(e.target.value); setMedForm(f => ({ ...f, packCount: opt.count, packUnit: opt.unit })); }}>
                        {(PACK_SIZES_BY_TYPE[medForm.type] || []).map((raw) => { const o = normalizePackOpt(raw); return <MenuItem key={o.label} value={o.label}>{o.label}</MenuItem>; })}
                        <MenuItem value="__CUSTOM__">Custom...</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                  {(medForm.type === "Other" || !usePackPreset) && (
                    <Stack direction="row" spacing={1}>
                      <TextField size="small" label="Pack Count" type="number" value={medForm.packCount} onChange={e => setMedForm(f => ({ ...f, packCount: e.target.value }))} fullWidth />
                      <FormControl fullWidth size="small">
                        <InputLabel>Pack Unit</InputLabel>
                        <Select label="Pack Unit" value={medForm.packUnit} onChange={e => setMedForm(f => ({ ...f, packUnit: e.target.value }))}>
                          {["tablets","capsules","ml","g","units","sachets","drops"].map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Stack>
                  )}

                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography sx={{ fontSize: 13 }}>Prescription Required</Typography>
                    <Switch checked={!!medForm.prescriptionRequired} onChange={e => setMedForm(f => ({ ...f, prescriptionRequired: e.target.checked }))} color="success" size="small" />
                  </Stack>

                  <Stack direction="row" spacing={1}>
                    <TextField size="small" label="HSN" value={medForm.hsn} onChange={e => setMedForm(f => ({ ...f, hsn: e.target.value.replace(/[^\d]/g, "") }))} fullWidth />
                    <FormControl fullWidth size="small">
                      <InputLabel>GST</InputLabel>
                      <Select label="GST" value={medForm.gstRate} onChange={e => setMedForm(f => ({ ...f, gstRate: Number(e.target.value) }))}>
                        {[0, 5, 12, 18].map(r => <MenuItem key={r} value={r}>{r}%</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <input type="file" accept="image/*" multiple hidden ref={fileInputRef} onChange={handleImagesChange} />
                    <input type="file" accept="image/*" multiple capture="environment" hidden ref={cameraInputRef} onChange={handleImagesChange} />
                    <Button size="small" startIcon={<PhotoCamera />} variant={medImages?.length ? "contained" : "outlined"}
                      onClick={() => fileInputRef.current?.click()} color={medImages?.length ? "success" : "primary"} sx={{ fontSize: 11 }}>
                      {medImages?.length ? `${medImages.length} Image${medImages.length > 1 ? "s" : ""}` : "Upload"}
                    </Button>
                    <IconButton size="small" color="primary" onClick={() => cameraInputRef.current?.click()}><PhotoCamera fontSize="small" /></IconButton>
                  </Stack>
                  {medImages?.length > 0 && (
                    <Stack direction="row" spacing={0.5}>
                      {medImages.map((img, i) => <Box key={i} component="img" src={URL.createObjectURL(img)} sx={{ width: 44, height: 44, borderRadius: 2, objectFit: "cover", border: "1px solid #e2e8f0" }} />)}
                    </Stack>
                  )}

                  <motion.button whileTap={{ scale: 0.97 }} onClick={handleRequestMedicine} disabled={loading}
                    style={{ width: "100%", height: 44, borderRadius: 14, border: "none", background: `linear-gradient(135deg, #92400e, #b45309)`, color: "#fff", fontSize: 14, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, boxShadow: "0 4px 14px rgba(146,64,14,0.3)" }}>
                    {loading ? "Submitting..." : "Submit for Admin Approval"}
                  </motion.button>
                </Stack>
              </Box>
            </Box>
          )}

          {/* ================== SETTLEMENT TAB ================== */}
          {tab === 3 && <PharmacySettlementTab token={token} />}

          {/* Snackbars */}
          <Snackbar open={!!msg} autoHideDuration={2500} onClose={() => setMsg("")}>
            <Alert onClose={() => setMsg("")} severity={msg.includes("fail") || msg.includes("Failed") ? "error" : "success"}>{msg}</Alert>
          </Snackbar>
          <Snackbar open={!!medMsg} autoHideDuration={2200} onClose={() => setMedMsg("")}>
            <Alert onClose={() => setMedMsg("")} severity={isErrorText(medMsg) ? "error" : "success"}>{medMsg}</Alert>
          </Snackbar>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
