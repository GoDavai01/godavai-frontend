// src/components/AddressForm.jsx
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { MapPin, LocateFixed, X } from "lucide-react";
import { useLocation } from "../context/LocationContext";
// ✅ use the shared loader (no direct script tags, no hard-coded key)
import { loadGoogleMaps } from "../utils/googleMaps";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

// Deep-green brand tone
const DEEP = "#0f6e51";

/* --------------------------- Headless Modal --------------------------- */
function Modal({ open, onClose, children, maxWidth = "max-w-md", zIndex = 2600 }) {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => e.key === "Escape" && safeClose();
    const onPop = () => onClose?.();

    document.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);

    try {
      window.history.pushState({ modal: "stack" }, "");
      pushedRef.current = true;
    } catch {}

    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const safeClose = () => {
    onClose?.();
    if (pushedRef.current) {
      try {
        window.history.back();
      } catch {}
      pushedRef.current = false;
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex }}>
      <div className="absolute inset-0 pointer-events-none" />
      <div className="absolute inset-0 overflow-y-auto p-4 grid place-items-center">
        <AnimatePresence initial>
          <motion.div
            key="address-modal"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`relative w-full ${maxWidth}`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl shadow-2xl border" style={{ borderColor: "#e5e7eb" }}>
              <button
                type="button"
                aria-label="Close"
                onClick={safeClose}
                className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white/90 hover:bg-zinc-50 shadow-sm"
                style={{ borderColor: "#e5e7eb" }}
              >
                <X className="h-5 w-5" style={{ color: "#6b7280" }} />
              </button>
              {children}
              <div className="px-5 pb-4 -mt-2">
                <button
                  type="button"
                  onClick={safeClose}
                  className="w-full rounded-xl bg-white py-2 text-sm font-bold hover:bg-gray-50"
                  style={{ color: DEEP, border: `1px solid ${DEEP}66` }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>,
    document.body
  );
}

/* --------------------------- Address Form --------------------------- */
export default function AddressForm({
  open,
  onClose,
  onSave,
  initial = {},
  modalZIndex = 3300,
}) {
  const [type, setType] = useState(initial.type || "Home");
  const [name, setName] = useState(initial.name || "");
  const [phone, setPhone] = useState(initial.phone || "");
  const [addressLine, setAddressLine] = useState(initial.addressLine || "");
  const [input, setInput] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const { currentAddress } = useLocation();
  const [floor, setFloor] = useState(initial.floor || "");

  const [selectedPlace, setSelectedPlace] = useState(
    initial.place_id
      ? {
          formatted: initial.formatted,
          lat: initial.lat,
          lng: initial.lng,
          place_id: initial.place_id,
        }
      : null
  );
  const [pin, setPin] = useState(
    initial.lat && initial.lng ? { lat: initial.lat, lng: initial.lng } : null
  );

  const inputTimer = useRef();
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapDivRef = useRef(null);

  // sync on open / initial
  useEffect(() => {
    setType(initial.type || "Home");
    setName(initial.name || "");
    setPhone(initial.phone || "");
    setAddressLine(initial.addressLine || initial.formatted || "");
    setInput(initial.formatted || "");
    setSelectedPlace(
      initial.place_id
        ? {
            formatted: initial.formatted,
            lat: initial.lat,
            lng: initial.lng,
            place_id: initial.place_id,
          }
        : null
    );
    setPin(initial.lat && initial.lng ? { lat: initial.lat, lng: initial.lng } : null);
  }, [open, initial]);

  // search -> backend proxy (unchanged)
  const handleInput = (val) => {
    setInput(val);
    setSelectedPlace(null);
    setPin(null);
    if (inputTimer.current) clearTimeout(inputTimer.current);
    if (!val || val.length < 3) {
      setOptions([]);
      return;
    }
    inputTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `${API_BASE_URL}/api/place-autocomplete?input=${encodeURIComponent(val)}`;
        const resp = await axios.get(url);
        setOptions(resp.data.predictions || []);
      } catch {
        setOptions([]);
      }
      setLoading(false);
    }, 350);
  };

  const handleOptionSelect = async (option) => {
    setLoading(true);
    try {
      const detailsUrl = `${API_BASE_URL}/api/place-details?place_id=${option.place_id}`;
      const resp = await axios.get(detailsUrl);
      const result = resp.data.result;
      setInput(result.formatted_address);
      setAddressLine(result.formatted_address);
      setSelectedPlace({
        formatted: result.formatted_address,
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        place_id: option.place_id,
      });
      setPin({
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
      });
    } catch {
      alert("Could not fetch address details");
    }
    setLoading(false);
    setOptions([]);
  };

  // ✅ Map init/update using loader util
  useEffect(() => {
    if (!open || !pin) return;

    let googleCache;
    let map = mapRef.current;
    let marker = markerRef.current;

    loadGoogleMaps() // default libraries include 'places'; fine here
      .then((google) => {
        googleCache = google;
        const div = mapDivRef.current;
        if (!div) return;

        if (!map) {
          map = new google.maps.Map(div, {
            center: pin,
            zoom: 17,
            streetViewControl: false,
            mapTypeControl: false,
          });
          mapRef.current = map;
        } else {
          map.setCenter(pin);
        }

        if (!marker) {
          marker = new google.maps.Marker({
            position: pin,
            map,
            draggable: true,
            title: "Move pin to exact location",
          });
          marker.addListener("dragend", (e) => {
            const { latLng } = e;
            setPin({ lat: latLng.lat(), lng: latLng.lng() });
          });
          markerRef.current = marker;
        } else {
          marker.setPosition(pin);
        }
      })
      .catch((e) => {
        console.error("Google Maps failed to load:", e);
      });

    // no special cleanup needed beyond refs; component unmount will drop map
  }, [open, pin]);

  const handleSave = () => {
    if (!name || !phone || !addressLine || !selectedPlace || !pin) return;
    onSave({
      type,
      name,
      phone,
      addressLine,
      floor,
      ...selectedPlace,
      lat: pin.lat,
      lng: pin.lng,
      id: initial.id || Date.now(),
    });
  };

  return (
    <Modal open={open} onClose={onClose} zIndex={modalZIndex}>
      <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: "#f1f5f9" }}>
        <h3 className="text-lg font-extrabold tracking-tight" style={{ color: DEEP }}>
          Add/Edit Address
        </h3>
      </div>

      <div className="px-5 pb-3 pt-3 space-y-3">
        <button
          type="button"
          onClick={() => {
            if (currentAddress && currentAddress.lat && currentAddress.lng) {
              setInput(currentAddress.formatted || "");
              setAddressLine(currentAddress.formatted || "");
              setSelectedPlace({
                formatted: currentAddress.formatted,
                lat: currentAddress.lat,
                lng: currentAddress.lng,
                place_id: currentAddress.place_id,
              });
              setPin({ lat: currentAddress.lat, lng: currentAddress.lng });
            }
          }}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold bg-white"
          style={{ color: DEEP, border: `1px solid ${DEEP}55` }}
        >
          <LocateFixed className="h-4 w-4" style={{ color: DEEP }} />
          Use My Current Location
        </button>

        <div className="flex gap-2">
          {["Home", "Work", "Other"].map((t) => {
            const selected = type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className="rounded-xl px-3 py-2 text-sm font-medium border transition bg-white"
                style={
                  selected
                    ? {
                        background: "rgba(15,110,81,.08)",
                        borderColor: "rgba(15,110,81,.45)",
                        color: DEEP,
                        fontWeight: 700,
                      }
                    : { borderColor: "#e5e7eb", color: "#374151" }
                }
              >
                {t}
              </button>
            );
          })}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold" style={{ color: "#475569" }}>
            Name
          </label>
          <input
            className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ borderColor: "#e5e7eb", boxShadow: "none" }}
            onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(15,110,81,.25)")}
            onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold" style={{ color: "#475569" }}>
            Phone
          </label>
          <input
            className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ borderColor: "#e5e7eb", boxShadow: "none" }}
            onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(15,110,81,.25)")}
            onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))}
            maxLength={15}
            placeholder="+91…"
          />
        </div>

        <div className="space-y-1 relative">
          <label className="text-xs font-semibold flex items-center gap-1" style={{ color: "#475569" }}>
            <MapPin className="h-4 w-4" style={{ color: DEEP }} />
            <span>Address (Search Google Maps)</span>
          </label>
          <input
            className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ borderColor: "#e5e7eb", boxShadow: "none" }}
            onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(15,110,81,.25)")}
            onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
            value={input}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search address"
            autoFocus
          />
          {loading && (
            <div
              className="absolute right-3 top-9 h-4 w-4 animate-spin rounded-full border-2"
              style={{ borderColor: "#e5e7eb", borderTopColor: "#52525b" }}
            />
          )}

          {options.length > 0 && (
            <div
              className="absolute z-10 mt-1 w-full rounded-xl bg-white shadow-lg max-h-56 overflow-auto border"
              style={{ borderColor: "#e5e7eb" }}
            >
              {options.map((o) => (
                <button
                  key={o.place_id}
                  type="button"
                  onClick={() => handleOptionSelect(o)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50"
                >
                  {o.description}
                </button>
              ))}
            </div>
          )}

          {selectedPlace && (
            <p className="text-[11px] pt-1" style={{ color: "#6b7280" }}>
              Selected: {selectedPlace.formatted}
            </p>
          )}
        </div>

        {pin && (
          <div className="space-y-2">
            {/* 🔁 map target */}
            <div
              ref={mapDivRef}
              id="map-preview"
              className="w-full h-64 rounded-xl border shadow-sm"
              style={{ borderColor: "#e5e7eb" }}
            />
            <p className="text-center text-xs" style={{ color: "#6b7280" }}>
              Drag the pin if needed to your exact entrance!
            </p>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-semibold" style={{ color: "#475569" }}>
            Floor/House No.
          </label>
          <input
            className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ borderColor: "#e5e7eb", boxShadow: "none" }}
            onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(15,110,81,.25)")}
            onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            placeholder="E.g., Ground, Flat 2B"
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!name || !phone || !addressLine || !selectedPlace || !pin}
          className="w-full rounded-xl text-white font-bold py-2.5 shadow hover:brightness-105 disabled:opacity-50"
          style={{ backgroundColor: DEEP }}
        >
          Save Address
        </button>
      </div>
    </Modal>
  );
}
