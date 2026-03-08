/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useThemeMode } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import creditCardType from "credit-card-type";
import ChatSupportModal from "./ChatSupportModal";
import AddressForm from "./AddressForm";

import { Button } from "../components/ui/button";
import { CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { ChevronRight, Shield, FileText, ScrollText, Cookie, UserX } from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil, Plus, ChevronDown, Mail, Home, History, BadgeCheck, Wallet, Settings,
  Headset, Users, Pill, LogOut, Star, Bike, IndianRupee, Trash, Lock, Camera, Calendar, X
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const MOBILE_LOGIN_ENABLED = String(process.env.REACT_APP_MOBILE_LOGIN_ENABLED) === "true";

const cardIcons = {
  Visa: "https://img.icons8.com/color/48/000000/visa.png",
  Mastercard: "https://img.icons8.com/color/48/000000/mastercard-logo.png",
  Amex: "https://img.icons8.com/color/48/000000/amex.png",
  Rupay: "https://seeklogo.com/images/R/rupay-logo-E3947D7A13-seeklogo.com.png",
};

// Convert "YYYY-MM-DD" -> "dd-mm-yyyy" for text box
function formatDobForDisplay(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d.padStart(2, "0")}-${m.padStart(2, "0")}-${y}`;
}

// Convert "dd-mm-yyyy" or "dd/mm/yyyy" -> "YYYY-MM-DD" for backend
function parseDobInputToIso(value) {
  if (!value) return "";
  const cleaned = value.trim().replace(/\./g, "/").replace(/-/g, "/");

  const parts = cleaned.split("/");
  if (parts.length !== 3) return "";

  let [dd, mm, yy] = parts;
  if (yy.length !== 4) return "";

  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  const year = parseInt(yy, 10);

  if (!day || !month || !year || month < 1 || month > 12 || day < 1 || day > 31) {
    return "";
  }

  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser, logout, token, addresses, updateAddresses } = useAuth();
  const [chatSupportOpen, setChatSupportOpen] = useState(false);

  const [openSections, setOpenSections] = useState({
    addresses: true, wallet: false, orders: false, badges: false, personalization: false,
    settings: false, pharmacist: false, delivery: false, support: false, refer: false, legal: false,
  });
  const toggleSection = (key) => setOpenSections((p) => ({ ...p, [key]: !p[key] }));
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  // --- Edit profile dialog ---
  const [editDialog, setEditDialog] = useState(false);
  const [editData, setEditData] = useState({
    name: user?.name || "", email: user?.email || "", mobile: user?.mobile || "",
    dob: user?.dob || "", avatar: user?.avatar || "",
  });
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || "");
  const fileInputRef = useRef();
  const [dobInput, setDobInput] = useState(() =>
    formatDobForDisplay(user?.dob || "")
  );
  const dobPickerRef = useRef(null);

  // First-run detection with localStorage fallback (in case backend doesn’t return the flag yet)
  const search = new URLSearchParams(location.search);
  const forceSetup = search.get("setup") === "1";
  const localDone = localStorage.getItem("profileCompleted") === "1";
  const missingRequired = !user?.name || !user?.email || !user?.dob;
  const isFirstRun = forceSetup || (!localDone && (!user?.profileCompleted || missingRequired));

  useEffect(() => {
    if (!user) return;
    if (isFirstRun) {
      setEditDialog(true);
      setEditData({
        name: user.name || "",
        email: user.email || "",
        mobile: user.mobile || "",
        dob: user.dob || "",
        avatar: user.avatar || "",
      });
      setAvatarPreview(user.avatar || "");
    }
    setDobInput(formatDobForDisplay(user.dob || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]); // when the logged-in user is loaded

  const handleEditProfileOpen = () => {
    setEditData({
      name: user?.name || "",
      email: user?.email || "",
      mobile: user?.mobile || "",
      dob: user?.dob || "",
      avatar: user?.avatar || "",
    });
    setAvatarPreview(user?.avatar || "");
    setDobInput(formatDobForDisplay(user?.dob || ""));
    setEditDialog(true);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result);
      setEditData((d) => ({ ...d, avatar: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSave = async () => {
  // basic validation first so browser / device differences don’t break silently
  const trimmedName = (editData.name || "").trim();
  const trimmedEmail = (editData.email || "").trim();

  if (!trimmedName) {
    setSnackbar({
      open: true,
      message: "Please enter your name.",
      severity: "error",
    });
    return;
  }

  if (!trimmedEmail) {
    setSnackbar({
      open: true,
      message: "Please enter your email.",
      severity: "error",
    });
    return;
  }

  // 🔴 always compute DOB from the text field (dd-mm-yyyy) at time of save
  let dobIso = parseDobInputToIso(dobInput);

  // Agar text box khali hai lekin calendar se value aayi hui hai, toh woh use karo
  if (!dobIso && editData.dob) {
    dobIso = editData.dob; // <input type="date"> se already ISO aata hai
  }

  if (!dobIso) {
    setSnackbar({
      open: true,
      message: "Please enter a valid DOB in dd-mm-yyyy format.",
      severity: "error",
    });
    return;
  }

  const payload = {
    ...editData,
    name: trimmedName,
    email: trimmedEmail,
    dob: dobIso, // ✅ backend ko hamesha YYYY-MM-DD milega
    profileCompleted: true,
  };

  try {
    await axios.put(
      `${API_BASE_URL}/api/users/${user._id}`,
      payload,
      { headers: { Authorization: "Bearer " + token } }
    );

    setSnackbar({
      open: true,
      message: "Profile updated!",
      severity: "success",
    });

    // Refresh profile from server so AuthContext + localStorage in sync rahe
    const updatedProfile = await axios.get(`${API_BASE_URL}/api/profile`, {
      headers: { Authorization: "Bearer " + token },
    });

    setUser(updatedProfile.data);

    // dobInput ko bhi latest ISO se dob-display me convert karke set karo
    setDobInput(
      formatDobForDisplay(updatedProfile.data.dob || dobIso)
    );

    // Local fallback so first-run dialog dobara na khul jaaye
    localStorage.setItem("profileCompleted", "1");

    setEditDialog(false);
    navigate("/", { replace: true });
  } catch (e) {
    console.error("Profile update failed:", e);
    setSnackbar({
      open: true,
      message: "Failed to update!",
      severity: "error",
    });
  }
};

  // --- Settings modals (unchanged) ---
  const [changePassOpen, setChangePassOpen] = useState(false); // eslint-disable-line no-unused-vars
  const [changeEmailOpen, setChangeEmailOpen] = useState(false); // eslint-disable-line no-unused-vars
  const [deleteOpen, setDeleteOpen] = useState(false); // eslint-disable-line no-unused-vars

  // --- Addresses (unchanged) ---
  const [editingAddress, setEditingAddress] = useState(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const handleAddressSave = async (newAddr) => {
    let updated;
    if (newAddr.id && addresses.some((a) => a.id === newAddr.id)) {
      updated = addresses.map((a) => (a.id === newAddr.id ? newAddr : a));
    } else {
      newAddr.id = Date.now().toString();
      updated = [...addresses, newAddr];
    }
    if (newAddr.isDefault) updated = updated.map((a) => ({ ...a, isDefault: a.id === newAddr.id }));
    await updateAddresses(updated);
    setSnackbar({ open: true, message: editingAddress ? "Address updated!" : "Address added!", severity: "success" });
    setShowAddressForm(false);
    setEditingAddress(null);
  };
  const handleDeleteAddress = async (addr) => {
    if (!window.confirm("Are you sure you want to delete this address?")) return;
    const updated = addresses.filter((a) => a.id !== addr.id);
    await updateAddresses(updated);
    setSnackbar({ open: true, message: "Address deleted!", severity: "success" });
  };

  // Cards (unchanged)
  const [cards, setCards] = useState([]);
  const [cardDialog, setCardDialog] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [cardForm, setCardForm] = useState({ number: "", name: "", expiry: "", brand: "" });
  const [cardTypeIcon, setCardTypeIcon] = useState(null);
  function detectCardType(number) {
    if (!number) return "";
    const result = creditCardType(number.replace(/\s/g, ""));
    return result.length ? result[0].niceType : "";
  }
  function handleCardNumberChange(e) {
    let num = e.target.value.replace(/[^\d]/g, "").slice(0, 16);
    num = num.replace(/(.{4})/g, "$1 ").trim();
    const type = detectCardType(num);
    setCardTypeIcon(cardIcons[type] || null);
    setCardForm((f) => ({ ...f, number: num, brand: type || "" }));
  }
  function handleCardFormChange(field, value) { setCardForm((f) => ({ ...f, [field]: value })); }
  function handleCardSave() {
    if (cardForm.number.length < 19 || !cardForm.name || !/^\d{2}\/\d{2}$/.test(cardForm.expiry)) {
      setSnackbar({ open: true, message: "Enter valid card details!", severity: "error" }); return;
    }
    const last4 = cardForm.number.replace(/\s/g, "").slice(-4);
    if (editingCard) {
      setCards((prev) => prev.map((c) => (c.id === editingCard.id ? { ...cardForm, id: c.id, last4 } : c)));
    } else {
      setCards((prev) => [...prev, { ...cardForm, id: Date.now(), last4 }]);
    }
    setSnackbar({ open: true, message: editingCard ? "Card updated!" : "Card added!", severity: "success" });
    setCardDialog(false);
    setEditingCard(null);
    setCardForm({ number: "", name: "", expiry: "", brand: "" });
    setCardTypeIcon(null);
  }
  function handleCardEdit(card) {
    setEditingCard(card);
    setCardForm({ ...card, number: "**** **** **** " + card.last4 });
    setCardTypeIcon(cardIcons[card.brand] || null);
    setCardDialog(true);
  }
  function handleCardAdd() {
    setEditingCard(null);
    setCardForm({ number: "", name: "", expiry: "", brand: "" });
    setCardTypeIcon(null);
    setCardDialog(true);
  }

  // Orders (unchanged except for auth header already present elsewhere)
  const [orders, setOrders] = useState([]);
  const [orderDetail, setOrderDetail] = useState(null);
  useEffect(() => {
    if (!user?._id || !token) return;
    const ac = new AbortController();
    const load = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/orders/myorders`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: ac.signal,
        });
        const sorted = [...res.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setOrders(sorted);
      } catch {
        try {
          const res2 = await axios.get(`${API_BASE_URL}/api/allorders/myorders-userid/${user._id}`, { signal: ac.signal });
          const sorted2 = [...res2.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setOrders(sorted2);
        } catch { setOrders([]); }
      }
    };
    load(); return () => ac.abort();
  }, [user?._id, token]);

  const handleOrderAgain = (order) => {
    const pharmacyId = (order.pharmacy && order.pharmacy._id) || order.pharmacyId || order.pharmacy;
    if (pharmacyId) navigate(`/medicines/${pharmacyId}`);
    else setSnackbar({ open: true, message: "Pharmacy information missing. Unable to reorder.", severity: "error" });
  };

  const totalSpent = orders.reduce((s, o) => s + (o.total || 0), 0);
  const loyaltyPoints = Math.floor(totalSpent);

  const { t, i18n } = useTranslation();
  const { mode, setMode } = useThemeMode();
  const [language, setLanguage] = useState(i18n.language || "en");
  const handleLanguageChange = (lng) => { setLanguage(lng); i18n.changeLanguage(lng); localStorage.setItem("language", lng); };
  const handleThemeChange = (theme) => setMode(theme);

  const [orderUpdates, setOrderUpdates] = useState(true);
  const [offerPromos, setOfferPromos] = useState(true);
  const [dataSharing, setDataSharing] = useState(true);
  const [twoFA, setTwoFA] = useState(false);

  const [supportDialog, setSupportDialog] = useState(false);
  const [supportMsg, setSupportMsg] = useState("");

  const referralCode = `GODAVAII-USER-${user?._id || "XXXX"}`;

  const handleLogout = () => {
    logout();
    setSnackbar({ open: true, message: "Logged out!", severity: "info" });
    setTimeout(() => navigate("/login"), 1000);
  };

  const mobileLocked = MOBILE_LOGIN_ENABLED && Boolean(user?.mobileVerified);
  const canEditMobile = !mobileLocked;

  // ── Health Score (calculated from profile completeness + orders + activity) ──
  const healthScore = useMemo(() => {
    let score = 40; // base
    if (user?.name) score += 8;
    if (user?.email) score += 8;
    if (user?.dob) score += 8;
    if (user?.mobile) score += 6;
    if (user?.avatar) score += 5;
    if (addresses.length > 0) score += 5;
    if (orders.length > 0) score += 10;
    if (orders.length > 5) score += 5;
    if (orders.length > 10) score += 5;
    return Math.min(100, score);
  }, [user, addresses.length, orders.length]);

  const scoreColor = healthScore >= 80 ? "#00D97E" : healthScore >= 50 ? "#FBBF24" : "#EF4444";
  const scoreLabel = healthScore >= 80 ? "Excellent" : healthScore >= 50 ? "Good" : "Needs attention";

  // ── Medicine Reminders (local state — future: backend sync) ──
  const [reminders, setReminders] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gd_med_reminders") || "[]"); } catch { return []; }
  });
  const [reminderDialog, setReminderDialog] = useState(false);
  const [reminderForm, setReminderForm] = useState({ name: "", time: "08:00", frequency: "daily" });

  const saveReminder = () => {
    if (!reminderForm.name.trim()) return;
    const updated = [...reminders, { ...reminderForm, id: Date.now(), active: true }];
    setReminders(updated);
    localStorage.setItem("gd_med_reminders", JSON.stringify(updated));
    setReminderForm({ name: "", time: "08:00", frequency: "daily" });
    setReminderDialog(false);
    setSnackbar({ open: true, message: "Reminder added!", severity: "success" });
  };

  const toggleReminder = (id) => {
    const updated = reminders.map(r => r.id === id ? { ...r, active: !r.active } : r);
    setReminders(updated);
    localStorage.setItem("gd_med_reminders", JSON.stringify(updated));
  };

  const deleteReminder = (id) => {
    const updated = reminders.filter(r => r.id !== id);
    setReminders(updated);
    localStorage.setItem("gd_med_reminders", JSON.stringify(updated));
  };

  // Quick actions for HealthOS
  const quickActions = [
    { icon: "💊", label: "Medicines", action: () => navigate("/all-medicines") },
    { icon: "🤖", label: "AI Doctor", action: () => navigate("/ai") },
    { icon: "🩺", label: "Doctors", action: () => navigate("/doctors") },
    { icon: "🧪", label: "Lab Tests", action: () => navigate("/lab-tests") },
    { icon: "📋", label: "Upload Rx", action: () => navigate("/medicines") },
    { icon: "🏥", label: "Health Vault", action: () => navigate("/health") },
  ];

  return (
    <div className="profile-page mx-auto w-full max-w-[520px] md:max-w-[680px] lg:max-w-[820px] pb-28 bg-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      
      {/* ═══ HERO SECTION — 2035 HealthOS ═══ */}
      <div style={{
        background: "linear-gradient(145deg, #041F15 0%, #0C5A3E 50%, #0E7A4F 100%)",
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        padding: "20px 20px 24px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative orbs */}
        <div style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,217,126,0.15), transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: -30, bottom: -30, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.06), transparent 65%)", pointerEvents: "none" }} />
        
        {/* Profile row */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative", zIndex: 2 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20, overflow: "hidden",
              border: "2.5px solid rgba(0,217,126,0.5)",
              boxShadow: "0 4px 20px rgba(0,217,126,0.25)",
            }}>
              <Avatar className="h-full w-full">
                <AvatarImage src={user?.avatar || (user?.name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0C5A3E&color=00D97E&bold=true` : "")} />
                <AvatarFallback style={{ background: "linear-gradient(135deg, #0C5A3E, #0E7A4F)", color: "#00D97E", fontWeight: 800, fontSize: 20, fontFamily: "'Sora', sans-serif" }}>
                  {(user?.name || "NU").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={handleEditProfileOpen}
              style={{
                position: "absolute", bottom: -4, right: -4,
                width: 28, height: 28, borderRadius: 10,
                background: "#00D97E", border: "2px solid #041F15",
                display: "grid", placeItems: "center", cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,217,126,0.4)",
              }}
            >
              <Pencil style={{ width: 12, height: 12, color: "#041F15" }} />
            </motion.button>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "-0.3px", lineHeight: 1.2 }}>
              {user?.name || "New User"}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600, marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
              <Mail style={{ width: 11, height: 11 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email || "Add email"}</span>
            </div>
            {user?.mobile && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600, marginTop: 2 }}>
                {user.mobile}
              </div>
            )}
          </div>

          {/* Health Score Ring */}
          <div style={{ position: "relative", flexShrink: 0, width: 62, height: 62 }}>
            <svg viewBox="0 0 36 36" style={{ width: 62, height: 62, transform: "rotate(-90deg)" }}>
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke={scoreColor} strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${healthScore * 0.975} 100`}
                style={{ transition: "stroke-dasharray 1s ease" }}
              />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{healthScore}</span>
              <span style={{ fontSize: 7, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.3px", marginTop: 1 }}>HEALTH</span>
            </div>
          </div>
        </div>

        {/* Health Score label */}
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${healthScore}%` }} transition={{ duration: 1.2, ease: "easeOut" }} style={{ height: "100%", borderRadius: 2, background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}88)` }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 800, color: scoreColor, fontFamily: "'Sora', sans-serif", letterSpacing: "0.3px", flexShrink: 0 }}>
            {scoreLabel}
          </span>
        </div>

        {/* Stats row */}
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { value: orders.length, label: "Orders", icon: "📦" },
            { value: `₹${Math.floor(totalSpent)}`, label: "Saved", icon: "💰" },
            { value: loyaltyPoints, label: "Points", icon: "⭐" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 14,
                padding: "10px 8px",
                textAlign: "center",
                backdropFilter: "blur(8px)",
              }}
            >
              <div style={{ fontSize: 14 }}>{stat.icon}</div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 900, color: "#fff", marginTop: 2 }}>{stat.value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.5px", marginTop: 1 }}>{stat.label.toUpperCase()}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ═══ QUICK ACTIONS GRID ═══ */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0B1F16", fontFamily: "'Sora', sans-serif", marginBottom: 10, letterSpacing: "-0.2px" }}>
          Quick Actions
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {quickActions.map((qa, i) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.93 }}
              onClick={qa.action}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                padding: "14px 8px", borderRadius: 16,
                background: "#F8FBFA", border: "1.5px solid rgba(12,90,62,0.08)",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 22 }}>{qa.icon}</span>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: "#0C5A3E", fontFamily: "'Sora', sans-serif" }}>{qa.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ═══ MEDICINE REMINDERS ═══ */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0B1F16", fontFamily: "'Sora', sans-serif", letterSpacing: "-0.2px" }}>
            Medicine Reminders
          </div>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setReminderDialog(true)}
            style={{
              height: 28, padding: "0 12px", borderRadius: 100, border: "none",
              background: "linear-gradient(135deg, #0C5A3E, #0E7A4F)",
              color: "#fff", fontSize: 11, fontWeight: 800, fontFamily: "'Sora', sans-serif",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              boxShadow: "0 2px 8px rgba(12,90,62,0.3)",
            }}
          >
            <Plus style={{ width: 12, height: 12 }} /> Add
          </motion.button>
        </div>

        {reminders.length === 0 ? (
          <div style={{
            padding: "20px 16px", borderRadius: 16, textAlign: "center",
            background: "#F8FBFA", border: "1.5px dashed rgba(12,90,62,0.15)",
          }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>💊</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>No reminders yet</div>
            <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 2 }}>Add medicine reminders to stay on track</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {reminders.map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 14,
                  background: r.active ? "#F0FAF5" : "#F8FAFC",
                  border: `1.5px solid ${r.active ? "rgba(0,217,126,0.2)" : "rgba(0,0,0,0.06)"}`,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: r.active ? "linear-gradient(135deg, #0C5A3E, #0E7A4F)" : "#E2E8F0",
                  display: "grid", placeItems: "center",
                }}>
                  <span style={{ fontSize: 16 }}>💊</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: r.active ? "#0B1F16" : "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", marginTop: 1 }}>{r.time} · {r.frequency}</div>
                </div>
                <Switch checked={r.active} onCheckedChange={() => toggleReminder(r.id)} />
                <button onClick={() => deleteReminder(r.id)} style={{ border: "none", background: "none", cursor: "pointer", padding: 2 }}>
                  <X style={{ width: 14, height: 14, color: "#CBD5E1" }} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Reminder Add Dialog */}
      <Dialog open={reminderDialog} onOpenChange={setReminderDialog}>
        <DialogContent className="sm:max-w-md force-light">
          <DialogHeader><DialogTitle>Add Medicine Reminder</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Medicine Name">
              <Input className="gd-input" placeholder="e.g., Paracetamol 500mg" value={reminderForm.name} onChange={(e) => setReminderForm(f => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Time">
              <Input className="gd-input" type="time" value={reminderForm.time} onChange={(e) => setReminderForm(f => ({ ...f, time: e.target.value }))} />
            </Field>
            <Field label="Frequency">
              <Select value={reminderForm.frequency} onValueChange={(v) => setReminderForm(f => ({ ...f, frequency: v }))}>
                <SelectTrigger className="gd-input h-10 w-full rounded-xl !font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="twice">Twice a day</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="as-needed">As needed</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="btn-ghost-soft !font-bold" onClick={() => setReminderDialog(false)}>Cancel</Button>
            <Button className="btn-primary-emerald !font-bold" onClick={saveReminder} disabled={!reminderForm.name.trim()}>Add Reminder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ SECTIONS (existing) ═══ */}
      <div style={{ padding: "12px 16px 0" }}>

      {/* ---- Sections ---- */}
      <Section
        icon={<Home className="h-5 w-5 text-emerald-700" />}
        title={t("My Addresses")}
        expanded={openSections.addresses}
        onToggle={() => toggleSection("addresses")}
        action={
          <Button
            size="sm"
            className="btn-primary-emerald !font-bold"
            onClick={(e) => {
              e.stopPropagation();
              setEditingAddress(null);
              setShowAddressForm(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> {t("Add New")}
          </Button>
        }
      >
        <div className="mt-2 space-y-3">
          {addresses.length === 0 ? (
            <p className="text-sm text-slate-500">No addresses yet. Add one!</p>
          ) : (
            addresses.map((addr) => (
              <motion.button
                whileHover={{ y: -1 }}
                className={`w-full text-left rounded-xl border p-3.5 shadow-sm transition ${
                  addr.isDefault ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white"
                }`}
                key={addr.id}
                onClick={() => {
                  setEditingAddress(addr);
                  setShowAddressForm(true);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {addr.type}
                      {addr.addressLine ? ` — ${addr.addressLine}` : ""}
                    </div>
                    <div className="text-sm text-slate-600 truncate">
                      {addr.formatted || addr.addressLine}
                    </div>
                    {addr.isDefault && (
                      <Badge className="mt-2 bg-emerald-600 hover:bg-emerald-700">Default</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="btn-ghost-soft"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingAddress(addr);
                        setShowAddressForm(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAddress(addr);
                      }}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </motion.button>
            ))
          )}
        </div>
        <AddressForm
          open={showAddressForm}
          onClose={() => {
            setShowAddressForm(false);
            setEditingAddress(null);
          }}
          onSave={handleAddressSave}
          initial={editingAddress || {}}
        />
      </Section>

      <Section
        icon={<Wallet className="h-5 w-5 text-amber-500" />}
        title={t("Saved Cards & GoDavaii Money")}
        expanded={openSections.wallet}
        onToggle={() => toggleSection("wallet")}
      >
        <div className="mt-1 space-y-2">
          {cards.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700">
              No cards saved yet. Add one!
            </div>
          ) : (
            cards.map((card) => (
              <div
                key={card.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {cardIcons[card.brand] && <img src={cardIcons[card.brand]} alt={card.brand} className="w-8 shrink-0" />}
                  <div className="text-sm min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {card.brand} •••• {card.last4}
                      <span className="ml-2 font-normal text-slate-600">{card.name}</span>
                      <span className="ml-3 text-slate-500">Exp: {card.expiry}</span>
                    </div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="btn-ghost-soft shrink-0" onClick={() => handleCardEdit(card)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}

          <div className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-emerald-700" />
            <div className="font-bold text-emerald-700">GoDavaii Money: ₹240</div>
          </div>

          <Button variant="outline" className="btn-outline-soft !font-bold w-fit" onClick={handleCardAdd}>
            <Plus className="h-4 w-4 mr-1" />
            {t("Add New Card")}
          </Button>
        </div>

        {/* Card Dialog */}
        <Dialog open={cardDialog} onOpenChange={setCardDialog}>
          <DialogContent className="sm:max-w-md force-light">
            <DialogHeader>
              <DialogTitle> {editingCard ? "Edit Card" : "Add Card"} </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {cardTypeIcon && <img src={cardTypeIcon} alt="brand" className="w-10" />}
                <div className="grid w-full gap-1.5">
                  <Label>Card Number</Label>
                  <Input
                    value={cardForm.number}
                    onChange={handleCardNumberChange}
                    inputMode="numeric"
                    maxLength={19}
                    placeholder="1234 5678 9012 3456"
                    disabled={editingCard !== null}
                    className="gd-input"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Name on Card</Label>
                <Input className="gd-input" value={cardForm.name} onChange={(e) => handleCardFormChange("name", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Expiry (MM/YY)</Label>
                <Input
                  className="gd-input"
                  value={cardForm.expiry}
                  onChange={(e) => {
                    let v = e.target.value.replace(/[^\d/]/g, "").slice(0, 4);
                    if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2, 4);
                    setCardForm((f) => ({ ...f, expiry: v }));
                  }}
                  placeholder="MM/YY"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" className="btn-ghost-soft !font-bold" onClick={() => setCardDialog(false)}>Cancel</Button>
              <Button onClick={handleCardSave} className="btn-primary-emerald !font-bold">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      <Section
        icon={<History className="h-5 w-5 text-emerald-700" />}
        title={t("Order History")}
        expanded={openSections.orders}
        onToggle={() => toggleSection("orders")}
        action={
          <Button
            size="sm"
            variant="outline"
            className="btn-outline-soft !font-bold"
            onClick={(e) => {
              e.stopPropagation();
              navigate("/orders");
            }}
          >
            {t("View All Orders")}
          </Button>
        }
      >
        <div className="mt-1 space-y-3">
          {orders.length === 0 ? (
            <p className="text-sm text-slate-500">No orders yet.</p>
          ) : (
            orders.slice(0, 2).map((order) => (
              <motion.div
                whileHover={{ y: -1 }}
                key={order._id || order.id}
                className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm cursor-pointer"
                onClick={() => setOrderDetail(order)}
              >
                <div className="font-semibold text-slate-900">
                  Order #{order._id ? order._id.slice(-6).toUpperCase() : order.id}
                </div>
                <div className="text-sm text-slate-700">₹{order.total} for {order.items?.length || order.items} items</div>
                <div className="text-xs text-slate-500">
                  {(order.status || "Placed").charAt(0).toUpperCase() + (order.status || "Placed").slice(1)} •{" "}
                  {order.createdAt && order.createdAt.substring(0, 10)}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 btn-outline-soft !font-bold"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOrderAgain(order);
                  }}
                >
                  Order Again
                </Button>
              </motion.div>
            ))
          )}
        </div>

        <Dialog open={!!orderDetail} onOpenChange={(v) => !v && setOrderDetail(null)}>
           <DialogContent className="force-light">
            <DialogHeader>
              <DialogTitle>Order Details</DialogTitle>
            </DialogHeader>
            {orderDetail && (
              <div className="space-y-2">
                <div className="font-semibold">
                  Order #{orderDetail._id ? orderDetail._id.slice(-6).toUpperCase() : orderDetail.id}
                </div>
                <div>₹{orderDetail.total} for {orderDetail.items?.length || orderDetail.items} items</div>
                {Array.isArray(orderDetail.items) && (
                  <div>
                    <div className="font-semibold">Items:</div>
                    <ul className="list-disc pl-5">
                      {orderDetail.items.map((item, idx) => (
                        <li key={idx}>{item.name} × {item.quantity} – ₹{item.price}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {typeof orderDetail.details === "string" && <div>Details: {orderDetail.details}</div>}
                <div>Status: {orderDetail.status}</div>
                <div>Date: {orderDetail.createdAt}</div>
                <Button className="mt-2 btn-primary-emerald !font-bold" onClick={() => handleOrderAgain(orderDetail)}>
                  Order Again
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </Section>

      <Section
        icon={<BadgeCheck className="h-5 w-5 text-emerald-600" />}
        title={t("Badges & Loyalty")}
        expanded={openSections.badges}
        onToggle={() => toggleSection("badges")}
      >
        <div className="mt-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-400 text-emerald-900 hover:bg-amber-400/90">
              <Star className="h-3.5 w-3.5 mr-1" /> Super Saver
            </Badge>
            <Badge className="bg-emerald-600 hover:bg-emerald-700">Loyal Customer</Badge>
          </div>
          <div className="mt-2 text-slate-900">
            Loyalty Points: <span className="font-bold">{loyaltyPoints}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            1 point per ₹1 spent. Earn badges for frequent orders and savings!
          </div>
        </div>
      </Section>

      <Section
        icon={<Settings className="h-5 w-5 text-amber-500" />}
        title={t("Personalization")}
        expanded={openSections.personalization}
        onToggle={() => toggleSection("personalization")}
      >
        <div className="mt-1 space-y-4">
          {/* Language */}
          <Row label={t("Language")}>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger center className="gd-input h-10 w-full rounded-xl !font-bold">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          {/* Theme */}
          <Row label={t("Theme")}>
            <Select value={mode} onValueChange={handleThemeChange}>
              <SelectTrigger center className="gd-input h-10 w-full rounded-xl !font-bold">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Light">Light</SelectItem>
                <SelectItem value="Dark">Dark</SelectItem>
                <SelectItem value="System">System</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </div>
      </Section>

      <Section
        icon={<Settings className="h-5 w-5 text-slate-500" />}
        title={t("Settings")}
        expanded={openSections.settings}
        onToggle={() => toggleSection("settings")}
      >
        <div className="mt-1 space-y-6">
          <div>
            <div className="mb-2 text-sm font-bold text-slate-900">Account Settings</div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="btn-outline-soft !font-bold" onClick={() => setChangePassOpen(true)}>
                <Lock className="h-4 w-4 mr-2" /> Change Password
              </Button>
              <Button variant="outline" className="btn-outline-soft !font-bold" onClick={() => setChangeEmailOpen(true)}>
                <Mail className="h-4 w-4 mr-2" /> Change Email
              </Button>
              <Button
                variant="outline"
                className="btn-danger-outline !font-bold"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash className="h-4 w-4 mr-2" /> Delete Account
              </Button>
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-bold text-slate-900">Notifications</div>
            <div className="flex flex-wrap items-center gap-6">
              <ToggleRow label="Order Updates" checked={orderUpdates} onChange={setOrderUpdates} />
              <ToggleRow label="Offers & Promotions" checked={offerPromos} onChange={setOfferPromos} />
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-bold text-slate-900">Privacy</div>
            <ToggleRow
              label={`Data Sharing: ${dataSharing ? "Allowed" : "Not Allowed"}`}
              checked={dataSharing}
              onChange={setDataSharing}
            />
          </div>

          <div>
            <div className="mb-2 text-sm font-bold text-slate-900">Security</div>
            <div className="flex flex-wrap items-center gap-4">
              <ToggleRow label={`2FA: ${twoFA ? "On" : "Off"}`} checked={twoFA} onChange={setTwoFA} />
              <Badge variant="secondary">Device Activity: Last login 1 hr ago</Badge>
            </div>
          </div>
        </div>
      </Section>

      <Section
        icon={<Pill className="h-5 w-5 text-emerald-600" />}
        title={t("Pharmacist Portal")}
        expanded={openSections.pharmacist}
        onToggle={() => toggleSection("pharmacist")}
      >
        <div className="mt-1 flex flex-col sm:flex-row gap-2">
          <Button
            className="min-w-[220px] btn-primary-emerald !font-bold w-full sm:w-auto"
            onClick={() => {
              if (localStorage.getItem("pharmacyToken")) {
                navigate("/pharmacy/dashboard");
              } else {
                navigate("/pharmacy/login");
              }
            }}
          >
            {t("Go to Pharmacist Dashboard")}
          </Button>
          <Button
            variant="outline"
            className="min-w-[220px] btn-outline-soft !font-bold w-full sm:w-auto"
            onClick={() => navigate("/pharmacy/register")}
          >
            {t("Register as Pharmacist")}
          </Button>
        </div>
      </Section>

      <Section
        icon={<Bike className="h-5 w-5 text-emerald-700" />}
        title="Delivery Partner Portal"
        expanded={openSections.delivery}
        onToggle={() => toggleSection("delivery")}
      >
        <div className="mt-1 flex flex-col sm:flex-row gap-2">
          <Button
            className="min-w-[220px] btn-primary-emerald !font-bold w-full sm:w-auto"
            onClick={() => {
              if (localStorage.getItem("deliveryToken")) {
                navigate("/delivery/dashboard");
              } else {
                navigate("/delivery/dashboard");
              }
            }}
          >
            Go to Delivery Dashboard
          </Button>
          <Button
            variant="outline"
            className="min-w-[220px] btn-outline-soft !font-bold w-full sm:w-auto"
            onClick={() => navigate("/delivery/register")}
          >
            Register as Delivery Partner
          </Button>
        </div>
      </Section>

      <Section
        icon={<Headset className="h-5 w-5 text-emerald-700" />}
        title="Support & Feedback"
        expanded={openSections.support}
        onToggle={() => toggleSection("support")}
      >
        <div className="mt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button variant="outline" className="btn-outline-soft !font-bold w-full sm:w-auto" onClick={() => setSupportDialog(true)}>
            Raise Ticket
          </Button>
          <Button variant="ghost" className="btn-ghost-soft !font-bold w-full sm:w-auto" onClick={() => setChatSupportOpen(true)}>
            Contact Support
          </Button>
        </div>
      </Section>

      <Section
        icon={<Users className="h-5 w-5 text-amber-500" />}
        title="Refer & Earn"
        expanded={openSections.refer}
        onToggle={() => toggleSection("refer")}
      >
        <div className="mt-1">
          <div className="mb-2 font-semibold text-slate-900">
            Refer friends and earn ₹50 GoDavaii Money on their first order!
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input className="gd-input w-full sm:w-[260px]" value={referralCode} readOnly />
            <Button
              className="btn-primary-emerald !font-bold w-full sm:w-auto"
              onClick={() => {
                navigator.clipboard.writeText(referralCode);
                setSnackbar({ open: true, message: "Referral link copied!", severity: "success" });
              }}
            >
              Copy Link
            </Button>
          </div>
        </div>
      </Section>

      {/* Legal & Policies */}
      <Section
        icon={<Shield className="h-5 w-5 text-emerald-700" />}
        title="Legal & Policies"
        expanded={openSections.legal}
        onToggle={() => toggleSection("legal")}
      >
        <div className="mt-1 grid gap-2">
          <button
            className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm"
            onClick={() => navigate("/privacy")}
          >
            <span className="font-semibold text-slate-900 inline-flex items-center gap-2 truncate">
              <FileText className="h-4 w-4 text-emerald-700 shrink-0" /> Privacy Policy
            </span>
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
          </button>

          <button
            className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm"
            onClick={() => navigate("/terms")}
          >
            <span className="font-semibold text-slate-900 inline-flex items-center gap-2 truncate">
              <ScrollText className="h-4 w-4 text-emerald-700 shrink-0" /> Terms & Conditions
            </span>
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
          </button>

          <button
            className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm"
            onClick={() => navigate("/refunds")}
          >
            <span className="font-semibold text-slate-900 inline-flex items-center gap-2 truncate">
              <FileText className="h-4 w-4 text-emerald-700 shrink-0" /> Refunds & Cancellations
            </span>
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
          </button>

          <button
            className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm"
            onClick={() => navigate("/cookies")}
          >
            <span className="font-semibold text-slate-900 inline-flex items-center gap-2 truncate">
              <Cookie className="h-4 w-4 text-emerald-700 shrink-0" /> Cookie & Tracking Notice
            </span>
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
          </button>

          <button
            className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm"
            onClick={() => navigate("/delete-account")}
          >
            <span className="font-semibold text-slate-900 inline-flex items-center gap-2 truncate">
              <UserX className="h-4 w-4 text-emerald-700 shrink-0" /> Delete Account (How-to)
            </span>
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
          </button>
        </div>
      </Section>
      </div>{/* end sections wrapper */}

      <div className="flex justify-center mt-6 px-4">
        <Button
          variant="outline"
          className="btn-danger-outline !font-bold px-6 text-base"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>

      {/* Snackbar */}
      <AnimatePresence>
        {snackbar.open && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[2000] rounded-full px-4 py-2 shadow-lg
            ${snackbar.severity === "error" ? "bg-red-600" :
              snackbar.severity === "info" ? "bg-slate-800" : "bg-emerald-600"} text-white`}
            onAnimationComplete={() => setTimeout(() => setSnackbar((s) => ({ ...s, open: false })), 2200)}
          >
            {snackbar.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Profile */}
      <Dialog
        open={editDialog}
        onOpenChange={(open) => {
          if (open) return setEditDialog(true);
          if (isFirstRun) {
            if (editData.name && editData.email && editData.dob) setEditDialog(false);
            else setEditDialog(true);
          } else {
            setEditDialog(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md force-light">
          <DialogHeader><DialogTitle>Edit Profile</DialogTitle></DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                <AvatarImage src={avatarPreview} />
                <AvatarFallback>{(user?.name || "NU").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="bg-slate-100 text-slate-900 hover:bg-slate-200 !font-bold">
                <Camera className="h-4 w-4 mr-2" /> Change Avatar
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
            </div>

            <Field label="Name">
              <Input className="gd-input" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} required />
            </Field>

            <Field label="Email">
              <Input className="gd-input" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} required />
            </Field>

            <Field label="Mobile">
              <div className="flex gap-2">
                <Input className="gd-input flex-1" value={editData.mobile} onChange={(e) => setEditData({ ...editData, mobile: e.target.value })} disabled={!canEditMobile} placeholder="Add your mobile number" />
                {!canEditMobile && <Button type="button" variant="outline" className="btn-outline-soft !font-bold">Change</Button>}
              </div>
              {canEditMobile && <div className="mt-1 text-xs text-slate-500">You can add or edit your mobile now. When phone login launches, we’ll ask you to verify it.</div>}
            </Field>

            <Field label="DOB">
  <div className="flex items-center gap-2">
    {/* Text Input (dd-mm-yyyy) */}
    <Input
      className="gd-input flex-1"
      placeholder="dd-mm-yyyy"
      inputMode="numeric"
      value={dobInput}
      onChange={(e) => {
        // sirf digits allow karo, max 8 (ddmmyyyy)
        let v = e.target.value.replace(/[^\d]/g, "").slice(0, 8);

        // auto-insert hyphens: dd-mm-yyyy
        if (v.length > 4) {
          // 15021998 -> 15-02-1998
          v = v.replace(/^(\d{2})(\d{2})(\d{0,4})$/, "$1-$2-$3");
        } else if (v.length > 2) {
          // 1502 -> 15-02
          v = v.replace(/^(\d{2})(\d{0,2})$/, "$1-$2");
        }

        setDobInput(v);
      }}
      onBlur={() => {
        const iso = parseDobInputToIso(dobInput);
        if (iso) setEditData((d) => ({ ...d, dob: iso }));
      }}
      required
    />

    {/* Calendar Button, date input ... (as-is) */}
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        className="btn-outline-soft !font-bold px-3"
        onClick={() => {
          if (dobPickerRef.current?.showPicker) dobPickerRef.current.showPicker();
          else dobPickerRef.current?.focus();
        }}
      >
        <Calendar className="h-4 w-4" />
      </Button>

      <input
        ref={dobPickerRef}
        type="date"
        className="absolute inset-0 opacity-0 cursor-pointer"
        value={editData.dob || ""}
        onChange={(e) => {
          const iso = e.target.value;
          setEditData((d) => ({ ...d, dob: iso }));
          setDobInput(formatDobForDisplay(iso));
        }}
      />
    </div>
  </div>

  <p className="mt-1 text-xs text-slate-500">
  You can type the date manually (dd-mm-yyyy) or select it from the calendar.
  </p>
</Field>

          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            {!isFirstRun && (
              <Button variant="ghost" className="btn-ghost-soft !font-bold w-full sm:w-auto" onClick={() => setEditDialog(false)}>
                Cancel
              </Button>
            )}
            <Button className="btn-primary-emerald !font-bold w-full sm:w-auto"
              onClick={handleProfileSave}
              disabled={!editData.name || !editData.email || !editData.dob}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Support ticket */}
      <Dialog open={supportDialog} onOpenChange={setSupportDialog}>
        <DialogContent className="sm:max-w-md force-light">
          <DialogHeader>
            <DialogTitle>Raise Ticket</DialogTitle>
          </DialogHeader>
          <Field label="Message">
            <Input className="gd-input" value={supportMsg} onChange={(e) => setSupportMsg(e.target.value)} placeholder="Type your issue..." />
          </Field>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="ghost" className="btn-ghost-soft !font-bold w-full sm:w-auto" onClick={() => setSupportDialog(false)}>Cancel</Button>
            <Button
              className="btn-primary-emerald !font-bold w-full sm:w-auto"
              onClick={() => {
                if (!supportMsg.trim()) {
                  setSnackbar({ open: true, message: "Please enter a message.", severity: "error" });
                  return;
                }
                setSupportDialog(false);
                setSupportMsg("");
                setSnackbar({ open: true, message: "Ticket submitted!", severity: "success" });
              }}
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChatSupportModal open={chatSupportOpen} onClose={() => setChatSupportOpen(false)} />
    </div>
  );
}

/* ---------- Reusable UI helpers (visual only) ---------- */
function Section({ icon, title, expanded, onToggle, action, children }) {
  return (
    <div className="section">
      <button onClick={onToggle} className="w-full group section-head flex items-center justify-between gap-2 sm:gap-3 flex-wrap text-left">
        <div className="icon-tile">{icon}</div>
        <div className="flex-1 min-w-[160px] sm:min-w-[220px] text-left">
          <div className="h2-strong text-[15px] sm:text-[16px]">{title}</div>
        </div>
        <div className="ml-auto order-3 sm:order-none w-full sm:w-auto flex justify-end">{action}</div>
        <ChevronDown className={`h-5 w-5 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "tween", duration: 0.18 }}>
            <div className="section-card"><CardContent className="pt-4">{children}</CardContent></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span className="text-sm text-slate-900">{label}</span>
    </div>
  );
}
function Row({ label, children }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-2 sm:gap-3">
      <div className="text-sm font-semibold text-slate-900">{label}</div>
      <div className="w-full">{children}</div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-slate-700">{label}</Label>
      {children}
    </div>
  );
}
