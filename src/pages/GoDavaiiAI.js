// pages/GoDavaiiAI.js — GoDavaii 2035 Premium Mobile-First Health AI
// ✅ PREMIUM REDESIGN: ChatGPT-style immersive full-screen AI layout
// ✅ PREMIUM REDESIGN: Minimal top bar + premium history drawer
// ✅ PREMIUM REDESIGN: Context controls moved into bottom sheet
// ✅ PREMIUM REDESIGN: Slim disclaimer pill
// ✅ PREMIUM REDESIGN: Floating composer with better safe-area handling
// ✅ PREMIUM REDESIGN: Better welcome state + quick actions
// ✅ PREMIUM REDESIGN: Richer thinking / analyzing UX
// ✅ FIX: Backend STT mic flow kept using MediaRecorder + /assistant/transcribe
// ✅ FIX: Browser SpeechRecognition kept only as fallback
// ✅ FIX: Reply language chip persisted in localStorage
// ✅ FIX: Existing result / backend / TTS / file logic preserved

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ClipboardList,
  FileText,
  FlaskConical,
  Globe2,
  History,
  Menu,
  Mic,
  MicOff,
  Paperclip,
  Pill,
  Plus,
  ScanSearch,
  Send,
  Settings2,
  Sparkles,
  Stethoscope,
  UserRound,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const FILE_ANALYZE_TIMEOUT_MS = 300000;

/* ── Premium design tokens ───────────────────────────────── */
const DEEP = "#0A5A3B";
const MID = "#0F7A53";
const ACC = "#18E2A1";
const ACC_SOFT = "rgba(24,226,161,0.14)";
const DARK = "#041A12";
const BG_TOP = "#F4FBF8";
const BG_MID = "#EEF8F4";
const BG_BOT = "#F7FAFF";
const GLASS = "rgba(255,255,255,0.82)";
const GLASS_STRONG = "rgba(255,255,255,0.92)";
const GLASS_DARK = "rgba(7,23,17,0.72)";
const GLASS_BORDER = "rgba(12,90,62,0.08)";
const TEXT = "#10231A";
const SUB = "#6A7A73";
const USER_BUBBLE = `linear-gradient(135deg, ${DEEP} 0%, ${MID} 100%)`;

/* ── Modes / controls ────────────────────────────────────── */
const FOCUS = [
  { key: "auto", label: "Auto", icon: Sparkles },
  { key: "symptom", label: "Symptoms", icon: Stethoscope },
  { key: "medicine", label: "Medicine", icon: Pill },
  { key: "rx", label: "Prescription", icon: ClipboardList },
  { key: "lab", label: "Lab Report", icon: FlaskConical },
  { key: "xray", label: "X-Ray / Scan", icon: ScanSearch },
];

const TARGETS = [
  { key: "self", label: "For Me", icon: UserRound },
  { key: "family", label: "For Family", icon: Users },
  { key: "new", label: "New Profile", icon: Plus },
];

const LANG_OPTIONS = [
  { key: "auto", label: "Auto" },
  { key: "hindi", label: "Hindi" },
  { key: "hinglish", label: "Hinglish" },
  { key: "english", label: "English" },
];

/* ── Helpers ──────────────────────────────────────────────── */
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

function getThinkingSteps(hasFile) {
  return hasFile
    ? ["Reading file", "Extracting medical text", "Reviewing findings", "Preparing simple explanation"]
    : ["Reviewing symptoms", "Checking likely causes", "Preparing guidance", "Finalizing response"];
}

function getSafeBottomPadding() {
  return "calc(env(safe-area-inset-bottom, 0px) + 10px)";
}

function SummaryPill({ children, tone = "default" }) {
  const styleMap = {
    default: {
      bg: "rgba(255,255,255,0.72)",
      border: "rgba(12,90,62,0.08)",
      color: TEXT,
    },
    active: {
      bg: ACC_SOFT,
      border: "rgba(24,226,161,0.22)",
      color: DEEP,
    },
    danger: {
      bg: "rgba(255,247,237,0.95)",
      border: "#FED7AA",
      color: "#9A3412",
    },
  };
  const s = styleMap[tone] || styleMap.default;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 28,
        borderRadius: 999,
        padding: "0 11px",
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        fontSize: 11.5,
        fontWeight: 800,
        whiteSpace: "nowrap",
        backdropFilter: "blur(18px)",
      }}
    >
      {children}
    </div>
  );
}

/* ── Reply formatter ──────────────────────────────────────── */
function FormatReply({ text, screen }) {
  const clean = cleanAssistantText(text);
  const isDesktop = screen === "desktop";
  const baseFontSize = isDesktop ? 14.5 : 14;

  const hasSections = /\n\s*(Assessment|Next steps|Warning signs|Desi ilaaj):/i.test(clean);
  if (!hasSections) {
    return (
      <div
        style={{
          whiteSpace: "pre-line",
          lineHeight: 1.78,
          fontSize: baseFontSize,
          fontWeight: 600,
          color: "#1B2B24",
        }}
      >
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
            <div
              key={i}
              style={{
                whiteSpace: "pre-line",
                marginBottom: 8,
                lineHeight: 1.76,
                fontSize: baseFontSize,
                fontWeight: 600,
              }}
            >
              {section.trim()}
            </div>
          );
        }

        const header = headerMatch[1];
        const body = section.slice(headerMatch[0].length).trim();
        const isRed = /red flag|warning sign/i.test(header);
        const isDesi = /desi|home remed/i.test(header);
        const isAssessment = /assessment/i.test(header);

        return (
          <div key={i} style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: isDesktop ? 12.5 : 11.5,
                fontWeight: 900,
                letterSpacing: "0.25px",
                color: isRed ? "#DC2626" : isDesi ? "#059669" : isAssessment ? "#0369A1" : DEEP,
                background: isRed ? "#FEF2F2" : isDesi ? "#ECFDF5" : isAssessment ? "#F0F9FF" : "#EFFAF4",
                padding: "6px 11px",
                borderRadius: 999,
                marginBottom: 9,
                fontFamily: "'Sora','Plus Jakarta Sans',sans-serif",
                border: `1px solid ${isRed ? "#FECACA" : isDesi ? "#A7F3D0" : isAssessment ? "#BAE6FD" : "rgba(12,90,62,0.08)"}`,
              }}
            >
              {header}
            </div>
            <div
              style={{
                whiteSpace: "pre-line",
                lineHeight: 1.8,
                fontSize: baseFontSize,
                fontWeight: 600,
                color: "#1D2B23",
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

/* ── Message bubbles ──────────────────────────────────────── */
function ChatBubble({ m, onSpeak, speakingId, speakLoading, screen }) {
  const isUser = m.role === "user";
  const isSpeaking = speakingId === m.id;
  const isDesktop = screen === "desktop";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: isDesktop ? 18 : 16,
      }}
    >
      {!isUser && (
        <div
          style={{
            width: isDesktop ? 34 : 30,
            height: isDesktop ? 34 : 30,
            borderRadius: 12,
            flexShrink: 0,
            marginRight: 9,
            marginTop: 4,
            background: `linear-gradient(135deg, ${DEEP}, ${MID})`,
            display: "grid",
            placeItems: "center",
            boxShadow: "0 8px 20px rgba(10,90,59,0.18)",
          }}
        >
          <Sparkles style={{ width: 14, height: 14, color: ACC }} />
        </div>
      )}

      <div
        style={{
          maxWidth: isDesktop ? "75%" : "86%",
          borderRadius: isUser ? "22px 22px 8px 22px" : "22px 22px 22px 8px",
          padding: isDesktop ? "16px 18px" : "14px 15px",
          background: isUser ? USER_BUBBLE : GLASS_STRONG,
          border: isUser ? "none" : `1px solid ${GLASS_BORDER}`,
          boxShadow: isUser
            ? "0 12px 28px rgba(10,90,59,0.22)"
            : "0 10px 30px rgba(16,24,40,0.05)",
          backdropFilter: isUser ? "none" : "blur(22px)",
          color: isUser ? "#fff" : "#1B2B24",
        }}
      >
        {isUser ? (
          <div
            style={{
              whiteSpace: "pre-line",
              fontSize: isDesktop ? 14.5 : 14,
              fontWeight: 650,
              lineHeight: 1.66,
            }}
          >
            {m.text}
          </div>
        ) : (
          <FormatReply text={m.text} screen={screen} />
        )}

        {!isUser && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => onSpeak(m)}
            disabled={speakLoading}
            style={{
              marginTop: 11,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: `1px solid ${isSpeaking ? "rgba(24,226,161,0.35)" : "#E5E7EB"}`,
              borderRadius: 999,
              background: isSpeaking ? "#ECFDF5" : "#FAFAFA",
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: 800,
              color: isSpeaking ? "#059669" : "#6B7280",
              cursor: speakLoading ? "wait" : "pointer",
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
              <VolumeX style={{ width: 12, height: 12 }} />
            ) : (
              <Volume2 style={{ width: 12, height: 12 }} />
            )}
            {speakLoading && isSpeaking ? "Loading..." : isSpeaking ? "Stop" : "Listen"}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

function ThinkingBlock({ hasFile }) {
  const steps = getThinkingSteps(hasFile);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 16 }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 12,
          flexShrink: 0,
          marginTop: 4,
          background: `linear-gradient(135deg, ${DEEP}, ${MID})`,
          display: "grid",
          placeItems: "center",
          boxShadow: "0 8px 20px rgba(10,90,59,0.18)",
        }}
      >
        <Sparkles style={{ width: 14, height: 14, color: ACC }} />
      </div>

      <div
        style={{
          maxWidth: "84%",
          borderRadius: "22px 22px 22px 8px",
          padding: "14px 15px",
          background: GLASS_STRONG,
          border: `1px solid ${GLASS_BORDER}`,
          boxShadow: "0 10px 30px rgba(16,24,40,0.05)",
          backdropFilter: "blur(22px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.14 }}
                style={{ width: 7, height: 7, borderRadius: "50%", background: ACC }}
              />
            ))}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: DEEP }}>
            {hasFile ? "Analyzing report" : "Preparing guidance"}
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {steps.map((step, i) => (
            <motion.div
              key={step}
              initial={{ opacity: 0.2 }}
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.22 }}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: i === 0 ? ACC : "rgba(15,122,83,0.25)",
                }}
              />
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5F7068" }}>{step}</div>
            </motion.div>
          ))}
        </div>
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
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const chatScrollRef = useRef(null);
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

  const isDesktop = screen === "desktop";
  const isTablet = screen === "tablet";
  const containerMaxWidth = isDesktop ? 760 : isTablet ? 620 : 560;
  const topPad = isDesktop ? 16 : 12;
  const sidePad = isDesktop ? 20 : 12;
  const btnSize = isDesktop ? 48 : 44;
  const composerPadBottom = getSafeBottomPadding();
  const composerOuterHeight = attachedFile ? 136 : 94;

  const [messages, setMessages] = useState([
    {
      id: makeId(),
      role: "assistant",
      text:
        "Namaste! Main GoDavaii AI hoon — aapka personal health assistant.\n\n" +
        "Symptoms, reports, prescriptions, scans, ya voice se baat karein. Main simple language me samjhaunga.",
    },
  ]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, attachedFile]);

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

  const currentFocusMeta = useMemo(() => FOCUS.find((f) => f.key === focus) || FOCUS[0], [focus]);
  const currentLangMeta = useMemo(() => LANG_OPTIONS.find((l) => l.key === replyLanguage) || LANG_OPTIONS[0], [replyLanguage]);

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
    setMessages([
      {
        id: makeId(),
        role: "assistant",
        text: "Namaste! Aap symptoms, reports, prescriptions, ya scan upload karke seedha puch sakte ho.",
      },
    ]);
    setSidebarOpen(false);
  }

  function QuickActions() {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8, marginTop: 10 }}>
        {[
          { label: "Symptoms", icon: Stethoscope, onClick: () => setFocus("symptom") },
          { label: "Upload Report", icon: FlaskConical, onClick: () => fileRef.current?.click() },
          { label: "Ask by Voice", icon: Mic, onClick: handleMicToggle },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.label}
              whileTap={{ scale: 0.97 }}
              onClick={item.onClick}
              style={{
                border: "1px solid rgba(12,90,62,0.08)",
                background: GLASS_STRONG,
                borderRadius: 18,
                padding: "12px 10px",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 9,
                textAlign: "left",
                boxShadow: "0 10px 30px rgba(16,24,40,0.04)",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  display: "grid",
                  placeItems: "center",
                  background: ACC_SOFT,
                  color: DEEP,
                }}
              >
                <Icon style={{ width: 16, height: 16 }} />
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: TEXT }}>{item.label}</div>
            </motion.button>
          );
        })}
      </div>
    );
  }

  const topSummary = (
    <div
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        paddingBottom: 2,
        scrollbarWidth: "none",
      }}
    >
      <SummaryPill tone="active">
        <Sparkles style={{ width: 12, height: 12 }} />
        {currentFocusMeta.label}
      </SummaryPill>
      <SummaryPill>
        {whoFor === "self" ? <UserRound style={{ width: 12, height: 12 }} /> : <Users style={{ width: 12, height: 12 }} />}
        {whoForLabel}
      </SummaryPill>
      <SummaryPill>
        <Globe2 style={{ width: 12, height: 12 }} />
        {currentLangMeta.label}
      </SummaryPill>
    </div>
  );

  return (
    <div
      style={{
        maxWidth: containerMaxWidth,
        width: "100%",
        margin: "0 auto",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(180deg, ${BG_TOP} 0%, ${BG_MID} 44%, ${BG_BOT} 100%)`,
        fontFamily: "'Plus Jakarta Sans',sans-serif",
        overflow: "hidden",
        position: "relative",
        ...(isDesktop
          ? {
              borderLeft: "1px solid rgba(12,90,62,0.06)",
              borderRight: "1px solid rgba(12,90,62,0.06)",
              boxShadow: "0 0 70px rgba(12,90,62,0.06)",
            }
          : {}),
      }}
    >
      {/* Ambient background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at top right, rgba(24,226,161,0.10), transparent 28%), radial-gradient(circle at bottom left, rgba(15,122,83,0.07), transparent 25%)",
        }}
      />

      {/* TOP BAR */}
      <div
        style={{
          position: "relative",
          zIndex: 20,
          padding: `${topPad}px ${sidePad}px 8px`,
          paddingTop: `calc(${topPad}px + env(safe-area-inset-top, 0px))`,
          backdropFilter: "blur(24px)",
          background: "linear-gradient(180deg, rgba(244,251,248,0.92), rgba(244,251,248,0.76))",
          borderBottom: "1px solid rgba(12,90,62,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              setSidebarOpen(true);
              loadChatHistory();
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              border: "1px solid rgba(12,90,62,0.08)",
              background: GLASS_STRONG,
              display: "grid",
              placeItems: "center",
              boxShadow: "0 10px 24px rgba(16,24,40,0.04)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Menu style={{ width: 18, height: 18, color: TEXT }} />
          </motion.button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: isDesktop ? 18 : 16, fontWeight: 900, color: TEXT }}>
              GoDavaii AI
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: SUB, marginTop: 1 }}>
              Personal health assistant
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setSettingsOpen(true)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              border: "1px solid rgba(12,90,62,0.08)",
              background: GLASS_STRONG,
              display: "grid",
              placeItems: "center",
              boxShadow: "0 10px 24px rgba(16,24,40,0.04)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Settings2 style={{ width: 18, height: 18, color: TEXT }} />
          </motion.button>
        </div>

        <div style={{ marginTop: 10 }}>{topSummary}</div>

        <div style={{ marginTop: 9, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <SummaryPill tone="danger">
            <AlertTriangle style={{ width: 12, height: 12 }} />
            AI guide hai. Emergency me hospital/ambulance call karein.
          </SummaryPill>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate("/home")}
            style={{
              border: "none",
              background: "transparent",
              color: SUB,
              fontSize: 11.5,
              fontWeight: 800,
              cursor: "pointer",
              padding: "0 2px",
              flexShrink: 0,
            }}
          >
            Close
          </motion.button>
        </div>
      </div>

      {/* CHAT AREA */}
      <div
        ref={chatScrollRef}
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: `14px ${sidePad}px ${composerOuterHeight + 26}px`,
          scrollbarWidth: "none",
          minHeight: 0,
        }}
      >
        {messages.length <= 1 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginBottom: 18,
              borderRadius: 28,
              padding: isDesktop ? "22px 22px" : "18px 16px",
              background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.78))",
              border: `1px solid ${GLASS_BORDER}`,
              boxShadow: "0 18px 40px rgba(16,24,40,0.05)",
              backdropFilter: "blur(26px)",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 16,
                display: "grid",
                placeItems: "center",
                background: `linear-gradient(135deg, ${DEEP}, ${MID})`,
                boxShadow: "0 14px 28px rgba(10,90,59,0.18)",
                marginBottom: 14,
              }}
            >
              <Sparkles style={{ width: 18, height: 18, color: ACC }} />
            </div>

            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: isDesktop ? 22 : 18, fontWeight: 900, color: TEXT, lineHeight: 1.2 }}>
              Premium health AI for symptoms, reports, prescriptions, and scans
            </div>

            <div style={{ marginTop: 9, fontSize: 14, lineHeight: 1.72, color: SUB, fontWeight: 600 }}>
              Type naturally, speak by voice, or upload a report. I’ll explain things simply and clearly.
            </div>

            <QuickActions />
          </motion.div>
        )}

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

        {loading && <ThinkingBlock hasFile={Boolean(attachedFile)} />}

        <div ref={chatEndRef} />
      </div>

      {/* COMPOSER */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 25,
          padding: `10px ${sidePad}px ${composerPadBottom}`,
          background: "linear-gradient(180deg, rgba(247,250,255,0), rgba(247,250,255,0.82) 22%, rgba(247,250,255,0.96) 70%)",
          backdropFilter: "blur(24px)",
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <AnimatePresence>
            {attachedFile && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                style={{
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 18,
                  background: "rgba(236,253,245,0.95)",
                  border: "1px solid #A7F3D0",
                  boxShadow: "0 12px 28px rgba(16,24,40,0.04)",
                }}
              >
                <FileText style={{ width: 15, height: 15, color: "#065F46", flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: "#065F46",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {attachedFile.name}
                </span>
                {attachedFile.name?.toLowerCase().endsWith(".pdf") && (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 900,
                      color: "#059669",
                      background: "#D1FAE5",
                      padding: "3px 7px",
                      borderRadius: 999,
                      flexShrink: 0,
                    }}
                  >
                    All pages
                  </span>
                )}
                <button
                  onClick={() => setAttachedFile(null)}
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    padding: 0,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <X style={{ width: 14, height: 14, color: "#065F46" }} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.webp"
            style={{ display: "none" }}
            onChange={(e) => setAttachedFile(e.target.files?.[0] || null)}
          />

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              borderRadius: 24,
              background: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(12,90,62,0.10)",
              boxShadow: "0 20px 40px rgba(16,24,40,0.08)",
              padding: "8px 8px 8px 12px",
              backdropFilter: "blur(22px)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
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
                  width: "100%",
                  resize: "none",
                  background: "none",
                  border: "none",
                  outline: "none",
                  fontSize: isDesktop ? 15 : 14,
                  fontWeight: 700,
                  color: "#0F172A",
                  lineHeight: 1.5,
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                  minHeight: 26,
                  maxHeight: 120,
                  overflowY: "auto",
                  padding: "6px 2px 4px 0",
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

            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => fileRef.current?.click()}
                style={{
                  width: btnSize,
                  height: btnSize,
                  borderRadius: 16,
                  border: "1px solid rgba(12,90,62,0.08)",
                  background: "#fff",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <Paperclip style={{ width: 18, height: 18, color: DEEP }} />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleMicToggle}
                disabled={micBusy}
                style={{
                  width: btnSize,
                  height: btnSize,
                  borderRadius: 16,
                  border: "none",
                  background: micOn ? "linear-gradient(135deg,#DC2626,#EF4444)" : "rgba(24,226,161,0.10)",
                  display: "grid",
                  placeItems: "center",
                  cursor: micBusy ? "wait" : "pointer",
                  boxShadow: micOn ? "0 10px 24px rgba(220,38,38,0.26)" : "none",
                  opacity: micBusy ? 0.72 : 1,
                }}
              >
                {micOn ? (
                  <MicOff style={{ width: 18, height: 18, color: "#fff" }} />
                ) : (
                  <Mic style={{ width: 18, height: 18, color: DEEP }} />
                )}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={sendMessage}
                disabled={loading || (!input.trim() && !attachedFile)}
                style={{
                  width: btnSize,
                  height: btnSize,
                  borderRadius: 16,
                  border: "none",
                  background:
                    loading || (!input.trim() && !attachedFile)
                      ? "#E2E8F0"
                      : `linear-gradient(135deg, ${DEEP}, ${MID})`,
                  display: "grid",
                  placeItems: "center",
                  cursor: loading || (!input.trim() && !attachedFile) ? "not-allowed" : "pointer",
                  boxShadow:
                    loading || (!input.trim() && !attachedFile)
                      ? "none"
                      : "0 14px 28px rgba(10,90,59,0.22)",
                }}
              >
                <Send
                  style={{
                    width: 18,
                    height: 18,
                    color: loading || (!input.trim() && !attachedFile) ? "#94A3B8" : "#fff",
                  }}
                />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* HISTORY DRAWER */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 40,
                background: "rgba(0,0,0,0.36)",
                backdropFilter: "blur(6px)",
              }}
            />

            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width: isDesktop ? "38%" : "84%",
                maxWidth: 360,
                zIndex: 50,
                background: "linear-gradient(180deg, rgba(7,23,17,0.92), rgba(7,23,17,0.86))",
                color: "#fff",
                backdropFilter: "blur(26px)",
                borderTopRightRadius: 28,
                borderBottomRightRadius: 28,
                boxShadow: "20px 0 60px rgba(0,0,0,0.22)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: `18px 16px 14px`,
                  paddingTop: `calc(18px + env(safe-area-inset-top, 0px))`,
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 900 }}>
                      Chat History
                    </div>
                    <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.72)", fontWeight: 700, marginTop: 2 }}>
                      Recent AI conversations
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setSidebarOpen(false)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.10)",
                      border: "none",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                    }}
                  >
                    <X style={{ width: 15, height: 15, color: "#fff" }} />
                  </motion.button>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={startNewChat}
                  style={{
                    width: "100%",
                    height: 44,
                    marginTop: 14,
                    borderRadius: 14,
                    border: "none",
                    background: `linear-gradient(135deg, ${DEEP}, ${MID})`,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 900,
                    fontFamily: "'Sora',sans-serif",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "0 14px 28px rgba(10,90,59,0.28)",
                  }}
                >
                  <Plus style={{ width: 15, height: 15 }} />
                  New Chat
                </motion.button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 24px", scrollbarWidth: "none" }}>
                {sessionsLoading ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.70)", fontSize: 13, fontWeight: 700 }}>
                    Loading...
                  </div>
                ) : chatSessions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 10px" }}>
                    <div style={{ fontSize: 34, marginBottom: 12 }}>💬</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", marginBottom: 4 }}>
                      No previous chats
                    </div>
                    <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.68)", fontWeight: 600 }}>
                      Your AI sessions will appear here
                    </div>
                  </div>
                ) : (
                  chatSessions.map((s) => {
                    const lastMsg = s.messages?.[s.messages.length - 1]?.text || "";
                    const preview = lastMsg.slice(0, 70) + (lastMsg.length > 70 ? "..." : "");
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
                          padding: "13px 13px",
                          borderRadius: 18,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.05)",
                          marginBottom: 8,
                          cursor: "pointer",
                          display: "block",
                          backdropFilter: "blur(12px)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                          <span style={{ fontSize: 12, fontWeight: 900, color: "#fff", fontFamily: "'Sora',sans-serif" }}>
                            {s.whoForLabel || s.whoFor || "Self"}
                          </span>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.58)", fontWeight: 700 }}>
                            {date}
                          </span>
                        </div>

                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.70)", fontWeight: 600, lineHeight: 1.45 }}>
                          {preview || "Empty chat"}
                        </div>

                        {s.focus && (
                          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 900,
                                color: "#B8FFE5",
                                background: "rgba(24,226,161,0.12)",
                                padding: "3px 7px",
                                borderRadius: 999,
                                border: "1px solid rgba(24,226,161,0.14)",
                              }}
                            >
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

      {/* SETTINGS SHEET */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSettingsOpen(false)}
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 60,
                background: "rgba(0,0,0,0.28)",
                backdropFilter: "blur(6px)",
              }}
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 70,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,255,0.98))",
                borderTop: "1px solid rgba(12,90,62,0.08)",
                boxShadow: "0 -24px 60px rgba(16,24,40,0.12)",
                backdropFilter: "blur(28px)",
                padding: "12px 14px 20px",
                paddingBottom: `calc(20px + env(safe-area-inset-bottom, 0px))`,
                maxHeight: "82dvh",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 5,
                  borderRadius: 999,
                  background: "rgba(15,122,83,0.18)",
                  margin: "0 auto 12px",
                }}
              />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 900, color: TEXT }}>
                    Assistant Settings
                  </div>
                  <div style={{ fontSize: 12, color: SUB, fontWeight: 700, marginTop: 2 }}>
                    Customize focus, profile, and reply language
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setSettingsOpen(false)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    border: "1px solid rgba(12,90,62,0.08)",
                    background: "#fff",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <X style={{ width: 15, height: 15, color: TEXT }} />
                </motion.button>
              </div>

              {/* Focus */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: TEXT, marginBottom: 10, letterSpacing: "0.2px" }}>
                  Focus Mode
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
                  {FOCUS.map((m) => {
                    const Icon = m.icon;
                    const active = focus === m.key;
                    return (
                      <motion.button
                        key={m.key}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setFocus(m.key)}
                        style={{
                          borderRadius: 18,
                          border: active ? "1px solid rgba(24,226,161,0.24)" : "1px solid rgba(12,90,62,0.08)",
                          background: active ? ACC_SOFT : "#fff",
                          padding: "13px 12px",
                          textAlign: "left",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 12,
                              display: "grid",
                              placeItems: "center",
                              background: active ? "rgba(24,226,161,0.18)" : "rgba(12,90,62,0.06)",
                              color: active ? DEEP : TEXT,
                            }}
                          >
                            <Icon style={{ width: 15, height: 15 }} />
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: TEXT }}>{m.label}</div>
                        </div>
                        {active && <Check style={{ width: 15, height: 15, color: DEEP }} />}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Who for */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: TEXT, marginBottom: 10, letterSpacing: "0.2px" }}>
                  Who is this for?
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {TARGETS.map((t) => {
                    const Icon = t.icon;
                    const active = whoFor === t.key;
                    return (
                      <motion.button
                        key={t.key}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setWhoFor(t.key)}
                        style={{
                          borderRadius: 18,
                          border: active ? "1px solid rgba(24,226,161,0.24)" : "1px solid rgba(12,90,62,0.08)",
                          background: active ? ACC_SOFT : "#fff",
                          padding: "13px 12px",
                          textAlign: "left",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 12,
                              display: "grid",
                              placeItems: "center",
                              background: active ? "rgba(24,226,161,0.18)" : "rgba(12,90,62,0.06)",
                              color: active ? DEEP : TEXT,
                            }}
                          >
                            <Icon style={{ width: 15, height: 15 }} />
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: TEXT }}>{t.label}</div>
                        </div>
                        {active && <Check style={{ width: 15, height: 15, color: DEEP }} />}
                      </motion.button>
                    );
                  })}
                </div>

                {whoFor === "family" && (
                  <input
                    value={familyLabel}
                    onChange={(e) => setFamilyLabel(e.target.value)}
                    placeholder="Family member name (eg: Mom)"
                    style={{
                      marginTop: 10,
                      width: "100%",
                      height: 44,
                      borderRadius: 14,
                      border: "1px solid rgba(12,90,62,0.10)",
                      background: "#fff",
                      padding: "0 13px",
                      fontSize: 13,
                      fontWeight: 700,
                      color: TEXT,
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
                      marginTop: 10,
                      width: "100%",
                      height: 44,
                      borderRadius: 14,
                      border: "1px solid rgba(12,90,62,0.10)",
                      background: "#fff",
                      padding: "0 13px",
                      fontSize: 13,
                      fontWeight: 700,
                      color: TEXT,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                )}
              </div>

              {/* Language */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: TEXT, marginBottom: 10, letterSpacing: "0.2px" }}>
                  Reply Language
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
                  {LANG_OPTIONS.map((l) => {
                    const active = replyLanguage === l.key;
                    return (
                      <motion.button
                        key={l.key}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setReplyLanguage(l.key)}
                        style={{
                          borderRadius: 16,
                          border: active ? "1px solid rgba(24,226,161,0.24)" : "1px solid rgba(12,90,62,0.08)",
                          background: active ? ACC_SOFT : "#fff",
                          padding: "12px 12px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: TEXT }}>{l.label}</span>
                        {active && <Check style={{ width: 15, height: 15, color: DEEP }} />}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes gdSpin { to { transform: rotate(360deg); } }
        div::-webkit-scrollbar { display: none; }
        textarea::placeholder { color: #98A8A1; font-weight: 600; }
        input::placeholder { color: #98A8A1; }
      `}</style>
    </div>
  );
}