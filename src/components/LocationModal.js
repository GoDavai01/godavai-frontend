import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { MapPin, LocateFixed, X } from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";

// Headless modal with top-right close + Back button support.
// IMPORTANT: uses inline style zIndex so nested modal stacks above.
function Modal({ open, onClose, children, maxWidth = "max-w-sm", zIndex = 2600 }) {
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
    <div className="fixed inset-0" style={{ zIndex: zIndex }}>
      <div className="absolute inset-0 pointer-events-none" />
      <div className="absolute inset-0 overflow-y-auto p-4 grid place-items-center">
        <AnimatePresence initial>
          <motion.div
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

export default function LocationModal({ open, onClose, onSelect }) {
  const [input, setInput] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const [showPinDialog, setShowPinDialog] = useState(false);
  const [manualLatLng, setManualLatLng] = useState(null);

  const inputTimer = useRef();
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) setInput("");
    wasOpen.current = open;
  }, [open]);

  const handleInput = useCallback((val) => {
    setInput(val);
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
    }, 300);
  }, []);

  const handleOptionSelect = async (option) => {
    setLoading(true);
    try {
      const detailsUrl = `${API_BASE_URL}/api/place-details?place_id=${option.place_id}`;
      const resp = await axios.get(detailsUrl);
      const result = resp.data.result;
      const formatted = result.formatted_address;
      const lat = result.geometry.location.lat;
      const lng = result.geometry.location.lng;
      onSelect({ formatted, lat, lng, place_id: option.place_id });
    } catch {
      alert("Could not get address details.");
    }
    setLoading(false);
  };

  const handleDetect = () => {
    setDetecting(true);
    if (!navigator.geolocation) {
      alert("Geolocation not supported!");
      setDetecting(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const url = `${API_BASE_URL}/api/geocode?lat=${lat}&lng=${lng}`;
          const res = await axios.get(url);
          const place = res.data.results[0];
          if (place) {
            onSelect({
              formatted: place.formatted_address,
              lat,
              lng,
              place_id: place.place_id,
            });
          } else {
            alert("Could not detect address.");
          }
        } catch {
          alert("Could not detect address.");
        }
        setDetecting(false);
      },
      () => {
        alert("Location detection denied.");
        setDetecting(false);
      }
    );
  };

  useEffect(() => {
    if (!showPinDialog) return;
    function renderMap() {
      const mapDiv = document.getElementById("drop-pin-map");
      if (!mapDiv) return;
      const defaultCenter = manualLatLng || { lat: 28.6139, lng: 77.209 };
      const map = new window.google.maps.Map(mapDiv, {
        center: defaultCenter,
        zoom: 16,
        streetViewControl: false,
        mapTypeControl: false,
      });
      let marker = new window.google.maps.Marker({
        position: defaultCenter,
        map,
        draggable: true,
        title: "Drag to your entrance",
      });
      setManualLatLng(defaultCenter);

      marker.addListener("dragend", (e) => {
        const { latLng } = e;
        setManualLatLng({ lat: latLng.lat(), lng: latLng.lng() });
      });

      map.addEventListener?.("click", (e) => {
        marker.setPosition(e.latLng);
        setManualLatLng({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });

      if (navigator.geolocation && !manualLatLng) {
        navigator.geolocation.getCurrentPosition((pos) => {
          const userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          map.setCenter(userLoc);
          marker.setPosition(userLoc);
          setManualLatLng(userLoc);
        });
      }
    }

    if (!window.google || !window.google.maps) {
      const scriptId = "gmapjs";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
        script.async = true;
        script.onload = renderMap;
        document.body.appendChild(script);
      } else {
        document.getElementById(scriptId).addEventListener("load", renderMap);
      }
    } else {
      renderMap();
    }
  }, [showPinDialog, manualLatLng]);

  return (
    <>
      {/* Main search modal */}
      <Modal open={open} onClose={onClose} maxWidth="max-w-sm" zIndex={2600}>
        <div className="px-5 pt-5 pb-3 border-b border-zinc-100">
          <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-5 w-5 text-amber-500" />
            Set Delivery Location
          </h3>
        </div>

        <div className="px-5 pb-3 pt-3 space-y-3">
          <div className="relative">
            <input
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              placeholder="Search for address"
              value={input}
              onChange={(e) => handleInput(e.target.value)}
              autoFocus={open}
              disabled={detecting}
            />
            {loading && (
              <div className="absolute right-3 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
            )}
          </div>

          {options.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white shadow-lg max-h-56 overflow-auto">
              {options.map((opt) => (
                <button
                  key={opt.place_id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex gap-2"
                  onClick={() => handleOptionSelect(opt)}
                >
                  <MapPin className="h-4 w-4 text-amber-500 mt-0.5" />
                  <span className="truncate">{opt.description}</span>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleDetect}
            disabled={detecting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-teal-500/30 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-60"
          >
            <LocateFixed className="h-4 w-4" />
            {detecting ? "Detecting..." : "Use My Current Location"}
          </button>

          {input.length >= 3 && (
            <button
              type="button"
              onClick={() => setShowPinDialog(true)}
              disabled={loading || detecting}
              className="w-full text-left rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-700"
            >
              Didn’t find your place? <b>Drop Pin on Map</b>
            </button>
          )}
        </div>
      </Modal>

      {/* Drop-pin mini modal (zIndex HIGHER so it stacks above) */}
      <Modal
        open={showPinDialog}
        onClose={() => setShowPinDialog(false)}
        maxWidth="max-w-sm"
        zIndex={2700}
      >
        <div className="px-5 pt-5 pb-3 border-b border-zinc-100">
          <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-5 w-5 text-amber-500" />
            Drop Pin for Delivery Location
          </h3>
        </div>

        <div className="px-5 pb-4 pt-3 space-y-3">
          <div className="w-full h-72 rounded-xl border border-zinc-200 shadow-sm">
            <div id="drop-pin-map" className="w-full h-72 rounded-xl" />
          </div>
          {manualLatLng && (
            <p className="text-xs text-zinc-600">
              Pin location: {manualLatLng.lat.toFixed(6)}, {manualLatLng.lng.toFixed(6)}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowPinDialog(false)}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!manualLatLng}
              onClick={() => {
                setShowPinDialog(false);
                onSelect({
                  formatted: input,
                  lat: manualLatLng?.lat,
                  lng: manualLatLng?.lng,
                  place_id: null,
                  manual: true,
                });
              }}
              className="rounded-lg px-3 py-2 text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
            >
              Save Location
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
