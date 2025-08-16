"use client";

import React, { useRef, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { RadioGroup } from "../components/ui/radio-group";
import { Input } from "../components/ui/input";
import { AlertCircle, Home, Edit, Trash2, Plus, UploadCloud, Loader2, MapPin, CheckCircle } from "lucide-react";
import AddressForm from "./AddressForm";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export default function PrescriptionUploadModal({
  open, onClose, userCity = "Delhi", userArea = "", afterOrder,
  initialMode, initialNotes, initialFileUrl, initialAddress
}) {
  const fileInputRef = useRef();
  const { addresses, updateAddresses } = useAuth();

  const [selectedAddressId, setSelectedAddressId] = useState(addresses[0]?.id || null);
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [step, setStep] = useState(1); // 1=choose, 2=wait, 3=quote ready
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);
  const [quoteReady, setQuoteReady] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const [uploadType, setUploadType] = useState("auto");
  const [notes, setNotes] = useState("");
  const [pharmacyList, setPharmacyList] = useState([]);
  const [pharmacyLoading, setPharmacyLoading] = useState(false);
  const [selectedPharmacy, setSelectedPharmacy] = useState("");
  const [phOpen, setPhOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialMode) setUploadType(initialMode);
      if (initialNotes !== undefined) setNotes(initialNotes);
      if (initialAddress && initialAddress.id) setSelectedAddressId(initialAddress.id);
      if (initialFileUrl) setPreview(initialFileUrl);
    }
  }, [open, initialMode, initialNotes, initialFileUrl, initialAddress]);

  useEffect(() => {
    if (!selectedAddressId && addresses.length > 0) setSelectedAddressId(addresses[0].id);
  }, [addresses, selectedAddressId]);

  useEffect(() => {
  if (!phOpen) return;
  const onDown = (e) => {
    if (!e.target.closest?.('[data-pharmacy-dropdown]')) {
      setPhOpen(false);
    }
  };
  document.addEventListener('mousedown', onDown);
  document.addEventListener('touchstart', onDown);
  return () => {
    document.removeEventListener('mousedown', onDown);
    document.removeEventListener('touchstart', onDown);
  };
}, [phOpen]);

  useEffect(() => {
    let interval;
    if (step === 2 && order?._id && !quoteReady) {
      interval = setInterval(async () => {
        try {
          const token = localStorage.getItem("token");
          const res = await axios.get(
            `${API_BASE_URL}/api/prescriptions/order/${order._id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (res.data.status === "quoted" || (res.data.quotes && res.data.quotes.length)) {
            setQuoteReady(true);
            clearInterval(interval);
            setSnackbar({
              open: true,
              message: "Quote received for your prescription!",
              severity: "success",
            });
            setTimeout(() => handleClose(), 1600);
          }
        } catch { }
      }, 3500);
    }
    return () => interval && clearInterval(interval);
  }, [step, order, quoteReady]);

  useEffect(() => {
    if (open && uploadType === "manual") {
      setPharmacyLoading(true);
      const addr = addresses.find(a => a.id === selectedAddressId);
      if (addr && addr.lat && addr.lng) {
        axios
          .get(`${API_BASE_URL}/api/pharmacies/nearby?lat=${addr.lat}&lng=${addr.lng}&maxDistance=15000`)
          .then(res => setPharmacyList(res.data))
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

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : "");
  };
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  function sanitizeNotes(str) {
    return str.replace(/\d{10,}/g, "[blocked]");
  }

  const handleSaveAddress = async (addr) => {
    let updated;
    if (addr.id && addresses.some(a => a.id === addr.id)) {
      updated = addresses.map(a => (a.id === addr.id ? addr : a));
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
    const updated = addresses.filter(a => a.id !== addr.id);
    await updateAddresses(updated);
    setSnackbar({ open: true, message: "Address deleted!", severity: "success" });
    if (selectedAddressId === addr.id && updated.length) {
      setSelectedAddressId(updated[0].id);
    } else if (updated.length === 0) {
      setSelectedAddressId(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAddressId) return setError("Please select or add a delivery address.");
    if (!file && !preview) return setError("Upload a prescription file first.");
    if (uploadType === "manual" && !selectedPharmacy)
      return setError("Select a pharmacy.");
    if (/\d{10,}/.test(notes))
      return setError("Mobile numbers not allowed in notes.");
    if (uploadType === "manual") {
      const addr = addresses.find(a => a.id === selectedAddressId);
      if (!addr || !addr.lat || !addr.lng)
        return setError("Please select a delivery address with location pin (use map).");
      if (!selectedPharmacy)
        return setError("Select a pharmacy.");
    }
    if (uploadType === "auto") {
      const addr = addresses.find(a => a.id === selectedAddressId);
      if (!addr || !addr.lat || !addr.lng) {
        setError("Please select a location using the map.");
        return;
      }
    }
    setError("");
    setStep(2);
    try {
      const token = localStorage.getItem("token");
      let prescriptionUrl = preview;
      if (file) {
        const data = new FormData();
        data.append("prescription", file);
        const uploadRes = await axios.post(
          `${API_BASE_URL}/api/prescriptions/upload`,
          data,
          {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "multipart/form-data"
            }
          }
        );
        prescriptionUrl = uploadRes.data.prescriptionUrl || uploadRes.data.url;
      }
      const orderRes = await axios.post(
        `${API_BASE_URL}/api/prescriptions/order`,
        {
          prescriptionUrl,
          city: userCity,
          area: userArea,
          notes: sanitizeNotes(notes),
          uploadType,
          chosenPharmacyId: uploadType === "manual" ? selectedPharmacy : undefined,
          address: addresses.find(a => a.id === selectedAddressId) || {},
        },
        {
          headers: { "Authorization": `Bearer ${token}` }
        }
      );
      setOrder(orderRes.data);
      setSnackbar({
        open: true,
        message: "Prescription submitted! We'll notify you when quotes arrive.",
        severity: "info",
      });
      afterOrder?.(orderRes.data);
    } catch (e) {
      setError("Failed to submit. Try again.");
      setStep(1);
    }
  };

  const handleClose = () => {
    setStep(1);
    setFile(null);
    setPreview("");
    setError("");
    setOrder(null);
    setQuoteReady(false);
    setSnackbar({ open: false, message: "", severity: "success" });
    setNotes("");
    setUploadType("auto");
    setPharmacyList([]);
    setSelectedPharmacy("");
    setAddressFormOpen(false);
    setSelectedAddressId(addresses[0]?.id || null);
    setEditingAddress(null);
    onClose();
  };

  // ----------- UI START -------------
  return (
  <>
    <Dialog open={open} onOpenChange={handleClose}>
  <DialogContent
  className="!p-0 !max-w-sm w-full rounded-2xl flex flex-col"
  style={{
    maxHeight: "100vh",   // full available safe area
    background: "#fff",
    boxShadow: "0 8px 32px rgba(40,80,120,0.16)",
    display: "flex",
    flexDirection: "column",
    // No margin/marginTop/marginBottom here!
  }}
>
  {/* HEADER */}
  <DialogHeader className="p-5 pb-2 flex-shrink-0 bg-white z-10">
    <DialogTitle className="text-xl font-bold tracking-tight">
      {step === 1 && "Upload Prescription"}
      {step === 2 && (quoteReady ? "Quote Received!" : "Waiting for Quotes")}
    </DialogTitle>
  </DialogHeader>
  {/* CONTENT */}
  <div
    className="flex-1 px-4 pt-1 pb-1 overflow-y-auto"
    style={{
      minHeight: 180,
      // If you want to be super safe, add paddingBottom: 72 for bottom nav, paddingTop: 72 for top nav
    }}
  >
          {step === 1 && (
            <div className="flex flex-col gap-4">
              {/* Delivery Address */}
              <div>
                <div className="font-semibold mb-1 text-zinc-600">Delivery Address</div>
                {addresses.length === 0 ? (
                  <Button
                    className="w-full"
                    variant="default"
                    onClick={() => { setEditingAddress(null); setAddressFormOpen(true); }}
                  >
                    <Plus className="w-5 h-5 mr-2" /> Add New Address
                  </Button>
                ) : (
                  addresses
                    .filter(addr => !selectedAddressId || addr.id === selectedAddressId)
                    .map(addr => (
                      <div
                        key={addr.id}
                        className="rounded-xl bg-white border border-zinc-200 shadow-sm p-3 mb-2 flex flex-col gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <Badge className="bg-zinc-800 text-teal-400 px-2 py-0.5">
                            <Home className="w-4 h-4 mr-1" />
                            {addr.type || "Current"}
                          </Badge>
                          <span className="font-bold text-base">{addr.name}</span>
                          <span className="text-xs opacity-80">{addr.phone}</span>
                        </div>
                        <div className="text-xs text-zinc-400">{addr.addressLine}</div>
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-yellow-400"
                            onClick={e => {
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
                            className="text-red-400"
                            onClick={e => {
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
                    className="w-full mb-1"
                    variant="secondary"
                    onClick={() => { setEditingAddress(null); setAddressFormOpen(true); }}
                  >
                    <Plus className="w-5 h-5 mr-2" /> Add New Address
                  </Button>
                )}
                <AddressForm
                  open={addressFormOpen}
                  onClose={() => { setAddressFormOpen(false); setEditingAddress(null); }}
                  onSave={handleSaveAddress}
                  initial={editingAddress || addresses.find(a => a.id === selectedAddressId) || {}}
                />
              </div>
              {/* Upload Mode */}
              <div className="flex gap-2 justify-center mt-1 mb-1">
                <button
                  type="button"
                  className={`
                    flex-1 rounded-lg border px-2 py-2 font-semibold transition-all
                    ${uploadType === "auto"
                      ? "border-teal-400 bg-teal-50 shadow text-teal-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}
                  `}
                  onClick={() => setUploadType("auto")}
                >
                  Let GoDavaii Handle
                  <div className="block text-xs font-normal mt-1 text-gray-400">
                    Fastest quote, best price!
                  </div>
                </button>
                <button
                  type="button"
                  className={`
                    flex-1 rounded-lg border px-2 py-2 font-semibold transition-all
                    ${uploadType === "manual"
                      ? "border-amber-300 bg-amber-50 shadow text-amber-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}
                  `}
                  onClick={() => setUploadType("manual")}
                >
                  Choose Pharmacy Yourself
                  <div className="block text-xs font-normal mt-1 text-gray-400">
                    Select pharmacy from list
                  </div>
                </button>
              </div>
              {/* File Upload */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  hidden
                  onChange={handleFileChange}
                />
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleUploadClick}
                >
                  <UploadCloud className="w-5 h-5 mr-2" />
                  {file || preview ? "Change File" : "Choose File"}
                </Button>
                {preview && (
                  <div className="mt-2 flex items-center justify-center">
                    <img
                      src={preview}
                      alt="Prescription Preview"
                      className="max-h-36 max-w-[180px] rounded-lg border border-gray-200 shadow-sm"
                    />
                  </div>
                )}
              </div>
              {/* Notes */}
              <Input
                placeholder="Add a note for pharmacy"
                value={notes}
                onChange={e => setNotes(e.target.value.replace(/\d{10,}/g, ""))}
                maxLength={120}
                className="mt-1"
              />
              {/* Pharmacy Dropdown (manual) */}
              {uploadType === "manual" && (
  <div data-pharmacy-dropdown style={{ position: "relative", zIndex: 50 }}>
    <label className="block mb-1 text-sm font-semibold text-zinc-700">
      Select a Pharmacy
    </label>

    {/* Trigger */}
    <div
      onClick={() => setPhOpen(v => !v)}
      className="w-full border border-gray-300 rounded-lg bg-white px-3 py-2 text-sm cursor-pointer flex items-center justify-between"
      style={{ userSelect: "none" }}
    >
      <span className="truncate">
        {selectedPharmacy
          ? (() => {
              const ph = pharmacyList.find(p => p._id === selectedPharmacy);
              return ph ? `${ph.name} (${ph.area}, ${ph.city})` : "Select pharmacy…";
            })()
          : "Select pharmacy…"}
      </span>
      <span style={{ opacity: 0.6 }}>▾</span>
    </div>

    {/* Menu */}
    {phOpen && (
      <div
        className="absolute left-0 right-0 mt-1 border border-gray-200 rounded-lg bg-white shadow-lg"
        style={{
          maxHeight: 200,
          overflowY: "auto",
        }}
      >
        {pharmacyLoading && (
          <div className="px-3 py-2 text-sm text-gray-500">Loading pharmacies…</div>
        )}

        {!pharmacyLoading && pharmacyList.length === 0 && (
          <div className="px-3 py-2 text-sm text-gray-500">
            {(() => {
              const addr = addresses.find(a => a.id === selectedAddressId);
              if (!addr || !addr.lat || !addr.lng) return "Select a delivery address with location pin.";
              return "No pharmacies found within 15km.";
            })()}
          </div>
        )}

        {!pharmacyLoading &&
          pharmacyList.map(ph => (
            <button
              key={ph._id}
              type="button"
              onClick={() => {
                setSelectedPharmacy(ph._id);
                setPhOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                selectedPharmacy === ph._id ? "bg-gray-100 font-medium" : ""
              }`}
              style={{ whiteSpace: "nowrap" }}
              title={`${ph.name} (${ph.area}, ${ph.city})`}
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

              <div className="text-xs text-gray-400 mt-1">
                Upload a photo or PDF of your prescription to get a quote from pharmacy.
              </div>
              {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mt-1">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="flex flex-col items-center gap-3 min-h-[140px] py-8">
              {!quoteReady ? (
                <>
                  <Loader2 className="w-10 h-10 animate-spin text-teal-500" />
                  <div className="font-semibold text-[#1199a6] text-center">
                    Prescription sent!
                    <br />Waiting for quote from pharmacy…
                  </div>
                  <div className="text-xs text-gray-400 text-center">
                    We’ll notify you as soon as a pharmacy sends a quote.
                    <br />You can close this window and continue using the app.
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle className="w-14 h-14 text-green-500" />
                  <div className="font-bold text-green-600 text-center">
                    Quote received! Check details on your orders page.
                  </div>
                  <div className="text-xs text-gray-400 text-center">
                    Pharmacy has sent a quote for your prescription.
                  </div>
                </>
              )}
            </div>
          )}
        </div>
          {/* --- FOOTER, THEME MATCHED --- */}
<DialogFooter className="bg-gray-50 p-4 pt-2 rounded-b-2xl flex gap-2 border-t border-zinc-100 mt-0 flex-shrink-0 z-10">
  {step === 1 && (
    <>
      {/* Cancel → subtle teal outline (not gray) */}
      <Button
        variant="outline"
        onClick={handleClose}
        className="flex-1 border-teal-200 text-teal-700 hover:bg-teal-50"
      >
        Cancel
      </Button>

      {/* Upload → gradient pill like navbar/bottom bar */}
      <Button
        onClick={handleSubmit}
        className="flex-1 font-bold text-white rounded-full
                   bg-[linear-gradient(90deg,#14b8a6_0%,#10b981_100%)]
                   hover:brightness-105 shadow-lg shadow-emerald-200/50"
      >
        Upload Prescription
      </Button>
    </>
  )}

  {step === 2 && (
    <Button
      onClick={handleClose}
      className="w-full text-white rounded-full
                 bg-[linear-gradient(90deg,#14b8a6_0%,#10b981_100%)]
                 hover:brightness-105 shadow-lg shadow-emerald-200/50"
    >
      Close
    </Button>
  )}
</DialogFooter>
  </DialogContent>
</Dialog>
    {/* Snackbar not included, but easy to add using shadcn/ui Toast or your own. */}
  </>
);
}
