import React, { useState, useEffect, useRef } from "react";
import {
  Dialog, DialogTitle, DialogContent, TextField, Button, Stack, ToggleButtonGroup, ToggleButton, Box
} from "@mui/material";
import RoomIcon from "@mui/icons-material/Room";
import CircularProgress from "@mui/material/CircularProgress";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY; // <-- production key from env

export default function AddressForm({ open, onClose, onSave, initial = {} }) {
  const [type, setType] = useState(initial.type || "Home");
  const [name, setName] = useState(initial.name || "");
  const [phone, setPhone] = useState(initial.phone || "");
  const [addressLine, setAddressLine] = useState(initial.addressLine || "");
  const [input, setInput] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);

  // Pin/map stuff
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
    initial.lat && initial.lng
      ? { lat: initial.lat, lng: initial.lng }
      : null
  );

  const inputTimer = useRef();
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const scriptLoadedRef = useRef(false);

  // Populate initial on open
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

  // --- Autocomplete search ---
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

  // On option select: fetch full place details and set pin on map
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

  // Load Google Maps script if not present
  function loadScript(src, onLoad) {
  if (document.querySelector(`script[src="${src}"]`)) {
    // Already present, check if window.google is there
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

  // Draw map and marker when pin changes
  useEffect(() => {
  if (!open || !pin || !scriptReady) return;

  const interval = setInterval(() => {
    const mapDiv = document.getElementById("map-preview");
    if (mapDiv && mapDiv.offsetHeight > 0 && window.google && window.google.maps) {
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
  }, 80);

  return () => clearInterval(interval);
}, [open, pin, scriptReady]);

  // Save handler
  const handleSave = () => {
    if (!name || !phone || !addressLine || !selectedPlace || !pin) return;
    onSave({
      type,
      name,
      phone,
      addressLine,
      ...selectedPlace,
      lat: pin.lat,
      lng: pin.lng,
      id: initial.id || Date.now(),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add/Edit Address</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <ToggleButtonGroup value={type} exclusive onChange={(_, t) => t && setType(t)}>
            <ToggleButton value="Home">Home</ToggleButton>
            <ToggleButton value="Work">Work</ToggleButton>
            <ToggleButton value="Other">Other</ToggleButton>
          </ToggleButtonGroup>
          <TextField label="Name" fullWidth value={name} onChange={e => setName(e.target.value)} />
          <TextField
            label="Phone"
            fullWidth
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/[^\d+]/g, ""))}
            inputProps={{ maxLength: 15, pattern: "[0-9+ ]*" }}
          />
          <TextField
            label="Address (Search Google Maps)"
            fullWidth
            value={input}
            onChange={e => handleInput(e.target.value)}
            InputProps={{
              startAdornment: <RoomIcon sx={{ mr: 1, color: "#31c48d" }} />,
              endAdornment: loading ? <CircularProgress size={16} sx={{ ml: 1 }} /> : null
            }}
            autoFocus
            helperText={selectedPlace ? "Selected: " + selectedPlace.formatted : ""}
          />
          {options.length > 0 && (
            <Box sx={{ mt: 1, bgcolor: "#f6f8fa", borderRadius: 2 }}>
              {options.map(option => (
                <Button
                  key={option.place_id}
                  onClick={() => handleOptionSelect(option)}
                  fullWidth
                  sx={{
                    justifyContent: "flex-start",
                    textAlign: "left",
                    py: 1.2,
                    color: "#17879c"
                  }}
                >
                  {option.description}
                </Button>
              ))}
            </Box>
          )}
          {/* Pin on map preview */}
          {pin && (
            <Box sx={{ mt: 2, mb: 1 }}>
              <div
                id="map-preview"
                style={{ width: "100%", height: 260, borderRadius: 10, boxShadow: "0 1px 4px #ddd" }}
              />
              <Box sx={{ textAlign: "center", mt: 1, fontSize: 13, color: "#888" }}>
                Drag the pin if needed to your exact entrance!
              </Box>
            </Box>
          )}
          <TextField
            label="Flat/House No., Building (optional)"
            fullWidth
            value={addressLine}
            onChange={e => setAddressLine(e.target.value)}
            placeholder="E.g., Flat 2B, Sunrise Apartments"
          />
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!name || !phone || !addressLine || !selectedPlace || !pin}
          >
            Save Address
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
