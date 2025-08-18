import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { MapPin, LocateFixed, X } from "lucide-react";
import { useLocation } from "../context/LocationContext";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const GOOGLE_MAPS_API_KEY =
  process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "AIzaSyCd9Jkk_kd0SwaDLKwehdTpowiHEAnuy8Y";

// Headless modal (no backdrop). Includes close icon + Back-button-to-close.
// IMPORTANT: uses inline style zIndex so it stacks above parent modals.
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
            <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200">
              <button
                type="button"
                aria-label="Close"
                onClick={safeClose}
                className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white/90 hover:bg-zinc-50 shadow-sm"
              >
                <X className="h-5 w-5 text-zinc-600" />
              </button>
              {children}
              <div className="px-5 pb-4 -mt-2">
                <button
                  type="button"
                  onClick={safeClose}
                  className="w-full rounded-xl border border-zinc-200 bg-white py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
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

export default function AddressForm({ open, onClose, onSave, initial = {}, modalZIndex = 3300, // > Dialog overlay (3000) and content (3001) 
  }) {
  const [type, setType] = useState(initial.type || "Home");
  const [name, setName] = useState(initial.name || "");
  const [phone, setPhone] = useState(initial.phone || "");
  const [addressLine, setAddressLine] = useState(initial.addressLine || "");
  const [input, setInput] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
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
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    setType(initial.type || "Home");
    setName(initial.name || "");
    setPhone(initial.phone || "");
    setAddressLine(initial.addressLine || "");
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

  function loadScript(src, onLoad) {
    if (document.querySelector(`script[src="${src}"]`)) {
      if (window.google && window.google.maps) onLoad();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = onLoad;
    document.body.appendChild(script);
  }

  useEffect(() => {
    if (open && GOOGLE_MAPS_API_KEY && !scriptLoadedRef.current) {
      loadScript(
        `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`,
        () => setScriptReady(true)
      );
      scriptLoadedRef.current = true;
    } else if (window.google && window.google.maps) {
      setScriptReady(true);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !pin || !scriptReady) return;
    let tries = 0;
    const maxTries = 25;
    const interval = setInterval(() => {
      const mapDiv = document.getElementById("map-preview");
      if (mapDiv && window.google && window.google.maps) {
        clearInterval(interval);
        let map = mapRef.current;
        if (!map) {
          map = new window.google.maps.Map(mapDiv, {
            center: pin,
            zoom: 17,
            streetViewControl: false,
            mapTypeControl: false,
          });
          mapRef.current = map;
        } else {
          map.setCenter(pin);
        }
        if (!markerRef.current) {
          markerRef.current = new window.google.maps.Marker({
            position: pin,
            map,
            draggable: true,
            title: "Move pin to exact location",
          });
          markerRef.current.addListener("dragend", (e) => {
            const { latLng } = e;
            setPin({ lat: latLng.lat(), lng: latLng.lng() });
          });
        } else {
          markerRef.current.setPosition(pin);
        }
      }
      tries++;
      if (tries > maxTries) clearInterval(interval);
    }, 80);
    return () => clearInterval(interval);
  }, [open, pin, scriptReady]);

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
      <div className="px-5 pt-5 pb-3 border-b border-zinc-100">
        <h3 className="text-lg font-bold tracking-tight">Add/Edit Address</h3>
      </div>

      <div className="px-5 pb-3 pt-3 space-y-3">
        <button
          type="button"
          onClick={() => {
            if (currentAddress && currentAddress.lat && currentAddress.lng) {
              setInput(currentAddress.formatted || "");
              setSelectedPlace({
                formatted: currentAddress.formatted,
                lat: currentAddress.lat,
                lng: currentAddress.lng,
                place_id: currentAddress.place_id,
              });
              setPin({ lat: currentAddress.lat, lng: currentAddress.lng });
            }
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-teal-500/30 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50"
        >
          <LocateFixed className="h-4 w-4" />
          Use My Current Location
        </button>

        <div className="flex gap-2">
          {["Home", "Work", "Other"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-xl px-3 py-2 text-sm font-medium border transition ${
                type === t
                  ? "bg-amber-50 border-amber-300 text-amber-800"
                  : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-600">Name</label>
          <input
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-600">Phone</label>
          <input
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))}
            maxLength={15}
            placeholder="+91…"
          />
        </div>

        <div className="space-y-1 relative">
          <label className="text-xs font-semibold text-zinc-600 flex items-center gap-1">
            <MapPin className="h-4 w-4 text-teal-600" />
            <span>Address (Search Google Maps)</span>
          </label>
          <input
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            value={input}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search address"
            autoFocus
          />
          {loading && (
            <div className="absolute right-3 top-9 h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          )}

          {options.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg max-h-56 overflow-auto">
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
            <p className="text-[11px] text-zinc-500 pt-1">Selected: {selectedPlace.formatted}</p>
          )}
        </div>

        {pin && (
          <div className="space-y-2">
            <div id="map-preview" className="w-full h-64 rounded-xl border border-zinc-200 shadow-sm" />
            <p className="text-center text-xs text-zinc-500">
              Drag the pin if needed to your exact entrance!
            </p>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-semibold text-zinc-600">Floor/House No.</label>
          <input
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            placeholder="E.g., Ground, Flat 2B"
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!name || !phone || !addressLine || !selectedPlace || !pin}
          className="w-full rounded-xl bg-teal-600 text-white font-semibold py-2.5 shadow hover:bg-teal-700 disabled:opacity-50"
        >
          Save Address
        </button>
      </div>
    </Modal>
  );
}
