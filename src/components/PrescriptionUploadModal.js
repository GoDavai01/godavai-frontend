"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  AlertCircle,
  Home,
  Edit,
  Trash2,
  Plus,
  UploadCloud,
  Loader2,
  CheckCircle,
  Camera,
  FileText,
  X,
} from "lucide-react";
import AddressForm from "./AddressForm";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0f6e51";

const MAX_FILES = 10;
const MAX_SIZE_MB = 20;

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeBasketItem = (item = {}) => {
  const medicineName = String(item?.medicineName || item?.name || "").trim();
  if (!medicineName) return null;
  return {
    medicineName,
    composition: String(item?.composition || ""),
    strength: String(item?.strength || ""),
    form: String(item?.form || ""),
    quantity: Math.max(1, Math.round(asNumber(item?.quantity, 1))),
    confidence: Math.max(0, Math.min(1, asNumber(item?.confidence, 0.5))),
    source: item?.source || "prescription",
    matchType: item?.matchType || "unclear",
    medicineMasterId: item?.medicineMasterId || null,
    medicineId: item?.medicineId || null,
    available: item?.available !== false,
    estimatedPrice: asNumber(item?.estimatedPrice, 0),
  };
};

const statusNeedsReview = (status = "") =>
  [
    "review_required",
    "admin_review_required",
    "user_reviewed",
    "chemist_routing_pending",
    "chemist_notified",
  ].includes(String(status));

export default function PrescriptionUploadModal({
  open,
  onClose,
  userCity = "Delhi",
  userArea = "",
  afterOrder,
  initialMode,
  initialNotes,
  initialFileUrl,
  initialAddress,
}) {
  const fileInputRef = useRef();
  const cameraInputRef = useRef();
  const pollRef = useRef(null);

  const { addresses, updateAddresses } = useAuth();
  const { cart = [] } = useCart();

  const [selectedAddressId, setSelectedAddressId] = useState(addresses[0]?.id || null);
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  const [step, setStep] = useState("form"); // form -> parsing -> review -> final

  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);

  const [reviewItems, setReviewItems] = useState([]);
  const [reviewNote, setReviewNote] = useState("");
  const [budgetGuard, setBudgetGuard] = useState({
    enabled: false,
    autoApproveBelow: "",
    askAbove: "",
    noCallUnlessImportant: true,
  });

  const [finalSubmitting, setFinalSubmitting] = useState(false);
  const [finalResult, setFinalResult] = useState({
    routed: false,
    queuedForAdmin: false,
  });

  const [uploadType, setUploadType] = useState("auto");
  const [notes, setNotes] = useState("");
  const [pharmacyList, setPharmacyList] = useState([]);
  const [pharmacyLoading, setPharmacyLoading] = useState(false);
  const [selectedPharmacy, setSelectedPharmacy] = useState("");
  const [phOpen, setPhOpen] = useState(false);

  const groupedReview = useMemo(() => {
    const exact = [];
    const probable = [];
    const unclear = [];
    for (const item of reviewItems) {
      const row = normalizeBasketItem(item);
      if (!row) continue;
      if (row.matchType === "exact") exact.push(row);
      else if (row.matchType === "probable") probable.push(row);
      else unclear.push(row);
    }
    return { exact, probable, unclear };
  }, [reviewItems]);

  const estimatedRange = useMemo(() => {
    const min = asNumber(order?.estimatedPricing?.minTotal, 0);
    const max = asNumber(order?.estimatedPricing?.maxTotal, 0);
    if (!min && !max) return "";
    if (min && max && max >= min) return `Estimated total: Rs.${min} - Rs.${max}`;
    return `Estimated total: Rs.${min || max}`;
  }, [order]);

  useEffect(() => {
    if (!open) return;
    if (initialMode) setUploadType(initialMode);
    if (initialNotes !== undefined) setNotes(initialNotes);
    if (initialAddress?.id) setSelectedAddressId(initialAddress.id);
    if (initialFileUrl) {
      setPreviews([{ url: initialFileUrl, isPdf: /\.pdf(\?|$)/i.test(initialFileUrl), name: "existing", size: 0 }]);
      setFiles([]);
    }
  }, [open, initialMode, initialNotes, initialFileUrl, initialAddress]);

  useEffect(() => {
    if (!selectedAddressId && addresses.length > 0) setSelectedAddressId(addresses[0].id);
  }, [addresses, selectedAddressId]);

  useEffect(() => {
    if (!phOpen) return;
    const onDown = (e) => {
      if (!e.target.closest?.('[data-pharmacy-dropdown="true"]')) setPhOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [phOpen]);

  useEffect(() => {
    if (step !== "parsing" || !order?._id) return undefined;
    const token = localStorage.getItem("token");

    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/prescriptions/order/${order._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const fresh = res.data;
        setOrder(fresh);

        if (String(fresh?.status || "") === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setError("Could not parse this prescription. Please try again.");
          setStep("form");
          return;
        }

        if (statusNeedsReview(fresh?.status)) {
          const basket = Array.isArray(fresh?.parsedBasket) ? fresh.parsedBasket : [];
          setReviewItems(basket.map((item) => normalizeBasketItem(item)).filter(Boolean));
          if (fresh?.budgetGuard) {
            setBudgetGuard({
              enabled: !!fresh.budgetGuard.enabled,
              autoApproveBelow: fresh.budgetGuard.autoApproveBelow || "",
              askAbove: fresh.budgetGuard.askAbove || "",
              noCallUnlessImportant: !!fresh.budgetGuard.noCallUnlessImportant,
            });
          }
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setStep("review");
        }
      } catch {
        // Ignore transient poll errors.
      }
    }, 2500);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [step, order?._id]);
  useEffect(() => {
    if (open && uploadType === "manual") {
      setPharmacyLoading(true);
      const addr = addresses.find((a) => a.id === selectedAddressId);
      if (addr && addr.lat && addr.lng) {
        axios
          .get(
            `${API_BASE_URL}/api/pharmacies/nearby?lat=${addr.lat}&lng=${addr.lng}&maxDistance=15000&rxOnly=1&excludeBusy=1`
          )
          .then((res) => setPharmacyList(Array.isArray(res.data) ? res.data : []))
          .catch(() => setPharmacyList([]))
          .finally(() => setPharmacyLoading(false));
      } else {
        setPharmacyList([]);
        setPharmacyLoading(false);
      }
    }

    if (!open || uploadType !== "manual") {
      setPharmacyList([]);
      setSelectedPharmacy("");
    }
  }, [open, uploadType, addresses, selectedAddressId]);

  const addFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return;

    const incoming = Array.from(fileList);
    const currentCount = files.length + previews.filter((p) => p.name === "existing").length;
    const spaceLeft = MAX_FILES - currentCount;
    const toAdd = incoming.slice(0, Math.max(0, spaceLeft));

    const oversized = toAdd.find((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (oversized) {
      setError(`Each file must be <= ${MAX_SIZE_MB}MB.`);
      return;
    }

    const newPreviews = toAdd.map((f) => ({
      url: f.type?.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      isPdf: f.type === "application/pdf" || /\.pdf$/i.test(f.name),
      name: f.name,
      size: f.size,
    }));

    setFiles((prev) => [...prev, ...toAdd]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeAttachment = (idx) => {
    const current = previews[idx];
    if (current?.url && current.name !== "existing") {
      URL.revokeObjectURL(current.url);
    }

    if (current?.name === "existing") {
      setPreviews((prev) => prev.filter((_, i) => i !== idx));
      return;
    }

    const nonExistingIndices = previews
      .map((p, i) => ({ i, existing: p.name === "existing" }))
      .filter((x) => !x.existing)
      .map((x) => x.i);

    const nonExistingIdx = nonExistingIndices.indexOf(idx);
    if (nonExistingIdx >= 0) {
      setFiles((prev) => prev.filter((_, i) => i !== nonExistingIdx));
    }
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleCameraClick = () => cameraInputRef.current?.click();

  const sanitizeNotes = (str = "") => str.replace(/\d{10,}/g, "[blocked]");

  const handleSaveAddress = async (addr) => {
    let updated;
    if (addr.id && addresses.some((a) => a.id === addr.id)) {
      updated = addresses.map((a) => (a.id === addr.id ? addr : a));
    } else {
      addr.id = Date.now().toString();
      updated = [...addresses, addr];
    }
    await updateAddresses(updated);
    setSelectedAddressId(addr.id);
    setAddressFormOpen(false);
    setEditingAddress(null);
  };

  const handleDeleteAddress = async (addr) => {
    if (!window.confirm("Are you sure you want to delete this address?")) return;
    const updated = addresses.filter((a) => a.id !== addr.id);
    await updateAddresses(updated);
    if (selectedAddressId === addr.id && updated.length) {
      setSelectedAddressId(updated[0].id);
    } else if (updated.length === 0) {
      setSelectedAddressId(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAddressId) return setError("Please select or add a delivery address.");
    if (files.length === 0 && previews.filter((p) => p.name === "existing").length === 0) {
      return setError("Add at least one photo or PDF.");
    }
    if (uploadType === "manual" && !selectedPharmacy) return setError("Select a pharmacy.");
    if (/\d{10,}/.test(notes)) return setError("Mobile numbers are not allowed in notes.");

    const addr = addresses.find((a) => a.id === selectedAddressId);
    if (!addr || !addr.lat || !addr.lng) {
      return setError(uploadType === "manual"
        ? "Please select a delivery address with location pin."
        : "Please select an address using the map pin.");
    }

    setError("");
    setStep("parsing");

    try {
      const token = localStorage.getItem("token");
      const existingUrls = previews
        .filter((p) => p.name === "existing" && p.url)
        .map((p) => p.url);

      const uploadedUrls = [];
      for (const f of files) {
        const data = new FormData();
        data.append("prescription", f);
        // eslint-disable-next-line no-await-in-loop
        const uploadRes = await axios.post(`${API_BASE_URL}/api/prescriptions/upload`, data, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
        uploadedUrls.push(uploadRes.data.prescriptionUrl || uploadRes.data.url);
      }

      const allUrls = [...existingUrls, ...uploadedUrls];
      const primaryUrl = allUrls[0];

      const payload = {
        prescriptionUrl: primaryUrl,
        attachments: allUrls,
        city: userCity,
        area: userArea,
        notes: sanitizeNotes(notes),
        uploadType,
        chosenPharmacyId: uploadType === "manual" ? selectedPharmacy : undefined,
        address: addr || {},
        cartItems: (Array.isArray(cart) ? cart : [])
          .map((item) => ({
            _id: item?._id || item?.medicineId || item?.medicine_id || null,
            medicineId: item?.medicineId || item?._id || null,
            name: item?.name || item?.medicineName || "",
            composition: item?.composition || "",
            strength: item?.strength || "",
            form: item?.form || item?.type || "",
            quantity: Math.max(1, Math.round(asNumber(item?.quantity, 1))),
            price: asNumber(item?.price, 0),
          }))
          .filter((item) => item.name),
      };

      const orderRes = await axios.post(`${API_BASE_URL}/api/prescriptions/order`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const created = orderRes.data;
      setOrder(created);
      if (statusNeedsReview(created?.status)) {
        const basket = Array.isArray(created?.parsedBasket) ? created.parsedBasket : [];
        setReviewItems(basket.map((item) => normalizeBasketItem(item)).filter(Boolean));
        setStep("review");
      } else {
        setStep("parsing");
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to submit prescription. Please try again.");
      setStep("form");
    }
  };

  const updateReviewItem = (idx, patch) => {
    setReviewItems((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const removeReviewItem = (idx) => {
    setReviewItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleReviewSubmit = async () => {
    if (!order?._id) return;
    if (!reviewItems.length) {
      setError("Please keep at least one medicine before continuing.");
      return;
    }

    setError("");
    setFinalSubmitting(true);
    setStep("final");

    try {
      const token = localStorage.getItem("token");
      const payload = {
        items: reviewItems,
        notes: sanitizeNotes(reviewNote),
        budgetGuard: {
          enabled: !!budgetGuard.enabled,
          autoApproveBelow: asNumber(budgetGuard.autoApproveBelow, 0),
          askAbove: asNumber(budgetGuard.askAbove, 0),
          noCallUnlessImportant: !!budgetGuard.noCallUnlessImportant,
        },
      };
      const res = await axios.put(`${API_BASE_URL}/api/prescriptions/review/${order._id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const fresh = res?.data?.order || order;
      setOrder(fresh);
      setFinalResult({
        routed: !!res?.data?.routed,
        queuedForAdmin: !!res?.data?.queuedForAdmin,
      });
      afterOrder?.(fresh);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to continue.");
      setStep("review");
    } finally {
      setFinalSubmitting(false);
    }
  };

  const resetLocalState = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    previews.forEach((p) => {
      if (p?.url && p.name !== "existing") URL.revokeObjectURL(p.url);
    });
    setStep("form");
    setFiles([]);
    setPreviews([]);
    setError("");
    setOrder(null);
    setReviewItems([]);
    setReviewNote("");
    setBudgetGuard({
      enabled: false,
      autoApproveBelow: "",
      askAbove: "",
      noCallUnlessImportant: true,
    });
    setFinalSubmitting(false);
    setFinalResult({ routed: false, queuedForAdmin: false });
    setNotes("");
    setUploadType("auto");
    setPharmacyList([]);
    setSelectedPharmacy("");
    setAddressFormOpen(false);
    setSelectedAddressId(addresses[0]?.id || null);
    setEditingAddress(null);
  };

  const handleClose = () => {
    resetLocalState();
    onClose();
  };
  const renderReviewList = (title, items, badgeTone) => (
    <div className="rounded-xl border p-3" style={{ borderColor: `${DEEP}22` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold" style={{ color: "#0b3f30" }}>{title}</div>
        <Badge
          className="text-white"
          style={{
            backgroundColor:
              badgeTone === "exact" ? "#15803d" : badgeTone === "probable" ? "#ca8a04" : "#b45309",
          }}
        >
          {items.length}
        </Badge>
      </div>
      {items.length === 0 && (
        <div className="text-xs" style={{ color: "#0b3f3099" }}>
          No items in this section.
        </div>
      )}
      {items.map((item, idx) => {
        const absoluteIndex = reviewItems.findIndex(
          (row) =>
            row.medicineName === item.medicineName &&
            row.form === item.form &&
            row.strength === item.strength &&
            row.quantity === item.quantity
        );
        const key = `${title}-${item.medicineName}-${idx}`;
        return (
          <div key={key} className="border rounded-lg p-2 mb-2 last:mb-0" style={{ borderColor: `${DEEP}1f` }}>
            <div className="text-sm font-semibold" style={{ color: "#0b3f30" }}>
              {item.medicineName}
            </div>
            <div className="text-xs mb-2" style={{ color: "#0b3f3099" }}>
              {[item.strength, item.form].filter(Boolean).join(" | ") || "Details unavailable"}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) =>
                  updateReviewItem(absoluteIndex, {
                    quantity: Math.max(1, Math.round(asNumber(e.target.value, 1))),
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                className="text-red-600 hover:bg-red-50"
                onClick={() => removeReviewItem(absoluteIndex)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Remove
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          className="!p-0 !max-w-sm w-full rounded-3xl flex flex-col"
          style={{
            maxHeight: "100vh",
            background: "#fff",
            boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <DialogHeader className="p-5 pb-3 flex-shrink-0 bg-white z-10 rounded-t-3xl border-b">
            <DialogTitle className="text-xl font-extrabold tracking-tight" style={{ color: DEEP }}>
              {step === "review" ? "Review Medicines" : "Upload Prescription"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 px-4 pt-3 pb-2 overflow-y-auto" style={{ minHeight: 180 }}>
            {step === "form" && (
              <div className="flex flex-col gap-4">
                <div>
                  <div className="font-bold mb-1" style={{ color: DEEP }}>Delivery Address</div>

                  {addresses.length === 0 ? (
                    <Button
                      className="w-full font-bold text-white"
                      style={{ backgroundColor: DEEP }}
                      onClick={() => {
                        setEditingAddress(null);
                        setAddressFormOpen(true);
                      }}
                    >
                      <Plus className="w-5 h-5 mr-2" /> Add New Address
                    </Button>
                  ) : (
                    addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="rounded-xl bg-white border shadow-sm p-3 mb-2 flex flex-col gap-2 cursor-pointer"
                        style={{
                          borderColor: selectedAddressId === addr.id ? DEEP : `${DEEP}22`,
                          boxShadow: selectedAddressId === addr.id ? "0 0 0 2px rgba(15,110,81,.15)" : undefined,
                        }}
                        onClick={() => setSelectedAddressId(addr.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Badge className="px-2 py-0.5 text-white" style={{ backgroundColor: DEEP }}>
                            <Home className="w-4 h-4 mr-1 text-white" />
                            {addr.type || "Current"}
                          </Badge>
                          <span className="font-bold text-base" style={{ color: "#0b3f30" }}>{addr.name}</span>
                        </div>
                        <div className="text-xs" style={{ color: "#0b3f3099" }}>{addr.addressLine}</div>
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="hover:bg-gray-50"
                            style={{ color: DEEP }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingAddress(addr);
                              setAddressFormOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-1" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAddress(addr);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-1" /> Delete
                          </Button>
                        </div>
                      </div>
                    ))
                  )}

                  {addresses.length > 0 && (
                    <Button
                      className="w-full mb-1 font-bold text-white"
                      style={{ backgroundColor: DEEP }}
                      onClick={() => {
                        setEditingAddress(null);
                        setAddressFormOpen(true);
                      }}
                    >
                      <Plus className="w-5 h-5 mr-2" /> Add New Address
                    </Button>
                  )}

                  <AddressForm
                    open={addressFormOpen}
                    onClose={() => {
                      setAddressFormOpen(false);
                      setEditingAddress(null);
                    }}
                    onSave={handleSaveAddress}
                    initial={editingAddress || addresses.find((a) => a.id === selectedAddressId) || {}}
                    modalZIndex={3300}
                  />
                </div>

                <div className="flex gap-2 justify-center mt-1 mb-1">
                  <button
                    type="button"
                    onClick={() => setUploadType("auto")}
                    aria-pressed={uploadType === "auto"}
                    className={`flex-1 rounded-lg px-3 py-3 font-semibold transition-all border ${
                      uploadType === "auto" ? "text-white" : "text-[#0b3f30]"
                    }`}
                    style={{
                      background: uploadType === "auto" ? DEEP : "#fff",
                      borderColor: uploadType === "auto" ? DEEP : `${DEEP}33`,
                      boxShadow: uploadType === "auto" ? "0 0 0 3px rgba(15,110,81,0.15)" : "none",
                    }}
                  >
                    <div className="font-bold">AI-first auto routing</div>
                    <div className="block text-xs mt-1" style={{ color: uploadType === "auto" ? "rgba(255,255,255,.9)" : "#0b3f3099" }}>
                      Recommended for fastest confirmation
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUploadType("manual")}
                    aria-pressed={uploadType === "manual"}
                    className={`flex-1 rounded-lg px-3 py-3 font-semibold transition-all border ${
                      uploadType === "manual" ? "text-white" : "text-[#0b3f30]"
                    }`}
                    style={{
                      background: uploadType === "manual" ? DEEP : "#fff",
                      borderColor: uploadType === "manual" ? DEEP : `${DEEP}33`,
                      boxShadow: uploadType === "manual" ? "0 0 0 3px rgba(15,110,81,0.15)" : "none",
                    }}
                  >
                    <div className="font-bold">Specific pharmacy</div>
                    <div className="block text-xs mt-1" style={{ color: uploadType === "manual" ? "rgba(255,255,255,.9)" : "#0b3f3099" }}>
                      Optional manual preference
                    </div>
                  </button>
                </div>

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    hidden
                    onChange={(e) => addFiles(e.target.files)}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={(e) => addFiles(e.target.files)}
                  />

                  <div className="flex gap-2">
                    <Button
                      className="flex-1 font-bold"
                      variant="outline"
                      onClick={handleUploadClick}
                      style={{ borderColor: `${DEEP}40`, color: "#0b3f30" }}
                    >
                      <UploadCloud className="w-5 h-5 mr-2" />
                      {previews.length ? "Add More" : "Choose Files"}
                    </Button>

                    <Button
                      className="flex-1 font-bold text-white"
                      onClick={handleCameraClick}
                      style={{ backgroundColor: DEEP }}
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Take Photo
                    </Button>
                  </div>

                  {!!previews.length && (
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {previews.map((p, idx) => (
                        <div
                          key={`${p.url || p.name}-${idx}`}
                          className="relative rounded-lg border shadow-sm overflow-hidden bg-white"
                          style={{ borderColor: `${DEEP}22` }}
                          title={p.name}
                        >
                          <button
                            type="button"
                            onClick={() => removeAttachment(idx)}
                            className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 shadow"
                            aria-label="Remove"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          {p.isPdf ? (
                            <div className="flex flex-col items-center justify-center h-20 text-xs text-[#0b3f30]">
                              <FileText className="w-7 h-7 mb-1" />
                              <span className="px-1 truncate w-full text-center">PDF</span>
                            </div>
                          ) : (
                            <img src={p.url} alt="Attachment" className="w-full h-20 object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Input
                  placeholder="Add a note for pharmacy"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.replace(/\d{10,}/g, ""))}
                  maxLength={120}
                  className="mt-1"
                  style={{ borderColor: `${DEEP}33` }}
                />

                {uploadType === "manual" && (
                  <div data-pharmacy-dropdown="true" style={{ position: "relative", zIndex: 50 }}>
                    <label className="block mb-1 text-sm font-semibold" style={{ color: DEEP }}>
                      Select a Pharmacy
                    </label>
                    <div
                      onClick={() => setPhOpen((v) => !v)}
                      className="w-full rounded-lg bg-white px-3 py-2 text-sm cursor-pointer flex items-center justify-between"
                      style={{ userSelect: "none", border: `1px solid ${DEEP}40` }}
                    >
                      <span className="truncate" style={{ color: "#0b3f30" }}>
                        {selectedPharmacy
                          ? (() => {
                              const ph = pharmacyList.find((p) => p._id === selectedPharmacy);
                              return ph ? `${ph.name} (${ph.area}, ${ph.city})` : "Select pharmacy...";
                            })()
                          : "Select pharmacy..."}
                      </span>
                      <span style={{ opacity: 0.6, color: "#0b3f30" }}>v</span>
                    </div>

                    {phOpen && (
                      <div
                        className="absolute left-0 right-0 mt-1 rounded-lg bg-white shadow-lg"
                        style={{ maxHeight: 200, overflowY: "auto", border: `1px solid ${DEEP}33` }}
                      >
                        {pharmacyLoading && (
                          <div className="px-3 py-2 text-sm" style={{ color: "#0b3f3099" }}>
                            Loading pharmacies...
                          </div>
                        )}
                        {!pharmacyLoading && pharmacyList.length === 0 && (
                          <div className="px-3 py-2 text-sm" style={{ color: "#0b3f3099" }}>
                            No pharmacies found within 15 km.
                          </div>
                        )}
                        {!pharmacyLoading &&
                          pharmacyList.map((ph) => (
                            <button
                              key={ph._id}
                              type="button"
                              onClick={() => {
                                setSelectedPharmacy(ph._id);
                                setPhOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                              style={{
                                whiteSpace: "nowrap",
                                color: "#0b3f30",
                                background: selectedPharmacy === ph._id ? "#f2fbf8" : "white",
                              }}
                            >
                              <span className="truncate inline-block max-w-full">
                                {ph.name} ({ph.area}, {ph.city})
                              </span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-1 text-sm font-semibold" style={{ color: "#0b3f30" }}>
                  Upload photos or PDF files. We will identify medicines and prepare your order.
                </div>
              </div>
            )}

            {step === "parsing" && (
              <div className="flex flex-col items-center gap-3 min-h-[140px] py-8">
                <Loader2 className="w-10 h-10 animate-spin" style={{ color: DEEP }} />
                <div className="font-semibold text-center" style={{ color: "#0b3f30" }}>
                  Preparing your prescription basket...
                </div>
                <div className="text-xs text-center" style={{ color: "#0b3f3099" }}>
                  AI is extracting medicines and matching catalog items.
                </div>
              </div>
            )}

            {step === "review" && (
              <div className="flex flex-col gap-3">
                <div className="text-sm font-semibold" style={{ color: "#0b3f30" }}>
                  We found these medicines from your prescription.
                </div>
                {estimatedRange && (
                  <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${DEEP}0A, ${DEEP}14)`, border: `1px solid ${DEEP}1A` }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontSize: 14 }}>💰</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DEEP }}>Estimated Total</span>
                    </div>
                    <div className="text-2xl font-bold" style={{ color: DEEP }}>
                      {order?.estimatedPricing?.minTotal && order?.estimatedPricing?.maxTotal
                        ? `₹${order.estimatedPricing.minTotal.toLocaleString("en-IN")} – ₹${order.estimatedPricing.maxTotal.toLocaleString("en-IN")}`
                        : estimatedRange}
                    </div>
                    <p className="text-[11px] mt-1" style={{ color: "#6B7280" }}>
                      Final price will be confirmed by pharmacy before packing
                    </p>
                    <div className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full" style={{ background: `${DEEP}08` }} />
                  </div>
                )}

                {renderReviewList("Confirmed medicines", groupedReview.exact, "exact")}
                {renderReviewList("Needs review", groupedReview.probable, "probable")}
                {renderReviewList("We'll arrange for you", groupedReview.unclear, "unclear")}

                <div className="rounded-xl border p-3" style={{ borderColor: `${DEEP}22` }}>
                  <div className="font-bold mb-2" style={{ color: "#0b3f30" }}>Budget Guard</div>
                  <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#0b3f30" }}>
                    <input
                      type="checkbox"
                      checked={budgetGuard.enabled}
                      onChange={(e) => setBudgetGuard((prev) => ({ ...prev, enabled: e.target.checked }))}
                    />
                    Enable budget guard
                  </label>
                  {budgetGuard.enabled && (
                    <div className="grid grid-cols-1 gap-2 mt-2">
                      <Input
                        type="number"
                        min={0}
                        value={budgetGuard.autoApproveBelow}
                        onChange={(e) => setBudgetGuard((prev) => ({ ...prev, autoApproveBelow: e.target.value }))}
                        placeholder="Auto-approve if total under Rs. X"
                      />
                      <Input
                        type="number"
                        min={0}
                        value={budgetGuard.askAbove}
                        onChange={(e) => setBudgetGuard((prev) => ({ ...prev, askAbove: e.target.value }))}
                        placeholder="Ask me if above Rs. X"
                      />
                      <label className="flex items-center gap-2 text-sm" style={{ color: "#0b3f30" }}>
                        <input
                          type="checkbox"
                          checked={budgetGuard.noCallUnlessImportant}
                          onChange={(e) =>
                            setBudgetGuard((prev) => ({ ...prev, noCallUnlessImportant: e.target.checked }))
                          }
                        />
                        No call unless important
                      </label>
                    </div>
                  )}
                </div>

                <Input
                  placeholder="Notes for pharmacy (optional)"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  maxLength={180}
                />
              </div>
            )}

            {step === "final" && (
              <div className="flex flex-col items-center gap-3 min-h-[140px] py-8">
                {finalSubmitting ? (
                  <>
                    <Loader2 className="w-10 h-10 animate-spin" style={{ color: DEEP }} />
                    <div className="font-semibold text-center" style={{ color: "#0b3f30" }}>
                      Sending your reviewed basket...
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-14 h-14" style={{ color: DEEP }} />
                    <div className="font-bold text-center" style={{ color: "#0b3f30" }}>
                      {finalResult.queuedForAdmin
                        ? "Your prescription is in pharmacist review queue."
                        : "Basket shared with pharmacy for confirmation."}
                    </div>
                    <div className="text-xs text-center" style={{ color: "#0b3f3099" }}>
                      {finalResult.queuedForAdmin
                        ? "We will notify you once review is completed."
                        : "You will get confirmation as soon as stock and final amount are ready."}
                    </div>
                  </>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mt-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="bg-white p-4 pt-2 rounded-b-3xl flex gap-2 border-t mt-0 flex-shrink-0 z-10">
            {step === "form" && (
              <>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 font-bold bg-white hover:bg-gray-50"
                  style={{ color: DEEP, borderColor: `${DEEP}66` }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="flex-1 font-bold text-white rounded-full hover:brightness-105 shadow-lg"
                  style={{ backgroundColor: DEEP }}
                >
                  Prepare My Order
                </Button>
              </>
            )}

            {step === "parsing" && (
              <Button
                onClick={handleClose}
                className="w-full font-bold text-white rounded-full hover:brightness-105 shadow-lg"
                style={{ backgroundColor: DEEP }}
              >
                Close
              </Button>
            )}

            {step === "review" && (
              <>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 font-bold bg-white hover:bg-gray-50"
                  style={{ color: DEEP, borderColor: `${DEEP}66` }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReviewSubmit}
                  className="flex-1 font-bold text-white rounded-full hover:brightness-105 shadow-lg"
                  style={{ backgroundColor: DEEP }}
                >
                  Continue
                </Button>
              </>
            )}

            {step === "final" && (
              <Button
                onClick={handleClose}
                className="w-full font-bold text-white rounded-full hover:brightness-105 shadow-lg"
                style={{ backgroundColor: DEEP }}
              >
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
