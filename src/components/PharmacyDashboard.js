// src/components/PharmacyDashboard.js
import React, { useEffect, useState, useRef } from "react";
import {
  Box, Typography, Button, Card, CardContent, TextField, Stack, Chip,
  Snackbar, Alert, ThemeProvider, createTheme, CssBaseline, Divider, IconButton, MenuItem, Select, InputLabel, FormControl,
  Dialog, DialogTitle, DialogContent, DialogActions, Switch
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DoneIcon from "@mui/icons-material/Done";
import CloseIcon from "@mui/icons-material/Close";
import PrescriptionOrdersTab from "./PrescriptionOrdersTab";
import PhotoCamera from "@mui/icons-material/PhotoCamera";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import stringSimilarity from "string-similarity";
import axios from "axios";
import { Table, TableHead, TableRow, TableCell, TableBody } from "@mui/material";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

function PharmacyPayoutsSection({ token, pharmacyId }) {
  const [payouts, setPayouts] = useState([]);
  useEffect(() => {
    if (!token || !pharmacyId) return;
    fetch(`${API_BASE_URL}/api/payments?pharmacyId=${pharmacyId}&status=paid`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setPayouts(data));
  }, [token, pharmacyId]);
  const total = payouts.reduce((sum, p) => sum + (p.pharmacyAmount || 0), 0);
  return (
    <Box sx={{ mb: 3 }}>
      <Card sx={{ bgcolor: "#21272b", mb: 1 }}>
        <CardContent>
          <Typography variant="h6" color="success.main" fontWeight={700}>
            Your Earnings
          </Typography>
          <Typography variant="h4" fontWeight={900} sx={{ mb: 2 }}>
            ₹{total.toLocaleString("en-IN")}
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Order</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payouts.map(pay => (
                <TableRow key={pay._id}>
                  <TableCell>{pay.orderId?._id?.slice(-5)}</TableCell>
                  <TableCell>{new Date(pay.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>₹{pay.pharmacyAmount}</TableCell>
                  <TableCell>{pay.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {payouts.length === 0 && (
            <Typography color="warning.main" fontSize={15}>No payouts yet.</Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

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
const MED_CATEGORIES = [
  "Pain Relief",
  "Fever",
  "Cough & Cold",
  "Antibiotic",
  "Digestive",
  "Diabetes",
  "Hypertension",
  "Supplements",
  "Other"
];

const TYPE_OPTIONS = [
  "Tablet",
  "Syrup",
  "Injection",
  "Cream",
  "Ointment",
  "Drop",
  "Spray",
  "Inhaler",
  "Other"
];

// --- Status helpers ---
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

// --------- ADD REVENUE FILTER HELPERS ---------
function isToday(date) {
  const d = new Date(date);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}
function isThisWeek(date) {
  const d = new Date(date);
  const now = new Date();
  const firstDay = new Date(now.setDate(now.getDate() - now.getDay())); // Sunday
  firstDay.setHours(0,0,0,0);
  const lastDay = new Date(firstDay);
  lastDay.setDate(firstDay.getDate() + 6);
  lastDay.setHours(23,59,59,999);
  return d >= firstDay && d <= lastDay;
}

export default function PharmacyDashboard() {
  const [token, setToken] = useState(localStorage.getItem("pharmacyToken") || "");
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
  // This list will include all default + custom categories used in this pharmacy
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

  const [medForm, setMedForm] = useState({
    name: "",
    brand: "",
    price: "",
    mrp: "",
    stock: "",
    category: "",
    discount: "",
    customCategory: "",
    type: "Tablet",
    customType: ""
  });
  const [medMsg, setMedMsg] = useState("");
  const [editMedId, setEditMedId] = useState(null);
  const [editMedImages, setEditMedImages] = useState([]); // <-- ADD THIS
  const [editMedForm, setEditMedForm] = useState({
    name: "",
    brand: "",
    price: "",
    mrp: "",
    stock: "",
    category: "",
    customCategory: "",
    type: "Tablet",
    customType: ""
  });
  const [medImages, setMedImages] = useState([]); // support multiple

  const editFileInputRef = useRef();
  const fileInputRef = useRef();

  // Stats
  const today = todayString();
  const ordersToday = orders.filter(o => (o.createdAt || "").slice(0, 10) === today);
  const completedOrders = orders.filter(o => o.status === 3 || o.status === "delivered");
  const [payouts, setPayouts] = useState([]);
  const [commissionRevenue, setCommissionRevenue] = useState(0);

  // ---- REVENUE FILTER STATE ----
  const [revenueFilter, setRevenueFilter] = useState('total'); // 'today' | 'week' | 'total'

  useEffect(() => {
    if (!token) return;
    const fetchAll = () => {
      axios.get(`${API_BASE_URL}/api/pharmacy/orders`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setOrders(res.data))
        .catch(() => setOrders([]));
      axios.get(`${API_BASE_URL}/api/pharmacy/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          setActive(res.data.active);
          setPharmacy(res.data);
          // Fetch commission revenue!
          if (res.data?._id) {
            axios.get(`${API_BASE_URL}/api/payments?pharmacyId=${res.data._id}&status=paid`, {
              headers: { Authorization: `Bearer ${token}` }
            }).then(resp => {
              setPayouts(resp.data || []);
              const total = (resp.data || []).reduce((sum, p) => sum + (p.pharmacyAmount || 0), 0);
              setCommissionRevenue(total);
            });
          }
        });
    };
    fetchAll(); // fetch once on mount
    const interval = setInterval(() => {
      if (!isEditing) {   // <-- Only fetch if NOT editing!
        fetchAll();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [token, msg, isEditing]);

  // Filtered revenue calculation
  const filteredCommissionRevenue = payouts.reduce((sum, p) => {
    if (revenueFilter === "today" && isToday(p.createdAt)) return sum + (p.pharmacyAmount || 0);
    if (revenueFilter === "week" && isThisWeek(p.createdAt)) return sum + (p.pharmacyAmount || 0);
    if (revenueFilter === "total") return sum + (p.pharmacyAmount || 0);
    return sum;
  }, 0);

  // Fetch medicines (always, so autocomplete works)
  useEffect(() => {
    if (!token) return;
    axios.get(`${API_BASE_URL}/api/pharmacy/medicines`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
      // Always make category an array!
      const fixed = (res.data || []).map(m => ({
        ...m,
        category: Array.isArray(m.category) ? m.category : m.category ? [m.category] : [],
      }));
      setMedicines(fixed);
    })
    .catch(() => setMedicines([]));
}, [token, medMsg]);

  // Login handler
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

  // Edit order
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

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("pharmacyToken");
    setToken("");
    setMsg("Logged out.");
  };

  const handleCustomCategoryBlur = (customCategory) => {
  if (!customCategory) return;
  const match = stringSimilarity.findBestMatch(
    customCategory.trim(),
    allPharmacyCategories
  );
  if (match.bestMatch.rating > 0.75) {
    setMedMsg(
      `Category "${customCategory}" looks similar to existing category "${match.bestMatch.target}". Please check spelling or select from the list.`
    );
    // Optionally: block submit, or set flag so you only submit if user confirms.
  } else {
    // No issue, clear msg
    if (medMsg.toLowerCase().includes('category')) setMedMsg('');
  }
};

  // Add medicine - multipart if image
  const handleAddMedicine = async () => {
  if (!medForm.name || !medForm.price || !medForm.mrp || !medForm.stock ||
    !medForm.category ||
    (
      (Array.isArray(medForm.category) && medForm.category.includes("Other") && !medForm.customCategory)
      || (medForm.category === "Other" && !medForm.customCategory)
    )
  ) {
    setMedMsg("Fill all medicine fields.");
    return;
  }
  setLoading(true);

  // THIS IS THE MAIN LOGIC:
  let finalCategories = Array.isArray(medForm.category)
    ? [...medForm.category]
    : medForm.category ? [medForm.category] : [];
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
      data.append("price", medForm.price);
      data.append("mrp", medForm.mrp);
      data.append("discount", medForm.discount);
      data.append("stock", medForm.stock);
      // CRUCIAL: category should be sent as JSON if array
      data.append("category", JSON.stringify(finalCategories));
      medImages.forEach(img => data.append("images", img));
      headers = { Authorization: `Bearer ${token}` };
    } else {
      data = {
        name: medForm.name,
        brand: medForm.brand,
        price: medForm.price,
        mrp: medForm.mrp,
        discount: medForm.discount,
        stock: medForm.stock,
        category: finalCategories
      };
      headers = { Authorization: `Bearer ${token}` };
    }

    await axios.post(
      `${API_BASE_URL}/api/pharmacy/medicines`,
      data,
      { headers }
    );
    setMedMsg("Medicine added!");
    setMedForm({ name: "", brand: "", price: "", mrp: "", stock: "", category: "", discount: "", customCategory: "" });
    setMedImages([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  } catch {
    setMedMsg("Failed to add medicine.");
  }
  setLoading(false);
};

  // Start editing a medicine
  const handleEditMedicine = (med) => {
  // Ensure category is always array
  const medCats = Array.isArray(med.category)
    ? med.category
    : med.category
    ? [med.category]
    : [];
  // Find any custom categories (not in default list)
  const customCats = medCats.filter(c => !MED_CATEGORIES.includes(c));
  let newCategory = [...medCats];
  let customCategory = "";
  if (customCats.length > 0) {
    // Show custom field by including "Other"
    newCategory = [...medCats.filter(c => MED_CATEGORIES.includes(c)), "Other"];
    customCategory = customCats[0]; // If you ever want multi, use join(", ")
  }
  setEditMedId(med.id || med._id);
  setEditMedForm({
    name: med.name,
    brand: med.brand || "",
    price: med.price,
    mrp: med.mrp,
    stock: med.stock,
    category: newCategory,
    customCategory,
    type: TYPE_OPTIONS.includes(med.type) ? med.type : "Other",
    customType: TYPE_OPTIONS.includes(med.type) ? "" : (med.type || "")
  });
};

  // Save edit
  const handleSaveMedicine = async () => {
  if (!editMedForm.name || !editMedForm.price || !editMedForm.stock ||
    !editMedForm.category ||
    (
      (Array.isArray(editMedForm.category) && editMedForm.category.includes("Other") && !editMedForm.customCategory)
      || (editMedForm.category === "Other" && !editMedForm.customCategory)
    )
  ) {
    setMedMsg("Fill all fields to edit.");
    return;
  }
  setLoading(true);

  // MAIN LOGIC FOR CATEGORY:
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
      data.append("price", editMedForm.price);
      data.append("mrp", editMedForm.mrp);
      data.append("stock", editMedForm.stock);
      // CRUCIAL: category should be sent as JSON if array
      data.append("category", JSON.stringify(finalCategories));
      data.append("type", editMedForm.type);
      if (editMedForm.type === "Other") {
        data.append("customType", editMedForm.customType);
      }
      editMedImages.forEach(img => data.append("images", img));
      headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      };
    } else {
      data = {
        name: editMedForm.name,
        brand: editMedForm.brand,
        price: editMedForm.price,
        mrp: editMedForm.mrp,
        stock: editMedForm.stock,
        category: finalCategories,
        type: editMedForm.type,
        ...(editMedForm.type === "Other" && { customType: editMedForm.customType })
      };
      headers = { Authorization: `Bearer ${token}` };
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

  // Delete medicine
  const handleDeleteMedicine = async (medId) => {
    setLoading(true);
    try {
      await axios.delete(
        `${API_BASE_URL}/api/pharmacy/medicines/${medId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMedMsg("Medicine deleted!");
    } catch {
      setMedMsg("Failed to delete medicine.");
    }
    setLoading(false);
  };

  const handleSendOtp = async () => {
  if (!login.email || !login.password) {
    setMsg("Enter mobile/email & PIN.");
    return;
  }
  setLoading(true);
  try {
    // Let backend decide if it's mobile or email
    const isEmail = login.email.includes("@");
    const res = await axios.post(
      `${API_BASE_URL}/api/pharmacy/send-otp`,
      { contact: login.email, pin: login.password }
    );
    setMsg("OTP sent! " + (isEmail ? "Check your email." : "Check your mobile."));
  } catch (err) {
    setMsg(err.response?.data?.message || "Failed to send OTP");
  }
  setLoading(false);
};


  // Handle file select
  const handleImagesChange = (e) => {
  if (e.target.files && e.target.files.length) {
    setMedImages(Array.from(e.target.files));
  }
};

  // Edit dialog image select
const handleEditImagesChange = (e) => {
  if (e.target.files && e.target.files.length) {
    setEditMedImages(Array.from(e.target.files));
  }
};

  const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      {!token ? (
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
  <Button
    variant="outlined"
    fullWidth
    onClick={handleSendOtp}
    disabled={loading}
    sx={{ mb: 2 }}
  >
    {loading ? "Sending OTP..." : "Send OTP"}
  </Button>
  <Button
    variant="contained"
    fullWidth
    onClick={handleLogin}
    disabled={loading}
  >
    {loading ? "Logging in..." : "Login"}
  </Button>
          <Snackbar open={!!msg} autoHideDuration={2400} onClose={() => setMsg("")}>
  <Alert
    onClose={() => setMsg("")}
    severity={
      /fail|error|not found|invalid|incorrect|missing|unable/i.test(msg)
        ? "error"
        : "success"
    }
  >
    {msg}
  </Alert>
</Snackbar>
        </Box>
      ) : (
        <Box sx={{ p: 2, maxWidth: 900, mx: "auto", position: "relative", minHeight: "95vh", pb: 8 }}>
          <Typography variant="h4" sx={{ fontWeight: 900, color: "#13C0A2", mb: 2 }}>
            Pharmacy Dashboard
          </Typography>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
            <Typography variant="h5" fontWeight={800} sx={{ color: "#FFD43B" }}>
              {pharmacy?.name || "Pharmacy"}
            </Typography>
            <Chip label={active ? "Active" : "Inactive"} color={active ? "success" : "default"} />
            <Switch
              checked={active}
              onChange={async (e) => {
                setActive(e.target.checked);
                await axios.patch(
                  `${API_BASE_URL}/api/pharmacy/active`,
                  { active: e.target.checked },
                  { headers: { Authorization: `Bearer ${token}` } }
                );
              }}
              inputProps={{ 'aria-label': 'Active Status' }}
              color="success"
            />
          </Stack>
          {/* === SET LOCATION BUTTON GOES HERE === */}
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
      // Get human-readable address
      const res = await axios.get(`${API_BASE_URL}/api/geocode?lat=${latitude}&lng=${longitude}`);
      const formatted = res.data.results?.[0]?.formatted_address || "";
      // Patch to backend (include formatted address)
      await axios.patch(`${API_BASE_URL}/api/pharmacy/set-location`, {
        lat: latitude,
        lng: longitude,
        formatted
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMsg("Location updated!");
    } catch {
      setMsg("Failed to update location!");
    }
  },
      (err) => {
        alert("Could not fetch location: " + err.message);
      }
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
            {/* --- REVENUE CARD WITH FILTER TOGGLE --- */}
            <Card sx={{ flex: 1, bgcolor: "#21272b" }}>
              <CardContent>
                <Typography variant="subtitle2" color="#FFD43B" sx={{ mb: 1 }}>Revenue</Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <Chip
                    label="Today"
                    color={revenueFilter === "today" ? "primary" : "default"}
                    onClick={() => setRevenueFilter("today")}
                    size="small"
                    sx={{ cursor: "pointer" }}
                  />
                  <Chip
                    label="This Week"
                    color={revenueFilter === "week" ? "primary" : "default"}
                    onClick={() => setRevenueFilter("week")}
                    size="small"
                    sx={{ cursor: "pointer" }}
                  />
                  <Chip
                    label="Total"
                    color={revenueFilter === "total" ? "primary" : "default"}
                    onClick={() => setRevenueFilter("total")}
                    size="small"
                    sx={{ cursor: "pointer" }}
                  />
                </Stack>
                <Typography variant="h5" fontWeight={800}>{formatRupees(filteredCommissionRevenue)}</Typography>
              </CardContent>
            </Card>
          </Stack>

          <Divider sx={{ mb: 2 }} />

          {/* Orders List */}
          <Typography variant="h6" mb={1}>Orders</Typography>
          {!sortedOrders.length && <Typography>No orders yet.</Typography>}
          <Box sx={{ maxHeight: 450, overflowY: "auto", mb: 2 }}>
            {sortedOrders.map(order => (
              <Card sx={{ mb: 2, bgcolor: "#181d23" }} key={order.id || order._id}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">Order #{order.id || order._id}</Typography>
                    <Chip
                      label={getStatusLabel(order.status)}
                      color={getStatusColor(order.status)}
                      sx={{
                        cursor: "default",
                        pointerEvents: "none",
                        fontWeight: "bold"
                      }}
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
                  {/* Dosage / Note Edit */}
                  {editOrderId === (order.id || order._id) ? (
  // Only allow editing if order is not delivered or rejected
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
    {/* Show edit button only if not delivered or rejected */}
    {(order.status !== 3 && order.status !== "delivered" && order.status !== -1 && order.status !== "rejected") && (
      <Button size="small" sx={{ mt: 1 }} onClick={() => handleEditOrder(order)} disabled={loading}>
        Edit Dosage/Note
      </Button>
    )}
  </Box>
)}
                  {/* Status Buttons */}
                  <Box sx={{ mt: 2 }}>
                    {/* Accept/Reject if status is placed/pending/0 */}
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

                    {/* Processing - show as DISABLED CHIP (not clickable, no onClick at all) */}
                    {(order.status === 1 || order.status === "processing") && (
                      <Chip
                        label="Processing"
                        color="primary"
                        sx={{ mt: 1, fontWeight: "bold", pointerEvents: "none", cursor: "default" }}
                      />
                    )}

                    {/* Delivered - also just a Chip */}
                    {(order.status === 3 || order.status === "delivered") && (
                      <Chip
                        label="Delivered"
                        color="success"
                        sx={{ mt: 1, fontWeight: "bold", pointerEvents: "none", cursor: "default" }}
                      />
                    )}
                  </Box>
                  {/* --- INVOICE DOWNLOAD BUTTON FOR PHARMACY --- */}
{order.invoiceFile && (
  <a
    href={order.invoiceFile}
    target="_blank"
    rel="noopener noreferrer"
    style={{ textDecoration: "none", marginTop: 8, display: "inline-block" }}
  >
    <Button
      variant="outlined"
      sx={{
        ml: 0,
        mt: 1.2,
        borderRadius: 2,
        color: "#FFD43B",
        borderColor: "#FFD43B",
        textTransform: "none",
        fontWeight: 700,
      }}
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
          {/* --- Prescription Orders Section --- */}
          <PrescriptionOrdersTab token={token} medicines={medicines} />

          {/* Medicines Management */}
<Divider sx={{ my: 3 }} />
<Button
  variant="contained"
  onClick={() => setShowMeds(!showMeds)}
  sx={{ mb: 2 }}
>
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
            {med.brand && (
              <span style={{ color: "#13C0A2", fontWeight: 400 }}> ({med.brand})</span>
            )}
            {" — "}
            <span style={{ color: "#FFD43B" }}>
              {(Array.isArray(med.category) ? med.category.join(', ') : med.category) || "Miscellaneous"}
            </span>
            <br />
            <b>Selling Price:</b> ₹{med.price} | <b>MRP:</b> ₹{med.mrp} | <b>Stock:</b> {med.stock}
            <br />
            <b>Type:</b> {med.type || "Tablet"}
          </Typography>
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
    {/* EDIT MEDICINE DIALOG */}
    <Dialog open={!!editMedId} onClose={closeEditDialog} fullWidth maxWidth="xs">
      <DialogTitle>Edit Medicine</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField
            label="Name"
            fullWidth
            value={editMedForm.name}
            onChange={e => setEditMedForm(f => ({ ...f, name: e.target.value }))}
            onFocus={() => setIsEditing(true)}
            onBlur={() => setIsEditing(false)}
          />
          <TextField
            label="Brand"
            fullWidth
            value={editMedForm.brand}
            onChange={e => setEditMedForm(f => ({ ...f, brand: e.target.value }))}
            onFocus={() => setIsEditing(true)}
            onBlur={() => setIsEditing(false)}
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
    // 👇 ADD THIS onBlur handler:
    onBlur={e => {
      setIsEditing(false);
      handleCustomCategoryBlur(e.target.value);
    }}
    error={!!medMsg && medMsg.toLowerCase().includes('category')}
    helperText={!!medMsg && medMsg.toLowerCase().includes('category') ? medMsg : ''}
  />
)}

          {/* --- TYPE FIELD --- */}
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
    {editMedImages && editMedImages.length ? `${editMedImages.length} Image${editMedImages.length > 1 ? "s" : ""} Ready` : "Upload Images"}
  </Button>
</Stack>
{/* Show existing (already saved) images, with delete button */}
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
              // Refetch or update medicines list
              // This will close dialog, but you can call setEditMedId again after fetch
              const res = await axios.get(`${API_BASE_URL}/api/pharmacy/medicines`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              setMedicines(res.data);
              // Optionally, keep dialog open:
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

{/* Show newly uploaded (not yet saved) images */}
{editMedImages && editMedImages.length > 0 && (
  <Stack direction="row" spacing={1} sx={{ my: 1 }}>
    {editMedImages.map((img, i) => (
      <Box
        key={i}
        component="img"
        src={URL.createObjectURL(img)}
        sx={{
          width: 56, height: 56, borderRadius: 2,
          objectFit: "cover", border: "1px solid #ccc"
        }}
      />
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

    {/* ADD MEDICINE SECTION */}
    <Box sx={{
      mt: 2, pb: 8, position: "relative",
      bgcolor: "#181d23", borderRadius: 2, p: 2, boxShadow: 1
    }}>
      <Stack spacing={2}>
        <TextField
          label="Name"
          value={medForm.name}
          onChange={e => setMedForm(f => ({ ...f, name: e.target.value }))}
          onFocus={() => setIsEditing(true)}
          onBlur={() => setIsEditing(false)}
        />
        <TextField
          label="Brand"
          value={medForm.brand}
          onChange={e => setMedForm(f => ({ ...f, brand: e.target.value }))}
          onFocus={() => setIsEditing(true)}
          onBlur={() => setIsEditing(false)}
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
            MenuProps={{
              PaperProps: { style: { zIndex: 2000 } }
            }}
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
    // 🚨 Add THIS onBlur handler:
    onBlur={e => {
      setIsEditing(false);
      handleCustomCategoryBlur(e.target.value); // <-- New function (see below)
    }}
    error={!!medMsg && medMsg.toLowerCase().includes('category')}
    helperText={!!medMsg && medMsg.toLowerCase().includes('category') ? medMsg : ''}
  />
)}


        {/* --- TYPE FIELD --- */}
        <FormControl fullWidth>
          <InputLabel>Type</InputLabel>
          <Select
            value={medForm.type}
            label="Type"
            onChange={e => setMedForm(f => ({ ...f, type: e.target.value }))}
          >
            {TYPE_OPTIONS.map(opt => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
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
          <input
  type="file"
  accept="image/*"
  multiple
  hidden
  ref={fileInputRef}
  onChange={handleImagesChange}
/>
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
      <Box
        key={i}
        component="img"
        src={URL.createObjectURL(img)}
        sx={{
          width: 56, height: 56, borderRadius: 2,
          objectFit: "cover", border: "1px solid #ccc"
        }}
      />
    ))}
  </Stack>
)}
        <Button
          variant="contained"
          onClick={handleAddMedicine}
          disabled={loading}
          sx={{
            width: "100%",
            mt: 1,
            position: "sticky",
            bottom: 56,
            zIndex: 2
          }}
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
          <PharmacyPayoutsSection token={token} pharmacyId={pharmacy?._id} />
          {/* LOGOUT BUTTON */}
          <Box sx={{
            width: "100%",
            position: "relative",
            pb: 7,
            textAlign: "center"
          }}>
            <Button
              variant="outlined"
              color="error"
              size="large"
              onClick={handleLogout}
              sx={{ width: 200, mx: "auto", mb: 2 }}
            >
              Logout
            </Button>
          </Box>

          <Snackbar open={!!msg} autoHideDuration={2500} onClose={() => setMsg("")}>
            <Alert onClose={() => setMsg("")} severity={msg.includes("fail") ? "error" : "success"}>{msg}</Alert>
          </Snackbar>
          <Snackbar open={!!medMsg} autoHideDuration={2200} onClose={() => setMedMsg("")}>
            <Alert onClose={() => setMedMsg("")} severity={medMsg.includes("fail") ? "error" : "success"}>{medMsg}</Alert>
          </Snackbar>
        </Box>
      )}
    </ThemeProvider>
  );
}
