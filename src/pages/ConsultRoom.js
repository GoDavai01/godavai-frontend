import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Clock3,
  Download,
  FileText,
  MessageCircle,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Send,
  ShieldCheck,
  Upload,
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
    paymentStatus: raw?.paymentStatus || "pending",
    refundStatus: raw?.refundStatus || "none",
    status: raw?.status || "pending",
    callState: raw?.callState || "not_started",
    patientAttachments: Array.isArray(raw?.patientAttachments) ? raw.patientAttachments : [],
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

function buildStatusPill(consult) {
  const status = String(consult?.status || "").toLowerCase();
  if (status === "live_now") return { label: "Live now", bg: "#dcfce7", color: "#166534" };
  if (status === "upcoming" || status === "accepted") return { label: "Ready", bg: "#dbeafe", color: "#1d4ed8" };
  if (status === "completed") return { label: "Completed", bg: "#ede9fe", color: "#5b21b6" };
  if (status === "rejected" || status === "cancelled") return { label: "Closed", bg: "#fee2e2", color: "#991b1b" };
  return { label: status || "Consult", bg: "#e2e8f0", color: "#334155" };
}

function getComposerPlaceholder(role, kind) {
  if (kind === "symptom") {
    return "Symptoms yahan likho. Kab start hua aur kya feel ho raha hai woh bhi bata sakte ho.";
  }
  return role === "doctor"
    ? "Reply, advice, ya follow-up note bhejo."
    : "Doctor ko message bhejo ya reports ke saath short note likho.";
}

function getMessageKind(role, composerKind, hasFiles) {
  if (hasFiles) return "report";
  if (role === "patient" && composerKind === "symptom") return "symptom";
  return "message";
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
  const initialConsult = location.state?.consult ? normalizeConsult(location.state.consult) : null;
  const initialSession = location.state?.session || null;
  const initialConsultRef = useRef(initialConsult);
  const initialSessionRef = useRef(initialSession);
  const initialDoctorDisplayNameRef = useRef(
    String(location.state?.displayName || initialConsultRef.current?.doctorName || "Doctor")
  );

  const [consult, setConsult] = useState(initialConsultRef.current);
  const [sessionInfo, setSessionInfo] = useState(initialSessionRef.current);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1120 : false
  );
  const [meetingMode, setMeetingMode] = useState(null);
  const [meetingReady, setMeetingReady] = useState(false);
  const [meetingError, setMeetingError] = useState("");
  const [sessionStarting, setSessionStarting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [controls, setControls] = useState({ micOn: true, camOn: false });
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [chatError, setChatError] = useState("");
  const [composerKind, setComposerKind] = useState(role === "patient" ? "symptom" : "message");
  const [composerText, setComposerText] = useState("");
  const [composerFiles, setComposerFiles] = useState([]);
  const [sendingMessage, setSendingMessage] = useState(false);

  const containerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const composerFileRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    function onResize() {
      setIsCompact(window.innerWidth < 1120);
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

  // ── Doctor-controlled join: patient can only join AFTER doctor starts session ──
  const doctorHasJoined = sessionInfo?.state === "live" || consult?.callState === "live";
  const canPatientJoinCall = role === "patient" && doctorHasJoined;
  const canStartCall = role === "doctor" || canPatientJoinCall;
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
          const { data } = await axios.get(`${API}/api/consults/${consultId}/session`, getDoctorAuthConfig());
          nextConsult = normalizeConsult(data?.consult || data?.dashboardConsult || nextConsult || {});
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

          if (!nextConsult) {
            throw new Error("Consult details are not available for this room");
          }

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

        if (!nextConsult?.id && !nextConsult?.bookingId) {
          throw new Error("Consult room could not be initialized");
        }

        const consultStatus = String(nextConsult?.status || "").toLowerCase();
        if (role === "patient" && !["confirmed", "accepted", "upcoming", "live_now", "completed"].includes(consultStatus)) {
          if (consultStatus === "pending" || consultStatus === "pending_payment") {
            throw new Error("Booking is not yet confirmed. Please complete payment first.");
          }
          if (["cancelled", "rejected"].includes(consultStatus)) {
            throw new Error("This consult room is no longer available");
          }
        }

        if (active) {
          setConsult(nextConsult);
          setSessionInfo(nextSession);
          setControls((prev) => ({
            ...prev,
            camOn: normalizeMode(nextConsult.mode) === "video",
          }));
          upsertLocalConsult(role, nextConsult);
        }
      } catch (err) {
        if (active) {
          setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || "Failed to open consult room");
        }
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
        // Fast polling during live call, slower when idle
        const pollInterval = (consult?.callState === "live" || sessionInfo?.state === "live") ? 1500 : 3000;
        timer = window.setTimeout(pollMessages, pollInterval);
      }
    }

    pollMessages();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultId, error, loading, role]);

  useEffect(() => {
    if (!chatEndRef.current) return;
    chatEndRef.current.scrollIntoView({ behavior: messages.length > 1 ? "smooth" : "auto" });
  }, [messages.length]);

  useEffect(() => {
    let disposed = false;
    const currentContainer = containerRef.current;

    async function mountJitsi() {
      if (!meetingMode || loading || error || !consult || !roomName || !containerRef.current || jitsiApiRef.current) {
        return;
      }

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
          prejoinConfig: { enabled: false },
          disableDeepLinking: true,
          startWithAudioMuted: false,
          startWithVideoMuted: meetingMode !== "video",
          startAudioOnly: meetingMode !== "video",
          subject: `GoDavaii ${meetingMode === "video" ? "Video" : "Audio"} Consult`,
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
        setMeetingMode(null);
        setMeetingReady(false);
      });
    }

    mountJitsi().catch((err) => {
      if (!disposed) setMeetingError(err?.message || "Call could not be started");
    });

    return () => {
      disposed = true;
      if (jitsiApiRef.current) {
        try {
          jitsiApiRef.current.dispose();
        } catch (_) {}
        jitsiApiRef.current = null;
      }
      if (currentContainer) currentContainer.innerHTML = "";
      setMeetingReady(false);
    };
  }, [consult, error, loading, meetingMode, role, roomName]);

  async function handleStartMeeting(nextMode) {
    if (!consultId || sessionStarting) return;

    // Patient cannot start call — only join after doctor starts
    if (role === "patient" && !canPatientJoinCall) {
      setMeetingError("Please wait for the doctor to start the consultation.");
      return;
    }

    setMeetingError("");
    setSessionStarting(true);
    try {
      let nextConsult = consult;
      let nextSession = sessionInfo;

      if (role === "doctor") {
        // Doctor initiates session — this marks callState as "live" in backend
        const { data } = await axios.post(`${API}/api/consults/${consultId}/session/join`, {}, getDoctorAuthConfig());
        nextConsult = normalizeConsult(data?.dashboardConsult || data?.consult || nextConsult || {});
        nextSession = data?.session || nextSession;
      } else {
        // Patient joining existing session — no API call needed, just connect to Jitsi
        if (!nextSession?.roomId) {
          nextSession = {
            roomId: roomName,
            state: "live",
            joinedAt: new Date().toISOString(),
          };
        }
      }

      if (nextConsult) {
        setConsult(nextConsult);
        upsertLocalConsult(role, nextConsult);
      }
      if (nextSession) setSessionInfo(nextSession);

      setControls({
        micOn: true,
        camOn: nextMode === "video",
      });
      setMeetingMode(nextMode);
    } catch (err) {
      setMeetingError(err?.response?.data?.error || err?.response?.data?.message || "Call could not be started");
    } finally {
      setSessionStarting(false);
    }
  }

  async function handleLeave() {
    setLeaving(true);
    try {
      if (role === "doctor") {
        // Doctor ends the entire consultation session
        await axios.post(`${API}/api/consults/${consultId}/session/end`, {}, getDoctorAuthConfig());
      }
      // Patient just disconnects from Jitsi — doesn't end the session
      if (jitsiApiRef.current) {
        try { jitsiApiRef.current.dispose(); } catch (_) {}
        jitsiApiRef.current = null;
      }
      setMeetingMode(null);
      setMeetingReady(false);
    } catch (_) {
    } finally {
      navigate(getBackPath(role), { replace: true });
    }
  }

  function toggleAudio() {
    if (!jitsiApiRef.current) return;
    jitsiApiRef.current.executeCommand("toggleAudio");
  }

  function toggleVideo() {
    if (!jitsiApiRef.current) return;
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
      formData.append("kind", getMessageKind(role, composerKind, composerFiles.length > 0));
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

  const meetingLabel = meetingMode === "video" ? "Video consult" : "Audio call";

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(16,185,129,0.16), transparent 28%), linear-gradient(180deg, #041814 0%, #07231f 55%, #04120f 100%)",
        color: "#F8FAFC",
        padding: isCompact ? 12 : 18,
      }}
    >
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div style={pageHeaderStyle(isCompact)}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" onClick={() => navigate(getBackPath(role))} style={backButtonStyle}>
              <ArrowLeft style={{ width: 18, height: 18 }} />
            </button>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(226,232,240,0.78)" }}>{getRoleLabel(role)}</div>
              <div style={{ fontSize: isCompact ? 24 : 30, fontWeight: 900, letterSpacing: "-0.03em" }}>{counterpartName}</div>
              <div style={{ marginTop: 4, fontSize: 13, color: "rgba(226,232,240,0.68)" }}>{consult?.specialty || "General consultation"}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <StatusPill label={statusPill.label} bg={statusPill.bg} color={statusPill.color} />
            <StatusPill
              label={meetingMode ? meetingLabel : consult?.mode === "call" ? "Audio consult" : "Video consult"}
              bg="rgba(255,255,255,0.08)"
              color="#F8FAFC"
              icon={meetingMode === "video" || consult?.mode === "video" ? <Video style={{ width: 14, height: 14 }} /> : <Phone style={{ width: 14, height: 14 }} />}
            />
            <StatusPill
              label={meetingReady ? "Connected" : sessionStarting ? "Starting" : "Idle"}
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
              gridTemplateColumns: isCompact ? "1fr" : "minmax(0, 1.45fr) 380px",
              gap: 16,
              alignItems: "start",
            }}
          >
            <div style={stageShellStyle}>
              <div style={stageHeaderStyle}>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>Simple consult room</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <MiniBadge icon={<Clock3 style={{ width: 14, height: 14 }} />} text={formatSchedule(consult)} />
                    <MiniBadge icon={<ShieldCheck style={{ width: 14, height: 14 }} />} text={consult?.reason || "General consultation"} />
                    <MiniBadge icon={<MessageCircle style={{ width: 14, height: 14 }} />} text={`${messages.length} chats`} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <ActionButton
                    icon={<Phone style={{ width: 16, height: 16 }} />}
                    label={role === "doctor" ? (sessionInfo?.state === "live" && meetingMode !== "call" ? "Rejoin call" : "Start Call") : (canPatientJoinCall ? "Join Call" : "Waiting...")}
                    accent="#14b8a6"
                    disabled={sessionStarting || !canStartCall}
                    onClick={() => handleStartMeeting("call")}
                  />
                  <ActionButton
                    icon={<Video style={{ width: 16, height: 16 }} />}
                    label={role === "doctor" ? (sessionInfo?.state === "live" && meetingMode !== "video" ? "Rejoin video" : "Start Video") : (canPatientJoinCall ? "Join Video" : "Waiting...")}
                    accent="#13C0A2"
                    disabled={sessionStarting || !canStartCall}
                    onClick={() => handleStartMeeting("video")}
                  />
                </div>
              </div>

              <div style={meetingCanvasStyle}>
                {meetingMode ? (
                  <>
                    <div style={meetingOverlayRowStyle}>
                      <MiniOverlay text={meetingReady ? meetingLabel : sessionStarting ? "Starting consult" : "Connecting"} />
                      <MiniOverlay text={roomName || "Preparing room"} />
                    </div>
                    <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
                  </>
                ) : (
                  <div style={meetingPlaceholderStyle}>
                    <div style={avatarCircleStyle}>{String(counterpartName || "P").trim().charAt(0).toUpperCase()}</div>
                    <div style={{ fontSize: isCompact ? 28 : 34, fontWeight: 900, letterSpacing: "-0.03em" }}>{counterpartName}</div>

                    {role === "doctor" ? (
                      <>
                        <div style={{ color: "rgba(226,232,240,0.72)", maxWidth: 540, textAlign: "center", lineHeight: 1.6, fontSize: 14 }}>
                          Start the consultation by clicking Call or Video. Patient will be able to join once you start.
                        </div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                          <ActionButton
                            icon={<Phone style={{ width: 16, height: 16 }} />}
                            label={sessionInfo?.state === "live" ? "Rejoin Call" : "Start Audio Call"}
                            accent="#14b8a6"
                            disabled={sessionStarting}
                            onClick={() => handleStartMeeting("call")}
                          />
                          <ActionButton
                            icon={<Video style={{ width: 16, height: 16 }} />}
                            label={sessionInfo?.state === "live" ? "Rejoin Video" : "Start Video Call"}
                            accent="#13C0A2"
                            disabled={sessionStarting}
                            onClick={() => handleStartMeeting("video")}
                          />
                        </div>
                      </>
                    ) : canPatientJoinCall ? (
                      <>
                        <div style={{ color: "#10B981", fontSize: 14, fontWeight: 800, textAlign: "center" }}>
                          Doctor has started the consultation. Join now!
                        </div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                          <ActionButton
                            icon={<Phone style={{ width: 16, height: 16 }} />}
                            label="Join Audio Call"
                            accent="#14b8a6"
                            disabled={sessionStarting}
                            onClick={() => handleStartMeeting("call")}
                          />
                          <ActionButton
                            icon={<Video style={{ width: 16, height: 16 }} />}
                            label="Join Video Call"
                            accent="#13C0A2"
                            disabled={sessionStarting}
                            onClick={() => handleStartMeeting("video")}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "12px 20px",
                          background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.25)",
                          borderRadius: 14, color: "#FBBF24", fontSize: 13, fontWeight: 800,
                        }}>
                          <Clock3 style={{ width: 18, height: 18, flexShrink: 0 }} />
                          Waiting for doctor to start the consultation...
                        </div>
                        <div style={{ color: "rgba(226,232,240,0.5)", fontSize: 12, fontWeight: 600, textAlign: "center", maxWidth: 400 }}>
                          You can send messages, symptoms, and reports in the chat while waiting. The doctor will start the call/video when ready.
                        </div>
                      </>
                    )}

                    <div style={helpTextStyle}>
                      Use the chat panel to share symptoms, reports, and messages anytime.
                    </div>
                  </div>
                )}
              </div>

              <div style={stageFooterStyle}>
                <ActionButton
                  icon={controls.micOn ? <Mic style={{ width: 16, height: 16 }} /> : <MicOff style={{ width: 16, height: 16 }} />}
                  label={controls.micOn ? "Mute" : "Unmute"}
                  accent={controls.micOn ? "#10b981" : "#475569"}
                  disabled={!meetingMode}
                  onClick={toggleAudio}
                />
                <ActionButton
                  icon={controls.camOn ? <Camera style={{ width: 16, height: 16 }} /> : <CameraOff style={{ width: 16, height: 16 }} />}
                  label={controls.camOn ? "Hide video" : "Show video"}
                  accent={controls.camOn ? "#2563eb" : "#475569"}
                  disabled={!meetingMode}
                  onClick={toggleVideo}
                />
                <ActionButton
                  icon={<PhoneOff style={{ width: 16, height: 16 }} />}
                  label={role === "doctor" ? (leaving ? "Ending..." : "End consult") : "Leave"}
                  accent="#ef4444"
                  disabled={leaving}
                  onClick={handleLeave}
                />
              </div>

              {meetingError ? <div style={{ ...inlineInfoStyle, margin: 16 }}>{meetingError}</div> : null}
            </div>

            <div style={chatShellStyle}>
              <div style={chatHeaderStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div style={chatAvatarStyle}>{String(counterpartName || "P").trim().charAt(0).toUpperCase()}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{counterpartName}</div>
                    <div style={{ marginTop: 3, fontSize: 12, color: "rgba(226,232,240,0.64)" }}>{formatSchedule(consult)}</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {canStartCall && (
                    <>
                      <IconActionButton
                        icon={<Phone style={{ width: 15, height: 15 }} />}
                        label={role === "doctor" ? "Call" : "Join"}
                        accent="#14b8a6"
                        onClick={() => handleStartMeeting("call")}
                      />
                      <IconActionButton
                        icon={<Video style={{ width: 15, height: 15 }} />}
                        label={role === "doctor" ? "Video" : "Join"}
                        accent="#13C0A2"
                        onClick={() => handleStartMeeting("video")}
                      />
                    </>
                  )}
                  {!canStartCall && role === "patient" && (
                    <div style={{ fontSize: 11, color: "#FBBF24", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock3 style={{ width: 12, height: 12 }} /> Waiting for doctor
                    </div>
                  )}
                </div>
              </div>

              <div style={chatBodyStyle}>
                {messagesLoading && messages.length === 0 ? (
                  <EmptyState title="Loading chat" subtitle="Consult messages aur shared files fetch ho rahe hain." />
                ) : messages.length === 0 ? (
                  <EmptyState title="Chat start karo" subtitle="Symptoms, quick updates, ya reports right here share karo." />
                ) : (
                  messages.map((message) => <MessageBubble key={message.id} message={message} role={role} />)
                )}
                <div ref={chatEndRef} />
              </div>

              {chatError ? <div style={{ ...inlineInfoStyle, margin: "0 14px 12px" }}>{chatError}</div> : null}
              <div style={composerShellStyle}>
                {role === "patient" ? (
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <ToggleChip active={composerKind === "symptom"} onClick={() => setComposerKind("symptom")}>
                      Symptoms
                    </ToggleChip>
                    <ToggleChip active={composerKind === "message"} onClick={() => setComposerKind("message")}>
                      Message
                    </ToggleChip>
                  </div>
                ) : null}

                <textarea
                  value={composerText}
                  onChange={(event) => setComposerText(event.target.value)}
                  placeholder={getComposerPlaceholder(role, composerKind)}
                  rows={3}
                  style={composerTextareaStyle}
                />

                {composerFiles.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    {composerFiles.map((file, index) => (
                      <FileChip
                        key={`${file.name}_${file.size}_${index}`}
                        label={`${file.name}${file.size ? ` | ${formatFileSize(file.size)}` : ""}`}
                        onRemove={() => removeComposerFile(index)}
                      />
                    ))}
                  </div>
                ) : null}

                <div style={composerFooterStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <input
                      ref={composerFileRef}
                      type="file"
                      multiple
                      accept={REPORT_ACCEPT}
                      onChange={handleComposerFilesChange}
                      style={{ display: "none" }}
                    />
                    <button type="button" onClick={() => composerFileRef.current?.click()} style={uploadButtonStyle}>
                      <Upload style={{ width: 15, height: 15 }} />
                      Upload
                    </button>
                    <div style={{ fontSize: 11, color: "rgba(226,232,240,0.56)" }}>
                      JPG, PNG, WEBP, HEIC, or PDF up to 5MB each
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={sendingMessage || (!composerText.trim() && !composerFiles.length)}
                    style={sendButtonStyle(sendingMessage || (!composerText.trim() && !composerFiles.length))}
                  >
                    <Send style={{ width: 15, height: 15 }} />
                    {sendingMessage ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>

              {consult?.prescription?.fileUrl ? (
                <a href={consult.prescription.fileUrl} target="_blank" rel="noreferrer" style={prescriptionCardStyle}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#A7F3D0", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Prescription
                    </div>
                    <div style={{ fontWeight: 800 }}>{consult.prescription.fileName || "Download prescription"}</div>
                    <div style={{ fontSize: 12, color: "rgba(226,232,240,0.66)" }}>
                      {consult.prescription.uploadedAt ? formatDateTime(consult.prescription.uploadedAt) : "Available in this consult"}
                    </div>
                  </div>
                  <Download style={{ width: 16, height: 16 }} />
                </a>
              ) : null}

              {sharedRecords.length > 0 ? (
                <div style={sharedFilesStyle}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#A7F3D0", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Shared files
                  </div>
                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    {sharedRecords.slice(0, 4).map((file, index) => (
                      <AttachmentLink key={`${file.url || file.fileName || "shared"}_${index}`} file={file} />
                    ))}
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

function StatusPill({ bg, color, icon, label }) {
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

function MiniBadge({ icon, text }) {
  return (
    <div style={miniBadgeStyle}>
      {icon}
      <span>{text}</span>
    </div>
  );
}

function ActionButton({ accent, disabled, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 44,
        borderRadius: 16,
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
        minWidth: 126,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function IconActionButton({ accent, icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ ...iconActionButtonStyle, background: accent }}>
      {icon}
      {label}
    </button>
  );
}

function ToggleChip({ active, children, onClick }) {
  return (
    <button type="button" onClick={onClick} style={toggleChipStyle(active)}>
      {children}
    </button>
  );
}

function MessageBubble({ message, role }) {
  const ownMessage =
    (role === "doctor" && message.senderRole === "doctor") ||
    (role === "patient" && message.senderRole === "patient");
  const bubbleBg =
    message.senderRole === "system"
      ? "rgba(14,165,233,0.12)"
      : ownMessage
        ? "linear-gradient(135deg, rgba(22,163,74,0.35), rgba(13,148,136,0.22))"
        : "rgba(255,255,255,0.06)";

  return (
    <div style={{ display: "flex", justifyContent: ownMessage ? "flex-end" : "flex-start" }}>
      <div style={{ ...messageBubbleStyle, background: bubbleBg }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>{message.senderName}</div>
          <div style={{ fontSize: 11, color: "rgba(226,232,240,0.68)", fontWeight: 800 }}>{formatDateTime(message.createdAt)}</div>
        </div>
        {message.text ? <div style={{ marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{message.text}</div> : null}
        {Array.isArray(message.attachments) && message.attachments.length > 0 ? (
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
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
          <div style={{ fontWeight: 800, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {file?.fileName || "Shared file"}
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: "rgba(226,232,240,0.68)" }}>
            {[file?.category, sizeLabel].filter(Boolean).join(" | ")}
          </div>
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

function MiniOverlay({ text }) {
  return <div style={miniOverlayStyle}>{text}</div>;
}

const pageHeaderStyle = (isCompact) => ({
  display: "flex",
  alignItems: isCompact ? "flex-start" : "center",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
  marginBottom: 16,
});

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

const errorCardStyle = {
  borderRadius: 28,
  border: "1px solid rgba(248,113,113,0.38)",
  background: "rgba(127,29,29,0.34)",
  padding: 22,
  color: "#FECACA",
};

const stageShellStyle = {
  borderRadius: 34,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(3,7,18,0.32)",
  backdropFilter: "blur(18px)",
  overflow: "hidden",
  minHeight: 760,
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 24px 80px rgba(2,6,23,0.26)",
};

const stageHeaderStyle = {
  padding: "18px 20px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
};

const meetingCanvasStyle = {
  position: "relative",
  flex: 1,
  minHeight: 560,
  background: "linear-gradient(180deg, rgba(5,23,20,0.95) 0%, rgba(2,6,23,1) 100%)",
};

const meetingPlaceholderStyle = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 18,
  padding: 28,
  textAlign: "center",
};

const avatarCircleStyle = {
  width: 88,
  height: 88,
  borderRadius: "50%",
  background: "linear-gradient(135deg, #14b8a6, #2563eb)",
  display: "grid",
  placeItems: "center",
  fontSize: 34,
  fontWeight: 900,
  boxShadow: "0 18px 50px rgba(20,184,166,0.28)",
};

const helpTextStyle = {
  fontSize: 12,
  color: "rgba(226,232,240,0.62)",
  lineHeight: 1.5,
};

const meetingOverlayRowStyle = {
  position: "absolute",
  top: 16,
  left: 16,
  right: 16,
  zIndex: 2,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  pointerEvents: "none",
};

const miniOverlayStyle = {
  borderRadius: 999,
  padding: "8px 12px",
  background: "rgba(2,6,23,0.58)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#F8FAFC",
  fontSize: 12,
  fontWeight: 800,
  backdropFilter: "blur(8px)",
};

const stageFooterStyle = {
  padding: 16,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  justifyContent: "center",
};

const inlineInfoStyle = {
  borderRadius: 16,
  padding: "12px 14px",
  background: "rgba(127,29,29,0.26)",
  border: "1px solid rgba(248,113,113,0.3)",
  color: "#FECACA",
  fontSize: 12,
  fontWeight: 800,
};

const chatShellStyle = {
  borderRadius: 30,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(18px)",
  minHeight: 760,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const chatHeaderStyle = {
  padding: "16px 16px 14px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
};

const chatAvatarStyle = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  background: "linear-gradient(135deg, rgba(20,184,166,0.92), rgba(37,99,235,0.88))",
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
  fontSize: 18,
};

const iconActionButtonStyle = {
  height: 38,
  borderRadius: 999,
  border: "none",
  color: "#fff",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "0 12px",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 12,
};

const chatBodyStyle = {
  flex: 1,
  padding: 14,
  display: "grid",
  gap: 12,
  overflowY: "auto",
  background:
    "radial-gradient(circle at top right, rgba(16,185,129,0.08), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)",
};

const messageBubbleStyle = {
  width: "min(100%, 290px)",
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.08)",
  padding: "14px 14px 12px",
  lineHeight: 1.5,
};

const composerShellStyle = {
  padding: 14,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(2,6,23,0.22)",
};

const composerTextareaStyle = {
  width: "100%",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.05)",
  color: "#F8FAFC",
  padding: 14,
  resize: "vertical",
  outline: "none",
  font: "inherit",
  lineHeight: 1.5,
  boxSizing: "border-box",
};

const composerFooterStyle = {
  marginTop: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const toggleChipStyle = (active) => ({
  borderRadius: 999,
  padding: "8px 12px",
  border: active ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(255,255,255,0.08)",
  background: active ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.05)",
  color: active ? "#D1FAE5" : "#E2E8F0",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 12,
});

const uploadButtonStyle = {
  height: 40,
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

const sendButtonStyle = (disabled) => ({
  height: 42,
  borderRadius: 14,
  border: "none",
  background: disabled ? "#475569" : "linear-gradient(135deg, #14b8a6, #2563eb)",
  color: "#fff",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "0 16px",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 900,
  fontSize: 13,
});

const prescriptionCardStyle = {
  margin: "0 14px 14px",
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(16,185,129,0.12)",
  padding: "14px 16px",
  color: "#F8FAFC",
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const sharedFilesStyle = {
  margin: "0 14px 14px",
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 14,
};

const emptyStateStyle = {
  borderRadius: 24,
  padding: 24,
  border: "1px dashed rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.04)",
  textAlign: "center",
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

const miniBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  fontSize: 12,
  fontWeight: 800,
  color: "#E2E8F0",
};
