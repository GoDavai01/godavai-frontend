import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  IndianRupee,
  Landmark,
  MapPin,
  PhoneCall,
  Search,
  Star,
  Stethoscope,
  Video,
  Wallet,
  X,
  FileText,
  MessageCircle,
  ExternalLink,
  Phone,
} from "lucide-react";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0C5A3E";
const MID = "#0E7A4F";
const ACC = "#00D97E";
const FALLBACK_SPECIALTIES = [
  "All",
  "General Physician",
  "Internal Medicine",
  "Family Medicine",
  "Pediatrics",
  "Dermatology",
  "Gynecology",
  "Cardiology",
  "ENT",
  "Orthopedics",
  "Psychiatry",
  "Neurology",
  "Pulmonology",
  "Endocrinology",
  "Gastroenterology",
  "Nephrology",
  "Ophthalmology",
  "Urology",
  "Oncology",
  "Diabetology",
];

function next7Days() {
  const arr = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    arr.push({
      iso: d.toISOString().slice(0, 10),
      day: d.toLocaleDateString("en-IN", { weekday: "short" }),
      date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      full: d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }),
    });
  }
  return arr;
}

function userHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function mapModeForBackend(mode) {
  return mode === "call" ? "call" : mode;
}

function Glass({ children, style }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.84)",
        border: "1px solid rgba(12,90,62,0.08)",
        borderRadius: 22,
        boxShadow: "0 8px 30px rgba(0,0,0,0.05)",
        backdropFilter: "blur(10px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function DoctorCard({ doctor, mode, onBook }) {
  const fee = mode === "video" ? doctor.feeVideo : mode === "call" ? doctor.feeCall : doctor.feeInPerson;
  const priceLabel = mode === "inperson" ? (doctor.customerPriceLabelInPerson || `In-Person Visit Rs ${fee}`) : mode === "call" ? (doctor.customerPriceLabelCall || `Consultation Rs ${fee}`) : (doctor.customerPriceLabelVideo || `Consultation Rs ${fee}`);
  return (
    <Glass style={{ padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 16,
            background: "linear-gradient(135deg,#E8F5EF,#D1FAE5)",
            display: "grid",
            placeItems: "center",
            fontSize: 18,
            flexShrink: 0,
            fontWeight: 900,
            color: DEEP,
          }}
        >
          DR
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, color: "#0B1F16", fontSize: 14.5 }}>{doctor.name}</div>
          <div style={{ fontSize: 11.5, color: "#64748B", fontWeight: 700 }}>{doctor.specialty}</div>
          <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, color: "#0F766E", fontWeight: 800 }}>
              <Star style={{ width: 11, height: 11 }} /> {doctor.rating}
            </span>
            <span style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>{doctor.exp} yrs exp</span>
            <span style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>{(doctor.languages || []).join(", ")}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: "#64748B", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
        <MapPin style={{ width: 12, height: 12 }} /> {doctor.locality || doctor.clinic}
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(doctor.tags || []).map((tag) => (
          <span key={`${doctor.id}-${tag}`} style={{ padding: "4px 9px", borderRadius: 999, background: "#F0FDF4", border: "1px solid #D1FAE5", color: "#065F46", fontSize: 10, fontWeight: 800 }}>
            {tag}
          </span>
        ))}
      </div>

      <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <IndianRupee style={{ width: 14, height: 14, color: DEEP }} />
          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, color: DEEP, fontSize: 15 }}>{fee}</span>
          <span style={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>{priceLabel}</span>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBook}
          style={{
            height: 36,
            border: "none",
            borderRadius: 11,
            padding: "0 14px",
            background: `linear-gradient(135deg,${DEEP},${MID})`,
            color: "#fff",
            fontFamily: "'Sora',sans-serif",
            fontWeight: 900,
            fontSize: 11.5,
            cursor: "pointer",
          }}
        >
          Book Slot
        </motion.button>
      </div>
    </Glass>
  );
}

export default function Doctors() {
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("All");
  const [mode, setMode] = useState("video");
  const [sort, setSort] = useState("soonest");
  const [specialties, setSpecialties] = useState(FALLBACK_SPECIALTIES);
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(false);
  const [error, setError] = useState("");

  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [bookingDate, setBookingDate] = useState(next7Days()[0]?.iso || "");
  const [bookingSlot, setBookingSlot] = useState("");
  const [slotOptions, setSlotOptions] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [patientType, setPatientType] = useState("self");
  const [patientName, setPatientName] = useState("");
  const [reason, setReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  const dateList = useMemo(() => next7Days(), []);

  useEffect(() => {
    async function loadSpecialties() {
      try {
        const r = await axios.get(`${API}/api/doctors/specialties`);
        const list = Array.isArray(r.data) ? r.data : [];
        if (list.length) setSpecialties(list);
      } catch (_) {
        setSpecialties(FALLBACK_SPECIALTIES);
      }
    }
    loadSpecialties();
  }, []);

  useEffect(() => {
    async function loadDoctors() {
      setLoadingDoctors(true);
      setError("");
      try {
        const r = await axios.get(`${API}/api/doctors/list`, {
          params: {
            q: query || undefined,
            specialty: specialty === "All" ? undefined : specialty,
            sort,
            mode: mapModeForBackend(mode),
            limit: 60,
          },
        });
        setDoctors(Array.isArray(r?.data?.doctors) ? r.data.doctors : []);
      } catch (err) {
        setError(err?.response?.data?.error || "Failed to load doctors.");
        setDoctors([]);
      } finally {
        setLoadingDoctors(false);
      }
    }
    loadDoctors();
  }, [query, specialty, sort, mode]);

  async function loadMyConsults() {
    setLoadingAppts(true);
    try {
      const r = await axios.get(`${API}/api/consults/my`, { headers: userHeaders() });
      const list = Array.isArray(r?.data?.consults) ? r.data.consults : [];
      setAppointments(list);
    } catch (_) {
      setAppointments([]);
    } finally {
      setLoadingAppts(false);
    }
  }

  useEffect(() => {
    loadMyConsults();
  }, []);

  const loadSlotsForDoctor = useCallback(async (doctorId, date) => {
    if (!doctorId || !date) return;
    setSlotsLoading(true);
    try {
      const r = await axios.get(`${API}/api/doctors/${doctorId}/slots`, {
        params: { date, mode: mapModeForBackend(mode) },
      });
      const slots = Array.isArray(r?.data?.slots)
        ? r.data.slots
        : Array.isArray(r?.data?.availability?.[0]?.slots)
          ? r.data.availability[0].slots
          : [];
      const onlyAvailable = slots.filter((s) => s?.available).map((s) => s.slot);
      setSlotOptions(onlyAvailable);
      setBookingSlot(onlyAvailable[0] || "");
    } catch (_) {
      setSlotOptions([]);
      setBookingSlot("");
    } finally {
      setSlotsLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    if (bookingDoctor?.id && bookingDate) {
      loadSlotsForDoctor(bookingDoctor.id, bookingDate);
    }
  }, [bookingDoctor?.id, bookingDate, loadSlotsForDoctor]);

  const upcoming = useMemo(() => {
    return [...appointments]
      .filter((a) => ["pending_payment", "confirmed", "accepted", "live_now", "completed"].includes(a.status))
      .sort((a, b) => {
        const aActive = ["confirmed", "accepted", "live_now"].includes(a.status) ? 0 : 1;
        const bActive = ["confirmed", "accepted", "live_now"].includes(b.status) ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return new Date(b.createdAt) - new Date(a.createdAt);
      })
      .slice(0, 10);
  }, [appointments]);

  async function bookNow() {
    if (!bookingDoctor || !bookingDate || !bookingSlot || !paymentMethod) return;
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please login again to book consultation.");
      return;
    }

    setBookingLoading(true);
    setError("");
    try {
      const createRes = await axios.post(
        `${API}/api/consults/create`,
        {
          doctorId: bookingDoctor.id,
          mode: mapModeForBackend(mode),
          date: bookingDate,
          slot: bookingSlot,
          patientType,
          patientName: patientName.trim() || (patientType === "self" ? "Self" : "Family Member"),
          reason: reason.trim() || "General consultation",
          paymentMethod,
        },
        { headers: userHeaders() }
      );

      const consult = createRes?.data?.consult;
      const paymentRef = createRes?.data?.paymentIntent?.paymentRef || consult?.paymentRef || "";
      if (!consult?.id) throw new Error("Consult hold failed");

      const transactionId = `TXN-${Date.now()}`;
      await axios.post(`${API}/api/payments/verify`, {
        consultId: consult.id,
        paymentRef,
        paymentMethod,
        transactionId,
      });

      setBookingDoctor(null);
      setReason("");
      setPatientName("");
      setPatientType("self");
      setPaymentMethod("");
      setBookingSlot("");
      setSlotOptions([]);
      await loadMyConsults();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Booking failed.");
    } finally {
      setBookingLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100vh", paddingBottom: 120, background: "linear-gradient(180deg,#ECFDF5 0%,#E6F4FF 45%,#F8FAFC 100%)" }}>
      <div style={{ padding: "14px 14px 8px" }}>
        <Glass style={{ padding: 14, background: "linear-gradient(135deg,#0B4D35,#0A623E)", color: "#fff", border: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 42, height: 42, borderRadius: 15, background: "rgba(0,217,126,0.18)", display: "grid", placeItems: "center" }}>
              <Stethoscope style={{ width: 20, height: 20, color: ACC }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 900 }}>Doctor Consult</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.72)" }}>
                Book video, audio, or in-person appointment with payment lock.
              </div>
            </div>
          </div>
        </Glass>

        {error && <div style={{ marginTop: 8, fontSize: 12, color: "#B91C1C", fontWeight: 800 }}>{error}</div>}

        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search style={{ width: 14, height: 14, color: "#94A3B8", position: "absolute", top: 12, left: 10 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search doctor, specialty, symptom..."
              style={{
                width: "100%",
                height: 38,
                borderRadius: 12,
                border: "1.5px solid rgba(12,90,62,0.16)",
                padding: "0 10px 0 32px",
                fontSize: 12.5,
                fontWeight: 700,
                outline: "none",
              }}
            />
          </div>
          <div style={{ width: 112, position: "relative" }}>
            <Filter style={{ width: 13, height: 13, color: "#94A3B8", position: "absolute", top: 12, left: 8 }} />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              style={{
                width: "100%",
                height: 38,
                borderRadius: 12,
                border: "1.5px solid rgba(12,90,62,0.16)",
                padding: "0 8px 0 26px",
                fontSize: 11.5,
                fontWeight: 700,
                background: "#fff",
                outline: "none",
              }}
            >
              <option value="soonest">Soonest</option>
              <option value="rating">Top Rated</option>
              <option value="fee">Low Fee</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button onClick={() => setMode("video")} style={{ flex: 1, height: 34, borderRadius: 999, border: mode === "video" ? "none" : "1px solid #D1D5DB", background: mode === "video" ? `linear-gradient(135deg,${DEEP},${MID})` : "#fff", color: mode === "video" ? "#fff" : "#1F2937", fontWeight: 800, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <Video style={{ width: 13, height: 13 }} /> Video
          </button>
          <button onClick={() => setMode("inperson")} style={{ flex: 1, height: 34, borderRadius: 999, border: mode === "inperson" ? "none" : "1px solid #D1D5DB", background: mode === "inperson" ? `linear-gradient(135deg,${DEEP},${MID})` : "#fff", color: mode === "inperson" ? "#fff" : "#1F2937", fontWeight: 800, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <MapPin style={{ width: 13, height: 13 }} /> In-Person
          </button>
          <button onClick={() => setMode("call")} style={{ flex: 1, height: 34, borderRadius: 999, border: mode === "call" ? "none" : "1px solid #D1D5DB", background: mode === "call" ? `linear-gradient(135deg,${DEEP},${MID})` : "#fff", color: mode === "call" ? "#fff" : "#1F2937", fontWeight: 800, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <PhoneCall style={{ width: 13, height: 13 }} /> Audio
          </button>
        </div>

        <div style={{ marginTop: 8, display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
          {specialties.map((s) => (
            <button
              key={s}
              onClick={() => setSpecialty(s)}
              style={{
                flexShrink: 0,
                height: 32,
                borderRadius: 999,
                border: specialty === s ? "none" : "1px solid rgba(12,90,62,0.18)",
                padding: "0 12px",
                fontWeight: 800,
                fontSize: 11.5,
                cursor: "pointer",
                background: specialty === s ? DEEP : "#fff",
                color: specialty === s ? "#fff" : "#1F2937",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 14px 8px" }}>
        <Glass style={{ padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 900, color: "#0F172A" }}>My Appointments</div>
            <button onClick={loadMyConsults} style={{ border: "none", background: "none", fontSize: 11, fontWeight: 800, color: DEEP, cursor: "pointer" }}>Refresh</button>
          </div>
          {loadingAppts ? (
            <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700, padding: "8px 0" }}>Loading appointments...</div>
          ) : upcoming.length === 0 ? (
            <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700, padding: "8px 0" }}>No appointment yet. Select a doctor and book your first slot.</div>
          ) : (
            upcoming.map((a) => {
              const isLive = a.callState === "live" || a.status === "live_now";
              const canJoin = ["confirmed", "accepted", "live_now"].includes(a.status) && a.paymentStatus === "paid" && a.mode !== "inperson";
              const hasPrescription = !!a?.prescription?.fileUrl;
              const modeIcon = a.mode === "video" ? Video : a.mode === "call" ? Phone : MapPin;
              const modeLabel = a.mode === "video" ? "Video" : a.mode === "call" ? "Audio" : "In-Person";
              const modeColor = a.mode === "video" ? "#7C3AED" : a.mode === "call" ? "#0EA5E9" : "#D97706";
              const modeBg = a.mode === "video" ? "#F5F3FF" : a.mode === "call" ? "#F0F9FF" : "#FFFBEB";
              const modeBorder = a.mode === "video" ? "#DDD6FE" : a.mode === "call" ? "#BAE6FD" : "#FDE68A";
              const ModeIcon = modeIcon;
              return (
                <div key={a.id} style={{ borderRadius: 18, overflow: "hidden", marginBottom: 10, border: isLive ? "1.5px solid #10B981" : "1px solid #E2E8F0", background: isLive ? "linear-gradient(135deg,#ECFDF5,#F0FDF4)" : "#fff", boxShadow: isLive ? "0 4px 20px rgba(16,185,129,0.12)" : "0 2px 8px rgba(0,0,0,0.03)" }}>
                  {isLive && <div style={{ height: 3, background: "linear-gradient(90deg,#10B981,#34D399,#10B981)", backgroundSize: "200% 100%", animation: "liveBar 1.5s linear infinite" }} />}
                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 14, background: "linear-gradient(135deg,#E8F5EF,#D1FAE5)", display: "grid", placeItems: "center", fontSize: 15, fontWeight: 900, color: DEEP, flexShrink: 0 }}>DR</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 900, color: "#0B1F16" }}>{a.doctorName}</div>
                          <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>{a.specialty}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        {isLive && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", animation: "pulse 1.5s ease-in-out infinite" }} />}
                        <span style={{ fontSize: 10, fontWeight: 900, color: isLive ? "#065F46" : modeColor, background: isLive ? "#D1FAE5" : modeBg, border: `1px solid ${isLive ? "#A7F3D0" : modeBorder}`, padding: "4px 10px", borderRadius: 999, display: "flex", alignItems: "center", gap: 4 }}>
                          <ModeIcon style={{ width: 11, height: 11 }} /> {isLive ? "LIVE" : modeLabel}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                      <span style={{ fontSize: 10.5, color: "#475569", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <CalendarDays style={{ width: 12, height: 12 }} /> {a.dateLabel}
                      </span>
                      <span style={{ fontSize: 10.5, color: "#475569", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Clock3 style={{ width: 12, height: 12 }} /> {a.slot}
                      </span>
                      <span style={{ fontSize: 10.5, color: "#475569", fontWeight: 800 }}>Patient: {a.patientName}</span>
                      <span style={{ fontSize: 10.5, color: "#475569", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Wallet style={{ width: 12, height: 12 }} /> {a.paymentMethod || "-"}
                      </span>
                    </div>

                    {a.mode === "inperson" && (
                      <div style={{ fontSize: 10.8, fontWeight: 800, color: "#0F172A", marginBottom: 8, background: "#F8FAFC", borderRadius: 10, padding: "8px 10px", border: "1px solid #E2E8F0" }}>
                        <MapPin style={{ width: 12, height: 12, display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
                        {a?.clinicLocation?.locality || "Locality hidden"}
                        {a?.clinicLocation?.exactUnlocked ? ` · ${a?.clinicLocation?.fullAddress || ""}` : " · Address unlocks after payment"}
                        {a?.clinicLocation?.exactUnlocked && a?.clinicLocation?.coordinates?.lat ? (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${a.clinicLocation.coordinates.lat},${a.clinicLocation.coordinates.lng}`} target="_blank" rel="noreferrer" style={{ marginLeft: 6, color: DEEP, fontWeight: 900, fontSize: 10.5 }}>
                            <ExternalLink style={{ width: 11, height: 11, display: "inline", verticalAlign: "-1.5px" }} /> Maps
                          </a>
                        ) : null}
                      </div>
                    )}

                    {hasPrescription && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "8px 12px", marginBottom: 8 }}>
                        <FileText style={{ width: 16, height: 16, color: "#15803D", flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 900, color: "#166534" }}>Prescription Available</div>
                          <div style={{ fontSize: 10, color: "#4ADE80", fontWeight: 700 }}>Uploaded by {a.doctorName}</div>
                        </div>
                        <a href={a.prescription.fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, fontWeight: 900, color: "#fff", background: "linear-gradient(135deg,#15803D,#22C55E)", padding: "6px 12px", borderRadius: 999, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                          <FileText style={{ width: 11, height: 11 }} /> View
                        </a>
                      </div>
                    )}

                    {canJoin && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <motion.button whileTap={{ scale: 0.95 }} onClick={() => {
                          const roomId = a.consultRoomId || `consult_${a.id?.slice(-8)}`;
                          window.open(`https://meet.jit.si/${roomId}`, "_blank");
                        }} style={{ flex: 1, height: 40, border: "none", borderRadius: 14, background: isLive ? "linear-gradient(135deg,#059669,#10B981)" : `linear-gradient(135deg,${DEEP},${MID})`, color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: isLive ? "0 8px 24px rgba(16,185,129,0.3)" : "0 6px 18px rgba(12,90,62,0.2)" }}>
                          {a.mode === "video" ? <Video style={{ width: 14, height: 14 }} /> : <PhoneCall style={{ width: 14, height: 14 }} />}
                          {isLive ? "Join Now — LIVE" : "Join Consultation"}
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.95 }} onClick={() => {
                          const roomId = a.consultRoomId || `consult_${a.id?.slice(-8)}`;
                          window.open(`https://meet.jit.si/${roomId}#config.startWithVideoMuted=true&config.startWithAudioMuted=true`, "_blank");
                        }} style={{ width: 40, height: 40, borderRadius: 14, border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}>
                          <MessageCircle style={{ width: 16, height: 16, color: DEEP }} />
                        </motion.button>
                      </div>
                    )}

                    {a.status === "completed" && !hasPrescription && (
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#92400E", background: "#FFFBEB", borderRadius: 10, padding: "6px 10px", border: "1px solid #FDE68A" }}>
                        ⏳ Consultation completed — prescription pending from doctor
                      </div>
                    )}
                    {a.status === "completed" && hasPrescription && (
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#065F46", background: "#ECFDF5", borderRadius: 10, padding: "6px 10px", border: "1px solid #A7F3D0" }}>
                        ✅ Consultation completed — prescription available above
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </Glass>

        {loadingDoctors ? (
          <Glass style={{ padding: 12, fontSize: 12, fontWeight: 700, color: "#64748B" }}>Loading doctors...</Glass>
        ) : (
          doctors.map((doctor) => (
            <DoctorCard
              key={doctor.id}
              doctor={doctor}
              mode={mode}
              onBook={() => {
                setBookingDoctor(doctor);
                setBookingDate(dateList[0]?.iso || "");
                setBookingSlot("");
                setSlotOptions([]);
                setPaymentMethod("");
              }}
            />
          ))
        )}
      </div>

      <AnimatePresence>
        {bookingDoctor && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBookingDoctor(null)} style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.5)", zIndex: 1300 }} />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1301, maxWidth: 520, margin: "0 auto", background: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: "14px 14px calc(14px + env(safe-area-inset-bottom,0px))" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 900, color: "#0F172A" }}>Book Appointment</div>
                <button onClick={() => setBookingDoctor(null)} style={{ width: 30, height: 30, borderRadius: 999, border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}>
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>

              <div style={{ fontSize: 13, fontWeight: 900, color: "#0B1F16" }}>{bookingDoctor.name}</div>
              <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, marginBottom: 10 }}>{bookingDoctor.specialty}</div>
              {mode === "inperson" ? <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 800, color: "#92400E", background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 10, padding: "6px 8px" }}>In-person bookings are prepaid and slot-confirmed after successful payment.</div> : null}

              <div style={{ display: "flex", gap: 7, overflowX: "auto", scrollbarWidth: "none", marginBottom: 10 }}>
                {dateList.map((d) => (
                  <button key={d.iso} onClick={() => setBookingDate(d.iso)} style={{ flexShrink: 0, minWidth: 68, borderRadius: 12, border: bookingDate === d.iso ? "none" : "1px solid #D1D5DB", background: bookingDate === d.iso ? DEEP : "#fff", color: bookingDate === d.iso ? "#fff" : "#1F2937", cursor: "pointer", padding: "6px 8px" }}>
                    <div style={{ fontSize: 10.5, fontWeight: 900 }}>{d.day}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.9 }}>{d.date}</div>
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7, marginBottom: 10 }}>
                {slotsLoading ? (
                  <div style={{ gridColumn: "1 / span 4", fontSize: 11, fontWeight: 700, color: "#64748B" }}>Loading slots...</div>
                ) : slotOptions.length === 0 ? (
                  <div style={{ gridColumn: "1 / span 4", fontSize: 11, fontWeight: 700, color: "#B91C1C" }}>No available slots for selected date.</div>
                ) : (
                  slotOptions.map((slot) => (
                    <button key={slot} onClick={() => setBookingSlot(slot)} style={{ height: 32, borderRadius: 9, border: bookingSlot === slot ? "none" : "1px solid #D1D5DB", background: bookingSlot === slot ? "#DCFCE7" : "#fff", color: bookingSlot === slot ? "#166534" : "#0F172A", fontSize: 10.5, fontWeight: 800, cursor: "pointer" }}>
                      {slot}
                    </button>
                  ))
                )}
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {[
                  { key: "self", label: "For Me" },
                  { key: "family", label: "Family" },
                  { key: "new", label: "New Profile" },
                ].map((p) => (
                  <button key={p.key} onClick={() => setPatientType(p.key)} style={{ flex: 1, height: 32, borderRadius: 999, border: patientType === p.key ? "none" : "1px solid #D1D5DB", background: patientType === p.key ? DEEP : "#fff", color: patientType === p.key ? "#fff" : "#1F2937", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                    {p.label}
                  </button>
                ))}
              </div>

              {patientType !== "self" && (
                <input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder={patientType === "family" ? "Family member name" : "Name for new profile"}
                  style={{ width: "100%", height: 36, borderRadius: 10, border: "1.5px solid #D1D5DB", padding: "0 10px", fontSize: 12, fontWeight: 700, marginBottom: 8, outline: "none" }}
                />
              )}

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Reason/symptoms (optional)"
                style={{ width: "100%", borderRadius: 10, border: "1.5px solid #D1D5DB", padding: 10, fontSize: 12, fontWeight: 700, resize: "none", marginBottom: 8, outline: "none" }}
              />

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11.5, fontWeight: 900, color: "#0F172A", marginBottom: 6 }}>Payment Method</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                  {[
                    { key: "upi", label: "UPI", icon: <Wallet style={{ width: 12, height: 12 }} /> },
                    { key: "card", label: "Card", icon: <Landmark style={{ width: 12, height: 12 }} /> },
                    { key: "netbanking", label: "Netbank", icon: <Landmark style={{ width: 12, height: 12 }} /> },
                  ].map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setPaymentMethod(p.key)}
                      style={{
                        height: 34,
                        borderRadius: 9,
                        border: paymentMethod === p.key ? "none" : "1px solid #D1D5DB",
                        background: paymentMethod === p.key ? "#DCFCE7" : "#fff",
                        color: paymentMethod === p.key ? "#166534" : "#1F2937",
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}
                    >
                      {p.icon} {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={bookNow}
                disabled={!paymentMethod || !bookingSlot || bookingLoading}
                style={{
                  width: "100%",
                  height: 42,
                  border: "none",
                  borderRadius: 12,
                  background: paymentMethod && bookingSlot && !bookingLoading ? `linear-gradient(135deg,${DEEP},${MID})` : "#CBD5E1",
                  color: "#fff",
                  fontWeight: 900,
                  fontFamily: "'Sora',sans-serif",
                  cursor: paymentMethod && bookingSlot && !bookingLoading ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                }}
              >
                <CheckCircle2 style={{ width: 15, height: 15 }} /> {bookingLoading ? "Processing..." : "Pay and Confirm Booking"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}
        @keyframes liveBar{0%{background-position:0% 0}100%{background-position:200% 0}}
      `}</style>
    </div>
  );
}