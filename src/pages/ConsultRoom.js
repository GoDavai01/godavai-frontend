import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Clock3,
  FileText,
  MessageCircle,
  Mic,
  MicOff,
  PhoneOff,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Video,
} from "lucide-react";
import {
  readStoredConsultBookings,
  upsertStoredConsultBooking,
} from "../utils/consultBookings";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const JITSI_SCRIPT_SRC = "https://meet.jit.si/external_api.js";

function normalizeMode(mode) {
  const value = String(mode || "").toLowerCase().trim();
  if (value === "call" || value === "audio") return "call";
  if (value === "inperson" || value === "in-person") return "inperson";
  return "video";
}

function normalizeConsult(raw = {}) {
  const id = String(raw?.id || raw?._id || raw?.bookingId || "");
  const mode = normalizeMode(raw?.mode);
  return {
    ...raw,
    id,
    bookingId: String(raw?.bookingId || id),
    mode,
    consultRoomId: raw?.consultRoomId || "",
    doctorName: raw?.doctorName || raw?.doctor || "Doctor",
    patientName: raw?.patientName || "Patient",
    reason: raw?.reason || raw?.symptoms || "General consultation",
    dateLabel: raw?.dateLabel || raw?.date || "",
    slot: raw?.slot || "",
    paymentStatus: raw?.paymentStatus || "pending",
    status: raw?.status || "pending",
    patientAttachments: Array.isArray(raw?.patientAttachments) ? raw.patientAttachments : [],
    doctorAction: raw?.doctorAction || "none",
  };
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

function ensureJitsiScript() {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.JitsiMeetExternalAPI) {
      resolve(window.JitsiMeetExternalAPI);
      return;
    }

    const existing = document.querySelector(`script[src="${JITSI_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.JitsiMeetExternalAPI), {
        once: true,
      });
      existing.addEventListener("error", () => reject(new Error("Jitsi script failed to load")), {
        once: true,
      });
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

  const [consult, setConsult] = useState(initialConsultRef.current);
  const [sessionInfo, setSessionInfo] = useState(initialSessionRef.current);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [meetingReady, setMeetingReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 980 : false
  );
  const [controls, setControls] = useState({
    micOn: true,
    camOn: normalizeMode(location.state?.consult?.mode) === "video",
  });

  const containerRef = useRef(null);
  const jitsiApiRef = useRef(null);

  useEffect(() => {
    function onResize() {
      setIsCompact(window.innerWidth < 980);
    }

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const roomName = useMemo(() => {
    const normalized = consult ? normalizeConsult(consult) : null;
    return (
      sessionInfo?.roomId ||
      normalized?.consultRoomId ||
      (consultId ? `consult_${String(consultId).slice(-8)}` : "")
    );
  }, [consult, consultId, sessionInfo]);

  useEffect(() => {
    let active = true;

    async function bootstrapRoom() {
      setLoading(true);
      setError("");
      try {
        let nextConsult = initialConsultRef.current;
        let nextSession = initialSessionRef.current;

        if (role === "doctor") {
          const { data } = await axios.post(
            `${API}/api/consults/${consultId}/session/join`,
            {},
            getDoctorAuthConfig()
          );
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
            const { data } = await axios.get(`${API}/api/consults/my`, {
              headers: getUserHeaders(),
            });
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
        if (
          role === "patient" &&
          !["accepted", "upcoming", "live_now"].includes(consultStatus)
        ) {
          if (consultStatus === "pending" || consultStatus === "confirmed") {
            throw new Error("Doctor has not accepted this consult yet");
          }
          if (["cancelled", "rejected", "completed"].includes(consultStatus)) {
            throw new Error("This consult room is no longer available");
          }
        }

        if (active) {
          setConsult(nextConsult);
          setSessionInfo(nextSession);
          setControls((prev) => ({
            ...prev,
            camOn: nextConsult.mode === "video",
          }));
          upsertStoredConsultBooking({
            ...nextConsult,
            id: nextConsult.id || nextConsult.bookingId,
            bookingId: nextConsult.bookingId || nextConsult.id,
          });
        }
      } catch (err) {
        if (active) {
          setError(err?.response?.data?.error || err?.message || "Failed to open consult room");
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
    let disposed = false;

    async function mountJitsi() {
      if (loading || error || !consult || !roomName || !containerRef.current || jitsiApiRef.current) {
        return;
      }

      const JitsiMeetExternalAPI = await ensureJitsiScript();
      if (!JitsiMeetExternalAPI || disposed || !containerRef.current) return;

      const displayName =
        role === "doctor"
          ? String(location.state?.displayName || "Doctor")
          : String(consult.patientName || "Patient");

      const api = new JitsiMeetExternalAPI("meet.jit.si", {
        roomName,
        parentNode: containerRef.current,
        userInfo: {
          displayName,
        },
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

      api.addListener("videoConferenceJoined", () => {
        setMeetingReady(true);
        if (openChatFirst) {
          setTimeout(() => {
            try {
              api.executeCommand("toggleChat");
            } catch (_) {}
          }, 600);
        }
      });

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
      if (!disposed) {
        setError(err?.message || "Embedded meeting could not be loaded");
      }
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
  }, [consult, error, loading, navigate, openChatFirst, role, roomName]);

  async function handleLeave() {
    if (role === "doctor") {
      setLeaving(true);
      try {
        await axios.post(
          `${API}/api/consults/${consultId}/session/end`,
          {},
          getDoctorAuthConfig()
        );
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

  function toggleChat() {
    if (!jitsiApiRef.current) return;
    jitsiApiRef.current.executeCommand("toggleChat");
  }

  const statusPill = useMemo(() => {
    const status = String(consult?.status || "").toLowerCase();
    if (status === "live_now") return { label: "Live now", bg: "#dcfce7", color: "#166534" };
    if (status === "upcoming" || status === "accepted") {
      return { label: "Join ready", bg: "#dbeafe", color: "#1d4ed8" };
    }
    return { label: status || "Consult", bg: "#e2e8f0", color: "#334155" };
  }, [consult]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(16,185,129,0.18), transparent 30%), linear-gradient(180deg,#041b17 0%,#0b2c24 50%,#071c19 100%)",
        color: "#F8FAFC",
        padding: 16,
      }}
    >
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => navigate(getBackPath(role))}
              style={{
                width: 46,
                height: 46,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
            >
              <ArrowLeft style={{ width: 18, height: 18 }} />
            </button>

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(226,232,240,0.8)" }}>
                {getRoleLabel(role)}
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.03em" }}>
                {role === "doctor" ? consult?.patientName || "Patient" : consult?.doctorName || "Doctor"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                background: statusPill.bg,
                color: statusPill.color,
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              {statusPill.label}
            </span>
            <span
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.1)",
                fontSize: 12,
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {consult?.mode === "video" ? <Video style={{ width: 14, height: 14 }} /> : <Mic style={{ width: 14, height: 14 }} />}
              {consult?.mode === "video" ? "Video Consult" : "Audio Consult"}
            </span>
          </div>
        </div>

        {error ? (
          <div
            style={{
              borderRadius: 24,
              border: "1px solid rgba(248,113,113,0.38)",
              background: "rgba(127,29,29,0.34)",
              padding: 18,
              color: "#FECACA",
              fontWeight: 800,
            }}
          >
            {error}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isCompact
                ? "1fr"
                : "minmax(0,1.7fr) minmax(320px,0.9fr)",
              gap: 16,
            }}
          >
            <div
              style={{
                borderRadius: 32,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(3,7,18,0.36)",
                backdropFilter: "blur(20px)",
                overflow: "hidden",
                minHeight: 640,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: "14px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900 }}>GoDavaii Live Consult</div>
                  <div style={{ fontSize: 12, color: "rgba(226,232,240,0.72)", marginTop: 4 }}>
                    Embedded meeting room for doctor and patient
                  </div>
                </div>
                <div style={{ fontSize: 12, color: meetingReady ? "#86efac" : "#fde68a", fontWeight: 900 }}>
                  {meetingReady ? "Connected inside app" : loading ? "Preparing room..." : "Joining room..."}
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 520, position: "relative" }}>
                <div
                  ref={containerRef}
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(180deg,#071f1d 0%,#020617 100%)",
                  }}
                />
              </div>

              <div
                style={{
                  padding: 14,
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                }}
              >
                <button
                  type="button"
                  onClick={toggleAudio}
                  style={controlButtonStyle(controls.micOn ? "#10b981" : "#475569")}
                >
                  {controls.micOn ? <Mic style={{ width: 16, height: 16 }} /> : <MicOff style={{ width: 16, height: 16 }} />}
                  {controls.micOn ? "Mute" : "Unmute"}
                </button>

                {consult?.mode === "video" && (
                  <button
                    type="button"
                    onClick={toggleVideo}
                    style={controlButtonStyle(controls.camOn ? "#6366f1" : "#475569")}
                  >
                    {controls.camOn ? (
                      <Camera style={{ width: 16, height: 16 }} />
                    ) : (
                      <CameraOff style={{ width: 16, height: 16 }} />
                    )}
                    {controls.camOn ? "Hide video" : "Show video"}
                  </button>
                )}

                <button type="button" onClick={toggleChat} style={controlButtonStyle("#0ea5e9")}>
                  <MessageCircle style={{ width: 16, height: 16 }} />
                  Chat
                </button>

                <button
                  type="button"
                  onClick={handleLeave}
                  disabled={leaving}
                  style={controlButtonStyle("#ef4444")}
                >
                  <PhoneOff style={{ width: 16, height: 16 }} />
                  {role === "doctor" ? (leaving ? "Ending..." : "End consult") : "Leave room"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={sideCardStyle}>
                <div style={sectionEyebrowStyle}>Consult Snapshot</div>
                <div style={{ display: "grid", gap: 12 }}>
                  <InfoRow
                    icon={<ShieldCheck style={{ width: 16, height: 16 }} />}
                    label={role === "doctor" ? "Patient" : "Doctor"}
                    value={role === "doctor" ? consult?.patientName : consult?.doctorName}
                  />
                  <InfoRow
                    icon={<Clock3 style={{ width: 16, height: 16 }} />}
                    label="Scheduled"
                    value={`${consult?.dateLabel || ""}${consult?.slot ? `, ${consult.slot}` : ""}`}
                  />
                  <InfoRow
                    icon={<Stethoscope style={{ width: 16, height: 16 }} />}
                    label="Reason"
                    value={consult?.reason || "General consultation"}
                  />
                  <InfoRow
                    icon={<UserRound style={{ width: 16, height: 16 }} />}
                    label="Room ID"
                    value={roomName || "Preparing..."}
                  />
                </div>
              </div>

              <div style={sideCardStyle}>
                <div style={sectionEyebrowStyle}>Attachments & Notes</div>
                {Array.isArray(consult?.patientAttachments) && consult.patientAttachments.length > 0 ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {consult.patientAttachments.map((file, index) => (
                      <a
                        key={`${consult?.id || "consult"}_${index}`}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          borderRadius: 18,
                          padding: "12px 14px",
                          textDecoration: "none",
                          color: "#F8FAFC",
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          fontWeight: 800,
                        }}
                      >
                        <FileText style={{ width: 16, height: 16 }} />
                        {file.fileName || "Patient record"}
                      </a>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      borderRadius: 18,
                      padding: 16,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px dashed rgba(255,255,255,0.14)",
                      color: "rgba(226,232,240,0.72)",
                      fontWeight: 700,
                    }}
                  >
                    No extra records attached for this consult.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function controlButtonStyle(accent) {
  return {
    minWidth: 132,
    height: 48,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: accent,
    color: "#fff",
    fontWeight: 900,
    fontSize: 13,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
    padding: "0 16px",
  };
}

const sideCardStyle = {
  borderRadius: 28,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(18px)",
  padding: 18,
};

const sectionEyebrowStyle = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(167,243,208,0.9)",
  marginBottom: 14,
};

function InfoRow({ icon, label, value }) {
  return (
    <div
      style={{
        borderRadius: 18,
        padding: "12px 14px",
        background: "rgba(2,6,23,0.34)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#A7F3D0" }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
      <div style={{ marginTop: 8, fontSize: 14, fontWeight: 800, color: "#F8FAFC" }}>
        {value || "-"}
      </div>
    </div>
  );
}
