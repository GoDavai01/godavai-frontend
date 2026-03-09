import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FlaskConical, LogIn } from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0C5A3E";
const MID = "#0E7A4F";

export default function LabPartnerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/lab-partners/login`, {
        email: email.trim(),
        password,
      });

      const token = data?.token || "";
      if (!token) throw new Error("Missing token");

      localStorage.setItem("labPartnerToken", token);
      localStorage.setItem("labPartnerProfile", JSON.stringify(data?.partner || {}));
      navigate("/lab-partner/dashboard", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100vh", padding: 14, background: "linear-gradient(180deg,#ECFDF5 0%,#E6F4FF 50%,#F8FAFC 100%)" }}>
      <div style={{ background: "linear-gradient(135deg,#0B4D35,#0A623E)", borderRadius: 20, padding: 14, color: "#fff", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: "rgba(0,217,126,0.18)", display: "grid", placeItems: "center" }}>
            <FlaskConical style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: 18 }}>Lab Partner Login</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Manage collections, processing, and report readiness.</div>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(12,90,62,0.08)", borderRadius: 20, padding: 14 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Lab partner email" style={inputStyle} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" style={inputStyle} />
        </div>
        {error ? <div style={{ marginTop: 8, fontSize: 12, color: "#B91C1C", fontWeight: 800 }}>{error}</div> : null}

        <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={loading} style={{ marginTop: 10, width: "100%", height: 42, border: "none", borderRadius: 12, background: loading ? "#CBD5E1" : `linear-gradient(135deg,${DEEP},${MID})`, color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: loading ? "not-allowed" : "pointer" }}>
          <LogIn style={{ width: 15, height: 15 }} /> {loading ? "Logging in..." : "Login to Lab Dashboard"}
        </motion.button>
      </form>

      <div style={{ marginTop: 10, textAlign: "center", fontSize: 12, color: "#64748B", fontWeight: 700 }}>
        New partner? <button onClick={() => navigate("/lab-partner/register")} style={{ border: "none", background: "transparent", color: DEEP, fontWeight: 900, cursor: "pointer" }}>Register here</button>
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
