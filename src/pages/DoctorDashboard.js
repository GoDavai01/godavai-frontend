import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { Bell, CalendarDays, Clock3, FileUp, IndianRupee, LogOut, MapPin, Save, ShieldCheck, Stethoscope, Wallet } from "lucide-react";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const DAYS = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]];
const DEFAULT_AVAILABILITY = {
  mon: { enabled: true, start: "09:00", end: "13:00" },
  tue: { enabled: true, start: "09:00", end: "13:00" },
  wed: { enabled: true, start: "09:00", end: "13:00" },
  thu: { enabled: true, start: "09:00", end: "13:00" },
  fri: { enabled: true, start: "09:00", end: "13:00" },
  sat: { enabled: false, start: "09:00", end: "13:00" },
  sun: { enabled: false, start: "09:00", end: "13:00" },
};

function headers() {
  const token = localStorage.getItem("doctorToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function toneForStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return { bg: "#ECFDF5", fg: "#065F46", border: "#86EFAC", text: "Approved" };
  if (s === "rejected") return { bg: "#FEF2F2", fg: "#991B1B", border: "#FCA5A5", text: "Rejected" };
  if (s === "needs_more_info") return { bg: "#FFFBEB", fg: "#92400E", border: "#FCD34D", text: "Needs More Info" };
  if (s === "suspended") return { bg: "#FEF2F2", fg: "#991B1B", border: "#FCA5A5", text: "Suspended" };
  return { bg: "#EFF6FF", fg: "#1E3A8A", border: "#93C5FD", text: "Pending Verification" };
}

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [doctor, setDoctor] = useState(null);
  const [consults, setConsults] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [reportFileById, setReportFileById] = useState({});
  const [reportNoteById, setReportNoteById] = useState({});

  const [fees, setFees] = useState({ feeVideo: "0", feeCall: "0", feeInPerson: "0" });
  const [availability, setAvailability] = useState(DEFAULT_AVAILABILITY);
  const [modes, setModes] = useState({ audio: true, video: true, inPerson: false });
  const [clinic, setClinic] = useState({
    name: "", fullAddress: "", locality: "", pincode: "", clinicLat: "", clinicLng: "",
    slotDurationMins: "15", patientArrivalWindowMins: "15", maxPatientsPerDay: "24", timingsText: "",
  });

  async function loadAll() {
    const token = localStorage.getItem("doctorToken");
    if (!token) {
      navigate("/doctor/login", { replace: true });
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [me, consultData, notifData] = await Promise.all([
        axios.get(`${API}/api/doctors/me`, { headers: headers() }),
        axios.get(`${API}/api/consults/doctor`, { headers: headers() }),
        axios.get(`${API}/api/doctors/me/notifications`, { headers: headers() }),
      ]);
      const d = me?.data?.doctor;
      setDoctor(d);
      setConsults(Array.isArray(consultData?.data?.consults) ? consultData.data.consults : []);
      setNotifications(Array.isArray(notifData?.data?.notifications) ? notifData.data.notifications : []);
      setFees({
        feeVideo: String(d?.feeVideo || 0),
        feeCall: String(d?.feeCall || 0),
        feeInPerson: String(d?.feeInPerson || 0),
      });
      setAvailability({ ...DEFAULT_AVAILABILITY, ...(d?.availability || {}) });
      setModes({
        audio: !!d?.consultModes?.audio,
        video: !!d?.consultModes?.video,
        inPerson: !!d?.consultModes?.inPerson,
      });
      const cp = d?.clinicProfile || {};
      setClinic({
        name: cp?.name || "",
        fullAddress: cp?.fullAddress || "",
        locality: cp?.locality || "",
        pincode: cp?.pincode || "",
        clinicLat: String(cp?.coordinates?.lat ?? ""),
        clinicLng: String(cp?.coordinates?.lng ?? ""),
        slotDurationMins: String(cp?.slotDurationMins || 15),
        patientArrivalWindowMins: String(cp?.patientArrivalWindowMins || 15),
        maxPatientsPerDay: String(cp?.maxPatientsPerDay || 24),
        timingsText: cp?.timingsText || "",
      });
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to load doctor dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const upcoming = useMemo(
    () => [...consults].sort((a, b) => new Date(`${a.date} ${a.slot}`) - new Date(`${b.date} ${b.slot}`)),
    [consults]
  );

  async function saveSettings() {
    setSaving(true);
    setError("");
    try {
      await Promise.all([
        axios.put(`${API}/api/doctors/me/fees`, {
          feeVideo: Number(fees.feeVideo || 0),
          feeCall: Number(fees.feeCall || 0),
          feeInPerson: Number(fees.feeInPerson || 0),
        }, { headers: headers() }),
        axios.put(`${API}/api/doctors/me/availability`, { availability }, { headers: headers() }),
        axios.put(`${API}/api/doctors/me/modes-clinic`, {
          modeAudio: modes.audio,
          modeVideo: modes.video,
          modeInPerson: modes.inPerson,
          clinicName: clinic.name,
          clinicAddress: clinic.fullAddress,
          clinicLocality: clinic.locality,
          clinicPincode: clinic.pincode,
          clinicLat: Number(clinic.clinicLat || 0),
          clinicLng: Number(clinic.clinicLng || 0),
          slotDurationMins: Number(clinic.slotDurationMins || 15),
          patientArrivalWindowMins: Number(clinic.patientArrivalWindowMins || 15),
          maxPatientsPerDay: Number(clinic.maxPatientsPerDay || 24),
          timingsText: clinic.timingsText,
          consultationDays: DAYS.filter(([k]) => availability[k]?.enabled).map(([k]) => k),
        }, { headers: headers() }),
      ]);
      await loadAll();
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to save doctor settings");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(consultId, action) {
    try {
      await axios.patch(`${API}/api/consults/${consultId}/status`, { action }, { headers: headers() });
      await loadAll();
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to update booking status");
    }
  }

  async function uploadPrescription(consultId) {
    const file = reportFileById[consultId];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("prescription", file);
      fd.append("notes", reportNoteById[consultId] || "");
      await axios.patch(`${API}/api/consults/${consultId}/prescription`, fd, {
        headers: { ...headers(), "Content-Type": "multipart/form-data" },
      });
      setReportFileById((p) => ({ ...p, [consultId]: null }));
      await loadAll();
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to upload prescription");
    }
  }

  function logout() {
    localStorage.removeItem("doctorToken");
    localStorage.removeItem("doctorCurrentId");
    navigate("/doctor/login", { replace: true });
  }

  if (loading) return <div style={styles.page}><div style={styles.card}>Loading doctor dashboard...</div></div>;
  if (!doctor) return <div style={styles.page}><div style={styles.card}>Doctor session missing</div></div>;

  const statusTone = toneForStatus(doctor.verificationStatus);

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={styles.hero}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={styles.heroIcon}><Stethoscope style={{ width: 18, height: 18 }} /></div>
            <div>
              <div style={styles.heroTitle}>{doctor.name}</div>
              <div style={styles.heroSub}>{doctor.specialty}</div>
            </div>
          </div>
          <button onClick={logout} style={styles.logoutBtn}><LogOut style={{ width: 12, height: 12 }} /> Logout</button>
        </motion.section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}><ShieldCheck style={styles.secIcon} /> Profile Status</div>
          <div style={{ ...styles.chip, background: statusTone.bg, color: statusTone.fg, border: `1px solid ${statusTone.border}` }}>
            {statusTone.text}
          </div>
          <div style={styles.metaText}>{doctor.verificationNotes || "Profile under verification checks."}</div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}><Wallet style={styles.secIcon} /> Your GoDavaii Platform / Service Fee Band</div>
          <div style={styles.metaText}>Band: {doctor?.platformFeeBand?.bandKey || "0_500"}</div>
          <div style={styles.metaText}>Service Fee: {doctor?.platformFeeBand?.serviceFee || 19} + applicable GST</div>
          {doctor?.platformFeeBand?.manualApprovalRequired ? <div style={styles.warn}>Manual commercial approval required for current fee.</div> : null}
        </section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}><IndianRupee style={styles.secIcon} /> Fees & Modes</div>
          <div style={styles.row3}>
            <input style={styles.input} value={fees.feeVideo} onChange={(e) => setFees((p) => ({ ...p, feeVideo: e.target.value }))} placeholder="Video fee" />
            <input style={styles.input} value={fees.feeCall} onChange={(e) => setFees((p) => ({ ...p, feeCall: e.target.value }))} placeholder="Audio fee" />
            <input style={styles.input} value={fees.feeInPerson} onChange={(e) => setFees((p) => ({ ...p, feeInPerson: e.target.value }))} placeholder="In-person fee" />
          </div>
          <div style={styles.modeRow}>
            <Pill active={modes.audio} label="Audio" onClick={() => setModes((p) => ({ ...p, audio: !p.audio }))} />
            <Pill active={modes.video} label="Video" onClick={() => setModes((p) => ({ ...p, video: !p.video }))} />
            <Pill active={modes.inPerson} label="In-person" onClick={() => setModes((p) => ({ ...p, inPerson: !p.inPerson }))} />
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}><Clock3 style={styles.secIcon} /> Availability & Slots</div>
          <div style={{ display: "grid", gap: 8 }}>
            {DAYS.map(([k, label]) => (
              <div key={k} style={styles.avRow}>
                <div style={{ width: 42, fontSize: 12, fontWeight: 900 }}>{label}</div>
                <input type="checkbox" checked={!!availability[k]?.enabled} onChange={(e) => setAvailability((p) => ({ ...p, [k]: { ...p[k], enabled: e.target.checked } }))} />
                <input type="time" style={styles.input} value={availability[k]?.start || "09:00"} onChange={(e) => setAvailability((p) => ({ ...p, [k]: { ...p[k], start: e.target.value } }))} />
                <input type="time" style={styles.input} value={availability[k]?.end || "13:00"} onChange={(e) => setAvailability((p) => ({ ...p, [k]: { ...p[k], end: e.target.value } }))} />
              </div>
            ))}
          </div>
        </section>

        {modes.inPerson ? (
          <section style={styles.card}>
            <div style={styles.sectionTitle}><MapPin style={styles.secIcon} /> Clinic Info (In-Person)</div>
            <input style={styles.input} placeholder="Clinic name" value={clinic.name} onChange={(e) => setClinic((p) => ({ ...p, name: e.target.value }))} />
            <input style={styles.input} placeholder="Clinic full address" value={clinic.fullAddress} onChange={(e) => setClinic((p) => ({ ...p, fullAddress: e.target.value }))} />
            <div style={styles.row2}>
              <input style={styles.input} placeholder="Locality" value={clinic.locality} onChange={(e) => setClinic((p) => ({ ...p, locality: e.target.value }))} />
              <input style={styles.input} placeholder="Pincode" value={clinic.pincode} onChange={(e) => setClinic((p) => ({ ...p, pincode: e.target.value }))} />
            </div>
            <div style={styles.row2}>
              <input style={styles.input} placeholder="Latitude" value={clinic.clinicLat} onChange={(e) => setClinic((p) => ({ ...p, clinicLat: e.target.value }))} />
              <input style={styles.input} placeholder="Longitude" value={clinic.clinicLng} onChange={(e) => setClinic((p) => ({ ...p, clinicLng: e.target.value }))} />
            </div>
            <div style={styles.row3}>
              <input style={styles.input} placeholder="Slot mins" value={clinic.slotDurationMins} onChange={(e) => setClinic((p) => ({ ...p, slotDurationMins: e.target.value }))} />
              <input style={styles.input} placeholder="Arrival window" value={clinic.patientArrivalWindowMins} onChange={(e) => setClinic((p) => ({ ...p, patientArrivalWindowMins: e.target.value }))} />
              <input style={styles.input} placeholder="Max/day" value={clinic.maxPatientsPerDay} onChange={(e) => setClinic((p) => ({ ...p, maxPatientsPerDay: e.target.value }))} />
            </div>
            <input style={styles.input} placeholder="Clinic timings summary" value={clinic.timingsText} onChange={(e) => setClinic((p) => ({ ...p, timingsText: e.target.value }))} />
          </section>
        ) : null}

        <button onClick={saveSettings} disabled={saving} style={styles.saveBtn}><Save style={{ width: 14, height: 14 }} /> {saving ? "Saving..." : "Save Settings"}</button>
        {error ? <div style={styles.error}>{error}</div> : null}

        <section style={styles.card}>
          <div style={styles.sectionTitle}><Bell style={styles.secIcon} /> Notifications</div>
          {!notifications.length ? <div style={styles.metaText}>No new notifications.</div> : notifications.slice(0, 8).map((n) => (
            <div key={n._id} style={styles.listRow}>
              <div style={{ fontSize: 12, fontWeight: 900 }}>{n.title}</div>
              <div style={styles.metaText}>{n.message}</div>
            </div>
          ))}
        </section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}><CalendarDays style={styles.secIcon} /> Upcoming Bookings</div>
          {!upcoming.length ? <div style={styles.metaText}>No bookings yet.</div> : upcoming.map((c) => (
            <div key={c.id} style={styles.bookingCard}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900 }}>{c.patientName}</div>
                  <div style={styles.metaText}>{c.dateLabel} | {c.slot} | {c.mode}</div>
                </div>
                <div style={styles.chip}>{c.status}</div>
              </div>
              <div style={{ ...styles.metaText, marginTop: 6 }}>Booking ID: {String(c.id).slice(-6)} | {c.bundledPriceLabel || `Rs ${c.fee}`}</div>
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 7 }}>
                {(c.status === "confirmed") ? <button style={styles.actionBtn} onClick={() => setStatus(c.id, "accept")}>Accept</button> : null}
                {["confirmed", "accepted"].includes(c.status) ? <button style={styles.actionBtn} onClick={() => setStatus(c.id, "completed")}>Complete</button> : null}
                {["confirmed", "accepted"].includes(c.status) ? <button style={styles.actionGhost} onClick={() => setStatus(c.id, "cancel")}>Cancel</button> : null}
              </div>
              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                <label style={styles.uploadLine}>
                  <FileUp style={{ width: 12, height: 12 }} />
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={(e) => setReportFileById((p) => ({ ...p, [c.id]: e.target.files?.[0] || null }))} />
                  {reportFileById[c.id] ? reportFileById[c.id].name : "Upload prescription"}
                </label>
                <input style={styles.input} placeholder="Prescription notes (optional)" value={reportNoteById[c.id] || ""} onChange={(e) => setReportNoteById((p) => ({ ...p, [c.id]: e.target.value }))} />
                <button style={styles.actionBtn} disabled={!reportFileById[c.id]} onClick={() => uploadPrescription(c.id)}>Submit Prescription</button>
                {c?.prescription?.fileUrl ? <a href={c.prescription.fileUrl} target="_blank" rel="noreferrer" style={styles.link}>View uploaded prescription</a> : null}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function Pill({ active, label, onClick }) {
  return <button onClick={onClick} style={{ ...styles.modePill, ...(active ? styles.modePillActive : null) }}>{label}</button>;
}

const styles = {
  page: { minHeight: "100vh", background: "linear-gradient(180deg,#EAF8F1 0%,#EAF3FF 45%,#F8FAFC 100%)", padding: 12, fontFamily: "'Plus Jakarta Sans',sans-serif" },
  wrap: { maxWidth: 760, margin: "0 auto", display: "grid", gap: 10 },
  hero: { borderRadius: 20, padding: 14, background: "linear-gradient(135deg,#0A4E37,#0D6B47)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" },
  heroIcon: { width: 40, height: 40, borderRadius: 14, background: "rgba(255,255,255,.16)", display: "grid", placeItems: "center" },
  heroTitle: { fontSize: 18, fontWeight: 900, fontFamily: "'Sora',sans-serif" },
  heroSub: { fontSize: 12, opacity: .9, fontWeight: 700 },
  logoutBtn: { height: 34, borderRadius: 999, border: "1px solid rgba(255,255,255,.24)", background: "rgba(255,255,255,.1)", color: "#fff", fontSize: 12, fontWeight: 800, padding: "0 10px", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" },
  card: { borderRadius: 18, background: "rgba(255,255,255,.95)", border: "1px solid rgba(15,23,42,.08)", boxShadow: "0 10px 26px rgba(15,23,42,.06)", padding: 12, display: "grid", gap: 8 },
  sectionTitle: { fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: 15, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 },
  secIcon: { width: 14, height: 14, color: "#0C5A3E" },
  metaText: { fontSize: 12, color: "#64748B", fontWeight: 700 },
  chip: { borderRadius: 999, border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#334155", fontSize: 11, fontWeight: 800, padding: "4px 8px", width: "fit-content" },
  warn: { borderRadius: 10, border: "1px solid #FCD34D", background: "#FFFBEB", color: "#92400E", fontSize: 12, fontWeight: 800, padding: "7px 9px" },
  input: { height: 36, borderRadius: 10, border: "1px solid #CBD5E1", padding: "0 10px", fontSize: 12, fontWeight: 700, width: "100%", outline: "none" },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  row3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },
  modeRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  modePill: { height: 33, borderRadius: 999, border: "1px solid #CBD5E1", background: "#fff", color: "#334155", fontSize: 12, fontWeight: 800, padding: "0 12px", cursor: "pointer" },
  modePillActive: { borderColor: "#0C5A3E", background: "#ECFDF5", color: "#065F46" },
  avRow: { border: "1px solid #E2E8F0", borderRadius: 10, padding: 8, display: "grid", gridTemplateColumns: "42px 28px 1fr 1fr", alignItems: "center", gap: 8 },
  saveBtn: { height: 38, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#0A4E37,#0D6B47)", color: "#fff", fontSize: 12, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" },
  error: { fontSize: 12, color: "#B91C1C", fontWeight: 800 },
  listRow: { border: "1px solid #E2E8F0", borderRadius: 10, background: "#fff", padding: 8, display: "grid", gap: 2 },
  bookingCard: { border: "1px solid #E2E8F0", borderRadius: 10, background: "#fff", padding: 9, display: "grid", gap: 4 },
  actionBtn: { height: 32, borderRadius: 9, border: "none", background: "linear-gradient(135deg,#0A4E37,#0D6B47)", color: "#fff", fontSize: 11.5, fontWeight: 800, padding: "0 10px", cursor: "pointer" },
  actionGhost: { height: 32, borderRadius: 9, border: "1px solid #D1D5DB", background: "#fff", color: "#0F172A", fontSize: 11.5, fontWeight: 800, padding: "0 10px", cursor: "pointer" },
  uploadLine: { height: 32, borderRadius: 9, border: "1px dashed #94A3B8", background: "#F8FAFC", color: "#0F172A", fontSize: 11.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 10px", cursor: "pointer", width: "fit-content" },
  link: { fontSize: 11.5, fontWeight: 800, color: "#0C5A3E", textDecoration: "none" },
};
