// pages/GoDavaiiAI.js — GoDavaii 2035 Health OS AI Assistant
// ✅ FIX: Backend STT mic flow added using MediaRecorder + /assistant/transcribe
// ✅ FIX: Browser SpeechRecognition kept only as fallback
// ✅ FIX: English speech no longer forced into hi-IN
// ✅ FIX: Reply language chip added (Auto / Hindi / Hinglish / English)
// ✅ FIX: Selected reply language persisted in localStorage
// ✅ FIX: Fallback speech synthesis default language corrected to en-IN
// ✅ FIX: Marathi TTS detection order preserved
// ✅ FIX: Nothing else changed in layout/UX beyond requested fix

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  FileText,
  History,
  Mic,
  MicOff,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const FILE_ANALYZE_TIMEOUT_MS = 300000;

/* ── Design tokens — Premium 2030 palette ─────────────────── */
const DEEP = "#0C5A3E";
const MID = "#0E7A4F";
const ACC = "#00D97E";
const DARK = "#041F15";
const GLASS = "rgba(255,255,255,0.88)";
const GLASS_BORDER = "rgba(12,90,62,0.08)";
const SURFACE = "rgba(248,250,252,0.95)";

/* ── Focus modes ──────────────────────────────────────────── */
const FOCUS = [
  { key: "auto", label: "Auto", icon: "🤖" },
  { key: "symptom", label: "Symptoms", icon: "🩺" },
  { key: "medicine", label: "Medicine", icon: "💊" },
  { key: "rx", label: "Prescription", icon: "📋" },
  { key: "lab", label: "Lab Report", icon: "🧪" },
  { key: "xray", label: "X-Ray / Scan", icon: "🦴" },
];

const TARGETS = [
  { key: "self", label: "For Me", icon: "👤" },
  { key: "family", label: "For Family", icon: "👨‍👩‍👧" },
  { key: "new", label: "New Profile", icon: "➕" },
];

const LANG_OPTIONS = [
  { key: "auto", label: "Auto" },
  { key: "hindi", label: "Hindi" },
  { key: "hinglish", label: "Hinglish" },
  { key: "english", label: "English" },
];

/* ── Helpers ───────────────────────────────────────────────── */
function cleanAssistantText(text) {
  return String(text || "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/```/g, "");
}

function buildCompactHistory(messages) {
  return messages.slice(-14).map((m) => ({
    role: m.role,
    text: m.text || "",
  }));
}

function fallbackReply(message, focus, whoFor) {
  const caution = "Ye preliminary medical guidance hai. Emergency me turant hospital/ER jao.";
  const identity = whoFor === "family" ? "family member" : whoFor === "new" ? "new profile" : "you";
  return `${caution}\n\nFor ${identity}: Age, symptoms, duration, fever, existing diseases, current medicines share karein.`;
}

function getApiErrorMessage(err) {
  const data = err?.response?.data;
  return data?.error || data?.details || data?.message || err?.message || "Request failed.";
}

function wantsLatestVaultReportAnalysis(text) {
  const src = String(text || "").toLowerCase();
  return (
    /(latest|recent|last|naya|new)/.test(src) &&
    /(health vault|healthvault|vault)/.test(src) &&
    /(lab report|report|xray|x-ray|scan)/.test(src) &&
    /(analy|explain|samjha|interpret)/.test(src)
  );
}

/* ── Detect language for TTS ──────────────────────────────── */
function detectLanguageForTTS(text) {
  const src = String(text || "").trim();
  if (!src) return "hinglish";

  if (/[\u0900-\u097F]/.test(src)) {
    if (/\b(आहे|नाही|काय|कसे)\b/.test(src)) return "marathi";
    return "hindi";
  }
  if (/[\u0980-\u09FF]/.test(src)) return "bengali";
  if (/[\u0B80-\u0BFF]/.test(src)) return "tamil";
  if (/[\u0C00-\u0C7F]/.test(src)) return "telugu";
  if (/[\u0C80-\u0CFF]/.test(src)) return "kannada";
  if (/[\u0D00-\u0D7F]/.test(src)) return "malayalam";
  if (/[\u0A80-\u0AFF]/.test(src)) return "gujarati";
  if (/[\u0A00-\u0A7F]/.test(src)) return "punjabi";

  const lower = src.toLowerCase();
  const hindiWords = [
    "hai", "kya", "kaise", "mujhe", "mera", "kar", "karo",
    "samjha", "batao", "nahi", "acha", "dard", "bukhar", "dawai", "ilaaj",
  ];
  const hintCount = hindiWords.reduce(
    (n, w) => (new RegExp(`\\b${w}\\b`, "i").test(lower) ? n + 1 : n),
    0
  );
  if (hintCount >= 2) return "hinglish";
  return "english";
}

/* ── Auth header helper ───────────────────────────────────── */
function getAuthHeaders() {
  const token = localStorage.getItem("token");
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

function getSpeechRecognitionLang(pref) {
  switch (String(pref || "auto").toLowerCase()) {
    case "hindi":
      return "hi-IN";
    case "english":
      return "en-IN";
    case "hinglish":
      return "en-IN";
    case "bengali":
      return "bn-IN";
    case "tamil":
      return "ta-IN";
    case "telugu":
      return "te-IN";
    case "gujarati":
      return "gu-IN";
    case "marathi":
      return "mr-IN";
    case "punjabi":
      return "pa-IN";
    default:
      return "en-IN";
  }
}

function pickSupportedAudioMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  for (const type of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(type)) return type;
  }
  return "";
}

/* ── Responsive hook ──────────────────────────────────────── */
function useScreenSize() {
  const [size, setSize] = useState(() => {
    if (typeof window === "undefined") return "mobile";
    const w = window.innerWidth;
    if (w >= 1024) return "desktop";
    if (w >= 640) return "tablet";
    return "mobile";
  });

  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth;
      if (w >= 1024) setSize("desktop");
      else if (w >= 640) setSize("tablet");
      else setSize("mobile");
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return size;
}

/* ── Format sections nicely ───────────────────────────────── */
function FormatReply({ text, screen }) {
  const clean = cleanAssistantText(text);
  const isDesktop = screen === "desktop";
  const baseFontSize = isDesktop ? 14.5 : 13.5;

  const hasSections = /\n\s*(Assessment|Next steps|Warning signs|Desi ilaaj):/i.test(clean);
  if (!hasSections) {
    return (
      <div style={{ whiteSpace: "pre-line", lineHeight: 1.7, fontSize: baseFontSize, fontWeight: 600, color: "#1F2937" }}>
        {clean.trim()}
      </div>
    );
  }

  const sections = clean.split(
    /\n(?=(?:Assessment|Next steps|Warning signs|Red flags|When to see doctor|Desi ilaaj|Home remedies):)/i
  );

  return (
    <div>
      {sections.map((section, i) => {
        const headerMatch = section.match(
          /^(Assessment|Next steps|Warning signs|Red flags|When to see doctor|Desi ilaaj|Home remedies):/i
        );
        if (!headerMatch) {
          return (
            <div key={i} style={{ whiteSpace: "pre-line", marginBottom: 8, lineHeight: 1.7, fontSize: baseFontSize, fontWeight: 600 }}>
              {section.trim()}
            </div>
          );
        }

        const header = headerMatch[1];
        const body = section.slice(headerMatch[0].length).trim();
        const isRed = /red flag|warning sign/i.test(header);
        const isDesi = /desi|home remed/i.test(header);
        const isAssessment = /assessment/i.test(header);

        const iconMap = {
          assessment: "🔍",
          "next steps": "✅",
          "warning signs": "🚨",
          "red flags": "🚨",
          "when to see doctor": "🏥",
          "desi ilaaj": "🌿",
          "home remedies": "🌿",
        };

        return (
          <div key={i} style={{ marginBottom: 14 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: isDesktop ? 12.5 : 11.5,
                fontWeight: 900,
                letterSpacing: "0.3px",
                color: isRed ? "#DC2626" : isDesi ? "#059669" : isAssessment ? "#0369A1" : DEEP,
                background: isRed ? "#FEF2F2" : isDesi ? "#ECFDF5" : isAssessment ? "#F0F9FF" : "#F0FAF5",
                padding: "5px 11px",
                borderRadius: 10,
                marginBottom: 8,
                fontFamily: "'Sora','Plus Jakarta Sans',sans-serif",
              }}
            >
              {iconMap[header.toLowerCase()] || "📋"} {header}
            </div>
            <div
              style={{
                whiteSpace: "pre-line",
                lineHeight: 1.75,
                fontSize: baseFontSize,
                fontWeight: 600,
                color: "#1F2937",
                paddingLeft: 2,
              }}
            >
              {body}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Chat bubble ──────────────────────────────────────────── */
function ChatBubble({ m, onSpeak, speakingId, speakLoading, screen }) {
  const isUser = m.role === "user";
  const isSpeaking = speakingId === m.id;
  const isDesktop = screen === "desktop";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: isDesktop ? 16 : 14 }}
    >
      {!isUser && (
        <div
          style={{
            width: isDesktop ? 36 : 32,
            height: isDesktop ? 36 : 32,
            borderRadius: 12,
            flexShrink: 0,
            marginRight: 8,
            marginTop: 2,
            background: `linear-gradient(135deg,${DEEP},${MID})`,
            display: "grid",
            placeItems: "center",
            boxShadow: "0 2px 8px rgba(12,90,62,0.20)",
          }}
        >
          <Sparkles style={{ width: isDesktop ? 16 : 14, height: isDesktop ? 16 : 14, color: ACC }} />
        </div>
      )}

      <div
        style={{
          maxWidth: isDesktop ? "75%" : "85%",
          borderRadius: isUser ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
          padding: isDesktop ? "16px 20px" : "14px 16px",
          background: isUser ? `linear-gradient(135deg,${DEEP},${MID})` : GLASS,
          border: isUser ? "none" : `1px solid ${GLASS_BORDER}`,
          boxShadow: isUser ? "0 4px 20px rgba(12,90,62,0.22)" : "0 2px 16px rgba(0,0,0,0.04)",
          backdropFilter: isUser ? "none" : "blur(16px)",
          color: isUser ? "#fff" : "#1F2937",
        }}
      >
        {isUser ? (
          <div style={{ whiteSpace: "pre-line", fontSize: isDesktop ? 14.5 : 13.5, fontWeight: 650, lineHeight: 1.65 }}>
            {m.text}
          </div>
        ) : (
          <FormatReply text={m.text} screen={screen} />
        )}

        {!isUser && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => onSpeak(m)}
            disabled={speakLoading}
            style={{
              marginTop: 10,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              border: `1px solid ${isSpeaking ? ACC : "#E5E7EB"}`,
              borderRadius: 999,
              background: isSpeaking ? "#ECFDF5" : "#FAFAFA",
              padding: "5px 12px",
              fontSize: 11,
              fontWeight: 800,
              color: isSpeaking ? "#059669" : "#6B7280",
              cursor: speakLoading ? "wait" : "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {speakLoading && isSpeaking ? (
              <div
                style={{
                  width: 11,
                  height: 11,
                  border: "2px solid #059669",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "gdSpin 0.6s linear infinite",
                }}
              />
            ) : isSpeaking ? (
              <VolumeX style={{ width: 11, height: 11 }} />
            ) : (
              <Volume2 style={{ width: 11, height: 11 }} />
            )}
            {speakLoading && isSpeaking ? "Loading..." : isSpeaking ? "Stop" : "Listen"}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function GoDavaiiAI() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const screen = useScreenSize();

  const [focus, setFocus] = useState("auto");
  const [whoFor, setWhoFor] = useState("self");
  const [familyLabel, setFamilyLabel] = useState("");
  const [customProfile, setCustomProfile] = useState("");
  const [replyLanguage, setReplyLanguage] = useState(
    () => localStorage.getItem("gd_ai_reply_lang") || "auto"
  );

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [speakLoading, setSpeakLoading] = useState(false);

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileRef = useRef(null);
  const chatEndRef = useRef(null);
  const audioRef = useRef(null);
  const textareaRef = useRef(null);
  const msgIdCounter = useRef(1);
  const autoAnalyzeHandledRef = useRef("");

  const makeId = () => `msg-${msgIdCounter.current++}`;

  useEffect(() => {
    localStorage.setItem("gd_ai_reply_lang", replyLanguage);
  }, [replyLanguage]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch (_) {}
      try {
        mediaRecorderRef.current?.stop?.();
      } catch (_) {}
      try {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        }
      } catch (_) {}
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
      } catch (_) {}
      try {
        window.speechSynthesis?.cancel?.();
      } catch (_) {}
    };
  }, []);

  function stopMicStreamTracks() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }

  /* ── Responsive values ──────────────────────────────────── */
  const isDesktop = screen === "desktop";
  const isTablet = screen === "tablet";
  const containerMaxWidth = isDesktop ? 720 : isTablet ? 600 : 520;
  const headerPadding = isDesktop ? "14px 20px 12px" : "12px 14px 10px";
  const chatPadding = isDesktop ? "16px 20px 4px" : "12px 12px 4px";
  const inputBarPadding = isDesktop ? "10px 20px 8px 20px" : "8px 12px 6px 12px";
  const btnSize = isDesktop ? 46 : 42;
  const headerFontSize = isDesktop ? 18 : 16;
  const chipHeight = isDesktop ? 36 : 32;
  const chipFontSize = isDesktop ? 12 : 11;
  const targetHeight = isDesktop ? 30 : 28;
  const inputFontSize = isDesktop ? 15 : 14;

  const [messages, setMessages] = useState([
    {
      id: makeId(),
      role: "assistant",
      text:
        "Namaste! Main GoDavaii AI hoon — aapka personal health assistant.\n\n" +
        "Aap mujhse pooch sakte ho:\n" +
        "🩺 Symptoms explain karo\n" +
        "💊 Medicine side effects\n" +
        "📋 Prescription samjhao\n" +
        "🧪 Lab report analyze karo (multi-page PDF)\n" +
        "🦴 X-Ray / CT scan explain karo\n" +
        "🌿 Desi ilaaj har response me included\n\n" +
        "Text, voice, ya file upload — sab kaam karega!\n\n" +
        "Aur haan, aap kisi bhi language me baat kar sakte ho — Hindi, English, Bengali, Tamil, Telugu, Gujarati, Marathi, Punjabi... main samajh lunga!",
    },
  ]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const q = new URLSearchParams(location.search || "");
    const bookingId = String(q.get("autolab") || "").trim();
    const vaultMemberId = String(q.get("autovaultMember") || "").trim();
    const vaultReportId = String(q.get("autovaultReport") || "").trim();
    const autoUrl = String(q.get("autourl") || "").trim();
    const autoName = String(q.get("autoname") || "").trim();
    const runKey =
      String(q.get("run") || "").trim() ||
      `${bookingId}:${vaultMemberId}:${vaultReportId}:${autoUrl}:${autoName}`;

    if (!bookingId && !(vaultMemberId && vaultReportId)) return;
    if (autoAnalyzeHandledRef.current === runKey) return;
    autoAnalyzeHandledRef.current = runKey;

    (async () => {
      try {
        const reportFile = bookingId
          ? await fetchBookingReportAsFile(bookingId)
          : await fetchVaultReportAsFile(vaultMemberId, vaultReportId, autoUrl, autoName);

        if (!reportFile) throw new Error("Could not fetch report file.");

        const autoPrompt = "Please analyze this uploaded medical report/image in detail and explain findings in simple language.";
        const userMsg = {
          id: makeId(),
          role: "user",
          text: `${autoPrompt}\n📎 ${reportFile.name} (auto-attached)`,
        };
        const nextMessages = [...messages, userMsg];
        setMessages(nextMessages);
        setLoading(true);
        const reply = await askBackendWithFile(autoPrompt, buildCompactHistory(nextMessages), reportFile);
        setMessages((prev) => [...prev, { id: makeId(), role: "assistant", text: reply }]);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: "assistant",
            text:
              `Assessment:\n- Auto analysis failed: ${getApiErrorMessage(e)}\n\n` +
              `Next steps:\n- Manually attach the report and retry.\n\n` +
              `Warning signs:\n- For severe symptoms, visit ER immediately.`,
          },
        ]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const whoForLabel = useMemo(() => {
    if (whoFor === "family" && familyLabel.trim()) return familyLabel.trim();
    if (whoFor === "new" && customProfile.trim()) return customProfile.trim();
    if (whoFor === "self") return user?.name || "Self";
    return whoFor === "family" ? "Family Member" : "New Profile";
  }, [whoFor, familyLabel, customProfile, user?.name]);

  const profileContext = useMemo(
    () => ({
      whoFor,
      whoForLabel,
      language: replyLanguage,
      replyLanguagePreference: replyLanguage,
      focus,
      desiIlaaj: true,
      userSummary: {
        id: user?._id || user?.userId || null,
        name: user?.name || null,
        age: user?.age || null,
        gender: user?.gender || null,
        dob: user?.dob || null,
      },
    }),
    [whoFor, whoForLabel, replyLanguage, focus, user]
  );

  /* ── TTS ────────────────────────────────────────────────── */
  const handleSpeak = useCallback(async (msg) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();

    if (speakingId === msg.id) {
      setSpeakingId(null);
      setSpeakLoading(false);
      return;
    }

    setSpeakingId(msg.id);
    setSpeakLoading(true);

    const text = cleanAssistantText(msg.text);
    const lang = detectLanguageForTTS(text);

    try {
      const { data } = await axios.post(
        `${API}/api/ai/assistant/tts`,
        { text: text.slice(0, 3000), language: lang },
        { timeout: 30000, headers: getAuthHeaders() }
      );

      if (data?.audioBase64) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audioBase64}`);
        audioRef.current = audio;
        audio.onended = () => {
          setSpeakingId(null);
          setSpeakLoading(false);
          audioRef.current = null;
        };
        audio.onerror = () => {
          setSpeakingId(null);
          setSpeakLoading(false);
          audioRef.current = null;
        };
        setSpeakLoading(false);
        try {
          await audio.play();
        } catch {
          setSpeakingId(null);
          setSpeakLoading(false);
          audioRef.current = null;
        }
        return;
      }
    } catch (err) {
      console.error("TTS API failed:", err?.message || err);
    }

    setSpeakLoading(false);

    if (window.speechSynthesis) {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.92;
        u.pitch = 1.05;
        u.lang =
          lang === "hindi" ? "hi-IN" :
          lang === "bengali" ? "bn-IN" :
          lang === "tamil" ? "ta-IN" :
          lang === "telugu" ? "te-IN" :
          lang === "marathi" ? "mr-IN" :
          lang === "gujarati" ? "gu-IN" :
          lang === "punjabi" ? "pa-IN" :
          lang === "english" ? "en-IN" :
          "en-IN";
        u.onend = () => setSpeakingId(null);
        u.onerror = () => setSpeakingId(null);
        window.speechSynthesis.speak(u);
      } catch {
        setSpeakingId(null);
      }
    } else {
      setSpeakingId(null);
    }
  }, [speakingId]);

  async function transcribeAudioBlob(blob) {
    const mime = blob.type || "audio/webm";
    const ext =
      mime.includes("mp4") ? "m4a" :
      mime.includes("ogg") ? "ogg" :
      mime.includes("wav") ? "wav" :
      "webm";

    const fd = new FormData();
    fd.append("audio", new File([blob], `voice.${ext}`, { type: mime }));
    fd.append("replyLanguagePreference", replyLanguage);

    const { data } = await axios.post(
      `${API}/api/ai/assistant/transcribe`,
      fd,
      {
        timeout: 45000,
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return String(data?.text || "").trim();
  }

  async function startRecordedMic() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    mediaStreamRef.current = stream;
    audioChunksRef.current = [];

    const mimeType = pickSupportedAudioMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      try {
        setMicBusy(true);

        const blob = new Blob(audioChunksRef.current, {
          type: mimeType || "audio/webm",
        });

        const txt = await transcribeAudioBlob(blob);
        if (txt) {
          setInput((prev) => `${prev}${prev ? " " : ""}${txt}`);
          if (textareaRef.current) {
            setTimeout(() => {
              const ta = textareaRef.current;
              if (ta) {
                ta.style.height = "auto";
                ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
              }
            }, 30);
          }
        }
      } catch (err) {
        console.error("Voice transcription failed:", err);
      } finally {
        setMicBusy(false);
        setMicOn(false);
        stopMicStreamTracks();
        mediaRecorderRef.current = null;
      }
    };

    recorder.start();
    setMicOn(true);
  }

  function stopRecordedMic() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    } else {
      setMicOn(false);
      stopMicStreamTracks();
    }
  }

  /* ── Mic ────────────────────────────────────────────────── */
  async function handleMicToggle() {
    if (micBusy) return;

    if (micOn) {
      stopRecordedMic();
      return;
    }

    try {
      if (navigator.mediaDevices?.getUserMedia && window.MediaRecorder) {
        await startRecordedMic();
        return;
      }
    } catch (err) {
      console.error("Recorded mic start failed, falling back:", err);
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = getSpeechRecognitionLang(replyLanguage);
    rec.interimResults = true;
    rec.continuous = false;

    rec.onstart = () => setMicOn(true);
    rec.onend = () => setMicOn(false);
    rec.onerror = () => setMicOn(false);

    rec.onresult = (e) => {
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        if (e.results[i].isFinal) {
          finalText += e.results[i][0]?.transcript || "";
        }
      }

      finalText = finalText.trim();
      if (finalText) {
        setInput((prev) => `${prev}${prev ? " " : ""}${finalText}`);
        if (textareaRef.current) {
          setTimeout(() => {
            const ta = textareaRef.current;
            if (ta) {
              ta.style.height = "auto";
              ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
            }
          }, 30);
        }
      }
    };

    rec.start();
  }

  /* ── Backend ────────────────────────────────────────────── */
  async function askBackend(messageText, history) {
    const payload = { message: messageText, history, context: profileContext };
    const headers = getAuthHeaders();

    for (const url of [
      `${API}/api/ai/assistant/chat`,
      `${API}/api/ai/chat`,
      `${API}/api/ai/assistant`,
    ]) {
      try {
        const r = await axios.post(url, payload, { timeout: 25000, headers });
        const t = r?.data?.reply || r?.data?.answer || r?.data?.message || "";
        if (String(t).trim()) return t;
      } catch (err) {
        console.error("Chat AI failed:", url, getApiErrorMessage(err));
      }
    }

    return fallbackReply(messageText, focus, whoFor);
  }

  async function askBackendWithFile(messageText, history, file) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("message", messageText || "");
    fd.append("history", JSON.stringify(history));
    fd.append("context", JSON.stringify(profileContext));

    const headers = {
      ...getAuthHeaders(),
      "Content-Type": "multipart/form-data",
    };

    let lastErr = null;
    for (const url of [`${API}/api/ai/assistant/analyze-file`, `${API}/api/ai/analyze-file`]) {
      try {
        const r = await axios.post(url, fd, { timeout: FILE_ANALYZE_TIMEOUT_MS, headers });
        const t = r?.data?.reply || r?.data?.answer || r?.data?.message || "";
        if (String(t).trim()) return t;
        lastErr = new Error("Empty reply");
      } catch (err) {
        lastErr = err;
        if (
          err?.code === "ECONNABORTED" ||
          String(err?.message || "").toLowerCase().includes("timeout")
        ) {
          break;
        }
      }
    }

    return `File analysis issue: ${getApiErrorMessage(lastErr)}\n\nRetry once, or upload a cleaner report PDF/image.`;
  }

  async function fetchBookingReportAsFile(bookingId) {
    const headers = getAuthHeaders();
    if (!bookingId || !headers.Authorization) return null;

    const res = await axios.get(
      `${API}/api/labs/bookings/${encodeURIComponent(bookingId)}/report`,
      { headers, responseType: "blob", timeout: 60000 }
    );
    const ct = String(res?.data?.type || "application/octet-stream");
    return new File([res.data], `medical-report-${bookingId}${ct.includes("pdf") ? ".pdf" : ".jpg"}`, { type: ct });
  }

  async function fetchVaultReportAsFile(memberId, reportId, fallbackUrl = "", fallbackName = "") {
    const headers = getAuthHeaders();

    if (memberId && reportId && headers.Authorization) {
      try {
        const res = await axios.get(
          `${API}/api/health-vault/me/members/${encodeURIComponent(memberId)}/reports/${encodeURIComponent(reportId)}/file`,
          { headers, responseType: "blob", timeout: 60000 }
        );
        const ct = String(res?.data?.type || "application/octet-stream");
        return new File([res.data], `vault-report-${reportId}${ct.includes("pdf") ? ".pdf" : ".jpg"}`, { type: ct });
      } catch {
        // fallback
      }
    }

    if (fallbackUrl) {
      const res = await axios.get(fallbackUrl, {
        responseType: "blob",
        timeout: 60000,
        headers: headers.Authorization ? headers : undefined,
      });
      const ct = String(res?.data?.type || "application/octet-stream");
      const safeName = String(fallbackName || "vault-report").replace(/[\\/:*?"<>|]/g, "_");
      return new File([res.data], `${safeName}${ct.includes("pdf") ? ".pdf" : ".jpg"}`, { type: ct });
    }

    return null;
  }

  async function fetchLatestVaultReportAsFile() {
    const headers = getAuthHeaders();
    if (!headers.Authorization) return null;

    const { data } = await axios.get(`${API}/api/health-vault/me`, {
      headers,
      timeout: 30000,
    });

    const members = Array.isArray(data?.members) ? data.members : [];
    if (!members.length) return null;

    const activeMemberId = data?.activeMemberId || members[0]?.id;
    const allReports = members.flatMap((m) =>
      (Array.isArray(m?.reports) ? m.reports : []).map((r) => ({ memberId: m.id, ...r }))
    );
    if (!allReports.length) return null;

    const byDate = [...allReports].sort(
      (a, b) => (new Date(b?.date || 0).getTime() || 0) - (new Date(a?.date || 0).getTime() || 0)
    );
    const pick = byDate.find((r) => r.memberId === activeMemberId) || byDate[0];
    if (!pick?.id || !pick?.memberId) return null;

    const fileRes = await axios.get(
      `${API}/api/health-vault/me/members/${encodeURIComponent(pick.memberId)}/reports/${encodeURIComponent(pick.id)}/file`,
      { headers, responseType: "blob", timeout: 60000 }
    );

    return new File(
      [fileRes.data],
      String(pick.fileName || pick.title || "vault-report").replace(/[\\/:*?"<>|]/g, "_"),
      { type: fileRes.data.type || "application/octet-stream" }
    );
  }

  /* ── Send ────────────────────────────────────────────────── */
  async function sendMessage() {
    const msg = input.trim();
    let activeFile = attachedFile;

    if (!msg && !activeFile) return;
    if (loading) return;

    if (!activeFile && msg && wantsLatestVaultReportAnalysis(msg)) {
      try {
        activeFile = await fetchLatestVaultReportAsFile();
      } catch {
        // ignore
      }
    }

    const userBubbleText = activeFile
      ? `${msg || "(file uploaded)"}\n📎 ${activeFile.name}${!attachedFile ? " (auto-attached)" : ""}`
      : msg;

    const nextMessages = [...messages, { id: makeId(), role: "user", text: userBubbleText }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    if (textareaRef.current) textareaRef.current.style.height = "24px";

    try {
      const reply = activeFile
        ? await askBackendWithFile(msg, buildCompactHistory(nextMessages), activeFile)
        : await askBackend(msg, buildCompactHistory(nextMessages));

      setMessages((prev) => [...prev, { id: makeId(), role: "assistant", text: reply }]);
      if (activeFile) setAttachedFile(null);
    } finally {
      setLoading(false);
    }
  }

  /* ── History ─────────────────────────────────────────────── */
  async function loadChatHistory() {
    if (!user?._id && !user?.userId) return;
    setSessionsLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/ai/assistant/sessions`, {
        params: { limit: 20 },
        headers: getAuthHeaders(),
      });
      setChatSessions(Array.isArray(data) ? data : []);
    } catch {
      setChatSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }

  async function loadSession(sessionId) {
    try {
      const { data } = await axios.get(`${API}/api/ai/assistant/sessions/${sessionId}`, {
        headers: getAuthHeaders(),
      });
      if (data?.messages?.length) {
        setMessages(data.messages.map((m, i) => ({
          id: `hist-${i}`,
          role: m.role,
          text: m.text,
        })));
      }
      setSidebarOpen(false);
    } catch {
      // ignore
    }
  }

  function startNewChat() {
    setMessages([{ id: makeId(), role: "assistant", text: "New chat started! Kya help chahiye aapko? 😊" }]);
    setSidebarOpen(false);
  }

  /* ═══ RENDER ═══ */
  return (
    <div
      style={{
        maxWidth: containerMaxWidth,
        width: "100%",
        margin: "0 auto",
        height: isDesktop ? "100dvh" : "calc(100dvh - 58px)",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(170deg,#F0FAF5 0%,#E8F5EF 35%,#EFF6FF 65%,#F5F3FF 85%,#F8FAFC 100%)",
        fontFamily: "'Plus Jakarta Sans',sans-serif",
        overflow: "hidden",
        position: "relative",
        ...(isDesktop
          ? {
              borderLeft: "1px solid rgba(12,90,62,0.06)",
              borderRight: "1px solid rgba(12,90,62,0.06)",
              boxShadow: "0 0 60px rgba(12,90,62,0.06)",
            }
          : {}),
      }}
    >
      {/* HEADER */}
      <div
        style={{
          flexShrink: 0,
          zIndex: 30,
          padding: headerPadding,
          background: `linear-gradient(135deg,${DEEP} 0%,${DARK} 100%)`,
          borderBottomLeftRadius: isDesktop ? 28 : 24,
          borderBottomRightRadius: isDesktop ? 28 : 24,
          boxShadow: "0 8px 32px rgba(12,90,62,0.25)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -30,
            top: -30,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: `radial-gradient(circle,${ACC}18,transparent 65%)`,
            pointerEvents: "none",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: isDesktop ? 12 : 10 }}>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setSidebarOpen(true);
              loadChatHistory();
            }}
            style={{
              width: isDesktop ? 40 : 36,
              height: isDesktop ? 40 : 36,
              borderRadius: 12,
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.15)",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <History style={{ width: 16, height: 16, color: "#fff" }} />
          </motion.button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: headerFontSize, fontWeight: 900, color: "#fff", letterSpacing: "-0.3px" }}>
              GoDavaii AI
            </div>
            <div style={{ fontSize: isDesktop ? 11.5 : 10.5, color: ACC, fontWeight: 700, marginTop: 1 }}>
              Health assistant · Voice · Files · {whoForLabel}
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate("/home")}
            style={{
              width: isDesktop ? 40 : 36,
              height: isDesktop ? 40 : 36,
              borderRadius: 12,
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.15)",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X style={{ width: 16, height: 16, color: "#fff" }} />
          </motion.button>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: isDesktop ? 8 : 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
          {FOCUS.map((m) => (
            <motion.button
              key={m.key}
              whileTap={{ scale: 0.93 }}
              onClick={() => setFocus(m.key)}
              style={{
                flexShrink: 0,
                height: chipHeight,
                borderRadius: 999,
                border: focus === m.key ? "none" : "1px solid rgba(255,255,255,0.18)",
                background: focus === m.key ? ACC : "rgba(255,255,255,0.08)",
                color: focus === m.key ? DEEP : "#fff",
                padding: isDesktop ? "0 16px" : "0 12px",
                fontSize: chipFontSize,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: "'Sora',sans-serif",
                display: "flex",
                alignItems: "center",
                gap: 4,
                boxShadow: focus === m.key ? `0 4px 14px ${ACC}40` : "none",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: chipFontSize + 1 }}>{m.icon}</span> {m.label}
            </motion.button>
          ))}
        </div>

        <div style={{ marginTop: 8, display: "flex", gap: isDesktop ? 8 : 6, alignItems: "center", overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
          {TARGETS.map((t) => (
            <motion.button
              key={t.key}
              whileTap={{ scale: 0.93 }}
              onClick={() => setWhoFor(t.key)}
              style={{
                flexShrink: 0,
                height: targetHeight,
                borderRadius: 999,
                border: whoFor === t.key ? "none" : "1px solid rgba(255,255,255,0.15)",
                background: whoFor === t.key ? "rgba(0,217,126,0.25)" : "transparent",
                color: "#fff",
                padding: isDesktop ? "0 14px" : "0 10px",
                fontSize: isDesktop ? 11.5 : 10.5,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <span style={{ fontSize: 11 }}>{t.icon}</span> {t.label}
            </motion.button>
          ))}
        </div>

        <div style={{ marginTop: 8, display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
          {LANG_OPTIONS.map((l) => (
            <motion.button
              key={l.key}
              whileTap={{ scale: 0.93 }}
              onClick={() => setReplyLanguage(l.key)}
              style={{
                flexShrink: 0,
                height: targetHeight,
                borderRadius: 999,
                border: replyLanguage === l.key ? "none" : "1px solid rgba(255,255,255,0.15)",
                background: replyLanguage === l.key ? "rgba(0,217,126,0.25)" : "transparent",
                color: "#fff",
                padding: isDesktop ? "0 14px" : "0 10px",
                fontSize: isDesktop ? 11.5 : 10.5,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {l.label}
            </motion.button>
          ))}
        </div>

        {whoFor === "family" && (
          <input
            value={familyLabel}
            onChange={(e) => setFamilyLabel(e.target.value)}
            placeholder="Family member name (eg: Mom)"
            style={{
              marginTop: 8,
              width: "100%",
              height: isDesktop ? 38 : 34,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.08)",
              padding: "0 12px",
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        )}

        {whoFor === "new" && (
          <input
            value={customProfile}
            onChange={(e) => setCustomProfile(e.target.value)}
            placeholder="Age, gender, condition..."
            style={{
              marginTop: 8,
              width: "100%",
              height: isDesktop ? 38 : 34,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.08)",
              padding: "0 12px",
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        )}
      </div>

      {/* DISCLAIMER */}
      <div
        style={{
          flexShrink: 0,
          margin: isDesktop ? "10px 20px 0" : "8px 12px 0",
          background: "#FFF7ED",
          border: "1px solid #FED7AA",
          borderRadius: 14,
          padding: isDesktop ? "10px 16px" : "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <AlertTriangle style={{ width: 14, height: 14, color: "#C2410C", flexShrink: 0 }} />
        <span style={{ fontSize: isDesktop ? 12 : 11, color: "#9A3412", fontWeight: 700 }}>
          AI guide hai, final diagnosis doctor ka. Emergency me hospital/ambulance call karein.
        </span>
      </div>

      {/* CHAT AREA */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: chatPadding, scrollbarWidth: "none", minHeight: 0 }}>
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <ChatBubble
              key={m.id}
              m={m}
              onSpeak={handleSpeak}
              speakingId={speakingId}
              speakLoading={speakLoading}
              screen={screen}
            />
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", marginBottom: 8 }}>
            <div
              style={{
                width: isDesktop ? 36 : 32,
                height: isDesktop ? 36 : 32,
                borderRadius: 12,
                background: `linear-gradient(135deg,${DEEP},${MID})`,
                display: "grid",
                placeItems: "center",
                boxShadow: "0 2px 8px rgba(12,90,62,0.20)",
              }}
            >
              <Sparkles style={{ width: 14, height: 14, color: ACC }} />
            </div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  style={{ width: 7, height: 7, borderRadius: "50%", background: ACC }}
                />
              ))}
            </div>
            <span style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>
              {attachedFile ? "Analyzing file..." : "Thinking..."}
            </span>
          </motion.div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ATTACHMENT PREVIEW */}
      {attachedFile && (
        <div
          style={{
            flexShrink: 0,
            margin: isDesktop ? "0 20px 4px" : "0 12px 4px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 14,
            background: "#ECFDF5",
            border: "1px solid #A7F3D0",
          }}
        >
          <FileText style={{ width: 14, height: 14, color: "#065F46", flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 800, color: "#065F46", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {attachedFile.name}
          </span>
          {attachedFile.name?.toLowerCase().endsWith(".pdf") && (
            <span style={{ fontSize: 9.5, fontWeight: 900, color: "#059669", background: "#D1FAE5", padding: "2px 7px", borderRadius: 999, flexShrink: 0 }}>
              All pages
            </span>
          )}
          <button
            onClick={() => setAttachedFile(null)}
            style={{ border: "none", background: "none", cursor: "pointer", padding: 0, display: "grid", placeItems: "center" }}
          >
            <X style={{ width: 14, height: 14, color: "#065F46" }} />
          </button>
        </div>
      )}

      {/* INPUT BAR */}
      <div style={{ flexShrink: 0, padding: inputBarPadding, background: SURFACE, backdropFilter: "blur(16px)", borderTop: `1px solid ${GLASS_BORDER}` }}>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.webp"
          style={{ display: "none" }}
          onChange={(e) => setAttachedFile(e.target.files?.[0] || null)}
        />

        <div style={{ display: "flex", alignItems: "flex-end", gap: isDesktop ? 10 : 8 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "flex-end",
              minHeight: btnSize + 4,
              borderRadius: isDesktop ? 18 : 16,
              background: "#fff",
              border: "1.5px solid rgba(12,90,62,0.12)",
              padding: isDesktop ? "8px 16px" : "6px 12px",
              boxSizing: "border-box",
              transition: "border-color 0.15s ease",
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const ta = e.target;
                ta.style.height = "auto";
                ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
              }}
              placeholder={`Message for ${whoForLabel}...`}
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                background: "none",
                border: "none",
                outline: "none",
                fontSize: inputFontSize,
                fontWeight: 700,
                color: "#0F172A",
                lineHeight: 1.5,
                fontFamily: "'Plus Jakarta Sans',sans-serif",
                minHeight: 24,
                maxHeight: 120,
                overflowY: "auto",
                padding: "4px 0",
                boxSizing: "border-box",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
          </div>

          <div style={{ display: "flex", gap: isDesktop ? 8 : 6, paddingBottom: 2, flexShrink: 0 }}>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => fileRef.current?.click()}
              style={{
                width: btnSize,
                height: btnSize,
                borderRadius: isDesktop ? 16 : 14,
                border: `1.5px solid ${GLASS_BORDER}`,
                background: "#fff",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <Paperclip style={{ width: isDesktop ? 19 : 17, height: isDesktop ? 19 : 17, color: DEEP }} />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleMicToggle}
              disabled={micBusy}
              style={{
                width: btnSize,
                height: btnSize,
                borderRadius: isDesktop ? 16 : 14,
                border: "none",
                background: micOn ? "linear-gradient(135deg,#DC2626,#EF4444)" : "#E8F5EF",
                display: "grid",
                placeItems: "center",
                cursor: micBusy ? "wait" : "pointer",
                flexShrink: 0,
                boxShadow: micOn ? "0 4px 14px rgba(220,38,38,0.3)" : "none",
                opacity: micBusy ? 0.75 : 1,
              }}
            >
              {micOn ? (
                <MicOff style={{ width: isDesktop ? 19 : 17, height: isDesktop ? 19 : 17, color: "#fff" }} />
              ) : (
                <Mic style={{ width: isDesktop ? 19 : 17, height: isDesktop ? 19 : 17, color: DEEP }} />
              )}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={sendMessage}
              disabled={loading || (!input.trim() && !attachedFile)}
              style={{
                width: btnSize,
                height: btnSize,
                borderRadius: isDesktop ? 16 : 14,
                border: "none",
                background: loading || (!input.trim() && !attachedFile) ? "#E2E8F0" : `linear-gradient(135deg,${DEEP},${MID})`,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                cursor: loading || (!input.trim() && !attachedFile) ? "not-allowed" : "pointer",
                boxShadow: loading || (!input.trim() && !attachedFile) ? "none" : "0 6px 18px rgba(12,90,62,0.28)",
              }}
            >
              <Send style={{ width: isDesktop ? 19 : 17, height: isDesktop ? 19 : 17, color: loading || (!input.trim() && !attachedFile) ? "#94A3B8" : "#fff" }} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* SIDEBAR */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              style={{ position: "absolute", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width: isDesktop ? "40%" : "80%",
                maxWidth: isDesktop ? 360 : 320,
                zIndex: 50,
                background: "#fff",
                borderTopRightRadius: 28,
                borderBottomRightRadius: 28,
                boxShadow: "20px 0 60px rgba(0,0,0,0.15)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "18px 16px 12px", background: `linear-gradient(135deg,${DEEP},${DARK})` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 900, color: "#fff" }}>
                    Chat History
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSidebarOpen(false)}
                    style={{ width: 30, height: 30, borderRadius: 10, background: "rgba(255,255,255,0.12)", border: "none", display: "grid", placeItems: "center", cursor: "pointer" }}
                  >
                    <X style={{ width: 14, height: 14, color: "#fff" }} />
                  </motion.button>
                </div>
              </div>

              <div style={{ padding: "10px 14px 6px" }}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={startNewChat}
                  style={{
                    width: "100%",
                    height: 42,
                    borderRadius: 14,
                    border: "none",
                    background: `linear-gradient(135deg,${DEEP},${MID})`,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 800,
                    fontFamily: "'Sora',sans-serif",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    boxShadow: "0 4px 14px rgba(12,90,62,0.25)",
                  }}
                >
                  <Plus style={{ width: 15, height: 15 }} /> New Chat
                </motion.button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "6px 14px 20px", scrollbarWidth: "none" }}>
                {sessionsLoading ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "#94A3B8", fontSize: 13, fontWeight: 700 }}>
                    Loading...
                  </div>
                ) : chatSessions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0B1F16", marginBottom: 4 }}>No previous chats</div>
                    <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>Your conversations will appear here</div>
                  </div>
                ) : (
                  chatSessions.map((s) => {
                    const lastMsg = s.messages?.[s.messages.length - 1]?.text || "";
                    const preview = lastMsg.slice(0, 60) + (lastMsg.length > 60 ? "..." : "");
                    const date = s.updatedAt
                      ? new Date(s.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                      : "";

                    return (
                      <motion.button
                        key={s._id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => loadSession(s._id)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "12px 14px",
                          borderRadius: 14,
                          border: "1px solid rgba(12,90,62,0.08)",
                          background: "#F8FAFC",
                          marginBottom: 8,
                          cursor: "pointer",
                          display: "block",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: DEEP, fontFamily: "'Sora',sans-serif" }}>
                            {s.whoForLabel || s.whoFor || "Self"}
                          </span>
                          <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>{date}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600, lineHeight: 1.4 }}>
                          {preview || "Empty chat"}
                        </div>
                        {s.focus && (
                          <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                            <span style={{ fontSize: 9.5, fontWeight: 800, color: "#059669", background: "#ECFDF5", padding: "2px 7px", borderRadius: 999 }}>
                              {s.focus}
                            </span>
                          </div>
                        )}
                      </motion.button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes gdSpin { to { transform: rotate(360deg); } }
        div::-webkit-scrollbar { display: none; }
        textarea::placeholder { color: #94A3B8; font-weight: 600; }
      `}</style>
    </div>
  );
}