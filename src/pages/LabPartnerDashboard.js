import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarDays, CheckCircle2, Clock3, FlaskConical, LogOut, RefreshCw } from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0C5A3E";
const MID = "#0E7A4F";

function authConfig() {
  const token = localStorage.getItem("labPartnerToken");
  return { headers: { Authorization: `Bearer ${token}` } };
}

export default function LabPartnerDashboard() {
  const navigate = useNavigate();
  const [partner, setPartner] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [reportFiles, setReportFiles] = useState({});
  const [error, setError] = useState("");

  async function loadAll() {
    const token = localStorage.getItem("labPartnerToken");
    if (!token) {
      navigate("/lab-partner/login", { replace: true });
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [meRes, bookingRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/lab-partners/me`, authConfig()),
        axios.get(`${API_BASE_URL}/api/lab-partners/bookings`, { ...authConfig(), params: { unassigned: 1 } }),
      ]);
      setPartner(meRes?.data?.partner || null);
      setBookings(Array.isArray(bookingRes?.data?.bookings) ? bookingRes.data.bookings : []);
    } catch (err) {
      if (err?.response?.status === 401) {
        localStorage.removeItem("labPartnerToken");
        localStorage.removeItem("labPartnerProfile");
        navigate("/lab-partner/login", { replace: true });
        return;
      }
      setError(err?.response?.data?.error || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const s = { total: bookings.length, scheduled: 0, collected: 0, processing: 0, reportReady: 0 };
    for (const b of bookings) {
      if (b.status === "sample_scheduled") s.scheduled += 1;
      if (b.status === "sample_collected") s.collected += 1;
      if (b.status === "processing") s.processing += 1;
      if (b.status === "report_ready") s.reportReady += 1;
    }
    return s;
  }, [bookings]);

  async function updateStatus(booking, action) {
    if (!booking?.id || busyId) return;
    const selectedFile = reportFiles[booking.id];
    if (action === "report_ready" && !selectedFile && !booking?.reportFile?.fileKey) {
      setError("Please attach the report file before marking report ready.");
      return;
    }

    setBusyId(booking.id);
    setError("");
    try {
      if (selectedFile) {
        const fd = new FormData();
        fd.append("action", action);
        fd.append("reportFile", selectedFile);
        await axios.patch(`${API_BASE_URL}/api/lab-partners/bookings/${encodeURIComponent(booking.id)}/status`, fd, authConfig());
      } else {
        await axios.patch(`${API_BASE_URL}/api/lab-partners/bookings/${encodeURIComponent(booking.id)}/status`, { action }, authConfig());
      }

      setReportFiles((prev) => {
        const next = { ...prev };
        delete next[booking.id];
        return next;
      });
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to update booking status");
    } finally {
      setBusyId("");
    }
  }

  function logout() {
    localStorage.removeItem("labPartnerToken");
    localStorage.removeItem("labPartnerProfile");
    navigate("/lab-partner/login", { replace: true });
  }

  function nextActionFor(booking) {
    switch (booking.status) {
      case "sample_scheduled":
        return booking.assignedPartnerId ? { action: "collect", label: "Mark Sample Collected" } : { action: "accept", label: "Accept Booking" };
      case "sample_collected":
        return { action: "processing", label: "Start Processing" };
      case "processing":
        return { action: "report_ready", label: "Upload & Mark Report Ready" };
      case "report_ready":
        return { action: "completed", label: "Mark Completed" };
      default:
        return null;
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100vh", padding: 14, paddingBottom: 120, background: "linear-gradient(180deg,#ECFDF5 0%,#E6F4FF 50%,#F8FAFC 100%)" }}>
      <div style={{ background: "linear-gradient(135deg,#0B4D35,#0A623E)", borderRadius: 20, padding: 14, color: "#fff", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: "rgba(0,217,126,0.18)", display: "grid", placeItems: "center" }}>
              <FlaskConical style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: 17 }}>{partner?.name || "Lab Partner"}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{partner?.organization || partner?.city || "Diagnostics Operations"}</div>
            </div>
          </div>
          <button onClick={logout} style={{ border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.10)", color: "#fff", borderRadius: 999, height: 30, padding: "0 10px", display: "flex", alignItems: "center", gap: 5, fontWeight: 800, cursor: "pointer" }}>
            <LogOut style={{ width: 12, height: 12 }} /> Logout
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 12 }}>
        {[
          { k: "total", label: "Live" },
          { k: "scheduled", label: "Scheduled" },
          { k: "collected", label: "Collected" },
          { k: "processing", label: "Processing" },
        ].map((x) => (
          <div key={x.k} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: 10 }}>
            <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>{x.label}</div>
            <div style={{ marginTop: 2, fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 900, color: DEEP }}>{stats[x.k]}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 18, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 900, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
            <CalendarDays style={{ width: 14, height: 14 }} /> Lab Booking Queue
          </div>
          <button onClick={loadAll} style={{ border: "1px solid #D1D5DB", background: "#fff", borderRadius: 999, height: 28, padding: "0 10px", fontSize: 11, fontWeight: 800, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <RefreshCw style={{ width: 11, height: 11 }} /> Refresh
          </button>
        </div>

        {error ? <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 800, color: "#B91C1C" }}>{error}</div> : null}
        {loading ? <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>Loading bookings...</div> : null}

        {!loading && bookings.length === 0 ? (
          <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>No active lab bookings for now.</div>
        ) : null}

        {!loading && bookings.map((b) => {
          const next = nextActionFor(b);
          return (
            <div key={b.id} style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: "9px 10px", marginBottom: 8, background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0B1F16" }}>{b.items?.[0]?.name || "Lab Booking"}{(b.items?.length || 0) > 1 ? ` +${b.items.length - 1}` : ""}</div>
                  <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>{b.profileName} - {b.phone}</div>
                  <div style={{ marginTop: 4, fontSize: 10.5, color: "#475569", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Clock3 style={{ width: 11, height: 11 }} /> {b.dateLabel} - {b.slot}</span>
                    <span>{b.cityArea}</span>
                    <span>Rs {Number(b.total || 0)}</span>
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#065F46", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 999, padding: "4px 8px", textTransform: "capitalize" }}>
                  {String(b.status || "").replaceAll("_", " ")}
                </span>
              </div>

              {next?.action === "report_ready" ? (
                <div style={{ marginTop: 8 }}>
                  <label style={{ width: "100%", height: 34, borderRadius: 10, border: "1px solid #D1D5DB", background: "#fff", color: "#334155", fontSize: 11, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {reportFiles[b.id]?.name || b?.reportFileName || "Attach Report File (PDF/Image)"}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setReportFiles((prev) => ({ ...prev, [b.id]: f }));
                      }}
                    />
                  </label>
                </div>
              ) : null}

              <div style={{ marginTop: 8, display: "flex", gap: 7 }}>
                {next ? (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => updateStatus(b, next.action)}
                    disabled={busyId === b.id}
                    style={{ flex: 1, height: 34, border: "none", borderRadius: 10, background: busyId === b.id ? "#CBD5E1" : `linear-gradient(135deg,${DEEP},${MID})`, color: "#fff", fontSize: 11, fontWeight: 900, cursor: busyId === b.id ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                  >
                    <CheckCircle2 style={{ width: 13, height: 13 }} /> {busyId === b.id ? "Updating..." : next.label}
                  </motion.button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
