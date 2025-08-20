// src/pages/PharmaciesNearYou.js
// "use client";

import React, { useEffect, useRef, useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useLocation } from "../context/LocationContext";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Timer, UploadCloud, ChevronUp, X } from "lucide-react";
import PrescriptionUploadModal from "../components/PrescriptionUploadModal";
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion";
// Render Home behind as the background (non-interactive)
import Home from "../components/Home";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0f6e51";

export default function PharmaciesNearYou() {
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canDeliver, setCanDeliver] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);

  // ----- SNAP SYSTEM (translateY, not height) -----
  const [vh, setVh] = useState(typeof window !== "undefined" ? window.innerHeight : 800);
  const y = useMotionValue(0);
  const HALF = Math.round(vh * 0.44); // how far down the full-height sheet is translated
  const FULL = Math.round(vh * 0.08); // small top gutter when expanded

  // start at HALF sheet
  useEffect(() => {
    y.set(HALF);
    // keep constraints updated on resize
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line
  }, []);

  // ----- DATA (UNCHANGED LOGIC) -----
  const navigate = useNavigate();
  const { currentAddress } = useLocation();

  useEffect(() => {
    if (!currentAddress?.lat || !currentAddress?.lng) {
      setLoading(false);
      setPharmacies([]);
      return;
    }
    setLoading(true);
    fetch(`${API_BASE_URL}/api/pharmacies/nearby?lat=${currentAddress.lat}&lng=${currentAddress.lng}`)
      .then((r) => r.json())
      .then((d) => setPharmacies(Array.isArray(d) ? d : []))
      .catch(() => setPharmacies([]))
      .finally(() => setLoading(false));
  }, [currentAddress]);

  useEffect(() => {
    if (!currentAddress?.lat || !currentAddress?.lng) {
      setCanDeliver(false);
      return;
    }
    fetch(`${API_BASE_URL}/api/delivery/active-partner-nearby?lat=${currentAddress.lat}&lng=${currentAddress.lng}`)
      .then((r) => r.json())
      .then((d) => setCanDeliver(!!d.activePartnerExists))
      .catch(() => setCanDeliver(false));
  }, [currentAddress]);

  // Optional: auto-open to FULL when many pharmacies
  useEffect(() => {
    if (!loading && pharmacies.length > 4) {
      animate(y, FULL, { type: "spring", stiffness: 380, damping: 34 });
    }
  }, [loading, pharmacies.length, FULL, y]);

  // Snap helper
  const snapTo = (target) => animate(y, target, { type: "spring", stiffness: 380, damping: 34 });

  // Drag end => snap to closest (FULL or HALF)
  const onDragEnd = (_, info) => {
    const current = y.get() + info.offset.y;
    const toFullDist = Math.abs(current - FULL);
    const toHalfDist = Math.abs(current - HALF);
    snapTo(toFullDist < toHalfDist ? FULL : HALF);
  };

  return (
    <div className="relative min-h-screen">
      {/* BACKGROUND = Home (non-interactive) */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-home-preview">
        <Home />
        {/* Hide Home’s floating CTA by aria-label so it never shows behind the sheet */}
        <style>{`
          .bg-home-preview [aria-label="Upload Prescription"] { display: none !important; }
        `}</style>
        {/* Strong bottom mask so Home's bottom nav never leaks through */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[220px] bg-gradient-to-t from-white via-white/95 to-white/0" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-white to-transparent" />
      </div>

      {/* BOTTOM SHEET – full height, moved by translateY only */}
      <AnimatePresence initial={false}>
        <motion.div
          key="pharmacy-sheet"
          drag="y"
          dragConstraints={{ top: FULL, bottom: HALF }}
          dragElastic={0.06}
          dragMomentum={false} // no overshoot jitter
          style={{
            y, // <- smooth snap between HALF and FULL
            height: "100vh",
          }}
          onDragEnd={onDragEnd}
          className="fixed left-0 right-0 bottom-0 mx-auto max-w-md z-[1200] bg-white"
          // tall sheet with rounded top and shadow
          >
          <div
            className="absolute inset-x-0 top-0"
            style={{
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              boxShadow: "0 -18px 48px rgba(0,0,0,.18)",
              height: 28,
              background: "#fff",
            }}
          />
          <div className="relative h-full flex flex-col">
            {/* Handle + top row */}
            <div className="pt-3 px-4">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-neutral-200" />
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-bold"
                    style={{ color: DEEP }}
                  >
                    {pharmacies.length} pharmacies
                  </span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-bold"
                    style={{ color: DEEP }}
                  >
                    <Timer className="h-3.5 w-3.5" /> ≤ 30 min
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => snapTo(y.get() <= (FULL + HALF) / 2 ? HALF : FULL)}
                  >
                    <ChevronUp className={`h-5 w-5 transition ${y.get() <= (FULL + HALF) / 2 ? "rotate-180" : ""}`} />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.history.back()}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t mt-2" />

            {/* SCROLLER (flex-1) */}
            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-24">
              {!canDeliver && (
                <div className="bg-red-50 text-red-700 font-bold text-[13.5px] px-3 py-2 rounded-xl mb-3 text-center">
                  ⛔ Sorry, no delivery partner is available at your location right now. Please try again soon.
                </div>
              )}

              {loading ? (
                <div className="mt-10 text-center text-neutral-400 animate-pulse">Loading pharmacies…</div>
              ) : pharmacies.length === 0 ? (
                <div className="mt-10 text-center text-neutral-400">No pharmacies found near your location.</div>
              ) : (
                <div className="flex flex-col gap-4">
                  {pharmacies.map((pharmacy) => (
                    <Card
                      key={pharmacy._id}
                      className={`p-4 rounded-2xl bg-white shadow-md hover:shadow-xl transition cursor-pointer ${
                        canDeliver ? "" : "opacity-60 pointer-events-none"
                      }`}
                      style={{ borderColor: `${DEEP}14` }}
                      onClick={() => canDeliver && navigate(`/medicines/${pharmacy._id}`)}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="h-14 w-14 grid place-items-center rounded-xl shrink-0"
                          style={{ background: `${DEEP}0F`, border: `1px solid ${DEEP}22` }}
                        >
                          <img src="/pharmacy-icon.png" alt="Pharmacy" className="h-8 w-8 object-contain" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-extrabold text-[15.5px] truncate" style={{ color: DEEP }} title={pharmacy.name}>
                            {pharmacy.name}
                          </div>
                          <div className="text-xs text-neutral-500 truncate">
                            {pharmacy.address?.area || pharmacy.area || "--"}
                          </div>
                          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                            <Badge className="font-bold text-[11px]" style={{ background: `${DEEP}10`, color: DEEP, borderColor: `${DEEP}30` }}>
                              <Timer className="w-4 h-4 mr-1 inline-block" />
                              13–29 min
                            </Badge>
                            <Badge className="font-bold text-[11px]" style={{ background: "#fff7e6", color: "#b7791f", borderColor: "#facc15" }}>
                              <CheckCircle className="w-4 h-4 mr-1 inline-block" />
                              Verified
                            </Badge>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1 text-xs font-bold text-yellow-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                            </svg>
                            {pharmacy.rating || 4.5}
                          </div>
                          <Button
                            size="sm"
                            className="rounded-full font-bold shadow-none"
                            style={{ backgroundColor: DEEP, color: "white" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (canDeliver) navigate(`/medicines/${pharmacy._id}`);
                            }}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* STICKY SHEET FOOTER (CTA is always at bottom inside the sheet) */}
            <div className="absolute inset-x-0 bottom-0">
              <div className="pointer-events-none h-20 bg-gradient-to-t from-white via-white/90 to-transparent" />
              <div className="px-5 pb-[max(12px,env(safe-area-inset-bottom))] flex justify-end">
                {!uploadOpen && (
                  <button
                    type="button"
                    aria-label="Upload Prescription"
                    onClick={() => setUploadOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full pl-3 pr-4 py-2.5 shadow-[0_10px_24px_rgba(16,185,129,0.35)]"
                    style={{ background: DEEP, color: "white" }}
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[color:var(--pillo-active-text)] ring-1 ring-white/70">
                      <UploadCloud className="h-4.5 w-4.5" />
                    </span>
                    <span className="text-[15px] font-bold">Upload Prescription</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Modal (unchanged) */}
      <PrescriptionUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} userAddress={currentAddress} />
    </div>
  );
}
