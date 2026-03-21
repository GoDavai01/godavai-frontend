// src/components/ProtectedRoute.js
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, token } = useAuth();

  // If user is not logged in, redirect to OTP login page
  if (!user && !token) {
    return <Navigate to="/otp-login" replace />;
  }

  // If logged in, render the component
  return children;
}
