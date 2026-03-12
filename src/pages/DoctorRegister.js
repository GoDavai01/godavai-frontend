import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { BadgeCheck, Building2, ChevronRight, FileUp, ShieldCheck, Stethoscope, UserRound } from "lucide-react";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const STEP_TITLES = [
  "Basic Details",
  "Required Documents",
  "Commercial Terms",
];

const SPECIALTIES = [
  "General Physician",
  "Cardiology",
  "Dermatology",
  "Pediatrics",
  "Gynecology",
  "ENT",
  "Orthopedics",
  "Psychiatry",
  "Neurology",
];

function asNum(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function serviceBand(fee) {
  const f = asNum(fee);
  if (f <= 500) return { band: "Rs 0-500", fee: "Rs 19 + applicable GST", manual: false };
  if (f <= 1000) return { band: "Rs 501-1000", fee: "Rs 39 + applicable GST", manual: false };
  if (f <= 1500) return { band: "Rs 1001-1500", fee: "Rs 59 + applicable GST", manual: false };
  if (f <= 2000) return { band: "Rs 1501-2000", fee: "Rs 79 + applicable GST", manual: false };
  return { band: "Rs 2001+", fee: "Manual commercial approval required", manual: true };
}

function Uploader({ label, required = false, file, onChange }) {
  return (
    <label style={styles.uploadCard}>
      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={(e) => onChange(e.target.files?.[0] || null)} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <FileUp style={{ width: 14, height: 14, color: "#0C5A3E" }} />
        <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>
          {label} {required ? "*" : ""}
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: file ? "#065F46" : "#64748B", marginTop: 4 }}>
        {file ? file.name : "Tap to upload"}
      </div>
    </label>
  );
}

export default function DoctorRegister() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    otp: "",
    email: "",
    specialty: "General Physician",
    city: "",
    area: "",
    consultationFee: "499",
    availableTimings: "",
    modeAudio: true,
    modeVideo: true,
    modeInPerson: false,
    specialistRequired: false,
    registrationNumber: "",
    clinicName: "",
    clinicAddress: "",
    clinicLocality: "",
    clinicPincode: "",
    clinicLat: "",
    clinicLng: "",
    slotDurationMins: "15",
    patientArrivalWindowMins: "15",
    maxPatientsPerDay: "24",
    consentRegisteredDoctor: false,
    consentVerification: false,
    consentTerms: false,
    consentPlatformFee: false,
  });

  const [files, setFiles] = useState({
    registrationCertificate: null,
    mbbsDegree: null,
    specialistDegree: null,
    pan: null,
    bankProof: null,
    clinicProof: null,
  });

  const band = useMemo(() => serviceBand(form.consultationFee), [form.consultationFee]);

  function patch(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function sendOtp() {
    setOtpSending(true);
    setError("");
    try {
      const { data } = await axios.post(`${API}/api/doctors/onboarding/otp/send`, { phone: form.phone.trim() });
      setOtpSent(true);
      if (data?.debugOtp && !form.otp) patch("otp", data.debugOtp);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to send OTP");
    } finally {
      setOtpSending(false);
    }
  }

  async function verifyOtp() {
    setOtpVerifying(true);
    setError("");
    try {
      await axios.post(`${API}/api/doctors/onboarding/otp/verify`, { phone: form.phone.trim(), otp: form.otp.trim() });
      setOtpVerified(true);
    } catch (e) {
      setError(e?.response?.data?.error || "OTP verification failed");
    } finally {
      setOtpVerifying(false);
    }
  }

  function validateStep1() {
    if (!form.fullName.trim() || !form.phone.trim() || !form.email.trim() || !form.specialty || !form.city.trim() || !form.area.trim()) {
      return "Please fill all mandatory basic fields.";
    }
    if (!(form.modeAudio || form.modeVideo || form.modeInPerson)) return "Select at least one consultation mode.";
    if (!otpVerified) return "Please verify mobile OTP.";
    if (asNum(form.consultationFee) < 0) return "Consultation fee must be valid.";
    if (!form.availableTimings.trim()) return "Please add available timings.";
    return "";
  }

  function validateStep2() {
    if (!form.registrationNumber.trim()) return "Registration number is required.";
    if (!files.registrationCertificate || !files.mbbsDegree || !files.pan || !files.bankProof) {
      return "Please upload all mandatory documents.";
    }
    if (form.specialistRequired && !files.specialistDegree) return "Specialist degree upload is required.";
    if (form.modeInPerson) {
      if (!form.clinicName.trim() || !form.clinicAddress.trim() || !form.clinicPincode.trim()) return "Clinic details are required for in-person mode.";
      if (!form.clinicLat.trim() || !form.clinicLng.trim()) return "Exact clinic map pin is required.";
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
  }

  async function submit() {
    const msg = validateStep3();
    if (msg) return setError(msg);
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, typeof v === "boolean" ? String(v) : v));
      fd.append("otpVerified", "true");
      Object.entries(files).forEach(([k, v]) => {
        if (v) fd.append(k, v);
      });
      const { data } = await axios.post(`${API}/api/doctors/onboarding/submit`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (data?.token) localStorage.setItem("doctorToken", data.token);
      if (data?.doctor?.id) localStorage.setItem("doctorCurrentId", data.doctor.id);
      navigate("/doctor/dashboard", { replace: true });
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to submit onboarding");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={styles.hero}>
          <div style={styles.heroIcon}><Stethoscope style={{ width: 18, height: 18 }} /></div>
          <div>
            <div style={styles.heroTitle}>GoDavaii Doctor Onboarding</div>
            <div style={styles.heroSub}>2-minute setup for Audio, Video, and In-Person practice</div>
          </div>
        </motion.div>

        <div style={styles.stepRow}>
          {STEP_TITLES.map((t, i) => (
            <div key={t} style={{ ...styles.stepChip, ...(step === i + 1 ? styles.stepActive : null) }}>
              {i + 1}. {t}
            </div>
          ))}
        </div>

        <div style={styles.card}>
          {step === 1 && (
            <div style={styles.grid}>
              <SectionTitle icon={UserRound} text="Basic Details" />
              <input style={styles.input} placeholder="Full Name*" value={form.fullName} onChange={(e) => patch("fullName", e.target.value)} />
              <div style={styles.row2}>
                <input style={styles.input} placeholder="Mobile Number*" value={form.phone} onChange={(e) => patch("phone", e.target.value)} />
                <button style={styles.ghostBtn} onClick={sendOtp} type="button" disabled={otpSending || !form.phone.trim()}>
                  {otpSending ? "Sending..." : otpSent ? "Resend OTP" : "Send OTP"}
                </button>
              </div>
              <div style={styles.row2}>
                <input style={styles.input} placeholder="Enter OTP*" value={form.otp} onChange={(e) => patch("otp", e.target.value)} />
                <button style={styles.ghostBtn} onClick={verifyOtp} type="button" disabled={otpVerifying || !otpSent || !form.otp.trim()}>
                  {otpVerifying ? "Verifying..." : otpVerified ? "Verified" : "Verify OTP"}
                </button>
              </div>
              <input style={styles.input} placeholder="Email Address*" value={form.email} onChange={(e) => patch("email", e.target.value)} />
              <select style={styles.input} value={form.specialty} onChange={(e) => patch("specialty", e.target.value)}>
                {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <div style={styles.row2}>
                <input style={styles.input} placeholder="City*" value={form.city} onChange={(e) => patch("city", e.target.value)} />
                <input style={styles.input} placeholder="Area / Locality*" value={form.area} onChange={(e) => patch("area", e.target.value)} />
              </div>
              <div style={styles.modeRow}>
                <ModePill active={form.modeAudio} onClick={() => patch("modeAudio", !form.modeAudio)} label="Audio" />
                <ModePill active={form.modeVideo} onClick={() => patch("modeVideo", !form.modeVideo)} label="Video" />
                <ModePill active={form.modeInPerson} onClick={() => patch("modeInPerson", !form.modeInPerson)} label="In-person" />
              </div>
              <div style={styles.row2}>
                <input style={styles.input} placeholder="Consultation Fee*" value={form.consultationFee} onChange={(e) => patch("consultationFee", e.target.value)} />
                <input style={styles.input} placeholder="Available Timings*" value={form.availableTimings} onChange={(e) => patch("availableTimings", e.target.value)} />
              </div>
              <label style={styles.checkboxLine}>
                <input type="checkbox" checked={form.specialistRequired} onChange={(e) => patch("specialistRequired", e.target.checked)} />
                I am a specialist (specialist degree will be required)
              </label>
            </div>
          )}

          {step === 2 && (
            <div style={styles.grid}>
              <SectionTitle icon={ShieldCheck} text="Required Documents" />
              <input style={styles.input} placeholder="Registration Number*" value={form.registrationNumber} onChange={(e) => patch("registrationNumber", e.target.value)} />
              <Uploader label="Registration Certificate" required file={files.registrationCertificate} onChange={(v) => setFiles((p) => ({ ...p, registrationCertificate: v }))} />
              <Uploader label="MBBS / Primary Qualification" required file={files.mbbsDegree} onChange={(v) => setFiles((p) => ({ ...p, mbbsDegree: v }))} />
              {form.specialistRequired ? (
                <Uploader label="Specialist Degree" required file={files.specialistDegree} onChange={(v) => setFiles((p) => ({ ...p, specialistDegree: v }))} />
              ) : null}
              <Uploader label="PAN" required file={files.pan} onChange={(v) => setFiles((p) => ({ ...p, pan: v }))} />
              <Uploader label="Bank Proof / Cancelled Cheque" required file={files.bankProof} onChange={(v) => setFiles((p) => ({ ...p, bankProof: v }))} />

              {form.modeInPerson ? (
                <div style={styles.innerCard}>
                  <SectionTitle icon={Building2} text="In-Person Clinic Setup" />
                  <input style={styles.input} placeholder="Clinic Name*" value={form.clinicName} onChange={(e) => patch("clinicName", e.target.value)} />
                  <input style={styles.input} placeholder="Clinic Full Address*" value={form.clinicAddress} onChange={(e) => patch("clinicAddress", e.target.value)} />
                  <div style={styles.row2}>
                    <input style={styles.input} placeholder="Locality / Area*" value={form.clinicLocality} onChange={(e) => patch("clinicLocality", e.target.value)} />
                    <input style={styles.input} placeholder="PIN Code*" value={form.clinicPincode} onChange={(e) => patch("clinicPincode", e.target.value)} />
                  </div>
                  <div style={styles.row2}>
                    <input style={styles.input} placeholder="Map Latitude*" value={form.clinicLat} onChange={(e) => patch("clinicLat", e.target.value)} />
                    <input style={styles.input} placeholder="Map Longitude*" value={form.clinicLng} onChange={(e) => patch("clinicLng", e.target.value)} />
                  </div>
                  <div style={styles.row3}>
                    <input style={styles.input} placeholder="Slot duration mins" value={form.slotDurationMins} onChange={(e) => patch("slotDurationMins", e.target.value)} />
                    <input style={styles.input} placeholder="Arrival window mins" value={form.patientArrivalWindowMins} onChange={(e) => patch("patientArrivalWindowMins", e.target.value)} />
                    <input style={styles.input} placeholder="Max patients/day" value={form.maxPatientsPerDay} onChange={(e) => patch("maxPatientsPerDay", e.target.value)} />
                  </div>
                  <Uploader label="Clinic Proof" required file={files.clinicProof} onChange={(v) => setFiles((p) => ({ ...p, clinicProof: v }))} />
                </div>
              ) : null}
            </div>
          )}

          {step === 3 && (
            <div style={styles.grid}>
              <SectionTitle icon={BadgeCheck} text="Commercial Terms + Consents" />
              <div style={styles.innerCard}>
                <div style={styles.bandTitle}>GoDavaii Platform / Service Fee</div>
                <div style={styles.bandLine}>Rs 0-500 consult fee -> Rs 19 + applicable GST</div>
                <div style={styles.bandLine}>Rs 501-1000 -> Rs 39 + applicable GST</div>
                <div style={styles.bandLine}>Rs 1001-1500 -> Rs 59 + applicable GST</div>
                <div style={styles.bandLine}>Rs 1501-2000 -> Rs 79 + applicable GST</div>
                <div style={styles.bandLine}>Rs 2001+ -> manual approval</div>
                <div style={styles.currentBand}>Your current band: {band.band} -> {band.fee}</div>
                <div style={styles.note}>Applies only on completed consultations. Same model for Audio, Video, and In-Person bookings.</div>
              </div>
              <label style={styles.checkboxLine}><input type="checkbox" checked={form.consentRegisteredDoctor} onChange={(e) => patch("consentRegisteredDoctor", e.target.checked)} /> I confirm I am a registered doctor</label>
              <label style={styles.checkboxLine}><input type="checkbox" checked={form.consentVerification} onChange={(e) => patch("consentVerification", e.target.checked)} /> I agree to GoDavaii verification</label>
              <label style={styles.checkboxLine}><input type="checkbox" checked={form.consentTerms} onChange={(e) => patch("consentTerms", e.target.checked)} /> I agree to teleconsult / booking / payout terms</label>
              <label style={styles.checkboxLine}><input type="checkbox" checked={form.consentPlatformFee} onChange={(e) => patch("consentPlatformFee", e.target.checked)} /> I agree to GoDavaii Platform / Service Fee terms</label>
            </div>
          )}

          {error ? <div style={styles.error}>{error}</div> : null}

          <div style={styles.footerRow}>
            {step > 1 ? <button type="button" style={styles.backBtn} onClick={() => setStep((p) => Math.max(1, p - 1))}>Back</button> : <span />}
            {step < 3 ? (
              <button type="button" style={styles.nextBtn} onClick={nextStep}>
                Continue <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            ) : (
              <button type="button" style={styles.nextBtn} onClick={submit} disabled={loading}>
                {loading ? "Submitting..." : "Submit for Verification"}
              </button>
            )}
          </div>
        </div>

        <div style={styles.bottomLine}>
          Already registered? <button style={styles.linkBtn} onClick={() => navigate("/doctor/login")} type="button">Doctor Login</button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, text }) {
  return (
    <div style={styles.sectionTitle}>
      <Icon style={{ width: 14, height: 14, color: "#0C5A3E" }} />
      {text}
    </div>
  );
}

function ModePill({ active, onClick, label }) {
  return (
    <button type="button" onClick={onClick} style={{ ...styles.modePill, ...(active ? styles.modePillActive : null) }}>
      {label}
    </button>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg,#EAF8F1 0%,#EAF3FF 46%,#F8FAFC 100%)",
    padding: 12,
    fontFamily: "'Plus Jakarta Sans',sans-serif",
  },
  wrap: { maxWidth: 620, margin: "0 auto", display: "grid", gap: 10 },
  hero: {
    borderRadius: 22,
    padding: 14,
    background: "linear-gradient(135deg,#0A4E37,#0D6B47)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.16)",
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    background: "rgba(255,255,255,.14)",
    display: "grid",
    placeItems: "center",
  },
  heroTitle: { fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: 17 },
  heroSub: { fontSize: 12, opacity: 0.88, fontWeight: 600 },
  stepRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  stepChip: {
    height: 30,
    borderRadius: 999,
    border: "1px solid #D1D5DB",
    background: "#fff",
    color: "#475569",
    fontSize: 11.5,
    fontWeight: 800,
    padding: "0 10px",
    display: "inline-flex",
    alignItems: "center",
  },
  stepActive: { borderColor: "#0C5A3E", background: "#ECFDF5", color: "#065F46" },
  card: {
    borderRadius: 20,
    border: "1px solid rgba(15,23,42,.08)",
    background: "rgba(255,255,255,.95)",
    boxShadow: "0 10px 28px rgba(15,23,42,.06)",
    padding: 12,
    display: "grid",
    gap: 10,
  },
  grid: { display: "grid", gap: 8 },
  sectionTitle: { display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 900, color: "#0F172A", fontFamily: "'Sora',sans-serif" },
  input: {
    width: "100%",
    height: 38,
    borderRadius: 11,
    border: "1px solid #CBD5E1",
    padding: "0 10px",
    fontSize: 12.5,
    fontWeight: 700,
    outline: "none",
    background: "#fff",
  },
  row2: { display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" },
  row3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },
  modeRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  modePill: {
    height: 34,
    borderRadius: 999,
    border: "1px solid #D1D5DB",
    background: "#fff",
    color: "#334155",
    fontSize: 12,
    fontWeight: 800,
    padding: "0 12px",
    cursor: "pointer",
  },
  modePillActive: {
    borderColor: "#0C5A3E",
    background: "linear-gradient(135deg,#0A4E37,#0D6B47)",
    color: "#fff",
  },
  ghostBtn: {
    height: 34,
    borderRadius: 10,
    border: "1px solid #D1D5DB",
    background: "#fff",
    color: "#0F172A",
    fontSize: 12,
    fontWeight: 800,
    padding: "0 10px",
    cursor: "pointer",
  },
  uploadCard: {
    border: "1px dashed #94A3B8",
    background: "#F8FAFC",
    borderRadius: 12,
    padding: 10,
    cursor: "pointer",
    display: "grid",
    gap: 2,
  },
  innerCard: { border: "1px solid #E2E8F0", background: "#fff", borderRadius: 12, padding: 10, display: "grid", gap: 8 },
  bandTitle: { fontSize: 13, fontWeight: 900, color: "#0F172A", fontFamily: "'Sora',sans-serif" },
  bandLine: { fontSize: 12, fontWeight: 700, color: "#334155" },
  currentBand: { marginTop: 6, fontSize: 12, fontWeight: 900, color: "#065F46", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "6px 8px" },
  note: { fontSize: 11.5, color: "#64748B", fontWeight: 700 },
  checkboxLine: { display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, fontWeight: 700, color: "#334155" },
  error: { fontSize: 12, fontWeight: 800, color: "#B91C1C" },
  footerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 },
  backBtn: { height: 36, borderRadius: 10, border: "1px solid #D1D5DB", background: "#fff", color: "#0F172A", fontSize: 12, fontWeight: 800, padding: "0 12px", cursor: "pointer" },
  nextBtn: { height: 36, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#0A4E37,#0D6B47)", color: "#fff", fontSize: 12, fontWeight: 900, padding: "0 14px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  bottomLine: { fontSize: 12, color: "#64748B", fontWeight: 700, textAlign: "center" },
  linkBtn: { border: "none", background: "transparent", color: "#0C5A3E", fontWeight: 900, cursor: "pointer" },
};
