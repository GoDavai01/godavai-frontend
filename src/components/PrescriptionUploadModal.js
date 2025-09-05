"use client";

import React, { useRef, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { AlertCircle, Home, Edit, Trash2, Plus, UploadCloud, Loader2, CheckCircle, Camera } from "lucide-react"; // ← NEW: Camera
import AddressForm from "./AddressForm";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

// Deep green token (match navbar/bottom bar). If you already have one, swap to your CSS var.
const DEEP = "#0f6e51";

export default function PrescriptionUploadModal({
  open, onClose, userCity = "Delhi", userArea = "", afterOrder,
  initialMode, initialNotes, initialFileUrl, initialAddress
}) {
  const fileInputRef = useRef();
  const cameraInputRef = useRef(); // ← NEW: camera input ref
  const { addresses, updateAddresses } = useAuth();

  const [selectedAddressId, setSelectedAddressId] = useState(addresses[0]?.id || null);
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [step, setStep] = useState(1);
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
      if (!e.target.closest?.('[data-pharmacy-dropdown]')) setPhOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
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
            setTimeout(() => handleClose(), 1600);
          }
        } catch {}
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
    const f = e.target.files?.[0];
    setFile(f || null);
    setPreview(f ? URL.createObjectURL(f) : "");
  };
  const handleUploadClick = () => fileInputRef.current?.click();
  const handleCameraClick = () => cameraInputRef.current?.click(); // ← NEW: trigger camera

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
    if (selectedAddressId === addr.id && updated.length) {
      setSelectedAddressId(updated[0].id);
    } else if (updated.length === 0) {
      setSelectedAddressId(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAddressId) return setError("Please select or add a delivery address.");
    if (!file && !preview) return setError("Upload a prescription file first.");
    if (uploadType === "manual" && !selectedPharmacy) return setError("Select a pharmacy.");
    if (/\d{10,}/.test(notes)) return setError("Mobile numbers not allowed in notes.");

    if (uploadType === "manual") {
      const addr = addresses.find(a => a.id === selectedAddressId);
      if (!addr || !addr.lat || !addr.lng) return setError("Please select a delivery address with location pin (use map).");
    } else {
      const addr = addresses.find(a => a.id === selectedAddressId);
      if (!addr || !addr.lat || !addr.lng) return setError("Please select a location using the map.");
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
          { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" } }
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
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOrder(orderRes.data);
    } catch {
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
          {/* HEADER — white again, no subtitle */}
          <DialogHeader className="p-5 pb-3 flex-shrink-0 bg-white z-10 rounded-t-3xl border-b">
            <DialogTitle className="text-xl font-extrabold tracking-tight" style={{ color: DEEP }}>
              Upload Prescription
            </DialogTitle>
          </DialogHeader>

          {/* CONTENT */}
          <div className="flex-1 px-4 pt-3 pb-2 overflow-y-auto" style={{ minHeight: 180 }}>
            {step === 1 && (
              <div className="flex flex-col gap-4">
                {/* Delivery Address */}
                <div>
                  <div className="font-bold mb-1" style={{ color: DEEP }}>Delivery Address</div>

                  {addresses.length === 0 ? (
                    <Button
                      className="w-full font-bold text-white"
                      style={{ backgroundColor: DEEP }}
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
                          className="rounded-xl bg-white border shadow-sm p-3 mb-2 flex flex-col gap-2"
                          style={{ borderColor: `${DEEP}22` }}
                        >
                          <div className="flex items-center gap-2">
                            <Badge className="px-2 py-0.5 text-white" style={{ backgroundColor: DEEP }}>
                              <Home className="w-4 h-4 mr-1 text-white" />
                              {addr.type || "Current"}
                            </Badge>
                            <span className="font-bold text-base" style={{ color: "#0b3f30" }}>{addr.name}</span>
                            <span className="text-xs" style={{ color: "#0b3f30b3" }}>{addr.phone}</span>
                          </div>
                          <div className="text-xs" style={{ color: "#0b3f3099" }}>{addr.addressLine}</div>
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="hover:bg-gray-50"
                              style={{ color: DEEP }}
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
                              className="text-red-600 hover:bg-red-50"
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
                      className="w-full mb-1 font-bold text-white"
                      style={{ backgroundColor: DEEP }}
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
                    modalZIndex={3300}
                  />
                </div>

                {/* Upload Mode — clear selected state */}
                <div className="flex gap-2 justify-center mt-1 mb-1">
                  {/* AUTO */}
                  <button
                    type="button"
                    onClick={() => setUploadType("auto")}
                    aria-pressed={uploadType === "auto"}
                    className={`flex-1 rounded-lg px-3 py-3 font-semibold transition-all border
                      ${uploadType === "auto" ? "text-white" : "text-[#0b3f30]"}
                    `}
                    style={{
                      background: uploadType === "auto" ? DEEP : "#fff",
                      borderColor: uploadType === "auto" ? DEEP : `${DEEP}33`,
                      boxShadow: uploadType === "auto" ? "0 0 0 3px rgba(15,110,81,0.15)" : "none",
                    }}
                  >
                    <div className="font-bold">Let GoDavaii Handle</div>
                    <div
                      className="block text-xs mt-1"
                      style={{ color: uploadType === "auto" ? "rgba(255,255,255,.9)" : "#0b3f3099" }}
                    >
                      Fastest quote, best price!
                    </div>
                  </button>

                  {/* MANUAL */}
                  <button
                    type="button"
                    onClick={() => setUploadType("manual")}
                    aria-pressed={uploadType === "manual"}
                    className={`flex-1 rounded-lg px-3 py-3 font-semibold transition-all border
                      ${uploadType === "manual" ? "text-white" : "text-[#0b3f30]"}
                    `}
                    style={{
                      background: uploadType === "manual" ? DEEP : "#fff",
                      borderColor: uploadType === "manual" ? DEEP : `${DEEP}33`,
                      boxShadow: uploadType === "manual" ? "0 0 0 3px rgba(15,110,81,0.15)" : "none",
                    }}
                  >
                    <div className="font-bold">Choose Pharmacy Yourself</div>
                    <div
                      className="block text-xs mt-1"
                      style={{ color: uploadType === "manual" ? "rgba(255,255,255,.9)" : "#0b3f3099" }}
                    >
                      Select pharmacy from list
                    </div>
                  </button>
                </div>

                {/* File Upload + Camera */}
                <div>
                  {/* existing file input (gallery/files/PDF) */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    hidden
                    onChange={handleFileChange}
                  />

                  {/* NEW: camera input (rear camera hint on mobile) */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={handleFileChange}
                  />

                  <div className="flex gap-2">
                    <Button
                      className="flex-1 font-bold"
                      variant="outline"
                      onClick={handleUploadClick}
                      style={{ borderColor: `${DEEP}40`, color: "#0b3f30" }}
                    >
                      <UploadCloud className="w-5 h-5 mr-2" />
                      {file || preview ? "Change File" : "Choose File"}
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

                  {preview && (
                    <div className="mt-2 flex items-center justify-center">
                      <img
                        src={preview}
                        alt="Prescription Preview"
                        className="max-h-36 max-w-[180px] rounded-lg border shadow-sm"
                        style={{ borderColor: `${DEEP}33` }}
                      />
                    </div>
                  )}
                </div>

                {/* Notes */}
                <Input
                  placeholder="Add a note for pharmacy"
                  value={notes}
                  onChange={e => e && setNotes(e.target.value.replace(/\d{10,}/g, ""))}
                  maxLength={120}
                  className="mt-1"
                  style={{ borderColor: `${DEEP}33` }}
                />

                {/* Pharmacy Dropdown (manual) */}
                {uploadType === "manual" && (
                  <div data-pharmacy-dropdown style={{ position: "relative", zIndex: 50 }}>
                    <label className="block mb-1 text-sm font-semibold" style={{ color: DEEP }}>
                      Select a Pharmacy
                    </label>

                    <div
                      onClick={() => setPhOpen(v => !v)}
                      className="w-full rounded-lg bg-white px-3 py-2 text-sm cursor-pointer flex items-center justify-between"
                      style={{ userSelect: "none", border: `1px solid ${DEEP}40` }}
                    >
                      <span className="truncate" style={{ color: "#0b3f30" }}>
                        {selectedPharmacy
                          ? (() => {
                              const ph = pharmacyList.find(p => p._id === selectedPharmacy);
                              return ph ? `${ph.name} (${ph.area}, ${ph.city})` : "Select pharmacy…";
                            })()
                          : "Select pharmacy…"}
                      </span>
                      <span style={{ opacity: 0.6, color: "#0b3f30" }}>▾</span>
                    </div>

                    {phOpen && (
                      <div
                        className="absolute left-0 right-0 mt-1 rounded-lg bg-white shadow-lg"
                        style={{ maxHeight: 200, overflowY: "auto", border: `1px solid ${DEEP}33` }}
                      >
                        {pharmacyLoading && (
                          <div className="px-3 py-2 text-sm" style={{ color: "#0b3f3099" }}>
                            Loading pharmacies…
                          </div>
                        )}

                        {!pharmacyLoading && pharmacyList.length === 0 && (
                          <div className="px-3 py-2 text-sm" style={{ color: "#0b3f3099" }}>
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
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                              style={{
                                whiteSpace: "nowrap",
                                color: "#0b3f30",
                                background: selectedPharmacy === ph._id ? "#f2fbf8" : "white",
                              }}
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

                {/* Helper text — bold as requested */}
                <div className="mt-1">
                  <span className="text-sm font-semibold" style={{ color: "#0b3f30" }}>
                    Upload a photo or PDF of your prescription to get a quote from pharmacy.
                  </span>
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
                    <Loader2 className="w-10 h-10 animate-spin" style={{ color: DEEP }} />
                    <div className="font-semibold text-center" style={{ color: "#0b3f30" }}>
                      Prescription sent!
                      <br />Waiting for quote from pharmacy…
                    </div>
                    <div className="text-xs text-center" style={{ color: "#0b3f3099" }}>
                      We’ll notify you as soon as a pharmacy sends a quote.
                      <br />You can close this window and continue using the app.
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-14 h-14" style={{ color: DEEP }} />
                    <div className="font-bold text-center" style={{ color: "#0b3f30" }}>
                      Quote received! Check details on your orders page.
                    </div>
                    <div className="text-xs text-center" style={{ color: "#0b3f3099" }}>
                      Pharmacy has sent a quote for your prescription.
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* FOOTER — Cancel white, Upload deep green */}
          <DialogFooter className="bg-white p-4 pt-2 rounded-b-3xl flex gap-2 border-t mt-0 flex-shrink-0 z-10">
            {step === 1 && (
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
                  Upload Prescription
                </Button>
              </>
            )}

            {step === 2 && (
              <Button
                onClick={handleClose}
                className="w-full font-bold text-white rounded-full hover:brightness-105 shadow-lg"
                style={{ backgroundColor: DEEP }}
              >
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
