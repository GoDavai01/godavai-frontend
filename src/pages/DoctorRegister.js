import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Hospital, Stethoscope } from "lucide-react";
import axios from "axios";

const DEEP = "#0C5A3E";
const MID = "#0E7A4F";
const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export default function DoctorRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    specialty: "General Physician",
    experience: "",
    clinicName: "",
    city: "",
    feeVideo: "499",
    feeInPerson: "799",
    password: "",
  });
  const [error, setError] = useState("");

  function onChange(key, value) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim() || !form.password.trim()) {
      setError("Please fill all required fields.");
      return;
    }

    try {
      const r = await axios.post(`${API}/api/doctors/register`, {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        specialty: form.specialty,
        experience: Number(form.experience || 0),
        clinicName: form.clinicName.trim(),
        city: form.city.trim(),
        feeVideo: Number(form.feeVideo || 0),
        feeInPerson: Number(form.feeInPerson || 0),
        password: form.password,
      });
      const token = r?.data?.token;
      const doctor = r?.data?.doctor;
      if (!token || !doctor?.id) {
        setError("Doctor registration response invalid.");
        return;
      }
      localStorage.setItem("doctorToken", token);
      localStorage.setItem("doctorCurrentId", doctor.id);
      navigate("/doctor/dashboard", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || "Doctor registration failed.");
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100vh", padding: 14, background: "linear-gradient(180deg,#ECFDF5 0%,#E6F4FF 50%,#F8FAFC 100%)" }}>
      <div style={{ background: "linear-gradient(135deg,#0B4D35,#0A623E)", borderRadius: 20, padding: 14, color: "#fff", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: "rgba(0,217,126,0.18)", display: "grid", placeItems: "center" }}>
            <Stethoscope style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: 18 }}>Doctor Registration</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Create your GoDavaii doctor portal profile.</div>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(12,90,62,0.08)", borderRadius: 20, padding: 14 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <input value={form.fullName} onChange={(e) => onChange("fullName", e.target.value)} placeholder="Full name*" style={inputStyle} />
          <input value={form.email} onChange={(e) => onChange("email", e.target.value)} placeholder="Email*" style={inputStyle} />
          <input value={form.phone} onChange={(e) => onChange("phone", e.target.value)} placeholder="Phone*" style={inputStyle} />
          <select value={form.specialty} onChange={(e) => onChange("specialty", e.target.value)} style={inputStyle}>
            {[
              "General Physician",
              "Pediatrics",
              "Dermatology",
              "Gynecology",
              "Cardiology",
              "ENT",
              "Orthopedics",
              "Psychiatry",
            ].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={form.experience} onChange={(e) => onChange("experience", e.target.value)} placeholder="Experience (years)" style={inputStyle} />
          <input value={form.clinicName} onChange={(e) => onChange("clinicName", e.target.value)} placeholder="Clinic/Hospital name" style={inputStyle} />
          <input value={form.city} onChange={(e) => onChange("city", e.target.value)} placeholder="City" style={inputStyle} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input value={form.feeVideo} onChange={(e) => onChange("feeVideo", e.target.value)} placeholder="Video fee" style={inputStyle} />
            <input value={form.feeInPerson} onChange={(e) => onChange("feeInPerson", e.target.value)} placeholder="In-person fee" style={inputStyle} />
          </div>
          <input type="password" value={form.password} onChange={(e) => onChange("password", e.target.value)} placeholder="Password*" style={inputStyle} />
        </div>

        {error && <div style={{ marginTop: 8, fontSize: 12, color: "#B91C1C", fontWeight: 800 }}>{error}</div>}

        <motion.button whileTap={{ scale: 0.98 }} type="submit" style={{ marginTop: 10, width: "100%", height: 42, border: "none", borderRadius: 12, background: `linear-gradient(135deg,${DEEP},${MID})`, color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: "pointer" }}>
          <CheckCircle2 style={{ width: 15, height: 15 }} /> Register and Open Dashboard
        </motion.button>
      </form>

      <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#334155", fontSize: 12, fontWeight: 700 }}>
          <Hospital style={{ width: 14, height: 14 }} /> Already registered?
        </div>
        <button onClick={() => navigate("/doctor/login")} type="button" style={{ border: "none", background: "transparent", color: DEEP, fontWeight: 900, cursor: "pointer" }}>
          Doctor Login
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  height: 38,
  borderRadius: 10,
  border: "1.5px solid #D1D5DB",
  padding: "0 10px",
  fontSize: 12.5,
  fontWeight: 700,
  outline: "none",
  background: "#fff",
};
