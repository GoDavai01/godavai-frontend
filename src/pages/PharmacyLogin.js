// src/pages/PharmacyLogin.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, TextField, Button, Snackbar, Alert } from "@mui/material";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export default function PharmacyLogin() {
  const [step, setStep] = useState(1); // 1: enter contact & PIN, 2: enter OTP
  const [contact, setContact] = useState("");
  const [pin, setPin] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  const handleSendOTP = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/pharmacy/send-otp`, { contact, pin });
      setStep(2);
      setMsg(contact.includes("@") ? "OTP sent to your registered email." : "OTP sent to your registered mobile.");
    } catch (err) {
      setMsg(
        err.response?.data?.message ||
        "Failed to send OTP. Please try again."
      );
    }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/pharmacy/verify-otp`, { contact, otp });
      localStorage.setItem("pharmacyToken", res.data.token);
      setMsg("Login success!");
      setTimeout(() => navigate("/pharmacy/dashboard"), 800);
    } catch (err) {
      setMsg(
        err.response?.data?.message ||
        "Failed to verify OTP. Please try again."
      );
    }
    setLoading(false);
  };

  // Input validation helpers
  const isMobile = contact && /^\d{10}$/.test(contact);
  const isEmail = contact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);

  return (
    <Box sx={{ mt: 10, maxWidth: 380, mx: "auto" }}>
      <Typography variant="h5" mb={2}>Pharmacy Login</Typography>
      {step === 1 && (
        <>
          <TextField
            label="Mobile number or Email"
            fullWidth
            sx={{ mb: 2 }}
            value={contact}
            onChange={e => setContact(e.target.value.trim())}
            required
            autoFocus
          />
          <TextField
            label="4-digit PIN"
            fullWidth
            sx={{ mb: 2 }}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputProps={{ maxLength: 4, type: "password", inputMode: "numeric" }}
            required
          />
          <Button
            variant="contained"
            fullWidth
            onClick={handleSendOTP}
            disabled={loading || (!isMobile && !isEmail) || pin.length !== 4}
          >
            {loading ? "Sending OTP..." : "Send OTP"}
          </Button>
        </>
      )}
      {step === 2 && (
        <>
          <TextField
            label="Enter OTP"
            fullWidth
            sx={{ mb: 2 }}
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputProps={{ maxLength: 6, inputMode: "numeric" }}
            required
          />
          <Button
            variant="contained"
            fullWidth
            onClick={handleVerifyOTP}
            disabled={loading || otp.length !== 6}
          >
            {loading ? "Verifying..." : "Verify OTP & Login"}
          </Button>
          <Button
            fullWidth
            sx={{ mt: 1 }}
            onClick={() => { setStep(1); setOtp(""); }}
            disabled={loading}
          >
            Change Mobile/Email or PIN
          </Button>
        </>
      )}
      <Snackbar open={!!msg} autoHideDuration={2500} onClose={() => setMsg("")}>
        <Alert onClose={() => setMsg("")} severity={msg.toLowerCase().includes("fail") || msg.toLowerCase().includes("invalid") ? "error" : "success"}>
          {msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
