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
  const [statusInfo, setStatusInfo] = useState(null);

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
      const resp = err?.response?.data;
      const status = resp?.verificationStatus;
      const notes = resp?.verificationNotes;
      if (status === "pending_verification") {
        setError("Your account is pending admin verification. You'll receive an email once approved.");
        setStatusInfo({ status, notes });
      } else if (status === "rejected") {
        setError("Your registration was rejected by our verification team.");
        setStatusInfo({ status, notes });
      } else if (status === "suspended") {
        setError("Your account has been suspended.");
        setStatusInfo({ status, notes });
      } else if (status === "needs_more_info") {
        setError("Additional information is required for your verification.");
        setStatusInfo({ status, notes });
      } else {
        setError(resp?.error || "Invalid email or password.");
        setStatusInfo(null);
      }
    }
  }

  const statusColors = {
    pending_verification: { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E", icon: "⏳" },
    rejected: { bg: "#FEE2E2", border: "#FECACA", text: "#991B1B", icon: "❌" },
    suspended: { bg: "#F3E8FF", border: "#DDD6FE", text: "#6B21A8", icon: "⚠️" },
    needs_more_info: { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E", icon: "📋" },
  };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100vh", padding: 14, background: "linear-gradient(160deg, #061A14 0%, #0A2A1F 30%, #0D1F1A 70%, #071510 100%)", fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, rgba(12,90,62,.25), rgba(19,192,162,.1))", backdropFilter: "blur(20px)", border: "1px solid rgba(13,192,162,.25)", borderRadius: 20, padding: 16, color: "#fff", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 16, background: "linear-gradient(135deg, #0C5A3E, #13C0A2)", display: "grid", placeItems: "center" }}>
            <Stethoscope style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: 18 }}>Doctor Login</div>
            <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 600 }}>Manage your slots, fees, and appointments.</div>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", backdropFilter: "blur(30px)", borderRadius: 20, padding: 16 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Doctor email" style={inputStyle} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" style={inputStyle} />
        </div>

        {error && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: "#EF4444", fontWeight: 800 }}>{error}</div>
            {statusInfo && statusColors[statusInfo.status] && (
              <div style={{
                marginTop: 8, padding: "10px 12px", borderRadius: 12,
                background: statusColors[statusInfo.status].bg,
                border: `1px solid ${statusColors[statusInfo.status].border}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: statusColors[statusInfo.status].text }}>
                  {statusColors[statusInfo.status].icon} Status: {statusInfo.status.replace(/_/g, " ").toUpperCase()}
                </div>
                {statusInfo.notes && (
                  <div style={{ fontSize: 11, color: statusColors[statusInfo.status].text, marginTop: 4, fontWeight: 600 }}>
                    Admin note: {statusInfo.notes}
                  </div>
                )}
                {statusInfo.status === "pending_verification" && (
                  <div style={{ fontSize: 11, color: "#6B7280", marginTop: 6, fontWeight: 600 }}>
                    You'll receive an email at your registered address once your account is approved.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <motion.button whileTap={{ scale: 0.98 }} type="submit" style={{ marginTop: 12, width: "100%", height: 44, border: "none", borderRadius: 12, background: "linear-gradient(135deg, #0C5A3E, #13C0A2)", color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", boxShadow: "0 4px 20px rgba(13,192,162,.3)" }}>
          <LogIn style={{ width: 16, height: 16 }} /> Login to Dashboard
        </motion.button>
      </form>

      <div style={{ marginTop: 12, textAlign: "center", fontSize: 12, color: "#64748B", fontWeight: 700 }}>
        New doctor? <button onClick={() => navigate("/doctor/register")} style={{ border: "none", background: "transparent", color: "#6EE7B7", fontWeight: 900, cursor: "pointer", textDecoration: "underline" }}>Register here</button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  height: 42,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.1)",
  padding: "0 12px",
  fontSize: 13,
  fontWeight: 700,
  outline: "none",
  background: "rgba(255,255,255,.05)",
  color: "#E2E8F0",
  boxSizing: "border-box",
};
