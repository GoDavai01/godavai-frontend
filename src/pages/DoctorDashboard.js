import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { AnimatePresence, motion } from "framer-motion";
import { BellRing, Building2, CalendarDays, CheckCheck, ClipboardPlus, FileText, PhoneCall, PhoneOff, RefreshCcw, Save, Settings2, Video, Wallet, XCircle } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Textarea } from "../components/ui/textarea";

dayjs.extend(relativeTime);

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

function authHeaders() {
  const token = localStorage.getItem("doctorToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function money(v) {
  return `Rs ${Number(v || 0).toLocaleString("en-IN")}`;
}

function getBandFromFee(fee) {
  const value = Number(fee || 0);
  if (value <= 500) return { label: "Rs 0-Rs 500", fee: 19 };
  if (value <= 1000) return { label: "Rs 501-Rs 1000", fee: 39 };
  if (value <= 1500) return { label: "Rs 1001-Rs 1500", fee: 59 };
  if (value <= 2000) return { label: "Rs 1501-Rs 2000", fee: 79 };
  return { label: "Rs 2001+", fee: null };
}

function buildSettings(doctor) {
  const clinic = doctor?.clinic || {};
  return {
    online: !!doctor?.online,
    audioEnabled: !!doctor?.modes?.audio,
    videoEnabled: !!doctor?.modes?.video,
    inpersonEnabled: !!doctor?.modes?.inperson,
    audioFee: doctor?.fees?.audio ?? 0,
    videoFee: doctor?.fees?.video ?? 0,
    inpersonFee: doctor?.fees?.inperson ?? 0,
    consultationDays: clinic.consultationDays || [],
    startTime: clinic.startTime || "09:00",
    endTime: clinic.endTime || "13:00",
    slotDuration: clinic.slotDuration || 20,
    arrivalWindow: clinic.arrivalWindow || 20,
    maxPatientsPerDay: clinic.maxPatientsPerDay || 24,
  };
}

function buildClinicDraft(doctor) {
  return {
    clinicName: doctor?.clinic?.name || "",
    addressLine1: doctor?.clinic?.addressLine1 || "",
    locality: doctor?.clinic?.locality || "",
    city: doctor?.clinic?.city || "",
    pin: doctor?.clinic?.pin || "",
    mapLabel: doctor?.clinic?.mapLabel || "",
  };
}

function mapCartPreview(cartDraft) {
  return Array.isArray(cartDraft?.items)
    ? cartDraft.items.map((item) => ({
        id: item._id || item.id,
        prescribed: item.prescribedMedicine || item.prescribed || "Medicine",
        matchedBrand: item.matchedBrand || { name: "Not mapped", price: 0 },
        generic: { ...(item.generic || { name: "No generic mapped", price: 0 }), available: !!item.genericAvailable, savings: Number(item.savings || 0) },
        requiresReview: !!item.requiresReview,
      }))
    : [];
}

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [doctor, setDoctor] = useState(null);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [upcomingConsults, setUpcomingConsults] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [recentPrescriptions, setRecentPrescriptions] = useState([]);
  const [clinicChangeRequest, setClinicChangeRequest] = useState(null);
  const [settingsDraft, setSettingsDraft] = useState(buildSettings(null));
  const [clinicChangeDraft, setClinicChangeDraft] = useState(buildClinicDraft(null));
  const [snackbar, setSnackbar] = useState({ open: false, message: "", tone: "success" });
  const [callOpen, setCallOpen] = useState(false);
  const [callSession, setCallSession] = useState(null);
  const [callNotes, setCallNotes] = useState("");
  const [callSeconds, setCallSeconds] = useState(0);
  const [prescriptionOpen, setPrescriptionOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [prescriptionForm, setPrescriptionForm] = useState({ diagnosis: "", complaint: "", precautions: "", testsAdvised: "", followUpDate: "", medicines: [{ prescribed: "", salt: "", dosage: "", frequency: "", duration: "", howToTake: "", notes: "" }] });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cartPreview, setCartPreview] = useState([]);
  const [clinicOpen, setClinicOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDraft, setRescheduleDraft] = useState({ date: dayjs().add(1, "day").format("YYYY-MM-DD"), slot: "10:00", mode: "video" });

  const unreadCount = useMemo(() => notifications.filter((x) => !x.read).length, [notifications]);
  const currentBand = useMemo(() => {
    const fees = [];
    if (settingsDraft.audioEnabled) fees.push(Number(settingsDraft.audioFee || 0));
    if (settingsDraft.videoEnabled) fees.push(Number(settingsDraft.videoFee || 0));
    if (settingsDraft.inpersonEnabled) fees.push(Number(settingsDraft.inpersonFee || 0));
    return fees.length ? getBandFromFee(Math.max(...fees)) : doctor?.platformBand || getBandFromFee(0);
  }, [settingsDraft, doctor]);

  const handleAuthFailure = useCallback(() => {
    localStorage.removeItem("doctorToken");
    localStorage.removeItem("doctorCurrentId");
    navigate("/doctor/login", { replace: true });
  }, [navigate]);

  const applyDashboard = useCallback((payload) => {
    const nextDoctor = payload?.doctor || null;
    setDoctor(nextDoctor);
    setIncomingRequests(Array.isArray(payload?.incomingRequests) ? payload.incomingRequests : []);
    setUpcomingConsults(Array.isArray(payload?.upcomingConsults) ? payload.upcomingConsults : []);
    setNotifications(Array.isArray(payload?.notifications) ? payload.notifications : []);
    setClinicChangeRequest(payload?.clinicChangeRequest || null);
    if (nextDoctor) {
      setSettingsDraft(buildSettings(nextDoctor));
      setClinicChangeDraft(buildClinicDraft(nextDoctor));
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    const token = localStorage.getItem("doctorToken");
    if (!token) return handleAuthFailure();
    setLoading(true);
    setError("");
    try {
      const [dashboardRes, recentRes] = await Promise.all([
        axios.get(`${API}/api/doctors/dashboard/self`, { headers: authHeaders() }),
        axios.get(`${API}/api/prescriptions/doctor/recent`, { headers: authHeaders() }),
      ]);
      applyDashboard(dashboardRes.data);
      setRecentPrescriptions(Array.isArray(recentRes?.data?.prescriptions) ? recentRes.data.prescriptions : []);
    } catch (err) {
      if ([401, 403].includes(err?.response?.status)) return handleAuthFailure();
      setError(err?.response?.data?.error || "Failed to load doctor dashboard");
    } finally {
      setLoading(false);
    }
  }, [applyDashboard, handleAuthFailure]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { const id = setInterval(() => loadDashboard(), 30000); return () => clearInterval(id); }, [loadDashboard]);
  useEffect(() => { if (!callOpen) { if (timerRef.current) clearInterval(timerRef.current); setCallSeconds(0); return undefined; } timerRef.current = setInterval(() => setCallSeconds((v) => v + 1), 1000); return () => timerRef.current && clearInterval(timerRef.current); }, [callOpen]);
  useEffect(() => { const timeout = setTimeout(() => snackbar.open && setSnackbar((s) => ({ ...s, open: false })), 2200); return () => clearTimeout(timeout); }, [snackbar]);

  async function saveSettings() {
    setSaving(true);
    setError("");
    try {
      const payload = {
        online: settingsDraft.online,
        modes: { audio: settingsDraft.audioEnabled, video: settingsDraft.videoEnabled, inperson: settingsDraft.inpersonEnabled },
        fees: {
          audio: settingsDraft.audioEnabled ? Number(settingsDraft.audioFee || 0) : 0,
          video: settingsDraft.videoEnabled ? Number(settingsDraft.videoFee || 0) : 0,
          inperson: settingsDraft.inpersonEnabled ? Number(settingsDraft.inpersonFee || 0) : 0,
        },
        availability: {
          consultationDays: settingsDraft.inpersonEnabled ? settingsDraft.consultationDays : [],
          startTime: settingsDraft.inpersonEnabled ? settingsDraft.startTime : "",
          endTime: settingsDraft.inpersonEnabled ? settingsDraft.endTime : "",
          slotDuration: settingsDraft.inpersonEnabled ? Number(settingsDraft.slotDuration || 20) : 0,
          arrivalWindow: settingsDraft.inpersonEnabled ? Number(settingsDraft.arrivalWindow || 20) : 0,
          maxPatientsPerDay: settingsDraft.inpersonEnabled ? Number(settingsDraft.maxPatientsPerDay || 24) : 0,
        },
      };
      const res = await axios.patch(`${API}/api/doctors/dashboard/settings`, payload, { headers: authHeaders() });
      applyDashboard(res.data);
      setSnackbar({ open: true, message: "Doctor settings saved", tone: "success" });
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function acceptRequest(row) {
    try {
      await axios.post(`${API}/api/consults/${row._id}/accept`, {}, { headers: authHeaders() });
      await loadDashboard();
      setSnackbar({ open: true, message: `Accepted ${row.patientName}`, tone: "success" });
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to accept request");
    }
  }

  async function rejectRequest(row) {
    const reason = window.prompt(`Reason for rejecting ${row.patientName}?`, "Declined by doctor");
    if (reason === null) return;
    try {
      await axios.post(`${API}/api/consults/${row._id}/reject`, { reason }, { headers: authHeaders() });
      await loadDashboard();
      setSnackbar({ open: true, message: `Rejected ${row.patientName}`, tone: "error" });
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to reject request");
    }
  }

  function openReschedule(row) {
    setRescheduleTarget(row);
    setRescheduleDraft({ date: row?.bookedFor ? dayjs(row.bookedFor).format("YYYY-MM-DD") : dayjs().add(1, "day").format("YYYY-MM-DD"), slot: row?.bookedFor ? dayjs(row.bookedFor).format("HH:mm") : "10:00", mode: row?.mode || "video" });
    setRescheduleOpen(true);
  }

  async function submitReschedule() {
    if (!rescheduleTarget) return;
    try {
      await axios.patch(`${API}/api/consults/${rescheduleTarget._id}/reschedule`, rescheduleDraft, { headers: authHeaders() });
      setRescheduleOpen(false);
      await loadDashboard();
      setSnackbar({ open: true, message: "Consult rescheduled", tone: "success" });
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to reschedule consult");
    }
  }

  async function joinConsult(row) {
    try {
      const res = await axios.post(`${API}/api/consults/${row._id}/session/join`, {}, { headers: authHeaders() });
      setCallSession(res?.data?.dashboardConsult || row);
      setCallNotes(res?.data?.session?.doctorNotes || "");
      setCallOpen(true);
      await loadDashboard();
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to join consult");
    }
  }

  async function endConsult() {
    if (!callSession?._id) return;
    try {
      if (callNotes.trim()) await axios.patch(`${API}/api/consults/${callSession._id}/session/notes`, { notes: callNotes }, { headers: authHeaders() });
      await axios.post(`${API}/api/consults/${callSession._id}/session/end`, {}, { headers: authHeaders() });
      setCallOpen(false);
      await loadDashboard();
      setSnackbar({ open: true, message: "Consult ended", tone: "success" });
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to end consult");
    }
  }

  async function saveCallNotes() {
    if (!callSession?._id) return;
    try {
      await axios.patch(`${API}/api/consults/${callSession._id}/session/notes`, { notes: callNotes }, { headers: authHeaders() });
      setSnackbar({ open: true, message: "Notes saved", tone: "success" });
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to save notes");
    }
  }

  function openPrescription(booking) {
    setSelectedBooking(booking);
    setPrescriptionForm({ diagnosis: "", complaint: booking?.reason || booking?.symptoms || "", precautions: "", testsAdvised: "", followUpDate: "", medicines: [{ prescribed: "", salt: "", dosage: "", frequency: "", duration: "", howToTake: "", notes: "" }] });
    setPrescriptionOpen(true);
  }

  function updateMedicine(index, key, value) {
    setPrescriptionForm((prev) => ({ ...prev, medicines: prev.medicines.map((row, i) => i === index ? { ...row, [key]: value } : row) }));
  }

  async function submitPrescription() {
    if (!selectedBooking?._id) return setError("Select a booking first");
    try {
      const res = await axios.post(`${API}/api/prescriptions/doctor`, { bookingId: selectedBooking._id, ...prescriptionForm }, { headers: authHeaders() });
      setCartPreview(mapCartPreview(res?.data?.cartDraft));
      setPrescriptionOpen(false);
      setPreviewOpen(true);
      await loadDashboard();
      setSnackbar({ open: true, message: "Prescription created", tone: "success" });
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to create prescription");
    }
  }

  async function submitClinicChange() {
    try {
      const payload = { ...clinicChangeDraft, consultationDays: settingsDraft.consultationDays, startTime: settingsDraft.startTime, endTime: settingsDraft.endTime, slotDuration: Number(settingsDraft.slotDuration || 20), arrivalWindow: Number(settingsDraft.arrivalWindow || 20), maxPatientsPerDay: Number(settingsDraft.maxPatientsPerDay || 24) };
      const res = await axios.post(`${API}/api/doctors/clinic-change-requests`, payload, { headers: authHeaders() });
      setClinicChangeRequest(res?.data?.request || null);
      setClinicOpen(false);
      setSnackbar({ open: true, message: "Clinic change request submitted", tone: "success" });
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to submit clinic change request");
    }
  }

  async function markRead(id) {
    try {
      await axios.patch(`${API}/api/doctors/me/notifications/${id}/read`, {}, { headers: authHeaders() });
      setNotifications((rows) => rows.map((row) => String(row._id) === String(id) ? { ...row, read: true } : row));
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to mark notification read");
    }
  }

  if (loading) return <div className="p-10 text-center text-slate-600">Loading doctor dashboard...</div>;
  if (!doctor) return <div className="p-10 text-center text-slate-600">Doctor session missing.</div>;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto grid max-w-7xl gap-4">
        <section className="rounded-3xl bg-emerald-900 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-3xl font-black">{doctor.fullName}</div>
              <div className="mt-1 text-sm text-emerald-100">{doctor.specialty} • {doctor.qualification} • {doctor.city}, {doctor.area}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <Badge className="bg-white/10 text-white">{doctor.profileStatus}</Badge>
                <Badge className="bg-white/10 text-white">Band: {currentBand.label}</Badge>
                <Badge className="bg-white/10 text-white">{currentBand.fee == null ? "Manual approval" : `${money(currentBand.fee)} + GST`}</Badge>
                <Badge className="bg-white/10 text-white">Payout: {doctor.payoutAccountMasked || "Not added"}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="border-white/30 bg-white/10 text-white" onClick={loadDashboard}>Refresh</Button>
              <Button variant="outline" className="border-white/30 bg-white/10 text-white" onClick={() => { localStorage.removeItem("doctorToken"); navigate("/doctor/login", { replace: true }); }}>Logout</Button>
            </div>
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-4 shadow-sm"><div className="text-xs uppercase text-slate-500">Incoming Requests</div><div className="mt-2 text-3xl font-black text-slate-900">{incomingRequests.length}</div></div>
              <div className="rounded-2xl bg-white p-4 shadow-sm"><div className="text-xs uppercase text-slate-500">Upcoming</div><div className="mt-2 text-3xl font-black text-slate-900">{upcomingConsults.length}</div></div>
              <div className="rounded-2xl bg-white p-4 shadow-sm"><div className="text-xs uppercase text-slate-500">Unread</div><div className="mt-2 text-3xl font-black text-slate-900">{unreadCount}</div></div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-lg font-black text-slate-900"><BellRing className="h-5 w-5 text-emerald-700" />Incoming Requests</div>
              {!incomingRequests.length ? <div className="text-sm text-slate-500">No pending requests.</div> : <div className="space-y-3">{incomingRequests.map((row) => (
                <div key={row._id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><div className="text-lg font-black text-slate-900">{row.patientName}</div><Badge>{row.mode}</Badge><Badge>{row.status}</Badge></div><div className="mt-1 text-sm text-slate-600">{row.patientAge ?? "-"} yrs • {row.patientGender || "-"} • {dayjs(row.bookedFor).format("DD MMM hh:mm A")} • {money(row.fee)}</div><div className="mt-2 text-sm text-slate-700">{row.symptoms || row.reason || "-"}</div></div><div className="flex flex-wrap gap-2"><Button onClick={() => acceptRequest(row)}><CheckCheck className="mr-2 h-4 w-4" />Accept</Button><Button variant="outline" onClick={() => openReschedule(row)}><RefreshCcw className="mr-2 h-4 w-4" />Reschedule</Button><Button variant="outline" onClick={() => rejectRequest(row)} className="border-rose-300 text-rose-700"><XCircle className="mr-2 h-4 w-4" />Reject</Button></div></div></div>
              ))}</div>}
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-lg font-black text-slate-900"><CalendarDays className="h-5 w-5 text-emerald-700" />Upcoming Consults</div>
              {!upcomingConsults.length ? <div className="text-sm text-slate-500">No upcoming consults.</div> : <div className="space-y-3">{upcomingConsults.map((row) => (
                <div key={row._id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><div className="text-lg font-black text-slate-900">{row.patientName}</div><Badge>{row.mode}</Badge><Badge>{row.status}</Badge></div><div className="mt-1 text-sm text-slate-600">{dayjs(row.bookedFor).format("DD MMM hh:mm A")} • {money(row.fee)}</div><div className="mt-2 text-sm text-slate-700">{row.reason || row.symptoms || "-"}</div></div><div className="flex flex-wrap gap-2">{(row.mode === "video" || row.mode === "audio") ? <Button onClick={() => joinConsult(row)}>{row.mode === "video" ? <Video className="mr-2 h-4 w-4" /> : <PhoneCall className="mr-2 h-4 w-4" />}{row.canJoin ? "Join Now" : "Open Room"}</Button> : <Button variant="outline"><Building2 className="mr-2 h-4 w-4" />In-person</Button>}<Button variant="outline" onClick={() => openPrescription(row)}><ClipboardPlus className="mr-2 h-4 w-4" />Prescription</Button></div></div></div>
              ))}</div>}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-lg font-black text-slate-900"><Settings2 className="h-5 w-5 text-emerald-700" />Doctor Settings</div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-3"><span className="font-bold text-slate-700">Online</span><Switch checked={settingsDraft.online} onCheckedChange={(next) => setSettingsDraft((prev) => ({ ...prev, online: next }))} /></div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 p-3"><div className="flex items-center justify-between"><span className="font-bold">Audio</span><Switch checked={settingsDraft.audioEnabled} onCheckedChange={(next) => setSettingsDraft((prev) => ({ ...prev, audioEnabled: next, audioFee: next ? prev.audioFee || 299 : 0 }))} /></div><Input className="mt-3" type="number" value={settingsDraft.audioFee} onChange={(e) => setSettingsDraft((prev) => ({ ...prev, audioFee: e.target.value }))} /></div>
                  <div className="rounded-2xl border border-slate-200 p-3"><div className="flex items-center justify-between"><span className="font-bold">Video</span><Switch checked={settingsDraft.videoEnabled} onCheckedChange={(next) => setSettingsDraft((prev) => ({ ...prev, videoEnabled: next, videoFee: next ? prev.videoFee || 299 : 0 }))} /></div><Input className="mt-3" type="number" value={settingsDraft.videoFee} onChange={(e) => setSettingsDraft((prev) => ({ ...prev, videoFee: e.target.value }))} /></div>
                  <div className="rounded-2xl border border-slate-200 p-3"><div className="flex items-center justify-between"><span className="font-bold">In-person</span><Switch checked={settingsDraft.inpersonEnabled} onCheckedChange={(next) => setSettingsDraft((prev) => ({ ...prev, inpersonEnabled: next, inpersonFee: next ? prev.inpersonFee || 399 : 0 }))} /></div><Input className="mt-3" type="number" value={settingsDraft.inpersonFee} onChange={(e) => setSettingsDraft((prev) => ({ ...prev, inpersonFee: e.target.value }))} /></div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input type="time" value={settingsDraft.startTime} onChange={(e) => setSettingsDraft((prev) => ({ ...prev, startTime: e.target.value }))} />
                  <Input type="time" value={settingsDraft.endTime} onChange={(e) => setSettingsDraft((prev) => ({ ...prev, endTime: e.target.value }))} />
                  <Input type="number" value={settingsDraft.slotDuration} onChange={(e) => setSettingsDraft((prev) => ({ ...prev, slotDuration: e.target.value }))} placeholder="Slot duration" />
                  <Input type="number" value={settingsDraft.arrivalWindow} onChange={(e) => setSettingsDraft((prev) => ({ ...prev, arrivalWindow: e.target.value }))} placeholder="Arrival window" />
                  <Input type="number" value={settingsDraft.maxPatientsPerDay} onChange={(e) => setSettingsDraft((prev) => ({ ...prev, maxPatientsPerDay: e.target.value }))} placeholder="Max patients/day" />
                  <Input value={settingsDraft.consultationDays.join(",")} onChange={(e) => setSettingsDraft((prev) => ({ ...prev, consultationDays: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }))} placeholder="Mon,Tue,Wed" />
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">Current band: <span className="font-black">{currentBand.label}</span>{currentBand.fee == null ? " • Manual approval required" : ` • ${money(currentBand.fee)} + GST`}</div>
                <Button onClick={saveSettings} disabled={saving} className="w-full"><Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save Settings"}</Button>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-lg font-black text-slate-900"><BellRing className="h-5 w-5 text-emerald-700" />Notifications</div>
              <div className="space-y-2">{notifications.length ? notifications.map((row) => <button key={row._id} type="button" onClick={() => markRead(row._id)} className={`w-full rounded-2xl border p-3 text-left ${row.read ? "border-slate-200 bg-white" : "border-emerald-200 bg-emerald-50"}`}><div className="font-bold text-slate-900">{row.title}</div><div className="mt-1 text-sm text-slate-600">{row.body || row.message}</div></button>) : <div className="text-sm text-slate-500">No notifications.</div>}</div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-lg font-black text-slate-900"><FileText className="h-5 w-5 text-emerald-700" />Recent Prescriptions</div>
              <div className="space-y-2">{recentPrescriptions.length ? recentPrescriptions.map((row) => <div key={row._id} className="rounded-2xl border border-slate-200 p-3"><div className="font-bold text-slate-900">{row.patientName}</div><div className="text-sm text-slate-600">{row.diagnosis}</div><div className="mt-1 text-xs text-slate-500">{dayjs(row.createdAt).format("DD MMM hh:mm A")} • {row.meds} medicines</div></div>) : <div className="text-sm text-slate-500">No prescriptions yet.</div>}</div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-2 text-lg font-black text-slate-900">Verified Clinic</div>
              <div className="text-sm text-slate-700">{doctor.clinic?.name || "Clinic not added"}</div>
              <div className="mt-1 text-sm text-slate-600">{doctor.clinic?.addressLine1 || "-"}, {doctor.clinic?.locality || "-"}, {doctor.clinic?.city || "-"}</div>
              {clinicChangeRequest ? <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Latest request: <span className="font-black capitalize">{clinicChangeRequest.status?.replaceAll("_", " ")}</span></div> : null}
              <Button variant="outline" className="mt-3 w-full" onClick={() => setClinicOpen(true)}>Request Clinic Change</Button>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-lg font-black text-slate-900"><Wallet className="h-5 w-5 text-emerald-700" />Patient Cart Preview</div>
              {!cartPreview.length ? <div className="text-sm text-slate-500">Create a prescription to preview mapped medicines and savings.</div> : cartPreview.map((item) => <div key={item.id} className="mb-3 rounded-2xl border border-slate-200 p-3"><div className="font-bold text-slate-900">{item.prescribed}</div><div className="mt-1 text-sm text-slate-600">Brand: {item.matchedBrand.name}</div>{item.generic.available ? <div className="mt-1 text-sm text-emerald-700">Generic: {item.generic.name} • Save {money(item.generic.savings)}</div> : <div className="mt-1 text-sm text-slate-500">No generic mapped</div>}{item.requiresReview ? <div className="mt-1 text-xs text-amber-700">Sensitive medicine review required</div> : null}</div>)}
            </div>
          </div>
        </section>
      </div>

      <Dialog open={callOpen} onOpenChange={setCallOpen}>
        <DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Consult Room</DialogTitle></DialogHeader><div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]"><div className="rounded-2xl bg-slate-900 p-8 text-center text-white"><div className="text-lg font-black">{callSession?.patientName}</div><div className="mt-2 text-sm text-slate-300">{callSession?.mode === "video" ? "Video consult" : "Audio consult"} • {String(Math.floor(callSeconds / 60)).padStart(2, "0")}:{String(callSeconds % 60).padStart(2, "0")}</div></div><div className="space-y-3"><div className="rounded-2xl border border-slate-200 p-3 text-sm text-slate-700">{callSession?.reason || callSession?.symptoms || "-"}</div><Textarea rows={10} value={callNotes} onChange={(e) => setCallNotes(e.target.value)} placeholder="Clinical notes..." /><div className="grid gap-2"><Button onClick={saveCallNotes}>Save Notes</Button><Button variant="outline" onClick={() => { setCallOpen(false); openPrescription(callSession); }}><ClipboardPlus className="mr-2 h-4 w-4" />Open Prescription</Button><Button variant="destructive" onClick={endConsult}><PhoneOff className="mr-2 h-4 w-4" />End Consult</Button></div></div></div></DialogContent>
      </Dialog>

      <Dialog open={prescriptionOpen} onOpenChange={setPrescriptionOpen}>
        <DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>Create Prescription</DialogTitle></DialogHeader><div className="grid gap-4 lg:grid-cols-2"><div className="space-y-3"><Input value={prescriptionForm.complaint} onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, complaint: e.target.value }))} placeholder="Complaint / visit reason" /><Textarea value={prescriptionForm.diagnosis} onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, diagnosis: e.target.value }))} placeholder="Diagnosis" /><Textarea value={prescriptionForm.precautions} onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, precautions: e.target.value }))} placeholder="Precautions / advice" /><Textarea value={prescriptionForm.testsAdvised} onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, testsAdvised: e.target.value }))} placeholder="Tests advised" /><Input type="date" value={prescriptionForm.followUpDate} onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, followUpDate: e.target.value }))} /></div><div className="space-y-3">{prescriptionForm.medicines.map((med, index) => <div key={index} className="rounded-2xl border border-slate-200 p-3"><div className="mb-2 font-bold text-slate-900">Medicine #{index + 1}</div><div className="grid gap-2"><Input value={med.prescribed} onChange={(e) => updateMedicine(index, "prescribed", e.target.value)} placeholder="Medicine name" /><Input value={med.salt} onChange={(e) => updateMedicine(index, "salt", e.target.value)} placeholder="Salt / composition" /><div className="grid grid-cols-2 gap-2"><Input value={med.dosage} onChange={(e) => updateMedicine(index, "dosage", e.target.value)} placeholder="Dosage" /><Input value={med.frequency} onChange={(e) => updateMedicine(index, "frequency", e.target.value)} placeholder="Frequency" /></div><div className="grid grid-cols-2 gap-2"><Input value={med.duration} onChange={(e) => updateMedicine(index, "duration", e.target.value)} placeholder="Duration" /><Input value={med.howToTake} onChange={(e) => updateMedicine(index, "howToTake", e.target.value)} placeholder="How to take" /></div><Input value={med.notes} onChange={(e) => updateMedicine(index, "notes", e.target.value)} placeholder="Notes" /></div></div>)}<Button variant="outline" onClick={() => setPrescriptionForm((prev) => ({ ...prev, medicines: [...prev.medicines, { prescribed: "", salt: "", dosage: "", frequency: "", duration: "", howToTake: "", notes: "" }] }))}>Add Medicine</Button></div></div><DialogFooter><Button variant="outline" onClick={() => setPrescriptionOpen(false)}>Cancel</Button><Button onClick={submitPrescription}>Generate Prescription & Cart Preview</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>Patient Cart Preview</DialogTitle></DialogHeader><div className="space-y-3">{cartPreview.map((item) => <div key={item.id} className="rounded-2xl border border-slate-200 p-3"><div className="font-bold text-slate-900">{item.prescribed}</div><div className="mt-1 text-sm text-slate-600">Brand: {item.matchedBrand.name}</div>{item.generic.available ? <div className="mt-1 text-sm text-emerald-700">Generic: {item.generic.name} • Save {money(item.generic.savings)}</div> : <div className="mt-1 text-sm text-slate-500">No generic mapped</div>}</div>)}</div></DialogContent>
      </Dialog>

      <Dialog open={clinicOpen} onOpenChange={setClinicOpen}>
        <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Request Clinic Change</DialogTitle></DialogHeader><div className="grid gap-3"><Input value={clinicChangeDraft.clinicName} onChange={(e) => setClinicChangeDraft((prev) => ({ ...prev, clinicName: e.target.value }))} placeholder="Clinic name" /><Input value={clinicChangeDraft.addressLine1} onChange={(e) => setClinicChangeDraft((prev) => ({ ...prev, addressLine1: e.target.value }))} placeholder="Clinic address" /><div className="grid grid-cols-3 gap-2"><Input value={clinicChangeDraft.locality} onChange={(e) => setClinicChangeDraft((prev) => ({ ...prev, locality: e.target.value }))} placeholder="Locality" /><Input value={clinicChangeDraft.city} onChange={(e) => setClinicChangeDraft((prev) => ({ ...prev, city: e.target.value }))} placeholder="City" /><Input value={clinicChangeDraft.pin} onChange={(e) => setClinicChangeDraft((prev) => ({ ...prev, pin: e.target.value }))} placeholder="PIN" /></div><Input value={clinicChangeDraft.mapLabel} onChange={(e) => setClinicChangeDraft((prev) => ({ ...prev, mapLabel: e.target.value }))} placeholder="Map label" /></div><DialogFooter><Button variant="outline" onClick={() => setClinicOpen(false)}>Cancel</Button><Button onClick={submitClinicChange}>Submit</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Reschedule Consultation</DialogTitle></DialogHeader><div className="grid gap-3"><Input type="date" value={rescheduleDraft.date} onChange={(e) => setRescheduleDraft((prev) => ({ ...prev, date: e.target.value }))} /><Input type="time" value={rescheduleDraft.slot} onChange={(e) => setRescheduleDraft((prev) => ({ ...prev, slot: e.target.value }))} /><Input value={rescheduleDraft.mode} onChange={(e) => setRescheduleDraft((prev) => ({ ...prev, mode: e.target.value }))} placeholder="video / audio / inperson" /></div><DialogFooter><Button variant="outline" onClick={() => setRescheduleOpen(false)}>Cancel</Button><Button onClick={submitReschedule}>Save New Slot</Button></DialogFooter></DialogContent>
      </Dialog>

      <AnimatePresence>
        {snackbar.open ? <motion.div initial={{ opacity: 0, y: 16, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 16, x: "-50%" }} className={`fixed bottom-6 left-1/2 z-[5000] rounded-full px-5 py-3 text-sm font-black shadow-xl ${snackbar.tone === "error" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"}`}>{snackbar.message}</motion.div> : null}
      </AnimatePresence>
    </div>
  );
}

