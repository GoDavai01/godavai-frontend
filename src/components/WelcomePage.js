// src/pages/WelcomePage.js (AutoGate)
// Shows nothing; immediately routes after Android system splash.
// Keeps your body/html flags so global bars stay hidden during the handoff.

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function WelcomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Mark the document so global components (e.g., ViewCartBar) can hide here.
    document.documentElement.classList.add("gd-welcome");
    document.body.classList.add("welcome-solid-bg");

    // Auto-redirect: if logged in -> /home, else -> /otp-login
    const token = localStorage.getItem("token");
    // Use replace so the welcome route isn't kept in history
    navigate(token ? "/home" : "/otp-login", { replace: true });

    return () => {
      document.documentElement.classList.remove("gd-welcome");
      document.body.classList.remove("welcome-solid-bg");
    };
  }, [navigate]);

  // Render nothing so the Android system splash is the only "welcome" shown.
  return null;
}
