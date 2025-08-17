import React from "react";
import { useNavigate } from "react-router-dom";

function GoDavaiiWordmark({ className = "" }) {
  return (
    <h1
      className={["text-white font-black leading-none tracking-tight",
                  "text-[56px] md:text-[88px]", className].join(" ")}
      style={{ fontFamily: "Inter, Montserrat, system-ui, sans-serif" }}
    >
      godavaii
    </h1>
  );
}

export default function WelcomePage() {
  const navigate = useNavigate();
  const handleGetStarted = () => {
    const token = localStorage.getItem("token");
    navigate(token ? "/home" : "/otp-login");
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-between text-white"
      style={{ background: "#0E5E43" }}  
    >
      <div className="flex flex-col flex-1 items-center justify-center w-full px-6">
        <GoDavaiiWordmark className="mt-32 mb-6" />
        <p className="font-extrabold text-white/90 tracking-wide">
          Fast. Reliable. Guaranteed.
        </p>
      </div>

      <div className="mb-14 w-full flex justify-center">
        <button
          onClick={handleGetStarted}
          className="w-11/12 max-w-xs py-4 rounded-full font-extrabold text-lg text-[#0E5E43] bg-white shadow-[0_8px_28px_rgba(0,0,0,0.35)] active:scale-95 transition"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
