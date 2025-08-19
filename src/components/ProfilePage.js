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
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";

// framer-motion
import { motion, AnimatePresence } from "framer-motion";

// lucide-react (icon replacements for old MUI icons)
import {
  Pencil, Plus, ChevronDown, Mail, Home, History, BadgeCheck, Wallet, Settings,
  Headset, Users, Pill, LogOut, Star, Bike, IndianRupee, Trash, Lock, Camera
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

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
  const toggleSection = (key) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  // --- MANDATORY PROFILE FIELDS DIALOG ---
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
        avatar: user.avatar || ""
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
      avatar: user?.avatar || ""
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

  // --- Settings Dialog toggles (logic preserved, UI stays inline switches) ---
  const [changePassOpen, setChangePassOpen] = useState(false);
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // --- Addresses ---
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

  // --- Cards (local only) ---
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
      setCards((prev) =>
        prev.map((c) => (c.id === editingCard.id ? { ...cardForm, id: c.id, last4 } : c))
      );
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

  // --- Orders (fetch from backend) ---
  const [orders, setOrders] = useState([]);
  const [orderDetail, setOrderDetail] = useState(null);

  useEffect(() => {
    if (user?._id) {
      axios
        .get(`${API_BASE_URL}/api/orders/myorders-userid/${user._id}`)
        .then((res) => {
          const sorted = [...res.data].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          );
          setOrders(sorted);
        })
        .catch(() => setOrders([]));
    }
  }, [user?._id]);

  const handleOrderAgain = (order) => {
    const pharmacyId =
      (order.pharmacy && order.pharmacy._id) ||
      order.pharmacyId ||
      order.pharmacy;
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

  // --- Loyalty
  const totalSpent = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const loyaltyPoints = Math.floor(totalSpent);

  // --- Personalization
  const { t, i18n } = useTranslation();
  const { mode, setMode } = useThemeMode();
  const [language, setLanguage] = useState(i18n.language || "en");
  const handleLanguageChange = (lng) => {
    setLanguage(lng);
    i18n.changeLanguage(lng);
    localStorage.setItem("language", lng);
  };
  const handleThemeChange = (theme) => setMode(theme);

  // --- Settings toggles
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [offerPromos, setOfferPromos] = useState(true);
  const [dataSharing, setDataSharing] = useState(true);
  const [twoFA, setTwoFA] = useState(false);

  // --- Support/Feedback ---
  const [supportDialog, setSupportDialog] = useState(false);
  const [supportMsg, setSupportMsg] = useState("");

  // --- Referral code
  const referralCode = `GODAVAII-USER-${user?._id || "XXXX"}`;

  // --- Logout
  const handleLogout = () => {
    logout();
    setSnackbar({ open: true, message: "Logged out!", severity: "info" });
    setTimeout(() => navigate("/login"), 1000);
  };

  return (
    <div className="max-w-[760px] mx-auto px-3 pb-24 pt-4">
      {/* Profile header card */}
      <Card className="mb-4 border-emerald-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20 ring-2 ring-white shadow">
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
                className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full border bg-white text-emerald-700 hover:bg-emerald-50"
                onClick={handleEditProfileOpen}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold text-emerald-900 truncate">
                {user?.name || "New User"}
              </h2>
              <div className="flex items-center gap-2 text-emerald-700">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate text-sm">{user?.email}</span>
              </div>
              {user?.mobile && (
                <div className="text-sm text-emerald-700 truncate">{user.mobile}</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Addresses */}
      <Section
        icon={<Home className="h-5 w-5 text-emerald-700" />}
        title={t("My Addresses")}
        expanded={openSections.addresses}
        onToggle={() => toggleSection("addresses")}
        action={
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
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
        <div className="mt-3 space-y-3">
          {addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No addresses yet. Add one!</p>
          ) : (
            addresses.map((addr) => (
              <div
                key={addr.id}
                className={`rounded-xl border p-3 transition shadow-sm cursor-pointer ${
                  addr.isDefault
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-white border-slate-200"
                }`}
                onClick={() => {
                  setEditingAddress(addr);
                  setShowAddressForm(true);
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold">
                      {addr.type}
                      {addr.addressLine ? ` - ${addr.addressLine}` : ""}
                    </div>
                    <div className="text-sm text-slate-600">
                      {addr.formatted || addr.addressLine}
                    </div>
                    {addr.isDefault && (
                      <Badge className="mt-2 bg-emerald-600 hover:bg-emerald-700">
                        Default
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
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
                      className="text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAddress(addr);
                      }}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
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

      {/* Saved Cards & GoDavaii Money */}
      <Section
        icon={<Wallet className="h-5 w-5 text-amber-500" />}
        title={t("Saved Cards & GoDavaii Money")}
        expanded={openSections.wallet}
        onToggle={() => toggleSection("wallet")}
      >
        <div className="mt-3 space-y-2">
          {cards.length === 0 ? (
            <div className="rounded-lg border bg-amber-50 px-3 py-2 text-slate-800">
              No cards saved yet. Add one!
            </div>
          ) : (
            cards.map((card) => (
              <div
                key={card.id}
                className="flex items-center justify-between rounded-lg border bg-amber-50 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  {cardIcons[card.brand] && (
                    <img src={cardIcons[card.brand]} alt={card.brand} className="w-8" />
                  )}
                  <div className="text-sm">
                    <div className="font-semibold">
                      {card.brand} •••• {card.last4}
                      <span className="ml-2 font-normal text-slate-600">{card.name}</span>
                      <span className="ml-3 text-slate-500">Exp: {card.expiry}</span>
                    </div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => handleCardEdit(card)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}

          <div className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-emerald-700" />
            <div className="font-bold text-emerald-700">GoDavaii Money: ₹240</div>
          </div>

          <Button
            variant="ghost"
            className="text-emerald-800 hover:bg-emerald-50 w-fit"
            onClick={handleCardAdd}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t("Add New Card")}
          </Button>
        </div>

        {/* Card Form Dialog */}
        <Dialog open={cardDialog} onOpenChange={setCardDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingCard ? "Edit Card" : "Add Card"}</DialogTitle>
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
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Name on Card</Label>
                <Input
                  value={cardForm.name}
                  onChange={(e) => handleCardFormChange("name", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Expiry (MM/YY)</Label>
                <Input
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
              <Button variant="ghost" onClick={() => setCardDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCardSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      {/* Orders */}
      <Section
        icon={<History className="h-5 w-5 text-emerald-700" />}
        title={t("Order History")}
        expanded={openSections.orders}
        onToggle={() => toggleSection("orders")}
        action={
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
            onClick={(e) => {
              e.stopPropagation();
              navigate("/orders");
            }}
          >
            {t("View All Orders")}
          </Button>
        }
      >
        <div className="mt-3 space-y-3">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            orders.slice(0, 2).map((order) => (
              <div
                key={order._id || order.id}
                className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm cursor-pointer"
                onClick={() => setOrderDetail(order)}
              >
                <div className="font-bold">
                  Order #{order._id ? order._id.slice(-6).toUpperCase() : order.id}
                </div>
                <div className="text-sm">₹{order.total} for {order.items?.length || order.items} items</div>
                <div className="text-xs text-slate-600">
                  {(order.status || "Placed").charAt(0).toUpperCase() + (order.status || "Placed").slice(1)}{" "}
                  | {order.createdAt && order.createdAt.substring(0, 10)}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOrderAgain(order);
                  }}
                >
                  Order Again
                </Button>
              </div>
            ))
          )}
        </div>

        <Dialog open={!!orderDetail} onOpenChange={(v) => !v && setOrderDetail(null)}>
          <DialogContent>
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
                <Button className="mt-2 bg-emerald-600" onClick={() => handleOrderAgain(orderDetail)}>
                  Order Again
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </Section>

      {/* Badges & Loyalty */}
      <Section
        icon={<BadgeCheck className="h-5 w-5 text-emerald-600" />}
        title={t("Badges & Loyalty")}
        expanded={openSections.badges}
        onToggle={() => toggleSection("badges")}
      >
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-400 text-emerald-900 hover:bg-amber-400/90">
              <Star className="h-3.5 w-3.5 mr-1" /> Super Saver
            </Badge>
            <Badge className="bg-emerald-600 hover:bg-emerald-700">
              Loyal Customer
            </Badge>
          </div>
          <div className="mt-2">
            Loyalty Points: <span className="font-bold">{loyaltyPoints}</span>
          </div>
          <div className="mt-1 text-xs text-slate-600">
            1 point per ₹1 spent. Earn badges for frequent orders and savings!
          </div>
        </div>
      </Section>

      {/* Personalization */}
      <Section
        icon={<Settings className="h-5 w-5 text-amber-500" />}
        title={t("Personalization")}
        expanded={openSections.personalization}
        onToggle={() => toggleSection("personalization")}
      >
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{t("Language")}</div>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="font-semibold">{t("Theme")}</div>
            <Select value={mode} onValueChange={handleThemeChange}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Light">{t("Light")}</SelectItem>
                <SelectItem value="Dark">{t("Dark")}</SelectItem>
                <SelectItem value="System">{t("System")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      {/* Settings */}
      <Section
        icon={<Settings className="h-5 w-5 text-slate-500" />}
        title={t("Settings")}
        expanded={openSections.settings}
        onToggle={() => toggleSection("settings")}
      >
        <div className="mt-3 space-y-5">
          <div>
            <div className="mb-2 font-bold text-emerald-800">Account Settings</div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setChangePassOpen(true)}>
                <Lock className="h-4 w-4 mr-2" /> Change Password
              </Button>
              <Button variant="outline" onClick={() => setChangeEmailOpen(true)}>
                <Mail className="h-4 w-4 mr-2" /> Change Email
              </Button>
              <Button variant="outline" className="text-red-600 border-red-200" onClick={() => setDeleteOpen(true)}>
                <Trash className="h-4 w-4 mr-2" /> Delete Account
              </Button>
            </div>
          </div>

          <div>
            <div className="mb-2 font-bold text-emerald-800">Notifications</div>
            <div className="flex flex-wrap items-center gap-6">
              <ToggleRow label="Order Updates" checked={orderUpdates} onChange={setOrderUpdates} />
              <ToggleRow label="Offers & Promotions" checked={offerPromos} onChange={setOfferPromos} />
            </div>
          </div>

          <div>
            <div className="mb-2 font-bold text-emerald-800">Privacy</div>
            <ToggleRow
              label={`Data Sharing: ${dataSharing ? "Allowed" : "Not Allowed"}`}
              checked={dataSharing}
              onChange={setDataSharing}
            />
          </div>

          <div>
            <div className="mb-2 font-bold text-emerald-800">Security</div>
            <div className="flex flex-wrap items-center gap-4">
              <ToggleRow label={`2FA: ${twoFA ? "On" : "Off"}`} checked={twoFA} onChange={setTwoFA} />
              <Badge variant="secondary">Device Activity: Last login 1 hr ago</Badge>
            </div>
          </div>
        </div>
      </Section>

      {/* Pharmacist Portal */}
      <Section
        icon={<Pill className="h-5 w-5 text-emerald-600" />}
        title={t("Pharmacist Portal")}
        expanded={openSections.pharmacist}
        onToggle={() => toggleSection("pharmacist")}
      >
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <Button
            className="min-w-[220px]"
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
            className="min-w-[220px]"
            onClick={() => navigate("/pharmacy/register")}
          >
            {t("Register as Pharmacist")}
          </Button>
        </div>
      </Section>

      {/* Delivery Partner Portal */}
      <Section
        icon={<Bike className="h-5 w-5 text-emerald-700" />}
        title="Delivery Partner Portal"
        expanded={openSections.delivery}
        onToggle={() => toggleSection("delivery")}
      >
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <Button
            className="min-w-[220px]"
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
          <Button variant="outline" className="min-w-[220px]" onClick={() => navigate("/delivery/register")}>
            Register as Delivery Partner
          </Button>
        </div>
      </Section>

      {/* Support & Feedback */}
      <Section
        icon={<Headset className="h-5 w-5 text-emerald-700" />}
        title="Support & Feedback"
        expanded={openSections.support}
        onToggle={() => toggleSection("support")}
      >
        <div className="mt-3 flex items-center gap-2">
          <Button variant="outline" onClick={() => setSupportDialog(true)}>
            Raise Ticket
          </Button>
          <Button variant="ghost" onClick={() => setChatSupportOpen(true)}>
            Contact Support
          </Button>
        </div>
      </Section>

      {/* Refer & Earn */}
      <Section
        icon={<Users className="h-5 w-5 text-amber-500" />}
        title="Refer & Earn"
        expanded={openSections.refer}
        onToggle={() => toggleSection("refer")}
      >
        <div className="mt-3">
          <div className="font-semibold mb-2">
            Refer friends and earn ₹50 GoDavaii Money on their first order!
          </div>
          <div className="flex items-center gap-2">
            <Input value={referralCode} readOnly className="w-[220px]" />
            <Button
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

      {/* Logout */}
      <div className="flex justify-center mt-4">
        <Button
          variant="outline"
          className="border-red-300 text-red-600 hover:bg-red-50 px-6 text-base"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>

      {/* Lightweight Snackbar */}
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

      {/* Profile Edit Dialog */}
      <Dialog
        open={editDialog}
        onOpenChange={(open) => {
          if (!open && editData.name && editData.email && editData.dob) setEditDialog(false);
          else if (open) setEditDialog(true);
        }}
      >
        <DialogContent className="sm:max-w-md">
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
                className="bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              >
                <Camera className="h-4 w-4 mr-2" />
                Change Avatar
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleAvatarChange}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} required />
            </div>

            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input
                value={editData.email}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Mobile</Label>
              <Input value={editData.mobile} disabled />
            </div>

            <div className="grid gap-1.5">
              <Label>DOB</Label>
              <Input
                type="date"
                value={editData.dob}
                onChange={(e) => setEditData({ ...editData, dob: e.target.value })}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditDialog(false)}
              disabled={!editData.name || !editData.email || !editData.dob}
            >
              Cancel
            </Button>
            <Button onClick={handleProfileSave} disabled={!editData.name || !editData.email || !editData.dob}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Support ticket (simple message capture; logic unchanged) */}
      <Dialog open={supportDialog} onOpenChange={setSupportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Raise Ticket</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>Message</Label>
            <Input
              value={supportMsg}
              onChange={(e) => setSupportMsg(e.target.value)}
              placeholder="Type your issue..."
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSupportDialog(false)}>Cancel</Button>
            <Button
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

/** ---------- Reusable Section ---------- */
function Section({ icon, title, expanded, onToggle, action, children }) {
  return (
    <Card className="mb-3 border-slate-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50/40 transition"
      >
        <div className="shrink-0">{icon}</div>
        <CardTitle className="text-base font-extrabold text-emerald-900 flex-1 text-left">
          {title}
        </CardTitle>
        {action}
        <ChevronDown
          className={`h-5 w-5 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "tween", duration: 0.18 }}
          >
            <Separator />
            <CardContent className="pt-4">{children}</CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/** Small toggle row helper (keeps logic unchanged) */
function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span className="text-sm">{label}</span>
    </div>
  );
}
