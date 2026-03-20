// src/components/OnboardingWizard.js — GoDavaii 2035 HealthOS Onboarding
// Step-by-step wizard after first login — collects name, DOB, gender, mobile (mandatory), email (optional)
// Handles account merge INLINE (OTP verification right here, no redirect to Profile)
// Same dark glassmorphic theme as OtpLogin for consistency

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  User, Calendar, Heart, Mail, Phone, ChevronRight,
  Loader2, Sparkles, Check, ArrowLeft, ShieldCheck, Lock,
} from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const DEEP = "#0C5A3E";
const MID = "#0E7A4F";
const ACC = "#00D97E";
const DARK = "#020C07";
const CYAN = "#00E5FF";

/* ─── Background orbs (same as OtpLogin) ─── */
function BgOrbs() {
  return (
    <>
      <div style={{
        position: "absolute", top: -80, right: -60, width: 280, height: 280,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,217,126,0.18) 0%, rgba(0,229,255,0.06) 45%, transparent 70%)",
        animation: "orbDrift 12s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: -100, left: -80, width: 320, height: 320,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,217,126,0.10) 0%, rgba(14,122,79,0.05) 50%, transparent 70%)",
        animation: "orbDrift 16s ease-in-out infinite reverse",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: "40%", left: "50%", width: 200, height: 200,
        borderRadius: "50%", transform: "translate(-50%, -50%)",
        background: "radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 65%)",
        animation: "orbDrift 10s ease-in-out infinite",
        pointerEvents: "none",
      }} />
    </>
  );
}

/* ─── Progress Bar ─── */
function ProgressBar({ current, total }) {
  const pct = (current / total) * 100;
  return (
    <div style={{
      width: "100%", height: 4, borderRadius: 4,
      background: "rgba(255,255,255,0.08)",
      overflow: "hidden",
    }}>
      <motion.div
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{
          height: "100%", borderRadius: 4,
          background: `linear-gradient(90deg, ${ACC}, ${CYAN})`,
        }}
      />
    </div>
  );
}

/* ─── Step indicator dots ─── */
function StepDots({ current, total }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 8 }}>
      {Array.from({ length: total }, (_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i === current ? 24 : 8,
            background: i <= current ? ACC : "rgba(255,255,255,0.15)",
          }}
          transition={{ duration: 0.3 }}
          style={{ height: 8, borderRadius: 4 }}
        />
      ))}
    </div>
  );
}

/* ─── Gender Pill Selector ─── */
function GenderSelector({ value, onChange }) {
  const options = [
    { label: "Male", value: "male" },
    { label: "Female", value: "female" },
    { label: "Other", value: "other" },
  ];

  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
      {options.map((opt) => (
        <motion.button
          key={opt.value}
          whileTap={{ scale: 0.95 }}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, height: 52, borderRadius: 16,
            background: value === opt.value
              ? `linear-gradient(135deg, ${ACC}25, ${CYAN}15)`
              : "rgba(255,255,255,0.06)",
            border: value === opt.value
              ? `2px solid ${ACC}`
              : "2px solid rgba(255,255,255,0.1)",
            color: value === opt.value ? ACC : "rgba(255,255,255,0.5)",
            fontSize: 15, fontWeight: 800,
            fontFamily: "'Sora', sans-serif",
            cursor: "pointer",
            transition: "all 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          {value === opt.value && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500 }}
            >
              <Check style={{ width: 14, height: 14 }} />
            </motion.div>
          )}
          {opt.label}
        </motion.button>
      ))}
    </div>
  );
}

/* ─── Styled Input ─── */
function WizardInput({ icon: Icon, placeholder, value, onChange, type = "text", inputMode, maxLength, autoFocus, onKeyDown, disabled }) {
  const ref = useRef(null);

  useEffect(() => {
    if (autoFocus && !disabled) setTimeout(() => ref.current?.focus(), 350);
  }, [autoFocus, disabled]);

  return (
    <div style={{
      display: "flex", alignItems: "center", height: 56, borderRadius: 16,
      background: disabled ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
      border: value
        ? `2px solid ${ACC}60`
        : "2px solid rgba(255,255,255,0.12)",
      padding: "0 16px", gap: 12,
      transition: "border 0.2s",
      opacity: disabled ? 0.5 : 1,
    }}>
      {Icon && <Icon style={{ width: 20, height: 20, color: ACC, flexShrink: 0, opacity: 0.7 }} />}
      <input
        ref={ref}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          flex: 1, background: "none", border: "none", outline: "none",
          color: "#fff", fontSize: 16, fontWeight: 700,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      />
      {value && !disabled && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{
            width: 22, height: 22, borderRadius: "50%",
            background: `${ACC}20`, display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Check style={{ width: 12, height: 12, color: ACC }} />
        </motion.div>
      )}
    </div>
  );
}

/* ─── OTP Boxes for merge verification ─── */
function OtpBoxes({ value, onChange, length = 6 }) {
  const refs = useRef([]);
  const digits = value.padEnd(length, " ").split("").slice(0, length);

  const handleKey = (e, idx) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const arr = value.split("");
      if (arr[idx]) { arr[idx] = ""; onChange(arr.join("")); }
      else if (idx > 0) { arr[idx - 1] = ""; onChange(arr.join("")); refs.current[idx - 1]?.focus(); }
    }
    if (e.key === "ArrowLeft" && idx > 0) refs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < length - 1) refs.current[idx + 1]?.focus();
  };

  const handleInput = (e, idx) => {
    const val = e.target.value.replace(/\D/g, "");
    if (!val) return;
    const arr = value.split("");
    if (val.length > 1) {
      const pasted = val.slice(0, length);
      onChange(pasted);
      refs.current[Math.min(pasted.length, length - 1)]?.focus();
      return;
    }
    arr[idx] = val[0];
    onChange(arr.join("").replace(/ /g, ""));
    if (idx < length - 1) refs.current[idx + 1]?.focus();
  };

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
      {digits.map((d, i) => (
        <motion.input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i }}
          type="text"
          inputMode="numeric"
          maxLength={length}
          value={d === " " ? "" : d}
          onKeyDown={(e) => handleKey(e, i)}
          onInput={(e) => handleInput(e, i)}
          onFocus={(e) => e.target.select()}
          style={{
            width: 44, height: 52, borderRadius: 14,
            border: d !== " " ? `2px solid ${ACC}` : "2px solid rgba(255,255,255,0.15)",
            background: d !== " " ? "rgba(0,217,126,0.08)" : "rgba(255,255,255,0.06)",
            color: "#fff", fontSize: 20, fontWeight: 900,
            fontFamily: "'Sora', sans-serif",
            textAlign: "center", outline: "none",
            caretColor: ACC, transition: "border 0.2s, background 0.2s",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Confetti burst for completion ─── */
function ConfettiBurst() {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 300,
    y: -(Math.random() * 250 + 100),
    rotation: Math.random() * 720,
    scale: Math.random() * 0.6 + 0.4,
    color: [ACC, CYAN, "#A855F7", "#FBBF24", "#fff"][Math.floor(Math.random() * 5)],
    delay: Math.random() * 0.3,
  }));

  return (
    <div style={{
      position: "absolute", inset: 0, overflow: "hidden",
      pointerEvents: "none", zIndex: 5,
    }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: p.scale, rotate: p.rotation }}
          transition={{ duration: 1.5, delay: p.delay, ease: "easeOut" }}
          style={{
            position: "absolute", left: "50%", top: "45%",
            width: 8, height: 8, borderRadius: 2, background: p.color,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN ONBOARDING WIZARD
   ═══════════════════════════════════════════════════ */
export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { user, setUser, token } = useAuth();

  // Redirect if already onboarded
  useEffect(() => {
    if (user?.profileCompleted || localStorage.getItem("profileCompleted") === "1") {
      navigate("/home", { replace: true });
    }
  }, [user?.profileCompleted, navigate]);

  // Determine which steps to show based on what's already filled
  const hasEmail = Boolean(user?.email);
  const hasMobile = Boolean(user?.mobile);

  // Steps config — dynamically built
  // Both mobile AND email are MANDATORY — health app needs both
  const STEPS = [];
  STEPS.push("name");      // Always: name is mandatory
  STEPS.push("about");     // Always: DOB + Gender
  if (!hasMobile) STEPS.push("mobile");  // Mobile is MANDATORY
  if (!hasEmail) STEPS.push("email");    // Email is MANDATORY
  STEPS.push("done");      // Always: completion

  const TOTAL = STEPS.length;

  const [stepIdx, setStepIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form data
  const [name, setName] = useState(user?.name && user.name !== "New User" && user.name !== "" ? user.name : "");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [mobileValue, setMobileValue] = useState("");
  const [emailValue, setEmailValue] = useState("");

  // ── Merge flow state ──
  // When a 409 conflict happens, we show OTP verification RIGHT HERE
  const [mergeState, setMergeState] = useState(null);
  // mergeState: { field: "email"|"mobile", value: string, masked: string, otp: string, sending: bool }

  const currentStep = STEPS[stepIdx];

  // Auto-format DOB input (dd-mm-yyyy)
  const handleDobChange = (val) => {
    let cleaned = val.replace(/[^\d-]/g, "");
    const digits = cleaned.replace(/-/g, "");
    if (digits.length <= 2) cleaned = digits;
    else if (digits.length <= 4) cleaned = digits.slice(0, 2) + "-" + digits.slice(2);
    else cleaned = digits.slice(0, 2) + "-" + digits.slice(2, 4) + "-" + digits.slice(4, 8);
    setDob(cleaned);
  };

  const parseDobToIso = (val) => {
    if (!val) return "";
    const parts = val.split("-");
    if (parts.length !== 3) return "";
    const [dd, mm, yyyy] = parts;
    if (!dd || !mm || !yyyy || yyyy.length !== 4) return "";
    const d = parseInt(dd), m = parseInt(mm), y = parseInt(yyyy);
    if (!d || !m || !y || m < 1 || m > 12 || d < 1 || d > 31) return "";
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };

  // Validate current step
  const canProceed = () => {
    if (mergeState) return false; // can't proceed while merge is active
    switch (currentStep) {
      case "name": return name.trim().length >= 2;
      case "about": return dob.length >= 10 && parseDobToIso(dob) && gender;
      case "mobile": return /^\d{10}$/.test(mobileValue.trim());
      case "email": return /\S+@\S+\.\S+/.test(emailValue.trim());
      case "done": return true;
      default: return false;
    }
  };

  // ── Save profile to backend ──
  const saveProfile = async (final = false) => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: name.trim(),
        dob: parseDobToIso(dob),
        gender,
      };

      if (mobileValue.trim()) payload.mobile = mobileValue.trim();
      if (emailValue.trim()) payload.email = emailValue.trim().toLowerCase();
      if (final) payload.profileCompleted = true;

      const res = await axios.put(
        `${API}/api/users/${user._id}`,
        payload,
        { headers: { Authorization: "Bearer " + token }, timeout: 15000 }
      );

      if (res.data) setUser(res.data);
      if (final) localStorage.setItem("profileCompleted", "1");

      return { ok: true };
    } catch (e) {
      const data = e.response?.data;
      if (e.response?.status === 409 && data?.mergeable) {
        // Return merge info — caller will handle it
        return { ok: false, merge: true, conflictField: data.conflictField, conflictValue: data.conflictValue };
      }
      setError(data?.error || "Something went wrong. Please try again.");
      return { ok: false };
    } finally {
      setSaving(false);
    }
  };

  // ── Merge: Send OTP ──
  const handleMergeSendOtp = async (field, value) => {
    setSaving(true);
    setError("");
    try {
      const res = await axios.post(
        `${API}/api/users/merge/send-otp`,
        { conflictField: field, conflictValue: value },
        { headers: { Authorization: "Bearer " + token }, timeout: 15000 }
      );
      setMergeState({
        field, value,
        masked: res.data.masked || value,
        otp: "",
      });
    } catch (e) {
      setError(e.response?.data?.error || "Failed to send OTP. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Merge: Verify OTP & complete ──
  const handleMergeVerify = async () => {
    if (!mergeState?.otp || mergeState.otp.length < 4) {
      setError("Please enter the OTP.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await axios.post(
        `${API}/api/users/merge/verify`,
        { otp: mergeState.otp },
        { headers: { Authorization: "Bearer " + token }, timeout: 30000 }
      );

      // Merge succeeded — update context
      if (res.data.user) setUser(res.data.user);

      setMergeState(null);
      setError("");

      // Now proceed to next step (the conflicting field is resolved)
      setDirection(1);
      setStepIdx((i) => Math.min(i + 1, TOTAL - 1));
    } catch (e) {
      setError(e.response?.data?.error || "OTP verification failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Merge: Resend OTP ──
  const handleMergeResend = async () => {
    if (!mergeState) return;
    await handleMergeSendOtp(mergeState.field, mergeState.value);
  };

  // ── Handle next step ──
  const handleNext = async () => {
    if (!canProceed() || saving) return;

    // Save name + DOB + gender after "about" step
    if (currentStep === "about") {
      const result = await saveProfile(false);
      if (!result.ok) return;
    }

    // Save mobile — if conflict, start merge flow
    if (currentStep === "mobile") {
      const result = await saveProfile(false);
      if (!result.ok) {
        if (result.merge) {
          // Start merge flow right here
          await handleMergeSendOtp(result.conflictField, result.conflictValue || mobileValue.trim());
          return; // Don't advance — show merge UI
        }
        return;
      }
    }

    // Save email — if conflict, start merge flow
    if (currentStep === "email") {
      const result = await saveProfile(false);
      if (!result.ok) {
        if (result.merge) {
          await handleMergeSendOtp(result.conflictField, result.conflictValue || emailValue.trim().toLowerCase());
          return;
        }
        return;
      }
    }

    setDirection(1);
    setError("");
    setMergeState(null);
    setStepIdx((i) => Math.min(i + 1, TOTAL - 1));
  };

  // Handle back
  const handleBack = () => {
    if (mergeState) {
      setMergeState(null);
      setError("");
      return;
    }
    if (stepIdx === 0) return;
    setDirection(-1);
    setError("");
    setStepIdx((i) => i - 1);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && canProceed()) handleNext();
  };

  // ─── Completion state ───
  const [showConfetti, setShowConfetti] = useState(false);
  const [doneTriggered, setDoneTriggered] = useState(false);

  useEffect(() => {
    if (currentStep === "done" && !doneTriggered) {
      setDoneTriggered(true);
      setShowConfetti(true);

      const timer = setTimeout(async () => {
        const result = await saveProfile(true);
        if (result.ok) {
          setTimeout(() => navigate("/home", { replace: true }), 1200);
        }
      }, 600);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  /* ─── MERGE OTP UI (shown inline when conflict detected) ─── */
  const renderMergeFlow = () => {
    if (!mergeState) return null;

    const fieldLabel = mergeState.field === "email" ? "email" : "mobile number";

    return (
      <motion.div
        key="merge-otp"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400 }}
            style={{
              width: 56, height: 56, borderRadius: 18, margin: "0 auto 16px",
              background: "rgba(251,191,36,0.12)",
              border: "2px solid rgba(251,191,36,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Lock style={{ width: 26, height: 26, color: "#FBBF24" }} />
          </motion.div>

          <h2 style={{
            fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 900,
            color: "#fff", margin: "0 0 8px", letterSpacing: "-0.3px",
          }}>
            Verify your {fieldLabel}
          </h2>
          <p style={{
            fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600,
            margin: 0, lineHeight: 1.5,
          }}>
            This {fieldLabel} is linked to another account.
            <br />We sent a 6-digit OTP to <span style={{ color: ACC, fontWeight: 800 }}>{mergeState.masked}</span>
            <br />Verify to link both accounts.
          </p>
        </div>

        {/* OTP Input */}
        <div style={{ marginBottom: 20 }}>
          <OtpBoxes
            value={mergeState.otp}
            onChange={(val) => setMergeState((s) => ({ ...s, otp: val }))}
            length={6}
          />
        </div>

        {/* Verify button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleMergeVerify}
          disabled={saving || mergeState.otp.length < 4}
          style={{
            width: "100%", height: 54, borderRadius: 16, border: "none",
            background: saving || mergeState.otp.length < 4
              ? "rgba(255,255,255,0.08)"
              : `linear-gradient(135deg, #FBBF24, #F59E0B)`,
            color: saving || mergeState.otp.length < 4 ? "rgba(255,255,255,0.3)" : DARK,
            fontSize: 15, fontWeight: 900,
            fontFamily: "'Sora', sans-serif",
            cursor: saving || mergeState.otp.length < 4 ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: saving || mergeState.otp.length < 4
              ? "none" : "0 8px 28px rgba(251,191,36,0.3)",
            transition: "all 0.25s",
          }}
        >
          {saving ? (
            <Loader2 style={{ width: 20, height: 20, animation: "spin 0.8s linear infinite" }} />
          ) : (
            <>
              <ShieldCheck style={{ width: 18, height: 18 }} />
              Verify & Link Account
            </>
          )}
        </motion.button>

        {/* Resend + info */}
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button
            onClick={handleMergeResend}
            disabled={saving}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: ACC, fontSize: 12, fontWeight: 700,
              textDecoration: "underline", textUnderlineOffset: 3,
            }}
          >
            Resend OTP
          </button>
        </div>

        <div style={{
          marginTop: 14, padding: "10px 14px", borderRadius: 12,
          background: "rgba(0,217,126,0.06)",
          border: "1px solid rgba(0,217,126,0.15)",
        }}>
          <p style={{
            fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 600,
            margin: 0, lineHeight: 1.5, textAlign: "center",
          }}>
            This will merge your previous account data into this one.
            <br />No data will be lost — orders, addresses, everything stays safe.
          </p>
        </div>
      </motion.div>
    );
  };

  /* ─── Step content renderer ─── */
  const renderStep = () => {
    // If merge flow is active, show that instead
    if (mergeState) return renderMergeFlow();

    const variants = {
      enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
      center: { x: 0, opacity: 1 },
      exit: (dir) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
    };

    switch (currentStep) {
      case "name":
        return (
          <motion.div
            key="name"
            custom={direction}
            variants={variants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.3 }}
          >
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 400, delay: 0.1 }}
                style={{
                  width: 56, height: 56, borderRadius: 18, margin: "0 auto 16px",
                  background: `linear-gradient(135deg, ${ACC}20, ${CYAN}10)`,
                  border: `2px solid ${ACC}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <User style={{ width: 26, height: 26, color: ACC }} />
              </motion.div>
              <h2 style={{
                fontFamily: "'Sora', sans-serif", fontSize: 24, fontWeight: 900,
                color: "#fff", margin: "0 0 6px", letterSpacing: "-0.5px",
              }}>
                What should we call you?
              </h2>
              <p style={{
                fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 600,
                margin: 0,
              }}>
                Your real name helps doctors & pharmacies serve you better
              </p>
            </div>

            <WizardInput
              icon={User}
              placeholder="Enter your full name"
              value={name}
              onChange={setName}
              autoFocus
              onKeyDown={handleKeyDown}
              maxLength={50}
            />
          </motion.div>
        );

      case "about":
        return (
          <motion.div
            key="about"
            custom={direction}
            variants={variants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.3 }}
          >
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 400, delay: 0.1 }}
                style={{
                  width: 56, height: 56, borderRadius: 18, margin: "0 auto 16px",
                  background: `linear-gradient(135deg, ${ACC}20, ${CYAN}10)`,
                  border: `2px solid ${ACC}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Heart style={{ width: 26, height: 26, color: ACC }} />
              </motion.div>
              <h2 style={{
                fontFamily: "'Sora', sans-serif", fontSize: 24, fontWeight: 900,
                color: "#fff", margin: "0 0 6px", letterSpacing: "-0.5px",
              }}>
                A little about you
              </h2>
              <p style={{
                fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 600,
                margin: 0,
              }}>
                Helps us personalize your health insights
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{
                  fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase", letterSpacing: "0.8px",
                  marginBottom: 8, display: "block",
                }}>
                  Date of Birth
                </label>
                <WizardInput
                  icon={Calendar}
                  placeholder="DD-MM-YYYY"
                  value={dob}
                  onChange={handleDobChange}
                  inputMode="numeric"
                  maxLength={10}
                  autoFocus
                  onKeyDown={handleKeyDown}
                />
              </div>

              <div>
                <label style={{
                  fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase", letterSpacing: "0.8px",
                  marginBottom: 8, display: "block",
                }}>
                  Gender
                </label>
                <GenderSelector value={gender} onChange={setGender} />
              </div>
            </div>
          </motion.div>
        );

      case "mobile":
        return (
          <motion.div
            key="mobile"
            custom={direction}
            variants={variants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.3 }}
          >
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 400, delay: 0.1 }}
                style={{
                  width: 56, height: 56, borderRadius: 18, margin: "0 auto 16px",
                  background: `linear-gradient(135deg, ${ACC}20, ${CYAN}10)`,
                  border: `2px solid ${ACC}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Phone style={{ width: 26, height: 26, color: ACC }} />
              </motion.div>
              <h2 style={{
                fontFamily: "'Sora', sans-serif", fontSize: 24, fontWeight: 900,
                color: "#fff", margin: "0 0 6px", letterSpacing: "-0.5px",
              }}>
                Your mobile number
              </h2>
              <p style={{
                fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 600,
                margin: 0,
              }}>
                Required for delivery updates, prescriptions & OTP verification
              </p>
            </div>

            <WizardInput
              icon={Phone}
              placeholder="10-digit mobile number"
              value={mobileValue}
              onChange={(v) => setMobileValue(v.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
              maxLength={10}
              autoFocus
              onKeyDown={handleKeyDown}
            />

            {/* No skip for mobile — it's mandatory */}
          </motion.div>
        );

      case "email":
        return (
          <motion.div
            key="email"
            custom={direction}
            variants={variants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.3 }}
          >
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 400, delay: 0.1 }}
                style={{
                  width: 56, height: 56, borderRadius: 18, margin: "0 auto 16px",
                  background: `linear-gradient(135deg, ${ACC}20, ${CYAN}10)`,
                  border: `2px solid ${ACC}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Mail style={{ width: 26, height: 26, color: ACC }} />
              </motion.div>
              <h2 style={{
                fontFamily: "'Sora', sans-serif", fontSize: 24, fontWeight: 900,
                color: "#fff", margin: "0 0 6px", letterSpacing: "-0.5px",
              }}>
                Your email address
              </h2>
              <p style={{
                fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 600,
                margin: 0,
              }}>
                Required for reports, prescriptions & invoices
              </p>
            </div>

            <WizardInput
              icon={Mail}
              placeholder="your.email@example.com"
              value={emailValue}
              onChange={setEmailValue}
              type="email"
              autoFocus
              onKeyDown={handleKeyDown}
            />

            {/* No skip — email is mandatory */}
          </motion.div>
        );

      case "done":
        return (
          <motion.div
            key="done"
            custom={direction}
            variants={variants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.3 }}
            style={{ textAlign: "center", position: "relative" }}
          >
            {showConfetti && <ConfettiBurst />}

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
              style={{
                width: 80, height: 80, borderRadius: 24, margin: "0 auto 20px",
                background: `linear-gradient(135deg, ${ACC}, ${CYAN})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 50px ${ACC}40, 0 0 100px ${ACC}15`,
              }}
            >
              <Sparkles style={{ width: 36, height: 36, color: DARK }} />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              style={{
                fontFamily: "'Sora', sans-serif", fontSize: 26, fontWeight: 900,
                color: "#fff", margin: "0 0 8px", letterSpacing: "-0.5px",
              }}
            >
              You're all set, {name.split(" ")[0]}!
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              style={{
                fontSize: 14, color: "rgba(255,255,255,0.5)", fontWeight: 600,
                margin: "0 0 24px", lineHeight: 1.6,
              }}
            >
              Your personalized health journey begins now.
              <br />Let's explore GoDavaii!
            </motion.p>

            {/* Profile summary card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 20, padding: "16px 20px",
                textAlign: "left",
              }}
            >
              {[
                { label: "Name", value: name },
                { label: "DOB", value: dob },
                { label: "Gender", value: gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : "—" },
                { label: "Mobile", value: mobileValue || user?.mobile || "—" },
                ...(emailValue ? [{ label: "Email", value: emailValue }] : []),
              ].map((item, i, arr) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: 13, color: "#fff", fontWeight: 800, textAlign: "right", maxWidth: "65%", wordBreak: "break-all" }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  const isLast = currentStep === "done";
  const active = canProceed();

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: `linear-gradient(165deg, ${DARK} 0%, #051A10 25%, ${DEEP} 55%, ${MID} 100%)`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      overflow: "hidden",
    }}>
      <BgOrbs />

      <div style={{
        position: "absolute", inset: 0, opacity: 0.03,
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        pointerEvents: "none",
      }} />

      <div style={{
        position: "relative", zIndex: 2, width: "100%", maxWidth: 420,
        padding: "0 24px", display: "flex", flexDirection: "column", alignItems: "center",
      }}>

        {/* Header: Logo + Progress */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ width: "100%", marginBottom: 20 }}
        >
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <h1 style={{
              fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 900,
              color: "#fff", letterSpacing: "-0.5px", margin: 0,
            }}>
              Go<span style={{ color: ACC }}>Davaii</span>
            </h1>
          </div>

          <ProgressBar current={stepIdx + 1} total={TOTAL} />
          <div style={{
            display: "flex", justifyContent: "space-between",
            marginTop: 8, marginBottom: 4,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>
              Step {stepIdx + 1} of {TOTAL}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: ACC }}>
              {Math.round(((stepIdx + 1) / TOTAL) * 100)}%
            </span>
          </div>

          <StepDots current={stepIdx} total={TOTAL} />
        </motion.div>

        {/* Glass card */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 28, padding: "28px 24px 24px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
            minHeight: 280,
            position: "relative",
          }}
        >
          {/* Back button */}
          {(stepIdx > 0 || mergeState) && currentStep !== "done" && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={handleBack}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 700,
                marginBottom: 12, padding: 0,
              }}
            >
              <ArrowLeft style={{ width: 14, height: 14 }} />
              {mergeState ? "Cancel verification" : "Back"}
            </motion.button>
          )}

          {/* Step content */}
          <AnimatePresence mode="wait" custom={direction}>
            {renderStep()}
          </AnimatePresence>

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  marginTop: 12, padding: "10px 14px",
                  borderRadius: 12,
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#FCA5A5", fontSize: 12, fontWeight: 700,
                  lineHeight: 1.5,
                }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* CTA Button — only when NOT in merge flow and NOT done */}
          {!isLast && !mergeState && (
            <motion.button
              whileTap={{ scale: active ? 0.97 : 1 }}
              onClick={handleNext}
              disabled={!active || saving}
              style={{
                width: "100%", height: 54, borderRadius: 16, border: "none",
                marginTop: 24,
                background: !active || saving
                  ? "rgba(255,255,255,0.08)"
                  : `linear-gradient(135deg, ${ACC}, ${CYAN})`,
                color: !active || saving ? "rgba(255,255,255,0.3)" : DARK,
                fontSize: 16, fontWeight: 900,
                fontFamily: "'Sora', sans-serif",
                cursor: !active || saving ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: !active || saving
                  ? "none"
                  : `0 8px 28px ${ACC}40`,
                transition: "all 0.25s",
              }}
            >
              {saving ? (
                <Loader2 style={{ width: 20, height: 20, animation: "spin 0.8s linear infinite" }} />
              ) : (
                <>
                  Continue
                  <ChevronRight style={{ width: 18, height: 18 }} />
                </>
              )}
            </motion.button>
          )}
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{
            marginTop: 24, display: "flex", alignItems: "center",
            justifyContent: "center", gap: 16,
          }}
        >
          {["Your data is safe", "HIPAA Ready", "256-bit SSL"].map((t, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.25)",
            }}>
              <Check style={{ width: 10, height: 10, color: `${ACC}60` }} />
              {t}
            </div>
          ))}
        </motion.div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes orbDrift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(15px, -20px) scale(1.08); }
          66% { transform: translate(-10px, 15px) scale(0.94); }
        }
      `}</style>
    </div>
  );
}
