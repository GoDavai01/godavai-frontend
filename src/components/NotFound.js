// src/pages/NotFound.js  (fully replaceable)
import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";
import { Sparkles } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div
      className="
        min-h-screen w-full
        flex items-center justify-center px-5
        bg-[radial-gradient(1100px_550px_at_50%_-200px,rgba(16,185,129,0.20),transparent_60%),linear-gradient(180deg,#f7fbff,white)]
      "
    >
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="w-full max-w-[420px] rounded-3xl bg-white/90 backdrop-blur
                   ring-1 ring-[var(--pillo-surface-border)] shadow-[0_16px_60px_rgba(16,24,40,0.18)] p-6"
      >
        {/* Title */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-emerald-600" />
          <h1 className="text-[28px] font-black tracking-tight text-[var(--pillo-active-text)]">
            Coming soon
          </h1>
          <Sparkles className="h-5 w-5 text-emerald-600" />
        </div>

        {/* Copy */}
        <p className="mt-1 text-center text-[15px] text-slate-600">
          We’re polishing this page right now. Check back shortly—good things are on the way!
        </p>

        {/* CTA */}
        <div className="mt-6 flex justify-center">
          <Button
            onClick={() => navigate("/home")}
            className="btn-primary-emerald !font-extrabold rounded-full px-6 py-5 text-base shadow-lg
                       hover:brightness-105 active:scale-[.98]"
          >
            Go to Home
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
