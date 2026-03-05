import React, { useMemo, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Brain, ClipboardList, FlaskConical, Languages, Pill, Send, Sparkles, Stethoscope } from "lucide-react";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0C5A3E";
const MID = "#0E7A4F";
const ACC = "#00D97E";

const MODES = [
  { key: "symptom", label: "Symptom Check", icon: Stethoscope },
  { key: "rx", label: "Prescription Explain", icon: ClipboardList },
  { key: "medicine", label: "Medicine Info", icon: Pill },
  { key: "lab", label: "Lab Report Explain", icon: FlaskConical },
];

const LANGS = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "hinglish", label: "Hinglish" },
];

function formatFallbackReply(mode, prompt, language) {
  const langLead = language === "hi"
    ? "Yeh preliminary AI guidance hai. Emergency ya severe symptoms ho to turant doctor/ER se contact karein."
    : language === "hinglish"
      ? "Yeh preliminary AI guidance hai. Emergency ya severe symptoms me turant doctor/ER pe jao."
      : "This is preliminary AI guidance. For severe symptoms, contact a doctor/ER immediately.";

  if (mode === "medicine") {
    return `${langLead}\n\nMedicine query noted: "${prompt}".\n\n1. Use exactly as prescribed.\n2. Check dose timing with food/empty stomach.\n3. Avoid self-mixing with alcohol/sedatives.\n4. If allergy, rash, breathing issue, stop and seek care.\n\nTip: You can also search this medicine in GoDavaii to see alternatives and price.`;
  }
  if (mode === "lab") {
    return `${langLead}\n\nLab report summary request received.\n\n1. Share test values with unit + reference range.\n2. Mention symptoms + current medicines.\n3. Trend over last 2-3 reports matters more than one value.\n\nI can explain each marker in simple language once you paste values.`;
  }
  if (mode === "rx") {
    return `${langLead}\n\nPrescription explanation request received.\n\n1. I can break down medicine purpose, timing, and caution.\n2. Share medicine names + strengths + duration.\n3. Never change dose without doctor confirmation.\n\nPaste the prescription text and I will explain line-by-line.`;
  }
  return `${langLead}\n\nSymptom check request received: "${prompt}".\n\n1. Monitor fever, breathing, hydration, urine output.\n2. Red flags: chest pain, breathlessness, confusion, persistent vomiting, low oxygen.\n3. If symptoms worsen or last >48-72 hours, consult a doctor.\n\nShare age, duration, temperature, and existing conditions for better triage.`;
}

export default function GoDavaiiAI() {
  const [mode, setMode] = useState("symptom");
  const [language, setLanguage] = useState("hinglish");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Namaste. Main GoDavaii AI hoon. Symptoms, prescription, medicine info, aur lab reports simple language me explain kar sakta hoon.",
    },
  ]);

  const modeLabel = useMemo(() => MODES.find((m) => m.key === mode)?.label || "Assistant", [mode]);

  async function askBackend(promptText) {
    const payload = { prompt: promptText, mode, language };
    const candidates = [
      `${API}/api/ai/assistant`,
      `${API}/api/ai/chat`,
      `${API}/api/ai/health-assistant`,
    ];
    for (const url of candidates) {
      try {
        const r = await axios.post(url, payload, { timeout: 12000 });
        const text = r?.data?.reply || r?.data?.answer || r?.data?.message || "";
        if (String(text).trim()) return text;
      } catch {
        // try next endpoint
      }
    }
    return formatFallbackReply(mode, promptText, language);
  }

  const onSend = async () => {
    const promptText = input.trim();
    if (!promptText || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: promptText }]);
    setInput("");
    setLoading(true);
    try {
      const reply = await askBackend(promptText);
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "0 auto",
        minHeight: "100vh",
        background: "linear-gradient(180deg,#ECFDF5 0%,#E6F4FF 45%,#F8FAFC 100%)",
        paddingBottom: 120,
        fontFamily: "'Plus Jakarta Sans',sans-serif",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          background: `linear-gradient(135deg,${DEEP} 0%,#083D28 100%)`,
          color: "#fff",
          position: "sticky",
          top: 0,
          zIndex: 20,
          boxShadow: "0 10px 24px rgba(12,90,62,0.22)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 14, background: "rgba(0,217,126,0.16)", display: "grid", placeItems: "center" }}>
            <Brain style={{ width: 20, height: 20, color: ACC }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 900 }}>GoDavaii AI</div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.72)", fontWeight: 700 }}>Your 24x7 health assistant</div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 900, color: ACC, background: "rgba(0,217,126,0.12)", border: "1px solid rgba(0,217,126,0.28)", borderRadius: 999, padding: "5px 9px" }}>
            <Sparkles style={{ width: 11, height: 11 }} /> AI
          </div>
        </div>
      </div>

      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
          {MODES.map((m) => {
            const active = m.key === mode;
            const Icon = m.icon;
            return (
              <motion.button
                key={m.key}
                whileTap={{ scale: 0.95 }}
                onClick={() => setMode(m.key)}
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 36,
                  borderRadius: 999,
                  border: active ? "none" : "1.5px solid rgba(12,90,62,0.16)",
                  background: active ? `linear-gradient(135deg,${DEEP},${MID})` : "#fff",
                  color: active ? "#fff" : "#1E3A2E",
                  padding: "0 14px",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                <Icon style={{ width: 13, height: 13 }} /> {m.label}
              </motion.button>
            );
          })}
        </div>

        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, color: "#426756" }}>
            <Languages style={{ width: 13, height: 13 }} /> Language
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => setLanguage(l.code)}
                style={{
                  height: 28,
                  borderRadius: 999,
                  border: language === l.code ? "none" : "1px solid rgba(12,90,62,0.18)",
                  background: language === l.code ? `${DEEP}` : "rgba(255,255,255,0.86)",
                  color: language === l.code ? "#fff" : "#244636",
                  padding: "0 10px",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12, background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 8 }}>
          <AlertTriangle style={{ width: 15, height: 15, color: "#C2410C", marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, color: "#9A3412", fontWeight: 700 }}>
            GoDavaii AI guidance only. Emergency (chest pain, severe breathlessness, stroke signs, seizures) me immediate hospital/ambulance.
          </span>
        </div>

        <div
          style={{
            marginTop: 12,
            background: "rgba(255,255,255,0.95)",
            border: "1px solid rgba(12,90,62,0.12)",
            borderRadius: 16,
            minHeight: 360,
            maxHeight: "52vh",
            overflowY: "auto",
            padding: 12,
          }}
        >
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={`${m.role}-${i}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginBottom: 10,
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "88%",
                    whiteSpace: "pre-line",
                    borderRadius: 14,
                    padding: "10px 12px",
                    fontSize: 13,
                    lineHeight: 1.55,
                    fontWeight: 650,
                    color: m.role === "user" ? "#fff" : "#1F2937",
                    background: m.role === "user"
                      ? `linear-gradient(135deg,${DEEP},${MID})`
                      : "#F8FAFC",
                    border: m.role === "user" ? "none" : "1px solid #E2E8F0",
                  }}
                >
                  {m.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <div style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>
              Thinking as {modeLabel}...
            </div>
          )}
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask in ${modeLabel} mode...`}
            rows={3}
            style={{
              flex: 1,
              resize: "none",
              borderRadius: 14,
              border: "1.5px solid rgba(12,90,62,0.16)",
              background: "#fff",
              padding: 12,
              fontSize: 13.5,
              fontWeight: 700,
              color: "#0F172A",
              outline: "none",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onSend}
            disabled={loading || !input.trim()}
            style={{
              width: 46,
              borderRadius: 14,
              border: "none",
              background: loading || !input.trim() ? "#E2E8F0" : `linear-gradient(135deg,${DEEP},${MID})`,
              color: loading || !input.trim() ? "#94A3B8" : "#fff",
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              boxShadow: loading || !input.trim() ? "none" : "0 8px 20px rgba(12,90,62,0.24)",
            }}
          >
            <Send style={{ width: 17, height: 17, margin: "0 auto" }} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

