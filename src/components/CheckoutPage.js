// src/components/CheckoutPage.jsx
// Tech: React + TailwindCSS + shadcn/ui + Framer Motion + lucide-react
// NOTE: Logic/flow preserved exactly. Pure UI polish to match deep-green theme.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Separator } from "../components/ui/separator";

import { useNavigate, useLocation } from "react-router-dom";
import {
  IndianRupee,
  Upload,
  Tag,
  Loader2,
  Plus,
  Minus,
  Sparkles,
  Check,
  Trash2,
} from "lucide-react";

import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useLocation as useLocContext } from "../context/LocationContext";
import AddressSelector from "./AddressSelector";
import AddressForm from "./AddressForm";
import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

// Deep green brand color
const DEEP = "#0f6e51";

// ---- delivery fee config ----
const FEE_PER_KM = 7;        // ₹7 per km
const MIN_DELIVERY_FEE = 24; // minimum ₹24

// ---------------- helpers (unchanged) ----------------
function normalizeMedicine(med) {
  return {
    medicineId: med._id || med.medicineId,
    pharmacyId: med.pharmacy?._id || med.pharmacyId || med.pharmacy,
    name: med.name || med.medicineName,
    price: med.price,
    quantity: med.quantity,
    img: med.img || "",
    brand: med.brand || "",
    mrp: med.mrp || "",
    category: Array.isArray(med.category)
      ? med.category
      : med.category
      ? [med.category]
      : [],
  };
}

function loadRazorpayScript(src) {
  return new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve(true);
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

async function handlePlaceOrder(
  {
    cart,
    addresses,
    allAddresses,
    selectedAddressId,
    wantChemistInstruction,
    dosage,
    paymentMethod,
    selectedPharmacy,
    total,
    prescription,
    prescriptionPreview,
    instructions,
    coupon,
    tip,
    donate,
    deliveryInstructions,
    user,
    token,
    setToast,
    clearCart,
    setLoading,
    // NEW: forward platform fee so invoice can split GST (18%) internally
    platformFee,
  },
  paymentStatus,
  paymentDetails = {},
  onOrderSuccess
) {
  setLoading(true);
  try {
    let prescriptionUrl = "";
    if (prescription) {
      prescriptionUrl = prescriptionPreview;
    }
    const normalizedItems = cart.map(normalizeMedicine);
    const payload = {
      items: normalizedItems,
      pharmacyId: normalizedItems[0]?.pharmacyId,
      address: allAddresses.find((a) => a.id === selectedAddressId),
      dosage: wantChemistInstruction ? "Let chemist suggest" : dosage,
      paymentMethod,
      total,
      prescription: prescriptionUrl,
      instructions,
      coupon,
      tip,
      donate: donate ? 3 : 0,
      deliveryInstructions,
      paymentStatus,
      paymentDetails,
      // NEW: keep platform fee inclusive and provide a fees object for backend/invoice
      platformFee,
      fees: {
        platform: { gross: platformFee, rate: 18 },
      },
    };

    const res = await axios.post(`${API_BASE_URL}/api/orders`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    clearCart();
    setToast({ type: "success", message: "Order placed successfully!" });
    onOrderSuccess?.(res.data);
  } catch (err) {
    setToast({
      type: "error",
      message: err.response?.data?.message || "Order failed! Please try again.",
    });
  }
  setLoading(false);
}

// ---------------- Component ----------------
export default function CheckoutPage() {
  const { cart, clearCart, selectedPharmacy, addToCart, removeOneFromCart, removeFromCart } =
    useCart();
  const removeItemCompletely = (med) => {
  if (typeof removeFromCart === "function") return removeFromCart(med);
  for (let i = 0; i < (med.quantity || 1); i++) removeOneFromCart(med);
};
  const { user, token, addresses, updateAddresses } = useAuth();
  const { currentAddress } = useLocContext();
  const navigate = useNavigate();
  const location = useLocation();

  // quote/prescription flow
  const [isPrescriptionFlow, setIsPrescriptionFlow] = useState(false);
  const [prescriptionOrder, setPrescriptionOrder] = useState(null);
  const lockedAddress = isPrescriptionFlow && prescriptionOrder?.address;
  const [quoteItems, setQuoteItems] = useState([]);
  const [quoteTotal, setQuoteTotal] = useState(0);
  const [quoteMessage, setQuoteMessage] = useState("");
  const [offersOpen, setOffersOpen] = useState(false);
  const offersRef = useRef(null);
  const paymentOptions = [
    { value: "cod", label: "Cash on Delivery" },
    { value: "upi", label: "UPI" },
    { value: "card", label: "Credit/Debit Card" },
  ];

  // derived address list (kept)
  const isCurrentAddrSaved = useMemo(
    () =>
      addresses.some(
        (a) =>
          a.place_id === currentAddress?.place_id ||
          (a.lat &&
            a.lng &&
            currentAddress?.lat &&
            currentAddress?.lng &&
            Math.abs(a.lat - currentAddress.lat) < 0.00001 &&
            Math.abs(a.lng - currentAddress.lng) < 0.00001)
      ),
    [addresses, currentAddress]
  );

  const allAddresses = useMemo(
    () => [
      ...(!isCurrentAddrSaved && currentAddress
        ? [
            {
              ...currentAddress,
              id: "current-location",
              type: "Current",
              name: user?.name || "",
              phone: user?.phone || "",
              addressLine: currentAddress.formatted,
            },
          ]
        : []),
      ...addresses,
    ],
    [isCurrentAddrSaved, currentAddress, addresses, user]
  );

  // fetch quote order when orderId in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const orderId = params.get("orderId");
    if (orderId && token) {
      setIsPrescriptionFlow(true);
      axios
        .get(`${API_BASE_URL}/api/prescriptions/order/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => {
          setPrescriptionOrder(res.data);
          if (res.data.tempQuote?.items?.length) {
            setQuoteItems(res.data.tempQuote.items);
            const approx =
              typeof res.data.tempQuote.approxPrice === "number"
                ? res.data.tempQuote.approxPrice
                : res.data.tempQuote.items
                    .filter((i) => i.available !== false)
                    .reduce(
                      (s, i) => s + (i.price || 0) * (i.quantity || 1),
                      0
                    );
            setQuoteTotal(approx);
            setQuoteMessage(res.data.tempQuote.message || "");
          } else if (res.data.quote?.items?.length) {
            setQuoteItems(res.data.quote.items);
            setQuoteTotal(res.data.quote.price || 0);
            setQuoteMessage(res.data.quote.message || "");
          } else if (Array.isArray(res.data.quotes) && res.data.quotes.length) {
            const latest = res.data.quotes[res.data.quotes.length - 1];
            setQuoteItems(latest.items || []);
            setQuoteTotal(latest.price || 0);
            setQuoteMessage(latest.message || "");
          } else {
            setQuoteItems([]);
            setQuoteTotal(0);
            setQuoteMessage("");
          }
        })
        .catch(() => setIsPrescriptionFlow(false));
    }
  }, [location.search, token]);

  // close popover on outside click / route change
  useEffect(() => {
    const onDocClick = (e) => {
      if (!offersRef.current) return;
      if (!offersRef.current.contains(e.target)) setOffersOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // UI state
  const [toast, setToast] = useState(null); // {type, message}
  const [loading, setLoading] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [wantChemistInstruction, setWantChemistInstruction] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [dosage, setDosage] = useState("");
  const [tip, setTip] = useState(0);
  const [donate, setDonate] = useState(false);
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const prescriptionInput = useRef();
  const [prescription, setPrescription] = useState(null);
  const [prescriptionPreview, setPrescriptionPreview] = useState(null);

  // smart suggestions
  const [rawSuggestions, setRawSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionsDisabledRef = useRef(false);

  useEffect(() => {
    if (!selectedAddressId && allAddresses[0]?.id)
      setSelectedAddressId(allAddresses[0].id);
  }, [allAddresses, selectedAddressId]);

  // bill calc
  const itemList =
    isPrescriptionFlow && quoteItems.length
      ? quoteItems.filter((m) => m.available !== false)
      : cart;
  const itemTotal = itemList.reduce(
    (sum, med) => sum + (med.price || 0) * (med.quantity || 1),
    0
  );
  const deliveryFee = itemTotal >= FREE_DELIVERY_MIN ? 0 : DELIVERY_FEE;
  const gst = Math.round(itemTotal * 0.05 * 100) / 100;
  const discount = couponApplied ? Math.round(itemTotal * 0.1) : 0;
  const platformFee = 10;
  const fullTotal =
    itemTotal +
    deliveryFee +
    gst +
    platformFee +
    (tip || 0) +
    (donate ? 3 : 0) -
    discount;

  const availableOffers = [
    { code: "NEW15", desc: "Get 15% off for new users. Max ₹100 off." },
    { code: "FREESHIP", desc: `Free delivery on orders above ₹${FREE_DELIVERY_MIN}.` },
    { code: "SAVE30", desc: "Save ₹25 on your next order!" },
  ];
  const tipAmounts = [10, 15, 20, 30];
  const toFree = Math.max(0, FREE_DELIVERY_MIN - itemTotal);
  const progressToFree = Math.min(100, (itemTotal / FREE_DELIVERY_MIN) * 100);

  // address save/delete (restored)
  const handleSaveAddress = async (address) => {
    let updated;
    if (address.id && addresses.some((a) => a.id === address.id)) {
      updated = addresses.map((a) => (a.id === address.id ? address : a));
    } else {
      address.id = Date.now().toString();
      updated = [...addresses, address];
    }
    await updateAddresses(updated);
    setSelectedAddressId(address.id);
    setAddressFormOpen(false);
  };

  const handleDeleteAddress = async (addr) => {
    if (!window.confirm("Are you sure you want to delete this address?")) return;
    const updated = addresses.filter((a) => a.id !== addr.id);
    await updateAddresses(updated);
    setToast({ type: "success", message: "Address deleted!" });
    if (selectedAddressId === addr.id && updated.length) {
      setSelectedAddressId(updated[0].id);
    } else if (!updated.length) {
      setSelectedAddressId(null);
    }
  };

  // prescription file
  const handlePrescriptionChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPrescription(file);
    const reader = new FileReader();
    reader.onload = () => setPrescriptionPreview(reader.result);
    reader.readAsDataURL(file);
  };

  // suggestions fetch
  // suggestions fetch
useEffect(() => {
  if (
    isPrescriptionFlow ||
    !selectedPharmacy?._id ||
    suggestionsDisabledRef.current
  ) {
    setRawSuggestions([]);
    return;
  }

  setSuggestionsLoading(true);

  const exclude = cart
    .map((m) => m._id || m.medicineId || m.medicine_id)
    .filter(Boolean)
    .join(",");

  const params = { pharmacyId: selectedPharmacy._id, limit: 20, exclude };
  console.log("Fetching suggestions with", params);
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  (async () => {
    try {
      // 1) plural
      const r = await axios.get(`${API_BASE_URL}/api/medicines/suggestions`, {
        params,
        headers,
      });
      setRawSuggestions(Array.isArray(r.data) ? r.data : []);
      return; // success, stop here
    } catch (err) {
      if (err?.response?.status === 404) {
        try {
          // 2) singular
          const r2 = await axios.get(`${API_BASE_URL}/api/medicine/suggestions`, {
            params,
            headers,
          });
          setRawSuggestions(Array.isArray(r2.data) ? r2.data : []);
          return; // success, stop here
        } catch (e2) {
          if (e2?.response?.status === 404) {
            try {
              // 3) plain alias
              const r3 = await axios.get(`${API_BASE_URL}/api/suggestions`, {
                params,
                headers,
              });
              setRawSuggestions(Array.isArray(r3.data) ? r3.data : []);
              return;
            } catch {
              // all three failed
              setRawSuggestions([]);
            }
          } else {
            setRawSuggestions([]);
          }
        }
      } else {
        setRawSuggestions([]);
      }
    } finally {
      setSuggestionsLoading(false);
    }
  })();
}, [selectedPharmacy?._id, isPrescriptionFlow, cart, token]);

  const suggestions = useMemo(() => {
    const excludeIds = new Set(
      cart
        .map((m) => m._id || m.medicineId || m.medicine_id || m.medicineId)
        .filter(Boolean)
    );
    return rawSuggestions
      .filter((it) => !excludeIds.has(it._id || it.medicineId))
      .slice(0, 10);
  }, [rawSuggestions, cart]);

  // order (unchanged logic)
  const handleOrder = async () => {
    if (isPrescriptionFlow && prescriptionOrder) {
      setLoading(true);
      try {
        await axios.post(
          `${API_BASE_URL}/api/prescriptions/respond/${prescriptionOrder._id}`,
          { response: "accepted" },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        await axios.put(
          `${API_BASE_URL}/api/prescriptions/${prescriptionOrder._id}/accept`,
          { paymentStatus: "PAID", paymentDetails: { method: "COD" } },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const res = await axios.post(
          `${API_BASE_URL}/api/prescriptions/${prescriptionOrder._id}/convert-to-order`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setToast({ type: "success", message: "Order placed! Track in My Orders." });
        setTimeout(() => navigate(`/order/${res.data?.orderId || ""}`), 1200);
      } catch (e) {
        setToast({ type: "error", message: "Failed to confirm order!" });
      }
      setLoading(false);
      return;
    }

    if (!user || !token) {
      setToast({ type: "error", message: "Please log in to place an order!" });
      setTimeout(() => navigate("/login"), 1200);
      return;
    }
    if (!cart.length)
      return setToast({ type: "error", message: "Your cart is empty." });
    if (!selectedPharmacy?._id)
      return setToast({ type: "error", message: "Please select a pharmacy." });

    const address =
      isPrescriptionFlow && lockedAddress
        ? lockedAddress
        : allAddresses.find((a) => a.id === selectedAddressId);
    if (!address)
      return setToast({
        type: "error",
        message: "Please select or add an address.",
      });

    if (paymentMethod === "cod") {
      await handlePlaceOrder(
        {
          cart,
          addresses,
          allAddresses,
          selectedAddressId,
          wantChemistInstruction,
          dosage,
          paymentMethod,
          selectedPharmacy,
          total: fullTotal,
          prescription,
          prescriptionPreview,
          instructions,
          coupon,
          tip,
          donate,
          deliveryInstructions,
          user,
          token,
          setToast,
          clearCart,
          setLoading,
          // NEW
          platformFee,
        },
        "COD",
        {},
        (order) => navigate(`/order/${order._id}`)
      );
      return;
    }

    // Razorpay flow
    setLoading(true);
    const rzpLoaded = await loadRazorpayScript(
      "https://checkout.razorpay.com/v1/checkout.js"
    );
    if (!rzpLoaded) {
      setToast({
        type: "error",
        message: "Razorpay SDK failed to load. Try again.",
      });
      setLoading(false);
      return;
    }
    let orderBackend;
    try {
      orderBackend = await axios.post(
        `${API_BASE_URL}/api/payments/razorpay/order`,
        {
          amount: Math.round(fullTotal * 100),
          currency: "INR",
          receipt: "order_rcptid_" + Date.now(),
        }
      );
    } catch (err) {
      setToast({
        type: "error",
        message: "Failed to create Razorpay order. Try again.",
      });
      setLoading(false);
      return;
    }

    const options = {
      key: "rzp_test_GAXFOxUCCrxVvr", // replace for LIVE
      amount: orderBackend.data.amount,
      currency: "INR",
      name: "GoDavaii - Medicine Delivery",
      description: "Order Payment",
      order_id: orderBackend.data.id,
      handler: async (response) => {
        await handlePlaceOrder(
          {
            cart,
            addresses,
            allAddresses,
            selectedAddressId,
            wantChemistInstruction,
            dosage,
            paymentMethod,
            selectedPharmacy,
            total: fullTotal,
            prescription,
            prescriptionPreview,
            instructions,
            coupon,
            tip,
            donate,
            deliveryInstructions,
            user,
            token,
            setToast,
            clearCart,
            setLoading,
            // NEW
            platformFee,
          },
          "PAID",
          response,
          (order) => navigate(`/order/${order._id}`)
        );
      },
      prefill: {
        name: user?.name,
        email: user?.email,
        contact: addresses[0]?.phone || "",
      },
      theme: { color: DEEP },
      modal: { ondismiss: () => setLoading(false) },
    };
    setLoading(false);
    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  // ------------- UI -------------
  if (!cart.length && !isPrescriptionFlow) {
    return (
      <div className="min-h-screen bg-white max-w-md mx-auto pt-16 text-center">
        <IndianRupee className="w-14 h-14 mx-auto mb-3" style={{ color: DEEP }} />
        <div className="text-xl font-extrabold" style={{ color: DEEP }}>
          No items in cart
        </div>
        <Button
          className="mt-4 font-extrabold rounded-full hover:brightness-105 text-white"
          style={{ backgroundColor: DEEP }}
          onClick={() => navigate("/medicines")}
        >
          Browse Medicines
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto mt-3 mb-24 px-3">
      {/* Medicines summary */}
      <Card
        className="mb-3 shadow-lg rounded-2xl"
        style={{ border: "1px solid rgba(15,110,81,0.12)" }}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] font-extrabold" style={{ color: DEEP }}>
            {isPrescriptionFlow ? "Prescription Quote" : "Medicines in your order"}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {(isPrescriptionFlow ? quoteItems : cart).map((med, idx) => (
              <motion.div
                key={med._id || idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between gap-3 border-b last:border-b-0 pb-3"
                style={{ borderColor: "rgba(15,110,81,0.10)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold text-zinc-900 truncate">
                    {med.name || med.medicineName}
                  </div>
                  {med.brand && (
                    <div className="text-[12px] font-semibold" style={{ color: DEEP }}>
                      {med.brand}
                    </div>
                  )}
                  <div className="text-[13px] text-zinc-500">
                    ₹{med.price} × {med.quantity}
                  </div>
                </div>

                {!isPrescriptionFlow && (
                  <div className="flex items-center gap-1.5">
  {/* Minus: if qty==1, remove the item */}
  <Button
    variant="outline"
    size="icon"
    className="h-8 w-8 rounded-full hover:bg-gray-50"
    style={{
      borderColor: med.quantity === 1 ? "rgba(239,68,68,0.40)" : "rgba(15,110,81,0.40)",
      background: med.quantity === 1 ? "rgba(239,68,68,0.06)" : "rgba(15,110,81,0.06)",
      color: med.quantity === 1 ? "#dc2626" : DEEP,
    }}
    onClick={() => {
      if (med.quantity === 1) {
        if (window.confirm("Remove this item?")) removeItemCompletely(med);
      } else {
        removeOneFromCart(med);
      }
    }}
    aria-label={med.quantity === 1 ? "Remove item" : "Decrease quantity"}
    title={med.quantity === 1 ? "Remove item" : "Decrease quantity"}
  >
    <Minus className="h-4 w-4" />
  </Button>

  <div className="w-6 text-center font-extrabold" style={{ color: DEEP }}>
    {med.quantity}
  </div>

  <Button
    variant="outline"
    size="icon"
    className="h-8 w-8 rounded-full hover:bg-gray-50"
    style={{
      borderColor: "rgba(15,110,81,0.40)",
      background: "rgba(15,110,81,0.06)",
      color: DEEP,
    }}
    onClick={() => addToCart(med)}
    aria-label="Increase quantity"
    title="Increase quantity"
  >
    <Plus className="h-4 w-4" />
  </Button>

  {/* Explicit Remove button (optional but handy) */}
  <Button
    variant="ghost"
    size="sm"
    className="h-8 px-2 text-red-600 hover:text-red-700"
    onClick={() => {
      if (window.confirm("Remove this item?")) removeItemCompletely(med);
    }}
    aria-label="Remove item"
    title="Remove item"
  >
    <Trash2 className="h-4 w-4" />
  </Button>
</div>

                )}

                <div className="text-[15px] font-extrabold min-w-[64px] text-right" style={{ color: DEEP }}>
                  = ₹{(med.price || 0) * (med.quantity || 1)}
                </div>
              </motion.div>
            ))}
          </div>

          {isPrescriptionFlow && (
            <div className="mt-3">
              <Separator style={{ background: "rgba(15,110,81,0.12)" }} />
              <div className="mt-2 text-sm font-medium" style={{ color: DEEP }}>
                {quoteMessage}
              </div>
              <div className="mt-1 text-right font-black" style={{ color: DEEP }}>
                Quoted Total: ₹{quoteTotal}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Smart Suggestions (same store) */}
      {!isPrescriptionFlow && suggestions.length > 0 && (
        <Card className="mb-3 rounded-2xl" style={{ border: "1px solid rgba(15,110,81,0.12)" }}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2" style={{ color: DEEP }}>
              <Sparkles className="h-4 w-4" />
              Smart Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-2 overflow-x-auto py-2">
              {suggestions.map((sug) => (
                <div
                  key={sug._id}
                  className="min-w-[180px] rounded-xl border p-3 shrink-0 bg-white"
                  style={{ borderColor: "rgba(15,110,81,0.20)" }}
                >
                  <div className="text-[14px] font-semibold line-clamp-2">
                    {sug.name || sug.medicineName}
                  </div>
                  {sug.brand && (
                    <div className="text-[12px] text-zinc-500">{sug.brand}</div>
                  )}
                  <div className="mt-1 font-bold" style={{ color: DEEP }}>
                    ₹{sug.price}
                  </div>
                  <Button
                    size="sm"
                    className="mt-2 w-full rounded-full text-white hover:brightness-105"
                    style={{ backgroundColor: DEEP }}
                    onClick={() =>
                      addToCart({
                        ...sug,
                        pharmacy: selectedPharmacy._id,
                        pharmacyId: selectedPharmacy._id,
                        quantity: 1,
                      })
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {suggestionsLoading && !isPrescriptionFlow && (
        <Card className="mb-3 rounded-2xl" style={{ border: "1px solid rgba(15,110,81,0.12)" }}>
          <CardContent>
            <div className="text-sm text-zinc-500">Finding suggestions…</div>
          </CardContent>
        </Card>
      )}

      {/* Address */}
      {isPrescriptionFlow && lockedAddress ? (
        <Card className="mb-3 rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 text-zinc-100">
          <CardHeader className="pb-2">
            <CardTitle className="" style={{ color: "#e3f3ed" }}>
              Delivery Address (locked)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold">{lockedAddress.name}</div>
            <div className="text-sm text-zinc-300">{lockedAddress.phone}</div>
            <div className="text-sm text-zinc-300">
              {lockedAddress.addressLine}
              {lockedAddress.floor && `, Floor: ${lockedAddress.floor}`}
              {lockedAddress.landmark && `, ${lockedAddress.landmark}`}
            </div>
            <div className="text-xs text-zinc-400 italic mt-1">
              You can’t change address for prescription orders
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="mb-3">
          <AddressSelector
            addresses={allAddresses}
            selectedAddressId={selectedAddressId}
            onSelect={setSelectedAddressId}
            onAddAddress={() => setAddressFormOpen(true)}
            onEdit={() => setAddressFormOpen(true)}
            onDelete={handleDeleteAddress}
          />
          <AddressForm
            open={addressFormOpen}
            onClose={() => setAddressFormOpen(false)}
            onSave={handleSaveAddress}
            initial={
              allAddresses.find((a) => a.id === selectedAddressId) || {}
            }
          />
        </div>
      )}

      {/* Dosage + prescription */}
      <Card className="mb-3 rounded-2xl" style={{ border: "1px solid rgba(15,110,81,0.12)" }}>
        <CardContent>
          <label className="mt-2 flex items-center gap-3 text-[15px] leading-tight">
            <input
              type="checkbox"
              className="h-5 w-5 rounded"
              style={{ accentColor: DEEP }}
              checked={wantChemistInstruction}
              onChange={(e) => setWantChemistInstruction(e.target.checked)}
            />
            <span className="font-medium">
              Do you want <b>dosage instruction from chemist?</b>
            </span>
          </label>

          {!wantChemistInstruction && (
            <div className="mt-3">
              <Label className="text-[13px] font-semibold text-zinc-700">
                Dosage instructions (optional)
              </Label>
              <Textarea
                rows={2}
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="E.g., 1 tablet after lunch, as prescribed, etc."
                className="mt-1 h-[56px] min-h-[56px] resize-none rounded-lg px-3 py-2 text-[15px] leading-[1.35] placeholder:text-zinc-400"
                style={{ outlineColor: DEEP }}
              />
            </div>
          )}

          <div className="mt-4">
            <div className="text-sm font-bold mb-2">Prescription (if needed)</div>
            <Button
  variant="outline"
  onClick={() => prescriptionInput.current?.click()}
  className="rounded-full hover:brightness-105"
  style={{
    borderColor: "rgba(15,110,81,0.40)",
    color: DEEP,
    background: "rgba(15,110,81,0.06)",
  }}
>
  <Upload className="h-4 w-4 mr-2" />
  <span className="font-extrabold">
    {prescription ? "Change File" : "Upload Prescription"}
  </span>
</Button>


            <input
              ref={prescriptionInput}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handlePrescriptionChange}
            />
            {prescriptionPreview && (
              <img
                src={prescriptionPreview}
                alt="Prescription"
                className="mt-3 max-w-[200px] rounded-xl border"
                style={{ borderColor: "rgba(15,110,81,0.20)" }}
              />
            )}
          </div>

          <div className="mt-4">
            <Label className="text-[13px] font-semibold text-zinc-700">
              Instructions for chemist (optional)
            </Label>
            <Textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Any note for your order or delivery..."
              className="mt-1 h-[56px] min-h-[56px] resize-none rounded-lg px-3 py-2 text-[15px] leading-[1.35] placeholder:text-zinc-400"
              style={{ outlineColor: DEEP }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bill summary */}
      <Card className="mb-3 rounded-2xl" style={{ border: "1px solid rgba(15,110,81,0.12)" }}>
        <CardHeader className="pb-2">
          <CardTitle style={{ color: DEEP }}>Bill Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
            {toFree > 0 && (
  <div
    className="mb-2 rounded-xl p-2"
    style={{ background: "rgba(15,110,81,0.06)", border: "1px solid rgba(15,110,81,0.18)" }}
  >
    <div className="text-[13px] font-semibold mb-2" style={{ color: DEEP }}>
      Add ₹{toFree} more to get <span>FREE delivery</span>
    </div>

    {/* Progress line */}
    <div
      className="relative h-2 w-full rounded-full overflow-hidden"
      style={{ background: "rgba(15,110,81,0.15)" }}
      role="progressbar"
      aria-valuenow={Math.round(progressToFree)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${progressToFree}%`,
          background:
            "linear-gradient(90deg, #3B82F6 0%, #10B981 60%, #A7F3D0 100%)",
        }}
      />
    </div>
  </div>
)}


            <div className="flex justify-between text-sm">
  <span className="font-semibold text-zinc-800">Item total</span>
  <span className="font-semibold text-zinc-800 tabular-nums">₹{itemTotal}</span>
</div>

<div className="flex justify-between text-sm">
  <span className="font-semibold text-zinc-800">Delivery Fee</span>
  <span className="font-semibold tabular-nums">
    {deliveryFee === 0 ? <span className="text-emerald-700">Free</span> : `₹${deliveryFee}`}
  </span>
</div>

<div className="flex justify-between text-sm">
  <span className="font-semibold text-zinc-800">Platform Fee</span>
  <span className="font-semibold text-zinc-800 tabular-nums">₹{platformFee}</span>
</div>

            {tip > 0 && (
  <div className="flex justify-between font-semibold" style={{ color: DEEP }}>
    <span>Delivery Tip</span>
    <span className="tabular-nums">+₹{tip}</span>
  </div>
)}
{donate && (
  <div className="flex justify-between font-semibold" style={{ color: DEEP }}>
    <span>Donation</span>
    <span className="tabular-nums">+₹3</span>
  </div>
)}
{discount > 0 && (
  <div className="flex justify-between font-semibold" style={{ color: DEEP }}>
    <span>Coupon Discount</span>
    <span className="tabular-nums">−₹{discount}</span>
  </div>
)}

            <Separator className="my-2" />
            <div className="flex justify-between font-black text-base" style={{ color: DEEP }}>
              <span>Grand Total</span>
              <span>₹{fullTotal}</span>
            </div>
          </div>

          {/* Coupon */}
          <div className="mt-3">
            <div
              className="flex items-start gap-2 p-3 rounded-xl"
              style={{ border: "1px solid rgba(15,110,81,0.18)", background: "rgba(15,110,81,0.06)" }}
            >
              <div className="shrink-0 mt-0.5">
                <Tag className="w-4 h-4" style={{ color: DEEP }} />
              </div>
              <div className="flex-1 text-[13px] leading-5">
                <span className="font-semibold" style={{ color: DEEP }}>
                  Flat 10% off
                </span>{" "}
                on this order. Use code <span className="font-bold">GODAVAII10</span>.
              </div>
              {!couponApplied ? (
                <Button
                  size="sm"
                  className="rounded-full text-white hover:brightness-105"
                  style={{ backgroundColor: DEEP }}
                  onClick={() => {
                    setCoupon("GODAVAII10");
                    setCouponApplied(true);
                  }}
                >
                  Apply
                </Button>
              ) : (
                <span
                  className="text-xs font-semibold px-2 py-1 rounded-full border"
                  style={{ background: "rgba(15,110,81,0.08)", color: DEEP, borderColor: "rgba(15,110,81,0.25)" }}
                >
                  Applied
                </span>
              )}
            </div>

            {couponApplied && (
              <div className="mt-2 flex items-center gap-2">
                <Input
  value="GODAVAII10"
  disabled
  className="font-extrabold tracking-wide disabled:opacity-100 disabled:bg-white disabled:text-emerald-700"
  style={{ color: DEEP }}
/>

<Button
  variant="outline"
  onClick={() => { setCoupon(""); setCouponApplied(false); }}
  className="rounded-full font-semibold"
  size="sm"
  style={{ borderColor: "rgba(15,110,81,0.40)", color: DEEP }}
>
  Remove
</Button>

              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delivery partner instructions */}
      <Card className="mb-3 rounded-2xl" style={{ border: "1px solid rgba(15,110,81,0.12)" }}>
        <CardContent>
          <Label className="text-[13px] font-semibold text-zinc-700">
            Instructions for Delivery Partner (optional)
          </Label>
          <Textarea
            rows={2}
            value={deliveryInstructions}
            onChange={(e) => setDeliveryInstructions(e.target.value)}
            placeholder="Any note for your delivery partner..."
            className="mt-1 h-[56px] min-h-[56px] resize-none rounded-lg px-3 py-2 text-[15px] leading-[1.35] placeholder:text-zinc-400"
            style={{ outlineColor: DEEP }}
          />
        </CardContent>
      </Card>

      {/* Tip + donate */}
      <Card className="mb-3 rounded-2xl" style={{ border: "1px solid rgba(15,110,81,0.12)" }}>
        <CardHeader className="pb-2">
          <CardTitle style={{ color: DEEP }}>Add a Delivery Tip</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {tipAmounts.map((amount) => (
              <Button
                key={amount}
                variant={tip === amount ? "default" : "outline"}
                className="rounded-full"
                style={
                  tip === amount
                    ? { backgroundColor: DEEP, color: "#fff" }
                    : { borderColor: DEEP, color: DEEP }
                }
                onClick={() => setTip(amount)}
              >
                ₹{amount}
              </Button>
            ))}
            <Button
              variant={tip && !tipAmounts.includes(tip) ? "default" : "outline"}
              className="rounded-full"
              style={
                tip && !tipAmounts.includes(tip)
                  ? { backgroundColor: DEEP, color: "#fff" }
                  : { borderColor: DEEP, color: DEEP }
              }
              onClick={() => {
                const amt = prompt("Enter custom tip amount:");
                const value = parseInt(amt || "");
                if (!isNaN(value) && value > 0) setTip(value);
              }}
            >
              Other
            </Button>
            <Button variant="ghost" className="text-red-500" onClick={() => setTip(0)}>
              No Tip
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment */}
      <Card className="rounded-2xl" style={{ border: "1px solid rgba(15,110,81,0.12)" }}>
        <CardHeader className="pb-2">
          <CardTitle style={{ color: DEEP }}>Pay Using</CardTitle>
        </CardHeader>
        <CardContent>
          <fieldset>
            <legend className="sr-only">Payment method</legend>
            <div className="grid grid-cols-1 gap-2">
  {paymentOptions.map((opt) => {
    const selected = paymentMethod === opt.value;
    return (
      <label key={opt.value} htmlFor={`pay-${opt.value}`} className="block">
        <input
          id={`pay-${opt.value}`}
          type="radio"
          name="payment"
          value={opt.value}
          checked={selected}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="sr-only"
        />

        {/* Gradient border wrapper */}
        <motion.div
          layout
          whileTap={{ scale: 0.98 }}
          className={[
            "rounded-2xl p-[2px] transition-all",
            selected
              ? "bg-[linear-gradient(120deg,#0f6e51,rgba(21,179,146,0.9))] shadow-[0_10px_24px_rgba(15,110,81,0.18)]"
              : "bg-zinc-200/60 hover:bg-zinc-300/60"
          ].join(" ")}
        >
          {/* Inner card */}
          <div
            className={[
              "flex items-center justify-between rounded-[14px] p-3 transition-colors",
              selected
                ? "bg-white/80 backdrop-blur ring-1 ring-black/5"
                : "bg-white"
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              {/* Custom radio */}
              <span
                className={[
                  "relative grid place-items-center h-5 w-5 rounded-full border transition-all",
                  selected ? "border-emerald-600" : "border-zinc-400"
                ].join(" ")}
              >
                {selected && (
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                )}
              </span>

              <span
                className={[
                  "text-sm transition-colors",
                  selected ? "font-semibold text-zinc-900" : "text-zinc-700"
                ].join(" ")}
              >
                {opt.label}
              </span>
            </div>

            {/* “Selected” badge */}
            {selected && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                <Check className="h-3.5 w-3.5" />
                Selected
              </span>
            )}
          </div>
        </motion.div>
      </label>
    );
  })}
</div>
          </fieldset>

          <Button
            disabled={loading}
            onClick={handleOrder}
            className="w-full mt-3 rounded-full !font-extrabold !text-white tracking-wide hover:brightness-105"
            style={{ backgroundColor: DEEP }}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...
              </>
            ) : isPrescriptionFlow ? (
              `Accept Quote & Pay ₹${fullTotal}`
            ) : (
              `PAY ₹${fullTotal} & PLACE ORDER`
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Toast */}
      <AnimatePresence>
        {toast && toast.type === "error" && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[2000] px-3 py-2 rounded-full shadow-lg text-white bg-red-500"
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
