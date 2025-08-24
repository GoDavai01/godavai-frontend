// src/pages/SearchResults.jsx
import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import { useCart } from "../context/CartContext";

// shadcn/ui
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0f6e51";

// === styling-only highlight (logic unchanged)
const highlight = (str, className = "text-emerald-700") => (
  <span className={`${className} font-black`}>{str}</span>
);

export default function SearchResults() {
  const location = useLocation();
  const query = new URLSearchParams(location.search).get("q") || "";
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoSuggestions, setAutoSuggestions] = useState([]);
  const [pharmacySearch, setPharmacySearch] = useState("");
  const { addToCart } = useCart();
  const navigate = useNavigate();

  // Always use latest city/area from localStorage
  const locationObj = JSON.parse(localStorage.getItem("currentAddress") || "{}");
  const lat = locationObj.lat || null;
  const lng = locationObj.lng || null;

  useEffect(() => {
    if (!query || !lat || !lng) return; // Only search if we have query and geolocation
    setLoading(true);

    axios
      .get(`${API_BASE_URL}/api/medicines/by-name`, {
        params: { name: query, lat, lng },
      })
      .then((res) => setOffers(res.data || []))
      .catch(() => setOffers([]))
      .finally(() => setLoading(false));
  }, [query, lat, lng]);

  useEffect(() => {
    if (!query) return;
    axios
      .get(`${API_BASE_URL}/api/medicines/search`, { params: { q: query, lat, lng } })
      .then((res) => {
        const names = Array.from(new Set(res.data.map((m) => m.name)));
        setAutoSuggestions(names);
      })
      .catch(() => setAutoSuggestions([]));
  }, [query, lat, lng]);

  const handleSuggestionClick = (suggestion) => {
    navigate(`/search?q=${encodeURIComponent(suggestion)}`);
  };

  const filteredOffers = offers.filter((offer) => {
    if (!pharmacySearch) return true;
    const term = pharmacySearch.toLowerCase();
    return (
      (offer.pharmacy?.name || "").toLowerCase().includes(term) ||
      (offer.pharmacy?.area || "").toLowerCase().includes(term) ||
      (offer.pharmacy?.city || "").toLowerCase().includes(term)
    );
  });

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

            {/* Results */}
            {loading ? (
              <div className="mt-6 grid place-items-center text-emerald-800">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="ml-2 text-sm font-bold">Loading…</span>
              </div>
            ) : filteredOffers.length === 0 ? (
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                <AlertCircle className="mt-0.5 h-5 w-5" />
                <div className="text-sm font-bold">
                  No pharmacies found near{" "}
                  <b>{locationObj.formatted || "your location"}</b> for <b>{query}</b>.
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
                            {offer.pharmacy?.area && offer.pharmacy?.city && ","}{" "}
                            {offer.pharmacy?.city}
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
                              pharmacy: offer.pharmacy, // keep whole object (logic preserved)
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
    </div>
  );
}
