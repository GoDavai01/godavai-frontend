import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { CalendarDays, CheckCircle2, Clock3, IndianRupee, LogOut, Save, Stethoscope, ToggleLeft, ToggleRight, XCircle } from "lucide-react";

const DEEP = "#0C5A3E";
const MID = "#0E7A4F";
const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const DAYS = [
  ["mon", "Mon"],
  ["tue", "Tue"],
  ["wed", "Wed"],
  ["thu", "Thu"],
  ["fri", "Fri"],
  ["sat", "Sat"],
  ["sun", "Sun"],
];

const DEFAULT_AVAILABILITY = {
  mon: { enabled: true, start: "09:00", end: "13:00" },
  tue: { enabled: true, start: "09:00", end: "13:00" },
  wed: { enabled: true, start: "09:00", end: "13:00" },
  thu: { enabled: true, start: "09:00", end: "13:00" },
  fri: { enabled: true, start: "09:00", end: "13:00" },
  sat: { enabled: false, start: "09:00", end: "13:00" },
  sun: { enabled: false, start: "09:00", end: "13:00" },
};

function doctorHeaders() {
  const token = localStorage.getItem("doctorToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState(null);
  const [fees, setFees] = useState({ video: "0", inperson: "0", call: "0" });
  const [availability, setAvailability] = useState(DEFAULT_AVAILABILITY);
  const [consults, setConsults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadDoctor() {
    const token = localStorage.getItem("doctorToken");
    if (!token) {
      navigate("/doctor/login", { replace: true });
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [meRes, consultsRes] = await Promise.all([
        axios.get(`${API}/api/doctors/me`, { headers: doctorHeaders() }),
        axios.get(`${API}/api/consults/doctor`, { headers: doctorHeaders() }),
      ]);
      const d = meRes?.data?.doctor;
      if (!d?.id) {
        setError("Doctor profile not found.");
        return;
      }
      setDoctor(d);
      setFees({
        video: String(d.feeVideo || 0),
        inperson: String(d.feeInPerson || 0),
        call: String(d.feeCall || 0),
      });
      setAvailability({ ...DEFAULT_AVAILABILITY, ...(d.availability || {}) });
      setConsults(Array.isArray(consultsRes?.data?.consults) ? consultsRes.data.consults : []);
      localStorage.setItem("doctorCurrentId", d.id);
    } catch (err) {
      if (err?.response?.status === 401) {
        localStorage.removeItem("doctorToken");
        localStorage.removeItem("doctorCurrentId");
        navigate("/doctor/login", { replace: true });
        return;
      }
      setError(err?.response?.data?.error || "Failed to load doctor dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDoctor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myAppointments = useMemo(() => {
    return [...consults].sort((a, b) => new Date(`${a.date} ${a.slot}`) - new Date(`${b.date} ${b.slot}`));
  }, [consults]);

  function updateDay(dayKey, field, value) {
    setAvailability((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        [field]: value,
      },
    }));
  }

  async function saveSettings() {
    setSaving(true);
    setError("");
    try {
      await Promise.all([
        axios.put(`${API}/api/doctors/me/fees`, {
          feeVideo: Number(fees.video || 0),
          feeInPerson: Number(fees.inperson || 0),
          feeCall: Number(fees.call || 0),
        }, { headers: doctorHeaders() }),
        axios.put(`${API}/api/doctors/me/availability`, { availability }, { headers: doctorHeaders() }),
      ]);
      await loadDoctor();
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function markStatus(consultId, action) {
    try {
      await axios.patch(`${API}/api/consults/${consultId}/status`, { action }, { headers: doctorHeaders() });
      await loadDoctor();
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to update consult status.");
    }
  }

  function logout() {
    localStorage.removeItem("doctorToken");
    localStorage.removeItem("doctorCurrentId");
    navigate("/doctor/login", { replace: true });
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100vh", padding: 14, background: "linear-gradient(180deg,#ECFDF5 0%,#E6F4FF 50%,#F8FAFC 100%)" }}>
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 18, padding: 16, fontSize: 13, fontWeight: 800, color: "#475569" }}>
          Loading doctor dashboard...
        </div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100vh", padding: 14, background: "linear-gradient(180deg,#ECFDF5 0%,#E6F4FF 50%,#F8FAFC 100%)" }}>
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 18, padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#0F172A", marginBottom: 8 }}>{error || "Doctor session not found"}</div>
          <button onClick={() => navigate("/doctor/login")} style={{ height: 40, border: "none", borderRadius: 10, background: `linear-gradient(135deg,${DEEP},${MID})`, color: "#fff", fontWeight: 900, cursor: "pointer", padding: "0 14px" }}>
            Go to Doctor Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100vh", padding: 14, paddingBottom: 120, background: "linear-gradient(180deg,#ECFDF5 0%,#E6F4FF 50%,#F8FAFC 100%)" }}>
      <div style={{ background: "linear-gradient(135deg,#0B4D35,#0A623E)", borderRadius: 20, padding: 14, color: "#fff", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: "rgba(0,217,126,0.18)", display: "grid", placeItems: "center" }}>
              <Stethoscope style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: 17 }}>{doctor.name}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{doctor.specialty}</div>
            </div>
          </div>
          <button onClick={logout} style={{ border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.10)", color: "#fff", borderRadius: 999, height: 30, padding: "0 10px", display: "flex", alignItems: "center", gap: 5, fontWeight: 800, cursor: "pointer" }}>
            <LogOut style={{ width: 12, height: 12 }} /> Logout
          </button>
        </div>
      </div>

      {error && <div style={{ marginBottom: 10, fontSize: 12, color: "#B91C1C", fontWeight: 800 }}>{error}</div>}

      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 18, padding: 14, marginBottom: 12 }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 900, color: "#0F172A", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <IndianRupee style={{ width: 14, height: 14 }} /> Consultation Fees
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <input value={fees.video} onChange={(e) => setFees((p) => ({ ...p, video: e.target.value }))} placeholder="Video fee" style={inputStyle} />
          <input value={fees.inperson} onChange={(e) => setFees((p) => ({ ...p, inperson: e.target.value }))} placeholder="In-person fee" style={inputStyle} />
          <input value={fees.call} onChange={(e) => setFees((p) => ({ ...p, call: e.target.value }))} placeholder="Call fee" style={inputStyle} />
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 18, padding: 14, marginBottom: 12 }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 900, color: "#0F172A", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <Clock3 style={{ width: 14, height: 14 }} /> Weekly Availability
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {DAYS.map(([key, label]) => {
            const row = availability[key] || { enabled: false, start: "09:00", end: "13:00" };
            return (
              <div key={key} style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: 8, display: "grid", gridTemplateColumns: "62px 70px 1fr 1fr", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#0F172A" }}>{label}</div>
                <button
                  onClick={() => updateDay(key, "enabled", !row.enabled)}
                  style={{ height: 28, borderRadius: 999, border: row.enabled ? "none" : "1px solid #D1D5DB", background: row.enabled ? "#DCFCE7" : "#fff", color: row.enabled ? "#166534" : "#475569", fontSize: 10.5, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                >
                  {row.enabled ? <ToggleRight style={{ width: 12, height: 12 }} /> : <ToggleLeft style={{ width: 12, height: 12 }} />} {row.enabled ? "On" : "Off"}
                </button>
                <input type="time" value={row.start} onChange={(e) => updateDay(key, "start", e.target.value)} disabled={!row.enabled} style={inputStyle} />
                <input type="time" value={row.end} onChange={(e) => updateDay(key, "end", e.target.value)} disabled={!row.enabled} style={inputStyle} />
              </div>
            );
          })}
        </div>

        <motion.button whileTap={{ scale: 0.98 }} onClick={saveSettings} disabled={saving} style={{ marginTop: 10, width: "100%", height: 40, border: "none", borderRadius: 12, background: saving ? "#CBD5E1" : `linear-gradient(135deg,${DEEP},${MID})`, color: "#fff", fontWeight: 900, fontFamily: "'Sora',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: saving ? "not-allowed" : "pointer" }}>
          <Save style={{ width: 14, height: 14 }} /> {saving ? "Saving..." : "Save Schedule and Fees"}
        </motion.button>
      </div>

      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 18, padding: 14 }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 900, color: "#0F172A", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <CalendarDays style={{ width: 14, height: 14 }} /> Patient Appointments
        </div>

        {myAppointments.length === 0 ? (
          <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>No booking yet for your profile.</div>
        ) : (
          myAppointments.map((a) => (
            <div key={a.id} style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: "8px 9px", marginBottom: 7 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0F172A" }}>{a.patientName}</div>
                  <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>{a.reason}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#065F46", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 999, padding: "4px 8px" }}>
                  {a.mode}
                </span>
              </div>
              <div style={{ marginTop: 6, fontSize: 10.5, color: "#475569", fontWeight: 700, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span>{a.dateLabel}</span>
                <span>{a.slot}</span>
                <span>Paid: {a.paymentMethod || "-"}</span>
                <span>Status: {a.status}</span>
              </div>
              <div style={{ marginTop: 7, display: "flex", gap: 6 }}>
                {a.status === "confirmed" && (
                  <button onClick={() => markStatus(a.id, "accept")} style={actionBtnGreen}>
                    <CheckCircle2 style={{ width: 12, height: 12 }} /> Accept
                  </button>
                )}
                {(a.status === "confirmed" || a.status === "accepted") && (
                  <button onClick={() => markStatus(a.id, "complete")} style={actionBtnBlue}>
                    <CheckCircle2 style={{ width: 12, height: 12 }} /> Complete
                  </button>
                )}
                {(a.status === "confirmed" || a.status === "accepted") && (
                  <button onClick={() => markStatus(a.id, "cancel")} style={actionBtnRed}>
                    <XCircle style={{ width: 12, height: 12 }} /> Cancel
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  height: 34,
  borderRadius: 8,
  border: "1.5px solid #D1D5DB",
  padding: "0 8px",
  fontSize: 12,
  fontWeight: 700,
  outline: "none",
  background: "#fff",
};

const actionBtnGreen = {
  border: "1px solid #A7F3D0",
  background: "#ECFDF5",
  color: "#166534",
  borderRadius: 8,
  height: 28,
  padding: "0 8px",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 10.5,
  fontWeight: 800,
  cursor: "pointer",
};

const actionBtnBlue = {
  border: "1px solid #BFDBFE",
  background: "#EFF6FF",
  color: "#1D4ED8",
  borderRadius: 8,
  height: 28,
  padding: "0 8px",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 10.5,
  fontWeight: 800,
  cursor: "pointer",
};

const actionBtnRed = {
  border: "1px solid #FECACA",
  background: "#FEF2F2",
  color: "#B91C1C",
  borderRadius: 8,
  height: 28,
  padding: "0 8px",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 10.5,
  fontWeight: 800,
  cursor: "pointer",
};
