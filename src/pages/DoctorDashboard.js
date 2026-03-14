import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";

import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  FileText,
  MapPin,
  Phone,
  Video,
  ShieldCheck,
  UserRound,
  CalendarDays,
  Activity,
  Timer,
  Pill,
  Sparkles,
  AlertCircle,
  RefreshCcw,
  Settings2,
  PencilLine,
  ArrowRight,
  XCircle,
  CheckCheck,
  PhoneCall,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  PhoneOff,
  Building2,
  BadgeCheck,
  Wallet,
  ClipboardPlus,
} from "lucide-react";

dayjs.extend(relativeTime);

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const LAST_PREVIEW_STORAGE_KEY = "doctorDashboardLastPrescriptionId";

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

const BOOKING_STATES = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  UPCOMING: "upcoming",
  LIVE_NOW: "live_now",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
};

const NOTIFICATION_TYPES = {
  NEW_BOOKING: "new_booking",
  REMINDER_30: "reminder_30",
  REMINDER_10: "reminder_10",
  REMINDER_NOW: "reminder_now",
  CANCELLED: "cancelled",
  RESCHEDULED: "rescheduled",
  NEEDS_ACTION: "needs_action",
};

const CONSULT_MODES = {
  AUDIO: "audio",
  VIDEO: "video",
  INPERSON: "inperson",
};

function money(v) {
  return `₹${Number(v || 0).toLocaleString("en-IN")}`;
}

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function initials(name = "") {
  return name
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatSlot(dt) {
  return dayjs(dt).format("DD MMM • hh:mm A");
}

function humanDiff(dt) {
  return dayjs(dt).fromNow();
}

function countdownLabel(dt) {
  const now = dayjs();
  const target = dayjs(dt);
  const mins = target.diff(now, "minute");
  if (mins <= 0) return "Live now";
  if (mins < 60) return `Starts in ${mins} min`;
  const hrs = target.diff(now, "hour");
  return `Starts in ${hrs} hr`;
}

function getBandFromFee(fee) {
  const value = Number(fee || 0);
  if (value <= 500) return { code: "0_500", label: "₹0–₹500", fee: 19 };
  if (value <= 1000) return { code: "501_1000", label: "₹501–₹1000", fee: 39 };
  if (value <= 1500) return { code: "1001_1500", label: "₹1001–₹1500", fee: 59 };
  if (value <= 2000) return { code: "1501_2000", label: "₹1501–₹2000", fee: 79 };
  return { code: "2001_plus", label: "₹2001+", fee: null };
}

function getStatusTone(status) {
  switch (status) {
    case BOOKING_STATES.PENDING:
      return "bg-amber-100 text-amber-800 border-amber-200";
    case BOOKING_STATES.ACCEPTED:
      return "bg-sky-100 text-sky-800 border-sky-200";
    case BOOKING_STATES.UPCOMING:
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case BOOKING_STATES.LIVE_NOW:
      return "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200";
    case BOOKING_STATES.COMPLETED:
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case BOOKING_STATES.CANCELLED:
      return "bg-rose-100 text-rose-800 border-rose-200";
    case BOOKING_STATES.NO_SHOW:
      return "bg-slate-200 text-slate-700 border-slate-300";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function getModeTone(mode) {
  if (mode === CONSULT_MODES.VIDEO) return "bg-indigo-100 text-indigo-700 border-indigo-200";
  if (mode === CONSULT_MODES.AUDIO) return "bg-sky-100 text-sky-700 border-sky-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

/* -------------------------------------------------------------------------- */
/*                                  API HELPERS                               */
/* -------------------------------------------------------------------------- */

function createEmptyDoctor() {
  return {
    _id: "",
    fullName: "",
    specialty: "",
    qualification: "",
    avatar: "",
    phone: "",
    email: "",
    city: "",
    area: "",
    yearsExperience: 0,
    profileStatus: "Pending",
    online: false,
    platformBand: getBandFromFee(0),
    payoutAccountMasked: "",
    fees: {
      audio: 0,
      video: 0,
      inperson: 0,
    },
    modes: {
      audio: false,
      video: false,
      inperson: false,
    },
    clinic: {
      verified: false,
      name: "",
      addressLine1: "",
      locality: "",
      city: "",
      pin: "",
      mapLabel: "",
      coordinates: { lat: null, lng: null },
      consultationDays: [],
      startTime: "09:00",
      endTime: "13:00",
      slotDuration: 0,
      arrivalWindow: 0,
      maxPatientsPerDay: 0,
    },
  };
}

function getDoctorToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("doctorToken") || "";
}

function getDoctorAuthConfig() {
  const token = getDoctorToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

function createSettingsDraft(doctor = createEmptyDoctor()) {
  const clinic = doctor?.clinic || {};
  const fees = doctor?.fees || {};
  const modes = doctor?.modes || {};
  return {
    online: !!doctor?.online,
    audioEnabled: !!modes.audio,
    videoEnabled: !!modes.video,
    inpersonEnabled: !!modes.inperson,
    audioFee: Number(fees.audio || 0),
    videoFee: Number(fees.video || 0),
    inpersonFee: Number(fees.inperson || 0),
    consultationDays: Array.isArray(clinic.consultationDays) ? clinic.consultationDays : [],
    startTime: clinic.startTime || "09:00",
    endTime: clinic.endTime || "13:00",
    slotDuration: Number(clinic.slotDuration || 20),
    arrivalWindow: Number(clinic.arrivalWindow || 20),
    maxPatientsPerDay: Number(clinic.maxPatientsPerDay || 24),
  };
}

function createClinicChangeDraft(doctor = createEmptyDoctor(), request = null) {
  const source = request?.requestedClinic || {};
  const clinic = doctor?.clinic || {};
  return {
    clinicName: source.clinicName || clinic.name || "",
    addressLine1: source.addressLine1 || clinic.addressLine1 || "",
    locality: source.locality || clinic.locality || "",
    city: source.city || clinic.city || "",
    pin: source.pin || clinic.pin || "",
    mapLabel: source.mapLabel || clinic.mapLabel || "",
  };
}

function normalizePrescriptionSummary(row = {}) {
  return {
    _id: row._id,
    patientName: row.patientName || "Patient",
    createdAt: row.createdAt || null,
    diagnosis: row.diagnosis || "",
    meds: Number(row.meds || 0),
    sentToPatient: !!row.sentToPatient,
  };
}

function normalizeCartPreview(cartDraft = null) {
  if (!cartDraft || !Array.isArray(cartDraft.items)) return [];
  return cartDraft.items.map((item, index) => ({
    id: String(item?._id || `item_${index}`),
    cartItemId: String(item?._id || ""),
    prescribed: item?.prescribedMedicine || "",
    salt: item?.salt || "",
    dosage: item?.dosage || "",
    frequency: item?.frequency || "",
    duration: item?.duration || "",
    howToTake: item?.howToTake || "",
    matchedBrand: {
      name: item?.matchedBrand?.name || "Prescribed medicine",
      price: Number(item?.matchedBrand?.price || 0),
      qty: Number(item?.matchedBrand?.qty || 0),
    },
    generic: {
      name: item?.generic?.name || "No generic mapped yet",
      price: Number(item?.generic?.price || 0),
      qty: Number(item?.generic?.qty || 0),
      savings: Number(item?.savings || 0),
      available: !!item?.genericAvailable,
    },
    sensitive: !!item?.sensitive,
    requiresReview: !!item?.requiresReview,
    switchedToGeneric: !!item?.switchedToGeneric,
  }));
}

/* -------------------------------------------------------------------------- */
/*                                    UI                                      */
/* -------------------------------------------------------------------------- */

function SectionCard({ title, icon: Icon, right, children, className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cx(
        "rounded-[26px] border border-emerald-100/80 bg-white/90 shadow-[0_8px_30px_rgba(16,24,40,0.06)] backdrop-blur",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="h-5 w-5 text-emerald-700" /> : null}
          <h3 className="text-[18px] font-extrabold tracking-tight text-slate-900">{title}</h3>
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, tone = "emerald" }) {
  const toneMap = {
    emerald: "from-emerald-500/10 to-emerald-100/60 text-emerald-700",
    indigo: "from-indigo-500/10 to-indigo-100/60 text-indigo-700",
    amber: "from-amber-500/10 to-amber-100/60 text-amber-700",
    rose: "from-rose-500/10 to-rose-100/60 text-rose-700",
  };

  return (
    <div className="rounded-[22px] border border-white/70 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
          <div className="mt-2 text-[28px] font-black leading-none text-slate-900">{value}</div>
          {sub ? <div className="mt-2 text-sm text-slate-600">{sub}</div> : null}
        </div>
        <div className={cx("rounded-2xl bg-gradient-to-br p-3", toneMap[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ModeBadge({ mode }) {
  const label = mode === CONSULT_MODES.VIDEO ? "Video" : mode === CONSULT_MODES.AUDIO ? "Audio" : "In-person";
  return <Badge className={cx("border font-bold", getModeTone(mode))}>{label}</Badge>;
}

function StatusBadge({ status }) {
  const labelMap = {
    pending: "Pending",
    accepted: "Accepted",
    upcoming: "Upcoming",
    live_now: "Live Now",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "No Show",
  };
  return <Badge className={cx("border font-bold", getStatusTone(status))}>{labelMap[status] || status}</Badge>;
}

function NotificationBadge({ count }) {
  if (!count) return null;
  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-600 px-2 text-xs font-black text-white">
      {count}
    </span>
  );
}

function TextArea({ value, onChange, placeholder, rows = 4, className = "" }) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={cx(
        "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100",
        className
      )}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                              MAIN COMPONENT                                */
/* -------------------------------------------------------------------------- */

export default function DoctorDashboard() {
  const [doctor, setDoctor] = useState(createEmptyDoctor());
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [upcomingConsults, setUpcomingConsults] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [completedPrescriptions, setCompletedPrescriptions] = useState([]);
  const [settingsDraft, setSettingsDraft] = useState(createSettingsDraft());

  const [clinicChangeOpen, setClinicChangeOpen] = useState(false);
  const [clinicChangeDraft, setClinicChangeDraft] = useState(createClinicChangeDraft());

  const [callOpen, setCallOpen] = useState(false);
  const [callSession, setCallSession] = useState(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [callState, setCallState] = useState({
    micOn: true,
    camOn: true,
    connected: true,
    notes: "",
  });

  const [prescriptionOpen, setPrescriptionOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [prescriptionForm, setPrescriptionForm] = useState({
    diagnosis: "",
    complaint: "",
    precautions: "",
    testsAdvised: "",
    followUpDate: "",
    medicines: [
      {
        prescribed: "",
        dosage: "",
        frequency: "",
        duration: "",
        howToTake: "",
        salt: "",
        notes: "",
      },
    ],
  });

  const [prescriptionPreviewOpen, setPrescriptionPreviewOpen] = useState(false);
  const [patientCartPreview, setPatientCartPreview] = useState([]);
  const [activeCartId, setActiveCartId] = useState("");
  const [snackbar, setSnackbar] = useState({ open: false, message: "", tone: "success" });

  const timerRef = useRef(null);

  const unreadNotifications = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const nextConsult = useMemo(() => {
    const sorted = [...upcomingConsults]
      .filter((x) => x.status === BOOKING_STATES.UPCOMING || x.status === BOOKING_STATES.LIVE_NOW || x.status === BOOKING_STATES.ACCEPTED)
      .sort((a, b) => dayjs(a.bookedFor).valueOf() - dayjs(b.bookedFor).valueOf());
    return sorted[0] || null;
  }, [upcomingConsults]);

  const todaySummary = useMemo(() => {
    const today = dayjs();
    const pending = incomingRequests.filter((x) => x.status === BOOKING_STATES.PENDING).length;
    const upcoming = upcomingConsults.filter(
      (x) => x.status === BOOKING_STATES.UPCOMING || x.status === BOOKING_STATES.LIVE_NOW || x.status === BOOKING_STATES.ACCEPTED
    ).length;
    const completedToday = upcomingConsults.filter(
      (x) => x.status === BOOKING_STATES.COMPLETED && x.bookedFor && dayjs(x.bookedFor).isSame(today, "day")
    );
    const completed = completedToday.length;
    const cancelled = notifications.filter(
      (x) => x.type === NOTIFICATION_TYPES.CANCELLED && x.createdAt && dayjs(x.createdAt).isSame(today, "day")
    ).length;
    const earnings = completedToday.reduce((sum, x) => sum + Number(x.fee || 0), 0);
    return { pending, upcoming, completed, cancelled, earnings };
  }, [incomingRequests, notifications, upcomingConsults]);

  const currentBand = useMemo(() => {
    const activeFees = [];
    if (settingsDraft.audioEnabled) activeFees.push(Number(settingsDraft.audioFee || 0));
    if (settingsDraft.videoEnabled) activeFees.push(Number(settingsDraft.videoFee || 0));
    if (settingsDraft.inpersonEnabled) activeFees.push(Number(settingsDraft.inpersonFee || 0));
    const maxFee = activeFees.length ? Math.max(...activeFees) : 0;
    return getBandFromFee(maxFee);
  }, [settingsDraft]);

  useEffect(() => {
    if (!callOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallSeconds(0);
      return;
    }
    timerRef.current = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [callOpen]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (snackbar.open) setSnackbar((s) => ({ ...s, open: false }));
    }, 2200);
    return () => clearTimeout(t);
  }, [snackbar]);

  /* ------------------------------- ACTIONS -------------------------------- */

  function pushSnackbar(message, tone = "success") {
    setSnackbar({ open: true, message, tone });
  }

  function applyDashboardPayload(payload = {}) {
    const nextDoctor = payload?.doctor || createEmptyDoctor();
    setDoctor(nextDoctor);
    setIncomingRequests(Array.isArray(payload?.incomingRequests) ? payload.incomingRequests : []);
    setUpcomingConsults(Array.isArray(payload?.upcomingConsults) ? payload.upcomingConsults : []);
    setNotifications(Array.isArray(payload?.notifications) ? payload.notifications : []);
    setSettingsDraft(createSettingsDraft(nextDoctor));
    setClinicChangeDraft(createClinicChangeDraft(nextDoctor, payload?.clinicChangeRequest || null));
  }

  const loadPrescriptionPreview = React.useCallback(async (prescriptionId, options = {}) => {
    const { openModal = false } = options;
    if (!prescriptionId) return;
    const { data } = await axios.get(
      `${API_BASE_URL}/api/prescriptions/detail/${prescriptionId}`,
      getDoctorAuthConfig()
    );
    setActiveCartId(String(data?.cartDraft?._id || ""));
    setPatientCartPreview(normalizeCartPreview(data?.cartDraft));
    if (openModal) setPrescriptionPreviewOpen(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(LAST_PREVIEW_STORAGE_KEY, String(data?.prescription?._id || prescriptionId));
    }
  }, []);

  const loadDashboard = React.useCallback(async () => {
    const token = getDoctorToken();
    if (!token) {
      if (typeof window !== "undefined") window.location.href = "/doctor/login";
      return;
    }
    try {
      const [dashboardRes, recentRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/doctors/dashboard/self`, getDoctorAuthConfig()),
        axios.get(`${API_BASE_URL}/api/prescriptions/doctor/recent`, getDoctorAuthConfig()),
      ]);
      applyDashboardPayload(dashboardRes.data || {});
      setCompletedPrescriptions(
        Array.isArray(recentRes.data?.prescriptions)
          ? recentRes.data.prescriptions.map(normalizePrescriptionSummary)
          : []
      );
      if (typeof window !== "undefined") {
        const lastPrescriptionId = localStorage.getItem(LAST_PREVIEW_STORAGE_KEY);
        if (lastPrescriptionId) {
          try {
            await loadPrescriptionPreview(lastPrescriptionId);
          } catch {
            localStorage.removeItem(LAST_PREVIEW_STORAGE_KEY);
          }
        }
      }
    } catch (error) {
      if (error?.response?.status === 401 && typeof window !== "undefined") {
        localStorage.removeItem("doctorToken");
        window.location.href = "/doctor/login";
        return;
      }
      pushSnackbar(error?.response?.data?.error || "Failed to load doctor dashboard", "error");
    }
  }, [loadPrescriptionPreview]);

  async function saveCallNotes(options = {}) {
    const bookingId = callSession?._id;
    if (!bookingId) return null;
    const { silent = false } = options;
    const { data } = await axios.patch(
      `${API_BASE_URL}/api/consults/${bookingId}/session/notes`,
      { notes: callState.notes || "" },
      getDoctorAuthConfig()
    );
    const updatedConsult = data?.dashboardConsult || null;
    if (updatedConsult) {
      setCallSession(updatedConsult);
      setUpcomingConsults((prev) =>
        prev.map((item) => (item._id === updatedConsult._id ? { ...item, ...updatedConsult } : item))
      );
    }
    if (!silent) pushSnackbar("Consult notes saved", "success");
    return updatedConsult;
  }

  async function handleSaveSettings() {
    const payload = {
      online: settingsDraft.online,
      modes: {
        audio: settingsDraft.audioEnabled,
        video: settingsDraft.videoEnabled,
        inperson: settingsDraft.inpersonEnabled,
      },
      fees: {
        audio: settingsDraft.audioEnabled ? Number(settingsDraft.audioFee || 0) : null,
        video: settingsDraft.videoEnabled ? Number(settingsDraft.videoFee || 0) : null,
        inperson: settingsDraft.inpersonEnabled ? Number(settingsDraft.inpersonFee || 0) : null,
      },
      availability: {
        consultationDays: settingsDraft.consultationDays,
        startTime: settingsDraft.startTime,
        endTime: settingsDraft.endTime,
        slotDuration: Number(settingsDraft.slotDuration || 20),
        arrivalWindow: Number(settingsDraft.arrivalWindow || 20),
        maxPatientsPerDay: Number(settingsDraft.maxPatientsPerDay || 20),
      },
    };

    try {
      const { data } = await axios.patch(
        `${API_BASE_URL}/api/doctors/dashboard/settings`,
        payload,
        getDoctorAuthConfig()
      );
      applyDashboardPayload(data || {});
      pushSnackbar("Doctor settings saved", "success");
    } catch (error) {
      pushSnackbar(error?.response?.data?.error || "Failed to save doctor settings", "error");
    }
  }

  async function handleAcceptRequest(request) {
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/consults/${request._id}/accept`,
        {},
        getDoctorAuthConfig()
      );
      const accepted = data?.dashboardConsult || request;
      setIncomingRequests((prev) => prev.filter((x) => x._id !== request._id));
      setUpcomingConsults((prev) => {
        const rest = prev.filter((x) => x._id !== accepted._id);
        return [accepted, ...rest];
      });
      pushSnackbar(`Accepted ${request.patientName}`, "success");
      loadDashboard();
    } catch (error) {
      pushSnackbar(error?.response?.data?.error || `Failed to accept ${request.patientName}`, "error");
    }
  }

  async function handleRejectRequest(request) {
    try {
      await axios.post(
        `${API_BASE_URL}/api/consults/${request._id}/reject`,
        {},
        getDoctorAuthConfig()
      );
      setIncomingRequests((prev) => prev.filter((x) => x._id !== request._id));
      pushSnackbar(`Rejected ${request.patientName}`, "error");
      loadDashboard();
    } catch (error) {
      pushSnackbar(error?.response?.data?.error || `Failed to reject ${request.patientName}`, "error");
    }
  }

  async function handleRescheduleRequest(request) {
    const currentDate = request?.bookedFor ? dayjs(request.bookedFor).format("YYYY-MM-DD") : "";
    const currentSlot = request?.bookedFor ? dayjs(request.bookedFor).format("hh:mm A") : "";
    const date = typeof window !== "undefined" ? window.prompt("Enter new date (YYYY-MM-DD)", currentDate) : currentDate;
    if (!date) return;
    const slot = typeof window !== "undefined" ? window.prompt("Enter new slot (e.g. 05:30 PM)", currentSlot) : currentSlot;
    if (!slot) return;
    try {
      const { data } = await axios.patch(
        `${API_BASE_URL}/api/consults/${request._id}/reschedule`,
        { date, slot, mode: request.mode },
        getDoctorAuthConfig()
      );
      const updated = data?.dashboardConsult || request;
      setIncomingRequests((prev) => prev.filter((x) => x._id !== request._id));
      setUpcomingConsults((prev) => {
        const rest = prev.filter((x) => x._id !== updated._id);
        return [updated, ...rest];
      });
      pushSnackbar(`Rescheduled ${request.patientName}`, "success");
      loadDashboard();
    } catch (error) {
      pushSnackbar(error?.response?.data?.error || `Failed to reschedule ${request.patientName}`, "error");
    }
  }

  async function handleJoinConsult(booking) {
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/consults/${booking._id}/session/join`,
        {},
        getDoctorAuthConfig()
      );
      const joined = data?.dashboardConsult || booking;
      setCallSession(joined);
      setCallState({
        micOn: true,
        camOn: joined.mode === CONSULT_MODES.VIDEO,
        connected: true,
        notes: joined.notes || "",
      });
      setCallOpen(true);
      setUpcomingConsults((prev) =>
        prev.map((item) => (item._id === joined._id ? { ...item, ...joined } : item))
      );
      pushSnackbar(`Joined consult with ${joined.patientName}`, "success");
    } catch (error) {
      pushSnackbar(error?.response?.data?.error || `Failed to join consult for ${booking.patientName}`, "error");
    }
  }

  async function handleEndCall() {
    if (!callSession?._id) return;
    try {
      await saveCallNotes({ silent: true });
      const { data } = await axios.post(
        `${API_BASE_URL}/api/consults/${callSession._id}/session/end`,
        {},
        getDoctorAuthConfig()
      );
      const ended = data?.dashboardConsult || callSession;
      setCallOpen(false);
      setCallSession(ended);
      setUpcomingConsults((prev) =>
        prev.map((item) => (item._id === ended._id ? { ...item, ...ended, canJoin: false } : item))
      );
      pushSnackbar(`Consult ended with ${ended.patientName}`, "success");
      loadDashboard();
    } catch (error) {
      pushSnackbar(error?.response?.data?.error || "Failed to end consult", "error");
    }
  }

  function openPrescriptionBuilder(booking) {
    setSelectedBooking(booking);
    setPrescriptionForm({
      diagnosis: "",
      complaint: booking?.reason || booking?.symptoms || "",
      precautions: "",
      testsAdvised: "",
      followUpDate: "",
      medicines: [
        {
          prescribed: "",
          dosage: "",
          frequency: "",
          duration: "",
          howToTake: "",
          salt: "",
          notes: "",
        },
      ],
    });
    setPrescriptionOpen(true);
  }

  function addMedicineRow() {
    setPrescriptionForm((prev) => ({
      ...prev,
      medicines: [
        ...prev.medicines,
        {
          prescribed: "",
          dosage: "",
          frequency: "",
          duration: "",
          howToTake: "",
          salt: "",
          notes: "",
        },
      ],
    }));
  }

  function updateMedicineRow(index, key, value) {
    setPrescriptionForm((prev) => ({
      ...prev,
      medicines: prev.medicines.map((m, i) => (i === index ? { ...m, [key]: value } : m)),
    }));
  }

  function removeMedicineRow(index) {
    setPrescriptionForm((prev) => ({
      ...prev,
      medicines: prev.medicines.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmitPrescription() {
    if (!selectedBooking?._id) {
      pushSnackbar("Select a booking before creating a prescription", "error");
      return;
    }
    try {
      const payload = {
        bookingId: selectedBooking._id,
        diagnosis: prescriptionForm.diagnosis,
        complaint: prescriptionForm.complaint,
        precautions: prescriptionForm.precautions,
        testsAdvised: prescriptionForm.testsAdvised,
        followUpDate: prescriptionForm.followUpDate || null,
        medicines: prescriptionForm.medicines,
      };
      const { data } = await axios.post(
        `${API_BASE_URL}/api/prescriptions/doctor`,
        payload,
        getDoctorAuthConfig()
      );
      const prescriptionId = String(data?.prescription?._id || "");
      const cartId = String(data?.cartDraft?._id || "");
      setActiveCartId(cartId);
      setPatientCartPreview(normalizeCartPreview(data?.cartDraft));
      setPrescriptionPreviewOpen(true);
      setPrescriptionOpen(false);
      if (typeof window !== "undefined" && prescriptionId) {
        localStorage.setItem(LAST_PREVIEW_STORAGE_KEY, prescriptionId);
      }
      setCompletedPrescriptions((prev) => [
        normalizePrescriptionSummary({
          _id: prescriptionId || `local_${Date.now()}`,
          patientName: selectedBooking.patientName,
          diagnosis: prescriptionForm.diagnosis || prescriptionForm.complaint,
          createdAt: new Date().toISOString(),
          meds: prescriptionForm.medicines.filter((x) => x.prescribed).length,
          sentToPatient: true,
        }),
        ...prev.filter((row) => row._id !== prescriptionId),
      ]);
      pushSnackbar("Prescription generated and patient preview prepared", "success");
      loadDashboard();
    } catch (error) {
      pushSnackbar(error?.response?.data?.error || "Failed to create prescription", "error");
    }
  }

  async function toggleGeneric(itemId) {
    const item = patientCartPreview.find((row) => row.id === itemId);
    if (!activeCartId || !item?.cartItemId) return;
    try {
      const { data } = await axios.patch(
        `${API_BASE_URL}/api/prescriptions/cart/${activeCartId}/items/${item.cartItemId}/toggle-generic`,
        {},
        getDoctorAuthConfig()
      );
      setPatientCartPreview(normalizeCartPreview(data?.cartDraft));
    } catch (error) {
      pushSnackbar(error?.response?.data?.error || "Failed to toggle generic medicine", "error");
    }
  }

  async function submitClinicChangeRequest() {
    try {
      const payload = {
        clinicName: clinicChangeDraft.clinicName,
        addressLine1: clinicChangeDraft.addressLine1,
        locality: clinicChangeDraft.locality,
        city: clinicChangeDraft.city,
        pin: clinicChangeDraft.pin,
        mapLabel: clinicChangeDraft.mapLabel,
      };
      await axios.post(
        `${API_BASE_URL}/api/doctors/clinic-change-requests`,
        payload,
        getDoctorAuthConfig()
      );
      setClinicChangeOpen(false);
      pushSnackbar("Clinic change request submitted for re-verification", "success");
      loadDashboard();
    } catch (error) {
      pushSnackbar(error?.response?.data?.error || "Failed to submit clinic change request", "error");
    }
  }

  async function markNotificationRead(notificationId) {
    setNotifications((prev) => prev.map((n) => (n._id === notificationId ? { ...n, read: true } : n)));
    try {
      await axios.patch(
        `${API_BASE_URL}/api/doctors/me/notifications/${notificationId}/read`,
        {},
        getDoctorAuthConfig()
      );
    } catch {
      setNotifications((prev) => prev.map((n) => (n._id === notificationId ? { ...n, read: false } : n)));
    }
  }

  /* ------------------------------- EFFECTS -------------------------------- */

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    // Auto-promote accepted/live states based on time
    const interval = setInterval(() => {
      setUpcomingConsults((prev) =>
        prev.map((item) => {
          const isLive = dayjs(item.bookedFor).isBefore(dayjs().add(1, "minute")) && item.status !== BOOKING_STATES.COMPLETED;
          return {
            ...item,
            status:
              item.status === BOOKING_STATES.COMPLETED || item.status === BOOKING_STATES.CANCELLED
                ? item.status
                : isLive
                ? BOOKING_STATES.LIVE_NOW
                : item.status === BOOKING_STATES.PENDING
                ? BOOKING_STATES.PENDING
                : BOOKING_STATES.UPCOMING,
            canJoin: isLive,
          };
        })
      );
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  /* -------------------------------- RENDER -------------------------------- */

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#effaf6_0%,#f7fbff_44%,#f4f7fb_100%)]">
      <div className="mx-auto max-w-[1320px] px-4 pb-32 pt-4 sm:px-6 sm:pb-24 lg:px-8">
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[30px] border border-emerald-200/60 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_30%),linear-gradient(135deg,#083c34_0%,#0f6d57_55%,#0f7c66_100%)] p-5 text-white shadow-[0_20px_50px_rgba(3,31,27,0.22)]"
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <Avatar className="h-16 w-16 border border-white/20 ring-4 ring-white/10">
                {doctor.avatar ? <AvatarImage src={doctor.avatar} alt={doctor.fullName} /> : null}
                <AvatarFallback className="bg-white/15 text-lg font-black text-white">{initials(doctor.fullName)}</AvatarFallback>
              </Avatar>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-[26px] font-black tracking-tight">{doctor.fullName}</h1>
                  <Badge className="border border-white/20 bg-white/10 font-bold text-white">
                    <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                    {doctor.profileStatus}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-emerald-50/90">
                  <span>{doctor.specialty}</span>
                  <span>•</span>
                  <span>{doctor.qualification}</span>
                  <span>•</span>
                  <span>{doctor.yearsExperience} yrs exp</span>
                  <span>•</span>
                  <span>
                    {doctor.city}, {doctor.area}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold">
                    GoDavaii Platform / Service Fee Band:{" "}
                    <span className="font-black">
                      {currentBand.fee == null ? "Manual Approval" : `${currentBand.label} • ${money(currentBand.fee)} + GST`}
                    </span>
                  </div>
                  <div className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold">
                    Payout: <span className="font-black">{doctor.payoutAccountMasked}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-full lg:max-w-[500px] lg:flex-none">
              <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.12em] text-emerald-50/80">Next Consult</div>
                <div className="mt-2 text-lg font-black">{nextConsult ? countdownLabel(nextConsult.bookedFor) : "No queue"}</div>
              </div>

              <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.12em] text-emerald-50/80">Pending</div>
                <div className="mt-2 text-lg font-black">{todaySummary.pending}</div>
              </div>

              <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.12em] text-emerald-50/80">Today Earnings</div>
                <div className="mt-2 text-lg font-black">{money(todaySummary.earnings)}</div>
              </div>

              <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.12em] text-emerald-50/80">Notifications</div>
                <div className="mt-2 flex items-center gap-2 text-lg font-black">
                  {unreadNotifications}
                  <NotificationBadge count={unreadNotifications} />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* TOP CONTROL RAIL */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Upcoming Consults" value={todaySummary.upcoming} sub="Today queue" icon={CalendarClock} tone="indigo" />
            <KpiCard label="Pending Requests" value={todaySummary.pending} sub="Need action now" icon={AlertCircle} tone="amber" />
            <KpiCard label="Completed Today" value={todaySummary.completed} sub="Smooth close rate" icon={CheckCircle2} tone="emerald" />
            <KpiCard label="Cancelled / Missed" value={todaySummary.cancelled} sub="Track follow-ups" icon={XCircle} tone="rose" />
          </div>

          <SectionCard
            title="Doctor Controls"
            icon={Activity}
            right={
              <Badge className={cx("border font-bold", doctor.online ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-rose-100 text-rose-800 border-rose-200")}>
                {doctor.online ? "Online" : "Offline"}
              </Badge>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-900">Available for bookings</div>
                    <div className="text-sm text-slate-600">Toggle consultation visibility</div>
                  </div>
                  <Switch
                    checked={settingsDraft.online}
                    onCheckedChange={(next) => setSettingsDraft((p) => ({ ...p, online: next }))}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-bold text-slate-900">Current Band</div>
                <div className="mt-2 text-[22px] font-black text-slate-900">
                  {currentBand.fee == null ? "Manual" : money(currentBand.fee)}
                </div>
                <div className="text-sm text-slate-600">{currentBand.label} • applicable GST</div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* MAIN CONTENT */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)] 2xl:grid-cols-[1.35fr_0.92fr]">
          {/* LEFT COLUMN */}
          <div className="space-y-4">
            <SectionCard
              title="Incoming Requests"
              icon={BellRing}
              right={<NotificationBadge count={incomingRequests.filter((x) => x.status === BOOKING_STATES.PENDING).length} />}
            >
              {incomingRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                  No pending requests right now.
                </div>
              ) : (
                <div className="space-y-3">
                  {incomingRequests.map((req) => (
                    <div
                      key={req._id}
                      className="rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)] p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                            <UserRound className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-lg font-black text-slate-900">{req.patientName}</h4>
                              <ModeBadge mode={req.mode} />
                              <StatusBadge status={req.status} />
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                              <span>
                                {req.patientAge} yrs • {req.patientGender}
                              </span>
                              <span>•</span>
                              <span>{formatSlot(req.bookedFor)}</span>
                              <span>•</span>
                              <span>{req.locationLabel}</span>
                              <span>•</span>
                              <span className="font-bold text-slate-900">{money(req.fee)}</span>
                            </div>
                            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                              <span className="font-bold text-slate-900">Reason / Symptoms:</span> {req.symptoms}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button
                            onClick={() => handleAcceptRequest(req)}
                            className="rounded-2xl bg-emerald-600 px-4 font-black text-white hover:bg-emerald-700"
                          >
                            <CheckCheck className="mr-2 h-4 w-4" />
                            Accept
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleRescheduleRequest(req)}
                            className="rounded-2xl border-slate-300 font-black"
                          >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Reschedule
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleRejectRequest(req)}
                            className="rounded-2xl border-rose-300 font-black text-rose-700 hover:bg-rose-50"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Upcoming Consults" icon={CalendarDays}>
              {upcomingConsults.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                  No upcoming consults.
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingConsults.map((booking) => (
                    <div
                      key={booking._id}
                      className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                            {booking.mode === CONSULT_MODES.VIDEO ? (
                              <Video className="h-5 w-5" />
                            ) : booking.mode === CONSULT_MODES.AUDIO ? (
                              <Phone className="h-5 w-5" />
                            ) : (
                              <Building2 className="h-5 w-5" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-lg font-black text-slate-900">{booking.patientName}</h4>
                              <ModeBadge mode={booking.mode} />
                              <StatusBadge status={booking.status} />
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                              <span>{formatSlot(booking.bookedFor)}</span>
                              <span>•</span>
                              <span>{countdownLabel(booking.bookedFor)}</span>
                              <span>•</span>
                              <span>{money(booking.fee)}</span>
                            </div>
                            <div className="mt-2 text-sm text-slate-700">
                              <span className="font-bold text-slate-900">Case:</span> {booking.reason}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {(booking.mode === CONSULT_MODES.VIDEO || booking.mode === CONSULT_MODES.AUDIO) && (
                            <Button
                              onClick={() => handleJoinConsult(booking)}
                              className={cx(
                                "rounded-2xl px-4 font-black text-white",
                                booking.mode === CONSULT_MODES.VIDEO
                                  ? "bg-indigo-600 hover:bg-indigo-700"
                                  : "bg-sky-600 hover:bg-sky-700"
                              )}
                            >
                              {booking.mode === CONSULT_MODES.VIDEO ? (
                                <Video className="mr-2 h-4 w-4" />
                              ) : (
                                <PhoneCall className="mr-2 h-4 w-4" />
                              )}
                              {booking.canJoin ? "Join Now" : "Open Room"}
                            </Button>
                          )}

                          {booking.mode === CONSULT_MODES.INPERSON && (
                            <Button variant="outline" className="rounded-2xl border-slate-300 font-black">
                              <MapPin className="mr-2 h-4 w-4" />
                              View Clinic Slot
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            onClick={() => openPrescriptionBuilder(booking)}
                            className="rounded-2xl border-slate-300 font-black"
                          >
                            <ClipboardPlus className="mr-2 h-4 w-4" />
                            Prescription
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Prescription Center"
              icon={FileText}
              right={
                <Button
                  variant="outline"
                  className="rounded-2xl border-slate-300 font-black"
                  onClick={() => openPrescriptionBuilder(upcomingConsults[0] || incomingRequests[0] || null)}
                >
                  <PencilLine className="mr-2 h-4 w-4" />
                  New Prescription
                </Button>
              }
            >
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <Sparkles className="h-4 w-4 text-emerald-700" />
                    Prescription → Patient → Cart flow
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <div>1. Doctor fills branded GoDavaii prescription</div>
                    <div>2. Patient gets prescription instantly</div>
                    <div>3. Medicines auto-map to catalog</div>
                    <div>4. All matched medicines pre-add to cart</div>
                    <div>5. Generic savings shown with switch option</div>
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-black text-slate-900">Recent prescriptions</div>
                  <div className="mt-3 space-y-3">
                    {completedPrescriptions.map((rx) => (
                      <div key={rx._id} className="rounded-2xl border border-white bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-black text-slate-900">{rx.patientName}</div>
                            <div className="text-sm text-slate-600">{rx.diagnosis}</div>
                          </div>
                          <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold">
                            Sent
                          </Badge>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          {dayjs(rx.createdAt).format("DD MMM • hh:mm A")} • {rx.meds} medicines
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Doctor Profile & Verified Clinic" icon={ShieldCheck}>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.08fr_0.92fr]">
                <div className="rounded-[22px] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f6fffb_100%)] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-600">Verified clinic details</div>
                      <div className="mt-1 text-xl font-black text-slate-900">{doctor.clinic.name}</div>
                    </div>
                    <Badge className="border border-emerald-200 bg-emerald-100 font-bold text-emerald-800">
                      Verified
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Address</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {doctor.clinic.addressLine1}, {doctor.clinic.locality}, {doctor.clinic.city} - {doctor.clinic.pin}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Map label</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{doctor.clinic.mapLabel}</div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Clinic timings</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {doctor.clinic.consultationDays.join(", ")} • {doctor.clinic.startTime} – {doctor.clinic.endTime}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Slot {doctor.clinic.slotDuration} min • Arrival window {doctor.clinic.arrivalWindow} min • Max{" "}
                        {doctor.clinic.maxPatientsPerDay}/day
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Button
                      variant="outline"
                      onClick={() => setClinicChangeOpen(true)}
                      className="rounded-2xl border-slate-300 font-black"
                    >
                      <PencilLine className="mr-2 h-4 w-4" />
                      Request Clinic Change
                    </Button>
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-bold text-slate-600">Doctor identity</div>
                  <div className="mt-3 space-y-3">
                    <div className="rounded-2xl border border-white bg-white p-3">
                      <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Specialty</div>
                      <div className="mt-1 font-black text-slate-900">{doctor.specialty}</div>
                    </div>
                    <div className="rounded-2xl border border-white bg-white p-3">
                      <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Qualification</div>
                      <div className="mt-1 font-black text-slate-900">{doctor.qualification}</div>
                    </div>
                    <div className="rounded-2xl border border-white bg-white p-3">
                      <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Email</div>
                      <div className="mt-1 font-black text-slate-900">{doctor.email}</div>
                    </div>
                    <div className="rounded-2xl border border-white bg-white p-3">
                      <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Payout</div>
                      <div className="mt-1 font-black text-slate-900">{doctor.payoutAccountMasked}</div>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Modes, Fees & Availability" icon={Settings2}>
              <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1fr_0.9fr]">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    {/* AUDIO */}
                    <div className="min-w-0 rounded-[22px] border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-sky-700" />
                          <div className="font-black text-slate-900">Audio</div>
                        </div>
                        <div className="shrink-0">
                          <Switch
                            checked={settingsDraft.audioEnabled}
                            onCheckedChange={(next) =>
                              setSettingsDraft((p) => ({
                                ...p,
                                audioEnabled: next,
                                audioFee: next ? p.audioFee || 299 : "",
                              }))
                            }
                          />
                        </div>
                      </div>

                      <AnimatePresence>
                        {settingsDraft.audioEnabled && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                            <div className="mt-3">
                              <Label>Audio Fee</Label>
                              <Input
                                type="number"
                                value={settingsDraft.audioFee}
                                onChange={(e) => setSettingsDraft((p) => ({ ...p, audioFee: e.target.value }))}
                                className="mt-2"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* VIDEO */}
                    <div className="min-w-0 rounded-[22px] border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4 text-indigo-700" />
                          <div className="font-black text-slate-900">Video</div>
                        </div>
                        <div className="shrink-0">
                          <Switch
                            checked={settingsDraft.videoEnabled}
                            onCheckedChange={(next) =>
                              setSettingsDraft((p) => ({
                                ...p,
                                videoEnabled: next,
                                videoFee: next ? p.videoFee || 299 : "",
                              }))
                            }
                          />
                        </div>
                      </div>

                      <AnimatePresence>
                        {settingsDraft.videoEnabled && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                            <div className="mt-3">
                              <Label>Video Fee</Label>
                              <Input
                                type="number"
                                value={settingsDraft.videoFee}
                                onChange={(e) => setSettingsDraft((p) => ({ ...p, videoFee: e.target.value }))}
                                className="mt-2"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* INPERSON */}
                    <div className="min-w-0 rounded-[22px] border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-emerald-700" />
                          <div className="font-black text-slate-900">In-person</div>
                        </div>
                        <div className="shrink-0">
                          <Switch
                            checked={settingsDraft.inpersonEnabled}
                            onCheckedChange={(next) =>
                              setSettingsDraft((p) => ({
                                ...p,
                                inpersonEnabled: next,
                                inpersonFee: next ? p.inpersonFee || 399 : "",
                              }))
                            }
                          />
                        </div>
                      </div>

                      <AnimatePresence>
                        {settingsDraft.inpersonEnabled && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                            <div className="mt-3">
                              <Label>In-person Fee</Label>
                              <Input
                                type="number"
                                value={settingsDraft.inpersonFee}
                                onChange={(e) => setSettingsDraft((p) => ({ ...p, inpersonFee: e.target.value }))}
                                className="mt-2"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <AnimatePresence>
                    {settingsDraft.inpersonEnabled && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                        <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                          <div className="mb-3 text-sm font-black text-slate-900">In-person slot rules</div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div>
                              <Label>Start Time</Label>
                              <Input
                                type="time"
                                className="mt-2"
                                value={settingsDraft.startTime}
                                onChange={(e) => setSettingsDraft((p) => ({ ...p, startTime: e.target.value }))}
                              />
                            </div>
                            <div>
                              <Label>End Time</Label>
                              <Input
                                type="time"
                                className="mt-2"
                                value={settingsDraft.endTime}
                                onChange={(e) => setSettingsDraft((p) => ({ ...p, endTime: e.target.value }))}
                              />
                            </div>
                            <div>
                              <Label>Slot Duration (min)</Label>
                              <Input
                                type="number"
                                className="mt-2"
                                value={settingsDraft.slotDuration}
                                onChange={(e) => setSettingsDraft((p) => ({ ...p, slotDuration: e.target.value }))}
                              />
                            </div>
                            <div>
                              <Label>Arrival Window (min)</Label>
                              <Input
                                type="number"
                                className="mt-2"
                                value={settingsDraft.arrivalWindow}
                                onChange={(e) => setSettingsDraft((p) => ({ ...p, arrivalWindow: e.target.value }))}
                              />
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.65fr)]">
                            <div>
                              <Label>Consultation Days</Label>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => {
                                  const active = settingsDraft.consultationDays.includes(day);
                                  return (
                                    <button
                                      key={day}
                                      type="button"
                                      onClick={() =>
                                        setSettingsDraft((p) => ({
                                          ...p,
                                          consultationDays: active
                                            ? p.consultationDays.filter((d) => d !== day)
                                            : [...p.consultationDays, day],
                                        }))
                                      }
                                      className={cx(
                                        "rounded-full border px-3 py-2 text-sm font-black transition",
                                        active
                                          ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                                          : "border-slate-200 bg-white text-slate-600"
                                      )}
                                    >
                                      {day}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <Label>Max patients/day</Label>
                              <Input
                                type="number"
                                className="mt-2"
                                value={settingsDraft.maxPatientsPerDay}
                                onChange={(e) => setSettingsDraft((p) => ({ ...p, maxPatientsPerDay: e.target.value }))}
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-black text-slate-900">Commercial preview</div>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-white bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Current fee band</div>
                      <div className="mt-1 text-2xl font-black text-slate-900">{currentBand.label}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        {currentBand.fee == null ? "Manual commercial approval required" : `${money(currentBand.fee)} + applicable GST`}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Doctor-side note</div>
                      <div className="mt-2 text-sm text-slate-700">
                        Applies only on completed consultations. Same model for audio, video, and in-person bookings.
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Patient UI rule</div>
                      <div className="mt-2 text-sm text-slate-700">
                        Customer sees only bundled consult price. Internal commercial split remains hidden.
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Button onClick={handleSaveSettings} className="w-full rounded-2xl bg-emerald-600 font-black text-white hover:bg-emerald-700">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Save Doctor Settings
                    </Button>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4">
            <SectionCard
              title="Join Now"
              icon={Timer}
              right={
                nextConsult ? (
                  <Badge className="border border-emerald-200 bg-emerald-100 font-bold text-emerald-800">
                    {countdownLabel(nextConsult.bookedFor)}
                  </Badge>
                ) : null
              }
            >
              {nextConsult ? (
                <div className="rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f6fffb_100%)] p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                      {nextConsult.mode === CONSULT_MODES.VIDEO ? <Video className="h-5 w-5" /> : nextConsult.mode === CONSULT_MODES.AUDIO ? <Phone className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-black text-slate-900">{nextConsult.patientName}</div>
                      <div className="mt-1 text-sm text-slate-600">{formatSlot(nextConsult.bookedFor)}</div>
                      <div className="mt-2 text-sm text-slate-700">{nextConsult.reason}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-2">
                    {(nextConsult.mode === CONSULT_MODES.AUDIO || nextConsult.mode === CONSULT_MODES.VIDEO) ? (
                      <Button
                        onClick={() => handleJoinConsult(nextConsult)}
                        className={cx(
                          "rounded-2xl font-black text-white",
                          nextConsult.mode === CONSULT_MODES.VIDEO ? "bg-indigo-600 hover:bg-indigo-700" : "bg-sky-600 hover:bg-sky-700"
                        )}
                      >
                        {nextConsult.mode === CONSULT_MODES.VIDEO ? <Video className="mr-2 h-4 w-4" /> : <PhoneCall className="mr-2 h-4 w-4" />}
                        {nextConsult.mode === CONSULT_MODES.VIDEO ? "Join Video Call" : "Join Audio Call"}
                      </Button>
                    ) : (
                      <Button variant="outline" className="rounded-2xl border-slate-300 font-black">
                        <MapPin className="mr-2 h-4 w-4" />
                        Open Clinic Slot
                      </Button>
                    )}

                    <Button variant="outline" className="rounded-2xl border-slate-300 font-black" onClick={() => openPrescriptionBuilder(nextConsult)}>
                      <ClipboardPlus className="mr-2 h-4 w-4" />
                      Start Prescription
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                  No active join-ready consult.
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Notifications & Reminders"
              icon={BellRing}
              right={<NotificationBadge count={unreadNotifications} />}
            >
              <div className="space-y-3">
                {notifications.map((note) => (
                  <button
                    key={note._id}
                    type="button"
                    onClick={() => markNotificationRead(note._id)}
                    className={cx(
                      "w-full rounded-[20px] border p-4 text-left transition",
                      note.read ? "border-slate-200 bg-white" : "border-emerald-200 bg-emerald-50/60"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cx("rounded-2xl p-3", note.read ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700")}>
                        <BellRing className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-black text-slate-900">{note.title}</div>
                          {!note.read && <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">{note.body}</div>
                        <div className="mt-2 text-xs text-slate-500">{humanDiff(note.createdAt)}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Patient Cart / Generic Savings Preview" icon={Wallet}>
              {patientCartPreview.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                  Submit a prescription to preview patient cart and generic substitution flow.
                </div>
              ) : (
                <div className="space-y-3">
                  {patientCartPreview.map((item) => {
                    const showGeneric = item.generic?.available;
                    const selectedName = item.switchedToGeneric && showGeneric ? item.generic.name : item.matchedBrand.name;
                    const selectedPrice = item.switchedToGeneric && showGeneric ? item.generic.price : item.matchedBrand.price;
                    return (
                      <div key={item.id} className="rounded-[20px] border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="font-black text-slate-900">{item.prescribed}</div>
                            <div className="mt-1 text-sm text-slate-600">{item.salt}</div>
                            <div className="mt-2 text-sm text-slate-700">
                              {item.dosage} • {item.frequency} • {item.duration}
                            </div>
                            <div className="text-sm text-slate-700">{item.howToTake}</div>
                          </div>
                          <div className="self-start rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-900">
                            {money(selectedPrice)}
                          </div>
                        </div>

                        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Current cart item</div>
                          <div className="mt-1 font-black text-slate-900">{selectedName}</div>
                        </div>

                        {showGeneric && (
                          <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="font-black text-emerald-900">{item.generic.name}</div>
                                <div className="mt-1 text-sm text-emerald-800">Same salt composition</div>
                                <div className="mt-1 text-sm font-bold text-emerald-900">
                                  Save {money(item.generic.savings)} if switched
                                </div>
                              </div>
                              <div className="self-start sm:self-center">
                                <Switch checked={!!item.switchedToGeneric} onCheckedChange={() => toggleGeneric(item.id)} />
                              </div>
                            </div>
                            {item.sensitive ? (
                              <div className="mt-2 text-xs font-semibold text-amber-700">
                                Sensitive medicine: pharmacist/doctor review required before substitution
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      </div>

      {/* ------------------------------ CALL MODAL ----------------------------- */}
      <Dialog open={callOpen} onOpenChange={setCallOpen}>
        <DialogContent className="max-w-5xl rounded-[32px] border-0 bg-[#061f1d] p-0 text-white shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
          <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[1.35fr_0.8fr]">
            <div className="relative overflow-hidden rounded-l-[32px] bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_28%),linear-gradient(180deg,#0a1817_0%,#0c2521_100%)] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm uppercase tracking-[0.18em] text-emerald-100/70">GoDavaii Consult Room</div>
                  <div className="mt-1 text-2xl font-black">{callSession?.patientName || "Consult Room"}</div>
                  <div className="mt-1 text-sm text-emerald-50/80">
                    {callSession?.mode === CONSULT_MODES.VIDEO ? "Video consult" : "Audio consult"} •
                    {Math.floor(callSeconds / 60)
                      .toString()
                      .padStart(2, "0")}
                    :
                    {(callSeconds % 60).toString().padStart(2, "0")}
                  </div>
                </div>

                <Badge className="border border-white/10 bg-white/10 font-bold text-white">
                  {callState.connected ? "Connected" : "Reconnecting"}
                </Badge>
              </div>

              <div className="mt-5 flex h-[420px] items-center justify-center rounded-[28px] border border-white/10 bg-black/30">
                {callSession?.mode === CONSULT_MODES.VIDEO ? (
                  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_35%),linear-gradient(180deg,#0d1717,#0a0f10)]">
                    <div className="text-center">
                      <Avatar className="mx-auto h-24 w-24 border border-white/10">
                        <AvatarFallback className="bg-white/10 text-3xl font-black text-white">
                          {initials(callSession?.patientName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="mt-4 text-xl font-black">{callSession?.patientName}</div>
                      <div className="mt-1 text-sm text-white/65">Video stream placeholder frontend</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <Avatar className="mx-auto h-24 w-24 border border-white/10">
                      <AvatarFallback className="bg-white/10 text-3xl font-black text-white">
                        {initials(callSession?.patientName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="mt-4 text-xl font-black">{callSession?.patientName}</div>
                    <div className="mt-1 text-sm text-white/65">Audio consult room frontend</div>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setCallState((p) => ({ ...p, micOn: !p.micOn }))}
                  className="rounded-full border-white/15 bg-white/10 font-black text-white hover:bg-white/15"
                >
                  {callState.micOn ? <Mic className="mr-2 h-4 w-4" /> : <MicOff className="mr-2 h-4 w-4" />}
                  {callState.micOn ? "Mute" : "Unmute"}
                </Button>

                {callSession?.mode === CONSULT_MODES.VIDEO && (
                  <Button
                    variant="outline"
                    onClick={() => setCallState((p) => ({ ...p, camOn: !p.camOn }))}
                    className="rounded-full border-white/15 bg-white/10 font-black text-white hover:bg-white/15"
                  >
                    {callState.camOn ? <Camera className="mr-2 h-4 w-4" /> : <CameraOff className="mr-2 h-4 w-4" />}
                    {callState.camOn ? "Camera Off" : "Camera On"}
                  </Button>
                )}

                <Button
                  onClick={handleEndCall}
                  className="rounded-full bg-rose-600 font-black text-white hover:bg-rose-700"
                >
                  <PhoneOff className="mr-2 h-4 w-4" />
                  End Consult
                </Button>
              </div>
            </div>

            <div className="rounded-r-[32px] bg-white p-5 text-slate-900">
              <div className="text-lg font-black">During Consult</div>
              <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-black text-slate-900">Patient Summary</div>
                <div className="mt-2 text-sm text-slate-700">
                  <div>
                    <span className="font-bold">Name:</span> {callSession?.patientName}
                  </div>
                  <div className="mt-1">
                    <span className="font-bold">Reason:</span> {callSession?.reason}
                  </div>
                  <div className="mt-1">
                    <span className="font-bold">Booked time:</span> {callSession ? formatSlot(callSession.bookedFor) : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Label>Clinical Notes</Label>
                <TextArea
                  rows={8}
                  value={callState.notes}
                  onChange={(e) => setCallState((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Write quick notes during consult..."
                  className="mt-2"
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2">
                <Button
                  onClick={() => {
                    saveCallNotes({ silent: true })
                      .catch(() => null)
                      .finally(() => {
                        setCallOpen(false);
                        openPrescriptionBuilder(callSession);
                      });
                  }}
                  className="rounded-2xl bg-emerald-600 font-black text-white hover:bg-emerald-700"
                >
                  <ClipboardPlus className="mr-2 h-4 w-4" />
                  Open Prescription Builder
                </Button>

                <Button
                  variant="outline"
                  className="rounded-2xl border-slate-300 font-black"
                  onClick={() => saveCallNotes()}
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Continue with Notes Only
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ------------------------- PRESCRIPTION MODAL -------------------------- */}
      <Dialog open={prescriptionOpen} onOpenChange={setPrescriptionOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-[24px] border-0 bg-white p-0 shadow-[0_20px_80px_rgba(15,23,42,0.16)] sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] lg:max-w-6xl xl:w-auto xl:rounded-[32px]">
          <DialogHeader className="border-b border-slate-100 px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-2xl font-black text-slate-900">
              <FileText className="h-6 w-6 text-emerald-700" />
              GoDavaii Branded Prescription
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-0 xl:grid-cols-[1.02fr_0.98fr]">
            <div className="border-b border-slate-100 px-4 py-5 sm:px-6 xl:border-b-0 xl:border-r">
              <div className="rounded-[24px] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fffb_100%)] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-500">Doctor</div>
                    <div className="mt-1 text-xl font-black text-slate-900">{doctor.fullName}</div>
                    <div className="text-sm text-slate-600">{doctor.specialty}</div>
                  </div>
                  <div className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-black text-white">GoDavaii Rx</div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white bg-white p-3">
                    <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Patient</div>
                    <div className="mt-1 font-black text-slate-900">{selectedBooking?.patientName || "Select booking"}</div>
                  </div>
                  <div className="rounded-2xl border border-white bg-white p-3">
                    <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Consult mode</div>
                    <div className="mt-1 font-black text-slate-900">
                      {selectedBooking?.mode === CONSULT_MODES.VIDEO
                        ? "Video"
                        : selectedBooking?.mode === CONSULT_MODES.AUDIO
                        ? "Audio"
                        : selectedBooking?.mode === CONSULT_MODES.INPERSON
                        ? "In-person"
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4">
                <div>
                  <Label>Complaint / Visit Reason</Label>
                  <TextArea
                    rows={3}
                    className="mt-2"
                    value={prescriptionForm.complaint}
                    onChange={(e) => setPrescriptionForm((p) => ({ ...p, complaint: e.target.value }))}
                    placeholder="Main complaint..."
                  />
                </div>

                <div>
                  <Label>Diagnosis</Label>
                  <TextArea
                    rows={3}
                    className="mt-2"
                    value={prescriptionForm.diagnosis}
                    onChange={(e) => setPrescriptionForm((p) => ({ ...p, diagnosis: e.target.value }))}
                    placeholder="Diagnosis / clinical impression..."
                  />
                </div>

                <div>
                  <Label>Precautions / Advice</Label>
                  <TextArea
                    rows={3}
                    className="mt-2"
                    value={prescriptionForm.precautions}
                    onChange={(e) => setPrescriptionForm((p) => ({ ...p, precautions: e.target.value }))}
                    placeholder="Precautions, hydration, rest, warning signs..."
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Tests Advised</Label>
                    <TextArea
                      rows={3}
                      className="mt-2"
                      value={prescriptionForm.testsAdvised}
                      onChange={(e) => setPrescriptionForm((p) => ({ ...p, testsAdvised: e.target.value }))}
                      placeholder="CBC, LFT, HbA1c..."
                    />
                  </div>
                  <div>
                    <Label>Follow-up Date</Label>
                    <Input
                      type="date"
                      className="mt-2"
                      value={prescriptionForm.followUpDate}
                      onChange={(e) => setPrescriptionForm((p) => ({ ...p, followUpDate: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 py-5 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-lg font-black text-slate-900">Medicine Builder</div>
                <Button onClick={addMedicineRow} variant="outline" className="rounded-2xl border-slate-300 font-black">
                  <Pill className="mr-2 h-4 w-4" />
                  Add Medicine
                </Button>
              </div>

              <div className="mt-4 space-y-4">
                {prescriptionForm.medicines.map((med, idx) => (
                  <div key={idx} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="font-black text-slate-900">Medicine #{idx + 1}</div>
                      {prescriptionForm.medicines.length > 1 && (
                        <Button
                          variant="outline"
                          onClick={() => removeMedicineRow(idx)}
                          className="rounded-xl border-rose-300 text-rose-700 hover:bg-rose-50"
                        >
                          Remove
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <Label>Medicine name</Label>
                        <Input
                          className="mt-2"
                          value={med.prescribed}
                          onChange={(e) => updateMedicineRow(idx, "prescribed", e.target.value)}
                          placeholder="e.g. Augmentin 625"
                        />
                      </div>

                      <div>
                        <Label>Salt / composition</Label>
                        <Input
                          className="mt-2"
                          value={med.salt}
                          onChange={(e) => updateMedicineRow(idx, "salt", e.target.value)}
                          placeholder="e.g. Amoxicillin + Clavulanic Acid"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Dosage</Label>
                          <Input
                            className="mt-2"
                            value={med.dosage}
                            onChange={(e) => updateMedicineRow(idx, "dosage", e.target.value)}
                            placeholder="1 tablet"
                          />
                        </div>
                        <div>
                          <Label>Frequency</Label>
                          <Input
                            className="mt-2"
                            value={med.frequency}
                            onChange={(e) => updateMedicineRow(idx, "frequency", e.target.value)}
                            placeholder="BD / OD / SOS"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Duration</Label>
                          <Input
                            className="mt-2"
                            value={med.duration}
                            onChange={(e) => updateMedicineRow(idx, "duration", e.target.value)}
                            placeholder="5 days"
                          />
                        </div>
                        <div>
                          <Label>How to take</Label>
                          <Input
                            className="mt-2"
                            value={med.howToTake}
                            onChange={(e) => updateMedicineRow(idx, "howToTake", e.target.value)}
                            placeholder="After food / before breakfast"
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Notes</Label>
                        <Input
                          className="mt-2"
                          value={med.notes}
                          onChange={(e) => updateMedicineRow(idx, "notes", e.target.value)}
                          placeholder="Any special note..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" className="rounded-2xl border-slate-300 font-black" onClick={() => setPrescriptionOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitPrescription}
                  className="rounded-2xl bg-emerald-600 font-black text-white hover:bg-emerald-700"
                >
                  Generate Prescription & Patient Cart Preview
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------------------- PATIENT CART PREVIEW MODAL --------------------- */}
      <Dialog open={prescriptionPreviewOpen} onOpenChange={setPrescriptionPreviewOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-[24px] border-0 bg-white p-0 shadow-[0_20px_80px_rgba(15,23,42,0.16)] sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] lg:max-w-5xl xl:w-auto xl:rounded-[32px]">
          <DialogHeader className="border-b border-slate-100 px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-2xl font-black text-slate-900">
              <Wallet className="h-6 w-6 text-emerald-700" />
              Patient Order Page Preview
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-5">
            <div className="mb-4 rounded-[24px] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fffb_100%)] p-4">
              <div className="text-sm font-bold text-slate-600">What happens after doctor submits</div>
              <div className="mt-2 text-sm text-slate-700">
                Prescription instantly reaches patient → all mapped medicines auto-add to cart → branded + generic options shown → savings visible.
              </div>
            </div>

            <div className="space-y-4">
              {patientCartPreview.map((item) => {
                const usingGeneric = item.switchedToGeneric && item.generic.available;
                const totalSavings = usingGeneric ? item.generic.savings : 0;
                return (
                  <div key={item.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-lg font-black text-slate-900">{item.prescribed}</div>
                          <Badge className="border border-slate-200 bg-slate-100 font-bold text-slate-700">
                            Auto-added to cart
                          </Badge>
                          {usingGeneric && (
                            <Badge className="border border-emerald-200 bg-emerald-100 font-bold text-emerald-800">
                              Generic selected
                            </Badge>
                          )}
                        </div>

                        <div className="mt-2 text-sm text-slate-600">{item.salt}</div>
                        <div className="mt-2 text-sm text-slate-700">
                          {item.dosage} • {item.frequency} • {item.duration} • {item.howToTake}
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Prescribed brand</div>
                            <div className="mt-1 font-black text-slate-900">{item.matchedBrand.name}</div>
                            <div className="mt-1 text-sm text-slate-600">{money(item.matchedBrand.price)}</div>
                          </div>

                          <div className={cx("rounded-2xl border p-3", item.generic.available ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50")}>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Generic alternative</div>
                                <div className="mt-1 font-black text-slate-900">{item.generic.name}</div>
                                {item.generic.available ? (
                                  <>
                                    <div className="mt-1 text-sm text-slate-600">{money(item.generic.price)}</div>
                                    <div className="mt-1 text-sm font-bold text-emerald-800">
                                      Save {money(item.generic.savings)}
                                    </div>
                                    <div className="mt-1 text-xs font-semibold text-emerald-800">Same salt composition</div>
                                  </>
                                ) : (
                                  <div className="mt-1 text-sm text-slate-500">No generic mapped</div>
                                )}
                              </div>
                              {item.generic.available ? (
                                <div className="self-start sm:self-center">
                                  <Switch checked={item.switchedToGeneric} onCheckedChange={() => toggleGeneric(item.id)} />
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 xl:w-[220px]">
                        <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Patient pays</div>
                        <div className="mt-1 text-2xl font-black text-slate-900">
                          {money(usingGeneric ? item.generic.price : item.matchedBrand.price)}
                        </div>
                        <div className="mt-2 text-sm text-slate-600">
                          {usingGeneric ? "Generic selected" : "Brand retained"}
                        </div>
                        {totalSavings > 0 && (
                          <div className="mt-2 rounded-2xl bg-emerald-100 px-3 py-2 text-sm font-black text-emerald-800">
                            Saving {money(totalSavings)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex justify-end">
              <Button
                onClick={() => {
                  setPrescriptionPreviewOpen(false);
                  pushSnackbar("Prescription preview closed", "success");
                }}
                className="rounded-2xl bg-emerald-600 font-black text-white hover:bg-emerald-700"
              >
                Close Preview
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ----------------------- CLINIC CHANGE REQUEST ------------------------ */}
      <Dialog open={clinicChangeOpen} onOpenChange={setClinicChangeOpen}>
        <DialogContent className="max-w-2xl rounded-[30px] border-0 bg-white p-0 shadow-[0_20px_80px_rgba(15,23,42,0.16)]">
          <DialogHeader className="border-b border-slate-100 px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-900">
              <Building2 className="h-5 w-5 text-emerald-700" />
              Request Clinic Change
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-5">
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Changing clinic details requires admin re-verification. Public clinic details should stay read-only until approved.
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>Clinic Name</Label>
                <Input
                  className="mt-2"
                  value={clinicChangeDraft.clinicName}
                  onChange={(e) => setClinicChangeDraft((p) => ({ ...p, clinicName: e.target.value }))}
                />
              </div>
              <div>
                <Label>Clinic Address</Label>
                <Input
                  className="mt-2"
                  value={clinicChangeDraft.addressLine1}
                  onChange={(e) => setClinicChangeDraft((p) => ({ ...p, addressLine1: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label>Locality</Label>
                  <Input
                    className="mt-2"
                    value={clinicChangeDraft.locality}
                    onChange={(e) => setClinicChangeDraft((p) => ({ ...p, locality: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>City</Label>
                  <Input
                    className="mt-2"
                    value={clinicChangeDraft.city}
                    onChange={(e) => setClinicChangeDraft((p) => ({ ...p, city: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>PIN</Label>
                  <Input
                    className="mt-2"
                    value={clinicChangeDraft.pin}
                    onChange={(e) => setClinicChangeDraft((p) => ({ ...p, pin: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Map Label / Exact Location Ref</Label>
                <Input
                  className="mt-2"
                  value={clinicChangeDraft.mapLabel}
                  onChange={(e) => setClinicChangeDraft((p) => ({ ...p, mapLabel: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-100 px-6 py-4">
            <Button variant="outline" className="rounded-2xl border-slate-300 font-black" onClick={() => setClinicChangeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitClinicChangeRequest} className="rounded-2xl bg-emerald-600 font-black text-white hover:bg-emerald-700">
              Submit for Re-verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SNACKBAR */}
      <AnimatePresence>
        {snackbar.open && (
          <motion.div
            initial={{ opacity: 0, y: 16, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 16, x: "-50%" }}
            className={cx(
              "fixed bottom-6 left-1/2 z-[5000] rounded-full px-5 py-3 text-sm font-black shadow-xl",
              snackbar.tone === "error" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
            )}
          >
            {snackbar.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
