import React from "react";
import { useNavigate } from "react-router-dom";

function GoDavaiiLogo({ className = "" }) {
  // Only a subtle brand accent, otherwise all-white for clarity!
  return (
    <span
      className={`font-extrabold text-4xl md:text-5xl tracking-wide font-montserrat select-none ${className}`}
      style={{
        fontFamily: "Montserrat, Inter, Arial, sans-serif",
        letterSpacing: "0.08em",
      }}
    >
      <span className="text-white">Go</span>
      <span className="text-white">Dava</span>
      <span className="text-white">ii</span>
    </span>
  );
}

export default function WelcomePage() {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    const token = localStorage.getItem("token");
    navigate(token ? "/home" : "/otp-login");
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center bg-gradient-to-br from-[#10b981] via-[#059669] to-[#0f766e]">
      <div className="flex flex-col flex-1 items-center justify-center w-full px-6">
        <GoDavaiiLogo className="mt-36 mb-7 text-5xl md:text-6xl" />
        <div className="text-lg md:text-xl font-bold text-emerald-200 text-center tracking-wider mb-1">
          Fast. Reliable. Guaranteed.
        </div>
      </div>
      <div className="mb-14 w-full flex justify-center">
        <button
          onClick={handleGetStarted}
          className="w-11/12 max-w-xs py-4 bg-white text-[#10b981] font-extrabold text-lg rounded-full shadow-xl hover:bg-[#e6f9f2] active:scale-95 transition"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
