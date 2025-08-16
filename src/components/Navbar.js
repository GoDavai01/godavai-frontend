// src/components/Navbar.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation as useRouterLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, CircleUserRound, Search, Loader2 } from "lucide-react";
import LocationModal from "./LocationModal";
import { useLocation } from "../context/LocationContext";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

// Palette aligned with navbar (sky → teal → emerald)
const PALETTE = {
  gradientFrom: "from-sky-500",
  gradientVia: "via-teal-500",
  gradientTo: "to-emerald-500",
  surfaceBorder: "border-emerald-100/60",
  // Updated: profile chip now teal; location icon matches navbar vibe
  chip: "bg-emerald-400 text-white",
  iconAccent: "text-amber-300",
  active: "text-emerald-700",
};

export default function Navbar({
  search: searchProp = "",
  onSearchChange = () => {},
  onSearchEnter = () => {},
  onProfile = () => (window.location.href = "/profile"),
}) {
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const { currentAddress, setCurrentAddress } = useLocation();

  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [search, setSearch] = useState(searchProp);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const boxRef = useRef(null);
  const inputRef = useRef(null);

  const placeholder = useMemo(() => {
    if (routerLocation.pathname.startsWith("/medicines")) return "Search Medicines";
    if (routerLocation.pathname.startsWith("/doctors")) return "Search Doctors";
    if (routerLocation.pathname.startsWith("/labs")) return "Search Labs";
    return "Search for Medicines, Doctors";
  }, [routerLocation.pathname]);

  const handleAddressChange = (addrObj) => {
    setCurrentAddress(addrObj);
    setLocationModalOpen(false);
  };

  useEffect(() => setSearch(searchProp), [searchProp]);

  useEffect(() => {
    if (!search) {
      setOptions([]);
      setDropdownOpen(false);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const type = routerLocation.pathname.startsWith("/medicines")
          ? "medicine"
          : routerLocation.pathname.startsWith("/doctors")
          ? "doctor"
          : routerLocation.pathname.startsWith("/labs")
          ? "lab"
          : "all";
        const res = await axios.get(
          `${API_BASE_URL}/api/search-autocomplete?q=${encodeURIComponent(search)}&type=${type}`,
          { signal: controller.signal }
        );
        setOptions(res.data || []);
        setDropdownOpen(true);
      } catch {
        if (!controller.signal.aborted) {
          setOptions([]);
          setDropdownOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    const t = setTimeout(load, 160);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [search, routerLocation.pathname]);

  useEffect(() => {
    const onDown = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  const handleInput = (val) => {
    setSearch(val);
    onSearchChange(val);
  };

  const handleSelect = (val) => {
    const v = typeof val === "string" ? val : (val?.label || val?.value || "");
    setSearch(v);
    setDropdownOpen(false);
    if (v) navigate(`/search?q=${encodeURIComponent(v)}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      onSearchEnter(search);
      if (search) navigate(`/search?q=${encodeURIComponent(search)}`);
      setDropdownOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="sticky top-0 z-[1200] w-full" style={{ WebkitTapHighlightColor: "transparent" }}>
      {/* Header: glass + gradient like logo */}
      <div
        className={[
          "relative mx-auto max-w-[520px] rounded-b-3xl",
          "bg-gradient-to-r",
          PALETTE.gradientFrom,
          PALETTE.gradientVia,
          PALETTE.gradientTo,
          "bg-opacity-90 backdrop-blur-xl",
          "shadow-[0_6px_24px_rgba(16,24,40,0.18)]",
          "border",
          PALETTE.surfaceBorder,
        ].join(" ")}
      >
        {/* Subtle top sheen */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 rounded-b-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0))]" />

        {/* Top row: location + profile */}
        <div className="relative flex items-center justify-between px-4 pt-4 pb-3">
          <button
            type="button"
            className="group flex min-w-0 flex-1 items-center gap-2 rounded-2xl"
            onClick={() => {
              if (window?.navigator?.vibrate) navigator.vibrate(8);
              setLocationModalOpen(true);
            }}
          >
            <MapPin className={`h-6 w-6 shrink-0 ${PALETTE.iconAccent}`} />
            <div className="min-w-0">
              <div className="truncate text-[17px] font-extrabold tracking-tight text-white">
                {currentAddress?.formatted
                  ? currentAddress.formatted.length > 40
                    ? currentAddress.formatted.slice(0, 40) + "…"
                    : currentAddress.formatted
                  : "Set delivery location"}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onProfile}
            className={`ml-3 inline-flex h-10 w-10 items-center justify-center rounded-full ${PALETTE.chip} shadow-[0_6px_20px_rgba(16,185,129,0.35)] hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/70`}
            aria-label="Profile"
          >
            <CircleUserRound className="h-6 w-6" />
          </button>
        </div>

        {/* Search bar */}
        <div ref={boxRef} className="relative mx-4 mb-4">
          <div className="flex h-12 items-center rounded-2xl border border-white/70 bg-white/90 px-3 shadow-sm backdrop-blur-md">
            <Search className="mr-2 h-5 w-5 text-zinc-500" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => handleInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => options.length > 0 && setDropdownOpen(true)}
              placeholder={placeholder}
              className="h-full w-full rounded-2xl bg-transparent text-[16.5px] font-semibold tracking-tight text-zinc-800 outline-none placeholder:text-zinc-400"
            />
            {loading && <Loader2 className="ml-1 h-4 w-4 animate-spin text-zinc-500" />}
          </div>

          {/* Autocomplete dropdown (kept simple animation) */}
          <AnimatePresence>
            {dropdownOpen && options.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute left-0 right-0 z-[1300] mt-2 max-h-72 overflow-auto rounded-2xl border border-zinc-200 bg-white shadow-xl"
              >
                {options.map((opt, idx) => {
                  const label =
                    typeof opt === "string"
                      ? opt
                      : opt.label || opt.value || opt.name || "";
                  return (
                    <button
                      key={`${label}-${idx}`}
                      type="button"
                      onClick={() => handleSelect(label)}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[15px] hover:bg-zinc-50"
                    >
                      <Search className="h-4 w-4 text-zinc-500" />
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Location modal (logic unchanged) */}
      <LocationModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onSelect={handleAddressChange}
      />
    </div>
  );
}
