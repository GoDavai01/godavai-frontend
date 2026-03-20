import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  BadgeCheck,
  Building2,
  ChevronRight,
  ChevronLeft,
  FileUp,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Eye,
  EyeOff,
  Landmark,
  Camera,
  CheckCircle2,
  Loader2,
  Phone,
  Mail,
  Lock,
  MapPin,
} from "lucide-react";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const STEP_TITLES = ["Identity & Practice", "Documents & Bank", "Review & Consent"];

const SPECIALTIES = [
  "General Physician", "Internal Medicine", "Family Medicine", "Cardiology",
  "Dermatology", "Pediatrics", "Gynecology", "ENT", "Orthopedics",
  "Psychiatry", "Neurology", "Pulmonology", "Endocrinology",
  "Gastroenterology", "Nephrology", "Ophthalmology", "Urology",
  "Oncology", "Diabetology", "Rheumatology", "Sports Medicine",
  "Dentistry", "Physiotherapy", "General Surgery", "Nutrition",
];

const SMC_COUNCILS = [
  "Andhra Pradesh Medical Council", "Arunachal Pradesh Medical Council",
  "Assam Medical Council", "Bihar Medical Council", "Chhattisgarh Medical Council",
  "Delhi Medical Council", "Goa Medical Council", "Gujarat Medical Council",
  "Haryana Medical Council", "Himachal Pradesh Medical Council",
  "Jharkhand Medical Council", "Karnataka Medical Council",
  "Kerala Medical Council", "Madhya Pradesh Medical Council",
  "Maharashtra Medical Council", "Manipur Medical Council",
  "Meghalaya Medical Council", "Mizoram Medical Council",
  "Nagaland Medical Council", "Odisha Medical Council",
  "Punjab Medical Council", "Rajasthan Medical Council",
  "Sikkim Medical Council", "Tamil Nadu Medical Council",
  "Telangana Medical Council", "Tripura Medical Council",
  "Uttar Pradesh Medical Council", "Uttarakhand Medical Council",
  "West Bengal Medical Council", "Indian Medical Council (NMC)",
];

function asNum(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function serviceBand(fee) {
  const f = asNum(fee);
  if (f <= 500) return { band: "₹0-500", fee: "₹19 + GST", manual: false };
  if (f <= 1000) return { band: "₹501-1000", fee: "₹39 + GST", manual: false };
  if (f <= 1500) return { band: "₹1001-1500", fee: "₹59 + GST", manual: false };
  if (f <= 2000) return { band: "₹1501-2000", fee: "₹79 + GST", manual: false };
  return { band: "₹2001+", fee: "Manual approval needed", manual: true };
}

/* ═══════════════════ UPLOADER ═══════════════════ */
function Uploader({ label, required = false, file, onChange, hint = "", accept }) {
  return (
    <label style={S.uploadCard}>
      <input
        type="file"
        accept={accept || ".pdf,.jpg,.jpeg,.png,.webp,.heic"}
        style={{ display: "none" }}
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <FileUp style={{ width: 14, height: 14, color: "#13C0A2" }} />
        <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>
          {label} {required ? <span style={{ color: "#EF4444" }}>*</span> : ""}
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: file ? "#059669" : "#94A3B8", marginTop: 4 }}>
        {file ? `✓ ${file.name}` : "Tap to upload (PDF/JPG/PNG)"}
      </div>
      {hint ? <div style={S.uploadHint}>{hint}</div> : null}
    </label>
  );
}

/* ═══════════════════ SECTION TITLE ═══════════════════ */
function SectionTitle({ icon: Icon, text }) {
  return (
    <div style={S.sectionTitle}>
      <div style={S.sectionIconWrap}>
        <Icon style={{ width: 14, height: 14, color: "#13C0A2" }} />
      </div>
      {text}
    </div>
  );
}

/* ═══════════════════ MODE PILL ═══════════════════ */
function ModePill({ active, onClick, label, emoji }) {
  return (
    <button type="button" onClick={onClick} style={{ ...S.modePill, ...(active ? S.modePillActive : null) }}>
      <span style={{ fontSize: 16 }}>{emoji}</span> {label}
    </button>
  );
}

/* ═══════════════════ INPUT WRAPPER ═══════════════════ */
function Input({ icon: Icon, ...props }) {
  return (
    <div style={S.inputWrap}>
      {Icon && <Icon style={S.inputIcon} />}
      <input {...props} style={{ ...S.input, ...(Icon ? { paddingLeft: 34 } : {}) }} />
    </div>
  );
}

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */
export default function DoctorRegister() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationNote, setLocationNote] = useState("");
  const [showPw, setShowPw] = useState(false);


  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    otp: "",
    email: "",
    password: "",
    confirmPassword: "",
    dateOfBirth: "",
    gender: "",
    specialty: "General Physician",
    subSpecialty: "",
    bio: "",
    yearsExperience: "",
    languages: "English, Hindi",
    city: "",
    area: "",
    availableStart: "09:00",
    availableEnd: "17:00",
    modeAudio: true,
    modeVideo: false,
    modeInPerson: false,
    feeAudio: "",
    feeVideo: "",
    feeInPerson: "",
    specialistRequired: false,
    // Step 2 — Documents / NMC
    registrationNumber: "",
    smcName: "",
    registrationYear: "",
    qualification: "",
    university: "",
    qualificationYear: "",
    // Bank
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    // Clinic
    clinicName: "",
    clinicAddress: "",
    clinicLocality: "",
    clinicPincode: "",
    clinicLat: "",
    clinicLng: "",
    slotDurationMins: "15",
    patientArrivalWindowMins: "",
    maxPatientsPerDay: "",
    // Step 3 — Consents
    consentRegisteredDoctor: false,
    consentVerification: false,
    consentTerms: false,
    consentPlatformFee: false,
  });

  const [files, setFiles] = useState({
    profilePhoto: null,
    registrationCertificate: null,
    mbbsDegree: null,
    specialistDegree: null,
    pan: null,
    bankProof: null,
    clinicProof: null,
    signature: null,
  });

  // ── Auto-skip OTP if logged-in user's phone matches ──
  const loggedInPhone = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return (u?.phone || u?.mobile || "").replace(/\D/g, "").slice(-10);
    } catch { return ""; }
  })();
  const isPhoneAutoVerified = loggedInPhone.length === 10 && form.phone.replace(/\D/g, "") === loggedInPhone;

  // Primary fee for band calculation
  const primaryFee = Math.max(asNum(form.feeAudio), asNum(form.feeVideo), asNum(form.feeInPerson));
  const band = useMemo(() => serviceBand(primaryFee), [primaryFee]);

  function patch(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  /* ── Location ── */
  function useCurrentLocation() {
    setError("");
    setLocationNote("");
    if (!navigator?.geolocation) {
      setError("Location not supported on this device.");
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos?.coords?.latitude || 0).toFixed(6);
        const lng = Number(pos?.coords?.longitude || 0).toFixed(6);
        patch("clinicLat", lat);
        patch("clinicLng", lng);
        setLocationNote("Location detected.");
        try {
          const { data } = await axios.get("https://nominatim.openstreetmap.org/reverse", {
            params: { format: "jsonv2", lat, lon: lng },
            timeout: 9000,
          });
          const a = data?.address || {};
          const guessedCity = a.city || a.town || a.village || a.state_district || a.state || "";
          const guessedLocality = a.suburb || a.neighbourhood || a.city_district || a.county || "";
          const guessedAddress = data?.display_name || "";
          setForm((prev) => ({
            ...prev,
            clinicAddress: prev.clinicAddress?.trim() ? prev.clinicAddress : guessedAddress,
            clinicLocality: prev.clinicLocality?.trim() ? prev.clinicLocality : guessedLocality,
            city: prev.city?.trim() ? prev.city : guessedCity,
          }));
          setLocationNote("Location + area detected. Verify before submit.");
        } catch (_) {
          setLocationNote("Location detected. Fill address manually.");
        }
        setLocationLoading(false);
      },
      () => {
        setLocationLoading(false);
        setError("Unable to access location. Allow GPS permission.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  /* ── OTP ── */
  async function sendOtp() {
    setOtpSending(true);
    setError("");
    try {
      await axios.post(`${API}/api/auth/send-otp`, { identifier: form.phone.trim() });
      setOtpSent(true);
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.raw?.message || "Failed to send OTP");
    } finally {
      setOtpSending(false);
    }
  }

  async function verifyOtp() {
    setOtpVerifying(true);
    setError("");
    try {
      await axios.post(`${API}/api/auth/verify-otp`, { identifier: form.phone.trim(), otp: form.otp.trim() });
      setOtpVerified(true);
    } catch (e) {
      setError(e?.response?.data?.error || "OTP verification failed");
    } finally {
      setOtpVerifying(false);
    }
  }

  /* ── Validations ── */
  function validateStep1() {
    if (!form.fullName.trim()) return "Full name is required.";
    if (form.phone.trim().length < 10) return "Enter valid 10-digit phone number.";
    if (!otpVerified && !isPhoneAutoVerified) return "Please verify mobile OTP.";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Enter a valid email address.";
    if (!form.password || form.password.length < 6) return "Password must be at least 6 characters.";
    if (form.password !== form.confirmPassword) return "Passwords do not match.";
    if (!form.dateOfBirth) return "Date of birth is required.";
    if (!form.gender) return "Please select gender.";
    if (!form.specialty) return "Specialty is required.";
    if (!form.city.trim() || !form.area.trim()) return "City and area are required.";
    if (!(form.modeAudio || form.modeVideo || form.modeInPerson)) return "Select at least one consultation mode.";
    if (form.modeAudio && asNum(form.feeAudio) <= 0) return "Enter audio consultation fee.";
    if (form.modeVideo && asNum(form.feeVideo) <= 0) return "Enter video consultation fee.";
    if (form.modeInPerson && asNum(form.feeInPerson) <= 0) return "Enter in-person consultation fee.";
    if (!form.availableStart || !form.availableEnd) return "Select available timings.";
    if (form.availableStart >= form.availableEnd) return "End time must be after start time.";
    return "";
  }

  function validateStep2() {
    if (!form.registrationNumber.trim()) return "Medical registration number is required.";
    if (!form.smcName) return "State Medical Council is required.";
    if (!files.registrationCertificate || !files.mbbsDegree || !files.pan || !files.bankProof) {
      return "Upload all mandatory documents (Reg. Certificate, MBBS, PAN, Bank Proof).";
    }
    if (form.specialistRequired && !files.specialistDegree) return "Specialist degree upload is required.";
    // Bank details
    if (!form.accountHolderName.trim()) return "Account holder name is required.";
    if (!form.bankName.trim()) return "Bank name is required.";
    if (!form.accountNumber.trim()) return "Account number is required.";
    if (form.accountNumber !== form.confirmAccountNumber) return "Account numbers do not match.";
    if (!form.ifscCode.trim()) return "IFSC code is required.";
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(form.ifscCode)) return "Invalid IFSC code format.";
    // Clinic
    if (form.modeInPerson) {
      if (!form.clinicName.trim() || !form.clinicAddress.trim() || !form.clinicPincode.trim()) return "Clinic details required for in-person mode.";
      if (!form.clinicLat.trim() || !form.clinicLng.trim()) return "Clinic map pin is required. Use 'Detect Location'.";
      if (!files.clinicProof) return "Clinic proof upload is required.";
    }
    return "";
  }

  function validateStep3() {
    if (!(form.consentRegisteredDoctor && form.consentVerification && form.consentTerms && form.consentPlatformFee)) {
      return "Please accept all required consents.";
    }
    return "";
  }

  function nextStep() {
    const validator = step === 1 ? validateStep1 : step === 2 ? validateStep2 : validateStep3;
    const msg = validator();
    if (msg) return setError(msg);
    setError("");
    setStep((p) => Math.min(3, p + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ── Submit ── */
  async function submit() {
    const msg = validateStep3();
    if (msg) return setError(msg);
    setLoading(true);
    setError("");
    try {
      const availableTimings = `${form.availableStart} - ${form.availableEnd}`;
      const fd = new FormData();
      // Append all form fields
      Object.entries(form).forEach(([k, v]) => {
        if (k === "otp" || k === "confirmPassword") return; // don't send these
        fd.append(k, typeof v === "boolean" ? String(v) : v);
      });
      fd.set("availableTimings", availableTimings);
      fd.append("otpVerified", "true");
      // Append files
      Object.entries(files).forEach(([k, v]) => {
        if (v) fd.append(k, v);
      });
      await axios.post(`${API}/api/doctors/onboarding/submit`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSuccess(true);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to submit registration");
    } finally {
      setLoading(false);
    }
  }

  /* ═══════════════════ SUCCESS SCREEN ═══════════════════ */
  if (success) {
    return (
      <div style={S.page}>
        <div style={S.wrap}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={S.successCard}
          >
            <CheckCircle2 style={{ width: 56, height: 56, color: "#10B981" }} />
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", fontFamily: "'Sora',sans-serif" }}>
              Registration Submitted!
            </div>
            <div style={{ fontSize: 14, color: "#64748B", fontWeight: 600, lineHeight: 1.6, textAlign: "center", maxWidth: 380 }}>
              Your account is now <strong style={{ color: "#F59E0B" }}>pending admin verification</strong>.
              You'll be notified once approved. After approval, login with your <strong>email & password</strong>.
            </div>
            <button style={S.primaryBtn} onClick={() => navigate("/doctor/login")}>
              Go to Doctor Login
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <div style={S.page}>
      <div style={S.wrap}>
        {/* ── Hero ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={S.hero}>
          <div style={S.heroIcon}>
            <Stethoscope style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={S.heroTitle}>Join GoDavaii as a Doctor</div>
            <div style={S.heroSub}>2-minute registration • Audio, Video & In-Person</div>
          </div>
        </motion.div>

        {/* ── Step Indicator ── */}
        <div style={S.stepRow}>
          {STEP_TITLES.map((t, i) => {
            const num = i + 1;
            const isActive = step === num;
            const isDone = step > num;
            return (
              <div
                key={t}
                style={{
                  ...S.stepChip,
                  ...(isActive ? S.stepActive : {}),
                  ...(isDone ? S.stepDone : {}),
                }}
              >
                <div style={{
                  ...S.stepNum,
                  ...(isActive ? { background: "#13C0A2", color: "#fff" } : {}),
                  ...(isDone ? { background: "#10B981", color: "#fff" } : {}),
                }}>
                  {isDone ? "✓" : num}
                </div>
                <span style={{ display: "inline-block" }}>{t}</span>
              </div>
            );
          })}
        </div>

        {/* ── Form Card ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            style={S.card}
          >
            {/* ════════════ STEP 1 ════════════ */}
            {step === 1 && (
              <div style={S.grid}>
                <SectionTitle icon={UserRound} text="Your Identity" />

                {/* Profile Photo (optional) */}
                <div style={S.photoRow}>
                  <label style={S.photoUpload}>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.heic"
                      style={{ display: "none" }}
                      onChange={(e) => setFiles((p) => ({ ...p, profilePhoto: e.target.files?.[0] || null }))}
                    />
                    {files.profilePhoto ? (
                      <img
                        src={URL.createObjectURL(files.profilePhoto)}
                        alt="Profile"
                        style={S.photoPreview}
                      />
                    ) : (
                      <Camera style={{ width: 20, height: 20, color: "#94A3B8" }} />
                    )}
                  </label>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>Profile Photo</div>
                    <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>Optional • Builds patient trust</div>
                  </div>
                </div>

                <Input icon={UserRound} placeholder="Full Name *" value={form.fullName} onChange={(e) => patch("fullName", e.target.value)} />

                <div style={S.row2}>
                  <Input icon={Phone} placeholder="Mobile Number *" value={form.phone} onChange={(e) => patch("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} />
                  {!isPhoneAutoVerified && !otpVerified && (
                    <button style={S.otpBtn} onClick={sendOtp} type="button" disabled={otpSending || form.phone.trim().length < 10}>
                      {otpSending ? <Loader2 style={S.spin} /> : otpSent ? "Resend" : "Send OTP"}
                    </button>
                  )}
                </div>

                {/* Auto-verified — same phone as logged-in user */}
                {isPhoneAutoVerified && (
                  <div style={S.verifiedBadge}>
                    <CheckCircle2 style={{ width: 14, height: 14 }} /> Auto-verified (logged-in number)
                  </div>
                )}

                {/* OTP flow — only if different phone number */}
                {!isPhoneAutoVerified && otpSent && !otpVerified && (
                  <div style={S.row2}>
                    <Input placeholder="Enter OTP *" value={form.otp} onChange={(e) => patch("otp", e.target.value)} />
                    <button style={{ ...S.otpBtn, ...(otpVerified ? { background: "#10B981" } : {}) }} onClick={verifyOtp} type="button" disabled={otpVerifying || otpVerified || !form.otp.trim()}>
                      {otpVerifying ? <Loader2 style={S.spin} /> : otpVerified ? "✓ Verified" : "Verify"}
                    </button>
                  </div>
                )}

                {!isPhoneAutoVerified && otpVerified && (
                  <div style={S.verifiedBadge}>
                    <CheckCircle2 style={{ width: 14, height: 14 }} /> Phone verified via OTP
                  </div>
                )}

                <Input icon={Mail} placeholder="Email Address *" type="email" value={form.email} onChange={(e) => patch("email", e.target.value)} />

                <div style={S.row2equal}>
                  <div style={S.inputWrap}>
                    <Lock style={S.inputIcon} />
                    <input
                      style={{ ...S.input, paddingLeft: 34, paddingRight: 38 }}
                      placeholder="Create Password *"
                      type={showPw ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => patch("password", e.target.value)}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} style={S.eyeBtn}>
                      {showPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                    </button>
                  </div>
                  <div style={S.inputWrap}>
                    <Lock style={S.inputIcon} />
                    <input
                      style={{ ...S.input, paddingLeft: 34 }}
                      placeholder="Confirm Password *"
                      type="password"
                      value={form.confirmPassword}
                      onChange={(e) => patch("confirmPassword", e.target.value)}
                    />
                    {form.confirmPassword && form.password === form.confirmPassword && (
                      <CheckCircle2 style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#10B981" }} />
                    )}
                    {form.confirmPassword && form.password !== form.confirmPassword && (
                      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#EF4444" }}>✕</span>
                    )}
                  </div>
                </div>
                {form.password && form.password.length < 6 && (
                  <div style={{ fontSize: 11, color: "#F59E0B", fontWeight: 700 }}>Password must be at least 6 characters</div>
                )}

                <div style={S.row2equal}>
                  <div style={S.fieldGroup}>
                    <label style={S.smallLabel}>Date of Birth *</label>
                    <input type="date" style={S.input} value={form.dateOfBirth} onChange={(e) => patch("dateOfBirth", e.target.value)} />
                  </div>
                  <div style={S.fieldGroup}>
                    <label style={S.smallLabel}>Gender *</label>
                    <select style={S.input} value={form.gender} onChange={(e) => patch("gender", e.target.value)}>
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div style={S.divider} />
                <SectionTitle icon={Stethoscope} text="Practice Details" />

                <div style={S.row2equal}>
                  <div style={S.fieldGroup}>
                    <label style={S.smallLabel}>Specialty *</label>
                    <select style={S.input} value={form.specialty} onChange={(e) => patch("specialty", e.target.value)}>
                      {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={S.fieldGroup}>
                    <label style={S.smallLabel}>Sub-specialty (optional)</label>
                    <input style={S.input} placeholder="e.g. Interventional Cardiology" value={form.subSpecialty} onChange={(e) => patch("subSpecialty", e.target.value)} />
                  </div>
                </div>

                <div style={S.row2equal}>
                  <Input placeholder="Years of Experience" type="number" min="0" value={form.yearsExperience} onChange={(e) => patch("yearsExperience", e.target.value)} />
                  <Input placeholder="Languages (comma-separated)" value={form.languages} onChange={(e) => patch("languages", e.target.value)} />
                </div>

                <textarea
                  style={S.textarea}
                  placeholder="Short bio for your profile (optional, max 500 chars)"
                  maxLength={500}
                  rows={2}
                  value={form.bio}
                  onChange={(e) => patch("bio", e.target.value)}
                />

                <div style={S.row2equal}>
                  <Input icon={MapPin} placeholder="City *" value={form.city} onChange={(e) => patch("city", e.target.value)} />
                  <Input placeholder="Area / Locality *" value={form.area} onChange={(e) => patch("area", e.target.value)} />
                </div>

                <div style={S.divider} />
                <SectionTitle icon={BadgeCheck} text="Consultation Modes & Fees" />
                <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, marginTop: -4 }}>
                  Select modes you offer, then set fee for each
                </div>

                <div style={S.modeRow}>
                  <ModePill active={form.modeAudio} onClick={() => patch("modeAudio", !form.modeAudio)} label="Audio" emoji="📞" />
                  <ModePill active={form.modeVideo} onClick={() => patch("modeVideo", !form.modeVideo)} label="Video" emoji="📹" />
                  <ModePill active={form.modeInPerson} onClick={() => patch("modeInPerson", !form.modeInPerson)} label="In-Person" emoji="🏥" />
                </div>

                {/* Mode-wise fee inputs — only show for selected modes */}
                <div style={S.feeGrid}>
                  {form.modeAudio && (
                    <div style={S.feeCard}>
                      <div style={S.feeLabel}>📞 Audio Fee *</div>
                      <div style={S.feeInputWrap}>
                        <span style={S.feeCurrency}>₹</span>
                        <input type="number" min="0" max="15000" style={S.feeInput} placeholder="e.g. 399" value={form.feeAudio} onChange={(e) => patch("feeAudio", e.target.value)} />
                      </div>
                    </div>
                  )}
                  {form.modeVideo && (
                    <div style={S.feeCard}>
                      <div style={S.feeLabel}>📹 Video Fee *</div>
                      <div style={S.feeInputWrap}>
                        <span style={S.feeCurrency}>₹</span>
                        <input type="number" min="0" max="15000" style={S.feeInput} placeholder="e.g. 499" value={form.feeVideo} onChange={(e) => patch("feeVideo", e.target.value)} />
                      </div>
                    </div>
                  )}
                  {form.modeInPerson && (
                    <div style={S.feeCard}>
                      <div style={S.feeLabel}>🏥 In-Person Fee *</div>
                      <div style={S.feeInputWrap}>
                        <span style={S.feeCurrency}>₹</span>
                        <input type="number" min="0" max="15000" style={S.feeInput} placeholder="e.g. 799" value={form.feeInPerson} onChange={(e) => patch("feeInPerson", e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>

                {primaryFee > 0 && (
                  <div style={S.bandChip}>
                    Platform fee band: {band.band} → {band.fee}
                  </div>
                )}

                <div style={S.row2equal}>
                  <div style={S.fieldGroup}>
                    <label style={S.smallLabel}>Available From *</label>
                    <input type="time" style={S.input} value={form.availableStart} onChange={(e) => patch("availableStart", e.target.value)} />
                  </div>
                  <div style={S.fieldGroup}>
                    <label style={S.smallLabel}>Available Until *</label>
                    <input type="time" style={S.input} value={form.availableEnd} onChange={(e) => patch("availableEnd", e.target.value)} />
                  </div>
                </div>

                <div style={S.fieldGroup}>
                  <label style={S.smallLabel}>Slot Duration</label>
                  <select style={S.input} value={form.slotDurationMins} onChange={(e) => patch("slotDurationMins", e.target.value)}>
                    <option value="10">10 min</option>
                    <option value="15">15 min</option>
                    <option value="20">20 min</option>
                    <option value="30">30 min</option>
                  </select>
                </div>

                <label style={S.checkboxLine}>
                  <input type="checkbox" checked={form.specialistRequired} onChange={(e) => patch("specialistRequired", e.target.checked)} />
                  I am a specialist (specialist degree will be required in Step 2)
                </label>
              </div>
            )}

            {/* ════════════ STEP 2 ════════════ */}
            {step === 2 && (
              <div style={S.grid}>
                <SectionTitle icon={ShieldCheck} text="Medical Registration (NMC)" />

                <Input placeholder="Registration Number *" value={form.registrationNumber} onChange={(e) => patch("registrationNumber", e.target.value)} />

                <div style={S.row2equal}>
                  <div style={S.fieldGroup}>
                    <label style={S.smallLabel}>State Medical Council *</label>
                    <select style={S.input} value={form.smcName} onChange={(e) => patch("smcName", e.target.value)}>
                      <option value="">Select Council</option>
                      {SMC_COUNCILS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={S.fieldGroup}>
                    <label style={S.smallLabel}>Registration Year</label>
                    <input type="number" style={S.input} placeholder="e.g. 2015" min="1960" max="2035" value={form.registrationYear} onChange={(e) => patch("registrationYear", e.target.value)} />
                  </div>
                </div>

                <div style={S.row2equal}>
                  <Input placeholder="Qualification (e.g. MBBS, MD)" value={form.qualification} onChange={(e) => patch("qualification", e.target.value)} />
                  <Input placeholder="University / College" value={form.university} onChange={(e) => patch("university", e.target.value)} />
                </div>

                <div style={S.divider} />
                <SectionTitle icon={FileUp} text="Upload Documents" />

                <Uploader label="Registration Certificate" required file={files.registrationCertificate} onChange={(v) => setFiles((p) => ({ ...p, registrationCertificate: v }))} />
                <Uploader label="MBBS / Primary Qualification" required file={files.mbbsDegree} onChange={(v) => setFiles((p) => ({ ...p, mbbsDegree: v }))} />
                {form.specialistRequired && (
                  <Uploader label="Specialist Degree" required file={files.specialistDegree} onChange={(v) => setFiles((p) => ({ ...p, specialistDegree: v }))} />
                )}
                <Uploader label="PAN Card" required file={files.pan} onChange={(v) => setFiles((p) => ({ ...p, pan: v }))} />
                <Uploader
                  label="Digital Signature"
                  file={files.signature}
                  onChange={(v) => setFiles((p) => ({ ...p, signature: v }))}
                  hint="Optional — Used for e-prescriptions"
                  accept=".png,.jpg,.jpeg"
                />

                <div style={S.divider} />
                <SectionTitle icon={Landmark} text="Bank / Payout Details" />
                <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, marginTop: -4 }}>
                  Required for consultation payouts
                </div>

                <Input placeholder="Account Holder Name *" value={form.accountHolderName} onChange={(e) => patch("accountHolderName", e.target.value)} />
                <Input placeholder="Bank Name *" value={form.bankName} onChange={(e) => patch("bankName", e.target.value)} />
                <div style={S.row2equal}>
                  <Input placeholder="Account Number *" type="password" value={form.accountNumber} onChange={(e) => patch("accountNumber", e.target.value)} />
                  <Input placeholder="Confirm Account Number *" value={form.confirmAccountNumber} onChange={(e) => patch("confirmAccountNumber", e.target.value)} />
                </div>
                <Input placeholder="IFSC Code * (e.g. SBIN0001234)" value={form.ifscCode} onChange={(e) => patch("ifscCode", e.target.value.toUpperCase())} />
                <Uploader
                  label="Cancelled Cheque / Passbook"
                  required
                  file={files.bankProof}
                  onChange={(v) => setFiles((p) => ({ ...p, bankProof: v }))}
                  hint="Front page of passbook or cancelled cheque"
                />

                {/* ── Clinic (only for In-Person) ── */}
                {form.modeInPerson && (
                  <>
                    <div style={S.divider} />
                    <div style={S.innerCard}>
                      <SectionTitle icon={Building2} text="In-Person Clinic Setup" />
                      <Input placeholder="Clinic Name *" value={form.clinicName} onChange={(e) => patch("clinicName", e.target.value)} />
                      <Input placeholder="Full Address *" value={form.clinicAddress} onChange={(e) => patch("clinicAddress", e.target.value)} />
                      <div style={S.row2equal}>
                        <Input placeholder="Locality *" value={form.clinicLocality} onChange={(e) => patch("clinicLocality", e.target.value)} />
                        <Input placeholder="PIN Code *" value={form.clinicPincode} onChange={(e) => patch("clinicPincode", e.target.value)} />
                      </div>
                      <div style={S.row2equal}>
                        <Input placeholder="Latitude *" value={form.clinicLat} onChange={(e) => patch("clinicLat", e.target.value)} />
                        <Input placeholder="Longitude *" value={form.clinicLng} onChange={(e) => patch("clinicLng", e.target.value)} />
                      </div>
                      <button type="button" style={S.detectBtn} onClick={useCurrentLocation} disabled={locationLoading}>
                        <MapPin style={{ width: 14, height: 14 }} />
                        {locationLoading ? "Detecting..." : "Detect My Location"}
                      </button>
                      {locationNote && <div style={S.note}>{locationNote}</div>}
                      <Uploader
                        label="Clinic Proof"
                        required
                        file={files.clinicProof}
                        onChange={(v) => setFiles((p) => ({ ...p, clinicProof: v }))}
                        hint="Clinic front photo / signboard / rent agreement"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ════════════ STEP 3 ════════════ */}
            {step === 3 && (
              <div style={S.grid}>
                <SectionTitle icon={BadgeCheck} text="Review & Consent" />

                {/* Summary Card */}
                <div style={S.summaryCard}>
                  <div style={S.summaryTitle}>Registration Summary</div>
                  <SummaryRow label="Name" value={form.fullName} />
                  <SummaryRow label="Phone" value={form.phone} />
                  <SummaryRow label="Email" value={form.email} />
                  <SummaryRow label="DOB" value={form.dateOfBirth} />
                  <SummaryRow label="Gender" value={form.gender} />
                  <SummaryRow label="Specialty" value={form.specialty + (form.subSpecialty ? ` → ${form.subSpecialty}` : "")} />
                  <SummaryRow label="City" value={`${form.area}, ${form.city}`} />
                  <SummaryRow label="Modes" value={[form.modeAudio && "Audio", form.modeVideo && "Video", form.modeInPerson && "In-Person"].filter(Boolean).join(", ")} />
                  {form.modeAudio && <SummaryRow label="Audio Fee" value={`₹${form.feeAudio}`} />}
                  {form.modeVideo && <SummaryRow label="Video Fee" value={`₹${form.feeVideo}`} />}
                  {form.modeInPerson && <SummaryRow label="In-Person Fee" value={`₹${form.feeInPerson}`} />}
                  <SummaryRow label="Reg. No." value={form.registrationNumber} />
                  <SummaryRow label="SMC" value={form.smcName} />
                  <SummaryRow label="Bank" value={`${form.bankName} • XXXX${form.accountNumber.slice(-4)}`} />
                </div>

                {/* Platform Fee Band */}
                <div style={S.innerCard}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#0F172A", fontFamily: "'Sora',sans-serif" }}>
                    GoDavaii Platform Fee
                  </div>
                  <div style={S.bandTable}>
                    <div style={S.bandRow}><span>₹0-500</span><span>₹19 + GST</span></div>
                    <div style={S.bandRow}><span>₹501-1000</span><span>₹39 + GST</span></div>
                    <div style={S.bandRow}><span>₹1001-1500</span><span>₹59 + GST</span></div>
                    <div style={S.bandRow}><span>₹1501-2000</span><span>₹79 + GST</span></div>
                    <div style={S.bandRow}><span>₹2001+</span><span>Manual approval</span></div>
                  </div>
                  <div style={S.currentBand}>
                    Your highest fee: ₹{primaryFee} → {band.fee}
                  </div>
                  <div style={S.note}>Applies only on completed consultations.</div>
                </div>

                {/* Consents */}
                <div style={S.consentGroup}>
                  <label style={S.checkboxLine}>
                    <input type="checkbox" checked={form.consentRegisteredDoctor} onChange={(e) => patch("consentRegisteredDoctor", e.target.checked)} />
                    I confirm I am a registered medical practitioner
                  </label>
                  <label style={S.checkboxLine}>
                    <input type="checkbox" checked={form.consentVerification} onChange={(e) => patch("consentVerification", e.target.checked)} />
                    I consent to GoDavaii verifying my credentials
                  </label>
                  <label style={S.checkboxLine}>
                    <input type="checkbox" checked={form.consentTerms} onChange={(e) => patch("consentTerms", e.target.checked)} />
                    I agree to teleconsult, booking & payout terms
                  </label>
                  <label style={S.checkboxLine}>
                    <input type="checkbox" checked={form.consentPlatformFee} onChange={(e) => patch("consentPlatformFee", e.target.checked)} />
                    I agree to GoDavaii Platform Fee terms
                  </label>
                </div>

                <div style={S.importantNote}>
                  <strong>Note:</strong> After submission, your account will be reviewed by our team.
                  Once <strong>approved</strong>, you can login with your email & password.
                </div>
              </div>
            )}

            {/* ── Error ── */}
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={S.error}>
                {error}
              </motion.div>
            )}

            {/* ── Footer Nav ── */}
            <div style={S.footerRow}>
              {step > 1 ? (
                <button type="button" style={S.backBtn} onClick={() => { setError(""); setStep((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  <ChevronLeft style={{ width: 14, height: 14 }} /> Back
                </button>
              ) : <span />}
              {step < 3 ? (
                <button type="button" style={S.primaryBtn} onClick={nextStep}>
                  Continue <ChevronRight style={{ width: 14, height: 14 }} />
                </button>
              ) : (
                <button type="button" style={S.primaryBtn} onClick={submit} disabled={loading}>
                  {loading ? <><Loader2 style={S.spin} /> Submitting...</> : "Submit for Verification"}
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <div style={S.bottomLine}>
          Already registered?{" "}
          <button style={S.linkBtn} onClick={() => navigate("/doctor/login")} type="button">
            Doctor Login
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ SUMMARY ROW ═══════════════════ */
function SummaryRow({ label, value }) {
  return (
    <div style={S.summaryRow}>
      <span style={{ color: "#94A3B8", fontWeight: 700 }}>{label}</span>
      <span style={{ color: "#0F172A", fontWeight: 800 }}>{value || "—"}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   STYLES — GoDavaii 2035 Design System (Green Theme)
   ═══════════════════════════════════════════════════════ */
const S = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(160deg, #061A14 0%, #0A2A1F 30%, #0D1F1A 70%, #071510 100%)",
    padding: "16px 12px",
    fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
  },
  wrap: { maxWidth: 600, margin: "0 auto", display: "grid", gap: 12 },

  // Hero
  hero: {
    borderRadius: 20,
    padding: "16px 18px",
    background: "linear-gradient(135deg, rgba(12,90,62,.25), rgba(19,192,162,.1))",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(13,192,162,.25)",
    color: "#fff",
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    background: "linear-gradient(135deg, #0C5A3E, #13C0A2)",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  heroTitle: { fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: 18, letterSpacing: "-0.3px" },
  heroSub: { fontSize: 12, opacity: 0.7, fontWeight: 600, marginTop: 2 },

  // Steps
  stepRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  stepChip: {
    flex: 1,
    minWidth: 140,
    height: 38,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.4)",
    fontSize: 11,
    fontWeight: 800,
    padding: "0 10px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    transition: "all .2s",
  },
  stepActive: {
    borderColor: "rgba(13,192,162,.5)",
    background: "rgba(13,192,162,.12)",
    color: "#A7F3D0",
  },
  stepDone: {
    borderColor: "rgba(16,185,129,.3)",
    background: "rgba(16,185,129,.08)",
    color: "#6EE7B7",
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 7,
    background: "rgba(255,255,255,.08)",
    display: "grid",
    placeItems: "center",
    fontSize: 10,
    fontWeight: 900,
    flexShrink: 0,
  },

  // Card
  card: {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,.06)",
    background: "rgba(255,255,255,.03)",
    backdropFilter: "blur(30px)",
    boxShadow: "0 20px 60px rgba(0,0,0,.3)",
    padding: "16px 14px",
    display: "grid",
    gap: 10,
  },
  grid: { display: "grid", gap: 10 },

  // Section Title
  sectionTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 900,
    color: "#E2E8F0",
    fontFamily: "'Sora',sans-serif",
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    background: "rgba(13,192,162,.15)",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },

  // Input
  inputWrap: { position: "relative" },
  input: {
    width: "100%",
    height: 40,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.1)",
    padding: "0 12px",
    fontSize: 13,
    fontWeight: 700,
    outline: "none",
    background: "rgba(255,255,255,.05)",
    color: "#E2E8F0",
    transition: "border-color .2s",
    boxSizing: "border-box",
  },
  inputIcon: {
    position: "absolute",
    left: 10,
    top: "50%",
    transform: "translateY(-50%)",
    width: 16,
    height: 16,
    color: "#13C0A2",
    opacity: 0.7,
  },
  eyeBtn: {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    border: "none",
    background: "transparent",
    color: "#94A3B8",
    cursor: "pointer",
    padding: 4,
  },

  // Textarea
  textarea: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.1)",
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 700,
    outline: "none",
    background: "rgba(255,255,255,.05)",
    color: "#E2E8F0",
    resize: "vertical",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },

  // Layout
  row2: { display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" },
  row2equal: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  fieldGroup: { display: "grid", gap: 4 },
  divider: { height: 1, background: "rgba(255,255,255,.06)", margin: "4px 0" },

  // Photo
  photoRow: { display: "flex", alignItems: "center", gap: 12, padding: "4px 0" },
  photoUpload: {
    width: 56,
    height: 56,
    borderRadius: 16,
    border: "2px dashed rgba(13,192,162,.4)",
    background: "rgba(13,192,162,.08)",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    overflow: "hidden",
    flexShrink: 0,
  },
  photoPreview: { width: "100%", height: "100%", objectFit: "cover" },

  // OTP / Action Buttons
  otpBtn: {
    height: 40,
    borderRadius: 12,
    border: "1px solid rgba(13,192,162,.4)",
    background: "rgba(13,192,162,.12)",
    color: "#6EE7B7",
    fontSize: 12,
    fontWeight: 800,
    padding: "0 14px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  verifiedBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 800,
    color: "#10B981",
    background: "rgba(16,185,129,.1)",
    border: "1px solid rgba(16,185,129,.3)",
    borderRadius: 8,
    padding: "6px 12px",
    width: "fit-content",
  },

  // Mode Pills
  modeRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  modePill: {
    height: 40,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.1)",
    background: "rgba(255,255,255,.04)",
    color: "#94A3B8",
    fontSize: 12.5,
    fontWeight: 800,
    padding: "0 16px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "all .2s",
  },
  modePillActive: {
    borderColor: "rgba(13,192,162,.5)",
    background: "linear-gradient(135deg, rgba(12,90,62,.3), rgba(13,192,162,.15))",
    color: "#A7F3D0",
    boxShadow: "0 0 20px rgba(13,192,162,.15)",
  },

  // Fee Cards
  feeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 },
  feeCard: {
    borderRadius: 14,
    border: "1px solid rgba(13,192,162,.2)",
    background: "rgba(13,192,162,.06)",
    padding: "10px 12px",
    display: "grid",
    gap: 6,
  },
  feeLabel: { fontSize: 11, fontWeight: 800, color: "#6EE7B7" },
  feeInputWrap: { display: "flex", alignItems: "center", gap: 4 },
  feeCurrency: { fontSize: 14, fontWeight: 900, color: "#13C0A2" },
  feeInput: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.1)",
    background: "rgba(255,255,255,.05)",
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: 800,
    padding: "0 8px",
    outline: "none",
    width: "100%",
  },
  bandChip: {
    fontSize: 11,
    fontWeight: 800,
    color: "#6EE7B7",
    background: "rgba(13,192,162,.1)",
    border: "1px solid rgba(13,192,162,.2)",
    borderRadius: 8,
    padding: "6px 10px",
    width: "fit-content",
  },

  // Upload
  uploadCard: {
    border: "1px dashed rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.02)",
    borderRadius: 14,
    padding: "12px 14px",
    cursor: "pointer",
    display: "grid",
    gap: 2,
    transition: "border-color .2s",
  },
  uploadHint: { fontSize: 10.5, color: "#64748B", fontWeight: 700, marginTop: 4, lineHeight: 1.45 },

  // Inner Card
  innerCard: {
    border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.02)",
    borderRadius: 14,
    padding: "14px 12px",
    display: "grid",
    gap: 10,
  },

  // Bank detect btn
  detectBtn: {
    height: 36,
    borderRadius: 10,
    border: "1px solid rgba(13,192,162,.3)",
    background: "rgba(13,192,162,.1)",
    color: "#6EE7B7",
    fontSize: 12,
    fontWeight: 800,
    padding: "0 12px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    width: "fit-content",
  },

  // Summary
  summaryCard: {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.03)",
    padding: "14px 12px",
    display: "grid",
    gap: 6,
  },
  summaryTitle: { fontSize: 13, fontWeight: 900, color: "#A7F3D0", fontFamily: "'Sora',sans-serif", marginBottom: 4 },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    padding: "3px 0",
    borderBottom: "1px solid rgba(255,255,255,.04)",
  },
  bandTable: { display: "grid", gap: 4, marginTop: 6 },
  bandRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    fontWeight: 700,
    color: "#94A3B8",
    padding: "2px 0",
  },
  currentBand: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: 900,
    color: "#10B981",
    background: "rgba(16,185,129,.1)",
    border: "1px solid rgba(16,185,129,.2)",
    borderRadius: 10,
    padding: "8px 10px",
  },

  // Consents
  consentGroup: { display: "grid", gap: 8 },
  checkboxLine: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    fontSize: 12,
    fontWeight: 700,
    color: "#CBD5E1",
    cursor: "pointer",
  },
  importantNote: {
    fontSize: 12,
    fontWeight: 700,
    color: "#F59E0B",
    background: "rgba(245,158,11,.08)",
    border: "1px solid rgba(245,158,11,.2)",
    borderRadius: 10,
    padding: "10px 12px",
    lineHeight: 1.6,
  },

  // Labels
  smallLabel: { fontSize: 11, color: "#94A3B8", fontWeight: 800 },
  note: { fontSize: 11, color: "#64748B", fontWeight: 700 },

  // Error
  error: {
    fontSize: 12,
    fontWeight: 800,
    color: "#EF4444",
    background: "rgba(239,68,68,.08)",
    border: "1px solid rgba(239,68,68,.2)",
    borderRadius: 10,
    padding: "8px 12px",
  },

  // Footer
  footerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 },
  backBtn: {
    height: 40,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.1)",
    background: "transparent",
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: 800,
    padding: "0 14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  primaryBtn: {
    height: 42,
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #0C5A3E, #13C0A2)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 900,
    padding: "0 20px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    boxShadow: "0 4px 20px rgba(13,192,162,.3)",
    transition: "transform .1s",
  },
  bottomLine: { fontSize: 12, color: "#64748B", fontWeight: 700, textAlign: "center", padding: "8px 0" },
  linkBtn: { border: "none", background: "transparent", color: "#6EE7B7", fontWeight: 900, cursor: "pointer", textDecoration: "underline" },

  // Success
  successCard: {
    borderRadius: 24,
    border: "1px solid rgba(16,185,129,.2)",
    background: "rgba(255,255,255,.03)",
    backdropFilter: "blur(20px)",
    padding: "40px 24px",
    display: "grid",
    gap: 16,
    justifyItems: "center",
    textAlign: "center",
  },

  // Spinner
  spin: { width: 16, height: 16, animation: "spin 1s linear infinite" },
};
