import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  readStoredConsultBookings,
  upsertStoredConsultBooking,
  sortConsultBookings,
} from "../utils/consultBookings";
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
    const localYear = d.getFullYear();
    const localMonth = String(d.getMonth() + 1).padStart(2, "0");
    const localDate = String(d.getDate()).padStart(2, "0");
    arr.push({
      iso: `${localYear}-${localMonth}-${localDate}`,
      day: d.toLocaleDateString("en-IN", { weekday: "short" }),
      date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      full: d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
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

function normalizeMode(mode) {
  const m = String(mode || "").toLowerCase().trim();
  if (m === "audio" || m === "call") return "call";
  if (m === "in-person" || m === "inperson") return "inperson";
  return "video";
}

function normalizePaymentStatus(status) {
  const s = String(status || "").toLowerCase().trim();
  if (["paid", "success", "successful", "captured"].includes(s)) return "paid";
  if (["failed", "failure"].includes(s)) return "failed";
  if (["refunded"].includes(s)) return "refunded";
  return s || "pending";
}

function normalizeConsultStatus(item = {}) {
  const raw = String(item?.status || "").toLowerCase().trim();
  const paymentStatus = normalizePaymentStatus(item?.paymentStatus);

  if (raw === "live" || raw === "live_now") return "live_now";
  if (raw === "completed") return "completed";
  if (raw === "accepted") return "accepted";
  if (raw === "upcoming") return "upcoming";
  if (raw === "cancelled" || raw === "rejected" || raw === "refunded") return "cancelled";
  if (raw === "no_show") return "no_show";
  if (raw === "pending_payment") {
    return paymentStatus === "paid" ? "pending" : "pending_payment";
  }

  if (raw === "confirmed") {
  return paymentStatus === "paid" ? "pending" : "pending_payment";
}

if (raw === "pending") {
  if (paymentStatus !== "paid") return "pending_payment";

  const appointmentAt = getAppointmentAt(item);
  if (appointmentAt) {
    const startMs = new Date(appointmentAt).getTime();
    const nowMs = Date.now();
    if (startMs <= nowMs + 60 * 1000) return "live_now";
    if (startMs <= nowMs + 30 * 60 * 1000) return "upcoming";
  }

  return "pending";
}

  return raw || (paymentStatus === "paid" ? "pending" : "pending_payment");
}

function getAppointmentAt(item = {}) {
  if (item?.appointmentAt) {
    const d = new Date(item.appointmentAt);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (item?.bookedFor) {
    const d = new Date(item.bookedFor);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (item?.date && item?.slot) {
    const d = new Date(`${item.date} ${item.slot}`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return "";
}

function normalizeConsult(item = {}) {
  const mode = normalizeMode(item?.mode);
  const id = String(item?.id || item?.bookingId || item?._id || "");
  const doctorId = String(item?.doctorId || "");
  const paymentRef = String(item?.paymentRef || "");
  const date = String(item?.date || "");
  const slot = String(item?.slot || "");
  const appointmentAt = getAppointmentAt(item);

  return {
    ...item,
    id,
    bookingId: id || String(item?.bookingId || ""),
    doctorId,
    doctorName: item?.doctorName || item?.doctor || "",
    specialty: item?.specialty || "",
    mode,
    date,
    slot,
    appointmentAt,
    dateLabel:
      item?.dateLabel ||
      item?.fullDateLabel ||
      item?.bookedForLabel ||
      item?.date ||
      "",
    paymentRef,
    paymentMethod: item?.paymentMethod || "",
    paymentStatus: normalizePaymentStatus(item?.paymentStatus),
    status: normalizeConsultStatus(item),
    consultRoomId: item?.consultRoomId || "",
    callState: item?.callState || "",
    fee: Number(item?.fee || 0),
    patientName: item?.patientName || "Self",
    reason: item?.reason || item?.symptoms || "",
    patientSummary: item?.patientSummary || "",
    prescription: item?.prescription || null,
    clinicLocation: item?.clinicLocation || item?.clinicLocationSnapshot || null,
    locationUnlockedForPatient:
      typeof item?.locationUnlockedForPatient === "boolean"
        ? item.locationUnlockedForPatient
        : false,
    clinicRevealAllowed:
      typeof item?.clinicRevealAllowed === "boolean"
        ? item.clinicRevealAllowed
        : false,
    medicalRecordNames: Array.isArray(item?.medicalRecordNames)
      ? item.medicalRecordNames
      : [],
    createdAt: item?.createdAt || "",
    updatedAt: item?.updatedAt || "",
  };
}

function getIdentityKeys(item = {}) {
  const keys = [];
  const id = String(item?.id || item?.bookingId || "");
  const paymentRef = String(item?.paymentRef || "");
  const doctorId = String(item?.doctorId || "");
  const date = String(item?.date || "");
  const slot = String(item?.slot || "");
  const mode = String(item?.mode || "");

  if (id) keys.push(`id:${id}`);
  if (paymentRef) keys.push(`paymentRef:${paymentRef}`);
  if (doctorId && date && slot && mode) {
    keys.push(`slot:${doctorId}|${date}|${slot}|${mode}`);
  }
  if (date && slot && mode && String(item?.doctorName || "")) {
    keys.push(`namedSlot:${String(item.doctorName)}|${date}|${slot}|${mode}`);
  }

  return keys;
}

function mergeAppointmentsPreferServer(serverBookings = [], localBookings = []) {
  const merged = [];
  const keyToIndex = new Map();

  function attach(item, preferServer = false) {
    const normalized = normalizeConsult(item);
    const keys = getIdentityKeys(normalized);

    let foundIndex = -1;
    for (const key of keys) {
      if (keyToIndex.has(key)) {
        foundIndex = keyToIndex.get(key);
        break;
      }
    }

    if (foundIndex === -1) {
      const nextIndex = merged.length;
      merged.push(normalized);
      keys.forEach((key) => keyToIndex.set(key, nextIndex));
      return;
    }

    const existing = merged[foundIndex];
    const next = preferServer
      ? {
          ...existing,
          ...normalized,
          id: normalized.id || existing.id,
          bookingId: normalized.bookingId || existing.bookingId,
          status: normalized.status || existing.status,
          paymentStatus: normalized.paymentStatus || existing.paymentStatus,
          paymentMethod: normalized.paymentMethod || existing.paymentMethod,
          consultRoomId: normalized.consultRoomId || existing.consultRoomId,
          callState: normalized.callState || existing.callState,
          prescription: normalized.prescription || existing.prescription,
          clinicLocation: normalized.clinicLocation || existing.clinicLocation,
          dateLabel: normalized.dateLabel || existing.dateLabel,
          appointmentAt: normalized.appointmentAt || existing.appointmentAt,
          updatedAt: normalized.updatedAt || existing.updatedAt,
          createdAt: normalized.createdAt || existing.createdAt,
        }
      : {
          ...normalized,
          ...existing,
          id: existing.id || normalized.id,
          bookingId: existing.bookingId || normalized.bookingId,
          status: existing.status || normalized.status,
          paymentStatus: existing.paymentStatus || normalized.paymentStatus,
          paymentMethod: existing.paymentMethod || normalized.paymentMethod,
          consultRoomId: existing.consultRoomId || normalized.consultRoomId,
          callState: existing.callState || normalized.callState,
          prescription: existing.prescription || normalized.prescription,
          clinicLocation: existing.clinicLocation || normalized.clinicLocation,
          dateLabel: existing.dateLabel || normalized.dateLabel,
          appointmentAt: existing.appointmentAt || normalized.appointmentAt,
          updatedAt: existing.updatedAt || normalized.updatedAt,
          createdAt: existing.createdAt || normalized.createdAt,
        };

    merged[foundIndex] = next;
    getIdentityKeys(next).forEach((key) => keyToIndex.set(key, foundIndex));
  }

  (Array.isArray(localBookings) ? localBookings : []).forEach((item) => attach(item, false));
  (Array.isArray(serverBookings) ? serverBookings : []).forEach((item) => attach(item, true));

  return merged;
}

function loadRazorpayScript(src) {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
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

function getPatientStatusMeta(item = {}) {
  const status = normalizeConsultStatus(item);
  const paymentStatus = normalizePaymentStatus(item?.paymentStatus);

  if (paymentStatus !== "paid" || status === "pending_payment") {
    return {
      label: "Complete payment",
      bg: "#FFF7ED",
      border: "#FDBA74",
      accent: "#C2410C",
    };
  }

  if (status === "pending") {
    return {
      label: "Awaiting doctor",
      bg: "#FFFBEB",
      border: "#FCD34D",
      accent: "#B45309",
    };
  }

  if (status === "accepted") {
    return {
      label: "Doctor accepted",
      bg: "#E0F2FE",
      border: "#7DD3FC",
      accent: "#0369A1",
    };
  }

  if (status === "upcoming") {
    return {
      label: "Upcoming",
      bg: "#DCFCE7",
      border: "#86EFAC",
      accent: "#166534",
    };
  }

  if (status === "live_now") {
    return {
      label: "Live now",
      bg: "#DCFCE7",
      border: "#34D399",
      accent: "#065F46",
    };
  }

  if (status === "completed") {
    return {
      label: "Completed",
      bg: "#ECFDF5",
      border: "#A7F3D0",
      accent: "#065F46",
    };
  }

  if (status === "cancelled") {
    return {
      label: "Cancelled",
      bg: "#FEF2F2",
      border: "#FECACA",
      accent: "#B91C1C",
    };
  }

  return {
    label: status || "Pending",
    bg: "#F8FAFC",
    border: "#E2E8F0",
    accent: "#475569",
  };
}

function DoctorCard({ doctor, mode, onBook }) {
  const fee =
    mode === "video"
      ? doctor.feeVideo
      : mode === "call"
        ? doctor.feeCall
        : doctor.feeInPerson;

  const priceLabel =
    mode === "inperson"
      ? doctor.customerPriceLabelInPerson || `In-Person Visit Rs ${fee}`
      : mode === "call"
        ? doctor.customerPriceLabelCall || `Consultation Rs ${fee}`
        : doctor.customerPriceLabelVideo || `Consultation Rs ${fee}`;

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
          <div
            style={{
              fontFamily: "'Sora',sans-serif",
              fontWeight: 900,
              color: "#0B1F16",
              fontSize: 14.5,
            }}
          >
            {doctor.name}
          </div>
          <div style={{ fontSize: 11.5, color: "#64748B", fontWeight: 700 }}>
            {doctor.specialty}
          </div>
          <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontSize: 10.5,
                color: "#0F766E",
                fontWeight: 800,
              }}
            >
              <Star style={{ width: 11, height: 11 }} /> {doctor.rating}
            </span>
            <span style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>
              {doctor.exp} yrs exp
            </span>
            <span style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>
              {(doctor.languages || []).join(", ")}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: "#64748B",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <MapPin style={{ width: 12, height: 12 }} /> {doctor.locality || doctor.clinic}
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(doctor.tags || []).map((tag) => (
          <span
            key={`${doctor.id}-${tag}`}
            style={{
              padding: "4px 9px",
              borderRadius: 999,
              background: "#F0FDF4",
              border: "1px solid #D1FAE5",
              color: "#065F46",
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <IndianRupee style={{ width: 14, height: 14, color: DEEP }} />
          <span
            style={{
              fontFamily: "'Sora',sans-serif",
              fontWeight: 900,
              color: DEEP,
              fontSize: 15,
            }}
          >
            {fee}
          </span>
          <span style={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>
            {priceLabel}
          </span>
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
  const [patientSummary, setPatientSummary] = useState("");
  const [medicalRecords, setMedicalRecords] = useState([]);
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

  const loadMyConsults = useCallback(async () => {
  const localBookingsRaw = readStoredConsultBookings();
  const localBookings = (Array.isArray(localBookingsRaw) ? localBookingsRaw : []).map(normalizeConsult);
  const token = localStorage.getItem("token");

  setLoadingAppts(true);
  setError("");

  try {
    let serverBookings = [];

    if (token) {
      try {
        const r = await axios.get(`${API}/api/consults/my`, { headers: userHeaders() });
        serverBookings = (Array.isArray(r?.data?.consults) ? r.data.consults : []).map(normalizeConsult);
      } catch (_) {
        serverBookings = [];
      }
    }

    let publicSyncedBookings = [];
    if (localBookings.length) {
      try {
        const syncRes = await axios.post(
          `${API}/api/consults/lookup/batch`,
          {
            items: localBookings.map((item) => ({
              bookingId: item.id || item.bookingId,
              paymentRef: item.paymentRef || "",
            })),
          },
          token ? { headers: userHeaders() } : undefined
        );

        publicSyncedBookings = (Array.isArray(syncRes?.data?.consults) ? syncRes.data.consults : []).map(normalizeConsult);
      } catch (_) {
        publicSyncedBookings = [];
      }
    }

    const mergedServer = mergeAppointmentsPreferServer(serverBookings, publicSyncedBookings);
    const merged = mergeAppointmentsPreferServer(mergedServer, localBookings);

    merged.forEach((item) => {
      if (item?.id || item?.bookingId) {
        upsertStoredConsultBooking({
          ...item,
          id: item.id || item.bookingId,
          bookingId: item.bookingId || item.id,
        });
      }
    });

    setAppointments(sortConsultBookings(merged));
  } catch (_) {
    setAppointments(sortConsultBookings(localBookings));
  } finally {
    setLoadingAppts(false);
  }
}, []);

  useEffect(() => {
    loadMyConsults();
  }, [loadMyConsults]);

  useEffect(() => {
    const onFocus = () => loadMyConsults();
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadMyConsults();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadMyConsults]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadMyConsults();
    }, 10000);

    return () => clearInterval(timer);
  }, [loadMyConsults]);

  const loadSlotsForDoctor = useCallback(
    async (doctorId, date) => {
      if (!doctorId || !date) return;
      setSlotsLoading(true);
      setSlotOptions([]);
      setBookingSlot("");
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
        if (!onlyAvailable.length) {
          setError("No live slots are available for the selected doctor/date.");
        }
      } catch (err) {
        setSlotOptions([]);
        setBookingSlot("");
        setError(err?.response?.data?.error || "Unable to load slots for this doctor right now.");
      } finally {
        setSlotsLoading(false);
      }
    },
    [mode]
  );

  useEffect(() => {
    if (bookingDoctor?.id && bookingDate) {
      loadSlotsForDoctor(bookingDoctor.id, bookingDate);
    }
  }, [bookingDoctor?.id, bookingDate, loadSlotsForDoctor]);

  const consultCards = useMemo(() => {
    return sortConsultBookings(
      appointments
        .map(normalizeConsult)
        .filter((a) =>
          [
            "pending",
            "pending_payment",
            "accepted",
            "upcoming",
            "live_now",
            "completed",
            "cancelled",
          ].includes(a.status)
        )
    ).slice(0, 12);
  }, [appointments]);

  async function bookNow() {
    if (!bookingDoctor || !bookingDate || !bookingSlot || !paymentMethod) return;

    setBookingLoading(true);
    setError("");

    try {
      const createRes = await axios.post(
        `${API}/api/consults/create`,
        (() => {
          const payload = new FormData();
          payload.append("doctorId", bookingDoctor.id);
          payload.append("mode", mapModeForBackend(mode));
          payload.append("date", bookingDate);
          payload.append("slot", bookingSlot);
          payload.append("patientType", patientType);
          payload.append(
            "patientName",
            patientName.trim() || (patientType === "self" ? "Self" : "Family Member")
          );
          payload.append("reason", reason.trim() || "General consultation");
          payload.append("symptoms", reason.trim() || "General consultation");
          payload.append("patientSummary", patientSummary.trim());
          payload.append("paymentMethod", paymentMethod);
          medicalRecords.forEach((file) => payload.append("medicalRecords", file));
          return payload;
        })(),
        {
          headers: {
            ...userHeaders(),
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const consult = createRes?.data?.consult || createRes?.data?.appointment;
      const paymentRef = createRes?.data?.paymentIntent?.paymentRef || consult?.paymentRef || "";

      if (!consult?.id) throw new Error("Consult hold failed");

      const selectedDateOption = dateList.find((d) => d.iso === bookingDate) || null;
      const bookingMode = mapModeForBackend(mode);

      const rzpLoaded = await loadRazorpayScript("https://checkout.razorpay.com/v1/checkout.js");
      if (!rzpLoaded) throw new Error("Razorpay SDK failed to load. Try again.");

      const orderBackend = await axios.post(`${API}/api/payments/razorpay/order`, {
        amount: Number(createRes?.data?.paymentIntent?.amount || consult?.fee || 0),
        currency: "INR",
        receipt: `consult_${consult.id}_${Date.now()}`,
      });

      await new Promise((resolve, reject) => {
        const options = {
          key: process.env.REACT_APP_RAZORPAY_KEY_ID || "rzp_test_GAXFOxUCCrxVvr",
          amount: orderBackend.data.amount,
          currency: orderBackend.data.currency || "INR",
          name: "GoDavaii Doctor Consult",
          description: `${bookingDoctor.name} ${
            mode === "inperson" ? "In-Person" : mode === "call" ? "Audio" : "Video"
          } Consultation`,
          order_id: orderBackend.data.orderId || orderBackend.data.id,
          handler: async (response) => {
            try {
              const verifyRes = await axios.post(`${API}/api/payments/verify`, {
                consultId: consult.id,
                paymentRef,
                paymentMethod,
                transactionId: response?.razorpay_payment_id || `TXN-${Date.now()}`,
                razorpayOrderId: response?.razorpay_order_id || "",
                razorpaySignature: response?.razorpay_signature || "",
              });

              const verifiedConsult = normalizeConsult(
                verifyRes?.data?.consult || {
                  ...consult,
                  status: verifyRes?.data?.status || "confirmed",
                  paymentStatus: verifyRes?.data?.paymentStatus || "paid",
                  paymentRef:
                    verifyRes?.data?.paymentRef || paymentRef || consult?.paymentRef || "",
                  consultRoomId:
                    verifyRes?.data?.consultRoomId || consult?.consultRoomId || "",
                }
              );

              upsertStoredConsultBooking({
                id: verifiedConsult?.id || consult.id,
                bookingId: verifiedConsult?.id || consult.id,
                paymentRef:
                  verifiedConsult?.paymentRef || paymentRef || consult?.paymentRef || "",
                doctorId: bookingDoctor.id,
                doctorName: bookingDoctor.name,
                specialty: bookingDoctor.specialty,
                mode: bookingMode,
                date: bookingDate,
                slot: bookingSlot,
                dateLabel: selectedDateOption?.full || bookingDate,
                patientName:
                  patientName.trim() || (patientType === "self" ? "Self" : "Family Member"),
                reason: reason.trim() || "General consultation",
                patientSummary: patientSummary.trim(),
                paymentMethod,
                paymentStatus: "paid",
                status: verifiedConsult?.status || "pending",
                fee: Number(
                  verifiedConsult?.fee ||
                    (bookingMode === "video"
                      ? bookingDoctor.feeVideo
                      : bookingMode === "call"
                        ? bookingDoctor.feeCall
                        : bookingDoctor.feeInPerson) ||
                    0
                ),
                createdAt: verifiedConsult?.createdAt || new Date().toISOString(),
                updatedAt: verifiedConsult?.updatedAt || new Date().toISOString(),
                clinicLocation: verifiedConsult?.clinicLocation || null,
                prescription: verifiedConsult?.prescription || null,
                consultRoomId: verifiedConsult?.consultRoomId || consult?.consultRoomId || "",
                medicalRecordNames: medicalRecords.map((file) => file.name),
              });

              resolve();
            } catch (verifyErr) {
              reject(verifyErr);
            }
          },
          prefill: {
            name: patientType === "self" ? "Self" : patientName.trim() || "Consult Patient",
          },
          theme: { color: DEEP },
          modal: {
            ondismiss: () => reject(new Error("Payment cancelled.")),
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      });

      setBookingDoctor(null);
      setReason("");
      setPatientSummary("");
      setPatientName("");
      setPatientType("self");
      setPaymentMethod("");
      setBookingSlot("");
      setSlotOptions([]);
      setMedicalRecords([]);
      await loadMyConsults();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Booking failed.");
    } finally {
      setBookingLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "0 auto",
        minHeight: "100vh",
        paddingBottom: 120,
        background: "linear-gradient(180deg,#ECFDF5 0%,#E6F4FF 45%,#F8FAFC 100%)",
      }}
    >
      <div style={{ padding: "14px 14px 8px" }}>
        <Glass
          style={{
            padding: 14,
            background: "linear-gradient(135deg,#0B4D35,#0A623E)",
            color: "#fff",
            border: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 15,
                background: "rgba(0,217,126,0.18)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Stethoscope style={{ width: 20, height: 20, color: ACC }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 900 }}>
                Doctor Consult
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.72)",
                }}
              >
                Book video, audio, or in-person appointment with payment lock.
              </div>
            </div>
          </div>
        </Glass>

        {error && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#B91C1C", fontWeight: 800 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search
              style={{ width: 14, height: 14, color: "#94A3B8", position: "absolute", top: 12, left: 10 }}
            />
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
            <Filter
              style={{ width: 13, height: 13, color: "#94A3B8", position: "absolute", top: 12, left: 8 }}
            />
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
          <button
            onClick={() => setMode("video")}
            style={{
              flex: 1,
              height: 34,
              borderRadius: 999,
              border: mode === "video" ? "none" : "1px solid #D1D5DB",
              background: mode === "video" ? `linear-gradient(135deg,${DEEP},${MID})` : "#fff",
              color: mode === "video" ? "#fff" : "#1F2937",
              fontWeight: 800,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}
          >
            <Video style={{ width: 13, height: 13 }} /> Video
          </button>

          <button
            onClick={() => setMode("inperson")}
            style={{
              flex: 1,
              height: 34,
              borderRadius: 999,
              border: mode === "inperson" ? "none" : "1px solid #D1D5DB",
              background: mode === "inperson" ? `linear-gradient(135deg,${DEEP},${MID})` : "#fff",
              color: mode === "inperson" ? "#fff" : "#1F2937",
              fontWeight: 800,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}
          >
            <MapPin style={{ width: 13, height: 13 }} /> In-Person
          </button>

          <button
            onClick={() => setMode("call")}
            style={{
              flex: 1,
              height: 34,
              borderRadius: 999,
              border: mode === "call" ? "none" : "1px solid #D1D5DB",
              background: mode === "call" ? `linear-gradient(135deg,${DEEP},${MID})` : "#fff",
              color: mode === "call" ? "#fff" : "#1F2937",
              fontWeight: 800,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}
          >
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontFamily: "'Sora',sans-serif",
                fontSize: 14,
                fontWeight: 900,
                color: "#0F172A",
              }}
            >
              My Appointments
            </div>
            <button
              onClick={loadMyConsults}
              style={{
                border: "none",
                background: "none",
                fontSize: 11,
                fontWeight: 800,
                color: DEEP,
                cursor: "pointer",
              }}
            >
              Refresh
            </button>
          </div>

          {loadingAppts ? (
            <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700, padding: "8px 0" }}>
              Loading appointments...
            </div>
          ) : consultCards.length === 0 ? (
            <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700, padding: "8px 0" }}>
              No appointment yet. Select a doctor and book your first slot.
            </div>
          ) : (
            consultCards.map((rawItem) => {
              const a = normalizeConsult(rawItem);
              const appointmentMs = a.appointmentAt ? new Date(a.appointmentAt).getTime() : 0;
const nowMs = Date.now();
const isLive = a.callState === "live" || a.status === "live_now";
const hasPrescription = !!a?.prescription?.fileUrl;
const isAwaitingDoctor = a.paymentStatus === "paid" && a.status === "pending";

const withinJoinWindow =
  appointmentMs > 0 && nowMs >= appointmentMs - 30 * 60 * 1000;

const canJoin =
  a.paymentStatus === "paid" &&
  a.mode !== "inperson" &&
  ["accepted", "upcoming", "live_now"].includes(a.status);

              const modeIcon = a.mode === "video" ? Video : a.mode === "call" ? Phone : MapPin;
              const modeLabel = a.mode === "video" ? "Video" : a.mode === "call" ? "Audio" : "In-Person";
              const modeColor = a.mode === "video" ? "#7C3AED" : a.mode === "call" ? "#0EA5E9" : "#D97706";
              const modeBg = a.mode === "video" ? "#F5F3FF" : a.mode === "call" ? "#F0F9FF" : "#FFFBEB";
              const modeBorder = a.mode === "video" ? "#DDD6FE" : a.mode === "call" ? "#BAE6FD" : "#FDE68A";
              const ModeIcon = modeIcon;
              const roomId = a.consultRoomId || `consult_${String(a.id || a.bookingId || "").slice(-8)}`;

              const meta = getPatientStatusMeta(a);

              return (
                <div
                  key={a.id || a.bookingId}
                  style={{
                    borderRadius: 18,
                    overflow: "hidden",
                    marginBottom: 10,
                    border: isLive ? "1.5px solid #10B981" : "1px solid #E2E8F0",
                    background: isLive ? "linear-gradient(135deg,#ECFDF5,#F0FDF4)" : "#fff",
                    boxShadow: isLive
                      ? "0 4px 20px rgba(16,185,129,0.12)"
                      : "0 2px 8px rgba(0,0,0,0.03)",
                  }}
                >
                  {isLive && (
                    <div
                      style={{
                        height: 3,
                        background: "linear-gradient(90deg,#10B981,#34D399,#10B981)",
                        backgroundSize: "200% 100%",
                        animation: "liveBar 1.5s linear infinite",
                      }}
                    />
                  )}

                  <div style={{ padding: "12px 14px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 14,
                            background: "linear-gradient(135deg,#E8F5EF,#D1FAE5)",
                            display: "grid",
                            placeItems: "center",
                            fontSize: 15,
                            fontWeight: 900,
                            color: DEEP,
                            flexShrink: 0,
                          }}
                        >
                          DR
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 900, color: "#0B1F16" }}>
                            {a.doctorName}
                          </div>
                          <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>
                            {a.specialty}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        {isLive && (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "#10B981",
                              animation: "pulse 1.5s ease-in-out infinite",
                            }}
                          />
                        )}
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            color: isLive ? "#065F46" : modeColor,
                            background: isLive ? "#D1FAE5" : modeBg,
                            border: `1px solid ${isLive ? "#A7F3D0" : modeBorder}`,
                            padding: "4px 10px",
                            borderRadius: 999,
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <ModeIcon style={{ width: 11, height: 11 }} /> {isLive ? "LIVE" : modeLabel}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          color: "#475569",
                          fontWeight: 800,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <CalendarDays style={{ width: 12, height: 12 }} /> {a.dateLabel}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          color: "#475569",
                          fontWeight: 800,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Clock3 style={{ width: 12, height: 12 }} /> {a.slot}
                      </span>
                      <span style={{ fontSize: 10.5, color: "#475569", fontWeight: 800 }}>
                        Patient: {a.patientName}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          color: "#475569",
                          fontWeight: 800,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Wallet style={{ width: 12, height: 12 }} /> {a.paymentMethod || "-"}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 900,
                          color: meta?.accent || "#065F46",
                          background: meta?.bg || "#ECFDF5",
                          border: `1px solid ${meta?.border || "#A7F3D0"}`,
                          padding: "4px 8px",
                          borderRadius: 999,
                        }}
                      >
                        {meta?.label || a.status}
                      </span>
                    </div>

                    {a.mode === "inperson" && (
                      <div
                        style={{
                          fontSize: 10.8,
                          fontWeight: 800,
                          color: "#0F172A",
                          marginBottom: 8,
                          background: "#F8FAFC",
                          borderRadius: 10,
                          padding: "8px 10px",
                          border: "1px solid #E2E8F0",
                        }}
                      >
                        <MapPin
                          style={{
                            width: 12,
                            height: 12,
                            display: "inline",
                            verticalAlign: "-2px",
                            marginRight: 4,
                          }}
                        />
                        {a?.clinicLocation?.locality || "Locality hidden"}
                        {a?.clinicLocation?.exactUnlocked
                          ? ` · ${a?.clinicLocation?.fullAddress || ""}`
                          : " · Address unlocks after payment"}
                        {a?.clinicLocation?.exactUnlocked && a?.clinicLocation?.coordinates?.lat ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${a.clinicLocation.coordinates.lat},${a.clinicLocation.coordinates.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              marginLeft: 6,
                              color: DEEP,
                              fontWeight: 900,
                              fontSize: 10.5,
                              textDecoration: "none",
                            }}
                          >
                            <ExternalLink
                              style={{
                                width: 11,
                                height: 11,
                                display: "inline",
                                verticalAlign: "-1.5px",
                              }}
                            />{" "}
                            Maps
                          </a>
                        ) : null}
                      </div>
                    )}

                    {hasPrescription && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          background: "#F0FDF4",
                          border: "1px solid #BBF7D0",
                          borderRadius: 12,
                          padding: "8px 12px",
                          marginBottom: 8,
                        }}
                      >
                        <FileText style={{ width: 16, height: 16, color: "#15803D", flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 900, color: "#166534" }}>
                            Prescription Available
                          </div>
                          <div style={{ fontSize: 10, color: "#4ADE80", fontWeight: 700 }}>
                            Uploaded by {a.doctorName}
                          </div>
                        </div>
                        <a
                          href={a.prescription.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 10.5,
                            fontWeight: 900,
                            color: "#fff",
                            background: "linear-gradient(135deg,#15803D,#22C55E)",
                            padding: "6px 12px",
                            borderRadius: 999,
                            textDecoration: "none",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <FileText style={{ width: 11, height: 11 }} /> View
                        </a>
                      </div>
                    )}

                    {isAwaitingDoctor && (
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#92400E",
                          background: "#FFFBEB",
                          borderRadius: 10,
                          padding: "6px 10px",
                          border: "1px solid #FDE68A",
                          marginBottom: 8,
                        }}
                      >
                        Payment received. Join appears here after the doctor accepts your booking.
                      </div>
                    )}

                    {canJoin && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            window.open(`https://meet.jit.si/${roomId}`, "_blank");
                          }}
                          style={{
                            flex: 1,
                            height: 40,
                            border: "none",
                            borderRadius: 14,
                            background: isLive
                              ? "linear-gradient(135deg,#059669,#10B981)"
                              : `linear-gradient(135deg,${DEEP},${MID})`,
                            color: "#fff",
                            fontFamily: "'Sora',sans-serif",
                            fontWeight: 900,
                            fontSize: 12,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            boxShadow: isLive
                              ? "0 8px 24px rgba(16,185,129,0.3)"
                              : "0 6px 18px rgba(12,90,62,0.2)",
                          }}
                        >
                          {a.mode === "video" ? (
                            <Video style={{ width: 14, height: 14 }} />
                          ) : (
                            <PhoneCall style={{ width: 14, height: 14 }} />
                          )}
                          {isLive ? "Join Now — LIVE" : withinJoinWindow ? "Join Now" : "Join Room"}
                        </motion.button>

                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            window.open(
                              `https://meet.jit.si/${roomId}#config.startWithVideoMuted=true&config.startWithAudioMuted=true`,
                              "_blank"
                            );
                          }}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 14,
                            border: "1px solid #E2E8F0",
                            background: "#fff",
                            cursor: "pointer",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <MessageCircle style={{ width: 16, height: 16, color: DEEP }} />
                        </motion.button>
                      </div>
                    )}

                    {a.status === "completed" && !hasPrescription && (
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#92400E",
                          background: "#FFFBEB",
                          borderRadius: 10,
                          padding: "6px 10px",
                          border: "1px solid #FDE68A",
                        }}
                      >
                        ⏳ Consultation completed — prescription pending from doctor
                      </div>
                    )}

                    {a.status === "completed" && hasPrescription && (
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#065F46",
                          background: "#ECFDF5",
                          borderRadius: 10,
                          padding: "6px 10px",
                          border: "1px solid #A7F3D0",
                        }}
                      >
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
          <Glass style={{ padding: 12, fontSize: 12, fontWeight: 700, color: "#64748B" }}>
            Loading doctors...
          </Glass>
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
                setPatientSummary("");
                setMedicalRecords([]);
              }}
            />
          ))
        )}
      </div>

      <AnimatePresence>
        {bookingDoctor && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBookingDoctor(null)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(2,6,23,0.5)",
                zIndex: 1300,
              }}
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1301,
                maxWidth: 520,
                margin: "0 auto",
                background: "#fff",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: "14px 14px calc(14px + env(safe-area-inset-bottom,0px))",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontFamily: "'Sora',sans-serif",
                    fontSize: 15,
                    fontWeight: 900,
                    color: "#0F172A",
                  }}
                >
                  Book Appointment
                </div>
                <button
                  onClick={() => setBookingDoctor(null)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    border: "1px solid #E2E8F0",
                    background: "#fff",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>

              <div style={{ fontSize: 13, fontWeight: 900, color: "#0B1F16" }}>
                {bookingDoctor.name}
              </div>
              <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, marginBottom: 10 }}>
                {bookingDoctor.specialty}
              </div>

              {mode === "inperson" ? (
                <div
                  style={{
                    marginBottom: 8,
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#92400E",
                    background: "#FFFBEB",
                    border: "1px solid #FCD34D",
                    borderRadius: 10,
                    padding: "6px 8px",
                  }}
                >
                  In-person bookings are prepaid and slot-confirmed after successful payment.
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 7, overflowX: "auto", scrollbarWidth: "none", marginBottom: 10 }}>
                {dateList.map((d) => (
                  <button
                    key={d.iso}
                    onClick={() => setBookingDate(d.iso)}
                    style={{
                      flexShrink: 0,
                      minWidth: 68,
                      borderRadius: 12,
                      border: bookingDate === d.iso ? "none" : "1px solid #D1D5DB",
                      background: bookingDate === d.iso ? DEEP : "#fff",
                      color: bookingDate === d.iso ? "#fff" : "#1F2937",
                      cursor: "pointer",
                      padding: "6px 8px",
                    }}
                  >
                    <div style={{ fontSize: 10.5, fontWeight: 900 }}>{d.day}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.9 }}>{d.date}</div>
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7, marginBottom: 10 }}>
                {slotsLoading ? (
                  <div style={{ gridColumn: "1 / span 4", fontSize: 11, fontWeight: 700, color: "#64748B" }}>
                    Loading slots...
                  </div>
                ) : slotOptions.length === 0 ? (
                  <div style={{ gridColumn: "1 / span 4", fontSize: 11, fontWeight: 700, color: "#B91C1C" }}>
                    No available slots for selected date.
                  </div>
                ) : (
                  slotOptions.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setBookingSlot(slot)}
                      style={{
                        height: 32,
                        borderRadius: 9,
                        border: bookingSlot === slot ? "none" : "1px solid #D1D5DB",
                        background: bookingSlot === slot ? "#DCFCE7" : "#fff",
                        color: bookingSlot === slot ? "#166534" : "#0F172A",
                        fontSize: 10.5,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
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
                  <button
                    key={p.key}
                    onClick={() => setPatientType(p.key)}
                    style={{
                      flex: 1,
                      height: 32,
                      borderRadius: 999,
                      border: patientType === p.key ? "none" : "1px solid #D1D5DB",
                      background: patientType === p.key ? DEEP : "#fff",
                      color: patientType === p.key ? "#fff" : "#1F2937",
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {patientType !== "self" && (
                <input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder={patientType === "family" ? "Family member name" : "Name for new profile"}
                  style={{
                    width: "100%",
                    height: 36,
                    borderRadius: 10,
                    border: "1.5px solid #D1D5DB",
                    padding: "0 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    marginBottom: 8,
                    outline: "none",
                  }}
                />
              )}

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Reason/symptoms (optional)"
                style={{
                  width: "100%",
                  borderRadius: 10,
                  border: "1.5px solid #D1D5DB",
                  padding: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  resize: "none",
                  marginBottom: 8,
                  outline: "none",
                }}
              />

              <textarea
                value={patientSummary}
                onChange={(e) => setPatientSummary(e.target.value)}
                rows={2}
                placeholder="Previous diagnosis / ongoing treatment / anything doctor should know (optional)"
                style={{
                  width: "100%",
                  borderRadius: 10,
                  border: "1.5px solid #D1D5DB",
                  padding: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  resize: "none",
                  marginBottom: 8,
                  outline: "none",
                }}
              />

              <div
                style={{
                  marginBottom: 10,
                  border: "1px solid #D1D5DB",
                  borderRadius: 12,
                  padding: 10,
                  background: "#F8FAFC",
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 900, color: "#0F172A", marginBottom: 6 }}>
                  Upload prescription / lab report / previous doctor record
                </div>
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.pdf,.webp,.heic,.heif"
                  onChange={(e) => setMedicalRecords(Array.from(e.target.files || []))}
                  style={{ width: "100%", fontSize: 11.5, fontWeight: 700 }}
                />
                <div style={{ marginTop: 6, fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>
                  These records will be available to the doctor in consult context.
                </div>
                {medicalRecords.length > 0 ? (
                  <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {medicalRecords.map((file) => (
                      <span
                        key={`${file.name}-${file.size}`}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: "#ECFDF5",
                          border: "1px solid #A7F3D0",
                          fontSize: 10.5,
                          fontWeight: 800,
                          color: "#065F46",
                        }}
                      >
                        {file.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11.5, fontWeight: 900, color: "#0F172A", marginBottom: 6 }}>
                  Payment Method
                </div>
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
                  background:
                    paymentMethod && bookingSlot && !bookingLoading
                      ? `linear-gradient(135deg,${DEEP},${MID})`
                      : "#CBD5E1",
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
                <CheckCircle2 style={{ width: 15, height: 15 }} />{" "}
                {bookingLoading ? "Processing..." : "Pay and Confirm Booking"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes pulse {
          0%,100% { opacity:1; transform:scale(1) }
          50% { opacity:.5; transform:scale(1.3) }
        }
        @keyframes liveBar {
          0% { background-position:0% 0 }
          100% { background-position:200% 0 }
        }
      `}</style>
    </div>
  );
}
