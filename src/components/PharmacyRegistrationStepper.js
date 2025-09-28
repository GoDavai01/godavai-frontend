// src/components/PharmacyRegistrationStepper.jsx
import React, { useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import {
  Building2,
  UserRound,
  IdCard,
  Landmark,
  ShieldCheck,
  Clock,
  CheckCircle2,
  FileUp,
  MapPin,
  Mail,
  Phone,
  KeyRound,
  Hash,
} from "lucide-react";

// shadcn/ui
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

/* -------------------- constants (unchanged logic) -------------------- */
const initialForm = {
  name: "",
  legalEntityName: "", // 👈 NEW (A)
  ownerName: "",
  city: "",
  area: "",
  address: "",
  contact: "",
  email: "",
  password: "",
  pin: "",
  open24: false,
  timingFromHour: "",
  timingFromMinute: "",
  timingFromAmPm: "",
  timingToHour: "",
  timingToMinute: "",
  timingToAmPm: "",
  qualification: "",
  stateCouncilReg: "",
  drugLicenseRetail: "",
  gstin: "",
  bankAccount: "",
  ifsc: "",
  bankName: "",
  accountHolder: "",
  declarationAccepted: false,
  businessContact: "",
  businessContactName: "",
  emergencyContact: "",
  lat: "",
  lng: "",
  formattedLocation: "",
};

const hours = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, "0")
);
const minutes = ["00", "15", "30", "45"];
const fileTypes = "image/*,application/pdf"; // (B) broadened for camera + pdf
const steps = [
  "Pharmacy & Owner Details",
  "Licenses & Credentials",
  "Identity & Address Verification",
  "Bank & Operations",
  "Declaration & Submit",
];

const requiredDocs = {
  qualificationCert: "Qualification Certificate (D.Pharm/B.Pharm/Pharm.D)",
  councilCert: "State Pharmacy Council Registration Certificate",
  retailLicense: "Retail Drug License (Form 20/21)",
  gstCert: "GST Certificate",
  identityProof: "Identity Proof (Aadhaar/PAN/Passport)",
  addressProof: "Address Proof (Utility bill/VoterID/Rent agreement)",
  photo: "Passport-size Photo",
};
const optionalDocs = {
  wholesaleLicense: "Wholesale Drug License (if applicable)",
  shopEstablishmentCert:
    "Shop Establishment Certificate (if regionally required)",
  tradeLicense: "Trade License (rare/optional)",
  digitalSignature: "Digital Signature (optional)",
};

function computeTimings(form) {
  if (form.open24) return JSON.stringify({ is24Hours: true });
  const open = `${form.timingFromHour}:${form.timingFromMinute} ${form.timingFromAmPm}`;
  const close = `${form.timingToHour}:${form.timingToMinute} ${form.timingToAmPm}`;
  return JSON.stringify({ is24Hours: false, open, close });
}

const getMsgSeverity = (msg) => {
  if (!msg) return "info";
  const lower = msg.toLowerCase();
  if (
    lower.includes("fail") ||
    lower.includes("error") ||
    lower.includes("required") ||
    lower.includes("highlighted") ||
    lower.includes("missing") ||
    lower.includes("invalid")
  )
    return "error";
  if (lower.includes("success") || lower.includes("submitted") || lower.includes("approved"))
    return "success";
  return "info";
};

const DEEP = "#0f6e51";

/* --------------------- lightweight inline toast --------------------- */
function InlineToast({ open, kind = "success", children, onClose }) {
  if (!open) return null;
  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[1200] rounded-xl px-4 py-3 text-sm font-bold shadow-xl cursor-pointer
      ${kind === "error" ? "bg-red-600 text-white" : "bg-emerald-700 text-white"}`}
      onClick={onClose}
    >
      {children}
    </div>
  );
}

/* --------------------------- Step header UI -------------------------- */
const stepIcons = [Building2, ShieldCheck, IdCard, Landmark, CheckCircle2];

function StepperHeader({ step }) {
  return (
    <div className="relative bg-emerald-50/70 rounded-2xl px-3 py-3 mb-4 overflow-hidden">
      <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1.5 bg-emerald-100 rounded-full" />
      <div
        className="absolute left-4 top-1/2 -translate-y-1/2 h-1.5 bg-emerald-700 rounded-full transition-all"
        style={{
          width:
            step <= 0 ? "0%" : step === 1 ? "25%" : step === 2 ? "50%" : step === 3 ? "75%" : "100%",
        }}
      />
      <div className="relative grid grid-cols-5 gap-1">
        {steps.map((label, idx) => {
          const Icon = stepIcons[idx] || Building2;
          const active = idx <= step;
          return (
            <div key={label} className="flex flex-col items-center">
              <motion.div
                initial={{ scale: 0.9, opacity: 0.65 }}
                animate={{ scale: active ? 1 : 0.95, opacity: active ? 1 : 0.55 }}
                className={`grid place-items-center h-9 w-9 rounded-full border text-white shadow-sm
                  ${active ? "bg-emerald-700 border-emerald-700" : "bg-emerald-200 border-emerald-200"}`}
              >
                <Icon className="h-4 w-4" />
              </motion.div>
              <div
                className={`mt-1 text-[10px] font-extrabold text-center leading-tight
                ${idx === step ? "text-emerald-800" : active ? "text-emerald-600" : "text-gray-400"}`}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------- (C) tiny helpers for camera merges -------------- */
async function readImageBitmap(file) {
  const buf = await file.arrayBuffer();
  const blob = new Blob([buf], { type: file.type });
  return await createImageBitmap(blob);
}

// Merge N images vertically into a single compressed PNG/JPEG under ~2MB
async function mergeImagesVerticallyToBlob(files, targetWidth = 1000) {
  const bitmaps = [];
  for (const f of files) {
    if (!f.type.startsWith("image/")) continue;
    bitmaps.push(await readImageBitmap(f));
  }
  if (!bitmaps.length) return null;

  // scale to common width
  const scaled = bitmaps.map((img) => {
    const scale = targetWidth / img.width;
    const w = Math.round(targetWidth);
    const h = Math.round(img.height * scale);
    return { img, w, h };
  });
  const totalH = scaled.reduce((s, x) => s + x.h, 0);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = totalH;
  const ctx = canvas.getContext("2d");
  let y = 0;
  for (const s of scaled) {
    ctx.drawImage(s.img, 0, y, s.w, s.h);
    y += s.h;
  }

  // Try JPEG first for better size; fallback PNG
  const tryQualities = [0.85, 0.72, 0.6, 0.5, 0.4];
  for (const q of tryQualities) {
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", q));
    if (blob && blob.size <= 2 * 1024 * 1024) return blob;
  }
  return await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.35));
}

/* ---------------------------- Step content --------------------------- */
const StepContent = React.memo(function StepContent({
  step,
  form,
  errors,
  handleChange,
  handleFile,
  handleTimingChange,
  fileErrors,
  requiredDocs,
  optionalDocs,
  hours,
  minutes,
  safe,
  files,
  setForm,
}) {
  if (step === 0)
    return (
      <div className="space-y-3">
        <div>
          <Label className="font-semibold text-emerald-900 flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" /> Pharmacy Name
          </Label>
        </div>
        <Input
          name="name"
          required
          value={safe(form.name)}
          onChange={handleChange}
          className={errors.name ? "ring-2 ring-red-400" : ""}
          placeholder="Your pharmacy name"
        />

        {/* (E) Legal Entity Name just under Pharmacy Name */}
        <div>
          <Label className="font-semibold text-emerald-900 flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" /> Legal Entity Name (optional)
          </Label>
          <Input
            name="legalEntityName"
            value={safe(form.legalEntityName)}
            onChange={handleChange}
            placeholder="e.g., Karniva Private Limited"
          />
        </div>

        <div>
          <Label className="font-semibold text-emerald-900 flex items-center gap-1">
            <UserRound className="h-3.5 w-3.5" /> Pharmacist's Name (Owner)
          </Label>
          <Input
            name="ownerName"
            required
            value={safe(form.ownerName)}
            onChange={handleChange}
            className={errors.ownerName ? "ring-2 ring-red-400" : ""}
            placeholder="Owner full name"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="font-semibold text-emerald-900">City</Label>
            <Input
              name="city"
              required
              value={safe(form.city)}
              onChange={handleChange}
              className={errors.city ? "ring-2 ring-red-400" : ""}
              placeholder="City"
            />
          </div>
          <div>
            <Label className="font-semibold text-emerald-900">Area</Label>
            <Input
              name="area"
              required
              value={safe(form.area)}
              onChange={handleChange}
              className={errors.area ? "ring-2 ring-red-400" : ""}
              placeholder="Area / Locality"
            />
          </div>
        </div>

        <div>
          <Label className="font-semibold text-emerald-900">Full Address</Label>
          <Textarea
            name="address"
            required
            value={safe(form.address)}
            onChange={handleChange}
            className={errors.address ? "ring-2 ring-red-400" : ""}
            rows={3}
            placeholder="Building, street, landmark…"
          />
        </div>

        {/* Set Current Location — now bold */}
        <Button
          type="button"
          aria-label="Set Current Location"
          onClick={async () => {
            if (!navigator.geolocation) {
              alert("Geolocation is not supported on this device/browser.");
              return;
            }
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                try {
                  const res = await axios.get(
                    `${API_BASE_URL}/api/geocode?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
                  );
                  const formatted = res.data.results?.[0]?.formatted_address || "";
                  setForm((f) => ({
                    ...f,
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    formattedLocation: formatted,
                  }));
                } catch {
                  setForm((f) => ({
                    ...f,
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    formattedLocation: `Lat: ${pos.coords.latitude.toFixed(5)}, Lng: ${pos.coords.longitude.toFixed(5)}`,
                  }));
                }
              },
              (err) => alert("Could not fetch location: " + err.message)
            );
          }}
          className={`w-full rounded-xl font-extrabold ${
            form.lat && form.lng ? "bg-emerald-700 text-white" : "bg-white text-emerald-800"
          } border border-emerald-200 hover:bg-emerald-50`}
        >
          <MapPin className="h-4 w-4 mr-2" />
          {form.lat && form.lng ? "Location Set" : "Set Current Location"}
        </Button>
        {form.lat && form.lng && (
          <div className="text-emerald-700 text-xs font-bold">
            Location: {form.formattedLocation}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="font-semibold text-emerald-900 flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" /> Contact Number
            </Label>
            <Input
              name="contact"
              required
              value={safe(form.contact)}
              onChange={handleChange}
              inputMode="numeric"
              maxLength={10}
              className={errors.contact ? "ring-2 ring-red-400" : ""}
              placeholder="10 digit mobile"
            />
            {errors.contact && (
              <div className="text-red-600 text-xs font-semibold mt-1">
                10-digit number
              </div>
            )}
          </div>
          <div>
            <Label className="font-semibold text-emerald-900 flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" /> Login Email
            </Label>
            <Input
              name="email"
              type="email"
              required
              value={safe(form.email)}
              onChange={handleChange}
              className={errors.email ? "ring-2 ring-red-400" : ""}
              placeholder="name@example.com"
            />
            {errors.email && (
              <div className="text-red-600 text-xs font-semibold mt-1">
                Valid email required
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="font-semibold text-emerald-900 flex items-center gap-1">
              <KeyRound className="h-3.5 w-3.5" /> Password
            </Label>
            <Input
              name="password"
              type="password"
              required
              value={safe(form.password)}
              onChange={handleChange}
              className={errors.password ? "ring-2 ring-red-400" : ""}
              placeholder="Min 6 characters"
            />
            {errors.password && (
              <div className="text-red-600 text-xs font-semibold mt-1">
                Min 6 characters
              </div>
            )}
          </div>
          <div>
            <Label className="font-semibold text-emerald-900 flex items-center gap-1">
              <Hash className="h-3.5 w-3.5" /> 4-digit Login PIN
            </Label>
            <Input
              name="pin"
              type="password"
              required
              value={safe(form.pin)}
              onChange={handleChange}
              inputMode="numeric"
              maxLength={4}
              className={errors.pin ? "ring-2 ring-red-400" : ""}
              placeholder="Unique 4-digit PIN"
            />
            {errors.pin && (
              <div className="text-red-600 text-xs font-semibold mt-1">
                PIN must be 4 digits, unique, not same as mobile
              </div>
            )}
          </div>
        </div>

        {/* Timings (mobile-safe; wraps instead of overflowing) */}
        <div className="rounded-xl border border-emerald-200 p-3">
          <label className="inline-flex items-center gap-2 font-bold text-emerald-900">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-700"
              checked={!!form.open24}
              onChange={(e) => handleTimingChange("open24", e.target.checked)}
            />
            Open 24 Hours
          </label>

          {!form.open24 && (
            <div className="mt-3">
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-6">
                {/* From */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[11px] font-bold text-emerald-900">From</span>
                  <div className="flex gap-2 flex-wrap justify-center sm:flex-nowrap">
                    <select
                      value={safe(form.timingFromHour)}
                      onChange={(e) => handleTimingChange("timingFromHour", e.target.value)}
                      className="w-20 sm:w-24 rounded-lg border border-emerald-200 px-2 py-2 bg-white text-sm font-semibold"
                    >
                      <option value="">HH</option>
                      {hours.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <select
                      value={safe(form.timingFromMinute)}
                      onChange={(e) => handleTimingChange("timingFromMinute", e.target.value)}
                      className="w-20 sm:w-24 rounded-lg border border-emerald-200 px-2 py-2 bg-white text-sm font-semibold"
                    >
                      <option value="">MM</option>
                      {minutes.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={safe(form.timingFromAmPm)}
                      onChange={(e) => handleTimingChange("timingFromAmPm", e.target.value)}
                      className="w-20 sm:w-24 rounded-lg border border-emerald-200 px-2 py-2 bg-white text-sm font-semibold"
                    >
                      <option value="">AM/PM</option>
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                <Clock className="hidden sm:block h-5 w-5 text-emerald-700" />

                {/* To */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[11px] font-bold text-emerald-900">To</span>
                  <div className="flex gap-2 flex-wrap justify-center sm:flex-nowrap">
                    <select
                      value={safe(form.timingToHour)}
                      onChange={(e) => handleTimingChange("timingToHour", e.target.value)}
                      className="w-20 sm:w-24 rounded-lg border border-emerald-200 px-2 py-2 bg-white text-sm font-semibold"
                    >
                      <option value="">HH</option>
                      {hours.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <select
                      value={safe(form.timingToMinute)}
                      onChange={(e) => handleTimingChange("timingToMinute", e.target.value)}
                      className="w-20 sm:w-24 rounded-lg border border-emerald-200 px-2 py-2 bg-white text-sm font-semibold"
                    >
                      <option value="">MM</option>
                      {minutes.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={safe(form.timingToAmPm)}
                      onChange={(e) => handleTimingChange("timingToAmPm", e.target.value)}
                      className="w-20 sm:w-24 rounded-lg border border-emerald-200 px-2 py-2 bg-white text-sm font-semibold"
                    >
                      <option value="">AM/PM</option>
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>

              {errors.pharmacyTimings && (
                <div className="text-red-600 text-xs font-semibold text-center mt-2">
                  Please fill complete timings or select “24 Hours”
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );

  if (step === 1)
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="font-semibold text-emerald-900">
              Pharmacy Qualification
            </Label>
            <Input
              name="qualification"
              required
              value={safe(form.qualification)}
              onChange={handleChange}
              className={errors.qualification ? "ring-2 ring-red-400" : ""}
              placeholder="D.Pharm / B.Pharm / Pharm.D"
            />
          </div>
          <div>
            <Label className="font-semibold text-emerald-900">
              State Pharmacy Council Reg. No.
            </Label>
            <Input
              name="stateCouncilReg"
              required
              value={safe(form.stateCouncilReg)}
              onChange={handleChange}
              className={errors.stateCouncilReg ? "ring-2 ring-red-400" : ""}
            />
          </div>
          <div>
            <Label className="font-semibold text-emerald-900">
              Retail Drug License No.
            </Label>
            <Input
              name="drugLicenseRetail"
              required
              value={safe(form.drugLicenseRetail)}
              onChange={handleChange}
              className={errors.drugLicenseRetail ? "ring-2 ring-red-400" : ""}
            />
          </div>
          <div>
            <Label className="font-semibold text-emerald-900">
              GST Registration Number (GSTIN)
            </Label>
            <Input
              name="gstin"
              required
              value={safe(form.gstin)}
              onChange={handleChange}
              className={errors.gstin ? "ring-2 ring-red-400" : ""}
            />
          </div>
        </div>

        {/* (F) Required docs with Upload + Camera, multi-capture */}
        {Object.keys(requiredDocs).map((k) => {
          const inputId = `${k}-file`;
          return (
            <div key={k} className="space-y-1">
              <Label className="font-semibold text-emerald-900">
                {requiredDocs[k]} <span className="text-red-600">*</span>
              </Label>

              <div className="flex items-center gap-2">
                <input
                  id={inputId}
                  type="file"
                  accept={fileTypes}
                  multiple
                  capture="environment"
                  hidden
                  onChange={(e) => handleFile(e, k)}
                />

                <label
                  htmlFor={inputId}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 cursor-pointer hover:bg-emerald-100 transition"
                >
                  <FileUp className="h-4 w-4" />
                  Upload
                </label>

                <label
                  htmlFor={inputId}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-800 cursor-pointer hover:bg-emerald-50 transition"
                  title="Use camera (mobile)"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  Camera
                </label>
              </div>

              <div className="text-xs font-semibold">
                {files[k] instanceof File && (
                  <span className="text-emerald-700">
                    Selected: {files[k].name}
                  </span>
                )}
                {!files[k] && (errors[k] || fileErrors[k]) && (
                  <span className="text-red-600">{fileErrors[k] || "Required"}</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Optional docs with the same pattern */}
        {Object.keys(optionalDocs).map((k) => {
          const inputId = `${k}-file`;
          return (
            <div key={k} className="space-y-1">
              <Label className="font-semibold text-emerald-900">
                {optionalDocs[k]}
              </Label>

              <div className="flex items-center gap-2">
                <input
                  id={inputId}
                  type="file"
                  accept={fileTypes}
                  multiple
                  capture="environment"
                  hidden
                  onChange={(e) => handleFile(e, k)}
                />

                <label
                  htmlFor={inputId}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 cursor-pointer hover:bg-emerald-100 transition"
                >
                  <FileUp className="h-4 w-4" />
                  Upload
                </label>

                <label
                  htmlFor={inputId}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-800 cursor-pointer hover:bg-emerald-50 transition"
                  title="Use camera (mobile)"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  Camera
                </label>
              </div>

              <div className="text-xs font-semibold">
                {files[k] instanceof File && (
                  <span className="text-emerald-700">Selected: {files[k].name}</span>
                )}
                {fileErrors[k] && <span className="text-red-600">{fileErrors[k]}</span>}
              </div>
            </div>
          );
        })}
      </div>
    );

  if (step === 2)
    return (
      <div className="space-y-3">
        {["identityProof", "addressProof", "photo"].map((k) => {
          const inputId = `${k}-file`;
          return (
            <div key={k} className="space-y-1">
              <Label className="font-semibold text-emerald-900">
                {requiredDocs[k]}
                <span className="text-red-600"> *</span>
              </Label>

              <div className="flex items-center gap-2">
                <input
                  id={inputId}
                  type="file"
                  accept={fileTypes}
                  multiple
                  capture="environment"
                  hidden
                  onChange={(e) => handleFile(e, k)}
                />

                <label
                  htmlFor={inputId}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 cursor-pointer hover:bg-emerald-100 transition"
                >
                  <FileUp className="h-4 w-4" />
                  Upload
                </label>

                <label
                  htmlFor={inputId}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-800 cursor-pointer hover:bg-emerald-50 transition"
                  title="Use camera (mobile)"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  Camera
                </label>
              </div>

              <div className="text-xs font-semibold">
                {files[k] instanceof File && (
                  <span className="text-emerald-700">Selected: {files[k].name}</span>
                )}
                {!files[k] && (errors[k] || fileErrors[k]) && (
                  <span className="text-red-600">{fileErrors[k] || "Required"}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );

  if (step === 3)
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="font-semibold text-emerald-900">
              Bank Account Number
            </Label>
            <Input
              name="bankAccount"
              required
              value={safe(form.bankAccount)}
              onChange={handleChange}
              className={errors.bankAccount ? "ring-2 ring-red-400" : ""}
            />
          </div>
          <div>
            <Label className="font-semibold text-emerald-900">
              Account Holder Name
            </Label>
            <Input
              name="accountHolder"
              required
              value={safe(form.accountHolder)}
              onChange={handleChange}
              className={errors.accountHolder ? "ring-2 ring-red-400" : ""}
            />
          </div>
          <div>
            <Label className="font-semibold text-emerald-900">Bank Name</Label>
            <Input
              name="bankName"
              required
              value={safe(form.bankName)}
              onChange={handleChange}
              className={errors.bankName ? "ring-2 ring-red-400" : ""}
            />
          </div>
          <div>
            <Label className="font-semibold text-emerald-900">IFSC Code</Label>
            <Input
              name="ifsc"
              required
              value={safe(form.ifsc)}
              onChange={handleChange}
              className={errors.ifsc ? "ring-2 ring-red-400" : ""}
              placeholder="e.g., HDFC0001234"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="font-semibold text-emerald-900">
              Business Contact Person (optional)
            </Label>
            <Input
              name="businessContactName"
              value={safe(form.businessContactName)}
              onChange={handleChange}
            />
          </div>
          <div>
            <Label className="font-semibold text-emerald-900">
              Business Contact Number
            </Label>
            <Input
              name="businessContact"
              value={safe(form.businessContact)}
              onChange={handleChange}
            />
          </div>
          <div>
            <Label className="font-semibold text-emerald-900">
              Emergency / Alternate Number
            </Label>
            <Input
              name="emergencyContact"
              value={safe(form.emergencyContact)}
              onChange={handleChange}
            />
          </div>
        </div>

        <div>
          <Label className="font-semibold text-emerald-900">
            Digital Signature (optional)
          </Label>

          {/* (F) Upload + Camera for digital signature too */}
          <div className="flex items-center gap-2">
            <input
              id="digitalSignature-file"
              type="file"
              accept={fileTypes}
              multiple
              capture="environment"
              hidden
              onChange={(e) => handleFile(e, "digitalSignature")}
            />

            <label
              htmlFor="digitalSignature-file"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 cursor-pointer hover:bg-emerald-100 transition"
            >
              <FileUp className="h-4 w-4" />
              Upload
            </label>

            <label
              htmlFor="digitalSignature-file"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-800 cursor-pointer hover:bg-emerald-50 transition"
              title="Use camera (mobile)"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              Camera
            </label>
          </div>
        </div>
      </div>
    );

  if (step === 4)
    return (
      <div className="space-y-3">
        <p className="text-emerald-900/80 font-semibold">
          I confirm all the above documents and details are valid and agree to
          the platform’s terms and local laws.
        </p>
        <label className="inline-flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-emerald-700"
            name="declarationAccepted"
            checked={!!form.declarationAccepted}
            onChange={handleChange}
            required
          />
          <span className="text-sm font-bold text-emerald-900">
            I accept the Terms of Service, Privacy Policy, and declare all
            information provided is true.
          </span>
        </label>
        {errors.declarationAccepted && (
          <div className="text-red-600 text-xs font-semibold">
            You must accept the declaration to proceed.
          </div>
        )}
      </div>
    );

  return null;
});

/* ------------------------------- Component ------------------------------- */
export default function PharmacyRegistrationStepper() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...initialForm });
  const [files, setFiles] = useState({});
  const [fileErrors, setFileErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [errors, setErrors] = useState({});

  const safe = (v) => (typeof v === "string" ? v : "");

  // input handlers (logic preserved)
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? checked : value || "",
    }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  };

  const handleTimingChange = (name, value) => {
    setForm((f) => ({
      ...f,
      [name]: value || "",
      ...(name === "open24" && value
        ? {
            timingFromHour: "",
            timingFromMinute: "",
            timingFromAmPm: "",
            timingToHour: "",
            timingToMinute: "",
            timingToAmPm: "",
          }
        : {}),
    }));
    setErrors((er) => ({ ...er, pharmacyTimings: undefined }));
  };

  // (D) file logic: supports multi images -> merged single file, 2MB cap
  const handleFile = async (e, key) => {
    const flist = Array.from(e.target.files || []);
    if (!flist.length) return;

    // If multiple images, merge vertically into one file
    const allAreImages = flist.every((f) => f.type.startsWith("image/"));
    if (flist.length > 1 && allAreImages) {
      try {
        const mergedBlob = await mergeImagesVerticallyToBlob(flist, 1000);
        if (!mergedBlob) {
          setFileErrors((f) => ({ ...f, [key]: "Couldn’t process images" }));
          return;
        }
        if (mergedBlob.size > 2 * 1024 * 1024) {
          setFileErrors((f) => ({ ...f, [key]: "Merged file exceeds 2MB" }));
          return;
        }
        const mergedFile = new File([mergedBlob], `${key}-merged.jpg`, { type: "image/jpeg" });
        setFileErrors((f) => ({ ...f, [key]: undefined }));
        setFiles((f) => ({ ...f, [key]: mergedFile }));
        return;
      } catch (err) {
        setFileErrors((f) => ({ ...f, [key]: "Merge failed" }));
        return;
      }
    }

    // Single file path (image or PDF)
    const file = flist[0];
    if (
      ![
        "image/jpeg",
        "image/png",
        "application/pdf",
        "image/heic",
        "image/webp",
        "image/jpg",
      ].includes(file.type)
    ) {
      setFileErrors((f) => ({ ...f, [key]: "Invalid file type (use PDF/JPG/PNG)" }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFileErrors((f) => ({ ...f, [key]: "Max 2MB allowed" }));
      return;
    }
    setFileErrors((f) => ({ ...f, [key]: undefined }));
    setFiles((f) => ({ ...f, [key]: file }));
  };

  // validation (preserved)
  function validateStep() {
    let tempErr = {};
    if (step === 0) {
      if (!form.name) tempErr.name = true;
      if (!form.ownerName) tempErr.ownerName = true;
      if (!form.city) tempErr.city = true;
      if (!form.area) tempErr.area = true;
      if (!form.address) tempErr.address = true;
      if (!form.contact || !/^\d{10}$/.test(form.contact)) tempErr.contact = true;
      if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        tempErr.email = true;
      if (!form.password || form.password.length < 6) tempErr.password = true;
      if (!form.pin || !/^\d{4}$/.test(form.pin) || form.pin === form.contact)
        tempErr.pin = true;
      if (
        !form.open24 &&
        (!form.timingFromHour ||
          !form.timingFromMinute ||
          !form.timingFromAmPm ||
          !form.timingToHour ||
          !form.timingToMinute ||
          !form.timingToAmPm)
      )
        tempErr.pharmacyTimings = true;
    }
    if (step === 1) {
      if (!form.qualification) tempErr.qualification = true;
      if (!form.stateCouncilReg) tempErr.stateCouncilReg = true;
      if (!form.drugLicenseRetail) tempErr.drugLicenseRetail = true;
      if (!form.gstin) tempErr.gstin = true;
      if (!files.qualificationCert) tempErr.qualificationCert = true;
      if (!files.councilCert) tempErr.councilCert = true;
      if (!files.retailLicense) tempErr.retailLicense = true;
      if (!files.gstCert) tempErr.gstCert = true;
    }
    if (step === 2) {
      if (!files.identityProof) tempErr.identityProof = true;
      if (!files.addressProof) tempErr.addressProof = true;
      if (!files.photo) tempErr.photo = true;
    }
    if (step === 3) {
      if (!form.bankAccount) tempErr.bankAccount = true;
      if (!form.accountHolder) tempErr.accountHolder = true;
      if (!form.bankName) tempErr.bankName = true;
      if (!form.ifsc) tempErr.ifsc = true;
    }
    if (step === 4) {
      if (!form.declarationAccepted) tempErr.declarationAccepted = true;
    }
    setErrors(tempErr);
    return Object.keys(tempErr).length > 0
      ? "Please fill highlighted fields correctly!"
      : "";
  }

  // submit/next (logic & flow preserved)
  const handleStepSubmit = async (e) => {
    if (e) e.preventDefault();

    const errMsg = validateStep();
    if (errMsg) {
      setMsg(errMsg);
      return;
    }

    if (step < steps.length - 1) {
      // clear file state for the *next* step (as in your original flow)
      setFiles((f) => {
        const nf = { ...f };
        if (step + 1 === 1) {
          [...Object.keys(requiredDocs), ...Object.keys(optionalDocs)].forEach(
            (k) => delete nf[k]
          );
        }
        if (step + 1 === 2) {
          ["identityProof", "addressProof", "photo"].forEach((k) => delete nf[k]);
        }
        if (step + 1 === 3) delete nf["digitalSignature"];
        return nf;
      });
      setStep((s) => s + 1);
      return;
    }

    // final submit
    setLoading(true);
    try {
      const fd = new FormData();
      Object.keys(form).forEach((k) => fd.append(k, form[k] || ""));
      fd.set("pharmacyTimings", computeTimings(form));
      if (form.lat && form.lng) {
        fd.append("lat", form.lat);
        fd.append("lng", form.lng);
        fd.append("locationFormatted", form.formattedLocation || "");
      }
      Object.keys(files).forEach((k) => files[k] && fd.append(k, files[k]));

      // required files presence check
      [
        "qualificationCert",
        "councilCert",
        "retailLicense",
        "gstCert",
        "identityProof",
        "addressProof",
        "photo",
      ].forEach((f) => {
        if (!files[f]) {
          // eslint-disable-next-line no-alert
          alert(`You must upload: ${f.replace(/([A-Z])/g, " $1")}`);
          throw new Error("Missing file: " + f);
        }
      });

      setMsg("");
      await axios.post(`${API_BASE_URL}/api/pharmacy/register`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMsg("Registration submitted! Await admin approval.");
      setForm({ ...initialForm });
      setFiles({});
      setStep(0);
    } catch (err) {
      if (err.response?.data?.fieldsMissing) {
        const missing = err.response.data.fieldsMissing;
        let newErrors = { ...errors };
        missing.forEach((f) => (newErrors[f] = true));
        setErrors(newErrors);
        setMsg(
          "Please fill the highlighted fields: " +
            missing.map((f) => f.replace(/([A-Z])/g, " $1")).join(", ")
        );
      } else {
        setMsg(
          err.response?.data?.message ||
            "Registration failed. Check your details!"
        );
      }
    }
    setLoading(false);
  };

  const handleBack = () => {
    setFiles((f) => {
      const nf = { ...f };
      if (step === 1) {
        [...Object.keys(requiredDocs), ...Object.keys(optionalDocs)].forEach(
          (k) => delete nf[k]
        );
      }
      if (step === 2) {
        ["identityProof", "addressProof", "photo"].forEach((k) => delete nf[k]);
      }
      if (step === 3) delete nf["digitalSignature"];
      return nf;
    });
    setStep((s) => s - 1);
  };

  /* ------------------------------ render ------------------------------ */
  return (
    <div className="min-h-screen bg-slate-50 py-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto px-3 sm:px-4"
      >
        <Card className="rounded-3xl border-emerald-100/70 shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <div className="text-center mb-3">
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-emerald-100 text-emerald-800 font-extrabold text-sm">
                <Building2 className="h-4 w-4" />
                GoDavaii
              </div>
              <h1
                className="mt-2 text-2xl font-black tracking-tight"
                style={{ color: DEEP }}
              >
                Pharmacy Registration
              </h1>
              <p className="text-[13px] text-emerald-900/70 font-semibold">
                Deep-green, clean, and compliant onboarding 🌿
              </p>
            </div>

            {/* Modern Stepper */}
            <StepperHeader step={step} />

            <form onSubmit={handleStepSubmit} autoComplete="off">
              <StepContent
                step={step}
                form={form}
                errors={errors}
                handleChange={handleChange}
                handleFile={handleFile}
                handleTimingChange={handleTimingChange}
                fileErrors={fileErrors}
                requiredDocs={requiredDocs}
                optionalDocs={optionalDocs}
                hours={hours}
                minutes={minutes}
                safe={safe}
                files={files}
                setForm={setForm}
              />

              {/* Actions */}
              <div className="mt-4 flex gap-2">
                {step > 0 && step < 5 && (
                  <Button
                    type="button"
                    onClick={handleBack}
                    variant="outline"
                    className="font-bold"
                    style={{ borderColor: "#10b981", color: "#0f766e" }}
                  >
                    Back
                  </Button>
                )}

                {step < 4 && (
                  <Button
                    type="submit"
                    className="font-extrabold bg-emerald-700 hover:bg-emerald-800 text-white"
                  >
                    Next
                  </Button>
                )}

                {step === 4 && (
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full font-extrabold bg-emerald-700 hover:bg-emerald-800 text-white"
                  >
                    {loading ? "Submitting..." : "Submit Registration"}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <InlineToast
        open={!!msg}
        kind={getMsgSeverity(msg) === "error" ? "error" : "success"}
        onClose={() => setMsg("")}
      >
        {msg}
      </InlineToast>
    </div>
  );
}
