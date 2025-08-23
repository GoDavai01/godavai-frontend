// src/components/RegisterDeliveryPartner.js
import React, { useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import {
  Bike,
  UploadCloud,
  IdCard,
  CreditCard,
  UserRound,
  MapPin,
  Building2,
  Landmark,
  ShieldCheck,
  Phone,
  Loader2,
  Hash,
  Mail,
  KeyRound,
} from "lucide-react";

// shadcn/ui
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

// Lightweight toast (replaces MUI Snackbar/Alert)
function InlineToast({ open, kind = "success", children, onClose }) {
  if (!open) return null;
  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[1200] rounded-xl px-4 py-3 text-sm font-semibold shadow-xl
      ${kind === "error" ? "bg-red-600 text-white" : "bg-emerald-700 text-white"}`}
      onClick={onClose}
    >
      {children}
    </div>
  );
}

export default function RegisterDeliveryPartner() {
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    email: "",
    password: "",
    vehicle: "",
    city: "",
    area: "",
    aadhaarNumber: "",
    panNumber: "",
    bankAccount: "",
    ifsc: "",
    accountHolder: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [aadhaarFile, setAadhaarFile] = useState(null);
  const [panFile, setPanFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // === logic preserved ===
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "mobile") {
      setForm((f) => ({ ...f, [name]: value.replace(/\D/g, "").slice(0, 10) }));
    } else if (name === "aadhaarNumber") {
      setForm((f) => ({ ...f, [name]: value.replace(/\D/g, "").slice(0, 12) }));
    } else if (name === "panNumber") {
      setForm((f) => ({
        ...f,
        [name]: value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10),
      }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const handleFileChange = (e, setter) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        setSnackbar({ open: true, message: "Max 2MB file size allowed.", severity: "error" });
        return;
      }
      setter(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // === validations preserved ===
    if (form.mobile.length !== 10) {
      setSnackbar({ open: true, message: "Enter valid 10 digit mobile", severity: "error" });
      return;
    }
    if (form.aadhaarNumber.length !== 12) {
      setSnackbar({ open: true, message: "Aadhaar must be 12 digits", severity: "error" });
      return;
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber)) {
      setSnackbar({ open: true, message: "Enter valid PAN number", severity: "error" });
      return;
    }
    // NEW: confirm password match (client-side only; not sent to server)
    if (!confirmPassword || form.password !== confirmPassword) {
      setSnackbar({ open: true, message: "Passwords do not match", severity: "error" });
      return;
    }
    // required uploads (preserved)
    if (!aadhaarFile) {
      setSnackbar({ open: true, message: "Please upload Aadhaar card", severity: "error" });
      return;
    }
    if (!panFile) {
      setSnackbar({ open: true, message: "Please upload PAN card", severity: "error" });
      return;
    }

    setLoading(true);
    const data = new FormData();
    Object.keys(form).forEach((key) => data.append(key, form[key]));
    if (aadhaarFile) data.append("aadhaarDoc", aadhaarFile);
    if (panFile) data.append("panDoc", panFile);

    try {
      await axios.post(`${API_BASE_URL}/api/delivery/register`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSnackbar({
        open: true,
        message: "Registration submitted for approval!",
        severity: "success",
      });
      setForm({
        name: "",
        mobile: "",
        email: "",
        password: "",
        vehicle: "",
        city: "",
        area: "",
        aadhaarNumber: "",
        panNumber: "",
        bankAccount: "",
        ifsc: "",
        accountHolder: "",
      });
      setConfirmPassword("");
      setAadhaarFile(null);
      setPanFile(null);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || "Failed to register",
        severity: "error",
      });
    }
    setLoading(false);
  };

  // theme tokens
  const DEEP = "#0f6e51";

  return (
    <div className="min-h-screen bg-slate-50 py-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto px-3 sm:px-4"
      >
        <Card className="rounded-3xl border-emerald-100/70 shadow-sm">
          <CardContent className="p-5 sm:p-6">
            {/* Header */}
            <div className="mb-4 text-center">
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-emerald-100 text-emerald-800 font-extrabold text-sm">
                <Bike className="h-4 w-4" />
                GoDavaii
              </div>
              <h1
                className="mt-2 text-2xl font-black tracking-tight"
                style={{ color: DEEP }}
              >
                Delivery Partner Registration
              </h1>
              <p className="text-[13px] text-emerald-900/70 font-semibold">
                Fast onboarding. Secure docs. Deep-green vibes 🌿
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} encType="multipart/form-data" className="space-y-4">
              {/* Personal */}
              <div className="rounded-2xl bg-white ring-1 ring-emerald-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <UserRound className="h-5 w-5 text-emerald-700" />
                  <div className="text-sm font-extrabold text-emerald-900">Personal</div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label className="font-semibold text-emerald-900">Full Name</Label>
                    <Input
                      name="name"
                      required
                      value={form.name}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="Your full name"
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="font-semibold text-emerald-900 flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" /> Mobile Number
                      </Label>
                      <Input
                        name="mobile"
                        required
                        value={form.mobile}
                        onChange={handleChange}
                        disabled={loading}
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="10 digit mobile"
                        className="mt-1"
                      />
                      <div className="mt-1 text-[11px] font-semibold text-emerald-700/80">
                        10 digit mobile
                      </div>
                    </div>

                    <div>
                      <Label className="font-semibold text-emerald-900 flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" /> Email Address
                      </Label>
                      <Input
                        name="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={handleChange}
                        disabled={loading}
                        placeholder="name@example.com"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="font-semibold text-emerald-900 flex items-center gap-1">
                      <KeyRound className="h-3.5 w-3.5" /> Password
                    </Label>
                    <Input
                      name="password"
                      type="password"
                      required
                      value={form.password}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="Create a strong password"
                      className="mt-1"
                    />
                  </div>

                  {/* NEW: Confirm Password */}
                  <div>
                    <Label className="font-semibold text-emerald-900 flex items-center gap-1">
                      <KeyRound className="h-3.5 w-3.5" /> Confirm Password
                    </Label>
                    <Input
                      name="confirmPassword"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      placeholder="Re-enter password"
                      className="mt-1"
                    />
                    {confirmPassword.length > 0 && (
                      <div
                        className={`mt-1 text-[11px] font-semibold ${
                          confirmPassword === form.password
                            ? "text-emerald-700/80"
                            : "text-red-600"
                        }`}
                      >
                        {confirmPassword === form.password
                          ? "Passwords match"
                          : "Passwords do not match"}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Vehicle & Location */}
              <div className="rounded-2xl bg-white ring-1 ring-emerald-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-700" />
                  <div className="text-sm font-extrabold text-emerald-900">Vehicle & Location</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="font-semibold text-emerald-900">Vehicle Type</Label>
                    <Input
                      name="vehicle"
                      required
                      value={form.vehicle}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="Bike / Scooter / etc."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="font-semibold text-emerald-900 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> City
                    </Label>
                    <Input
                      name="city"
                      required
                      value={form.city}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="City"
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="font-semibold text-emerald-900 flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" /> Area / Locality
                    </Label>
                    <Input
                      name="area"
                      required
                      value={form.area}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="Area / Locality"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* KYC */}
              <div className="rounded-2xl bg-white ring-1 ring-emerald-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <IdCard className="h-5 w-5 text-emerald-700" />
                  <div className="text-sm font-extrabold text-emerald-900">KYC</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="font-semibold text-emerald-900">Aadhaar Number</Label>
                    <Input
                      name="aadhaarNumber"
                      required
                      value={form.aadhaarNumber}
                      onChange={handleChange}
                      disabled={loading}
                      inputMode="numeric"
                      maxLength={12}
                      placeholder="12 digit Aadhaar"
                      className="mt-1"
                    />
                    <div className="mt-1 text-[11px] font-semibold text-emerald-700/80">
                      12 digit Aadhaar
                    </div>
                  </div>

                  <div>
                    <Label className="font-semibold text-emerald-900">PAN Number</Label>
                    <Input
                      name="panNumber"
                      required
                      value={form.panNumber}
                      onChange={handleChange}
                      disabled={loading}
                      maxLength={10}
                      placeholder="ABCDE1234F"
                      className="mt-1 uppercase tracking-widest"
                    />
                    <div className="mt-1 text-[11px] font-semibold text-emerald-700/80">
                      Format: ABCDE1234F
                    </div>
                  </div>
                </div>

                {/* Aadhaar Upload */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 cursor-pointer hover:bg-emerald-100 transition">
                      <UploadCloud className="h-4 w-4" />
                      Upload Aadhaar Card
                      <input
                        type="file"
                        name="aadhaarDoc"
                        hidden
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileChange(e, setAadhaarFile)}
                        disabled={loading}
                      />
                    </label>
                    {!aadhaarFile ? (
                      <span className="text-[11px] font-bold text-red-600">*</span>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-700">
                        Selected: {aadhaarFile.name}
                      </span>
                    )}
                  </div>

                  {/* PAN Upload */}
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 cursor-pointer hover:bg-emerald-100 transition">
                      <CreditCard className="h-4 w-4" />
                      Upload PAN Card
                      <input
                        type="file"
                        name="panDoc"
                        hidden
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileChange(e, setPanFile)}
                        disabled={loading}
                      />
                    </label>
                    {!panFile ? (
                      <span className="text-[11px] font-bold text-red-600">*</span>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-700">
                        Selected: {panFile.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bank */}
              <div className="rounded-2xl bg-white ring-1 ring-emerald-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Landmark className="h-5 w-5 text-emerald-700" />
                  <div className="text-sm font-extrabold text-emerald-900">Bank Details</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Label className="font-semibold text-emerald-900">Account Holder Name</Label>
                    <Input
                      name="accountHolder"
                      required
                      value={form.accountHolder}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="As per bank record"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="font-semibold text-emerald-900 flex items-center gap-1">
                      <Hash className="h-3.5 w-3.5" /> Bank Account Number
                    </Label>
                    <Input
                      name="bankAccount"
                      required
                      value={form.bankAccount}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="Account number"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="font-semibold text-emerald-900">IFSC Code</Label>
                    <Input
                      name="ifsc"
                      required
                      value={form.ifsc}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="e.g., HDFC0001234"
                      className="mt-1 uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <Button
  type="submit"
  disabled={loading}
  className="w-full h-11 rounded-xl !font-extrabold text-base shadow hover:brightness-105 active:scale-[0.99]"
  style={{ backgroundColor: DEEP, color: "#fff" }}
>
  {loading ? (
    <span className="inline-flex items-center gap-2 font-extrabold">
      <Loader2 className="h-4 w-4 animate-spin" />
      Registering…
    </span>
  ) : (
    <span className="font-extrabold">Register</span>
  )}
</Button>

              <div className="text-center text-[12px] text-emerald-900/70 font-semibold">
                By continuing, you agree to verification of documents.
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <InlineToast
        open={snackbar.open}
        kind={snackbar.severity === "error" ? "error" : "success"}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        {snackbar.message}
      </InlineToast>
    </div>
  );
}
