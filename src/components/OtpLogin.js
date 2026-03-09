// src/components/OtpLogin.js — GoDavaii 2035 HealthOS
// ✅ ALL AUTH LOGIC 100% PRESERVED
// ✅ Ultra-modern full-screen login — first impression killer
// ✅ Bold "GoDavaii" wordmark — no pill icon, no "2035 Health OS" text
// ✅ Glassmorphism card, individual OTP digit boxes, animated orbs
// ✅ Framer Motion transitions between steps

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, ChevronRight, ShieldCheck, Fingerprint } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { jwtDecode } from "jwt-decode";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const DEEP = "#0C5A3E";
const MID = "#0E7A4F";
const ACC = "#00D97E";
const DARK = "#020C07";

/* ─── Individual OTP digit input ─── */
function OtpBoxes({ value, onChange, length = 6 }) {
  const refs = useRef([]);
  const digits = value.padEnd(length, " ").split("").slice(0, length);

  const handleKey = (e, idx) => {
    const key = e.key;
    if (key === "Backspace") {
      e.preventDefault();
      const arr = value.split("");
      if (arr[idx]) {
        arr[idx] = "";
        onChange(arr.join(""));
      } else if (idx > 0) {
        arr[idx - 1] = "";
        onChange(arr.join(""));
        refs.current[idx - 1]?.focus();
      }
      return;
    }
    if (key === "ArrowLeft" && idx > 0) refs.current[idx - 1]?.focus();
    if (key === "ArrowRight" && idx < length - 1) refs.current[idx + 1]?.focus();
  };

  const handleInput = (e, idx) => {
    const val = e.target.value.replace(/\D/g, "");
    if (!val) return;
    const arr = value.split("");
    // Handle paste
    if (val.length > 1) {
      const pasted = val.slice(0, length);
      onChange(pasted);
      const nextIdx = Math.min(pasted.length, length - 1);
      refs.current[nextIdx]?.focus();
      return;
    }
    arr[idx] = val[0];
    const newVal = arr.join("").replace(/ /g, "");
    onChange(newVal);
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
            width: 46, height: 56, borderRadius: 14,
            border: d !== " "
              ? `2px solid ${ACC}`
              : "2px solid rgba(255,255,255,0.15)",
            background: d !== " "
              ? "rgba(0,217,126,0.08)"
              : "rgba(255,255,255,0.06)",
            color: "#fff",
            fontSize: 22, fontWeight: 900,
            fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif",
            textAlign: "center",
            outline: "none",
            caretColor: ACC,
            transition: "border 0.2s, background 0.2s",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Animated background orbs ─── */
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

export default function OtpLogin({ onLogin }) {
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: "", severity: "info" });
  const inputRef = useRef(null);

  const { login } = useAuth();

  // Auto-focus input on step change
  useEffect(() => {
    if (step === 1) setTimeout(() => inputRef.current?.focus(), 300);
  }, [step]);

  // Auto-dismiss snackbar
  useEffect(() => {
    if (!snack.open) return;
    const t = setTimeout(() => setSnack((s) => ({ ...s, open: false })), 3500);
    return () => clearTimeout(t);
  }, [snack.open]);

  const handleSendOtp = async () => {
    if (!identifier) {
      setSnack({ open: true, msg: "Enter mobile or email.", severity: "warning" });
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/auth/send-otp`, { identifier });
      setStep(2);
      setSnack({ open: true, msg: "OTP sent!", severity: "success" });
    } catch (err) {
      console.error("SEND OTP ERROR >>>", err.response?.data || err.message);
      const msg =
        err.response?.data?.error ||
        err.response?.data?.raw?.message ||
        err.response?.data?.raw?.description ||
        "Error sending OTP.";
      setSnack({ open: true, msg, severity: "error" });
    }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (!otp) {
      setSnack({ open: true, msg: "Enter OTP.", severity: "warning" });
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/verify-otp`, {
        identifier,
        otp,
      });
      setSnack({ open: true, msg: "Login Successful!", severity: "success" });

      const token = res.data.token;
      const decoded = jwtDecode(token);
      const userObj = {
        _id: decoded.userId,
        mobile: decoded.mobile,
        email: decoded.email,
        name: decoded.name,
        profileCompleted: decoded.profileCompleted,
        dob: decoded.dob,
      };
      login(userObj, token);
      if (onLogin) onLogin(userObj);

      const { data: profile } = await axios.get(
        `${API_BASE_URL}/api/profile`,
        { headers: { Authorization: "Bearer " + token } }
      );

      const needsProfile =
        profile?.profileCompleted === false ||
        !profile?.name ||
        !profile?.email ||
        !profile?.dob;

      window.location.href = needsProfile ? "/profile?setup=1" : "/";
    } catch (err) {
      setSnack({
        open: true,
        msg: err.response?.data?.error || "OTP verification failed.",
        severity: "error",
      });
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (step === 1) handleSendOtp();
      else handleVerifyOtp();
    }
  };

  const maskedId = identifier.includes("@")
    ? identifier.replace(/(.{2})(.*)(@.*)/, "$1***$3")
    : identifier.replace(/(\d{2})\d+(\d{2})/, "$1******$2");

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: `linear-gradient(165deg, ${DARK} 0%, #051A10 25%, ${DEEP} 55%, ${MID} 100%)`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      overflow: "hidden",
    }}>
      <BgOrbs />

      {/* Subtle grid pattern overlay */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.03,
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        pointerEvents: "none",
      }} />

      {/* Content container */}
      <div style={{
        position: "relative", zIndex: 2, width: "100%", maxWidth: 420,
        padding: "0 24px", display: "flex", flexDirection: "column", alignItems: "center",
      }}>

        {/* GoDavaii wordmark */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ marginBottom: 8, textAlign: "center" }}
        >
          {/* Glow behind wordmark */}
          <div style={{
            width: 64, height: 64, borderRadius: 20, margin: "0 auto 16px",
            background: `linear-gradient(135deg, ${ACC}, #00E5FF)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 40px ${ACC}50, 0 0 80px ${ACC}20`,
          }}>
            <span style={{
              fontFamily: "'Sora', sans-serif", fontSize: 28, fontWeight: 900,
              color: DARK, letterSpacing: "-1px",
            }}>G</span>
          </div>

          <h1 style={{
            fontFamily: "'Sora', sans-serif", fontSize: 32, fontWeight: 900,
            color: "#fff", letterSpacing: "-1px", lineHeight: 1, margin: 0,
          }}>
            Go<span style={{ color: ACC }}>Davaii</span>
          </h1>
          <p style={{
            fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)",
            marginTop: 6, letterSpacing: "0.5px",
          }}>
            Your health, simplified
          </p>
        </motion.div>

        {/* Glass card */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
          style={{
            width: "100%", marginTop: 24,
            background: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 28, padding: "28px 24px 24px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                <h2 style={{
                  fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 900,
                  color: "#fff", margin: "0 0 6px", letterSpacing: "-0.3px",
                }}>
                  Welcome!
                </h2>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600, margin: "0 0 22px" }}>
                  Enter your mobile number or email to continue
                </p>

                {/* Input */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{
                    fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.45)",
                    textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8,
                    display: "block",
                  }}>
                    Mobile or Email
                  </label>
                  <div style={{
                    display: "flex", alignItems: "center", height: 54, borderRadius: 16,
                    background: "rgba(255,255,255,0.06)",
                    border: "1.5px solid rgba(255,255,255,0.12)",
                    padding: "0 14px", gap: 10,
                    transition: "border 0.2s",
                  }}>
                    <Fingerprint style={{ width: 18, height: 18, color: ACC, flexShrink: 0 }} />
                    <input
                      ref={inputRef}
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="+91 9999999999 or email@example.com"
                      maxLength={50}
                      autoFocus
                      style={{
                        flex: 1, background: "none", border: "none", outline: "none",
                        color: "#fff", fontSize: 15, fontWeight: 700,
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}
                    />
                  </div>
                </div>

                {/* CTA */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSendOtp}
                  disabled={loading || !identifier.trim()}
                  style={{
                    width: "100%", height: 54, borderRadius: 16, border: "none",
                    background: loading || !identifier.trim()
                      ? "rgba(255,255,255,0.08)"
                      : `linear-gradient(135deg, ${ACC}, #00E5FF)`,
                    color: loading || !identifier.trim() ? "rgba(255,255,255,0.3)" : DARK,
                    fontSize: 16, fontWeight: 900,
                    fontFamily: "'Sora', sans-serif",
                    cursor: loading || !identifier.trim() ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    boxShadow: loading || !identifier.trim()
                      ? "none"
                      : `0 8px 28px ${ACC}40`,
                    transition: "all 0.25s",
                  }}
                >
                  {loading ? (
                    <Loader2 style={{ width: 20, height: 20, animation: "spin 0.8s linear infinite" }} />
                  ) : (
                    <>Get OTP <ChevronRight style={{ width: 18, height: 18 }} /></>
                  )}
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                {/* Back */}
                <button
                  onClick={() => { setStep(1); setOtp(""); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700,
                    marginBottom: 14, padding: 0,
                  }}
                >
                  <ArrowLeft style={{ width: 14, height: 14 }} />
                  Change number/email
                </button>

                <h2 style={{
                  fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 900,
                  color: "#fff", margin: "0 0 6px", letterSpacing: "-0.3px",
                }}>
                  Verify OTP
                </h2>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600, margin: "0 0 24px" }}>
                  Sent to <span style={{ color: ACC, fontWeight: 800 }}>{maskedId}</span>
                </p>

                {/* OTP boxes */}
                <div style={{ marginBottom: 24 }}>
                  <OtpBoxes value={otp} onChange={setOtp} length={6} />
                </div>

                {/* Verify CTA */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleVerifyOtp}
                  disabled={loading || otp.length < 4}
                  style={{
                    width: "100%", height: 54, borderRadius: 16, border: "none",
                    background: loading || otp.length < 4
                      ? "rgba(255,255,255,0.08)"
                      : `linear-gradient(135deg, ${ACC}, #00E5FF)`,
                    color: loading || otp.length < 4 ? "rgba(255,255,255,0.3)" : DARK,
                    fontSize: 16, fontWeight: 900,
                    fontFamily: "'Sora', sans-serif",
                    cursor: loading || otp.length < 4 ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    boxShadow: loading || otp.length < 4
                      ? "none"
                      : `0 8px 28px ${ACC}40`,
                    transition: "all 0.25s",
                  }}
                >
                  {loading ? (
                    <Loader2 style={{ width: 20, height: 20, animation: "spin 0.8s linear infinite" }} />
                  ) : (
                    <>
                      <ShieldCheck style={{ width: 18, height: 18 }} />
                      Verify & Login
                    </>
                  )}
                </motion.button>

                {/* Resend */}
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <button
                    onClick={handleSendOtp}
                    disabled={loading}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: ACC, fontSize: 13, fontWeight: 700,
                      textDecoration: "underline", textUnderlineOffset: 3,
                    }}
                  >
                    Resend OTP
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{
            marginTop: 28, display: "flex", alignItems: "center",
            justifyContent: "center", gap: 16,
          }}
        >
          {["Secure Login", "HIPAA Ready", "256-bit SSL"].map((t, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)",
              letterSpacing: "0.3px",
            }}>
              <ShieldCheck style={{ width: 10, height: 10, color: "rgba(0,217,126,0.4)" }} />
              {t}
            </div>
          ))}
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{
            marginTop: 20, fontSize: 10.5, color: "rgba(255,255,255,0.2)",
            textAlign: "center", fontWeight: 600, lineHeight: 1.6,
          }}
        >
          By continuing, you agree to our Terms of Service & Privacy Policy
        </motion.p>
      </div>

      {/* Snackbar */}
      <AnimatePresence>
        {snack.open && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{
              position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
              zIndex: 10000, borderRadius: 100, padding: "10px 20px",
              background: snack.severity === "error" ? "#DC2626"
                : snack.severity === "warning" ? "#D97706"
                : snack.severity === "success" ? DEEP
                : "#334155",
              color: "#fff", fontSize: 13, fontWeight: 800,
              fontFamily: "'Sora', sans-serif",
              boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
              display: "flex", alignItems: "center", gap: 6,
              maxWidth: "90vw",
            }}
          >
            {snack.severity === "success" && <ShieldCheck style={{ width: 14, height: 14 }} />}
            {snack.msg}
          </motion.div>
        )}
      </AnimatePresence>

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