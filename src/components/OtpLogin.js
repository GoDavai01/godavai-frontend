// src/components/OtpLogin.js — GoDavaii 2030 Modern UI
// Logic 100% unchanged — only UI upgraded
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { jwtDecode } from "jwt-decode";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP  = "#0C5A3E";
const MID   = "#0E7A4F";

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
      background: "#F2F7F4",
      display: "flex", flexDirection: "column", alignItems: "stretch",
      fontFamily: "'Plus Jakarta Sans', sans-serif", overflow: "hidden",
    }}>
      {/* Green top half */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "45%",
        background: `linear-gradient(160deg, ${DEEP} 0%, #0A4631 100%)`,
        borderBottomLeftRadius: 40, borderBottomRightRadius: 40,
      }}>
        <div style={{
          position: "absolute", right: -40, top: -40, width: 200, height: 200,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,217,126,0.12) 0%, transparent 70%)",
        }} />
      </div>

      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px 20px", position: "relative", zIndex: 1,
      }}>
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: "center", marginBottom: 36 }}
        >
          <div style={{
            width: 70, height: 70, borderRadius: 22,
            background: "rgba(255,255,255,0.18)",
            border: "2px solid rgba(255,255,255,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 34, margin: "0 auto 14px",
            backdropFilter: "blur(10px)",
          }}>
            💊
          </div>
          <div style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px",
          }}>
            GoDavaii
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>
            Medicines delivered in 30 minutes
          </div>
        </motion.div>

        {/* Card */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          style={{
            width: "100%", background: "#fff",
            borderRadius: 28, padding: "30px 24px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          }}
        >
          {step === 1 ? (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 800, color: "#0B1F16", marginBottom: 5 }}>
                  Welcome! 👋
                </div>
                <div style={{ fontSize: 13, color: "#94A3B8" }}>
                  Enter your mobile number or email to continue
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: DEEP, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.5px" }}>
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
                    width: "100%", height: 52, borderRadius: 14,
                    border: `1.5px solid rgba(12,90,62,0.2)`,
                    padding: "0 16px", fontSize: 15,
                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                    outline: "none", boxSizing: "border-box",
                    background: "#F8FBFA", color: "#0B1F16",
                  }}
                  onFocus={(e) => e.target.style.borderColor = DEEP}
                  onBlur={(e) => e.target.style.borderColor = "rgba(12,90,62,0.2)"}
                />
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSendOtp}
                disabled={loading}
                style={{
                  width: "100%", height: 52, borderRadius: 15, border: "none",
                  background: loading ? "#94A3B8" : `linear-gradient(135deg, ${DEEP}, ${MID})`,
                  color: "#fff", fontSize: 15, fontWeight: 700,
                  fontFamily: "'Sora',sans-serif", cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: loading ? "none" : "0 6px 20px rgba(12,90,62,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {loading ? <Spinner /> : "Get OTP →"}
              </motion.button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setStep(1); setOtp(["","","","","",""]); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: DEEP, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 4, padding: 0 }}
              >
                ← Back
              </button>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 800, color: "#0B1F16", marginBottom: 4 }}>
                Enter OTP 🔐
              </div>
              <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 26, lineHeight: 1.5 }}>
                Sent to <strong style={{ color: DEEP }}>{identifier}</strong>
              </div>

              {/* 6-box OTP */}
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
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
                      width: 44, height: 54, textAlign: "center",
                      fontSize: 22, fontWeight: 800, fontFamily: "'Sora',sans-serif",
                      border: `2px solid ${digit ? DEEP : "rgba(12,90,62,0.2)"}`,
                      borderRadius: 13, outline: "none",
                      background: digit ? "#E8F5EF" : "#F8FBFA",
                      color: DEEP, transition: "all 0.15s",
                      boxSizing: "border-box",
                    }}
                  />
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleVerify}
                disabled={loading || otp.join("").length < 6}
                style={{
                  width: "100%", height: 52, borderRadius: 15, border: "none",
                  background: (loading || otp.join("").length < 6) ? "#E2E8F0" : `linear-gradient(135deg, ${DEEP}, ${MID})`,
                  color: (loading || otp.join("").length < 6) ? "#94A3B8" : "#fff",
                  fontSize: 15, fontWeight: 700, fontFamily: "'Sora',sans-serif",
                  cursor: (loading || otp.join("").length < 6) ? "not-allowed" : "pointer",
                  boxShadow: otp.join("").length === 6 && !loading ? "0 6px 20px rgba(12,90,62,0.35)" : "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  marginBottom: 14,
                }}
              >
                {loading ? <Spinner /> : "Verify & Login ✓"}
              </motion.button>

              <div style={{ textAlign: "center" }}>
                {resendTimer > 0 ? (
                  <span style={{ fontSize: 13, color: "#94A3B8" }}>Resend in {resendTimer}s</span>
                ) : (
                  <button onClick={handleSendOtp} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: DEEP }}>
                    Resend OTP
                  </button>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {(error || success) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
              background: error ? "#EF4444" : "#059669",
              color: "#fff", borderRadius: 100,
              padding: "12px 22px", fontSize: 14, fontWeight: 600,
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)", zIndex: 9999, whiteSpace: "nowrap",
            }}
          >
            {error || success}
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
  );
}