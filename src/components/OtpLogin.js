// src/components/OtpLogin.js
import React, { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Snackbar,
  Alert,
} from "@mui/material";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { jwtDecode } from "jwt-decode";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export default function OtpLogin({ onLogin }) {
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({
    open: false,
    msg: "",
    severity: "info",
  });

  const { login } = useAuth();

  const handleSendOtp = async () => {
    if (!identifier) {
      setSnack({
        open: true,
        msg: "Enter mobile or email.",
        severity: "warning",
      });
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
      setSnack({
        open: true,
        msg,
        severity: "error",
      });
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
        {
          headers: { Authorization: "Bearer " + token },
        }
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

  return (
    <Box
      sx={{
        maxWidth: 360,
        mx: "auto",
        mt: 6,
        p: 3,
        boxShadow: 2,
        borderRadius: 3,
        bgcolor: "#fff",
        minHeight: 360,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Typography variant="h5" textAlign="center" fontWeight={600}>
        Login / Register
      </Typography>
      {step === 1 ? (
        <>
          <TextField
            label="Mobile number or Email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            fullWidth
            autoFocus
            inputProps={{ maxLength: 50 }}
          />
          <Button
            variant="contained"
            color="primary"
            fullWidth
            size="large"
            disabled={loading}
            onClick={handleSendOtp}
            sx={{ mt: 2 }}
          >
            {loading ? <CircularProgress size={24} /> : "Send OTP"}
          </Button>
        </>
      ) : (
        <>
          <Typography fontWeight={500}>
            OTP sent to{" "}
            <span style={{ color: "#13C0A2" }}>{identifier}</span>
          </Typography>
          <TextField
            label="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            fullWidth
            autoFocus
            inputProps={{
              maxLength: 6,
              style: {
                letterSpacing: 6,
                fontSize: 24,
                textAlign: "center",
              },
            }}
          />
          <Button
            variant="contained"
            color="primary"
            fullWidth
            size="large"
            disabled={loading}
            onClick={handleVerifyOtp}
            sx={{ mt: 2 }}
          >
            {loading ? <CircularProgress size={24} /> : "Verify & Login"}
          </Button>
          <Button fullWidth sx={{ mt: 1 }} onClick={() => setStep(1)}>
            Change number/email
          </Button>
        </>
      )}
      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snack.severity}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
