import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  IndianRupee,
  MapPin,
  PhoneCall,
  Search,
  Star,
  Stethoscope,
  Video,
  X,
} from "lucide-react";

const DEEP = "#0C5A3E";
const MID = "#0E7A4F";
const ACC = "#00D97E";

const SPECIALTIES = [
  "All",
  "General Physician",
  "Pediatrics",
  "Dermatology",
  "Gynecology",
  "Cardiology",
  "ENT",
  "Orthopedics",
  "Psychiatry",
];

const DOCTORS = [
  { id: "d1", name: "Dr. Riya Sharma", specialty: "General Physician", rating: 4.8, exp: 11, languages: ["Hindi", "English"], city: "Delhi", feeVideo: 499, feeInPerson: 700, clinic: "CarePoint Clinic, Karol Bagh", tags: ["Fever", "Infection", "BP"] },
  { id: "d2", name: "Dr. Arjun Menon", specialty: "Cardiology", rating: 4.9, exp: 15, languages: ["English", "Hindi"], city: "Delhi", feeVideo: 899, feeInPerson: 1400, clinic: "Metro Heart Center, CP", tags: ["ECG", "BP", "Cholesterol"] },
  { id: "d3", name: "Dr. Kavya Patel", specialty: "Dermatology", rating: 4.7, exp: 9, languages: ["Hindi", "English", "Gujarati"], city: "Delhi", feeVideo: 599, feeInPerson: 850, clinic: "SkinHub, Rajouri Garden", tags: ["Acne", "Hair", "Allergy"] },
  { id: "d4", name: "Dr. Nikhil Bansal", specialty: "Pediatrics", rating: 4.8, exp: 12, languages: ["Hindi", "English"], city: "Delhi", feeVideo: 549, feeInPerson: 780, clinic: "HappyKids Clinic, Pitampura", tags: ["Child Fever", "Vaccination"] },
  { id: "d5", name: "Dr. Sana Iqbal", specialty: "Gynecology", rating: 4.8, exp: 10, languages: ["Hindi", "English", "Urdu"], city: "Delhi", feeVideo: 699, feeInPerson: 1100, clinic: "WomenCare, Lajpat Nagar", tags: ["PCOS", "Pregnancy", "Hormones"] },
  { id: "d6", name: "Dr. Pranav Rao", specialty: "Orthopedics", rating: 4.6, exp: 13, languages: ["English", "Hindi"], city: "Delhi", feeVideo: 649, feeInPerson: 999, clinic: "Joint & Bone, Dwarka", tags: ["Back Pain", "Knee", "Sports"] },
];

const SLOT_POOL = ["09:00 AM", "09:30 AM", "10:00 AM", "11:00 AM", "12:30 PM", "04:00 PM", "05:30 PM", "07:00 PM"];
const ORDER_KEY = "gd_doctor_appointments_v1";

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

function safeReadLocal() {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocal(appointments) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(appointments));
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
  const fee = mode === "video" ? doctor.feeVideo : doctor.feeInPerson;
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
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          👨‍⚕️
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, color: "#0B1F16", fontSize: 14.5 }}>{doctor.name}</div>
          <div style={{ fontSize: 11.5, color: "#64748B", fontWeight: 700 }}>{doctor.specialty}</div>
          <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, color: "#0F766E", fontWeight: 800 }}>
              <Star style={{ width: 11, height: 11 }} /> {doctor.rating}
            </span>
            <span style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>{doctor.exp} yrs exp</span>
            <span style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>{doctor.languages.join(", ")}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: "#64748B", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
        <MapPin style={{ width: 12, height: 12 }} /> {doctor.clinic}
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {doctor.tags.map((tag) => (
          <span key={`${doctor.id}-${tag}`} style={{ padding: "4px 9px", borderRadius: 999, background: "#F0FDF4", border: "1px solid #D1FAE5", color: "#065F46", fontSize: 10, fontWeight: 800 }}>
            {tag}
          </span>
        ))}
      </div>

      <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <IndianRupee style={{ width: 14, height: 14, color: DEEP }} />
          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, color: DEEP, fontSize: 15 }}>{fee}</span>
          <span style={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>{mode === "video" ? "Video consult" : "Clinic visit"}</span>
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
  const [appointments, setAppointments] = useState(() => safeReadLocal());
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [bookingDate, setBookingDate] = useState(next7Days()[0]?.iso || "");
  const [bookingSlot, setBookingSlot] = useState(SLOT_POOL[0]);
  const [patientType, setPatientType] = useState("self");
  const [patientName, setPatientName] = useState("");
  const [reason, setReason] = useState("");

  const dateList = useMemo(() => next7Days(), []);

  const visibleDoctors = useMemo(() => {
    let list = [...DOCTORS];
    if (specialty !== "All") list = list.filter((d) => d.specialty === specialty);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.specialty.toLowerCase().includes(q) ||
          d.tags.join(" ").toLowerCase().includes(q)
      );
    }
    if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
    if (sort === "fee") {
      list.sort((a, b) =>
        (mode === "video" ? a.feeVideo : a.feeInPerson) -
        (mode === "video" ? b.feeVideo : b.feeInPerson)
      );
    }
    return list;
  }, [query, specialty, sort, mode]);

  const upcoming = useMemo(
    () =>
      [...appointments]
        .sort((a, b) => new Date(`${a.date} ${a.slot}`) - new Date(`${b.date} ${b.slot}`))
        .slice(0, 6),
    [appointments]
  );

  function bookNow() {
    if (!bookingDoctor || !bookingDate || !bookingSlot) return;
    const chosenDate = dateList.find((d) => d.iso === bookingDate);
    const row = {
      id: `${Date.now()}`,
      doctorId: bookingDoctor.id,
      doctorName: bookingDoctor.name,
      specialty: bookingDoctor.specialty,
      mode,
      date: bookingDate,
      dateLabel: chosenDate?.full || bookingDate,
      slot: bookingSlot,
      patientType,
      patientName: patientName.trim() || (patientType === "self" ? "Self" : "Family Member"),
      reason: reason.trim() || "General consultation",
      fee: mode === "video" ? bookingDoctor.feeVideo : bookingDoctor.feeInPerson,
      status: "confirmed",
    };
    const next = [row, ...appointments];
    setAppointments(next);
    saveLocal(next);
    setBookingDoctor(null);
    setReason("");
    setPatientName("");
    setPatientType("self");
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
                Book video or in-person appointment in 3 steps.
              </div>
            </div>
          </div>
        </Glass>

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
          {SPECIALTIES.map((s) => (
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
        <Glass style={{ padding: "10px 12px", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 900, color: "#0F172A", marginBottom: 6 }}>Upcoming Appointments</div>
          {upcoming.length === 0 ? (
            <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>No appointment yet. Select a doctor and book your first slot.</div>
          ) : (
            upcoming.map((a) => (
              <div key={a.id} style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: "9px 10px", marginBottom: 7, background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0B1F16" }}>{a.doctorName}</div>
                    <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>{a.specialty}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 900, color: "#065F46", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "4px 8px", borderRadius: 999 }}>
                    {a.mode === "video" ? "Video" : a.mode === "inperson" ? "In-Person" : "Audio"}
                  </span>
                </div>
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10.5, color: "#475569", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <CalendarDays style={{ width: 12, height: 12 }} /> {a.dateLabel}
                  </span>
                  <span style={{ fontSize: 10.5, color: "#475569", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Clock3 style={{ width: 12, height: 12 }} /> {a.slot}
                  </span>
                  <span style={{ fontSize: 10.5, color: "#475569", fontWeight: 800 }}>Patient: {a.patientName}</span>
                </div>
              </div>
            ))
          )}
        </Glass>

        {visibleDoctors.map((doctor) => (
          <DoctorCard
            key={doctor.id}
            doctor={doctor}
            mode={mode === "call" ? "video" : mode}
            onBook={() => {
              setBookingDoctor(doctor);
              setBookingDate(dateList[0]?.iso || "");
              setBookingSlot(SLOT_POOL[0]);
            }}
          />
        ))}
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

              <div style={{ display: "flex", gap: 7, overflowX: "auto", scrollbarWidth: "none", marginBottom: 10 }}>
                {dateList.map((d) => (
                  <button key={d.iso} onClick={() => setBookingDate(d.iso)} style={{ flexShrink: 0, minWidth: 68, borderRadius: 12, border: bookingDate === d.iso ? "none" : "1px solid #D1D5DB", background: bookingDate === d.iso ? DEEP : "#fff", color: bookingDate === d.iso ? "#fff" : "#1F2937", cursor: "pointer", padding: "6px 8px" }}>
                    <div style={{ fontSize: 10.5, fontWeight: 900 }}>{d.day}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.9 }}>{d.date}</div>
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7, marginBottom: 10 }}>
                {SLOT_POOL.map((slot) => (
                  <button key={slot} onClick={() => setBookingSlot(slot)} style={{ height: 32, borderRadius: 9, border: bookingSlot === slot ? "none" : "1px solid #D1D5DB", background: bookingSlot === slot ? "#DCFCE7" : "#fff", color: bookingSlot === slot ? "#166534" : "#0F172A", fontSize: 10.5, fontWeight: 800, cursor: "pointer" }}>
                    {slot}
                  </button>
                ))}
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
                style={{ width: "100%", borderRadius: 10, border: "1.5px solid #D1D5DB", padding: 10, fontSize: 12, fontWeight: 700, resize: "none", marginBottom: 10, outline: "none" }}
              />

              <button onClick={bookNow} style={{ width: "100%", height: 42, border: "none", borderRadius: 12, background: `linear-gradient(135deg,${DEEP},${MID})`, color: "#fff", fontWeight: 900, fontFamily: "'Sora',sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <CheckCircle2 style={{ width: 15, height: 15 }} /> Confirm Booking
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
