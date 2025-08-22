// src/components/ProfilePage.js
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useThemeMode } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import creditCardType from "credit-card-type";
import ChatSupportModal from "./ChatSupportModal";
import AddressForm from "./AddressForm";

// shadcn/ui
import { Button } from "../components/ui/button";
import { CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";

// framer-motion
import { motion, AnimatePresence } from "framer-motion";

// lucide-react
import {
  Pencil, Plus, ChevronDown, Mail, Home, History, BadgeCheck, Wallet, Settings,
  Headset, Users, Pill, LogOut, Star, Bike, IndianRupee, Trash, Lock, Camera
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

// flip this to "true" in env when you launch phone-login
const MOBILE_LOGIN_ENABLED = String(process.env.REACT_APP_MOBILE_LOGIN_ENABLED) === "true";

const cardIcons = {
  Visa: "https://img.icons8.com/color/48/000000/visa.png",
  Mastercard: "https://img.icons8.com/color/48/000000/mastercard-logo.png",
  Amex: "https://img.icons8.com/color/48/000000/amex.png",
  Rupay: "https://seeklogo.com/images/R/rupay-logo-E3947D7A13-seeklogo.com.png",
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, setUser, logout, token, addresses, updateAddresses } = useAuth();
  const [chatSupportOpen, setChatSupportOpen] = useState(false);

  const [openSections, setOpenSections] = useState({
    addresses: true,
    wallet: false,
    orders: false,
    badges: false,
    personalization: false,
    settings: false,
    pharmacist: false,
    delivery: false,
    support: false,
    refer: false,
  });
  const toggleSection = (key) => setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  // --- Edit profile dialog ---
  const [editDialog, setEditDialog] = useState(false);
  const [editData, setEditData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    mobile: user?.mobile || "",
    dob: user?.dob || "",
    avatar: user?.avatar || "",
  });
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || "");
  const fileInputRef = useRef();

  useEffect(() => {
    if (user && (!user.name || !user.email || !user.dob)) {
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
  }, [user]);

  const handleEditProfileOpen = () => {
    setEditData({
      name: user?.name || "",
      email: user?.email || "",
      mobile: user?.mobile || "",
      dob: user?.dob || "",
      avatar: user?.avatar || "",
    });
    setAvatarPreview(user?.avatar || "");
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
    try {
      await axios.put(`${API_BASE_URL}/api/users/${user._id}`, editData);
      setSnackbar({ open: true, message: "Profile updated!", severity: "success" });
      const updatedProfile = await axios.get(`${API_BASE_URL}/api/profile`, {
        headers: { Authorization: "Bearer " + token },
      });
      setUser(updatedProfile.data);
      setEditDialog(false);
    } catch {
      setSnackbar({ open: true, message: "Failed to update!", severity: "error" });
    }
  };

  // --- Settings modals (logic unchanged) ---
  const [changePassOpen, setChangePassOpen] = useState(false);
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // --- Addresses (logic unchanged) ---
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
    if (newAddr.isDefault) {
      updated = updated.map((a) => ({ ...a, isDefault: a.id === newAddr.id }));
    }
    await updateAddresses(updated);
    setSnackbar({
      open: true,
      message: editingAddress ? "Address updated!" : "Address added!",
      severity: "success",
    });
    setShowAddressForm(false);
    setEditingAddress(null);
  };

  const handleDeleteAddress = async (addr) => {
    if (!window.confirm("Are you sure you want to delete this address?")) return;
    const updated = addresses.filter((a) => a.id !== addr.id);
    await updateAddresses(updated);
    setSnackbar({ open: true, message: "Address deleted!", severity: "success" });
  };

  // --- Cards (logic unchanged) ---
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
  function handleCardFormChange(field, value) {
    setCardForm((f) => ({ ...f, [field]: value }));
  }
  function handleCardSave() {
    if (cardForm.number.length < 19 || !cardForm.name || !/^\d{2}\/\d{2}$/.test(cardForm.expiry)) {
      setSnackbar({ open: true, message: "Enter valid card details!", severity: "error" });
      return;
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

  // --- Orders (logic unchanged) ---
  const [orders, setOrders] = useState([]);
  const [orderDetail, setOrderDetail] = useState(null);

  useEffect(() => {
    if (user?._id) {
      axios
        .get(`${API_BASE_URL}/api/orders/myorders-userid/${user._id}`)
        .then((res) => {
          const sorted = [...res.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setOrders(sorted);
        })
        .catch(() => setOrders([]));
    }
  }, [user?._id]);

  const handleOrderAgain = (order) => {
    const pharmacyId =
      (order.pharmacy && order.pharmacy._id) || order.pharmacyId || order.pharmacy;
    if (pharmacyId) {
      navigate(`/medicines/${pharmacyId}`);
    } else {
      setSnackbar({
        open: true,
        message: "Pharmacy information missing. Unable to reorder.",
        severity: "error",
      });
    }
  };

  // Loyalty
  const totalSpent = orders.reduce((s, o) => s + (o.total || 0), 0);
  const loyaltyPoints = Math.floor(totalSpent);

  // Personalization
  const { t, i18n } = useTranslation();
  const { mode, setMode } = useThemeMode();
  const [language, setLanguage] = useState(i18n.language || "en");
  const handleLanguageChange = (lng) => {
    setLanguage(lng);
    i18n.changeLanguage(lng);
    localStorage.setItem("language", lng);
  };
  const handleThemeChange = (theme) => setMode(theme);

  // Settings toggles
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [offerPromos, setOfferPromos] = useState(true);
  const [dataSharing, setDataSharing] = useState(true);
  const [twoFA, setTwoFA] = useState(false);

  // Support
  const [supportDialog, setSupportDialog] = useState(false);
  const [supportMsg, setSupportMsg] = useState("");

  // Referral
  const referralCode = `GODAVAII-USER-${user?._id || "XXXX"}`;

  // Logout
  const handleLogout = () => {
    logout();
    setSnackbar({ open: true, message: "Logged out!", severity: "info" });
    setTimeout(() => navigate("/login"), 1000);
  };

  // When phone login is ON + user already verified phone, lock the field
  const mobileLocked = MOBILE_LOGIN_ENABLED && Boolean(user?.mobileVerified);
  const canEditMobile = !mobileLocked;

  return (
    <div className="profile-page mx-auto w-full max-w-[520px] md:max-w-[680px] px-4 md:px-6 pb-28 pt-4 bg-white">
      {/* Top: Profile Summary */}
      <div className="flex items-center gap-4 py-3 md:py-4 border-b border-slate-100 mb-4">
        <div className="relative">
          <Avatar className="h-16 w-16 ring-2 ring-emerald-100">
            <AvatarImage
              src={
                user?.avatar ||
                (user?.name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}` : "")
              }
            />
            <AvatarFallback className="bg-emerald-600 text-white font-bold">
              {(user?.name || "NU").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <Button
            size="icon"
            variant="secondary"
            className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full border bg-white text-emerald-700 hover:bg-emerald-50 active:scale-[.97]"
            onClick={handleEditProfileOpen}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>

        {/* Text column */}
        <div className="min-w-0 flex-1">
          <h1 className="h1-strong truncate">{user?.name || "New User"}</h1>
          <div className="body mt-0.5 flex items-center gap-2 text-slate-700">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{user?.email}</span>
          </div>
          {user?.mobile && <div className="body text-slate-700 truncate">{user.mobile}</div>}
        </div>
      </div>

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
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {addr.type}
                      {addr.addressLine ? ` — ${addr.addressLine}` : ""}
                    </div>
                    <div className="text-sm text-slate-600">{addr.formatted || addr.addressLine}</div>
                    {addr.isDefault && (
                      <Badge className="mt-2 bg-emerald-600 hover:bg-emerald-700">Default</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
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
                <div className="flex items-center gap-3">
                  {cardIcons[card.brand] && <img src={cardIcons[card.brand]} alt={card.brand} className="w-8" />}
                  <div className="text-sm">
                    <div className="font-semibold text-slate-900">
                      {card.brand} •••• {card.last4}
                      <span className="ml-2 font-normal text-slate-600">{card.name}</span>
                      <span className="ml-3 text-slate-500">Exp: {card.expiry}</span>
                    </div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="btn-ghost-soft" onClick={() => handleCardEdit(card)}>
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
                    let v = e.target.value.replace(/[^\d/]/g, "").slice(0, 5);
                    if (v.length === 2 && !v.includes("/")) v += "/";
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
            className="min-w-[220px] btn-primary-emerald !font-bold"
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
            className="min-w-[220px] btn-outline-soft !font-bold"
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
            className="min-w-[220px] btn-primary-emerald !font-bold"
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
            className="min-w-[220px] btn-outline-soft !font-bold"
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
        <div className="mt-1 flex items-center gap-2">
          <Button variant="outline" className="btn-outline-soft !font-bold" onClick={() => setSupportDialog(true)}>
            Raise Ticket
          </Button>
          <Button variant="ghost" className="btn-ghost-soft !font-bold" onClick={() => setChatSupportOpen(true)}>
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
          <div className="flex items-center gap-2">
            <Input className="w-[260px] gd-input" value={referralCode} readOnly />
            <Button
              className="btn-primary-emerald !font-bold"
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

      <div className="flex justify-center mt-6">
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
          if (!open && editData.name && editData.email && editData.dob) setEditDialog(false);
          else if (open) setEditDialog(true);
        }}
      >
        <DialogContent className="sm:max-w-md force-light">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarPreview} />
                <AvatarFallback>{(user?.name || "NU").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                className="bg-slate-100 text-slate-900 hover:bg-slate-200 !font-bold"
              >
                <Camera className="h-4 w-4 mr-2" />
                Change Avatar
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
                <Input
                  className="gd-input flex-1"
                  value={editData.mobile}
                  onChange={(e) => setEditData({ ...editData, mobile: e.target.value })}
                  disabled={!canEditMobile}
                  placeholder="Add your mobile number"
                />
                {mobileLocked && (
                  <Button type="button" variant="outline" className="btn-outline-soft !font-bold">
                    Change
                  </Button>
                )}
              </div>
              {!mobileLocked && (
                <div className="mt-1 text-xs text-slate-500">
                  You can add or edit your mobile now. When phone login launches, we’ll ask you to verify it.
                </div>
              )}
            </Field>

            <Field label="DOB">
              <Input className="gd-input" type="date" value={editData.dob} onChange={(e) => setEditData({ ...editData, dob: e.target.value })} required />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="ghost" className="btn-ghost-soft !font-bold" onClick={() => setEditDialog(false)} disabled={!editData.name || !editData.email || !editData.dob}>
              Cancel
            </Button>
            <Button className="btn-primary-emerald !font-bold" onClick={handleProfileSave} disabled={!editData.name || !editData.email || !editData.dob}>
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
          <DialogFooter>
            <Button variant="ghost" className="btn-ghost-soft !font-bold" onClick={() => setSupportDialog(false)}>Cancel</Button>
            <Button
              className="btn-primary-emerald !font-bold"
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
      {/* Header (outside card) */}
      <button onClick={onToggle} className="w-full group section-head">
        <div className="icon-tile">{icon}</div>
        <div className="flex-1 text-left">
          <div className="h2-strong">{title}</div>
        </div>
        {action}
        <ChevronDown className={`h-5 w-5 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {/* Content (inside card) */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "tween", duration: 0.18 }}
          >
            <div className="section-card">
              <CardContent className="pt-4">{children}</CardContent>
            </div>
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

/** Grid row so labels and controls align perfectly */
function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3">
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
