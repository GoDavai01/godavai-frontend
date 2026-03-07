import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogIn, Stethoscope } from "lucide-react";
import axios from "axios";

const DEEP = "#0C5A3E";
const MID = "#0E7A4F";
const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export default function DoctorLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const r = await axios.post(`${API}/api/doctors/login`, {
        email: email.trim(),
        password,
      });
      const token = r?.data?.token;
      const doctor = r?.data?.doctor;
      if (!token || !doctor?.id) {
        setError("Doctor login response invalid.");
        return;
      }
      localStorage.setItem("doctorToken", token);
      localStorage.setItem("doctorCurrentId", doctor.id);
      navigate("/doctor/dashboard", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || "Invalid email or password.");
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
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: 18 }}>Doctor Login</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Manage your slots, fees, and appointments.</div>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(12,90,62,0.08)", borderRadius: 20, padding: 14 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Doctor email" style={inputStyle} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" style={inputStyle} />
        </div>
        {error && <div style={{ marginTop: 8, fontSize: 12, color: "#B91C1C", fontWeight: 800 }}>{error}</div>}

        <motion.button whileTap={{ scale: 0.98 }} type="submit" style={{ marginTop: 10, width: "100%", height: 42, border: "none", borderRadius: 12, background: `linear-gradient(135deg,${DEEP},${MID})`, color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: "pointer" }}>
          <LogIn style={{ width: 15, height: 15 }} /> Login to Doctor Dashboard
        </motion.button>
      </form>

      <div style={{ marginTop: 10, textAlign: "center", fontSize: 12, color: "#64748B", fontWeight: 700 }}>
        New doctor? <button onClick={() => navigate("/doctor/register")} style={{ border: "none", background: "transparent", color: DEEP, fontWeight: 900, cursor: "pointer" }}>Register here</button>
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
