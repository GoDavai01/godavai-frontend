// src/pages/SearchResults.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import {
  Search,
  Clock,
  Loader2,
  X,
} from "lucide-react";
import { useCart } from "../context/CartContext";

// shadcn/ui
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0f6e51";
const MAX_DISTANCE = 5000; // 5 km
const MAX_PHARMACIES = 10;

// purely visual
const highlight = (str, className = "text-emerald-700") => (
  <span className={`${className} font-black`}>{str}</span>
);

// same image helper used elsewhere
const getImageUrl = (img) => {
  if (!img)
    return "https://img.freepik.com/free-vector/medicine-bottle-pills-isolated_1284-42391.jpg?w=400";
  if (typeof img === "string" && img.startsWith("/uploads/")) return `${API_BASE_URL}${img}`;
  if (typeof img === "string" && (img.startsWith("http://") || img.startsWith("https://")))
    return img;
  return img;
};

// simple scorer so results are ordered by how well they match the query
function scoreMatch(q, m) {
  const qn = (q || "").toLowerCase().trim();
  if (!qn) return 0;

  const fields = [
    m.name,
    m.brand,
    m.company,
    m.composition,
    Array.isArray(m.category) ? m.category.join(" ") : m.category,
    Array.isArray(m.type) ? m.type.join(" ") : m.type,
  ]
    .filter(Boolean)
    .map(String)
    .map((s) => s.toLowerCase());

  let score = 0;
  for (const f of fields) {
    if (!f) continue;
    if (f === qn) score += 100; // exact
    if (f.startsWith(qn)) score += 40; // prefix
    if (f.includes(qn)) score += 20; // contains
  }
  return score;
}

/* ---------- Horizontal medicine card (same vibe as Home.js) ---------- */
function MedCard({ med, onAdd, onOpen }) {
  const price = med.price ?? med.mrp ?? "--";
  const [src, setSrc] = useState(getImageUrl(med.img || med.image || med.imageUrl));

  return (
    <div
      className="min-w-[260px] max-w-[260px] h-[106px] rounded-2xl bg-white/95 ring-1 ring-[var(--pillo-surface-border)] shadow-sm flex items-center p-3 gap-3 cursor-pointer active:scale-[0.99] transition"
      onClick={() => onOpen?.(med)}
      title={med.brand || med.name}
    >
      <div className="h-[78px] w-[86px] rounded-xl bg-white ring-1 ring-[var(--pillo-surface-border)] shadow-sm overflow-hidden grid place-items-center">
        <img
          src={src}
          alt={med.brand || med.name || "Medicine"}
          loading="lazy"
          onError={() =>
            setSrc("https://img.freepik.com/free-vector/medicine-bottle-pills-isolated_1284-42391.jpg?w=400")
          }
          className="h-full w-full object-contain"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div
          className="text-[14.5px] font-bold text-[var(--pillo-active-text)]"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {med.brand || med.name}
        </div>

        <div className="mt-0.5 text-[13px] font-semibold text-[var(--pillo-active-text)]">₹{price}</div>

        <div className="mt-1 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-[var(--pillo-active-text)] ring-1 ring-[var(--pillo-surface-border)]">
            <Clock className="h-3 w-3" /> ≤ 30 min
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd(med);
            }}
            className="rounded-full bg-[var(--pillo-active-text)] text-white text-[12px] font-bold px-3 py-1.5 shadow hover:brightness-105"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SearchResults() {
  const location = useLocation();
  const query = new URLSearchParams(location.search).get("q") || "";
  const navigate = useNavigate();

  // Dialog state
  const [selectedMed, setSelectedMed] = useState(null);
  const [activeImg, setActiveImg] = useState(0);

  const { cart, addToCart } = useCart();

  // for header chips
  const [autoSuggestions, setAutoSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  // nearby pharmacies (within 5km)
  const [nearbyPharmacies, setNearbyPharmacies] = useState([]); // [{...ph, dist}]
  // group: [{ pharmacy, medicines: [] }]
  const [pharmacySections, setPharmacySections] = useState([]);

  // geolocation from LS (same keys as rest of app)
  const locationObj = JSON.parse(localStorage.getItem("currentAddress") || "{}");
  const lat = locationObj.lat || null;
  const lng = locationObj.lng || null;

  // ===== Fetch nearby pharmacies (≤5km) =====
  useEffect(() => {
    let cancel = false;
    async function run() {
      if (!lat || !lng) {
        setNearbyPharmacies([]);
        return;
      }
      try {
        const r = await fetch(
          `${API_BASE_URL}/api/pharmacies/nearby?lat=${lat}&lng=${lng}&maxDistance=${MAX_DISTANCE}`
        );
        const phs = await r.json();
        if (!cancel) setNearbyPharmacies(Array.isArray(phs) ? phs.slice(0, MAX_PHARMACIES) : []);
      } catch {
        if (!cancel) setNearbyPharmacies([]);
      }
    }
    run();
    return () => {
      cancel = true;
    };
  }, [lat, lng]);

  // ===== Fetch matching meds + group by nearby pharmacy =====
  useEffect(() => {
    let cancel = false;

    async function run() {
      if (!query) {
        setPharmacySections([]);
        setAutoSuggestions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/medicines/search`, {
          params: { q: query, lat, lng, maxDistance: MAX_DISTANCE, limit: 400 },
        });

        const meds = (Array.isArray(data) ? data : [])
          .map((m) => ({ ...m, __score: scoreMatch(query, m) }))
          .sort((a, b) => b.__score - a.__score);

        // suggestions from unique names/brands
        const chips = Array.from(
          new Set(
            meds
              .map((m) => m.brand || m.name)
              .filter(Boolean)
              .map((s) => String(s))
          )
        ).slice(0, 12);
        if (!cancel) setAutoSuggestions(chips);

        // group by pharmacy (but only those that are in the nearby list)
        const nearbyIds = new Set(nearbyPharmacies.map((p) => String(p._id)));
        const phMap = new Map(); // id -> { pharmacy, meds: [] }

        for (const m of meds) {
          const pid = String(m.pharmacy || "");
          if (!nearbyIds.has(pid)) continue; // keep only ≤5km pharmacies
          if (!phMap.has(pid)) {
            const ph = nearbyPharmacies.find((p) => String(p._id) === pid);
            if (!ph) continue;
            phMap.set(pid, { pharmacy: ph, medicines: [] });
          }
          phMap.get(pid).medicines.push(m);
        }

        // order pharmacies by distance (as given by nearbyPharmacies order)
        const sections = nearbyPharmacies
          .map((ph) => phMap.get(String(ph._id)))
          .filter(Boolean)
          .map((sec) => ({ ...sec, medicines: sec.medicines.slice(0, 8) })) // cap per section for UI
          .slice(0, MAX_PHARMACIES);

        if (!cancel) setPharmacySections(sections);
      } catch {
        if (!cancel) {
          setPharmacySections([]);
          setAutoSuggestions([]);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, lat, lng, nearbyPharmacies]);

  // suggestions chip click
  const handleSuggestionClick = (suggestion) => {
    navigate(`/search?q=${encodeURIComponent(suggestion)}`);
  };

  // ===== one-pharmacy cart rule =====
  const handleAddToCart = (pharmacy, med) => {
    if ((cart?.length || 0) > 0) {
      const cartPharmacyId = cart[0]?.pharmacy?._id || cart[0]?.pharmacy;
      const targetPhId = pharmacy?._id || med?.pharmacy?._id || med?.pharmacy;
      if (cartPharmacyId && targetPhId && String(cartPharmacyId) !== String(targetPhId)) {
        alert("You can only order medicines from one pharmacy at a time.");
        return;
      }
    }
    // ensure the item we add carries the full pharmacy object
    addToCart({ ...med, pharmacy });
  };

  // gallery images for dialog
  const images = useMemo(() => {
    if (!selectedMed) return [];
    const arr = (Array.isArray(selectedMed.images) && selectedMed.images.length
      ? selectedMed.images
      : [selectedMed.img]
    ).filter(Boolean);
    return arr;
  }, [selectedMed]);

  return (
    <div className="min-h-screen bg-slate-50 py-6">
      <div className="mx-auto w-full max-w-3xl px-4">
        {/* Header */}
        <div className="mb-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800 font-extrabold text-sm">
            <Search className="h-4 w-4" />
            GoDavaii
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight" style={{ color: DEEP }}>
            Search Results
          </h1>
          <p className="text-sm font-semibold text-emerald-900/70">
            for {highlight(query, "text-emerald-800")}
          </p>
        </div>

        <Card className="rounded-3xl border-emerald-100/70 shadow-sm">
          <CardContent className="p-5 sm:p-6">
            {/* Suggestions */}
            {autoSuggestions.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3">
                <span className="text-xs font-extrabold text-emerald-700/80">Suggestions:</span>
                {autoSuggestions.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    onClick={() => handleSuggestionClick(s)}
                    variant="outline"
                    className="h-8 rounded-full border-emerald-300 text-emerald-800 font-bold hover:bg-emerald-50"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="mt-2 grid place-items-center text-emerald-800">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="ml-2 text-sm font-bold">Loading…</span>
              </div>
            )}

            {/* Pharmacies with matching meds (Home.js style sections) */}
            {!loading && pharmacySections.length === 0 && (
              <div className="mt-4 text-center text-sm text-neutral-500">
                No nearby pharmacies (within 5 km) have medicines matching <b>{query}</b>.
              </div>
            )}

            {!loading &&
              pharmacySections.map(({ pharmacy, medicines }, idx) => (
                <div key={pharmacy._id || idx} className={idx === 0 ? "" : "mt-8"}>
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => navigate(`/medicines/${pharmacy._id}`)}
                      className="font-extrabold text-lg text-[var(--pillo-active-text)] inline-flex items-center gap-2"
                    >
                      Medicines at {pharmacy.name}
                    </button>
                    <button
                      className="text-[var(--pillo-active-text)] text-[15px] font-bold hover:underline"
                      onClick={() => navigate(`/medicines/${pharmacy._id}`)}
                    >
                      View All &gt;
                    </button>
                  </div>

                  <div className="flex gap-3 pb-2 snap-x overflow-x-auto">
                    {medicines.map((med, mi) => (
                      <div key={med._id || mi} className="snap-center">
                        <MedCard
                          med={med}
                          onAdd={(m) => handleAddToCart(pharmacy, m)}
                          onOpen={(m) => {
                            setSelectedMed({ ...m, pharmacy });
                            setActiveImg(0);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      {/* Medicine dialog (same UX as Medicines.jsx) */}
      <Dialog
        open={!!selectedMed}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMed(null);
            setActiveImg(0);
          }
        }}
      >
        <DialogContent className="w-[min(96vw,740px)] p-0 overflow-hidden rounded-2xl md:w-[720px]">
          {selectedMed && (
            <>
              <DialogHeader className="px-5 pt-5 pb-2">
                <DialogTitle className="text-2xl font-extrabold" style={{ color: DEEP }}>
                  {selectedMed.brand || selectedMed.name}
                </DialogTitle>
              </DialogHeader>

              {/* Gallery */}
              <div className="px-5">
                <div className="relative w-full h-[320px] md:h-[380px] rounded-xl ring-1 ring-[var(--pillo-surface-border)] bg-white overflow-hidden">
                  <div
                    className="h-full flex transition-transform duration-300"
                    style={{ transform: `translateX(-${activeImg * 100}%)` }}
                    onTouchStart={(e) => (e.currentTarget.dataset.sx = e.touches[0].clientX)}
                    onTouchEnd={(e) => {
                      const sx = Number(e.currentTarget.dataset.sx || 0);
                      const dx = e.changedTouches[0].clientX - sx;
                      if (dx < -40 && activeImg < images.length - 1) setActiveImg((i) => i + 1);
                      if (dx > 40 && activeImg > 0) setActiveImg((i) => i - 1);
                    }}
                  >
                    {images.map((src, i) => (
                      <div key={i} className="min-w-full h-full grid place-items-center select-none">
                        <img
                          src={getImageUrl(src)}
                          alt={selectedMed.name}
                          className="max-h-full max-w-full object-contain"
                          draggable={false}
                        />
                      </div>
                    ))}
                  </div>

                  {images.length > 1 && (
                    <>
                      <button
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 ring-1 ring-black/10 px-2 py-1.5"
                        onClick={() => setActiveImg((i) => Math.max(0, i - 1))}
                      >
                        ‹
                      </button>
                      <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 ring-1 ring-black/10 px-2 py-1.5"
                        onClick={() => setActiveImg((i) => Math.min(images.length - 1, i + 1))}
                      >
                        ›
                      </button>
                    </>
                  )}

                  {images.length > 1 && (
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                      {images.map((_, i) => (
                        <span
                          key={i}
                          onClick={() => setActiveImg(i)}
                          className={`h-1.5 rounded-full cursor-pointer transition-all ${
                            i === activeImg ? "w-5 bg-emerald-600" : "w-2.5 bg-emerald-200"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* info */}
              <div className="px-5 pt-3">
                <div className="flex flex-wrap gap-2 mb-2">
                  {Array.isArray(selectedMed.category) && selectedMed.category.length > 0 && (
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold">
                      {selectedMed.category.join(", ")}
                    </Badge>
                  )}
                  {selectedMed.type && (
                    <Badge className="bg-white text-emerald-700 border border-emerald-200 font-semibold">
                      {Array.isArray(selectedMed.type) ? selectedMed.type.join(", ") : selectedMed.type}
                    </Badge>
                  )}
                </div>

                {selectedMed.composition && (
                  <div className="text-sm text-neutral-700 mb-1">
                    <b>Composition:</b> {selectedMed.composition}
                  </div>
                )}
                {selectedMed.company && (
                  <div className="text-sm text-neutral-700 mb-2">
                    <b>Company:</b> {selectedMed.company}
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <div className="text-2xl font-extrabold" style={{ color: DEEP }}>
                    ₹{selectedMed.price ?? selectedMed.mrp ?? "--"}
                  </div>
                  {selectedMed.mrp && (selectedMed.price ?? 0) < selectedMed.mrp && (
                    <>
                      <div className="text-sm text-neutral-400 line-through">₹{selectedMed.mrp}</div>
                      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold">
                        {Math.round(((selectedMed.mrp - (selectedMed.price ?? 0)) / selectedMed.mrp) * 100)}
                        % OFF
                      </Badge>
                    </>
                  )}
                </div>

                <div className="text-sm text-neutral-700 mb-4 whitespace-pre-line leading-relaxed">
                  {selectedMed.description ? (
                    selectedMed.description
                  ) : (
                    <span className="text-neutral-400">No description available.</span>
                  )}
                </div>
              </div>

              <div className="p-5 pt-0 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedMed(null)}>
                  <X className="h-4 w-4 mr-1" /> Close
                </Button>
                <Button
                  className="flex-1 font-bold"
                  style={{ backgroundColor: DEEP, color: "white" }}
                  onClick={() => {
                    // ensure pharmacy object persists
                    handleAddToCart(selectedMed.pharmacy, selectedMed);
                    setSelectedMed(null);
                  }}
                >
                  Add to Cart
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
