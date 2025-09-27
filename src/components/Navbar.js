// src/components/Navbar.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation as useRouterLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, CircleUserRound, Search, Loader2 } from "lucide-react";
import LocationModal from "./LocationModal";
import { useLocation } from "../context/LocationContext";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

/** Brand palette (solid dark green) */
const BRAND = {
  bg: "bg-[var(--brand-green)]",
  border: "border-[color:rgba(255,255,255,0.20)]",
  ring: "focus-visible:ring-[color:rgba(255,255,255,0.75)]",
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

  const [pharmacyName, setPharmacyName] = useState("");

  const boxRef = useRef(null);
  const inputRef = useRef(null);

  // Detect if we're on /medicines/:pharmacyId and capture that id
  const activePharmacyId = useMemo(() => {
    const m = routerLocation.pathname.match(/^\/medicines\/([a-fA-F0-9]{24})/);
    return m?.[1] || null;
  }, [routerLocation.pathname]);

  // Load pharmacy name when on a pharmacy page (for placeholder)
  useEffect(() => {
    let cancel = false;
    async function run() {
      if (!activePharmacyId) {
        setPharmacyName("");
        return;
      }
      try {
        const r = await axios.get(`${API_BASE_URL}/api/pharmacies`, { params: { id: activePharmacyId } });
        const ph = Array.isArray(r.data) ? r.data[0] : null;
        if (!cancel) setPharmacyName(ph?.name || "");
      } catch {
        if (!cancel) setPharmacyName("");
      }
    }
    run();
    return () => { cancel = true; };
  }, [activePharmacyId]);

  // Dynamic placeholder text
  const placeholder = useMemo(() => {
    if (routerLocation.pathname.startsWith("/medicines")) {
      return pharmacyName ? `Search ${pharmacyName}` : "Search this pharmacy";
    }
    if (routerLocation.pathname.startsWith("/doctors")) return "Search Doctors";
    if (routerLocation.pathname.startsWith("/labs")) return "Search Labs";
    return "Search Medicines";
  }, [routerLocation.pathname, pharmacyName]);

  const handleAddressChange = (addrObj) => {
    setCurrentAddress(addrObj);
    setLocationModalOpen(false);
  };

  useEffect(() => setSearch(searchProp), [searchProp]);

  // Autocomplete (scoped to pharmacy when on its page)
  useEffect(() => {
    if (!search) {
      setOptions([]);
      setDropdownOpen(false);
      return;
    }
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      const type = routerLocation.pathname.startsWith("/medicines")
        ? "medicine"
        : routerLocation.pathname.startsWith("/doctors")
        ? "doctor"
        : routerLocation.pathname.startsWith("/labs")
        ? "lab"
        : "all";

      const tryReq = async (url, params) =>
        axios.get(url, { params, signal: controller.signal }).then((r) => r.data);

      try {
        // Rich medicines autocomplete (name/brand/company/composition/category)
        if (type === "medicine" || type === "all") {
          const city = (currentAddress?.city || "").trim();
          const data = await tryReq(`${API_BASE_URL}/api/medicines/autocomplete`, {
            q: search,
            city,
            limit: 12,
            pharmacyId: activePharmacyId || undefined, // <-- scope when on a pharmacy
          });
          setOptions(data || []);
          setDropdownOpen(true);
          return;
        }

        // Non-medicine routes: legacy autocomplete
        const city = (currentAddress?.city || "").trim();
        const data = await tryReq(`${API_BASE_URL}/api/search/search-autocomplete`, {
          q: search,
          type,
          city,
        });
        setOptions(data || []);
        setDropdownOpen(true);
      } catch (e1) {
        try {
          // Alt legacy route
          const data = await tryReq(`${API_BASE_URL}/api/search/autocomplete`, {
            q: search,
            type,
          });
          setOptions(data || []);
          setDropdownOpen(true);
        } catch (e2) {
          // Final safe fallback for medicines: names from /medicines/search
          if (type === "medicine" || type === "all") {
            try {
              const meds = await tryReq(`${API_BASE_URL}/api/medicines/search`, {
                q: search,
                pharmacyId: activePharmacyId || undefined,
              });
              const names = Array.from(new Set((meds || []).map((m) => m.name))).slice(0, 10);
              setOptions(names);
              setDropdownOpen(true);
            } catch {
              setOptions([]);
              setDropdownOpen(false);
            }
          } else {
            setOptions([]);
            setDropdownOpen(false);
          }
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
  }, [search, routerLocation.pathname, currentAddress?.city, activePharmacyId]);

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
    const v = typeof val === "string" ? val : val?.label || val?.value || "";
    setSearch(v);
    setDropdownOpen(false);
    if (v) {
      const pid = activePharmacyId ? `&pharmacyId=${activePharmacyId}` : "";
      navigate(`/search?q=${encodeURIComponent(v)}${pid}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      onSearchEnter(search);
      if (search) {
        const pid = activePharmacyId ? `&pharmacyId=${activePharmacyId}` : "";
        navigate(`/search?q=${encodeURIComponent(search)}${pid}`);
      }
      setDropdownOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="sticky top-0 z-[1200] w-full" style={{ WebkitTapHighlightColor: "transparent" }}>
      {/* Solid dark-green bar with bold white text */}
      <div
        className={[
          "relative mx-auto max-w-[520px] rounded-b-3xl",
          BRAND.bg,
          "backdrop-blur-xl",
          "shadow-[0_6px_24px_rgba(16,24,40,0.18)]",
          "border",
          BRAND.border,
          "text-white",
        ].join(" ")}
      >
        {/* Subtle top sheen */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 rounded-b-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0))]" />

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
            <MapPin className="h-6 w-6 shrink-0 text-white" />
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
            className={[
              "ml-3 inline-flex h-10 w-10 items-center justify-center rounded-full",
              "bg-white/15 text-white",
              "border border-white/30",
              "shadow-[0_6px_20px_rgba(0,0,0,0.25)]",
              "hover:bg-white/20 focus:outline-none",
              "focus-visible:ring-2",
              BRAND.ring,
            ].join(" ")}
            aria-label="Profile"
          >
            <CircleUserRound className="h-6 w-6" />
          </button>
        </div>

        {/* Search bar */}
        <div ref={boxRef} className="relative mx-4 mb-4">
          <div className="flex h-12 items-center rounded-2xl border border-white/60 bg-white/95 px-3 shadow-sm backdrop-blur-md">
            <Search className="mr-2 h-5 w-5 text-zinc-600" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => handleInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => options.length > 0 && setDropdownOpen(true)}
              placeholder={placeholder}
              className="h-full w-full rounded-2xl bg-transparent text-[16.5px] font-semibold tracking-tight text-zinc-800 outline-none placeholder:text-zinc-400"
            />
            {loading && <Loader2 className="ml-1 h-4 w-4 animate-spin text-zinc-600" />}
            {/* Tiny scope badge when on a pharmacy page */}
            {activePharmacyId && !loading && (
              <span className="ml-2 hidden sm:inline rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                This pharmacy
              </span>
            )}
          </div>

          {/* Autocomplete dropdown */}
          <AnimatePresence>
            {dropdownOpen && options.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute left-0 right-0 z-[1300] mt-2 max-h-72 overflow-auto rounded-2xl border border-zinc-200 bg-white text-zinc-800 shadow-xl"
              >
                {options
                  .map((opt) =>
                    typeof opt === "string" ? opt : opt?.label || opt?.value || opt?.name || ""
                  )
                  .filter((label) => label && label.trim().length > 0)
                  .filter((label, i, arr) => arr.indexOf(label) === i)
                  .slice(0, 10)
                  .map((label, idx) => (
                    <button
                      key={`${label}-${idx}`}
                      type="button"
                      onClick={() => handleSelect(label)}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[15px] text-zinc-800 hover:bg-zinc-50"
                    >
                      <Search className="h-4 w-4 text-zinc-500" />
                      <span className="truncate text-zinc-800">{label}</span>
                    </button>
                  ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Location modal */}
      <LocationModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onSelect={handleAddressChange}
      />
    </div>
  );
}
