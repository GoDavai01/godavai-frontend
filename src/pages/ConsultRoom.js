import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  MessageCircle,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  ShieldCheck,
  Stethoscope,
  Upload,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { readStoredConsultBookings, upsertStoredConsultBooking } from "../utils/consultBookings";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const JITSI_SCRIPT_SRC = "https://meet.jit.si/external_api.js";
const REPORT_ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf";

function normalizeMode(mode) {
  const value = String(mode || "").toLowerCase().trim();
  if (value === "call" || value === "audio") return "call";
  if (value === "inperson" || value === "in-person") return "inperson";
  return "video";
}

function normalizeConsult(raw = {}) {
  const id = String(raw?.id || raw?._id || raw?.bookingId || "");
  const prescription = raw?.prescription || {};
  return {
    ...raw,
    id,
    bookingId: String(raw?.bookingId || id),
    doctorId: String(raw?.doctorId || ""),
    mode: normalizeMode(raw?.mode),
    consultRoomId: raw?.consultRoomId || "",
    doctorName: raw?.doctorName || raw?.doctor || "Doctor",
    patientName: raw?.patientName || "Patient",
    specialty: raw?.specialty || "General physician",
    reason: raw?.reason || raw?.symptoms || "General consultation",
    symptoms: raw?.symptoms || "",
    patientSummary: raw?.patientSummary || "",
    date: raw?.date || "",
    dateLabel: raw?.dateLabel || raw?.date || "",
    slot: raw?.slot || "",
    fee: Number(raw?.fee || 0),
    paymentStatus: raw?.paymentStatus || "pending",
    refundStatus: raw?.refundStatus || "none",
    status: raw?.status || "pending",
    callState: raw?.callState || "not_started",
    patientAttachments: Array.isArray(raw?.patientAttachments) ? raw.patientAttachments : [],
    doctorAction: raw?.doctorAction || "none",
    doctorNotes: raw?.doctorNotes || "",
    rescheduledAt: raw?.rescheduledAt || null,
    prescription: {
      fileUrl: prescription?.fileUrl || "",
      fileName: prescription?.fileName || "",
      notes: prescription?.notes || "",
      uploadedAt: prescription?.uploadedAt || null,
    },
  };
}

function normalizeMessage(raw = {}) {
  return {
    id: String(raw?.id || raw?._id || ""),
    senderRole: raw?.senderRole || "system",
    senderName: raw?.senderName || "Care team",
    kind: raw?.kind || "message",
    text: raw?.text || "",
    attachments: Array.isArray(raw?.attachments) ? raw.attachments : [],
    createdAt: raw?.createdAt || raw?.updatedAt || null,
  };
}

function mergeMessage(list = [], nextMessage = null) {
  const normalized = normalizeMessage(nextMessage || {});
  if (!normalized.id) return list;
  const exists = list.some((item) => item.id === normalized.id);
  if (exists) return list.map((item) => (item.id === normalized.id ? normalized : item));
  return [...list, normalized];
}

function getRoleLabel(role) {
  return role === "doctor" ? "Doctor Console" : "Patient Consult";
}

function getBackPath(role) {
  return role === "doctor" ? "/doctor/dashboard" : "/doctors";
}

function getUserHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getDoctorAuthConfig() {
  const token = localStorage.getItem("doctorToken") || "";
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

function getActorAuthConfig(role) {
  return role === "doctor" ? getDoctorAuthConfig() : { headers: getUserHeaders() };
}

function ensureJitsiScript() {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.JitsiMeetExternalAPI) {
      resolve(window.JitsiMeetExternalAPI);
      return;
    }

    const existing = document.querySelector(`script[src="${JITSI_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.JitsiMeetExternalAPI), { once: true });
      existing.addEventListener("error", () => reject(new Error("Jitsi script failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = JITSI_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(window.JitsiMeetExternalAPI);
    script.onerror = () => reject(new Error("Jitsi script failed to load"));
    document.body.appendChild(script);
  });
}

function formatSchedule(consult) {
  if (!consult) return "Schedule unavailable";
  const dateLabel = consult.dateLabel || consult.date || "";
  return `${dateLabel}${consult.slot ? `, ${consult.slot}` : ""}`.trim() || "Schedule unavailable";
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatFileSize(value) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function getComposerOptions(role) {
  return role === "doctor"
    ? [
        { value: "message", label: "Chat" },
        { value: "report", label: "Files" },
      ]
    : [
        { value: "message", label: "Chat" },
        { value: "symptom", label: "Symptoms" },
        { value: "report", label: "Reports" },
      ];
}

function getComposerPlaceholder(kind, role) {
  if (kind === "symptom") return "Tell the doctor what you are feeling, when it started, and what makes it worse or better.";
  if (kind === "report") return role === "doctor" ? "Share a care file or follow-up report." : "Add a note about the report you are uploading.";
  return role === "doctor"
    ? "Send a consult update, care instruction, or follow-up message."
    : "Message the doctor about symptoms, medicines, or questions.";
}

function buildStatusPill(consult) {
  const status = String(consult?.status || "").toLowerCase();
  if (status === "live_now") return { label: "Live now", bg: "#dcfce7", color: "#166534" };
  if (status === "upcoming" || status === "accepted") return { label: "Join ready", bg: "#dbeafe", color: "#1d4ed8" };
  if (status === "completed") return { label: "Completed", bg: "#ede9fe", color: "#5b21b6" };
  if (status === "rejected" || status === "cancelled") return { label: "Closed", bg: "#fee2e2", color: "#991b1b" };
  return { label: status || "Consult", bg: "#e2e8f0", color: "#334155" };
}

function upsertLocalConsult(role, consult) {
  if (role !== "patient" || !consult) return;
  upsertStoredConsultBooking({
    ...consult,
    id: consult.id || consult.bookingId,
    bookingId: consult.bookingId || consult.id,
  });
}

export default function ConsultRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const { consultId } = useParams();
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") === "doctor" ? "doctor" : "patient";
  const openChatFirst = searchParams.get("panel") === "chat" || !!location.state?.focusChat;
  const initialConsult = location.state?.consult ? normalizeConsult(location.state.consult) : null;
  const initialSession = location.state?.session || null;
  const initialConsultRef = useRef(initialConsult);
  const initialSessionRef = useRef(initialSession);
  const initialDoctorDisplayNameRef = useRef(
    String(location.state?.displayName || initialConsultRef.current?.doctorName || "Doctor")
  );

  const [consult, setConsult] = useState(initialConsultRef.current);
  const [sessionInfo, setSessionInfo] = useState(initialSessionRef.current);
  const [activePanel, setActivePanel] = useState(openChatFirst ? "chat" : "care");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [meetingReady, setMeetingReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1080 : false
  );
  const [controls, setControls] = useState({
    micOn: true,
    camOn: normalizeMode(initialConsultRef.current?.mode) === "video",
  });
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [chatError, setChatError] = useState("");
  const [composerKind, setComposerKind] = useState(role === "patient" ? "symptom" : "message");
  const [composerText, setComposerText] = useState("");
  const [composerFiles, setComposerFiles] = useState([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesFeedback, setNotesFeedback] = useState("");
  const [prescriptionFile, setPrescriptionFile] = useState(null);
  const [prescriptionNote, setPrescriptionNote] = useState("");
  const [uploadingPrescription, setUploadingPrescription] = useState(false);
  const [prescriptionFeedback, setPrescriptionFeedback] = useState("");

  const containerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const chatEndRef = useRef(null);
  const composerFileRef = useRef(null);
  const prescriptionFileRef = useRef(null);

  useEffect(() => {
    function onResize() {
      setIsCompact(window.innerWidth < 1080);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const roomName = useMemo(() => {
    const normalized = consult ? normalizeConsult(consult) : null;
    return sessionInfo?.roomId || normalized?.consultRoomId || (consultId ? `consult_${String(consultId).slice(-8)}` : "");
  }, [consult, consultId, sessionInfo]);

  const statusPill = useMemo(() => buildStatusPill(consult), [consult]);
  const counterpartName = role === "doctor" ? consult?.patientName || "Patient" : consult?.doctorName || "Doctor";
  const sharedRecords = useMemo(() => {
    const consultFiles = Array.isArray(consult?.patientAttachments) ? consult.patientAttachments : [];
    const messageFiles = messages.flatMap((message) =>
      Array.isArray(message?.attachments) ? message.attachments : []
    );
    const seen = new Set();

    return [...consultFiles, ...messageFiles].filter((file) => {
      const key = `${String(file?.url || "").trim()}|${String(file?.fileName || "").trim()}`;
      if (key === "|") return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [consult?.patientAttachments, messages]);

  useEffect(() => {
    let active = true;

    async function bootstrapRoom() {
      setLoading(true);
      setError("");
      try {
        let nextConsult = initialConsultRef.current;
        let nextSession = initialSessionRef.current;

        if (role === "doctor") {
          const { data } = await axios.post(`${API}/api/consults/${consultId}/session/join`, {}, getDoctorAuthConfig());
          nextConsult = normalizeConsult(data?.dashboardConsult || data?.consult || nextConsult || {});
          nextSession = data?.session || nextSession;
        } else {
          if (!nextConsult) {
            const localMatch = readStoredConsultBookings().find((item) => {
              const normalized = normalizeConsult(item);
              return normalized.id === String(consultId) || normalized.bookingId === String(consultId);
            });
            if (localMatch) nextConsult = normalizeConsult(localMatch);
          }

          if (!nextConsult && localStorage.getItem("token")) {
            const { data } = await axios.get(`${API}/api/consults/my`, { headers: getUserHeaders() });
            const matched = (Array.isArray(data?.consults) ? data.consults : []).find((item) => {
              const normalized = normalizeConsult(item);
              return normalized.id === String(consultId) || normalized.bookingId === String(consultId);
            });
            if (matched) nextConsult = normalizeConsult(matched);
          }

          if (!nextConsult) throw new Error("Consult details are not available for this room");

          const syncPayload = {
            bookingId: nextConsult.id || nextConsult.bookingId,
            paymentRef: nextConsult.paymentRef || "",
            doctorId: nextConsult.doctorId || "",
            date: nextConsult.date || "",
            slot: nextConsult.slot || "",
            mode: nextConsult.mode || "",
          };
          const { data } = await axios.post(
            `${API}/api/consults/lookup/batch`,
            { items: [syncPayload] },
            localStorage.getItem("token") ? { headers: getUserHeaders() } : undefined
          );
          const synced = Array.isArray(data?.consults) ? data.consults[0] : null;
          if (synced) nextConsult = normalizeConsult(synced);
        }

        if (!nextConsult?.id && !nextConsult?.bookingId) throw new Error("Consult room could not be initialized");

        const consultStatus = String(nextConsult?.status || "").toLowerCase();
        if (role === "patient" && !["accepted", "upcoming", "live_now", "completed"].includes(consultStatus)) {
          if (consultStatus === "pending" || consultStatus === "confirmed") throw new Error("Doctor has not accepted this consult yet");
          if (["cancelled", "rejected"].includes(consultStatus)) throw new Error("This consult room is no longer available");
        }

        if (active) {
          setConsult(nextConsult);
          setSessionInfo(nextSession);
          setControls((prev) => ({ ...prev, camOn: nextConsult.mode === "video" }));
          upsertLocalConsult(role, nextConsult);
        }
      } catch (err) {
        if (active) setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || "Failed to open consult room");
      } finally {
        if (active) setLoading(false);
      }
    }

    bootstrapRoom();
    return () => {
      active = false;
    };
  }, [consultId, role]);

  useEffect(() => {
    let disposed = false;

    async function mountJitsi() {
      if (loading || error || !consult || !roomName || !containerRef.current || jitsiApiRef.current) return;

      const JitsiMeetExternalAPI = await ensureJitsiScript();
      if (!JitsiMeetExternalAPI || disposed || !containerRef.current) return;

      const displayName =
        role === "doctor" ? initialDoctorDisplayNameRef.current : String(consult.patientName || "Patient");

      const api = new JitsiMeetExternalAPI("meet.jit.si", {
        roomName,
        parentNode: containerRef.current,
        userInfo: { displayName },
        configOverwrite: {
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          startWithAudioMuted: false,
          startWithVideoMuted: consult.mode !== "video",
          subject: `GoDavaii ${consult.mode === "video" ? "Video" : "Audio"} Consult`,
        },
        interfaceConfigOverwrite: {
          MOBILE_APP_PROMO: false,
          HIDE_INVITE_MORE_HEADER: true,
        },
      });

      jitsiApiRef.current = api;
      api.addListener("videoConferenceJoined", () => setMeetingReady(true));
      api.addListener("audioMuteStatusChanged", ({ muted }) => {
        setControls((prev) => ({ ...prev, micOn: !muted }));
      });
      api.addListener("videoMuteStatusChanged", ({ muted }) => {
        setControls((prev) => ({ ...prev, camOn: !muted }));
      });
      api.addListener("readyToClose", () => {
        navigate(getBackPath(role), { replace: true });
      });
    }

    mountJitsi().catch((err) => {
      if (!disposed) setError(err?.message || "Embedded meeting could not be loaded");
    });

    return () => {
      disposed = true;
      if (jitsiApiRef.current) {
        try {
          jitsiApiRef.current.dispose();
        } catch (_) {}
        jitsiApiRef.current = null;
      }
    };
  }, [consult, error, loading, navigate, role, roomName]);

  useEffect(() => {
    if (role !== "doctor" || notesDirty) return;
    setNotesDraft(String(consult?.doctorNotes || ""));
  }, [consult?.doctorNotes, notesDirty, role]);

  useEffect(() => {
    if (loading || error || !consultId) return undefined;

    let active = true;
    let timer = null;
    let firstRun = true;

    async function pollMessages() {
      try {
        if (firstRun) setMessagesLoading(true);
        const { data } = await axios.get(`${API}/api/consults/${consultId}/messages`, getActorAuthConfig(role));
        if (!active) return;

        setMessages(Array.isArray(data?.messages) ? data.messages.map(normalizeMessage) : []);
        if (data?.consult) {
          const normalizedConsult = normalizeConsult(data.consult);
          setConsult((prev) => ({ ...(prev || {}), ...normalizedConsult }));
          upsertLocalConsult(role, normalizedConsult);
        }
        if (data?.session) setSessionInfo(data.session);
        setChatError("");
      } catch (err) {
        if (!active) return;
        setChatError(err?.response?.data?.error || err?.response?.data?.message || "Chat sync failed");
      } finally {
        if (!active) return;
        setMessagesLoading(false);
        firstRun = false;
        timer = window.setTimeout(pollMessages, 5000);
      }
    }

    pollMessages();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [consultId, error, loading, role]);

  useEffect(() => {
    if (activePanel !== "chat" || !chatEndRef.current) return;
    chatEndRef.current.scrollIntoView({ behavior: messages.length > 1 ? "smooth" : "auto" });
  }, [activePanel, messages.length]);

  async function handleLeave() {
    if (role === "doctor") {
      setLeaving(true);
      try {
        await axios.post(`${API}/api/consults/${consultId}/session/end`, {}, getDoctorAuthConfig());
      } catch (_) {}
    }
    navigate(getBackPath(role), { replace: true });
  }

  function toggleAudio() {
    if (!jitsiApiRef.current) return;
    jitsiApiRef.current.executeCommand("toggleAudio");
  }

  function toggleVideo() {
    if (!jitsiApiRef.current || consult?.mode !== "video") return;
    jitsiApiRef.current.executeCommand("toggleVideo");
  }

  function handleComposerFilesChange(event) {
    setComposerFiles(Array.from(event.target.files || []));
  }

  function removeComposerFile(index) {
    setComposerFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSendMessage() {
    const trimmedText = composerText.trim();
    if (!trimmedText && !composerFiles.length) return;

    setSendingMessage(true);
    setChatError("");
    try {
      const formData = new FormData();
      formData.append("kind", composerKind);
      formData.append("text", trimmedText);
      composerFiles.forEach((file) => formData.append("attachments", file));

      const { data } = await axios.post(`${API}/api/consults/${consultId}/messages`, formData, getActorAuthConfig(role));
      if (data?.consult) {
        const normalizedConsult = normalizeConsult(data.consult);
        setConsult((prev) => ({ ...(prev || {}), ...normalizedConsult }));
        upsertLocalConsult(role, normalizedConsult);
      }
      if (data?.message) setMessages((prev) => mergeMessage(prev, data.message));

      setComposerText("");
      setComposerFiles([]);
      if (composerFileRef.current) composerFileRef.current.value = "";
    } catch (err) {
      setChatError(err?.response?.data?.error || err?.response?.data?.message || "Message could not be sent");
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleSaveNotes() {
    if (role !== "doctor") return;
    setSavingNotes(true);
    setNotesFeedback("");
    try {
      const { data } = await axios.patch(
        `${API}/api/consults/${consultId}/session/notes`,
        { notes: notesDraft },
        getDoctorAuthConfig()
      );
      const normalizedConsult = normalizeConsult(data?.consult || {});
      setConsult((prev) => ({ ...(prev || {}), ...normalizedConsult }));
      setNotesDirty(false);
      setNotesFeedback("Doctor notes synced inside this consult.");
    } catch (err) {
      setNotesFeedback(err?.response?.data?.error || err?.response?.data?.message || "Doctor notes could not be saved");
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleUploadPrescription() {
    if (role !== "doctor" || !prescriptionFile) return;

    setUploadingPrescription(true);
    setPrescriptionFeedback("");
    try {
      const formData = new FormData();
      formData.append("prescription", prescriptionFile);
      formData.append("notes", prescriptionNote.trim());

      const { data } = await axios.patch(
        `${API}/api/consults/${consultId}/prescription`,
        formData,
        getDoctorAuthConfig()
      );
      if (data?.consult) {
        const normalizedConsult = normalizeConsult(data.consult);
        setConsult((prev) => ({ ...(prev || {}), ...normalizedConsult }));
      }
      if (data?.message) setMessages((prev) => mergeMessage(prev, data.message));
      setPrescriptionFile(null);
      setPrescriptionNote("");
      if (prescriptionFileRef.current) prescriptionFileRef.current.value = "";
      setPrescriptionFeedback("Prescription shared in the consult room.");
    } catch (err) {
      setPrescriptionFeedback(err?.response?.data?.error || err?.response?.data?.message || "Prescription upload failed");
    } finally {
      setUploadingPrescription(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(16,185,129,0.2), transparent 28%), radial-gradient(circle at bottom right, rgba(14,165,233,0.15), transparent 24%), linear-gradient(180deg, #041814 0%, #07231f 48%, #04120f 100%)",
        color: "#F8FAFC",
        padding: isCompact ? 12 : 18,
      }}
    >
      <div style={{ maxWidth: 1480, margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" onClick={() => navigate(getBackPath(role))} style={backButtonStyle}>
              <ArrowLeft style={{ width: 18, height: 18 }} />
            </button>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(226,232,240,0.76)" }}>{getRoleLabel(role)}</div>
              <div style={{ fontSize: isCompact ? 22 : 28, fontWeight: 900, letterSpacing: "-0.03em" }}>{counterpartName}</div>
              <div style={{ fontSize: 13, color: "rgba(226,232,240,0.74)", marginTop: 2 }}>{consult?.specialty || "General consultation"}</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Pill label={statusPill.label} bg={statusPill.bg} color={statusPill.color} />
            <Pill
              label={consult?.mode === "video" ? "Video consult" : "Audio consult"}
              bg="rgba(255,255,255,0.08)"
              color="#F8FAFC"
              icon={consult?.mode === "video" ? <Video style={{ width: 14, height: 14 }} /> : <Mic style={{ width: 14, height: 14 }} />}
            />
            <Pill
              label={meetingReady ? "Connected" : loading ? "Preparing" : "Joining"}
              bg={meetingReady ? "rgba(16,185,129,0.18)" : "rgba(250,204,21,0.14)"}
              color={meetingReady ? "#86efac" : "#fde68a"}
            />
          </div>
        </div>

        {error ? (
          <div style={errorCardStyle}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Consult room unavailable</div>
            <div style={{ color: "#FECACA", fontWeight: 700 }}>{error}</div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isCompact ? "1fr" : "minmax(0,1.55fr) minmax(360px,0.95fr)",
              gap: 16,
            }}
          >
            <div style={stageShellStyle}>
              <div style={stageHeaderStyle}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>GoDavaii Live Consult Suite</div>
                  <div style={{ fontSize: 12, color: "rgba(226,232,240,0.72)", marginTop: 4 }}>
                    Use this room for video, symptoms, reports, doctor notes, and prescription handoff without leaving the app.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <MiniInfoCard label="Scheduled" value={formatSchedule(consult)} />
                  <MiniInfoCard label="Room" value={roomName || "Preparing"} />
                </div>
              </div>

              <div style={stageCanvasStyle}>
                <div style={{ position: "absolute", top: 16, left: 16, right: 16, zIndex: 2, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", pointerEvents: "none" }}>
                  <OverlayBadge text={consult?.callState === "ended" ? "Session ended" : meetingReady ? "Inside app room" : "Connecting room"} />
                  <OverlayBadge text={consult?.reason || "General consultation"} />
                </div>
                <div ref={containerRef} style={{ position: "absolute", inset: 0, zIndex: 1 }} />
              </div>

              <div style={stageControlsStyle}>
                <ControlButton
                  accent={controls.micOn ? "#10b981" : "#475569"}
                  onClick={toggleAudio}
                  label={controls.micOn ? "Mute" : "Unmute"}
                  icon={controls.micOn ? <Mic style={{ width: 16, height: 16 }} /> : <MicOff style={{ width: 16, height: 16 }} />}
                />
                {consult?.mode === "video" && (
                  <ControlButton
                    accent={controls.camOn ? "#2563eb" : "#475569"}
                    onClick={toggleVideo}
                    label={controls.camOn ? "Hide video" : "Show video"}
                    icon={controls.camOn ? <Camera style={{ width: 16, height: 16 }} /> : <CameraOff style={{ width: 16, height: 16 }} />}
                  />
                )}
                <ControlButton
                  accent="#0ea5e9"
                  onClick={() => setActivePanel("chat")}
                  label="Open chat"
                  icon={<MessageCircle style={{ width: 16, height: 16 }} />}
                />
                <ControlButton
                  accent="#ef4444"
                  onClick={handleLeave}
                  disabled={leaving}
                  label={role === "doctor" ? (leaving ? "Ending..." : "End consult") : "Leave room"}
                  icon={<PhoneOff style={{ width: 16, height: 16 }} />}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={glassCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div style={sectionEyebrowStyle}>Consult Snapshot</div>
                    <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.1 }}>{counterpartName}</div>
                    <div style={{ marginTop: 6, color: "rgba(226,232,240,0.74)", fontSize: 13 }}>{formatSchedule(consult)}</div>
                  </div>
                  <div style={summaryCountStyle}>
                    <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A7F3D0" }}>Shared records</div>
                    <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900 }}>{sharedRecords.length}</div>
                    <div style={{ fontSize: 12, color: "rgba(226,232,240,0.74)" }}>reports available in-room</div>
                  </div>
                </div>

                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: isCompact ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <InfoRow icon={<ShieldCheck style={{ width: 16, height: 16 }} />} label={role === "doctor" ? "Patient" : "Doctor"} value={counterpartName} />
                  <InfoRow icon={<Clock3 style={{ width: 16, height: 16 }} />} label="Scheduled" value={formatSchedule(consult)} />
                  <InfoRow icon={<Stethoscope style={{ width: 16, height: 16 }} />} label="Reason" value={consult?.reason || "General consultation"} />
                  <InfoRow icon={<UserRound style={{ width: 16, height: 16 }} />} label="Room ID" value={roomName || "Preparing"} />
                </div>
              </div>

              <div style={{ ...glassCardStyle, padding: 14 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  <PanelTab active={activePanel === "chat"} icon={<MessageCircle style={{ width: 15, height: 15 }} />} label="Chat" onClick={() => setActivePanel("chat")} />
                  <PanelTab active={activePanel === "notes"} icon={<FileText style={{ width: 15, height: 15 }} />} label="Notes" onClick={() => setActivePanel("notes")} />
                  <PanelTab active={activePanel === "care"} icon={<ShieldCheck style={{ width: 15, height: 15 }} />} label="Care" onClick={() => setActivePanel("care")} />
                </div>

                {activePanel === "chat" && (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={softPanelStyle}>
                      <div style={{ fontSize: 15, fontWeight: 900 }}>Secure consult chat</div>
                      <div style={{ fontSize: 12, color: "rgba(226,232,240,0.72)", marginTop: 4 }}>
                        Patient symptoms, report uploads, and doctor replies stay linked to this consult.
                      </div>
                    </div>

                    <div style={messageListStyle}>
                      {messagesLoading && messages.length === 0 ? (
                        <EmptyState title="Loading conversation" subtitle="Pulling consult updates and shared files..." />
                      ) : messages.length === 0 ? (
                        <EmptyState title="Start the consult conversation" subtitle="Share symptoms, reports, medication context, or quick care updates here." />
                      ) : (
                        messages.map((message) => <MessageBubble key={message.id} message={message} role={role} />)
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {chatError ? <div style={inlineErrorStyle}>{chatError}</div> : null}

                    <div style={softPanelStyle}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                        {getComposerOptions(role).map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setComposerKind(option.value)}
                            style={composerChipStyle(option.value === composerKind)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>

                      <textarea
                        value={composerText}
                        onChange={(event) => setComposerText(event.target.value)}
                        placeholder={getComposerPlaceholder(composerKind, role)}
                        rows={4}
                        style={textareaStyle}
                      />

                      {composerFiles.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                          {composerFiles.map((file, index) => (
                            <FileChip
                              key={`${file.name}_${file.size}_${index}`}
                              label={`${file.name}${file.size ? ` | ${formatFileSize(file.size)}` : ""}`}
                              onRemove={() => removeComposerFile(index)}
                            />
                          ))}
                        </div>
                      )}

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
                        <div>
                          <input ref={composerFileRef} type="file" multiple accept={REPORT_ACCEPT} onChange={handleComposerFilesChange} style={{ display: "none" }} />
                          <button type="button" onClick={() => composerFileRef.current?.click()} style={secondaryActionStyle}>
                            <Upload style={{ width: 15, height: 15 }} />
                            Upload reports
                          </button>
                          <div style={{ marginTop: 8, fontSize: 11, color: "rgba(226,232,240,0.58)" }}>JPG, PNG, WEBP, HEIC, or PDF up to 5MB each.</div>
                        </div>
                        <button
                          type="button"
                          onClick={handleSendMessage}
                          disabled={sendingMessage || (!composerText.trim() && !composerFiles.length)}
                          style={primaryActionStyle(sendingMessage || (!composerText.trim() && !composerFiles.length))}
                        >
                          <Send style={{ width: 15, height: 15 }} />
                          {sendingMessage ? "Sending..." : composerKind === "symptom" ? "Share symptoms" : "Send update"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {activePanel === "notes" && (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={softPanelStyle}>
                      <div style={{ fontSize: 15, fontWeight: 900 }}>{role === "doctor" ? "Doctor notes" : "Consult brief"}</div>
                      <div style={{ fontSize: 12, color: "rgba(226,232,240,0.72)", marginTop: 4 }}>
                        {role === "doctor"
                          ? "Use private notes for diagnosis points, follow-up tasks, or medication reminders."
                          : "Doctor notes stay private. You can still review the symptom story and records shared in this consult."}
                      </div>
                    </div>

                    {role === "doctor" ? (
                      <div style={softPanelStyle}>
                        <textarea
                          value={notesDraft}
                          onChange={(event) => {
                            setNotesDraft(event.target.value);
                            setNotesDirty(true);
                            if (notesFeedback) setNotesFeedback("");
                          }}
                          placeholder="Write clinical notes, observations, follow-up advice, or reminders before ending the consult."
                          rows={10}
                          style={textareaStyle}
                        />
                        {notesFeedback ? <div style={{ marginTop: 12, ...feedbackStyle(notesFeedback.toLowerCase().includes("could not")) }}>{notesFeedback}</div> : null}
                        <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ fontSize: 12, color: "rgba(226,232,240,0.62)" }}>Notes sync to this consult and stay available alongside the session state.</div>
                          <button
                            type="button"
                            onClick={handleSaveNotes}
                            disabled={savingNotes || !notesDirty}
                            style={primaryActionStyle(savingNotes || !notesDirty)}
                          >
                            <CheckCircle2 style={{ width: 15, height: 15 }} />
                            {savingNotes ? "Saving..." : "Save notes"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={softPanelStyle}>
                        <div style={{ display: "grid", gap: 10 }}>
                          <SummaryLine label="Reason" value={consult?.reason || "General consultation"} />
                          <SummaryLine label="Symptoms shared" value={consult?.symptoms || "No symptom note shared yet."} />
                          <SummaryLine label="Reports shared" value={`${sharedRecords.length} file(s) attached in this consult`} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activePanel === "care" && (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={softPanelStyle}>
                      <div style={{ fontSize: 15, fontWeight: 900 }}>Prescription and care handoff</div>
                      <div style={{ fontSize: 12, color: "rgba(226,232,240,0.72)", marginTop: 4 }}>
                        Prescription, reports, and shared files stay attached to the same consult instead of opening a new tab.
                      </div>
                    </div>

                    {consult?.prescription?.fileUrl ? (
                      <div style={softPanelStyle}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 900 }}>Latest prescription</div>
                            <div style={{ marginTop: 4, color: "rgba(226,232,240,0.74)", fontSize: 12 }}>
                              {consult.prescription.fileName || "Prescription file"}
                              {consult.prescription.uploadedAt ? ` | ${formatDateTime(consult.prescription.uploadedAt)}` : ""}
                            </div>
                          </div>
                          <a href={consult.prescription.fileUrl} target="_blank" rel="noreferrer" style={downloadLinkStyle}>
                            <Download style={{ width: 15, height: 15 }} />
                            Download
                          </a>
                        </div>
                        {consult?.prescription?.notes ? <div style={{ marginTop: 12, ...pillInfoStyle }}>{consult.prescription.notes}</div> : null}
                      </div>
                    ) : (
                      <div style={softPanelStyle}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>No prescription shared yet</div>
                        <div style={{ marginTop: 6, fontSize: 12, color: "rgba(226,232,240,0.72)" }}>
                          {role === "doctor" ? "Upload a prescription or care file when you are ready." : "The doctor can upload your prescription here during or after the consult."}
                        </div>
                      </div>
                    )}

                    {role === "doctor" && (
                      <div style={softPanelStyle}>
                        <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 12 }}>Upload prescription</div>
                        <input ref={prescriptionFileRef} type="file" accept={REPORT_ACCEPT} onChange={(event) => setPrescriptionFile(event.target.files?.[0] || null)} style={{ display: "none" }} />
                        <button type="button" onClick={() => prescriptionFileRef.current?.click()} style={secondaryActionStyle}>
                          <Upload style={{ width: 15, height: 15 }} />
                          {prescriptionFile ? prescriptionFile.name : "Choose prescription file"}
                        </button>
                        <textarea
                          value={prescriptionNote}
                          onChange={(event) => setPrescriptionNote(event.target.value)}
                          placeholder="Add medicine notes, dosage, or follow-up instructions."
                          rows={4}
                          style={{ ...textareaStyle, marginTop: 12 }}
                        />
                        {prescriptionFeedback ? <div style={{ marginTop: 12, ...feedbackStyle(prescriptionFeedback.toLowerCase().includes("failed")) }}>{prescriptionFeedback}</div> : null}
                        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={handleUploadPrescription}
                            disabled={uploadingPrescription || !prescriptionFile}
                            style={primaryActionStyle(uploadingPrescription || !prescriptionFile)}
                          >
                            <CheckCircle2 style={{ width: 15, height: 15 }} />
                            {uploadingPrescription ? "Uploading..." : "Share prescription"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={softPanelStyle}>
                      <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>Reports and records</div>
                      {sharedRecords.length === 0 ? (
                        <div style={{ fontSize: 12, color: "rgba(226,232,240,0.66)" }}>No reports attached yet. Use the chat panel to upload medical reports or symptom photos.</div>
                      ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                          {sharedRecords.map((file, index) => (
                            <AttachmentLink key={`${file.url || file.fileName || "record"}_${index}`} file={file} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {sessionInfo?.joinedAt ? (
                <div style={glassCardStyle}>
                  <div style={sectionEyebrowStyle}>Session Timeline</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <SummaryLine label="Joined" value={formatDateTime(sessionInfo.joinedAt)} />
                    <SummaryLine label="Room state" value={sessionInfo.state || consult?.callState || "ready"} />
                    <SummaryLine label="Mode" value={consult?.mode === "video" ? "Video consult" : "Audio consult"} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ControlButton({ accent, disabled, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 132,
        height: 48,
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.08)",
        background: disabled ? "#475569" : accent,
        color: "#fff",
        fontWeight: 900,
        fontSize: 13,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        padding: "0 16px",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function Pill({ bg, color, icon, label }) {
  return (
    <span
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 900,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {icon}
      {label}
    </span>
  );
}

function MiniInfoCard({ label, value }) {
  return (
    <div style={miniInfoCardStyle}>
      <div style={{ fontSize: 11, fontWeight: 900, color: "#A7F3D0", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 800, color: "#F8FAFC" }}>{value}</div>
    </div>
  );
}

function OverlayBadge({ text }) {
  return (
    <div style={overlayBadgeStyle}>
      {text}
    </div>
  );
}

function PanelTab({ active, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active ? "1px solid rgba(16,185,129,0.45)" : "1px solid rgba(255,255,255,0.08)",
        background: active ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.05)",
        color: active ? "#D1FAE5" : "#E2E8F0",
        borderRadius: 16,
        height: 42,
        padding: "0 14px",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        fontWeight: 900,
        fontSize: 13,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function MessageBubble({ message, role }) {
  const ownMessage =
    (role === "doctor" && message.senderRole === "doctor") ||
    (role === "patient" && message.senderRole === "patient");
  const isSystem = message.senderRole === "system";
  const bubbleBg = isSystem
    ? "rgba(14,165,233,0.14)"
    : ownMessage
      ? "linear-gradient(135deg, rgba(16,185,129,0.34), rgba(5,150,105,0.22))"
      : "rgba(255,255,255,0.06)";

  return (
    <div style={{ display: "flex", justifyContent: ownMessage ? "flex-end" : "flex-start" }}>
      <div style={{ width: "min(100%, 420px)", borderRadius: 22, border: "1px solid rgba(255,255,255,0.08)", background: bubbleBg, padding: "14px 14px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>{message.senderName}</div>
          <div style={{ fontSize: 11, color: "rgba(226,232,240,0.7)", fontWeight: 800 }}>{formatDateTime(message.createdAt)}</div>
        </div>
        <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={messageKindPillStyle(message.kind)}>{message.kind}</span>
          {message.senderRole === "doctor" && <span style={miniPillStyle}>doctor</span>}
          {message.senderRole === "patient" && <span style={miniPillStyle}>patient</span>}
        </div>
        {message.text ? <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{message.text}</div> : null}
        {Array.isArray(message.attachments) && message.attachments.length > 0 ? (
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {message.attachments.map((file, index) => (
              <AttachmentLink key={`${message.id}_${file.url || file.fileName || "file"}_${index}`} file={file} compact />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FileChip({ label, onRemove }) {
  return (
    <div style={fileChipStyle}>
      <FileText style={{ width: 14, height: 14 }} />
      <span>{label}</span>
      <button type="button" onClick={onRemove} style={chipRemoveButtonStyle}>
        <X style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}

function AttachmentLink({ compact = false, file }) {
  const sizeLabel = formatFileSize(file?.size);
  return (
    <a href={file?.url} target="_blank" rel="noreferrer" style={{ ...attachmentLinkStyle, padding: compact ? "10px 12px" : "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <FileText style={{ width: 16, height: 16, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file?.fileName || "Shared file"}</div>
          <div style={{ marginTop: 4, fontSize: 11, color: "rgba(226,232,240,0.68)" }}>{[file?.category, sizeLabel].filter(Boolean).join(" | ")}</div>
        </div>
      </div>
      <Download style={{ width: 15, height: 15, flexShrink: 0 }} />
    </a>
  );
}

function EmptyState({ subtitle, title }) {
  return (
    <div style={emptyStateStyle}>
      <div style={{ fontSize: 16, fontWeight: 900 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: "rgba(226,232,240,0.68)", lineHeight: 1.5 }}>{subtitle}</div>
    </div>
  );
}

function SummaryLine({ label, value }) {
  return (
    <div style={summaryLineStyle}>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A7F3D0" }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 13, color: "#F8FAFC", fontWeight: 800, lineHeight: 1.45 }}>{value || "-"}</div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div style={summaryLineStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#A7F3D0" }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 14, fontWeight: 800, color: "#F8FAFC", lineHeight: 1.4 }}>{value || "-"}</div>
    </div>
  );
}

function composerChipStyle(active) {
  return {
    borderRadius: 999,
    padding: "8px 12px",
    border: active ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(255,255,255,0.08)",
    background: active ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.06)",
    color: active ? "#D1FAE5" : "#E2E8F0",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  };
}

function primaryActionStyle(disabled) {
  return {
    minWidth: 148,
    height: 44,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: disabled ? "#334155" : "linear-gradient(135deg, #10b981, #059669)",
    color: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "0 16px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 900,
    fontSize: 13,
    opacity: disabled ? 0.7 : 1,
  };
}

function feedbackStyle(errorState) {
  return {
    borderRadius: 16,
    padding: "12px 14px",
    background: errorState ? "rgba(127,29,29,0.26)" : "rgba(16,185,129,0.14)",
    border: errorState ? "1px solid rgba(248,113,113,0.3)" : "1px solid rgba(16,185,129,0.22)",
    color: errorState ? "#FECACA" : "#D1FAE5",
    fontSize: 12,
    fontWeight: 800,
  };
}

function messageKindPillStyle(kind) {
  const label = String(kind || "").toLowerCase();
  if (label === "symptom") return { ...miniPillStyle, background: "rgba(250,204,21,0.16)", color: "#fde68a" };
  if (label === "report") return { ...miniPillStyle, background: "rgba(14,165,233,0.16)", color: "#bae6fd" };
  return miniPillStyle;
}

const miniPillStyle = {
  borderRadius: 999,
  padding: "4px 8px",
  background: "rgba(255,255,255,0.08)",
  color: "#E2E8F0",
  fontSize: 10,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const secondaryActionStyle = {
  height: 42,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.06)",
  color: "#F8FAFC",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "0 14px",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 13,
};

const glassCardStyle = {
  borderRadius: 30,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(18px)",
  padding: 18,
};

const softPanelStyle = {
  borderRadius: 24,
  padding: 16,
  background: "rgba(2,6,23,0.26)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const sectionEyebrowStyle = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(167,243,208,0.9)",
  marginBottom: 14,
};

const textareaStyle = {
  width: "100%",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
  color: "#F8FAFC",
  padding: 14,
  resize: "vertical",
  outline: "none",
  font: "inherit",
  lineHeight: 1.5,
  boxSizing: "border-box",
};

const messageListStyle = {
  display: "grid",
  gap: 12,
  maxHeight: 420,
  overflowY: "auto",
  paddingRight: 4,
};

const errorCardStyle = {
  borderRadius: 28,
  border: "1px solid rgba(248,113,113,0.38)",
  background: "rgba(127,29,29,0.34)",
  padding: 22,
  color: "#FECACA",
};

const inlineErrorStyle = {
  borderRadius: 16,
  padding: "12px 14px",
  background: "rgba(127,29,29,0.26)",
  border: "1px solid rgba(248,113,113,0.3)",
  color: "#FECACA",
  fontSize: 12,
  fontWeight: 800,
};

const backButtonStyle = {
  width: 46,
  height: 46,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
};

const stageShellStyle = {
  borderRadius: 34,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(3,7,18,0.34)",
  backdropFilter: "blur(18px)",
  overflow: "hidden",
  minHeight: 720,
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 24px 80px rgba(2, 6, 23, 0.26)",
};

const stageHeaderStyle = {
  padding: "16px 18px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
};

const stageCanvasStyle = {
  flex: 1,
  minHeight: 560,
  position: "relative",
  background: "linear-gradient(180deg, rgba(7,31,29,0.95) 0%, rgba(2,6,23,1) 100%)",
};

const stageControlsStyle = {
  padding: 14,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
};

const summaryCountStyle = {
  borderRadius: 20,
  padding: "12px 14px",
  minWidth: 160,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const miniInfoCardStyle = {
  borderRadius: 18,
  padding: "12px 14px",
  minWidth: 146,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const overlayBadgeStyle = {
  maxWidth: 280,
  borderRadius: 999,
  padding: "8px 12px",
  background: "rgba(2,6,23,0.54)",
  border: "1px solid rgba(255,255,255,0.12)",
  fontSize: 12,
  fontWeight: 800,
  color: "#F8FAFC",
  backdropFilter: "blur(8px)",
};

const fileChipStyle = {
  borderRadius: 999,
  padding: "8px 12px",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.08)",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  fontWeight: 800,
};

const chipRemoveButtonStyle = {
  background: "transparent",
  border: "none",
  color: "#F8FAFC",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  padding: 0,
};

const attachmentLinkStyle = {
  borderRadius: 18,
  textDecoration: "none",
  color: "#F8FAFC",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const emptyStateStyle = {
  borderRadius: 24,
  padding: 24,
  border: "1px dashed rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.04)",
  textAlign: "center",
};

const summaryLineStyle = {
  borderRadius: 18,
  padding: "12px 14px",
  background: "rgba(2,6,23,0.3)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const downloadLinkStyle = {
  borderRadius: 14,
  padding: "10px 12px",
  textDecoration: "none",
  color: "#F8FAFC",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.06)",
  fontWeight: 800,
  fontSize: 13,
};

const pillInfoStyle = {
  borderRadius: 18,
  padding: "12px 14px",
  background: "rgba(16,185,129,0.12)",
  border: "1px solid rgba(16,185,129,0.22)",
  color: "#D1FAE5",
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.5,
};
