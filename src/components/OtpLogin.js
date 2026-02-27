// src/components/OtpLogin.js — GoDavaii 2030 Ultra-Futuristic Auth UI
// Logic 100% unchanged — only UI upgraded
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { jwtDecode } from "jwt-decode";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP  = "#0C5A3E";
const MID   = "#0E7A4F";
const ACCENT = "#00D97E";

export default function OtpLogin({ onLogin }) {
  const [step, setStep]           = useState(1);
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp]             = useState(["", "", "", "", "", ""]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef(null);
  const otpRefs  = useRef([]);

  const { login } = useAuth();

  useEffect(() => {
    if (step === 2) {
      setResendTimer(30);
      timerRef.current = setInterval(() => {
        setResendTimer((t) => { if (t <= 1) { clearInterval(timerRef.current); return 0; } return t - 1; });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [step]);

  const showError = (msg) => { setError(msg); setTimeout(() => setError(""), 3500); };
  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(""), 2500); };

  const handleSendOtp = async () => {
    if (!identifier) { showError("Enter mobile number or email."); return; }
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/auth/send-otp`, { identifier });
      setStep(2);
      showSuccess("OTP sent!");
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.raw?.message || "Error sending OTP.";
      showError(msg);
    }
    setLoading(false);
  };

  const handleOtpChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKeyDown = (i, e) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
    if (e.key === "Enter" && otp.join("").length === 6) handleVerify();
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) { setOtp(pasted.split("")); otpRefs.current[5]?.focus(); }
    e.preventDefault();
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < 6) { showError("Enter all 6 digits."); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/verify-otp`, { identifier, otp: code });
      const token = res.data?.token;
      if (!token) { showError("Invalid OTP. Please try again."); setLoading(false); return; }
      const decoded = jwtDecode(token);
      login(decoded, token);
      onLogin?.();
    } catch (err) {
      const msg = err.response?.data?.error || "Invalid OTP. Please try again.";
      showError(msg);
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", width: "100%", maxWidth: 480,
      margin: "0 auto", position: "relative",
      background: `linear-gradient(160deg, #041F15 0%, ${DEEP} 40%, #0A4631 100%)`,
      display: "flex", flexDirection: "column", alignItems: "stretch",
      fontFamily: "'Plus Jakarta Sans', sans-serif", overflow: "hidden",
    }}>
      {/* Ambient orbs */}
      <div style={{
        position: "absolute", right: -80, top: -80, width: 300, height: 300,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,217,126,0.12) 0%, rgba(0,229,255,0.05) 40%, transparent 70%)",
        animation: "orbFloat 8s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", left: -60, bottom: -60, width: 250, height: 250,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)",
        animation: "orbFloat 10s ease-in-out infinite reverse",
      }} />
      <div style={{
        position: "absolute", right: 40, bottom: "30%", width: 100, height: 100,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,229,255,0.06) 0%, transparent 70%)",
        animation: "orbFloat 12s ease-in-out infinite",
      }} />

      {/* Noise texture */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        opacity: 0.02, pointerEvents: "none",
      }} />

      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px 20px", position: "relative", zIndex: 1,
      }}>
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ textAlign: "center", marginBottom: 40 }}
        >
          <div style={{
            width: 76, height: 76, borderRadius: 24,
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            border: "1.5px solid rgba(0,217,126,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 38, margin: "0 auto 16px",
            boxShadow: "0 0 32px rgba(0,217,126,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}>
            💊
          </div>
          <div style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px",
            background: `linear-gradient(135deg, #fff, ${ACCENT})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            GoDavaii
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 6, letterSpacing: "0.3px" }}>
            Medicines delivered in 30 minutes
          </div>
        </motion.div>

        {/* Card — Glass morphism */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
            borderRadius: 30, padding: "32px 24px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.20), 0 0 0 1px rgba(0,217,126,0.04)",
            border: "1px solid rgba(255,255,255,0.3)",
            position: "relative", overflow: "hidden",
          }}
        >
          {/* Subtle gradient overlay */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "inherit",
            background: "linear-gradient(135deg, rgba(0,217,126,0.03), transparent 60%)",
            pointerEvents: "none",
          }} />

          {step === 1 ? (
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ marginBottom: 26 }}>
                <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: "#0B1F16", marginBottom: 6, letterSpacing: "-0.3px" }}>
                  Welcome!
                </div>
                <div style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.5 }}>
                  Enter your mobile number or email to continue
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: DEEP, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  Mobile or Email
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                  placeholder="+91 9999999999 or email@example.com"
                  autoFocus
                  style={{
                    width: "100%", height: 54, borderRadius: 16,
                    border: `1.5px solid rgba(12,90,62,0.12)`,
                    padding: "0 16px", fontSize: 15,
                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                    outline: "none", boxSizing: "border-box",
                    background: "rgba(248,251,250,0.8)", color: "#0B1F16",
                    transition: "all 0.2s",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = ACCENT;
                    e.target.style.boxShadow = `0 0 0 3px rgba(0,217,126,0.15)`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "rgba(12,90,62,0.12)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSendOtp}
                disabled={loading}
                style={{
                  width: "100%", height: 54, borderRadius: 16, border: "none",
                  background: loading ? "#94A3B8" : `linear-gradient(135deg, ${DEEP}, ${MID})`,
                  color: "#fff", fontSize: 15, fontWeight: 700,
                  fontFamily: "'Sora',sans-serif", cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: loading ? "none" : "0 8px 24px rgba(12,90,62,0.30), 0 0 12px rgba(0,217,126,0.10)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  position: "relative", overflow: "hidden",
                }}
              >
                <div style={{
                  position: "absolute", inset: 0, borderRadius: "inherit",
                  background: "linear-gradient(135deg, rgba(255,255,255,0.12), transparent 60%)",
                  pointerEvents: "none",
                }} />
                <span style={{ position: "relative", zIndex: 1 }}>{loading ? <Spinner /> : "Get OTP"}</span>
              </motion.button>
            </div>
          ) : (
            <div style={{ position: "relative", zIndex: 1 }}>
              <button
                onClick={() => { setStep(1); setOtp(["","","","","",""]); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: DEEP, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 4, padding: 0 }}
              >
                ← Back
              </button>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: "#0B1F16", marginBottom: 4, letterSpacing: "-0.3px" }}>
                Enter OTP
              </div>
              <div style={{ fontSize: 14, color: "#94A3B8", marginBottom: 28, lineHeight: 1.5 }}>
                Sent to <strong style={{ color: DEEP }}>{identifier}</strong>
              </div>

              {/* 6-box OTP — Glass */}
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 26 }}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={i === 0 ? handleOtpPaste : undefined}
                    style={{
                      width: 46, height: 56, textAlign: "center",
                      fontSize: 22, fontWeight: 800, fontFamily: "'Sora',sans-serif",
                      border: `2px solid ${digit ? ACCENT : "rgba(12,90,62,0.12)"}`,
                      borderRadius: 14, outline: "none",
                      background: digit ? "rgba(0,217,126,0.06)" : "rgba(248,251,250,0.8)",
                      color: DEEP, transition: "all 0.2s",
                      boxSizing: "border-box",
                      boxShadow: digit ? "0 0 12px rgba(0,217,126,0.10)" : "none",
                    }}
                  />
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleVerify}
                disabled={loading || otp.join("").length < 6}
                style={{
                  width: "100%", height: 54, borderRadius: 16, border: "none",
                  background: (loading || otp.join("").length < 6)
                    ? "#E2E8F0"
                    : `linear-gradient(135deg, ${DEEP}, ${MID})`,
                  color: (loading || otp.join("").length < 6) ? "#94A3B8" : "#fff",
                  fontSize: 15, fontWeight: 700, fontFamily: "'Sora',sans-serif",
                  cursor: (loading || otp.join("").length < 6) ? "not-allowed" : "pointer",
                  boxShadow: otp.join("").length === 6 && !loading
                    ? "0 8px 24px rgba(12,90,62,0.30), 0 0 12px rgba(0,217,126,0.10)"
                    : "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  marginBottom: 16,
                  position: "relative", overflow: "hidden",
                }}
              >
                <div style={{
                  position: "absolute", inset: 0, borderRadius: "inherit",
                  background: "linear-gradient(135deg, rgba(255,255,255,0.12), transparent 60%)",
                  pointerEvents: "none",
                }} />
                <span style={{ position: "relative", zIndex: 1 }}>{loading ? <Spinner /> : "Verify & Login"}</span>
              </motion.button>

              <div style={{ textAlign: "center" }}>
                {resendTimer > 0 ? (
                  <span style={{ fontSize: 13, color: "#94A3B8" }}>Resend in {resendTimer}s</span>
                ) : (
                  <button onClick={handleSendOtp} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: ACCENT }}>
                    Resend OTP
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Toast — Glass */}
      <AnimatePresence>
        {(error || success) && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            style={{
              position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
              background: error
                ? "rgba(239,68,68,0.92)"
                : "rgba(0,217,126,0.92)",
              backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
              color: "#fff", borderRadius: 100,
              padding: "12px 24px", fontSize: 14, fontWeight: 600,
              boxShadow: error
                ? "0 8px 24px rgba(239,68,68,0.35)"
                : "0 8px 24px rgba(0,217,126,0.35), 0 0 12px rgba(0,217,126,0.15)",
              zIndex: 9999, whiteSpace: "nowrap",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            {error || success}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(10px, -15px) scale(1.05); }
          66%      { transform: translate(-8px, 10px) scale(0.95); }
        }
      `}</style>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
  );
}
