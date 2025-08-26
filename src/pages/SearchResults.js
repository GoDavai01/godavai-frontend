// src/pages/SearchResults.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import {
  Search,
  Store,
  MapPin,
  IndianRupee,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShoppingCart,
  X,
} from "lucide-react";
import { useCart } from "../context/CartContext";

// shadcn/ui
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0f6e51";

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

export default function SearchResults() {
  const location = useLocation();
  const query = new URLSearchParams(location.search).get("q") || "";
  const [loading, setLoading] = useState(true);

  // medicines matched by name/brand/company/composition
  const [meds, setMeds] = useState([]);

  // suggestions from results (chips)
  const [autoSuggestions, setAutoSuggestions] = useState([]);

  // pharmacies that carry the searched item
  const [offers, setOffers] = useState([]);

  // local filter for pharmacy list
  const [pharmacySearch, setPharmacySearch] = useState("");

  // dialog state (same UX as Medicines.jsx)
  const [selectedMed, setSelectedMed] = useState(null);
  const [activeImg, setActiveImg] = useState(0);
  const { addToCart } = useCart();
  const navigate = useNavigate();

  // geolocation from LS (same keys as rest of app)
  const locationObj = JSON.parse(localStorage.getItem("currentAddress") || "{}");
  const lat = locationObj.lat || null;
  const lng = locationObj.lng || null;

  // 1) Fetch medicines matching query (brand/name/company/composition)
  useEffect(() => {
    if (!query) {
      setMeds([]);
      setAutoSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    axios
      .get(`${API_BASE_URL}/api/medicines/search`, {
        params: { q: query, lat, lng },
      })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        // sort by our local score so closest matches float up
        const sorted = data
          .map((m) => ({ ...m, __score: scoreMatch(query, m) }))
          .sort((a, b) => b.__score - a.__score);
        setMeds(sorted);

        // suggestions from unique names/brands
        const chips = Array.from(
          new Set(
            sorted
              .map((m) => m.brand || m.name)
              .filter(Boolean)
              .map((s) => String(s))
          )
        ).slice(0, 12);
        setAutoSuggestions(chips);
      })
      .catch(() => {
        setMeds([]);
        setAutoSuggestions([]);
      })
      .finally(() => setLoading(false));
  }, [query, lat, lng]);

  // 2) Fetch nearby pharmacy offers for the typed query.
  //    If that returns nothing, try with the best-matching medicine names as a fallback,
  //    so "dolo" still finds "Dolo 650" offers even if /by-name is strict.
  useEffect(() => {
    if (!query || !lat || !lng) {
      setOffers([]);
      return;
    }

    let didCancel = false;

    (async () => {
      const baseParams = { name: query, lat, lng };
      try {
        const r1 = await axios.get(`${API_BASE_URL}/api/medicines/by-name`, { params: baseParams });
        if (!didCancel && Array.isArray(r1.data) && r1.data.length) {
          setOffers(r1.data);
          return;
        }
      } catch {
        /* fall through */
      }

      // fallback: try top 3 best-matching medicine names
      try {
        const topNames = meds
          .slice(0, 3)
          .map((m) => m.brand || m.name)
          .filter(Boolean);
        if (topNames.length === 0) {
          if (!didCancel) setOffers([]);
          return;
        }
        const results = await Promise.allSettled(
          topNames.map((n) =>
            axios.get(`${API_BASE_URL}/api/medicines/by-name`, { params: { name: n, lat, lng } })
          )
        );
        const merged = results
          .filter((p) => p.status === "fulfilled" && Array.isArray(p.value?.data))
          .flatMap((p) => p.value.data);

        // de-dupe by pharmacy+medId so we don’t spam the list
        const seen = new Set();
        const dedup = [];
        for (const o of merged) {
          const key = `${o.pharmacy?._id || o.pharmacy}-${o.medId || o._id || ""}`;
          if (seen.has(key)) continue;
          seen.add(key);
          dedup.push(o);
        }
        if (!didCancel) setOffers(dedup);
      } catch {
        if (!didCancel) setOffers([]);
      }
    })();

    return () => {
      didCancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, lat, lng, meds.length]);

  // suggestions chip click
  const handleSuggestionClick = (suggestion) => {
    navigate(`/search?q=${encodeURIComponent(suggestion)}`);
  };

  // local filter for pharmacy list
  const filteredOffers = offers.filter((offer) => {
    if (!pharmacySearch) return true;
    const term = pharmacySearch.toLowerCase();
    return (
      (offer.pharmacy?.name || "").toLowerCase().includes(term) ||
      (offer.pharmacy?.area || "").toLowerCase().includes(term) ||
      (offer.pharmacy?.city || "").toLowerCase().includes(term)
    );
  });

  // choose the best offer we know (in-stock & lowest price) for a medicine
  const bestOfferByMedId = useMemo(() => {
    const map = new Map();
    for (const o of offers) {
      const key = o.medId || o._id || o.id;
      if (!key) continue;
      const prev = map.get(key);
      const wins =
        !prev ||
        (o.stock > 0 && prev.stock === 0) ||
        (o.stock > 0 && prev.stock > 0 && Number(o.price) < Number(prev.price));
      if (wins) map.set(key, o);
    }
    return map;
  }, [offers]);

  const priceForMed = (m) => {
    const key = m._id || m.id;
    const best = key ? bestOfferByMedId.get(key) : null;
    return best ? best.price : m.price ?? m.mrp ?? 0;
  };

  const addMedToCart = (m) => {
    const key = m._id || m.id;
    const offer = key ? bestOfferByMedId.get(key) : null;
    if (offer) {
      addToCart({
        ...offer,
        _id: offer.medId || offer._id,
        pharmacy: offer.pharmacy,
        name: offer.name || m.name || m.brand,
        price: offer.price,
      });
    } else {
      addToCart(m);
    }
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

            {/* Medicines grid */}
            {loading ? (
              <div className="mt-2 grid place-items-center text-emerald-800">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="ml-2 text-sm font-bold">Loading…</span>
              </div>
            ) : meds.length > 0 ? (
              <>
                <div className="mb-2 text-[13px] font-extrabold text-emerald-900">
                  Medicines matching {highlight(query)}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {meds.map((m) => {
                    const p = priceForMed(m);
                    const hasDiscount = m.mrp && Number(p) < Number(m.mrp);
                    const discountPct = hasDiscount
                      ? Math.round(((m.mrp - p) / m.mrp) * 100)
                      : null;

                    return (
                      <Card
                        key={m._id}
                        className="p-2 rounded-2xl bg-white ring-1 ring-[var(--pillo-surface-border,#e6f4ef)] shadow-sm transition-transform hover:-translate-y-0.5"
                      >
                        <button
                          className="w-full aspect-square grid place-items-center rounded-xl bg-white ring-1 ring-[var(--pillo-surface-border,#e6f4ef)] shadow-sm overflow-hidden"
                          onClick={() => {
                            setSelectedMed(m);
                            setActiveImg(0);
                          }}
                          title="Know more"
                        >
                          <img src={getImageUrl(m.img)} alt={m.name} className="h-full w-full object-contain" />
                        </button>

                        <div className="mt-2">
                          <div
                            className="text-[13px] font-extrabold text-emerald-800 leading-snug cursor-pointer"
                            onClick={() => {
                              setSelectedMed(m);
                              setActiveImg(0);
                            }}
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                            title={m.brand || m.name}
                          >
                            {m.brand || m.name}
                          </div>

                          {m.company && (
                            <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                              {m.company}
                            </div>
                          )}

                          <div className="mt-1 flex items-baseline gap-1">
                            <div className="text-[15px] font-extrabold" style={{ color: DEEP }}>
                              ₹{p}
                            </div>
                            {m.mrp && (
                              <div className="text-[11px] text-neutral-400 line-through">₹{m.mrp}</div>
                            )}
                            {hasDiscount && (
                              <span className="ml-auto text-[10px] font-bold text-emerald-700">
                                {discountPct}% OFF
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex items-center justify-between">
                            {Array.isArray(m.category) && m.category[0] && (
                              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold text-[10px] px-2 py-0.5">
                                {m.category[0]}
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              className="h-8 rounded-full px-3 text-[12px] font-bold"
                              style={{ backgroundColor: DEEP, color: "white" }}
                              onClick={() => addMedToCart(m)}
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                <div className="my-4 border-t border-emerald-100" />
              </>
            ) : (
              <div className="mt-2 text-center text-sm text-neutral-500">
                No medicines matched <b>{query}</b>.
              </div>
            )}

            {/* Pharmacy search input */}
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-700/70" />
              <Input
                type="text"
                value={pharmacySearch}
                onChange={(e) => setPharmacySearch(e.target.value)}
                placeholder="Search pharmacy, area or city…"
                className="pl-9 rounded-xl border-emerald-300 focus-visible:ring-emerald-600"
              />
            </div>

            <div className="mb-1 flex flex-wrap items-center gap-x-2 text-sm">
              <span className="font-extrabold text-emerald-900">Pharmacies near</span>
              <span className="inline-flex items-center gap-1 font-black text-emerald-700">
                <MapPin className="h-3.5 w-3.5" />
                {locationObj.formatted || locationObj.city || "your location"}
              </span>
              <span className="text-emerald-900 font-extrabold">with</span>
              {highlight(query)}
            </div>

            {/* Pharmacy offers list */}
            {loading ? (
              <div className="mt-6 grid place-items-center text-emerald-800">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="ml-2 text-sm font-bold">Loading…</span>
              </div>
            ) : filteredOffers.length === 0 ? (
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                <AlertCircle className="mt-0.5 h-5 w-5" />
                <div className="text-sm font-bold">
                  No pharmacies found near <b>{locationObj.formatted || "your location"}</b> for{" "}
                  <b>{query}</b>.
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {filteredOffers.map((offer, idx) => (
                  <motion.div
                    key={offer.medId || offer._id || idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -2 }}
                    className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row">
                      {/* Pharmacy info */}
                      <div className="flex flex-1 items-center gap-3 p-4">
                        <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50">
                          <Store className="h-5 w-5 text-emerald-700" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-lg font-black text-emerald-800">
                            {offer.pharmacy?.name}
                          </div>
                          <div className="truncate text-[13px] font-semibold text-emerald-900/70">
                            <span className="font-bold">{offer.pharmacy?.area}</span>
                            {offer.pharmacy?.area && offer.pharmacy?.city && ","} {offer.pharmacy?.city}
                          </div>
                        </div>
                      </div>

                      {/* Price & stock */}
                      <div className="grid w-full sm:w-56 place-items-center border-t sm:border-t-0 sm:border-l border-emerald-100 bg-emerald-50">
                        <div className="py-3 text-center">
                          <div className="inline-flex items-center gap-1 text-emerald-700">
                            <IndianRupee className="h-4 w-4" />
                            <span className="text-xl font-black">₹{offer.price}</span>
                          </div>
                          <div
                            className={`mt-0.5 inline-flex items-center gap-1 text-xs font-extrabold ${
                              offer.stock > 0 ? "text-emerald-700" : "text-rose-600"
                            }`}
                          >
                            {offer.stock > 0 ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                In stock
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-3.5 w-3.5" />
                                Out of stock
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Add to cart */}
                      <div className="grid w-full sm:w-48 place-items-center bg-emerald-700 p-3">
                        <Button
                          type="button"
                          disabled={offer.stock === 0}
                          onClick={() =>
                            addToCart({
                              ...offer,
                              _id: offer.medId || offer._id,
                              pharmacy: offer.pharmacy,
                              name: offer.name || query,
                              price: offer.price,
                            })
                          }
                          className="w-40 rounded-xl bg-white text-emerald-700 font-extrabold hover:bg-emerald-50 disabled:opacity-60"
                        >
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          {offer.stock > 0 ? "Add to Cart" : "Out of Stock"}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
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
                    ₹{priceForMed(selectedMed)}
                  </div>
                  {selectedMed.mrp && priceForMed(selectedMed) < selectedMed.mrp && (
                    <>
                      <div className="text-sm text-neutral-400 line-through">₹{selectedMed.mrp}</div>
                      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold">
                        {Math.round(
                          ((selectedMed.mrp - priceForMed(selectedMed)) / selectedMed.mrp) * 100
                        )}
                        % OFF
                      </Badge>
                    </>
                  )}
                </div>

                <div className="text-sm text-neutral-700 mb-4">
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
                    addMedToCart(selectedMed);
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
