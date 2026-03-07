import React, { useMemo, useRef, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Brain, Languages, Mic, MicOff, Paperclip, Send, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0C5A3E";
const MID = "#0E7A4F";
const ACC = "#00D97E";

const FOCUS = [
  { key: "auto", label: "Auto" },
  { key: "symptom", label: "Symptoms" },
  { key: "medicine", label: "Medicine" },
  { key: "rx", label: "Prescription" },
  { key: "lab", label: "Lab Report" },
];

const LANGS = [
  { code: "hinglish", label: "Hinglish" },
  { code: "hi", label: "Hindi" },
  { code: "en", label: "English" },
];

const TARGETS = [
  { key: "self", label: "For Me" },
  { key: "family", label: "For Family" },
  { key: "new", label: "New Profile" },
];

function detectMode(prompt, forcedMode) {
  if (forcedMode && forcedMode !== "auto") return forcedMode;
  const p = String(prompt || "").toLowerCase();
  if (/(report|hb|cbc|lipid|tsh|vitamin|platelet|creatinine|hba1c)/.test(p)) return "lab";
  if (/(prescription|rx|dose|tablet|capsule|once daily|bd|tid)/.test(p)) return "rx";
  if (/(paracetamol|azithromycin|medicine|drug|dawai|tablet|capsule|syrup)/.test(p)) return "medicine";
  return "symptom";
}

function fallbackReply(message, mode, language, whoFor) {
  const inferred = detectMode(message, mode);
  const identity = whoFor === "family" ? "family member" : whoFor === "new" ? "new profile" : "you";
  const caution = language === "hi"
    ? "Ye medical guidance preliminary hai. Emergency me turant hospital jaiye."
    : language === "en"
      ? "This is preliminary medical guidance. Go to ER for emergencies."
      : "Ye preliminary medical guidance hai. Emergency me turant hospital/ER jao.";

  if (inferred === "lab") {
    return `${caution}\n\nI will explain this for ${identity}.\nPlease share lab value + unit + reference range. Trend over multiple reports is more reliable than one value.`;
  }
  if (inferred === "rx") {
    return `${caution}\n\nI will explain the prescription for ${identity} in simple language: medicine use, timing, and cautions. Please share prescription text or upload image/pdf.`;
  }
  if (inferred === "medicine") {
    return `${caution}\n\nFor ${identity}: I can explain use, common side-effects, interactions, and safe timing. Share medicine name + strength (example: Paracetamol 650).`;
  }
  return `${caution}\n\nFor ${identity}: share age, symptoms, duration, fever value, existing diseases, and current medicines. I will give triage + next steps.`;
}

function buildCompactHistory(messages) {
  return messages.slice(-12).map((m) => ({
    role: m.role,
    text: m.text || "",
  }));
}

function cleanAssistantText(text) {
  return String(text || "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "");
}

export default function GoDavaiiAI() {
  const { user } = useAuth();
  const [focus, setFocus] = useState("auto");
  const [language, setLanguage] = useState("hinglish");
  const [whoFor, setWhoFor] = useState("self");
  const [familyLabel, setFamilyLabel] = useState("");
  const [customProfile, setCustomProfile] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [voiceAutoPlay, setVoiceAutoPlay] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [reuseAttachment, setReuseAttachment] = useState(false);
  const recognitionRef = useRef(null);
  const fileRef = useRef(null);

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Namaste, main GoDavaii AI hoon. Aap text, voice, ya file upload se pooch sakte ho. Pehle batayein: aap apne liye puch rahe ho, family ke liye, ya new profile?",
    },
  ]);

  const whoForLabel = useMemo(() => {
    if (whoFor === "family" && familyLabel.trim()) return familyLabel.trim();
    if (whoFor === "new" && customProfile.trim()) return customProfile.trim();
    if (whoFor === "self") return user?.name || "Self";
    return whoFor === "family" ? "Family Member" : "New Profile";
  }, [whoFor, familyLabel, customProfile, user?.name]);

  const profileContext = useMemo(() => ({
    whoFor,
    whoForLabel,
    language,
    focus,
    userSummary: {
      id: user?._id || user?.userId || null,
      name: user?.name || null,
      age: user?.age || null,
      gender: user?.gender || null,
      dob: user?.dob || null,
      email: user?.email || null,
    },
  }), [whoFor, whoForLabel, language, focus, user]);

  function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text || ""));
    u.rate = 0.98;
    u.pitch = 1;
    u.lang = language === "hi" ? "hi-IN" : "en-IN";
    window.speechSynthesis.speak(u);
  }

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
    rec.lang = language === "hi" ? "hi-IN" : "en-IN";
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

  async function askBackend(messageText, history) {
    const payload = {
      message: messageText,
      history,
      context: profileContext,
    };

    const urls = [
      `${API}/api/ai/assistant/chat`,
      `${API}/api/ai/chat`,
      `${API}/api/ai/assistant`,
    ];

    for (const url of urls) {
      try {
        const r = await axios.post(url, payload, { timeout: 18000 });
        const text = r?.data?.reply || r?.data?.answer || r?.data?.message || "";
        if (String(text).trim()) return text;
      } catch (err) {
        console.error("Chat AI failed:", url, getApiErrorMessage(err));
      }
    }

    return fallbackReply(messageText, focus, language, whoFor);
  }

  function getApiErrorMessage(err) {
    const data = err?.response?.data;
    return (
      data?.error ||
      data?.details ||
      data?.message ||
      err?.message ||
      "File analyze nahi ho payi. Please retry."
    );
  }

  async function askBackendWithFile(messageText, history, file) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("message", messageText || "");
    fd.append("history", JSON.stringify(history));
    fd.append("context", JSON.stringify(profileContext));

    const urls = [
      `${API}/api/ai/assistant/analyze-file`,
      `${API}/api/ai/analyze-file`,
    ];

    let lastErr = null;

    for (const url of urls) {
      try {
        const r = await axios.post(url, fd, {
          timeout: 60000,
          headers: { "Content-Type": "multipart/form-data" },
        });

        const parsed = r?.data?.parsed;
        if (parsed) console.log("file parsed:", parsed);

        const text = r?.data?.reply || r?.data?.answer || r?.data?.message || "";
        if (String(text).trim()) return text;

        lastErr = new Error("Empty reply from backend");
      } catch (err) {
        lastErr = err;
        console.error("File AI failed:", url, getApiErrorMessage(err));
      }
    }

    const msg = getApiErrorMessage(lastErr);
    return `File analysis issue: ${msg}\n\nPlease retry once.`;
  }

  async function sendMessage() {
    const msg = input.trim();
    const activeFile = reuseAttachment ? attachedFile : attachedFile;

    if (!msg && !activeFile) return;
    if (loading) return;

    const userBubbleText = activeFile ? `${msg || "(No text)"}\n[Attached: ${activeFile.name}]` : msg;
    const nextMessages = [...messages, { role: "user", text: userBubbleText }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const history = buildCompactHistory(nextMessages);
      const reply = activeFile
        ? await askBackendWithFile(msg, history, activeFile)
        : await askBackend(msg, history);

      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);

      if (voiceAutoPlay) speak(reply);

      if (activeFile) {
        setReuseAttachment(false);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100vh", background: "linear-gradient(180deg,#ECFDF5 0%,#E6F4FF 45%,#F8FAFC 100%)", paddingBottom: 120, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ padding: "14px 16px", background: `linear-gradient(135deg,${DEEP} 0%,#083D28 100%)`, color: "#fff", position: "sticky", top: 0, zIndex: 20, boxShadow: "0 10px 24px rgba(12,90,62,0.22)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 14, background: "rgba(0,217,126,0.16)", display: "grid", placeItems: "center" }}>
            <Brain style={{ width: 20, height: 20, color: ACC }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 900 }}>GoDavaii AI</div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.72)", fontWeight: 700 }}>Conversational health assistant with voice + file support</div>
          </div>
          <button onClick={() => setVoiceAutoPlay((v) => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 900, color: ACC, background: "rgba(0,217,126,0.12)", border: "1px solid rgba(0,217,126,0.28)", borderRadius: 999, padding: "5px 9px", cursor: "pointer" }}>
            {voiceAutoPlay ? <Volume2 style={{ width: 11, height: 11 }} /> : <VolumeX style={{ width: 11, height: 11 }} />}
            Voice
          </button>
        </div>
      </div>

      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
          {FOCUS.map((m) => (
            <button
              key={m.key}
              onClick={() => setFocus(m.key)}
              style={{
                flexShrink: 0,
                height: 34,
                borderRadius: 999,
                border: focus === m.key ? "none" : "1.5px solid rgba(12,90,62,0.16)",
                background: focus === m.key ? `linear-gradient(135deg,${DEEP},${MID})` : "#fff",
                color: focus === m.key ? "#fff" : "#1E3A2E",
                padding: "0 13px",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer"
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 8, display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
          {TARGETS.map((t) => (
            <button
              key={t.key}
              onClick={() => setWhoFor(t.key)}
              style={{
                flexShrink: 0,
                height: 30,
                borderRadius: 999,
                border: whoFor === t.key ? "none" : "1px solid rgba(12,90,62,0.18)",
                background: whoFor === t.key ? DEEP : "rgba(255,255,255,0.88)",
                color: whoFor === t.key ? "#fff" : "#244636",
                padding: "0 10px",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer"
              }}
            >
              {t.label}
            </button>
          ))}

          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, color: "#426756", marginLeft: 4 }}>
            <Languages style={{ width: 13, height: 13 }} />
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => setLanguage(l.code)}
                style={{
                  height: 26,
                  borderRadius: 999,
                  border: language === l.code ? "none" : "1px solid rgba(12,90,62,0.18)",
                  background: language === l.code ? DEEP : "rgba(255,255,255,0.86)",
                  color: language === l.code ? "#fff" : "#244636",
                  padding: "0 9px",
                  fontSize: 10.5,
                  fontWeight: 800,
                  cursor: "pointer"
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {whoFor === "family" && (
          <input
            value={familyLabel}
            onChange={(e) => setFamilyLabel(e.target.value)}
            placeholder="Family member name (eg: Mom)"
            style={{ marginTop: 8, width: "100%", height: 38, borderRadius: 10, border: "1px solid rgba(12,90,62,0.2)", padding: "0 10px", fontSize: 12.5, fontWeight: 700 }}
          />
        )}

        {whoFor === "new" && (
          <input
            value={customProfile}
            onChange={(e) => setCustomProfile(e.target.value)}
            placeholder="New profile note (age, gender, condition)"
            style={{ marginTop: 8, width: "100%", height: 38, borderRadius: 10, border: "1px solid rgba(12,90,62,0.2)", padding: "0 10px", fontSize: 12.5, fontWeight: 700 }}
          />
        )}

        <div style={{ marginTop: 10, background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 8 }}>
          <AlertTriangle style={{ width: 15, height: 15, color: "#C2410C", marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, color: "#9A3412", fontWeight: 700 }}>
            AI helpful hai but final diagnosis doctor karega. Emergency red flags me immediate hospital/ambulance.
          </span>
        </div>

        <div style={{ marginTop: 12, background: "rgba(255,255,255,0.95)", border: "1px solid rgba(12,90,62,0.12)", borderRadius: 16, minHeight: 360, maxHeight: "50vh", overflowY: "auto", padding: 12 }}>
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={`${m.role}-${i}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginBottom: 10, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}
              >
                <div
                  style={{
                    maxWidth: "90%",
                    whiteSpace: "pre-line",
                    borderRadius: 14,
                    padding: "10px 12px",
                    fontSize: 13,
                    lineHeight: 1.55,
                    fontWeight: 650,
                    color: m.role === "user" ? "#fff" : "#1F2937",
                    background: m.role === "user" ? `linear-gradient(135deg,${DEEP},${MID})` : "#F8FAFC",
                    border: m.role === "user" ? "none" : "1px solid #E2E8F0",
                    position: "relative"
                  }}
                >
                  {m.role === "assistant" ? cleanAssistantText(m.text) : m.text}
                  {m.role === "assistant" && (
                    <button onClick={() => speak(m.text)} style={{ marginTop: 7, display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid #E2E8F0", borderRadius: 999, background: "#fff", padding: "3px 8px", fontSize: 10.5, fontWeight: 800, color: "#0F766E", cursor: "pointer" }}>
                      <Volume2 style={{ width: 11, height: 11 }} /> Audio
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>Thinking...</div>}
        </div>

        {attachedFile && (
          <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 999, background: "#ECFDF5", border: "1px solid #A7F3D0", fontSize: 11.5, fontWeight: 800, color: "#065F46" }}>
            <Paperclip style={{ width: 12, height: 12 }} />
            {attachedFile.name}
            <span style={{ fontSize: 10, fontWeight: 900, color: "#0F766E", background: "#D1FAE5", border: "1px solid #A7F3D0", borderRadius: 999, padding: "1px 6px" }}>
              Persistent
            </span>
            <button onClick={() => setAttachedFile(null)} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, display: "grid", placeItems: "center" }}>
              <X style={{ width: 12, height: 12, color: "#065F46" }} />
            </button>
          </div>
        )}

        {attachedFile && (
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
            <input
              id="reuse-attachment"
              type="checkbox"
              checked={reuseAttachment}
              onChange={(e) => setReuseAttachment(e.target.checked)}
              style={{ width: 14, height: 14 }}
            />
            <label htmlFor="reuse-attachment" style={{ fontSize: 11, fontWeight: 800, color: "#3F5F4F", cursor: "pointer" }}>
              Use same report for next message
            </label>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.txt,.csv"
          style={{ display: "none" }}
          onChange={(e) => setAttachedFile(e.target.files?.[0] || null)}
        />

        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask anything for ${whoForLabel}...`}
            rows={3}
            style={{ flex: 1, resize: "none", borderRadius: 14, border: "1.5px solid rgba(12,90,62,0.16)", background: "#fff", padding: 12, fontSize: 13.5, fontWeight: 700, color: "#0F172A", outline: "none" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => fileRef.current?.click()} style={{ width: 46, height: 38, borderRadius: 12, border: "1px solid rgba(12,90,62,0.2)", background: "#fff", color: "#14532D", cursor: "pointer" }}>
              <Paperclip style={{ width: 16, height: 16, margin: "0 auto" }} />
            </motion.button>

            <motion.button whileTap={{ scale: 0.92 }} onClick={handleMicToggle} style={{ width: 46, height: 38, borderRadius: 12, border: "none", background: micOn ? "linear-gradient(135deg,#DC2626,#EF4444)" : "#E2F8EE", color: micOn ? "#fff" : "#14532D", cursor: "pointer" }}>
              {micOn ? <MicOff style={{ width: 16, height: 16, margin: "0 auto" }} /> : <Mic style={{ width: 16, height: 16, margin: "0 auto" }} />}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={sendMessage}
              disabled={loading || (!input.trim() && !attachedFile)}
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                border: "none",
                background: loading || (!input.trim() && !attachedFile) ? "#E2E8F0" : `linear-gradient(135deg,${DEEP},${MID})`,
                color: loading || (!input.trim() && !attachedFile) ? "#94A3B8" : "#fff",
                cursor: loading || (!input.trim() && !attachedFile) ? "not-allowed" : "pointer",
                boxShadow: loading || (!input.trim() && !attachedFile) ? "none" : "0 8px 20px rgba(12,90,62,0.24)"
              }}
            >
              <Send style={{ width: 17, height: 17, margin: "0 auto" }} />
            </motion.button>
          </div>
        </div>

        <div style={{ marginTop: 8, fontSize: 11, color: "#64748B", fontWeight: 700 }}>
          Tip: text + voice + file sab combine kar sakte ho. AI context memory last messages se maintain hoti hai.
        </div>

        <div style={{ marginTop: 2, fontSize: 11, color: "#64748B", fontWeight: 700 }}>
          Current context: <span style={{ color: "#0F766E" }}>{whoForLabel}</span>
        </div>

        <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 900, color: ACC, background: "rgba(0,217,126,0.12)", border: "1px solid rgba(0,217,126,0.28)", borderRadius: 999, padding: "5px 10px" }}>
          <Sparkles style={{ width: 11, height: 11 }} /> AI mode: {focus.toUpperCase()}
        </div>
      </div>
    </div>
  );
}