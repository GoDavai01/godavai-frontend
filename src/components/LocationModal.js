// src/components/LocationModal.js
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, CircularProgress, InputAdornment, TextField, Typography
} from "@mui/material";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import RoomIcon from "@mui/icons-material/Room";
import { useLocation } from "../context/LocationContext";
import Autocomplete from '@mui/material/Autocomplete';
import axios from "axios";

export default function LocationModal({ open, onClose, onSelect }) {
  const [input, setInput] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const { setCurrentAddress } = useLocation();

  // Drop Pin Modal State
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [manualLatLng, setManualLatLng] = useState(null);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
  const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';
  const inputTimer = useRef();

  // This way, only reset when it goes from closed -> open
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      // Only clear on first open, not every time!
      setInput("");
    }
    wasOpen.current = open;
  }, [open]);

  // Detect mobile: full screen dialog for mobile UX
  const isMobile = typeof window !== "undefined" && window.innerWidth < 600;

  // Robust debounced autocomplete handler
  const handleInput = useCallback((val) => {
    setInput(val);
    if (inputTimer.current) clearTimeout(inputTimer.current);

    // Only fetch for 3+ chars
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
    }, 300); // 300ms debounce, feels smooth
  }, [API_BASE_URL]);

  // On option select: fetch full address by place_id
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

  // Live detect address
  const handleDetect = () => {
    setDetecting(true);
    if (!navigator.geolocation) {
      alert("Geolocation not supported!");
      setDetecting(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
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
    }, () => {
      alert("Location detection denied.");
      setDetecting(false);
    });
  };

  // ============ DROP PIN DIALOG MAP LOADER ============
  useEffect(() => {
    if (!showPinDialog) return;
    function renderMap() {
      const mapDiv = document.getElementById("drop-pin-map");
      if (!mapDiv) return;
      // Default: Delhi, else last pin, else try user browser location
      const defaultCenter = manualLatLng || { lat: 28.6139, lng: 77.2090 };
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

      map.addListener("click", (e) => {
        marker.setPosition(e.latLng);
        setManualLatLng({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });

      // Optionally: center on browser location
      if (navigator.geolocation && !manualLatLng) {
        navigator.geolocation.getCurrentPosition(pos => {
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
    // eslint-disable-next-line
  }, [showPinDialog]);

  // ============ MAIN MODAL RENDER ============
  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{
          fontWeight: 800,
          color: "#13C0A2",
          display: "flex",
          alignItems: "center",
          gap: 1
        }}>
          <RoomIcon sx={{ color: "#FFD43B" }} />
          Set Delivery Location
        </DialogTitle>
        <DialogContent>
          {/* ======= REPLACED FIELD/OPTIONS WITH AUTOCOMPLETE ======= */}
          <Autocomplete
            freeSolo
            fullWidth
            autoComplete={false}
            disableClearable
            inputValue={input}
            options={options}
            loading={loading}
            filterOptions={x => x}
            getOptionLabel={opt => opt.description || opt.formatted || ""}
            onInputChange={(e, val) => {
              if (e && e.type === "change") handleInput(val);
            }}
            onChange={(e, value) => {
              if (value && value.place_id) handleOptionSelect(value);
              if (typeof value === "string" && value.length > 2) {
                onSelect({ formatted: value, lat: null, lng: null, place_id: null, manual: true });
              }
            }}
            renderInput={params => (
              <TextField
                {...params}
                label="Search for address"
                variant="outlined"
                autoFocus={open}
                disabled={detecting}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loading ? <CircularProgress size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => (
              <li {...props} style={{ padding: 10 }}>
                <RoomIcon sx={{ color: "#FFD43B", marginRight: 8 }} />
                <span>{option.description}</span>
              </li>
            )}
          />
          {/* ======= /REPLACED ======= */}

          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<MyLocationIcon />}
              fullWidth
              onClick={handleDetect}
              disabled={detecting}
              sx={{ fontWeight: 700, color: "#13C0A2", borderColor: "#13C0A2" }}
            >
              {detecting ? "Detecting..." : "Use My Current Location"}
            </Button>
          </Box>
          {/* Manual Entry / Drop Pin Options */}
          <Box>
            {input.length >= 3 && (
              <>
                <Button
                  fullWidth
                  onClick={() => setShowPinDialog(true)}
                  sx={{
                    mt: 2,
                    bgcolor: "#fffbe6",
                    color: "#ff9800",
                    fontWeight: 700,
                    border: "2px dashed #ffd43b",
                    justifyContent: "flex-start",
                    textAlign: "left",
                    "&:hover": { bgcolor: "#fff3c4" }
                  }}
                  disabled={loading || detecting}
                >
                  Didn’t find your place? <b>Drop Pin on Map</b>
                </Button>
                <Button
                  fullWidth
                  onClick={() => {
                    onSelect({ formatted: input, lat: null, lng: null, place_id: null, manual: true });
                  }}
                  sx={{
                    mt: 1,
                    bgcolor: "#fffbe6",
                    color: "#1976d2",
                    fontWeight: 700,
                    border: "2px dashed #dbeafe",
                    justifyContent: "flex-start",
                    textAlign: "left",
                    "&:hover": { bgcolor: "#e3f0fd" }
                  }}
                  disabled={loading || detecting}
                >
                  Add "<u>{input}</u>" manually (without pin)
                </Button>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="primary" sx={{ fontWeight: 700 }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* --- DROP PIN DIALOG --- */}
      <Dialog open={showPinDialog} onClose={() => setShowPinDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: "#13C0A2" }}>
          <RoomIcon sx={{ color: "#FFD43B", mr: 1 }} />
          Drop Pin for Delivery Location
        </DialogTitle>
        <DialogContent>
          <Box sx={{ width: "100%", height: 300, borderRadius: 2, mb: 2, boxShadow: "0 1px 7px #eee" }}>
            <div id="drop-pin-map" style={{ width: "100%", height: 300 }} />
          </Box>
          <Typography fontSize={14} color="text.secondary">
            Drag the pin or tap to select your exact entrance/location.
          </Typography>
          {manualLatLng &&
            <Typography variant="body2" sx={{ mt: 1, color: "#607d8b" }}>
              Pin location: {manualLatLng.lat.toFixed(6)}, {manualLatLng.lng.toFixed(6)}
            </Typography>
          }
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPinDialog(false)} color="primary">Cancel</Button>
          <Button
            onClick={() => {
              setShowPinDialog(false);
              onSelect({
                formatted: input, // use the search bar value or prompt user for address line
                lat: manualLatLng?.lat,
                lng: manualLatLng?.lng,
                place_id: null,
                manual: true,
              });
            }}
            disabled={!manualLatLng}
            variant="contained"
            sx={{ fontWeight: 700 }}
          >
            Save Location
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
