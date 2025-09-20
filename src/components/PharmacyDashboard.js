// src/components/PharmacyDashboard.js
import React, { useEffect, useState, useRef } from "react";
import {
  Box, Typography, Button, Card, CardContent, TextField, Stack, Chip,
  Snackbar, Alert, ThemeProvider, createTheme, CssBaseline, Divider, IconButton,
  MenuItem, Select, InputLabel, FormControl, Dialog, DialogTitle, DialogContent,
  DialogActions, Switch, Table, TableHead, TableRow, TableCell, TableBody,
  Tabs, Tab, Checkbox, ListItemText, ToggleButton, ToggleButtonGroup
} from "@mui/material";
// (MUI Autocomplete stays imported though unused by design)
import Autocomplete from "@mui/material/Autocomplete";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PhotoCamera from "@mui/icons-material/PhotoCamera";
import SearchIcon from "@mui/icons-material/Search";

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
    const m = raw.trim().match(/^(\d+)\s*([A-Za-z]+)s?$/);
    if (!m) return { count: "", unit: "", label: raw };
    const [, count, unit] = m;
    return { count, unit: unit.toLowerCase(), label: `${count} ${unit.toLowerCase()}` };
  }
  const count = String(raw.count ?? "").trim();
  const unit  = String(raw.unit ?? "").trim().toLowerCase();
  const label = raw.label || (count && unit ? `${count} ${unit}` : "");
  return { count, unit, label };
};

const packLabel = (count, unit) => {
  if (!count || !unit) return "";
  const u = unit.toLowerCase();
  // keep ml/g singular; pluralize others
  const printable = (u === "ml" || u === "g")
    ? u
    : (Number(count) === 1 ? u.replace(/s$/,"") : (u.endsWith("s") ? u : u + "s"));
  return `${count} ${printable}`;
};

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
    packUnit: ""                 // '', 'tablets', 'capsules', 'ml', 'g', 'units', 'sachets', 'drops'
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
    packUnit: ""
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

  const handleAddMedicine = async () => {
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

      // NOTE: if generic, brand should be blank (UI already hides it but we enforce again)
      const safeBrand = medForm.productKind === "generic" ? "" : (medForm.brand || "");

      if (medImages && medImages.length) {
        data = new FormData();
        // Name can be derived by backend; still send current value
        data.append("name", medForm.name);
        data.append("brand", safeBrand);
        data.append("composition", medForm.composition || "");
        data.append("company", medForm.company || "");
        data.append("price", medForm.price);
        data.append("mrp", medForm.mrp);
        data.append("discount", medForm.discount);
        data.append("stock", medForm.stock);
        data.append("category", JSON.stringify(finalCategories));
        data.append("type", medForm.type || "Tablet");
        if (medForm.type === "Other") data.append("customType", medForm.customType || "");
        data.append("prescriptionRequired", medForm.prescriptionRequired);
        // ------- (d) send new fields -------
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
          composition: medForm.composition || "",
          company: medForm.company || "",
          price: medForm.price,
          mrp: medForm.mrp,
          discount: medForm.discount,
          stock: medForm.stock,
          category: finalCategories,
          type: medForm.type || "Tablet",
          ...(medForm.type === "Other" && { customType: medForm.customType || "" }),
          prescriptionRequired: medForm.prescriptionRequired,
          // ------- (d) send new fields -------
          productKind: medForm.productKind,
          hsn: medForm.hsn,
          gstRate: medForm.gstRate,
          packCount: medForm.packCount,
          packUnit: medForm.packUnit
        };
        headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      }

      await axios.post(`${API_BASE_URL}/api/pharmacy/medicines`, data, { headers });
      setMedMsg("Medicine added!");
      setMedForm({
        name: "", brand: "", composition: "", company: "",
        price: "", mrp: "", stock: "", category: "", discount: "",
        customCategory: "", type: "Tablet", customType: "", prescriptionRequired: false,
        productKind: "branded", hsn: "3004", gstRate: 5, packCount: "", packUnit: ""
      });
      setMedImages([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setMedMsg(err?.response?.data?.error || "Failed to add medicine.");
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

      if (editMedImages && editMedImages.length) {
        data = new FormData();
        data.append("name", editMedForm.name);
        data.append("brand", safeBrand);
        data.append("composition", editMedForm.composition || "");
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
          composition: editMedForm.composition || "",
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
                          <Stack direction="row" spacing={2}>
                            <Button
                              size="small"
                              color="primary"
                              variant="outlined"
                              className="rounded-xl"
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
                              Accept Order
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              className="rounded-xl"
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
                              Reject Order
                            </Button>
                          </Stack>
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
          <Box sx={{ mt: 1, mb: 10 }}>
            {/* ▼▼ header with search ▼▼ */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="h6">Medicines</Typography>
              <IconButton
                aria-label="Search medicines"
                size="small"
                onClick={() => setMedSearchOpen(o => !o)}
              >
                <SearchIcon />
              </IconButton>
            </Box>
            {medSearchOpen && (
              <TextField
                placeholder="Search your medicines…"
                size="small"
                fullWidth
                value={medSearch}
                onChange={(e) => setMedSearch(e.target.value)}
                InputProps={{
                  endAdornment: medSearch ? (
                    <IconButton size="small" onClick={() => setMedSearch("")}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  ) : null
                }}
                sx={{ mb: 1 }}
              />
            )}

            {(medSearch
                ? medicines.filter(m => {
                    const q = medSearch.toLowerCase().trim();
                    if (!q) return true;
                    const hay = [
                      m.name,
                      m.brand,
                      m.composition,
                      m.company,
                      Array.isArray(m.category) ? m.category.join(" ") : m.category
                    ].filter(Boolean).join(" ").toLowerCase();
                    return hay.includes(q);
                  })
                : medicines)
              .slice()
              .sort((a,b) => {
                const ua = a.status === "unavailable" ? 1 : 0;
                const ub = b.status === "unavailable" ? 1 : 0;
                if (ua !== ub) return ua - ub;           // unavailable at bottom
                return String(a.name).localeCompare(String(b.name));
              })
              .map(med => (
                <Card
                  key={med.id || med._id}
                  className="mb-2 bg-white border border-emerald-200 rounded-2xl"
                  sx={{ position: "relative" }}
                >
                  <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Typography sx={{ flex: 1 }}>
                      <b>{med.name}</b>
                      {med.brand && (
                        <span style={{ color: "#059669", fontWeight: 400 }}>
                          {" "}({med.brand})
                        </span>
                      )}
                      {med.status === "draft" && (
                        <Chip size="small" label="Draft" color="warning" className="ml-2 font-bold" />
                      )}
                      {med.status === "unavailable" && (
                        <Chip size="small" label="Unavailable" color="error" className="ml-2 font-bold" />
                      )}
                      {" — "}
                      <span style={{ color: "#047857" }}>
                        {(Array.isArray(med.category) ? med.category.join(", ") : med.category) || "Miscellaneous"}
                      </span>
                      <br />
                      {med.composition && (
                        <span style={{ display: "block", color: "#475569" }}>
                          Composition: {med.composition}
                        </span>
                      )}
                      {med.company && (
                        <span style={{ display: "block", color: "#475569" }}>
                          Company: {med.company}
                        </span>
                      )}
                      <b>Selling Price:</b> ₹{med.price} | <b>MRP:</b> ₹{med.mrp} | <b>Stock:</b> {med.stock}
                      <br />
                      <b>Type:</b> {med.type || "Tablet"}
                      {/* --------------------- (e) SHOW PACK SIZE --------------------- */}
                      {(med.packCount || med.packUnit) && (
                        <>
                          {" | "}
                          <b>Pack:</b> {med.packCount || "-"} {med.packUnit || ""}
                        </>
                      )}
                    </Typography>

                    {/* Toggle moved to top-right */}
                    <Box
                      sx={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        bgcolor: "white",
                        px: 1,
                        py: 0.25,
                        borderRadius: 2,
                        boxShadow: 0.5,
                        border: "1px solid",
                        borderColor: "emerald.100",
                      }}
                    >
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        Available
                      </Typography>
                      <Switch
                        size="small"
                        color="success"
                        checked={med.status !== "unavailable"}
                        onChange={() => toggleAvailability(med)}
                        disabled={loading}
                        inputProps={{ "aria-label": "Toggle Availability" }}
                      />
                    </Box>

                    <IconButton
                      color="primary"
                      size="small"
                      onClick={() => handleEditMedicine(med)}
                      disabled={loading}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      color="error"
                      size="small"
                      onClick={() => handleDeleteMedicine(med.id || med._id)}
                      disabled={loading}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </CardContent>
                </Card>
              ))}

            {/* Edit Medicine Dialog (with new fields) */}
            <Dialog open={!!editMedId} onClose={closeEditDialog} fullWidth maxWidth="xs">
              <DialogTitle>Edit Medicine</DialogTitle>
              <DialogContent>
                <Stack spacing={2} mt={1}>
                  {/* BRAND TYPE */}
                  <FormControl fullWidth>
                    <InputLabel>Brand Type</InputLabel>
                    <Select
                      label="Brand Type"
                      value={editMedForm.productKind}
                      onChange={e => setEditMedForm(f => ({
                        ...f,
                        productKind: e.target.value,
                        brand: e.target.value === "generic" ? "" : f.brand,
                        name: e.target.value === "generic" ? (f.name || f.composition || "") : (f.name || f.brand || "")
                      }))}
                    >
                      <MenuItem value="branded">Branded</MenuItem>
                      <MenuItem value="generic">Generic</MenuItem>
                    </Select>
                  </FormControl>

                  {/* BRAND (hidden for Generic) */}
                  {editMedForm.productKind === "branded" && (
                    <TextField
                      label="Brand"
                      fullWidth
                      value={editMedForm.brand}
                      onChange={e =>
                        setEditMedForm(f => ({
                          ...f,
                          brand: e.target.value,
                          name: f.name || linkBrandToName(e.target.value)
                        }))
                      }
                    />
                  )}

                  <TextField
                    label="Composition"
                    fullWidth
                    value={editMedForm.composition}
                    onChange={e => setEditMedForm(f => ({ ...f, composition: e.target.value }))}
                  />
                  <TextField
                    label="Company / Manufacturer"
                    fullWidth
                    value={editMedForm.company}
                    onChange={e => setEditMedForm(f => ({ ...f, company: e.target.value }))}
                  />
                  <TextField
                    label="Selling Price"
                    type="number"
                    fullWidth
                    value={editMedForm.price}
                    onChange={e => setEditMedForm(f => ({ ...f, price: e.target.value }))}
                  />
                  <TextField
                    label="MRP"
                    type="number"
                    fullWidth
                    value={editMedForm.mrp}
                    onChange={e => setEditMedForm(f => ({ ...f, mrp: e.target.value }))}
                  />
                  <TextField
                    label="Stock"
                    type="number"
                    fullWidth
                    value={editMedForm.stock}
                    onChange={e => setEditMedForm(f => ({ ...f, stock: e.target.value }))}
                  />

                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      multiple
                      value={Array.isArray(editMedForm.category) ? editMedForm.category : (editMedForm.category ? [editMedForm.category] : [])}
                      label="Category"
                      onChange={e => setEditMedForm(f => ({ ...f, category: e.target.value }))}
                      renderValue={(selected) => selected.join(', ')}
                    >
                      {allPharmacyCategories.map(opt => (
                        <MenuItem key={opt} value={opt}>
                          <Checkbox checked={editMedForm.category.indexOf(opt) > -1} />
                          <ListItemText primary={opt} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {((Array.isArray(editMedForm.category) ? editMedForm.category.includes("Other") : editMedForm.category === "Other")) && (
                    <TextField
                      label="Custom Category"
                      fullWidth
                      value={editMedForm.customCategory}
                      onChange={e => setEditMedForm(f => ({ ...f, customCategory: e.target.value }))}
                      error={!!medMsg && medMsg.toLowerCase().includes('category')}
                      helperText={!!medMsg && medMsg.toLowerCase().includes('category') ? medMsg : ''}
                    />
                  )}

                  <FormControl fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={editMedForm.type}
                      label="Type"
                      onChange={(e) => {
                        const t = e.target.value;
                        setEditMedForm(f => ({ ...f, type: t, packCount: "", packUnit: "" }));
                        setUsePackPresetEdit(t !== "Other");
                      }}
                    >
                      {TYPE_OPTIONS.map(opt => (
                        <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {editMedForm.type === "Other" && (
                    <TextField
                      label="Custom Type"
                      fullWidth
                      value={editMedForm.customType}
                      onChange={e => setEditMedForm(f => ({ ...f, customType: e.target.value }))}
                    />
                  )}

                  {/* Prescription Required toggle */}
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography>Prescription Required</Typography>
                    <Switch
                      checked={!!editMedForm.prescriptionRequired}
                      onChange={e =>
                        setEditMedForm(f => ({ ...f, prescriptionRequired: e.target.checked }))
                      }
                      color="success"
                    />
                  </Stack>

                  {/* TAX */}
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField
                      label="HSN Code"
                      fullWidth
                      value={editMedForm.hsn}
                      onChange={e => setEditMedForm(f => ({ ...f, hsn: e.target.value.replace(/[^\d]/g, "") }))}
                    />
                    <FormControl fullWidth>
                      <InputLabel>GST Rate</InputLabel>
                      <Select
                        label="GST Rate"
                        value={editMedForm.gstRate}
                        onChange={e => setEditMedForm(f => ({ ...f, gstRate: Number(e.target.value) }))}
                      >
                        {[0,5,12,18].map(r => <MenuItem key={r} value={r}>{r}%</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Stack>

                  {/* PACK SIZE (filtered by Type) */}
                  {editMedForm.type !== "Other" && usePackPresetEdit && (
                    <FormControl fullWidth>
                      <InputLabel>Pack Size</InputLabel>
                      <Select
                        label="Pack Size"
                        value={packLabel(editMedForm.packCount, editMedForm.packUnit) || ""}
                        onChange={(e) => {
                          if (e.target.value === "__CUSTOM__") {
                            setUsePackPresetEdit(false);
                            setEditMedForm(f => ({ ...f, packCount: "", packUnit: "" }));
                            return;
                          }
                          const opt = normalizePackOpt(e.target.value);
                          setEditMedForm(f => ({ ...f, packCount: opt.count, packUnit: opt.unit }));
                        }}
                      >
                        {(PACK_SIZES_BY_TYPE[editMedForm.type] || []).map((raw) => {
                          const o = normalizePackOpt(raw);
                          return (
                            <MenuItem key={o.label} value={o.label}>{o.label}</MenuItem>
                          );
                        })}
                        <MenuItem value="__CUSTOM__">Custom…</MenuItem>
                      </Select>
                    </FormControl>
                  )}

                  {(editMedForm.type === "Other" || !usePackPresetEdit) && (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        label="Pack Count"
                        type="number"
                        fullWidth
                        value={editMedForm.packCount}
                        onChange={e => setEditMedForm(f => ({ ...f, packCount: e.target.value }))}
                      />
                      <FormControl fullWidth>
                        <InputLabel>Pack Unit</InputLabel>
                        <Select
                          label="Pack Unit"
                          value={editMedForm.packUnit}
                          onChange={e => setEditMedForm(f => ({ ...f, packUnit: e.target.value }))}
                        >
                          {["tablets","capsules","ml","g","units","sachets","drops"].map(u =>
                            <MenuItem key={u} value={u}>{u}</MenuItem>
                          )}
                        </Select>
                      </FormControl>
                    </Stack>
                  )}

                  <Stack direction="row" spacing={1} alignItems="center">
                    {/* Gallery Upload */}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      ref={editFileInputRef}
                      onChange={handleEditImagesChange}
                    />
                    <Button
                      startIcon={<PhotoCamera />}
                      variant={editMedImages && editMedImages.length ? "contained" : "outlined"}
                      onClick={() => editFileInputRef.current && editFileInputRef.current.click()}
                      color={editMedImages && editMedImages.length ? "success" : "primary"}
                      sx={{ minWidth: 120 }}
                    >
                      {editMedImages && editMedImages.length ? `${editMedImages.length} Image${editMedImages.length > 1 ? "s" : ""} Ready` : "Upload"}
                    </Button>

                    {/* Camera Capture */}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      hidden
                      ref={cameraEditInputRef}
                      onChange={handleEditImagesChange}
                    />
                    <IconButton
                      color="primary"
                      onClick={() => cameraEditInputRef.current && cameraEditInputRef.current.click()}
                    >
                      <PhotoCamera />
                    </IconButton>
                  </Stack>

                  {editMedId && medicines.find(m => (m._id || m.id) === editMedId)?.images?.length > 0 && (
                    <Stack direction="row" spacing={1} sx={{ my: 1 }}>
                      {medicines.find(m => (m._id || m.id) === editMedId).images.map((imgUrl, i) => (
                        <Box key={imgUrl + i} sx={{ position: "relative", display: "inline-block" }}>
                          <img
                            src={imgUrl.startsWith("http") ? imgUrl : `${API_BASE_URL}${imgUrl}`}
                            alt=""
                            style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", border: "1px solid #e2e8f0" }}
                          />
                          <IconButton
                            size="small"
                            sx={{ position: "absolute", top: -8, right: -8, bgcolor: "#fff" }}
                            onClick={async () => {
                              try {
                                await axios.patch(
                                  `${API_BASE_URL}/api/pharmacy/medicines/${editMedId}/remove-image`,
                                  { image: imgUrl },
                                  { headers: { Authorization: `Bearer ${token}` } }
                                );
                                setMedMsg("Image deleted!");
                                const res = await axios.get(`${API_BASE_URL}/api/pharmacy/medicines`, {
                                  headers: { Authorization: `Bearer ${token}` }
                                });
                                setMedicines(res.data);
                                setEditMedId(editMedId);
                              } catch {
                                setMedMsg("Failed to delete image.");
                              }
                            }}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                    </Stack>
                  )}

                  {editMedImages && editMedImages.length > 0 && (
                    <Stack direction="row" spacing={1} sx={{ my: 1 }}>
                      {editMedImages.map((img, i) => (
                        <Box key={i} component="img" src={URL.createObjectURL(img)}
                          sx={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", border: "1px solid #e2e8f0" }} />
                      ))}
                    </Stack>
                  )}
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={closeEditDialog} color="error">Cancel</Button>
                <Button variant="contained" onClick={handleSaveMedicine} color="success" disabled={loading}>
                  Save
                </Button>
              </DialogActions>
            </Dialog>

            {/* Add Medicine (with new fields) */}
            <Box sx={{ mt: 2, pb: 8, position: "relative" }} className="bg-white rounded-2xl border border-emerald-200 p-3 shadow-sm">
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
                  <TextField
                    label="Brand"
                    value={medForm.brand}
                    onChange={e => setMedForm(f => ({ ...f, brand: e.target.value, name: linkBrandToName(e.target.value) }))}
                    onFocus={() => setIsEditing(true)}
                    onBlur={() => setIsEditing(false)}
                  />
                )}

                <TextField
                  label="Composition (e.g., Paracetamol 650 mg)"
                  value={medForm.composition}
                  onChange={e => setMedForm(f => ({ ...f, composition: e.target.value }))}
                />
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

                {/* TAX (server-side only; never shown to customers) */}
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

                {/* PACK SIZE (filtered by Type) */}
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

                {/* Manual fallback (Type = Other OR user picked Custom…) */}
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
                  onClick={handleAddMedicine}
                  disabled={loading}
                  sx={{ width: "100%", mt: 1, position: "sticky", bottom: 56, zIndex: 2 }}
                  className="rounded-xl"
                >
                  Add Medicine
                </Button>
                <Typography color={ medMsg.toLowerCase().includes("fail") || medMsg.toLowerCase().includes("error") ? "error" : "success.main"} variant="body2">
                  {medMsg}
                </Typography>
              </Stack>
            </Box>
          </Box>
        )}

        {/* Snackbars */}
        <Snackbar open={!!msg} autoHideDuration={2500} onClose={() => setMsg("")}>
          <Alert onClose={() => setMsg("")} severity={msg.includes("fail") ? "error" : "success"}>{msg}</Alert>
        </Snackbar>
        <Snackbar open={!!medMsg} autoHideDuration={2200} onClose={() => setMedMsg("")}>
          <Alert onClose={() => setMedMsg("")} severity={medMsg.includes("fail") ? "error" : "success"}>{medMsg}</Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
