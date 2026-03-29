// pages/GoDavaiiAI.js — GoDavaii 2035 Premium Mobile-First Health AI
// ✅ PREMIUM REDESIGN: ChatGPT-style immersive full-screen AI layout
// ✅ PREMIUM REDESIGN: Minimal top bar + premium history drawer
// ✅ PREMIUM REDESIGN: Context controls moved into bottom sheet
// ✅ PREMIUM REDESIGN: Slim disclaimer pill
// ✅ PREMIUM REDESIGN: Floating composer with better safe-area handling
// ✅ PREMIUM REDESIGN: Better welcome state + quick actions
// ✅ PREMIUM REDESIGN: Richer thinking / analyzing UX
// ✅ FIX: Desktop mic now prefers browser SpeechRecognition first
// ✅ FIX: MediaRecorder chunking improved with recorder.start(250)
// ✅ FIX: Browser TTS fallback now picks better voice and avoids ugly random fallback
// ✅ FIX: Reply language chip persisted in localStorage
// ✅ FIX: Existing result / backend / TTS / file logic preserved
// ✅ FIX ONLY: navbar restored
// ✅ FIX ONLY: owner/name row restored
// ✅ FIX ONLY: bottom blank space issue fixed by removing body scroll lock
// ✅ FIX ONLY: better section labels by reply language
// ✅ FIX ONLY: disclaimer text softened and made less doctor-centric
// ✅ FIX ONLY: TTS preference respected properly
// ✅ FIX ONLY: transcriptMode added for voice transcription
// ✅ FIX ONLY: TTS cache + prefetch + longer timeout for fast Listen UX
// ✅ NEW FIX: added multilingual section labels for Bengali / Gujarati / Punjabi / Marathi / Tamil / Telugu / Kannada / Malayalam / Odia
// ✅ NEW FIX: broader reply-language UI support for Indian languages
// ✅ NEW FIX: display language detection improved for Marathi / Odia and broader script handling
// ✅ NEW FIX: feedback payload now sends sessionId, aiSource, complexity, confidence, responsePreview, userQueryPreview
// ✅ NEW FIX: assistant meta/sessionId preserved from backend chat + analyze-file responses
// ✅ NEW FIX: progressive premium reveal for assistant replies
// ✅ NEW FIX: honest timeout/error bubbles + retry CTA
// ✅ NEW FIX: "Show full" support during reveal
// ✅ NEW FIX: TTS always uses final full assistant text
// ✅ BUILD FIX: removed unused fallbackReply helper
// ✅ BUILD FIX: messages state moved before effects that reference it
// ✅ BUILD FIX: effect cleanup now snapshots revealTimeoutsRef.current to satisfy eslint

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Bookmark,
  Check,
  ClipboardList,
  FileText,
  FlaskConical,
  Menu,
  Mic,
  MicOff,
  Paperclip,
  Pill,
  Plus,
  RefreshCcw,
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
import { useLocation } from "react-router-dom";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const CHAT_TIMEOUT_MS = 180000;
const FILE_ANALYZE_TIMEOUT_MS = 300000;

/* ── Premium design tokens ───────────────────────────────── */
const DEEP = "#0A5A3B";
const MID = "#0F7A53";
const ACC = "#18E2A1";
const ACC_SOFT = "rgba(24,226,161,0.14)";
const BG_TOP = "#F4FBF8";
const BG_MID = "#EEF8F4";
const BG_BOT = "#F7FAFF";
const GLASS_STRONG = "rgba(255,255,255,0.92)";
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
  { key: "bengali", label: "Bengali" },
  { key: "gujarati", label: "Gujarati" },
  { key: "punjabi", label: "Punjabi" },
  { key: "marathi", label: "Marathi" },
  { key: "tamil", label: "Tamil" },
  { key: "telugu", label: "Telugu" },
  { key: "kannada", label: "Kannada" },
  { key: "malayalam", label: "Malayalam" },
  { key: "odia", label: "Odia" },
];

/* ── Helpers ──────────────────────────────────────────────── */
function cleanAssistantText(text) {
  return String(text || "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/```/g, "");
}

function splitTextForTTSChunks(text, maxLen = 900) {
  if (!text || text.length <= maxLen) return [text];
  const sentences = text.split(/(?<=[.!?।])\s+/);
  const chunks = [];
  let current = "";
  for (const s of sentences) {
    if (!current) { current = s; continue; }
    if ((current + " " + s).length <= maxLen) {
      current += " " + s;
    } else {
      if (current.trim()) chunks.push(current.trim());
      current = s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
}

function isStructuredMedicalReply(text) {
  return /\n[-–—*•]?\s*(Assessment|Next steps|What to do now|Medicine options|Warning signs|Red flags|When to see doctor|Desi ilaaj|Home remedies)[^:\n]*:/i.test(
    String(text || "")
  );
}

function chunkTextForReveal(text) {
  const src = String(text || "");
  if (!src.trim()) return [];

  const structured = isStructuredMedicalReply(src);
  const words = src.match(/\S+\s*/g) || [];

  const chunks = [];
  let current = "";

  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    current += w;

    const trimmed = w.trim();
    const endsPause = /[.!?]\)?$/.test(trimmed);
    const endsSoftPause = /[,;:]$/.test(trimmed);
    const nextRaw = words[i + 1]?.trim?.() || "";
    const nextIsHeading =
      /^(Assessment|Next steps|What to do now|Medicine options|Warning signs|Red flags|When to see doctor|Desi ilaaj|Home remedies):$/i.test(
        nextRaw
      );

    const chunkSize = structured ? 3 : 5;
    const shouldPush =
      ((i + 1) % chunkSize === 0) ||
      endsPause ||
      endsSoftPause ||
      nextIsHeading ||
      i === words.length - 1;

    if (shouldPush) {
      let delay = 26;
      if (structured && /(Assessment:|Next steps:|What to do now:|Medicine options:|Suggested tests:|Warning signs:|Red flags:|When to see doctor:|Desi ilaaj:|Home remedies:)/i.test(current)) {
        delay = 170;
      } else if (endsPause) {
        delay = 145;
      } else if (endsSoftPause) {
        delay = 85;
      } else if (trimmed.length <= 2) {
        delay = 18;
      }

      chunks.push({
        text: current,
        delay,
      });
      current = "";
    }
  }

  if (current) {
    chunks.push({ text: current, delay: 26 });
  }

  return chunks;
}

function getDisplayReplyLanguage(preferred, text = "") {
  const pref = String(preferred || "auto").toLowerCase();
  if (pref && pref !== "auto") return pref;

  if (/[\u0980-\u09FF]/.test(text)) return "bengali";
  if (/[\u0B80-\u0BFF]/.test(text)) return "tamil";
  if (/[\u0C00-\u0C7F]/.test(text)) return "telugu";
  if (/[\u0C80-\u0CFF]/.test(text)) return "kannada";
  if (/[\u0D00-\u0D7F]/.test(text)) return "malayalam";
  if (/[\u0A80-\u0AFF]/.test(text)) return "gujarati";
  if (/[\u0A00-\u0A7F]/.test(text)) return "punjabi";
  if (/[\u0B00-\u0B7F]/.test(text)) return "odia";
  if (/[\u0900-\u097F]/.test(text)) {
    if (/\b(आहे|नाही|काय|कसे|माझे|तुमचे|बरं|बरंय)\b/.test(text)) return "marathi";
    return "hindi";
  }

  const detected = detectLanguageForTTS(text);
  return detected || "hinglish";
}

function getSectionLabel(sectionKey, lang) {
  const normalized = String(lang || "hinglish").toLowerCase();

  const map = {
    hinglish: {
      Assessment: "Samajhi hui baat",
      "Next steps": "Ab kya karein",
      "What to do now": "Ab kya karein",
      "Medicine options": "Dawai ke options",
      "Suggested tests": "Kaun se tests karwayein",
      "Warning signs": "Kab turant action lena hai",
      "Red flags": "Kab turant action lena hai",
      "When to see doctor": "Kab extra help leni hai",
      "Desi ilaaj": "Desi ilaaj",
      "Home remedies": "Gharelu nuskhe",
    },
    hindi: {
      Assessment: "समझी हुई बात",
      "Next steps": "अब क्या करें",
      "What to do now": "अब क्या करें",
      "Medicine options": "दवाई के विकल्प",
      "Suggested tests": "कौन से टेस्ट करवाएं",
      "Warning signs": "कब तुरंत कदम उठाना है",
      "Red flags": "कब तुरंत कदम उठाना है",
      "When to see doctor": "कब अतिरिक्त मदद लेनी है",
      "Desi ilaaj": "देसी इलाज",
      "Home remedies": "घरेलू नुस्खे",
    },
    english: {
      Assessment: "Assessment",
      "Next steps": "What to do now",
      "What to do now": "What to do now",
      "Medicine options": "Medicine options",
      "Suggested tests": "Suggested tests",
      "Warning signs": "When to act urgently",
      "Red flags": "When to act urgently",
      "When to see doctor": "When to get medical help",
      "Desi ilaaj": "Home support",
      "Home remedies": "Home remedies",
    },
    bengali: {
      Assessment: "বিষয়টা কী বোঝা গেল",
      "Next steps": "এখন কী করবেন",
      "What to do now": "এখন কী করবেন",
      "Medicine options": "ওষুধের বিকল্প",
      "Suggested tests": "কোন পরীক্ষা করাবেন",
      "Warning signs": "কখন দ্রুত ব্যবস্থা নেবেন",
      "Red flags": "কখন দ্রুত ব্যবস্থা নেবেন",
      "When to see doctor": "কখন অতিরিক্ত সাহায্য নেবেন",
      "Desi ilaaj": "ঘরোয়া সাহায্য",
      "Home remedies": "ঘরোয়া উপায়",
    },
    gujarati: {
      Assessment: "સમજાયેલ વાત",
      "Next steps": "હવે શું કરવું",
      "What to do now": "હવે શું કરવું",
      "Medicine options": "દવાના વિકલ્પો",
      "Suggested tests": "કયા ટેસ્ટ કરાવવા",
      "Warning signs": "ક્યારે તરત પગલું લેવું",
      "Red flags": "ક્યારે તરત પગલું લેવું",
      "When to see doctor": "ક્યારે વધુ મદદ લેવી",
      "Desi ilaaj": "ઘરગથ્થુ મદદ",
      "Home remedies": "ઘરેલુ ઉપાય",
    },
    punjabi: {
      Assessment: "ਸਮਝ ਆਈ ਗੱਲ",
      "Next steps": "ਹੁਣ ਕੀ ਕਰਨਾ ਹੈ",
      "What to do now": "ਹੁਣ ਕੀ ਕਰਨਾ ਹੈ",
      "Medicine options": "ਦਵਾਈ ਦੇ ਵਿਕਲਪ",
      "Suggested tests": "ਕਿਹੜੇ ਟੈਸਟ ਕਰਵਾਉਣੇ ਹਨ",
      "Warning signs": "ਕਦੋਂ ਤੁਰੰਤ ਕਦਮ ਲੈਣਾ ਹੈ",
      "Red flags": "ਕਦੋਂ ਤੁਰੰਤ ਕਦਮ ਲੈਣਾ ਹੈ",
      "When to see doctor": "ਕਦੋਂ ਹੋਰ ਮਦਦ ਲੈਣੀ ਹੈ",
      "Desi ilaaj": "ਘਰੇਲੂ ਸਹਾਇਤਾ",
      "Home remedies": "ਘਰੇਲੂ ਨੁਸਖੇ",
    },
    marathi: {
      Assessment: "समजलेली गोष्ट",
      "Next steps": "आता काय करावे",
      "What to do now": "आता काय करावे",
      "Medicine options": "औषधाचे पर्याय",
      "Suggested tests": "कोणत्या चाचण्या करायच्या",
      "Warning signs": "कधी लगेच पाऊल उचलावे",
      "Red flags": "कधी लगेच पाऊल उचलावे",
      "When to see doctor": "कधी जास्त मदत घ्यावी",
      "Desi ilaaj": "घरगुती मदत",
      "Home remedies": "घरगुती उपाय",
    },
    tamil: {
      Assessment: "புரிந்தது என்ன",
      "Next steps": "இப்போது என்ன செய்ய வேண்டும்",
      "What to do now": "இப்போது என்ன செய்ய வேண்டும்",
      "Medicine options": "மருந்து தேர்வுகள்",
      "Suggested tests": "என்ன பரிசோதனைகள் செய்ய வேண்டும்",
      "Warning signs": "எப்போது உடனே நடவடிக்கை எடுக்க வேண்டும்",
      "Red flags": "எப்போது உடனே நடவடிக்கை எடுக்க வேண்டும்",
      "When to see doctor": "எப்போது கூடுதல் உதவி பெற வேண்டும்",
      "Desi ilaaj": "வீட்டு உதவி",
      "Home remedies": "வீட்டு வைத்தியம்",
    },
    telugu: {
      Assessment: "అర్థమైన విషయం",
      "Next steps": "ఇప్పుడు ఏమి చేయాలి",
      "What to do now": "ఇప్పుడు ఏమి చేయాలి",
      "Medicine options": "మందు ఎంపికలు",
      "Suggested tests": "ఏ పరీక్షలు చేయించాలి",
      "Warning signs": "ఎప్పుడు వెంటనే చర్య తీసుకోవాలి",
      "Red flags": "ఎప్పుడు వెంటనే చర్య తీసుకోవాలి",
      "When to see doctor": "ఎప్పుడు అదనపు సహాయం తీసుకోవాలి",
      "Desi ilaaj": "ఇంటి సహాయం",
      "Home remedies": "ఇంటివైద్యం",
    },
    kannada: {
      Assessment: "ಅರ್ಥವಾದ ವಿಷಯ",
      "Next steps": "ಈಗ ಏನು ಮಾಡಬೇಕು",
      "What to do now": "ಈಗ ಏನು ಮಾಡಬೇಕು",
      "Medicine options": "ಔಷಧ ಆಯ್ಕೆಗಳು",
      "Suggested tests": "ಯಾವ ಪರೀಕ್ಷೆಗಳನ್ನು ಮಾಡಿಸಬೇಕು",
      "Warning signs": "ಯಾವಾಗ ತಕ್ಷಣ ಕ್ರಮ ತೆಗೆದುಕೊಳ್ಳಬೇಕು",
      "Red flags": "ಯಾವಾಗ ತಕ್ಷಣ ಕ್ರಮ ತೆಗೆದುಕೊಳ್ಳಬೇಕು",
      "When to see doctor": "ಯಾವಾಗ ಹೆಚ್ಚುವರಿ ಸಹಾಯ ಪಡೆಯಬೇಕು",
      "Desi ilaaj": "ಮನೆಯ ಸಹಾಯ",
      "Home remedies": "ಮನೆಯ ಉಪಾಯಗಳು",
    },
    malayalam: {
      Assessment: "മനസ്സിലായ കാര്യം",
      "Next steps": "ഇപ്പോൾ എന്ത് ചെയ്യണം",
      "What to do now": "ഇപ്പോൾ എന്ത് ചെയ്യണം",
      "Medicine options": "മരുന്ന് ഓപ്ഷനുകൾ",
      "Suggested tests": "ഏത് പരിശോധനകൾ ചെയ്യണം",
      "Warning signs": "എപ്പോൾ ഉടൻ നടപടി എടുക്കണം",
      "Red flags": "എപ്പോൾ ഉടൻ നടപടി എടുക്കണം",
      "When to see doctor": "എപ്പോൾ കൂടുതൽ സഹായം തേടണം",
      "Desi ilaaj": "വീട്ടുവൈദ്യ സഹായം",
      "Home remedies": "വീട്ടുവൈദ്യങ്ങൾ",
    },
    odia: {
      Assessment: "ବୁଝା ଯାଇଥିବା କଥା",
      "Next steps": "ଏବେ କଣ କରିବେ",
      "What to do now": "ଏବେ କଣ କରିବେ",
      "Medicine options": "ଔଷଧ ବିକଳ୍ପ",
      "Suggested tests": "କେଉଁ ପରୀକ୍ଷା କରାଇବେ",
      "Warning signs": "କେବେ ତୁରନ୍ତ ପଦକ୍ଷେପ ନେବେ",
      "Red flags": "କେବେ ତୁରନ୍ତ ପଦକ୍ଷେପ ନେବେ",
      "When to see doctor": "କେବେ ଅଧିକ ସହାୟତା ନେବେ",
      "Desi ilaaj": "ଘରୋଇ ସହାୟତା",
      "Home remedies": "ଘରୋଇ ଉପାୟ",
    },
  };

  const selected =
    map[normalized] ||
    (normalized === "hinglish" ? map.hinglish : map.english);

  return selected[sectionKey] || sectionKey;
}

function buildCompactHistory(messages) {
  return messages.slice(-14).map((m) => ({
    role: m.role,
    text: m.fullText || m.text || "",
  }));
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

  if (/[\u0980-\u09FF]/.test(src)) return "bengali";
  if (/[\u0B80-\u0BFF]/.test(src)) return "tamil";
  if (/[\u0C00-\u0C7F]/.test(src)) return "telugu";
  if (/[\u0C80-\u0CFF]/.test(src)) return "kannada";
  if (/[\u0D00-\u0D7F]/.test(src)) return "malayalam";
  if (/[\u0A80-\u0AFF]/.test(src)) return "gujarati";
  if (/[\u0A00-\u0A7F]/.test(src)) return "punjabi";
  if (/[\u0B00-\u0B7F]/.test(src)) return "odia";
  if (/[\u0900-\u097F]/.test(src)) {
    if (/\b(आहे|नाही|काय|कसे|माझे|तुमचे|बरं|बरंय|ताप|डोके|पोट)\b/.test(src)) return "marathi";
    return "hindi";
  }

  const lower = src.toLowerCase();

  const bengaliWords = [
    "ami", "amar", "tumi", "apni", "kemon", "acho", "achen", "bhalo", "jor", "byatha", "oshudh", "daktar",
  ];
  const gujaratiWords = [
    "mane", "tamne", "chhe", "che", "nathi", "shu", "kem", "dava", "tabiyat", "taav",
  ];
  const punjabiWords = [
    "mainu", "tusi", "kiven", "theek", "haal", "bukhar", "dard", "dawai",
  ];
  const marathiWords = [
    "mala", "tumhi", "aahe", "ahe", "nahi", "kaay", "kay", "taap", "doka", "aushadh",
  ];
  const tamilWords = [
    "enakku", "irukku", "illa", "enna", "kaichal", "vali", "marundhu",
  ];
  const teluguWords = [
    "naaku", "undi", "ledu", "jvaram", "noppi", "mandhu",
  ];
  const kannadaWords = [
    "nanage", "ide", "illa", "jwara", "novu", "aushadhi",
  ];
  const malayalamWords = [
    "enikku", "undo", "vedana", "jwaram", "marunnu",
  ];
  const odiaWords = [
    "mote", "achhi", "achi", "jwara", "byatha", "ousadha",
  ];
  const hindiWords = [
    "hai", "kya", "kaise", "mujhe", "mera", "kar", "karo",
    "samjha", "batao", "nahi", "acha", "dard", "bukhar", "dawai", "ilaaj",
  ];

  const countMatches = (words) =>
    words.reduce((n, w) => (new RegExp(`\\b${w}\\b`, "i").test(lower) ? n + 1 : n), 0);

  const scores = {
    bengali: countMatches(bengaliWords),
    gujarati: countMatches(gujaratiWords),
    punjabi: countMatches(punjabiWords),
    marathi: countMatches(marathiWords),
    tamil: countMatches(tamilWords),
    telugu: countMatches(teluguWords),
    kannada: countMatches(kannadaWords),
    malayalam: countMatches(malayalamWords),
    odia: countMatches(odiaWords),
    hinglish: countMatches(hindiWords),
  };

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 2) return best[0];

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
    case "kannada":
      return "kn-IN";
    case "malayalam":
      return "ml-IN";
    case "odia":
      return "or-IN";
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

function pickBestBrowserVoice(lang) { // eslint-disable-line no-unused-vars
  const synth = window.speechSynthesis;
  if (!synth) return null;

  const voices = synth.getVoices?.() || [];
  if (!voices.length) return null;

  const normalized = String(lang || "english").toLowerCase();

  const targets =
    normalized === "hinglish"
      ? ["hi-IN", "en-IN", "hi", "en"]
      : normalized === "hindi"
        ? ["hi-IN", "hi"]
        : normalized === "marathi"
          ? ["mr-IN", "mr", "hi-IN"]
          : normalized === "bengali"
            ? ["bn-IN", "bn"]
            : normalized === "tamil"
              ? ["ta-IN", "ta"]
              : normalized === "telugu"
                ? ["te-IN", "te"]
                : normalized === "gujarati"
                  ? ["gu-IN", "gu"]
                  : normalized === "punjabi"
                    ? ["pa-IN", "pa"]
                    : normalized === "kannada"
                      ? ["kn-IN", "kn"]
                      : normalized === "malayalam"
                        ? ["ml-IN", "ml"]
                        : normalized === "odia"
                          ? ["or-IN", "or"]
                          : ["en-IN", "en-GB", "en-US", "en"];

  for (const target of targets) {
    const v = voices.find((x) => String(x.lang || "").toLowerCase() === target.toLowerCase());
    if (v) return v;
  }

  for (const target of targets) {
    const v = voices.find((x) =>
      String(x.lang || "").toLowerCase().startsWith(target.split("-")[0].toLowerCase())
    );
    if (v) return v;
  }

  return voices[0] || null;
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

function createAssistantMessage({ id, text, meta = {}, isStreaming = false, liveStream = false }) {
  const full = String(text || "");
  return {
    id,
    role: "assistant",
    text: liveStream ? full : (isStreaming ? "" : full),  // liveStream = real SSE, isStreaming = fake reveal
    fullText: full,
    isStreaming,
    streamDone: !isStreaming,
    liveStream,
    meta,
  };
}

/* ── Reply formatter ──────────────────────────────────────── */
function FormatReply({ text, screen, uiLang }) {
  const clean = cleanAssistantText(text);
  const isDesktop = screen === "desktop";
  const baseFontSize = isDesktop ? 14.5 : 14;
  const lang = getDisplayReplyLanguage(uiLang, clean);

  const hasSections = /\n[-–—*•]?\s*(Assessment|Next steps|What to do now|Medicine options|Warning signs|Desi ilaaj)[^:\n]*:/i.test(clean);
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
    /\n(?=[-–—*•]?\s*(?:Assessment|Next steps|What to do now|Medicine options|Suggested tests|Warning signs|Red flags|When to see doctor|Desi ilaaj|Home remedies)[^:\n]*:)/i
  );

  return (
    <div>
      {sections.map((section, i) => {
        const headerMatch = section.match(
          /^[-–—*•]?\s*(Assessment|Next steps|What to do now|Medicine options|Suggested tests|Warning signs|Red flags|When to see doctor|Desi ilaaj|Home remedies)[^:\n]*:/i
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

        const rawHeader = headerMatch[1];
        const header = getSectionLabel(rawHeader, lang);
        const body = section.slice(headerMatch[0].length).trim();
        const isRed = /red flag|warning sign|when to see doctor/i.test(rawHeader);
        const isDesi = /desi|home remed/i.test(rawHeader);
        const isAssessment = /assessment/i.test(rawHeader);
        const isMedicine = /medicine options/i.test(rawHeader);
        const isTests = /suggested tests/i.test(rawHeader);

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
                color: isRed ? "#DC2626" : isDesi ? "#059669" : isAssessment ? "#0369A1" : isMedicine ? "#7C3AED" : isTests ? "#B45309" : DEEP,
                background: isRed ? "#FEF2F2" : isDesi ? "#ECFDF5" : isAssessment ? "#F0F9FF" : isMedicine ? "#F5F3FF" : isTests ? "#FFFBEB" : "#EFFAF4",
                padding: "6px 11px",
                borderRadius: 999,
                marginBottom: 9,
                fontFamily: "'Sora','Plus Jakarta Sans',sans-serif",
                border: `1px solid ${isRed ? "#FECACA" : isDesi ? "#A7F3D0" : isAssessment ? "#BAE6FD" : isTests ? "#FDE68A" : "rgba(12,90,62,0.08)"}`,
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
function ChatBubble({
  m,
  onSpeak,
  onFeedback,
  onShowFull,
  onRetry,
  onReaction,
  onStar,
  speakingId,
  speakLoading,
  screen,
  uiLang,
  ttsSpeed,
  onCycleSpeed,
}) {
  const isUser = m.role === "user";
  const isSpeaking = speakingId === m.id;
  const isDesktop = screen === "desktop";
  const [showReactions, setShowReactions] = React.useState(false);
  const reactionBarRef = React.useRef(null);
  const longPressTimerRef = React.useRef(null);

  React.useEffect(() => {
    if (!showReactions) return;
    const handler = (e) => {
      if (reactionBarRef.current && !reactionBarRef.current.contains(e.target)) {
        setShowReactions(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [showReactions]);
  const displayText = m.fullText && m.role === "assistant" ? m.text : m.text;
  const assistantFullText = m.fullText || m.text || "";
  const showStreamingControl = !isUser && m.isStreaming && !m.streamDone;
  const isErrorBubble = Boolean(m?.meta?.errorBubble);
  const canRetry = Boolean(m?.meta?.retryPayload);

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
            background: isErrorBubble
              ? "linear-gradient(135deg,#B45309,#D97706)"
              : `linear-gradient(135deg, ${DEEP}, ${MID})`,
            display: "grid",
            placeItems: "center",
            boxShadow: isErrorBubble
              ? "0 8px 20px rgba(180,83,9,0.18)"
              : "0 8px 20px rgba(10,90,59,0.18)",
          }}
        >
          {isErrorBubble ? (
            <AlertTriangle style={{ width: 14, height: 14, color: "#FDE68A" }} />
          ) : (
            <Sparkles style={{ width: 14, height: 14, color: ACC }} />
          )}
        </div>
      )}

      <div
        style={{
          position: "relative",
          maxWidth: isDesktop ? "75%" : "86%",
          borderRadius: isUser ? "22px 22px 8px 22px" : "22px 22px 22px 8px",
          padding: isDesktop ? "16px 18px" : "14px 15px",
          background: isUser ? USER_BUBBLE : isErrorBubble ? "rgba(255,251,235,0.98)" : GLASS_STRONG,
          border: isUser ? "none" : `1px solid ${isErrorBubble ? "#FDE68A" : GLASS_BORDER}`,
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
        ) : m.liveStream && m.isStreaming && !(m.text || "").trim() ? (
          <div style={{ color: "#9CA3AF", fontSize: 13, fontStyle: "italic" }}>Thinking...</div>
        ) : (
          <FormatReply text={displayText} screen={screen} uiLang={uiLang} />
        )}

        {!isUser && !!(m.text || "").trim() && (!m.liveStream || m.streamDone) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 11, flexWrap: "wrap" }}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onSpeak({ ...m, text: assistantFullText })}
              disabled={speakLoading}
              style={{
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
                    width: 11, height: 11,
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

            {/* Speed control chip — always visible next to Listen */}
            {!isUser && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(30);
                  onCycleSpeed();
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 36,
                  height: 26,
                  borderRadius: 999,
                  border: `1px solid ${ttsSpeed !== 1 ? "rgba(24,226,161,0.35)" : "#E5E7EB"}`,
                  background: ttsSpeed !== 1 ? "#ECFDF5" : "#FAFAFA",
                  padding: "0 8px",
                  fontSize: 11,
                  fontWeight: 800,
                  color: ttsSpeed !== 1 ? "#059669" : "#6B7280",
                  cursor: "pointer",
                }}
                title="Change playback speed"
              >
                {ttsSpeed}x
              </motion.button>
            )}

            {/* Save/Star button */}
            {!isUser && m.streamDone && onStar && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => onStar(m)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  border: "1px solid #E5E7EB",
                  borderRadius: 999,
                  background: "#FAFAFA",
                  padding: "6px 10px",
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#6B7280",
                  cursor: "pointer",
                }}
                title="Save this reply"
              >
                <Bookmark style={{ width: 11, height: 11 }} />
                Save
              </motion.button>
            )}

            {showStreamingControl && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => onShowFull(m.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  border: "1px solid #D1D5DB",
                  borderRadius: 999,
                  background: "#FFFFFF",
                  padding: "6px 12px",
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#374151",
                  cursor: "pointer",
                }}
              >
                Show full
              </motion.button>
            )}

            {canRetry && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => onRetry(m)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  border: "1px solid #FCD34D",
                  borderRadius: 999,
                  background: "#FFF7ED",
                  padding: "6px 12px",
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#B45309",
                  cursor: "pointer",
                }}
              >
                <RefreshCcw style={{ width: 12, height: 12 }} />
                Retry
              </motion.button>
            )}

            {!isErrorBubble && (
              <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                {/* Current reaction display */}
                {m.reaction && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    whileTap={{ scale: 0.85 }}
                    onClick={() => {
                      if (navigator.vibrate) navigator.vibrate(25);
                      onReaction(m, null);
                      setShowReactions(false);
                    }}
                    style={{
                      width: 32, height: 32, borderRadius: 999,
                      border: "1px solid rgba(24,226,161,0.3)", background: "rgba(24,226,161,0.08)",
                      display: "grid", placeItems: "center",
                      cursor: "pointer", fontSize: 16,
                      transition: "all 0.2s ease",
                    }}
                    title="Remove reaction"
                  >
                    {m.reaction}
                  </motion.button>
                )}

                {/* Reaction trigger button */}
                {!m.reaction && (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      if (navigator.vibrate) navigator.vibrate(20);
                      setShowReactions(!showReactions);
                    }}
                    onPointerDown={() => {
                      longPressTimerRef.current = setTimeout(() => {
                        if (navigator.vibrate) navigator.vibrate(30);
                        setShowReactions(true);
                      }, 300);
                    }}
                    onPointerUp={() => clearTimeout(longPressTimerRef.current)}
                    onPointerLeave={() => clearTimeout(longPressTimerRef.current)}
                    style={{
                      width: 30, height: 30, borderRadius: 999,
                      border: "1px solid #E5E7EB", background: "#FAFAFA",
                      display: "grid", placeItems: "center",
                      cursor: "pointer", fontSize: 14,
                    }}
                    title="React"
                  >
                    😊
                  </motion.button>
                )}

                {/* Floating reaction bar (WhatsApp-style) */}
                <AnimatePresence>
                  {showReactions && (
                    <motion.div
                      ref={reactionBarRef}
                      initial={{ opacity: 0, scale: 0.6, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.6, y: 8 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: "110%",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        background: "rgba(255,255,255,0.97)",
                        borderRadius: 28,
                        padding: "4px 5px",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)",
                        border: "1px solid rgba(0,0,0,0.06)",
                        zIndex: 100,
                        backdropFilter: "blur(12px)",
                      }}
                    >
                      {["❤️", "👍", "👎", "😂", "😮", "🙏"].map((emoji) => (
                        <motion.button
                          key={emoji}
                          whileHover={{ scale: 1.35, y: -4 }}
                          whileTap={{ scale: 0.85 }}
                          onClick={() => {
                            if (navigator.vibrate) navigator.vibrate(50);
                            onReaction(m, emoji);
                            setShowReactions(false);
                            // Map emoji to feedback for analytics
                            const sentiment = ["❤️", "👍"].includes(emoji) ? "up" : emoji === "👎" ? "down" : "neutral";
                            if (sentiment !== "neutral") onFeedback(m, sentiment);
                          }}
                          style={{
                            width: isDesktop ? 36 : 32,
                            height: isDesktop ? 36 : 32,
                            borderRadius: 999,
                            border: "none",
                            background: "transparent",
                            display: "grid",
                            placeItems: "center",
                            cursor: "pointer",
                            fontSize: isDesktop ? 18 : 16,
                            transition: "background 0.15s ease",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        >
                          {emoji}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* Reaction badge on bubble corner */}
        {m.reaction && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              position: "absolute",
              bottom: -8,
              right: 12,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              display: "grid",
              placeItems: "center",
              fontSize: 15,
              zIndex: 5,
            }}
          >
            {m.reaction}
          </motion.div>
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
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [speakLoading, setSpeakLoading] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState(() => {
    const saved = localStorage.getItem("gd_tts_speed");
    return saved ? parseFloat(saved) : 1;
  });
  const ttsSpeedRef = useRef(ttsSpeed);
  useEffect(() => { ttsSpeedRef.current = ttsSpeed; }, [ttsSpeed]);
  const TTS_SPEEDS = [1, 1.25, 1.5, 2, 0.75];
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showMemoryPrompt, setShowMemoryPrompt] = useState(false);
  const pendingStickyRef = useRef("");

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
  const ttsCacheRef = useRef(new Map());
  const ttsPendingRef = useRef(new Map());
  const revealTimeoutsRef = useRef(new Map());
  const stickyContextRef = useRef("");
  const newChatFlagRef = useRef(false);
  const latestMessagesRef = useRef([]);
  const lastAutoScrollRef = useRef(0);

  const makeId = () => `msg-${msgIdCounter.current++}`;

  const [messages, setMessages] = useState([
    createAssistantMessage({
      id: makeId(),
      text:
        "Namaste! Main GoDavaii AI hoon — aapka personal health assistant.\n\n" +
        "Symptoms, reports, prescriptions, scans, ya voice se baat karein. Main simple language me samjhaunga.",
      meta: {},
      isStreaming: false,
    }),
  ]);

  const throttledAutoScroll = useCallback((force = false) => {
    const now = Date.now();
    if (!force && now - lastAutoScrollRef.current < 120) return;
    lastAutoScrollRef.current = now;

    requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({
        behavior: force ? "smooth" : "auto",
        block: "end",
      });
    });
  }, []);

  useEffect(() => {
    latestMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("gd_ai_reply_lang", replyLanguage);
  }, [replyLanguage]);

  useEffect(() => {
    const revealTimeoutsMap = revealTimeoutsRef.current;

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
      try {
        revealTimeoutsMap.forEach((timeouts) => {
          (timeouts || []).forEach((t) => clearTimeout(t));
        });
        revealTimeoutsMap.clear();
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
  const composerOuterHeight = attachedFile ? 146 : 110;

  useEffect(() => {
    throttledAutoScroll(true);
  }, [loading, attachedFile, throttledAutoScroll]);

  const stopRevealForMessage = useCallback((messageId) => {
    const timeouts = revealTimeoutsRef.current.get(messageId) || [];
    timeouts.forEach((t) => clearTimeout(t));
    revealTimeoutsRef.current.delete(messageId);
  }, []);

  const showAssistantMessageFully = useCallback((messageId) => {
    stopRevealForMessage(messageId);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              text: m.fullText || m.text,
              isStreaming: false,
              streamDone: true,
            }
          : m
      )
    );
    throttledAutoScroll(true);
  }, [stopRevealForMessage, throttledAutoScroll]);

  // Eagerly prefetch TTS audio in parallel chunks the moment full text arrives
  // eslint-disable-next-line no-unused-vars
  const prefetchTTSForText = useCallback((rawText) => {
    const text = cleanAssistantText(rawText);
    if (!text || text.length < 20) return;

    const lang =
      replyLanguage && replyLanguage !== "auto"
        ? replyLanguage
        : detectLanguageForTTS(text);
    const masterKey = `${lang}::${text}`;

    if (ttsCacheRef.current.has(masterKey)) return;

    const chunks = splitTextForTTSChunks(text, 900);
    console.log(`[TTS prefetch] ${chunks.length} chunk(s) for:`, text.slice(0, 40), "...");

    // Store metadata so handleSpeak knows about chunks
    ttsCacheRef.current.set(masterKey, { chunked: true, totalChunks: chunks.length });

    // Fire chunks SEQUENTIALLY — one at a time to avoid backend rate-limits
    // Each promise is stored in ttsPendingRef so handleSpeak won't fire duplicates
    const prefetchSequential = async () => {
      for (let i = 0; i < chunks.length; i++) {
        const chunkKey = `${masterKey}::${i}`;
        if (ttsCacheRef.current.has(chunkKey)) continue;

        // Create the promise and store it in ttsPendingRef BEFORE awaiting
        // so that handleSpeak's getChunkAudio can find it and await the same promise
        const promise = axios.post(
          `${API}/api/ai/assistant/tts`,
          { text: chunks[i], language: lang, replyLanguagePreference: replyLanguage || "auto" },
          { timeout: 120000, headers: getAuthHeaders() }
        );
        ttsPendingRef.current.set(chunkKey, promise);

        try {
          const { data } = await promise;
          ttsPendingRef.current.delete(chunkKey);
          if (data?.audioBase64) {
            console.log(`[TTS prefetch] Chunk ${i+1}/${chunks.length} DONE`);
            ttsCacheRef.current.set(chunkKey, {
              audioBase64: data.audioBase64,
              mimeType: data.mimeType || "audio/mpeg",
            });
          } else {
            console.warn(`[TTS prefetch] Chunk ${i+1} empty — engine: ${data?.engine} — reason: ${data?.failReason || "unknown"}`);
          }
        } catch (err) {
          ttsPendingRef.current.delete(chunkKey);
          console.error(`[TTS prefetch] Chunk ${i+1} failed:`, err?.message);
        }
      }
    };

    prefetchSequential();
  }, [replyLanguage]);

  const appendAssistantMessageWithReveal = useCallback((fullText, meta = {}) => {
    const id = makeId();
    const cleanFull = String(fullText || "");

    // [chunk-on-demand] Eager prefetch disabled — TTS is now fetched on-demand when user clicks Listen
    // prefetchTTSForText(cleanFull);
    const chunks = chunkTextForReveal(cleanFull);

    if (!cleanFull.trim() || chunks.length <= 1 || cleanFull.length < 60) {
      setMessages((prev) => [
        ...prev,
        createAssistantMessage({
          id,
          text: cleanFull,
          meta,
          isStreaming: false,
        }),
      ]);
      throttledAutoScroll(true);
      return id;
    }

    setMessages((prev) => [
      ...prev,
      createAssistantMessage({
        id,
        text: cleanFull,
        meta,
        isStreaming: true,
      }),
    ]);

    let built = "";
    let cumulative = 0;
    const scheduled = [];

    chunks.forEach((chunk, idx) => {
      cumulative += chunk.delay;
      const timeout = setTimeout(() => {
        built += chunk.text;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? {
                  ...m,
                  text: built,
                  isStreaming: idx !== chunks.length - 1,
                  streamDone: idx === chunks.length - 1,
                }
              : m
          )
        );

        if (idx === chunks.length - 1) {
          revealTimeoutsRef.current.delete(id);
          throttledAutoScroll(true);
        } else {
          throttledAutoScroll(false);
        }
      }, cumulative);

      scheduled.push(timeout);
    });

    revealTimeoutsRef.current.set(id, scheduled);
    return id;
  }, [throttledAutoScroll]); // eslint-disable-line react-hooks/exhaustive-deps

  const pushErrorBubble = useCallback((err, retryPayload = null) => {
    const msg = String(getApiErrorMessage(err) || "Request failed.");
    const lower = msg.toLowerCase();

    const looksTimeout =
      err?.code === "ECONNABORTED" ||
      lower.includes("timeout") ||
      lower.includes("timed out");

    const fileMode = Boolean(retryPayload?.file);

    const text = fileMode
      ? looksTimeout
        ? "File analyze karne me thoda time lag gaya. Retry karo — usually kaam kar jata hai."
        : "File read karne me issue hua. Retry karo ya file dubara upload karo."
      : looksTimeout
        ? "Response me delay ho gaya. Retry karo."
        : "Response me issue hua. Retry karo.";

    setMessages((prev) => [
      ...prev,
      createAssistantMessage({
        id: makeId(),
        text,
        meta: {
          errorBubble: true,
          retryPayload: retryPayload || null,
          rawError: msg,
        },
        isStreaming: false,
      }),
    ]);
    throttledAutoScroll(true);
  }, [throttledAutoScroll]);

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
          meta: {},
        };
        const nextMessages = [...latestMessagesRef.current, userMsg];
        setMessages(nextMessages);
        setLoading(true);
        throttledAutoScroll(true);

        const out = await askBackendWithFile(autoPrompt, buildCompactHistory(nextMessages), reportFile);
        setCurrentSessionId(out?.sessionId || null);

        appendAssistantMessageWithReveal(out.reply, {
          ...(out.meta || {}),
          sessionId: out.sessionId || null,
        });
      } catch (e) {
        pushErrorBubble(e, {
          type: "auto-file",
          messageText: "Please analyze this uploaded medical report/image in detail and explain findings in simple language.",
          file: null,
          preferLatestVault: false,
        });
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
      stickyContext: stickyContextRef.current || "",
      userSummary: {
        id: user?._id || user?.userId || null,
        name: user?.name || null,
        age: user?.age || null,
        gender: user?.gender || null,
        dob: user?.dob || null,
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [whoFor, whoForLabel, replyLanguage, focus, user]
  );

  /* ── TTS ────────────────────────────────────────────────── */
  const speakGenRef = useRef(0);

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

    const gen = ++speakGenRef.current;
    setSpeakingId(msg.id);
    setSpeakLoading(true);

    const text = cleanAssistantText(msg.fullText || msg.text);
    const lang =
      replyLanguage && replyLanguage !== "auto"
        ? replyLanguage
        : detectLanguageForTTS(text);

    const cacheKey = `${lang}::${text}`;

    // Play a single base64 audio clip and return a promise that resolves when it ends
    const playChunk = (base64, mime) =>
      new Promise((resolve) => {
        if (gen !== speakGenRef.current) { resolve(); return; }
        const audio = new Audio(`data:${mime};base64,${base64}`);
        audio.playbackRate = ttsSpeedRef.current;
        audioRef.current = audio;
        audio.onended = () => { audioRef.current = null; resolve(); };
        audio.onerror = () => { audioRef.current = null; resolve(); };
        audio.play().catch(() => resolve());
      });

    // Get audio for a chunk — from cache, pending prefetch, or fresh API call
    const getChunkAudio = async (chunkKey, chunkText) => {
      const c = ttsCacheRef.current.get(chunkKey);
      if (c?.audioBase64) return c;

      let pending = ttsPendingRef.current.get(chunkKey);
      if (!pending) {
        pending = axios.post(
          `${API}/api/ai/assistant/tts`,
          { text: chunkText, language: lang, replyLanguagePreference: replyLanguage || "auto" },
          { timeout: 120000, headers: getAuthHeaders() }
        );
        ttsPendingRef.current.set(chunkKey, pending);
      }

      try {
        const { data } = await pending;
        ttsPendingRef.current.delete(chunkKey);
        if (data?.audioBase64) {
          const entry = { audioBase64: data.audioBase64, mimeType: data.mimeType || "audio/mpeg" };
          ttsCacheRef.current.set(chunkKey, entry);
          return entry;
        }
      } catch (err) {
        ttsPendingRef.current.delete(chunkKey);
        console.error("[TTS] Chunk fetch failed:", err?.message);
      }
      return null;
    };

    try {
      // Legacy single-audio cache path (for entries cached before chunk-on-demand)
      const meta = ttsCacheRef.current.get(cacheKey);
      if (meta?.audioBase64) {
        console.log("[TTS] CACHE HIT single");
        setSpeakLoading(false);
        await playChunk(meta.audioBase64, String(meta.mimeType || "audio/mpeg"));
        setSpeakingId(null);
        audioRef.current = null;
        return;
      }

      // Chunk-on-demand with lookahead-1:
      // Fetch only the current + next chunk instead of all chunks upfront
      const chunks = splitTextForTTSChunks(text, 900);
      console.log(`[TTS] Chunk-on-demand: ${chunks.length} chunk(s)`);

      // Store master metadata so re-listen knows about chunks
      if (!meta?.chunked) {
        ttsCacheRef.current.set(cacheKey, { chunked: true, totalChunks: chunks.length });
      }

      setSpeakLoading(false);

      for (let i = 0; i < chunks.length; i++) {
        if (gen !== speakGenRef.current) break;

        const chunkKey = `${cacheKey}::${i}`;

        // Fetch current chunk (may already be cached from previous lookahead or re-listen)
        const audio = await getChunkAudio(chunkKey, chunks[i]);
        if (gen !== speakGenRef.current) break;

        // Start prefetching next chunk in background (lookahead-1)
        if (i + 1 < chunks.length) {
          const nextChunkKey = `${cacheKey}::${i + 1}`;
          getChunkAudio(nextChunkKey, chunks[i + 1]).catch(() => {});
        }

        // Play current chunk
        if (audio?.audioBase64) {
          await playChunk(audio.audioBase64, String(audio.mimeType || "audio/mpeg"));
        }
      }

      setSpeakingId(null);
      setSpeakLoading(false);
      audioRef.current = null;
      return;
    } catch (err) {
      console.error("TTS failed:", err?.message || err);
    }

    setSpeakingId(null);
    setSpeakLoading(false);
  }, [speakingId, replyLanguage]);

  // [chunk-on-demand] Backup prefetch disabled — TTS is now fetched on-demand when user clicks Listen
  // useEffect(() => {
  //   const last = [...messages]
  //     .reverse()
  //     .find((m) => m.role === "assistant" && !(m?.meta?.errorBubble));
  //   if (last?.fullText || last?.text) {
  //     prefetchTTSForText(last.fullText || last.text);
  //   }
  // }, [messages, replyLanguage, prefetchTTSForText]);

  async function submitFeedback(messageObj, rating, reason = "") {
    try {
      const assistantIndex = messages.findIndex((m) => m.id === messageObj?.id);
      const previousUser = assistantIndex > 0
        ? [...messages.slice(0, assistantIndex)].reverse().find((m) => m.role === "user")
        : null;

      await axios.post(
        `${API}/api/ai/feedback`,
        {
          sessionId: messageObj?.meta?.sessionId || currentSessionId || null,
          rating,
          reason,
          queryType: focus,
          language: replyLanguage,
          aiSource: messageObj?.meta?.aiSource || "gpt-mini",
          complexity: messageObj?.meta?.complexity || "GREEN",
          confidence: Number(messageObj?.meta?.confidence || 0),
          responsePreview: String(messageObj?.fullText || messageObj?.text || "").slice(0, 500),
          userQueryPreview: String(previousUser?.text || "").slice(0, 300),
        },
        { timeout: 5000, headers: getAuthHeaders() }
      );
    } catch (err) {
      console.error("Feedback submit failed:", err);
    }
  }

  function handleReaction(messageObj, emoji) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageObj.id
          ? { ...m, reaction: m.reaction === emoji ? null : emoji }
          : m
      )
    );
  }

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
    fd.append("transcriptMode", replyLanguage === "hinglish" ? "romanized" : "native");

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

    recorder.start(250);
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
      try {
        recognitionRef.current?.stop?.();
      } catch (_) {}
      stopRecordedMic();
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const preferBrowserSTT = screen === "desktop" && SR;

    if (preferBrowserSTT) {
      try {
        const rec = new SR();
        recognitionRef.current = rec;
        rec.lang = getSpeechRecognitionLang(replyLanguage);
        rec.interimResults = true;
        rec.continuous = false;
        rec.maxAlternatives = 1;

        let finalText = "";

        rec.onstart = () => setMicOn(true);
        rec.onerror = () => {
          setMicOn(false);
          recognitionRef.current = null;
        };
        rec.onend = () => {
          setMicOn(false);
          recognitionRef.current = null;

          if (finalText.trim()) {
            setInput((prev) => `${prev}${prev ? " " : ""}${finalText.trim()}`);
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

        rec.onresult = (e) => {
          let text = "";
          for (let i = e.resultIndex; i < e.results.length; i += 1) {
            text += e.results[i][0]?.transcript || "";
          }
          finalText = text.trim();
        };

        rec.start();
        return;
      } catch (err) {
        console.error("Desktop browser STT failed, falling back to recorder:", err);
      }
    }

    try {
      if (navigator.mediaDevices?.getUserMedia && window.MediaRecorder) {
        await startRecordedMic();
        return;
      }
    } catch (err) {
      console.error("Recorded mic start failed:", err);
    }

    if (SR) {
      try {
        const rec = new SR();
        recognitionRef.current = rec;
        rec.lang = getSpeechRecognitionLang(replyLanguage);
        rec.interimResults = true;
        rec.continuous = false;
        rec.maxAlternatives = 1;

        let finalText = "";

        rec.onstart = () => setMicOn(true);
        rec.onerror = () => {
          setMicOn(false);
          recognitionRef.current = null;
        };
        rec.onend = () => {
          setMicOn(false);
          recognitionRef.current = null;

          if (finalText.trim()) {
            setInput((prev) => `${prev}${prev ? " " : ""}${finalText.trim()}`);
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

        rec.onresult = (e) => {
          let text = "";
          for (let i = e.resultIndex; i < e.results.length; i += 1) {
            text += e.results[i][0]?.transcript || "";
          }
          finalText = text.trim();
        };

        rec.start();
      } catch (err) {
        console.error("SpeechRecognition fallback failed:", err);
        setMicOn(false);
      }
    }
  }

  /* ── Backend ────────────────────────────────────────────── */
  async function askBackend(messageText, history) {
  const isNew = newChatFlagRef.current;
  if (isNew) newChatFlagRef.current = false; // consume flag after first use
  const payload = { message: messageText, history, context: { ...profileContext, stickyContext: stickyContextRef.current || "", ...(isNew ? { newChat: true } : {}) } };
  const headers = getAuthHeaders();

  const endpoints = [
    `${API}/api/ai/assistant/chat`,
    `${API}/api/ai/chat`,
    `${API}/api/ai/assistant`,
  ];

  let lastErr = null;

  for (let i = 0; i < endpoints.length; i += 1) {
    const url = endpoints[i];

    try {
      const r = await axios.post(url, payload, {
        timeout: CHAT_TIMEOUT_MS,
        headers,
      });

      const t = r?.data?.reply || r?.data?.answer || r?.data?.message || "";
      if (String(t).trim()) {
        // Update sticky context from backend response
        if (r?.data?.stickyContext) {
          stickyContextRef.current = String(r.data.stickyContext);
        }
        return {
          reply: t,
          sessionId: r?.data?.sessionId || null,
          context: r?.data?.context || {},
          meta: r?.data?.meta || {},
        };
      }

      lastErr = new Error("Empty reply");
    } catch (err) {
      lastErr = err;

      const status = err?.response?.status;

      console.error("Chat AI failed:", url, getApiErrorMessage(err));

      // compatibility fallback only for missing/unsupported route
      // do NOT keep jumping endpoints after timeout
      const shouldTryNext =
        i < endpoints.length - 1 &&
        (status === 404 || status === 405 || status === 501);

      if (!shouldTryNext) {
        throw err;
      }
    }
  }

  throw lastErr || new Error("AI chat failed.");
}

  /**
   * SSE Streaming chat — text appears word-by-word in 2-3s instead of waiting 60-90s
   * Falls back to regular askBackend if streaming endpoint unavailable
   */
  async function askBackendStream(messageText, history, onChunk) {
    const isNew = newChatFlagRef.current;
    if (isNew) newChatFlagRef.current = false;
    const payload = {
      message: messageText,
      history,
      context: {
        ...profileContext,
        stickyContext: stickyContextRef.current || "",
        ...(isNew ? { newChat: true } : {}),
      },
    };
    const headers = getAuthHeaders();

    try {
      const response = await fetch(`${API}/api/ai/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(payload),
      });

      // If not SSE, fall back to regular JSON response
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream")) {
        const data = await response.json();
        return {
          reply: data.reply || "",
          sessionId: data.sessionId || null,
          context: data.context || {},
          meta: { ...(data.meta || {}), streamed: false },
        };
      }

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let sessionId = null;
      let meta = {};

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            switch (event.type) {
              case "chunk":
                fullText += event.text;
                if (onChunk) onChunk(fullText);
                break;

              case "safety":
                fullText += "\n" + event.text;
                if (onChunk) onChunk(fullText);
                break;

              case "done":
                if (event.fullText) fullText = event.fullText;
                meta = event.meta || {};
                meta.streamed = true;
                break;

              case "error":
                throw new Error(event.error || "Stream error");

              default:
                break;
            }
          } catch (parseErr) {
            if (parseErr.message && !parseErr.message.includes("JSON")) throw parseErr;
          }
        }
      }

      // Update sticky context
      if (meta?.stickyContext) {
        stickyContextRef.current = String(meta.stickyContext);
      }

      return {
        reply: fullText,
        sessionId,
        context: {},
        meta,
      };
    } catch (err) {
      console.warn("[Stream] Failed, falling back to regular chat:", err?.message);
      // Fallback to regular non-streaming endpoint
      return askBackend(messageText, history);
    }
  }

  async function askBackendWithFile(messageText, history, fileOrFiles) {
    const headers = {
      ...getAuthHeaders(),
      "Content-Type": "multipart/form-data",
    };

    const filesArray = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];

    let lastErr = null;
    for (const url of [`${API}/api/ai/assistant/analyze-file`, `${API}/api/ai/analyze-file`]) {
      const fd = new FormData();

      if (filesArray.length === 1) {
        fd.append("file", filesArray[0]);
      } else {
        filesArray.forEach((f) => fd.append("files", f));
      }

      fd.append("message", messageText || "");
      fd.append("history", JSON.stringify(history));
      fd.append("context", JSON.stringify(profileContext));

      try {
        const r = await axios.post(url, fd, { timeout: FILE_ANALYZE_TIMEOUT_MS, headers });
        const t = r?.data?.reply || r?.data?.answer || r?.data?.message || "";
        if (String(t).trim()) {
          return {
            reply: t,
            sessionId: r?.data?.sessionId || null,
            parsed: r?.data?.parsed || {},
            meta: r?.data?.meta || {},
          };
        }
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

    throw lastErr || new Error("AI file analysis failed.");
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
  async function sendMessage(customPayload = null) {
    const msg = customPayload?.messageText != null ? String(customPayload.messageText || "") : input.trim();
    let activeFile = customPayload?.file ?? attachedFile;
    let activeFiles = customPayload?.files ?? (attachedFiles.length > 1 ? attachedFiles : null);
    const preferLatestVault = Boolean(customPayload?.preferLatestVault);

    if (!msg && !activeFile && !activeFiles?.length) return;
    if (loading) return;

    if (!activeFile && !activeFiles?.length && msg && (preferLatestVault || wantsLatestVaultReportAnalysis(msg))) {
      try {
        activeFile = await fetchLatestVaultReportAsFile();
      } catch {
        // ignore
      }
    }

    const hasFiles = activeFiles?.length > 1 || activeFile;
    const fileLabel = activeFiles?.length > 1
      ? activeFiles.map(f => `📎 ${f.name}`).join("\n")
      : activeFile ? `📎 ${activeFile.name}${!attachedFile && !customPayload?.file ? " (auto-attached)" : ""}` : "";

    const userBubbleText = hasFiles
      ? `${msg || "(file uploaded)"}\n${fileLabel}`
      : msg;

    const userBubble = { id: makeId(), role: "user", text: userBubbleText, meta: {} };
    const nextMessages = [...latestMessagesRef.current, userBubble];
    setMessages(nextMessages);

    if (!customPayload) {
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "24px";
    }

    setLoading(true);
    throttledAutoScroll(true);

    try {
      const filesToSend = activeFiles?.length > 1 ? activeFiles : activeFile;

      if (filesToSend) {
        // File uploads — use regular (non-streaming) endpoint
        const out = await askBackendWithFile(msg, buildCompactHistory(nextMessages), filesToSend);
        if (out?.sessionId) setCurrentSessionId(out.sessionId);
        appendAssistantMessageWithReveal(out.reply, {
          ...(out.meta || {}),
          sessionId: out.sessionId || currentSessionId || null,
        });
        if (!customPayload) {
          setAttachedFile(null);
          setAttachedFiles([]);
        }
      } else {
        // Text-only — use SSE streaming for instant perceived response
        const streamMsgId = makeId();

        // Create empty assistant message immediately (shows "thinking" state)
        setMessages((prev) => [
          ...prev,
          createAssistantMessage({
            id: streamMsgId,
            text: "",
            meta: {},
            isStreaming: true,
            liveStream: true,
          }),
        ]);

        const out = await askBackendStream(
          msg,
          buildCompactHistory(nextMessages),
          (partialText) => {
            // Update message with each new chunk — text flows like typing
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamMsgId
                  ? { ...m, text: partialText, isStreaming: true }
                  : m
              )
            );
            throttledAutoScroll(false);
          }
        );

        // Finalize the streamed message — show Listen/Save buttons now
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamMsgId
              ? {
                  ...m,
                  text: out.reply || m.text,
                  fullText: out.reply || m.text,
                  isStreaming: false,
                  streamDone: true,
                  liveStream: false,
                  meta: out.meta || {},
                }
              : m
          )
        );

        if (out?.sessionId) setCurrentSessionId(out.sessionId);
        throttledAutoScroll(true);
      }
    } catch (err) {
      pushErrorBubble(err, {
        type: (activeFile || activeFiles?.length) ? "file" : "chat",
        messageText: msg,
        file: activeFile || null,
        files: activeFiles || null,
        preferLatestVault,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRetryBubble(messageObj) {
    const retry = messageObj?.meta?.retryPayload;
    if (!retry || loading) return;

    await sendMessage({
      messageText: retry.messageText || "",
      file: retry.file || null,
      preferLatestVault: Boolean(retry.preferLatestVault),
    });
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
        setMessages(
          data.messages.map((m, i) => ({
            id: `hist-${i}`,
            role: m.role,
            text: m.text,
            fullText: m.role === "assistant" ? m.text : undefined,
            isStreaming: false,
            streamDone: true,
            meta: m.role === "assistant"
              ? {
                  aiSource: m.aiSource || "",
                  complexity: m.complexity || "",
                  confidence: typeof m.confidence === "number" ? m.confidence : 0,
                  sessionId: sessionId || null,
                }
              : {},
          }))
        );
      }
      setCurrentSessionId(sessionId || null);
      setSidebarOpen(false);
    } catch {
      // ignore
    }
  }

  function startNewChat() {
    revealTimeoutsRef.current.forEach((timeouts) => {
      (timeouts || []).forEach((t) => clearTimeout(t));
    });
    revealTimeoutsRef.current.clear();

    // Save current sticky for memory transfer prompt
    const hadSticky = (stickyContextRef.current || "").trim().length > 0;
    pendingStickyRef.current = stickyContextRef.current || "";

    setMessages([
      createAssistantMessage({
        id: makeId(),
        role: "assistant",
        text: "Namaste! Aap symptoms, reports, prescriptions, ya scan upload karke seedha puch sakte ho.",
        meta: {},
        isStreaming: false,
      }),
    ]);
    setCurrentSessionId(null);
    stickyContextRef.current = "";
    newChatFlagRef.current = true;
    setSidebarOpen(false);

    // Show memory transfer prompt if there was previous context
    if (hadSticky) {
      setShowMemoryPrompt(true);
    }
  }

  function handleMemoryChoice(keepFindings) {
    if (keepFindings) {
      stickyContextRef.current = pendingStickyRef.current;
    } else {
      stickyContextRef.current = "";
    }
    pendingStickyRef.current = "";
    setShowMemoryPrompt(false);
  }

  function QuickActions() {
    const quickItems = [
      { label: "Symptoms", icon: Stethoscope, msg: "I have some symptoms to discuss" },
      { label: "Upload Report", icon: FlaskConical, action: () => fileRef.current?.click() },
      { label: "Medicine Info", icon: Pill, msg: "Tell me about a medicine" },
    ];

    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {quickItems.map((item) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.label}
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => {
                if (item.action) { item.action(); return; }
                if (item.msg) { setInput(item.msg); }
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                height: 40,
                borderRadius: 20,
                border: `1px solid rgba(12,90,62,0.10)`,
                background: "rgba(255,255,255,0.85)",
                padding: "0 16px",
                fontSize: 13,
                fontWeight: 700,
                color: TEXT,
                cursor: "pointer",
                backdropFilter: "blur(12px)",
                boxShadow: "0 4px 16px rgba(16,24,40,0.04)",
              }}
            >
              <Icon style={{ width: 15, height: 15, color: DEEP }} />
              {item.label}
            </motion.button>
          );
        })}
      </div>
    );
  }

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

      {/* TOP BAR — Premium minimal (ChatGPT/Gemini style) */}
      <div
        style={{
          position: "relative",
          zIndex: 20,
          padding: `${topPad}px ${sidePad}px 10px`,
          paddingTop: `calc(${topPad}px + env(safe-area-inset-top, 0px))`,
          backdropFilter: "blur(24px)",
          background: "linear-gradient(180deg, rgba(244,251,248,0.96), rgba(244,251,248,0.82))",
          borderBottom: "1px solid rgba(12,90,62,0.05)",
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
              width: 36,
              height: 36,
              borderRadius: 12,
              border: "none",
              background: "transparent",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Menu style={{ width: 20, height: 20, color: TEXT }} />
          </motion.button>

          <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: isDesktop ? 17 : 15.5, fontWeight: 900, color: TEXT, letterSpacing: "-0.2px" }}>
              GoDavaii AI
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setSettingsOpen(true)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              border: "none",
              background: "transparent",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Settings2 style={{ width: 20, height: 20, color: TEXT }} />
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
          WebkitOverflowScrolling: "touch",
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
              padding: isDesktop ? "32px 22px 22px" : "28px 16px 18px",
            }}
          >
            <div style={{ fontFamily: "’Sora’,sans-serif", fontSize: isDesktop ? 28 : 22, fontWeight: 900, color: SUB, lineHeight: 1.25, marginBottom: 4 }}>
              Hi {whoForLabel || "there"}
            </div>
            <div style={{ fontFamily: "’Sora’,sans-serif", fontSize: isDesktop ? 28 : 22, fontWeight: 900, color: TEXT, lineHeight: 1.25 }}>
              How can I help?
            </div>

            <div style={{ marginTop: 20 }}>
              <QuickActions />
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <ChatBubble
              key={m.id}
              m={m}
              onSpeak={handleSpeak}
              onFeedback={submitFeedback}
              onShowFull={showAssistantMessageFully}
              onRetry={handleRetryBubble}
              onReaction={handleReaction}
              speakingId={speakingId}
              speakLoading={speakLoading}
              screen={screen}
              uiLang={replyLanguage}
              ttsSpeed={ttsSpeed}
              onCycleSpeed={() => {
                setTtsSpeed((prev) => {
                  const idx = TTS_SPEEDS.indexOf(prev);
                  const next = TTS_SPEEDS[(idx + 1) % TTS_SPEEDS.length];
                  localStorage.setItem("gd_tts_speed", String(next));
                  if (audioRef.current) audioRef.current.playbackRate = next;
                  return next;
                });
              }}
              onStar={async () => {
                if (!currentSessionId) return;
                try {
                  await axios.patch(
                    `${API}/api/ai/sessions/${currentSessionId}/star`,
                    {},
                    { headers: getAuthHeaders(), timeout: 5000 }
                  );
                  loadChatHistory();
                } catch {}
              }}
            />
          ))}
        </AnimatePresence>

        {/* Memory Transfer Prompt */}
        {showMemoryPrompt && (
          <div style={{
            margin: "12px 16px",
            padding: "14px 16px",
            borderRadius: 16,
            background: ACC_SOFT,
            border: `1px solid ${ACC}33`,
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: TEXT, margin: 0 }}>
              Carry forward medical findings?
            </p>
            <p style={{ fontSize: 12, color: SUB, margin: "4px 0 10px" }}>
              Keep key findings from your last chat for better context
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => handleMemoryChoice(true)}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 10, border: "none",
                  background: `linear-gradient(135deg, ${DEEP}, ${MID})`,
                  color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer",
                }}
              >
                Yes, Keep
              </button>
              <button
                onClick={() => handleMemoryChoice(false)}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 10,
                  border: `1px solid ${SUB}33`, background: "transparent",
                  color: SUB, fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}
              >
                Fresh Start
              </button>
            </div>
          </div>
        )}

        {/* Message Limit Suggestion (15+ messages) */}
        {messages.filter(m => m.role === "user").length >= 15 && !loading && (
          <div style={{
            margin: "12px 16px",
            padding: "12px 16px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            textAlign: "center",
          }}>
            <p style={{ fontSize: 12, color: SUB, margin: "0 0 8px" }}>
              💡 This chat is getting long. For best AI accuracy, consider starting a new chat!
            </p>
            <button
              onClick={startNewChat}
              style={{
                padding: "6px 16px", borderRadius: 10, border: "none",
                background: `linear-gradient(135deg, ${DEEP}, ${MID})`,
                color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              Start New Chat
            </button>
          </div>
        )}

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
            {(attachedFile || attachedFiles.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                style={{
                  marginBottom: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {(attachedFiles.length > 1 ? attachedFiles : [attachedFile].filter(Boolean)).map((file, idx) => (
                  <div
                    key={idx}
                    style={{
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
                      {file.name}
                    </span>
                    {file.name?.toLowerCase().endsWith(".pdf") && (
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
                    {attachedFiles.length > 1 && (
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 900,
                          color: "#065F46",
                          background: "#A7F3D0",
                          padding: "3px 7px",
                          borderRadius: 999,
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}/{attachedFiles.length}
                      </span>
                    )}
                    <button
                      onClick={() => {
                        if (attachedFiles.length > 1) {
                          const newFiles = attachedFiles.filter((_, i) => i !== idx);
                          setAttachedFiles(newFiles);
                          setAttachedFile(newFiles[0] || null);
                          if (newFiles.length <= 1) setAttachedFiles([]);
                        } else {
                          setAttachedFile(null);
                          setAttachedFiles([]);
                        }
                      }}
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
                  </div>
                ))}

                {/* Add more files button (mobile users add one at a time) */}
                {(attachedFiles.length > 0 || attachedFile) && (attachedFiles.length < 5) && (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => fileRef.current?.click()}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      alignSelf: "flex-start",
                      height: 28,
                      borderRadius: 999,
                      border: "1px dashed #A7F3D0",
                      background: "rgba(236,253,245,0.6)",
                      padding: "0 12px",
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#059669",
                      cursor: "pointer",
                    }}
                  >
                    <Plus style={{ width: 12, height: 12 }} />
                    Add more files
                  </motion.button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.webp"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              const newFiles = Array.from(e.target.files || []);
              if (newFiles.length === 0) return;
              // Stack files: on mobile, users may add one file at a time
              const existing = attachedFiles.length > 0 ? [...attachedFiles] : (attachedFile ? [attachedFile] : []);
              const combined = [...existing, ...newFiles].slice(0, 5); // Max 5 files
              if (combined.length === 1) {
                setAttachedFile(combined[0]);
                setAttachedFiles([]);
              } else {
                setAttachedFile(combined[0]);
                setAttachedFiles(combined);
              }
              e.target.value = "";
            }}
          />

          <div style={{ textAlign: "center", marginBottom: 6, fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.1px" }}>
            AI reference only · Not a doctor replacement
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 6,
              borderRadius: 26,
              background: "rgba(255,255,255,0.95)",
              border: "1px solid rgba(12,90,62,0.08)",
              boxShadow: "0 12px 36px rgba(16,24,40,0.06)",
              padding: "6px 6px 6px 14px",
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
                  borderRadius: 999,
                  border: "none",
                  background: "rgba(12,90,62,0.06)",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <Paperclip style={{ width: 17, height: 17, color: DEEP }} />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleMicToggle}
                disabled={micBusy}
                style={{
                  width: btnSize,
                  height: btnSize,
                  borderRadius: 999,
                  border: "none",
                  background: micOn ? "linear-gradient(135deg,#DC2626,#EF4444)" : "rgba(12,90,62,0.06)",
                  display: "grid",
                  placeItems: "center",
                  cursor: micBusy ? "wait" : "pointer",
                  boxShadow: micOn ? "0 10px 24px rgba(220,38,38,0.26)" : "none",
                  opacity: micBusy ? 0.72 : 1,
                  position: "relative",
                  zIndex: 2,
                }}
              >
                {/* WhatsApp-style pulsing ring when mic is ON */}
                {micOn && (
                  <>
                    <span style={{
                      position: "absolute",
                      inset: -4,
                      borderRadius: 20,
                      border: "2.5px solid rgba(220,38,38,0.5)",
                      animation: "micPulse 1.4s ease-out infinite",
                      pointerEvents: "none",
                    }} />
                    <span style={{
                      position: "absolute",
                      inset: -8,
                      borderRadius: 24,
                      border: "2px solid rgba(220,38,38,0.25)",
                      animation: "micPulse 1.4s ease-out infinite 0.3s",
                      pointerEvents: "none",
                    }} />
                    <style>{`
                      @keyframes micPulse {
                        0% { transform: scale(0.85); opacity: 1; }
                        100% { transform: scale(1.25); opacity: 0; }
                      }
                    `}</style>
                  </>
                )}
                {micOn ? (
                  <MicOff style={{ width: 18, height: 18, color: "#fff" }} />
                ) : (
                  <Mic style={{ width: 18, height: 18, color: DEEP }} />
                )}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => sendMessage()}
                disabled={loading || (!input.trim() && !attachedFile)}
                style={{
                  width: btnSize,
                  height: btnSize,
                  borderRadius: 999,
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
                  (() => {
                    const now = new Date();
                    const todayStr = now.toDateString();
                    const yestStr = new Date(now - 86400000).toDateString();
                    const starred = chatSessions.filter(s => s.starred);
                    const today = chatSessions.filter(s => !s.starred && new Date(s.updatedAt).toDateString() === todayStr);
                    const yesterday = chatSessions.filter(s => !s.starred && new Date(s.updatedAt).toDateString() === yestStr);
                    const older = chatSessions.filter(s => !s.starred && new Date(s.updatedAt).toDateString() !== todayStr && new Date(s.updatedAt).toDateString() !== yestStr);

                    const SectionLabel = ({ label }) => (
                      <div style={{ fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.45)", letterSpacing: 1, textTransform: "uppercase", padding: "10px 4px 4px", fontFamily: "'Sora',sans-serif" }}>
                        {label}
                      </div>
                    );

                    const SessionCard = ({ s }) => {
                      const title = s.title || s.whoForLabel || s.whoFor || "Chat";
                      const lastMsg = s.messages?.[s.messages.length - 1]?.text || "";
                      const preview = lastMsg.slice(0, 60) + (lastMsg.length > 60 ? "..." : "");
                      const date = s.updatedAt ? new Date(s.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";
                      return (
                        <motion.button
                          key={s._id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => loadSession(s._id)}
                          style={{
                            width: "100%", textAlign: "left", padding: "12px 13px", borderRadius: 16,
                            border: s.starred ? `1px solid ${ACC}33` : "1px solid rgba(255,255,255,0.08)",
                            background: s.starred ? ACC_SOFT : "rgba(255,255,255,0.05)",
                            marginBottom: 6, cursor: "pointer", display: "block", backdropFilter: "blur(12px)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 900, color: "#fff", fontFamily: "'Sora',sans-serif", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {s.starred ? "⭐ " : ""}{title}
                            </span>
                            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.50)", fontWeight: 700, flexShrink: 0 }}>
                              {date}
                            </span>
                          </div>
                          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.60)", fontWeight: 600, lineHeight: 1.4 }}>
                            {preview || "Empty chat"}
                          </div>
                        </motion.button>
                      );
                    };

                    return (
                      <>
                        {starred.length > 0 && <><SectionLabel label="⭐ Saved" />{starred.map(s => <SessionCard key={s._id} s={s} />)}</>}
                        {today.length > 0 && <><SectionLabel label="Today" />{today.map(s => <SessionCard key={s._id} s={s} />)}</>}
                        {yesterday.length > 0 && <><SectionLabel label="Yesterday" />{yesterday.map(s => <SessionCard key={s._id} s={s} />)}</>}
                        {older.length > 0 && <><SectionLabel label="Older" />{older.map(s => <SessionCard key={s._id} s={s} />)}</>}
                      </>
                    );
                  })()
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