// src/components/PharmacyDashboard.js
import React, { useEffect, useState, useRef } from "react";
import {
  Box, Typography, Button, Card, CardContent, TextField, Stack, Chip,
  Snackbar, Alert, ThemeProvider, createTheme, CssBaseline, Divider, IconButton,
  MenuItem, Select, InputLabel, FormControl, Dialog, DialogTitle, DialogContent,
  DialogActions, Switch, Table, TableHead, TableRow, TableCell, TableBody,
  Tabs, Tab, Checkbox, ListItemText, ToggleButton, ToggleButtonGroup
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DoneIcon from "@mui/icons-material/Done";
import CloseIcon from "@mui/icons-material/Close";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PhotoCamera from "@mui/icons-material/PhotoCamera";
import stringSimilarity from "string-similarity";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

/* ---------------------------- UTILITIES ---------------------------- */

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#13C0A2" },
    secondary: { main: "#FFD43B" },
    success: { main: "#33C37E" },
  },
});

function formatRupees(val) {
  if (!val) return "₹0";
  return "₹" + Number(val).toLocaleString("en-IN");
}
function todayString() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function isToday(date) {
  const d = new Date(date);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}
function isThisWeek(date) {
  const d = new Date(date);
  const now = new Date();
  const first = new Date(now);
  first.setHours(0,0,0,0);
  first.setDate(now.getDate() - now.getDay()); // Sunday start
  const last = new Date(first);
  last.setDate(first.getDate() + 6);
  last.setHours(23,59,59,999);
  return d >= first && d <= last;
}
function isThisMonth(date) {
  const d = new Date(date);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}
function isThisYear(date) {
  const d = new Date(date);
  const now = new Date();
  return d.getFullYear() === now.getFullYear();
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  return x;
}
function startOfWeek(d) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay()); // Sunday
  return x;
}
function startOfMonth(d) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}
function ymd(date) {
  const d = new Date(date);
  return d.toISOString().slice(0,10);
}
function ym(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function weekLabel(date) {
  const s = startOfWeek(date);
  return `Week of ${ymd(s)}`;
}

/* ----------------------- STATUS / MISC HELPERS ---------------------- */

const MED_CATEGORIES = [
  "Pain Relief","Fever","Cough & Cold","Antibiotic","Digestive",
  "Diabetes","Hypertension","Supplements","Other"
];
const TYPE_OPTIONS = [
  "Tablet","Syrup","Injection","Cream","Ointment",
  "Drop","Spray","Inhaler","Other"
];

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
  // totals
  const totalAll = payouts.reduce((s, p) => s + (p.pharmacyAmount || 0), 0);
  const largest = payouts.reduce((m, p) => Math.max(m, Number(p.pharmacyAmount || 0)), 0);
  const avg = payouts.length ? totalAll / payouts.length : 0;

  // aggregates
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
    .map(([key, amount]) => ({
      key, date: new Date(key + "-01"), amount
    }))
    .sort((a,b) => b.date - a.date)
    .slice(0, 12);

  const [view, setView] = useState("daily"); // daily | weekly | monthly

  // ===== NEW: fetch order details so we can show items & invoice =====
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
    <Box sx={{ mt: 1 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <Card sx={{ flex: 1, bgcolor: "#21272b" }}>
          <CardContent>
            <Typography variant="subtitle2" color="#FFD43B">Total Earnings (All Time)</Typography>
            <Typography variant="h5" fontWeight={800}>{formatRupees(totalAll)}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, bgcolor: "#21272b" }}>
          <CardContent>
            <Typography variant="subtitle2" color="#FFD43B">Payouts</Typography>
            <Typography variant="h5" fontWeight={800}>{payouts.length}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, bgcolor: "#21272b" }}>
          <CardContent>
            <Typography variant="subtitle2" color="#FFD43B">Average Payout</Typography>
            <Typography variant="h5" fontWeight={800}>{formatRupees(avg)}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, bgcolor: "#21272b" }}>
          <CardContent>
            <Typography variant="subtitle2" color="#FFD43B">Largest Payout</Typography>
            <Typography variant="h5" fontWeight={800}>{formatRupees(largest)}</Typography>
          </CardContent>
        </Card>
      </Stack>

      {/* View switcher */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="subtitle2" sx={{ color: "#9bb4b0" }}>View:</Typography>
        <ToggleButtonGroup
          exclusive
          color="primary"
          size="small"
          value={view}
          onChange={(_, v) => v && setView(v)}
        >
          <ToggleButton value="daily">Daily</ToggleButton>
          <ToggleButton value="weekly">Weekly</ToggleButton>
          <ToggleButton value="monthly">Monthly</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* Aggregated table */}
      <Card sx={{ bgcolor: "#181d23", mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 800 }}>
            {view === "daily" ? "Daily totals (last 30 days)"
              : view === "weekly" ? "Weekly totals (last 12 weeks)"
              : "Monthly totals (last 12 months)"}
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

      {/* Raw payouts table — now horizontally scrollable + extra columns */}
      <Card sx={{ bgcolor: "#181d23" }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 800 }}>
            All Payouts
          </Typography>

          {/* SCROLL WRAPPER */}
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 980 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Order</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  {/* NEW COLUMNS */}
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
                    const order = orderId ? (ordersById[orderId] || pay.orderId) : null;
                    const itemsText = order?.items?.length
                      ? order.items.map(i => `${i.name} x${i.qty || i.quantity || 1}`).join(", ")
                      : "—";

                    return (
                      <TableRow key={pay._id}>
                        <TableCell>{orderId ? orderId.slice(-5) : "—"}</TableCell>
                        <TableCell>{new Date(pay.createdAt).toLocaleString()}</TableCell>
                        <TableCell>{formatRupees(pay.pharmacyAmount)}</TableCell>
                        <TableCell>{pay.status}</TableCell>

                        {/* NEW: ORDER DETAIL */}
                        <TableCell
                          title={itemsText}
                          sx={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {itemsText}
                        </TableCell>

                        {/* NEW: INVOICE DOWNLOAD */}
                        <TableCell>
                          {order?.invoiceFile ? (
                            <a
                              href={order.invoiceFile}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ textDecoration: "none" }}
                            >
                              <Button
                                variant="outlined"
                                sx={{
                                  borderRadius: 2,
                                  color: "#FFD43B",
                                  borderColor: "#FFD43B",
                                  textTransform: "none",
                                  fontWeight: 700
                                }}
                                startIcon={<ReceiptLongIcon />}
                                size="small"
                              >
                                Download
                              </Button>
                            </a>
                          ) : (
                            <span style={{ color: "#9bb4b0" }}>—</span>
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
    </Box>
  );
}

/* ---------------------------- MAIN DASHBOARD ---------------------------- */

export default function PharmacyDashboard() {
  const [token, setToken] = useState(localStorage.getItem("pharmacyToken") || "");
  const [tab, setTab] = useState(0); // 0 = Overview, 1 = Earnings

  const [orders, setOrders] = useState([]);
  const [login, setLogin] = useState({ email: "", password: "" });
  const [editOrderId, setEditOrderId] = useState("");
  const [edit, setEdit] = useState({ dosage: "", note: "" });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [pharmacy, setPharmacy] = useState({});
  const [active, setActive] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Medicines management
  const [showMeds, setShowMeds] = useState(false);
  const [medicines, setMedicines] = useState([]);
  const [medMsg, setMedMsg] = useState("");
  const [editMedId, setEditMedId] = useState(null);
  const [editMedImages, setEditMedImages] = useState([]);
  const [medImages, setMedImages] = useState([]);
  const fileInputRef = useRef();
  const editFileInputRef = useRef();

  const [payouts, setPayouts] = useState([]);

  // Stats
  const today = todayString();
  const ordersToday = orders.filter(o => (o.createdAt || "").slice(0, 10) === today);
  const completedOrders = orders.filter(o => o.status === 3 || o.status === "delivered");

  // Build pharmacy-specific category list for pickers
  const allPharmacyCategories = React.useMemo(() => {
    const allCats = medicines.flatMap(m =>
      Array.isArray(m.category) ? m.category : (m.category ? [m.category] : [])
    );
    const unique = Array.from(new Set([
      ...MED_CATEGORIES,
      ...allCats.filter(c => !!c && !MED_CATEGORIES.includes(c))
    ]));
    return unique.filter(c => c !== "Other").concat("Other");
  }, [medicines]);

  /* ----------------------- Data fetching ----------------------- */
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
            // Pull payouts for the Earnings tab
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

  // Fetch medicines for management UI
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

  /* -------------------------- Auth -------------------------- */
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
      setMsg("OTP sent! " + (isEmail ? "Check your email." : "Check your mobile."));
    } catch (err) {
      setMsg(err.response?.data?.message || "Failed to send OTP");
    }
    setLoading(false);
  };

  /* -------------------- Orders edit handlers -------------------- */
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

  /* -------------------- Medicines management -------------------- */
  const [medForm, setMedForm] = useState({
    name: "", brand: "", composition: "", company: "",
    price: "", mrp: "", stock: "", category: "", discount: "",
    customCategory: "", type: "Tablet", customType: ""
  });
  const [editMedForm, setEditMedForm] = useState({
    name: "", brand: "", composition: "", company: "",
    price: "", mrp: "", stock: "", category: "", customCategory: "",
    type: "Tablet", customType: ""
  });

  const handleImagesChange = (e) => {
    if (e.target.files && e.target.files.length) setMedImages(Array.from(e.target.files));
  };
  const handleEditImagesChange = (e) => {
    if (e.target.files && e.target.files.length) setEditMedImages(Array.from(e.target.files));
  };
  const handleCustomCategoryBlur = (customCategory) => {
    if (!customCategory) return;
    const match = stringSimilarity.findBestMatch(
      customCategory.trim(),
      allPharmacyCategories
    );
    if (match.bestMatch.rating > 0.75) {
      setMedMsg(
        `Category "${customCategory}" looks similar to "${match.bestMatch.target}". Please check or select from list.`
      );
    } else {
      if (medMsg.toLowerCase().includes("category")) setMedMsg("");
    }
  };

  const handleAddMedicine = async () => {
    if (
      !medForm.name || !medForm.price || !medForm.mrp || !medForm.stock ||
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
      if (medImages && medImages.length) {
        data = new FormData();
        data.append("name", medForm.name);
        data.append("brand", medForm.brand);
        data.append("composition", medForm.composition || "");
        data.append("company", medForm.company || "");
        data.append("price", medForm.price);
        data.append("mrp", medForm.mrp);
        data.append("discount", medForm.discount);
        data.append("stock", medForm.stock);
        data.append("category", JSON.stringify(finalCategories));
        data.append("type", medForm.type || "Tablet");
        if (medForm.type === "Other") data.append("customType", medForm.customType || "");
        medImages.forEach(img => data.append("images", img));
        headers = { Authorization: `Bearer ${token}` };
      } else {
        data = {
          name: medForm.name,
          brand: medForm.brand,
          composition: medForm.composition || "",
          company: medForm.company || "",
          price: medForm.price,
          mrp: medForm.mrp,
          discount: medForm.discount,
          stock: medForm.stock,
          category: finalCategories,
          type: medForm.type || "Tablet",
          ...(medForm.type === "Other" && { customType: medForm.customType || "" }),
        };
        headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      }

      await axios.post(`${API_BASE_URL}/api/pharmacy/medicines`, data, { headers });
      setMedMsg("Medicine added!");
      setMedForm({
        name: "", brand: "", composition: "", company: "",
        price: "", mrp: "", stock: "", category: "", discount: "",
        customCategory: "", type: "Tablet", customType: ""
      });
      setMedImages([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setMedMsg(err?.response?.data?.error || "Failed to add medicine.");
    }
    setLoading(false);
  };

  const handleEditMedicine = (med) => {
    const medCats = Array.isArray(med.category)
      ? med.category
      : med.category ? [med.category] : [];
    const customCats = medCats.filter(c => !MED_CATEGORIES.includes(c));
    let newCategory = [...medCats];
    let customCategory = "";
    if (customCats.length > 0) {
      newCategory = [...medCats.filter(c => MED_CATEGORIES.includes(c)), "Other"];
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
      customType: TYPE_OPTIONS.includes(med.type) ? "" : (med.type || "")
    });
  };

  const handleSaveMedicine = async () => {
    if (!editMedForm.name || !editMedForm.price || !editMedForm.stock ||
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
      if (editMedImages && editMedImages.length) {
        data = new FormData();
        data.append("name", editMedForm.name);
        data.append("brand", editMedForm.brand);
        data.append("composition", editMedForm.composition || "");
        data.append("company", editMedForm.company || "");
        data.append("price", editMedForm.price);
        data.append("mrp", editMedForm.mrp);
        data.append("stock", editMedForm.stock);
        data.append("category", JSON.stringify(finalCategories));
        data.append("type", editMedForm.type);
        if (editMedForm.type === "Other") data.append("customType", editMedForm.customType || "");
        editMedImages.forEach(img => data.append("images", img));
        headers = { Authorization: `Bearer ${token}` };
      } else {
        data = {
          name: editMedForm.name,
          brand: editMedForm.brand,
          composition: editMedForm.composition || "",
          company: editMedForm.company || "",
          price: editMedForm.price,
          mrp: editMedForm.mrp,
          stock: editMedForm.stock,
          category: finalCategories,
          type: editMedForm.type,
          ...(editMedForm.type === "Other" && { customType: editMedForm.customType }),
        };
        headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      }

      await axios.patch(
        `${API_BASE_URL}/api/pharmacy/medicines/${editMedId}`,
        data,
        { headers }
      );

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

  /* --------------------------- RENDER --------------------------- */

  if (!token) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box sx={{ mt: 7, maxWidth: 380, mx: "auto" }}>
          <Typography variant="h5" mb={2}>Pharmacy Login</Typography>
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
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ p: 2, maxWidth: 900, mx: "auto", position: "relative", minHeight: "95vh", pb: 8 }}>
        <Typography variant="h4" sx={{ fontWeight: 900, color: "#13C0A2", mb: 1 }}>
          Pharmacy Dashboard
        </Typography>

        {/* -------------------- TOP TABS -------------------- */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          textColor="primary"
          indicatorColor="primary"
          sx={{ mb: 2 }}
        >
          <Tab label="Overview" />
          <Tab label="Earnings" />
        </Tabs>

        {/* ================== OVERVIEW TAB ================== */}
        {tab === 0 && (
          <>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
              <Typography variant="h5" fontWeight={800} sx={{ color: "#FFD43B" }}>
                {pharmacy?.name || "Pharmacy"}
              </Typography>
              <Chip label={active ? "Active" : "Inactive"} color={active ? "success" : "default"} />
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

            {/* Location set */}
            <Button
              variant={pharmacy.location && pharmacy.location.coordinates && pharmacy.location.coordinates[0] !== 0 ? "contained" : "outlined"}
              color="primary"
              sx={{ mt: 1, mb: 2 }}
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
            >
              {pharmacy.location && pharmacy.location.coordinates && pharmacy.location.coordinates[0] !== 0
                ? "Location Set"
                : "Set Current Location"}
            </Button>
            {pharmacy.location && (
              <>
                {pharmacy.location.formatted && (
                  <Typography fontSize={13} sx={{ color: "green", mb: 1 }}>
                    {pharmacy.location.formatted}
                  </Typography>
                )}
                {pharmacy.location.coordinates && pharmacy.location.coordinates[0] !== 0 && (
                  <Typography fontSize={11} sx={{ color: "#888", mb: 1 }}>
                    (Lat {pharmacy.location.coordinates[1]}, Lng {pharmacy.location.coordinates[0]})
                  </Typography>
                )}
              </>
            )}

            {/* Stats Row */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
              <Card sx={{ flex: 1, bgcolor: "#21272b" }}>
                <CardContent>
                  <Typography variant="subtitle2" color="#FFD43B">Orders Today</Typography>
                  <Typography variant="h5" fontWeight={800}>{ordersToday.length}</Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1, bgcolor: "#21272b" }}>
                <CardContent>
                  <Typography variant="subtitle2" color="#FFD43B">Completed Orders</Typography>
                  <Typography variant="h5" fontWeight={800}>{completedOrders.length}</Typography>
                </CardContent>
              </Card>
            </Stack>

            <Divider sx={{ mb: 2 }} />

            {/* Orders List */}
            <Typography variant="h6" mb={1}>Orders</Typography>
            {!orders.length && <Typography>No orders yet.</Typography>}
            <Box sx={{ maxHeight: 450, overflowY: "auto", mb: 2 }}>
              {[...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(order => (
                <Card sx={{ mb: 2, bgcolor: "#181d23" }} key={order.id || order._id}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="h6">Order #{order.id || order._id}</Typography>
                      <Chip
                        label={getStatusLabel(order.status)}
                        color={getStatusColor(order.status)}
                        sx={{ cursor: "default", pointerEvents: "none", fontWeight: "bold" }}
                      />
                    </Stack>

                    <Typography sx={{ fontSize: 15, color: "#FFD43B" }}>
                      Items: {order.items && order.items.map(i => `${i.name} x${i.qty || i.quantity || 1}`).join(", ")}
                    </Typography>
                    <Typography sx={{ fontSize: 14, color: "#DDD" }}>
                      Total: {formatRupees(order.total)}
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: "#AAA" }}>
                      Placed: {order.createdAt ? new Date(order.createdAt).toLocaleString() : "-" }
                    </Typography>

                    {/* Dosage / Note (editable when not delivered/rejected) */}
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
                          <Button size="small" variant="contained" onClick={handleSave} sx={{ mr: 1 }} disabled={loading}>Save</Button>
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
                          <Button size="small" sx={{ mt: 1 }} onClick={() => handleEditOrder(order)} disabled={loading}>
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
                        <Chip label="Processing" color="primary" sx={{ mt: 1, fontWeight: "bold", pointerEvents: "none" }} />
                      )}
                      {(order.status === 3 || order.status === "delivered") && (
                        <Chip label="Delivered" color="success" sx={{ mt: 1, fontWeight: "bold", pointerEvents: "none" }} />
                      )}
                    </Box>

                    {/* Invoice (if available) */}
                    {order.invoiceFile && (
                      <a href={order.invoiceFile} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", marginTop: 8, display: "inline-block" }}>
                        <Button
                          variant="outlined"
                          sx={{ ml: 0, mt: 1.2, borderRadius: 2, color: "#FFD43B", borderColor: "#FFD43B", textTransform: "none", fontWeight: 700 }}
                          startIcon={<ReceiptLongIcon />}
                          size="small"
                        >
                          Download Invoice
                        </Button>
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>

            {/* Manage medicines toggle */}
            <Divider sx={{ my: 3 }} />
            <Button variant="contained" onClick={() => setShowMeds(!showMeds)} sx={{ mb: 2 }}>
              {showMeds ? "Hide Medicines" : "Manage Medicines"}
            </Button>

            {showMeds && (
              <Box sx={{ mt: 1, mb: 10 }}>
                <Typography variant="h6" mb={1}>Medicines</Typography>

                {medicines.map(med => (
                  <Card key={med.id || med._id} sx={{ mb: 1, bgcolor: "#21272b" }}>
                    <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Typography sx={{ flex: 1 }}>
                        <b>{med.name}</b>
                        {med.brand && (<span style={{ color: "#13C0A2", fontWeight: 400 }}> ({med.brand})</span>)}
                        {" — "}
                        <span style={{ color: "#FFD43B" }}>
                          {(Array.isArray(med.category) ? med.category.join(', ') : med.category) || "Miscellaneous"}
                        </span>
                        <br />
                        {med.composition && (
                          <span style={{ display: "block", color: "#9ad0c9" }}>
                            Composition: {med.composition}
                          </span>
                        )}
                        {med.company && (
                          <span style={{ display: "block", color: "#9ad0c9" }}>
                            Company: {med.company}
                          </span>
                        )}
                        <b>Selling Price:</b> ₹{med.price} | <b>MRP:</b> ₹{med.mrp} | <b>Stock:</b> {med.stock}
                        <br />
                        <b>Type:</b> {med.type || "Tablet"}
                      </Typography>
                      <IconButton color="primary" size="small" onClick={() => handleEditMedicine(med)} disabled={loading}>
                        <EditIcon />
                      </IconButton>
                      <IconButton color="error" size="small" onClick={() => handleDeleteMedicine(med.id || med._id)} disabled={loading}>
                        <DeleteIcon />
                      </IconButton>
                    </CardContent>
                  </Card>
                ))}

                {/* Edit Medicine Dialog */}
                <Dialog open={!!editMedId} onClose={closeEditDialog} fullWidth maxWidth="xs">
                  <DialogTitle>Edit Medicine</DialogTitle>
                  <DialogContent>
                    <Stack spacing={2} mt={1}>
                      {false && (
                        <TextField
                          label="Name"
                          fullWidth
                          value={editMedForm.name}
                          onChange={e => setEditMedForm(f => ({ ...f, name: e.target.value }))}
                          onFocus={() => setIsEditing(true)}
                          onBlur={() => setIsEditing(false)}
                        />
                      )}
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
                        onFocus={() => setIsEditing(true)}
                        onBlur={() => setIsEditing(false)}
                      />
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
                        onFocus={() => setIsEditing(true)}
                        onBlur={() => setIsEditing(false)}
                      />
                      <TextField
                        label="MRP"
                        type="number"
                        fullWidth
                        value={editMedForm.mrp}
                        onChange={e => setEditMedForm(f => ({ ...f, mrp: e.target.value }))}
                        onFocus={() => setIsEditing(true)}
                        onBlur={() => setIsEditing(false)}
                      />
                      <TextField
                        label="Stock"
                        type="number"
                        fullWidth
                        value={editMedForm.stock}
                        onChange={e => setEditMedForm(f => ({ ...f, stock: e.target.value }))}
                        onFocus={() => setIsEditing(true)}
                        onBlur={() => setIsEditing(false)}
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
                          onFocus={() => setIsEditing(true)}
                          onBlur={e => { setIsEditing(false); handleCustomCategoryBlur(e.target.value); }}
                          error={!!medMsg && medMsg.toLowerCase().includes('category')}
                          helperText={!!medMsg && medMsg.toLowerCase().includes('category') ? medMsg : ''}
                        />
                      )}

                      {/* Type */}
                      <FormControl fullWidth>
                        <InputLabel>Type</InputLabel>
                        <Select
                          value={editMedForm.type}
                          label="Type"
                          onChange={e => setEditMedForm(f => ({ ...f, type: e.target.value }))}
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
                          onFocus={() => setIsEditing(true)}
                          onBlur={() => setIsEditing(false)}
                        />
                      )}

                      <Stack direction="row" spacing={2} alignItems="center">
                        <input type="file" accept="image/*" multiple hidden ref={editFileInputRef} onChange={handleEditImagesChange} />
                        <Button
                          startIcon={<PhotoCamera />}
                          variant={editMedImages && editMedImages.length ? "contained" : "outlined"}
                          onClick={() => editFileInputRef.current && editFileInputRef.current.click()}
                          color={editMedImages && editMedImages.length ? "success" : "primary"}
                          sx={{ minWidth: 120 }}
                        >
                          {editMedImages && editMedImages.length ? `${editMedImages.length} Image${editMedImages.length > 1 ? "s" : ""} Ready` : "Upload Images"}
                        </Button>
                      </Stack>

                      {/* Existing images with delete */}
                      {editMedId && medicines.find(m => (m._id || m.id) === editMedId)?.images?.length > 0 && (
                        <Stack direction="row" spacing={1} sx={{ my: 1 }}>
                          {medicines.find(m => (m._id || m.id) === editMedId).images.map((imgUrl, i) => (
                            <Box key={imgUrl + i} sx={{ position: "relative", display: "inline-block" }}>
                              <img
                                src={imgUrl.startsWith("http") ? imgUrl : `${API_BASE_URL}${imgUrl}`}
                                alt=""
                                style={{ width: 56, height: 56, borderRadius: 2, objectFit: "cover", border: "1px solid #ccc" }}
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

                      {/* New (unsaved) images preview */}
                      {editMedImages && editMedImages.length > 0 && (
                        <Stack direction="row" spacing={1} sx={{ my: 1 }}>
                          {editMedImages.map((img, i) => (
                            <Box key={i} component="img" src={URL.createObjectURL(img)}
                              sx={{ width: 56, height: 56, borderRadius: 2, objectFit: "cover", border: "1px solid #ccc" }} />
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

                {/* Add Medicine */}
                <Box sx={{ mt: 2, pb: 8, position: "relative", bgcolor: "#181d23", borderRadius: 2, p: 2, boxShadow: 1 }}>
                  <Stack spacing={2}>
                    {false && (
                      <TextField
                        label="Name"
                        value={medForm.name}
                        onChange={e => setMedForm(f => ({ ...f, name: e.target.value }))}
                        onFocus={() => setIsEditing(true)}
                        onBlur={() => setIsEditing(false)}
                      />
                    )}
                    <TextField
                      label="Brand"
                      value={medForm.brand}
                      onChange={e => setMedForm(f => ({ ...f, brand: e.target.value, name: linkBrandToName(e.target.value) }))}
                      onFocus={() => setIsEditing(true)}
                      onBlur={() => setIsEditing(false)}
                    />
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
                      <Select value={medForm.type} label="Type" onChange={e => setMedForm(f => ({ ...f, type: e.target.value }))}>
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
                    <Stack direction="row" spacing={2} alignItems="center">
                      <input type="file" accept="image/*" multiple hidden ref={fileInputRef} onChange={handleImagesChange} />
                      <Button
                        startIcon={<PhotoCamera />}
                        variant={medImages && medImages.length ? "contained" : "outlined"}
                        onClick={() => fileInputRef.current && fileInputRef.current.click()}
                        color={medImages && medImages.length ? "success" : "primary"}
                        sx={{ minWidth: 120 }}
                      >
                        {medImages && medImages.length ? `${medImages.length} Image${medImages.length > 1 ? "s" : ""} Ready` : "Upload Images"}
                      </Button>
                    </Stack>
                    {medImages && medImages.length > 0 && (
                      <Stack direction="row" spacing={1} sx={{ my: 1 }}>
                        {medImages.map((img, i) => (
                          <Box key={i} component="img" src={URL.createObjectURL(img)}
                            sx={{ width: 56, height: 56, borderRadius: 2, objectFit: "cover", border: "1px solid #ccc" }} />
                        ))}
                      </Stack>
                    )}
                    <Button
                      variant="contained"
                      onClick={handleAddMedicine}
                      disabled={loading}
                      sx={{ width: "100%", mt: 1, position: "sticky", bottom: 56, zIndex: 2 }}
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

            {/* Logout */}
            <Box sx={{ width: "100%", position: "relative", pb: 7, textAlign: "center" }}>
              <Button variant="outlined" color="error" size="large" onClick={handleLogout} sx={{ width: 200, mx: "auto", mb: 2 }}>
                Logout
              </Button>
            </Box>
          </>
        )}

        {/* ================== EARNINGS TAB ================== */}
        {tab === 1 && (
          <EarningsTab payouts={payouts} />
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
