// pages/GoDavaiiAI.js — GoDavaii 2035 Health OS AI Assistant
// ✅ FIX: Input bar bottom padding reduced (70px → 62px) for tighter fit
// ✅ FIX: TTS timeout increased (15s → 30s) for long responses
// ✅ FIX: TTS error handling — speakLoading properly reset in ALL error paths
// ✅ FIX: Auth token sent with all API requests
// ✅ FIX: TTS audio error handling with proper cleanup
// ✅ NO double header — Navbar hidden via HIDE_ENTIRE_NAVBAR in Navbar.js
// ✅ NO desi toggle — desiIlaaj always ON
// ✅ NO language selector — always hinglish
// ✅ Focus chips STICKY in header
// ✅ ChatGPT-style sidebar with recent chats

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  FileText,
  History,
  Mic,
  MicOff,
  Paperclip,
  Plus,
  Send,
  Volume2,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

/* ── Design tokens ────────────────────────────────────────── */
const DEEP = "#0C5A3E";
const MID = "#0E7A4F";
const ACC = "#00D97E";
const DARK = "#041F15";
const GLASS = "rgba(255,255,255,0.82)";
const GLASS_BORDER = "rgba(12,90,62,0.10)";

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

/* ── Auth header helper ───────────────────────────────────── */
function getAuthHeaders() {
  const token = localStorage.getItem("token");
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/* ── Format sections nicely ───────────────────────────────── */
function FormatReply({ text }) {
  const clean = cleanAssistantText(text);
  const sections = clean.split(
    /\n(?=(?:Assessment|Next steps|Red flags|When to see doctor|Desi ilaaj|Home remedies):)/i
  );

  return (
    <div>
      {sections.map((section, i) => {
        const headerMatch = section.match(
          /^(Assessment|Next steps|Red flags|When to see doctor|Desi ilaaj|Home remedies):/i
        );
        if (!headerMatch) {
          return (
            <div key={i} style={{ whiteSpace: "pre-line", marginBottom: 8 }}>
              {section.trim()}
            </div>
          );
        }
        const header = headerMatch[1];
        const body = section.slice(headerMatch[0].length).trim();
        const isRed = /red flag/i.test(header);
        const isDesi = /desi|home remed/i.test(header);

        return (
          <div key={i} style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: "0.3px",
                color: isRed ? "#DC2626" : isDesi ? "#059669" : DEEP,
                background: isRed ? "#FEF2F2" : isDesi ? "#ECFDF5" : "#F0FAF5",
                padding: "4px 10px",
                borderRadius: 8,
                marginBottom: 6,
                fontFamily: "'Sora',sans-serif",
              }}
            >
              {isRed ? "🚨" : isDesi ? "🌿" : "📋"} {header}
            </div>
            <div
              style={{
                whiteSpace: "pre-line",
                lineHeight: 1.7,
                fontSize: 13.5,
                fontWeight: 600,
                color: "#1F2937",
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
function ChatBubble({ m, onSpeak, speakingId, speakLoading }) {
  const isUser = m.role === "user";
  const isSpeaking = speakingId === m.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 12,
      }}
    >
      {!isUser && (
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            flexShrink: 0,
            marginRight: 8,
            marginTop: 2,
            background: `linear-gradient(135deg,${DEEP},${MID})`,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Brain style={{ width: 14, height: 14, color: ACC }} />
        </div>
      )}
      <div
        style={{
          maxWidth: "85%",
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          padding: "12px 14px",
          background: isUser
            ? `linear-gradient(135deg,${DEEP},${MID})`
            : GLASS,
          border: isUser ? "none" : `1px solid ${GLASS_BORDER}`,
          boxShadow: isUser
            ? "0 4px 16px rgba(12,90,62,0.20)"
            : "0 2px 12px rgba(0,0,0,0.04)",
          backdropFilter: isUser ? "none" : "blur(12px)",
          color: isUser ? "#fff" : "#1F2937",
        }}
      >
        {isUser ? (
          <div style={{ whiteSpace: "pre-line", fontSize: 13.5, fontWeight: 650, lineHeight: 1.6 }}>
            {m.text}
          </div>
        ) : (
          <FormatReply text={m.text} />
        )}
        {!isUser && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => onSpeak(m)}
            disabled={speakLoading}
            style={{
              marginTop: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              border: `1px solid ${isSpeaking ? ACC : "#E2E8F0"}`,
              borderRadius: 999,
              background: isSpeaking ? "#ECFDF5" : "#fff",
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 800,
              color: isSpeaking ? "#059669" : "#0F766E",
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
            ) : (
              <Volume2 style={{ width: 11, height: 11 }} />
            )}
            {speakLoading && isSpeaking ? "Loading..." : isSpeaking ? "Playing..." : "Listen"}
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
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [focus, setFocus] = useState("auto");
  const [whoFor, setWhoFor] = useState("self");
  const [familyLabel, setFamilyLabel] = useState("");
  const [customProfile, setCustomProfile] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [speakLoading, setSpeakLoading] = useState(false);

  const recognitionRef = useRef(null);
  const fileRef = useRef(null);
  const chatEndRef = useRef(null);
  const audioRef = useRef(null);
  const msgIdCounter = useRef(1);

  const makeId = () => `msg-${msgIdCounter.current++}`;

  const [messages, setMessages] = useState([
    {
      id: makeId(),
      role: "assistant",
      text: "Namaste! Main GoDavaii AI hoon — aapka personal health assistant.\n\nAap mujhse pooch sakte ho:\n🩺 Symptoms explain karo\n💊 Medicine side effects\n📋 Prescription samjhao\n🧪 Lab report analyze karo (multi-page PDF)\n🦴 X-Ray / CT scan explain karo\n🌿 Desi ilaaj har response me included\n\nText, voice, ya file upload — sab kaam karega!",
    },
  ]);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const whoForLabel = useMemo(() => {
    if (whoFor === "family" && familyLabel.trim()) return familyLabel.trim();
    if (whoFor === "new" && customProfile.trim()) return customProfile.trim();
    if (whoFor === "self") return user?.name || "Self";
    return whoFor === "family" ? "Family Member" : "New Profile";
  }, [whoFor, familyLabel, customProfile, user?.name]);

  // Context — desiIlaaj ALWAYS true, language ALWAYS hinglish
  const profileContext = useMemo(
    () => ({
      whoFor,
      whoForLabel,
      language: "hinglish",
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
    [whoFor, whoForLabel, focus, user]
  );

  /* ── TTS — server first, with PROPER error handling ────── */
  const handleSpeak = useCallback(
    async (msg) => {
      // Stop current audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      window.speechSynthesis?.cancel();

      // Toggle off if already speaking this message
      if (speakingId === msg.id) {
        setSpeakingId(null);
        setSpeakLoading(false);
        return;
      }

      setSpeakingId(msg.id);
      setSpeakLoading(true);

      const text = cleanAssistantText(msg.text);

      // ✅ FIX: Server TTS with proper error handling & increased timeout
      try {
        const { data } = await axios.post(
          `${API}/api/ai/assistant/tts`,
          { text: text.slice(0, 3000), language: "hinglish" },
          {
            timeout: 30000, // ✅ FIX: 30s timeout (was 15s — too short for long texts)
            headers: getAuthHeaders(),
          }
        );

        if (data?.audioBase64) {
          const audio = new Audio(`data:audio/mp3;base64,${data.audioBase64}`);
          audioRef.current = audio;

          // ✅ FIX: Proper cleanup on all audio events
          audio.onended = () => {
            setSpeakingId(null);
            setSpeakLoading(false);
            audioRef.current = null;
          };
          audio.onerror = (e) => {
            console.error("Audio playback error:", e);
            setSpeakingId(null);
            setSpeakLoading(false);
            audioRef.current = null;
          };

          setSpeakLoading(false);

          try {
            await audio.play();
          } catch (playErr) {
            console.error("Audio play failed:", playErr);
            setSpeakingId(null);
            setSpeakLoading(false);
            audioRef.current = null;
          }
          return;
        }
      } catch (err) {
        console.error("TTS API failed:", err?.message || err);
        // Fall through to browser TTS
      }

      // ✅ FIX: Browser TTS fallback with proper state management
      setSpeakLoading(false);
      if (window.speechSynthesis) {
        try {
          const u = new SpeechSynthesisUtterance(text);
          u.rate = 0.92;
          u.pitch = 1.05;
          u.lang = "hi-IN";
          u.onend = () => {
            setSpeakingId(null);
          };
          u.onerror = () => {
            setSpeakingId(null);
          };
          window.speechSynthesis.speak(u);
        } catch {
          setSpeakingId(null);
        }
      } else {
        setSpeakingId(null);
      }
    },
    [speakingId]
  );

  /* ── Mic toggle ─────────────────────────────────────────── */
  function handleMicToggle() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (micOn && recognitionRef.current) {
      recognitionRef.current.stop();
      setMicOn(false);
      return;
    }
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onstart = () => setMicOn(true);
    rec.onend = () => setMicOn(false);
    rec.onerror = () => setMicOn(false);
    rec.onresult = (e) => {
      const txt = e.results?.[0]?.[0]?.transcript || "";
      if (txt.trim()) setInput((prev) => `${prev}${prev ? " " : ""}${txt.trim()}`);
    };
    rec.start();
  }

  /* ── Backend calls — ✅ FIX: Auth headers included ──────── */
  async function askBackend(messageText, history) {
    const payload = { message: messageText, history, context: profileContext };
    const headers = getAuthHeaders();
    const urls = [
      `${API}/api/ai/assistant/chat`,
      `${API}/api/ai/chat`,
      `${API}/api/ai/assistant`,
    ];
    for (const url of urls) {
      try {
        const r = await axios.post(url, payload, { timeout: 25000, headers });
        const text = r?.data?.reply || r?.data?.answer || r?.data?.message || "";
        if (String(text).trim()) return text;
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
    const urls = [
      `${API}/api/ai/assistant/analyze-file`,
      `${API}/api/ai/analyze-file`,
    ];
    let lastErr = null;
    for (const url of urls) {
      try {
        const r = await axios.post(url, fd, {
          timeout: 90000,
          headers,
        });
        const text = r?.data?.reply || r?.data?.answer || r?.data?.message || "";
        if (String(text).trim()) return text;
        lastErr = new Error("Empty reply");
      } catch (err) {
        lastErr = err;
        console.error("File AI failed:", url, getApiErrorMessage(err));
      }
    }
    return `File analysis issue: ${getApiErrorMessage(lastErr)}\n\nPlease retry with a clearer image.`;
  }

  /* ── Send message ───────────────────────────────────────── */
  async function sendMessage() {
    const msg = input.trim();
    const activeFile = attachedFile;
    if (!msg && !activeFile) return;
    if (loading) return;

    const userBubbleText = activeFile
      ? `${msg || "(file uploaded)"}\n📎 ${activeFile.name}`
      : msg;
    const userMsg = { id: makeId(), role: "user", text: userBubbleText };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const history = buildCompactHistory(nextMessages);
      const reply = activeFile
        ? await askBackendWithFile(msg, history, activeFile)
        : await askBackend(msg, history);

      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: "assistant", text: reply },
      ]);
      if (activeFile) setAttachedFile(null);
    } finally {
      setLoading(false);
    }
  }

  /* ── Load chat history — ✅ FIX: Auth headers ──────────── */
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
      const { data } = await axios.get(
        `${API}/api/ai/assistant/sessions/${sessionId}`,
        { headers: getAuthHeaders() }
      );
      if (data?.messages?.length) {
        setMessages(
          data.messages.map((m, i) => ({ id: `hist-${i}`, role: m.role, text: m.text }))
        );
      }
      setSidebarOpen(false);
    } catch {}
  }

  function startNewChat() {
    setMessages([
      {
        id: makeId(),
        role: "assistant",
        text: "New chat started! Kya help chahiye aapko?",
      },
    ]);
    setSidebarOpen(false);
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <div
      style={{
        maxWidth: 520,
        margin: "0 auto",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background:
          "linear-gradient(170deg,#F0FAF5 0%,#E8F5EF 35%,#EFF6FF 65%,#F5F3FF 85%,#F8FAFC 100%)",
        fontFamily: "'Plus Jakarta Sans',sans-serif",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ══ HEADER ══ */}
      <div
        style={{
          flexShrink: 0,
          zIndex: 30,
          padding: "12px 14px 10px",
          background: `linear-gradient(135deg,${DEEP} 0%,${DARK} 100%)`,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          boxShadow: "0 8px 32px rgba(12,90,62,0.25)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative glow */}
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

        {/* Top row: history + title + close */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setSidebarOpen(true);
              loadChatHistory();
            }}
            style={{
              width: 36,
              height: 36,
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
            <div
              style={{
                fontFamily: "'Sora',sans-serif",
                fontSize: 16,
                fontWeight: 900,
                color: "#fff",
                letterSpacing: "-0.3px",
              }}
            >
              GoDavaii AI
            </div>
            <div style={{ fontSize: 10.5, color: ACC, fontWeight: 700, marginTop: 1 }}>
              Health assistant · Voice · Files · {whoForLabel}
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate("/home")}
            style={{
              width: 36,
              height: 36,
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

        {/* Focus chips — always visible */}
        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 6,
            overflowX: "auto",
            paddingBottom: 2,
            scrollbarWidth: "none",
          }}
        >
          {FOCUS.map((m) => (
            <motion.button
              key={m.key}
              whileTap={{ scale: 0.93 }}
              onClick={() => setFocus(m.key)}
              style={{
                flexShrink: 0,
                height: 32,
                borderRadius: 999,
                border: focus === m.key ? "none" : "1px solid rgba(255,255,255,0.18)",
                background: focus === m.key ? ACC : "rgba(255,255,255,0.08)",
                color: focus === m.key ? DEEP : "#fff",
                padding: "0 12px",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: "'Sora',sans-serif",
                display: "flex",
                alignItems: "center",
                gap: 4,
                boxShadow: focus === m.key ? `0 4px 14px ${ACC}40` : "none",
              }}
            >
              <span style={{ fontSize: 12 }}>{m.icon}</span> {m.label}
            </motion.button>
          ))}
        </div>

        {/* Target row */}
        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 6,
            alignItems: "center",
            overflowX: "auto",
            scrollbarWidth: "none",
            paddingBottom: 2,
          }}
        >
          {TARGETS.map((t) => (
            <motion.button
              key={t.key}
              whileTap={{ scale: 0.93 }}
              onClick={() => setWhoFor(t.key)}
              style={{
                flexShrink: 0,
                height: 28,
                borderRadius: 999,
                border: whoFor === t.key ? "none" : "1px solid rgba(255,255,255,0.15)",
                background: whoFor === t.key ? "rgba(0,217,126,0.25)" : "transparent",
                color: "#fff",
                padding: "0 10px",
                fontSize: 10.5,
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

        {whoFor === "family" && (
          <input
            value={familyLabel}
            onChange={(e) => setFamilyLabel(e.target.value)}
            placeholder="Family member name (eg: Mom)"
            style={{
              marginTop: 8,
              width: "100%",
              height: 34,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.08)",
              padding: "0 10px",
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
              outline: "none",
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
              height: 34,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.08)",
              padding: "0 10px",
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
              outline: "none",
            }}
          />
        )}
      </div>

      {/* ══ DISCLAIMER ══ */}
      <div
        style={{
          flexShrink: 0,
          margin: "8px 12px 0",
          background: "#FFF7ED",
          border: "1px solid #FED7AA",
          borderRadius: 14,
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <AlertTriangle style={{ width: 14, height: 14, color: "#C2410C", flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: "#9A3412", fontWeight: 700 }}>
          AI guide hai, final diagnosis doctor ka. Emergency me hospital/ambulance call karein.
        </span>
      </div>

      {/* ══ CHAT AREA ══ */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "12px 12px 4px",
          scrollbarWidth: "none",
        }}
      >
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <ChatBubble
              key={m.id}
              m={m}
              onSpeak={handleSpeak}
              speakingId={speakingId}
              speakLoading={speakLoading}
            />
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                background: `linear-gradient(135deg,${DEEP},${MID})`,
                display: "grid",
                placeItems: "center",
              }}
            >
              <Brain style={{ width: 14, height: 14, color: ACC }} />
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  style={{ width: 7, height: 7, borderRadius: "50%", background: ACC }}
                />
              ))}
            </div>
            <span style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>Analyzing...</span>
          </motion.div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* ══ ATTACHMENT PREVIEW ══ */}
      {attachedFile && (
        <div
          style={{
            flexShrink: 0,
            margin: "0 12px 4px",
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
          <span
            style={{
              fontSize: 12,
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
                padding: "2px 7px",
                borderRadius: 999,
                flexShrink: 0,
              }}
            >
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

      {/* ══ INPUT BAR — ✅ FIX: padding 62px (was 70px) ══ */}
      <div
        style={{
          flexShrink: 0,
          padding: "8px 12px 62px 12px",
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(16px)",
          borderTop: `1px solid ${GLASS_BORDER}`,
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.webp"
          style={{ display: "none" }}
          onChange={(e) => setAttachedFile(e.target.files?.[0] || null)}
        />

        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "flex-end",
              minHeight: 46,
              borderRadius: 16,
              background: "#F8FAFC",
              border: "1.5px solid rgba(12,90,62,0.12)",
              padding: "6px 12px",
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Message for ${whoForLabel}...`}
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                background: "none",
                border: "none",
                outline: "none",
                fontSize: 14,
                fontWeight: 700,
                color: "#0F172A",
                lineHeight: 1.5,
                fontFamily: "'Plus Jakarta Sans',sans-serif",
                maxHeight: 120,
                overflowY: "auto",
              }}
              onInput={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 6, paddingBottom: 2 }}>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => fileRef.current?.click()}
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                border: `1.5px solid ${GLASS_BORDER}`,
                background: "#fff",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
            >
              <Paperclip style={{ width: 17, height: 17, color: DEEP }} />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleMicToggle}
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                border: "none",
                background: micOn ? "linear-gradient(135deg,#DC2626,#EF4444)" : "#E8F5EF",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
            >
              {micOn ? (
                <MicOff style={{ width: 17, height: 17, color: "#fff" }} />
              ) : (
                <Mic style={{ width: 17, height: 17, color: DEEP }} />
              )}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={sendMessage}
              disabled={loading || (!input.trim() && !attachedFile)}
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                border: "none",
                background:
                  loading || (!input.trim() && !attachedFile)
                    ? "#E2E8F0"
                    : `linear-gradient(135deg,${DEEP},${MID})`,
                display: "grid",
                placeItems: "center",
                cursor:
                  loading || (!input.trim() && !attachedFile) ? "not-allowed" : "pointer",
                boxShadow:
                  loading || (!input.trim() && !attachedFile)
                    ? "none"
                    : "0 6px 18px rgba(12,90,62,0.28)",
              }}
            >
              <Send
                style={{
                  width: 17,
                  height: 17,
                  color:
                    loading || (!input.trim() && !attachedFile) ? "#94A3B8" : "#fff",
                }}
              />
            </motion.button>
          </div>
        </div>
      </div>

      {/* ══ CHAT HISTORY SIDEBAR ══ */}
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
                background: "rgba(0,0,0,0.4)",
                backdropFilter: "blur(4px)",
              }}
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
                width: "80%",
                maxWidth: 320,
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
              <div
                style={{
                  padding: "18px 16px 12px",
                  background: `linear-gradient(135deg,${DEEP},${DARK})`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Sora',sans-serif",
                      fontSize: 16,
                      fontWeight: 900,
                      color: "#fff",
                    }}
                  >
                    Chat History
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSidebarOpen(false)}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.12)",
                      border: "none",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                    }}
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

              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "6px 14px 20px",
                  scrollbarWidth: "none",
                }}
              >
                {sessionsLoading ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "40px 0",
                      color: "#94A3B8",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    Loading...
                  </div>
                ) : chatSessions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0B1F16", marginBottom: 4 }}>
                      No previous chats
                    </div>
                    <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>
                      Your conversations will appear here
                    </div>
                  </div>
                ) : (
                  chatSessions.map((s) => {
                    const lastMsg = s.messages?.[s.messages.length - 1]?.text || "";
                    const preview = lastMsg.slice(0, 60) + (lastMsg.length > 60 ? "..." : "");
                    const date = s.updatedAt
                      ? new Date(s.updatedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })
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
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              color: DEEP,
                              fontFamily: "'Sora',sans-serif",
                            }}
                          >
                            {s.whoForLabel || s.whoFor || "Self"}
                          </span>
                          <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>
                            {date}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#64748B",
                            fontWeight: 600,
                            lineHeight: 1.4,
                          }}
                        >
                          {preview || "Empty chat"}
                        </div>
                        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                          {s.focus && (
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 800,
                                color: "#059669",
                                background: "#ECFDF5",
                                padding: "2px 7px",
                                borderRadius: 999,
                              }}
                            >
                              {s.focus}
                            </span>
                          )}
                          {s.language && (
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 800,
                                color: "#6366F1",
                                background: "#EEF2FF",
                                padding: "2px 7px",
                                borderRadius: 999,
                              }}
                            >
                              {s.language}
                            </span>
                          )}
                        </div>
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
      `}</style>
    </div>
  );
}