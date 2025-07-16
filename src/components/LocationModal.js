// src/components/LocationModal.js
import React, { useState, useRef, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, CircularProgress, InputAdornment, TextField
} from "@mui/material";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import RoomIcon from "@mui/icons-material/Room";
import { useLocation } from "../context/LocationContext";
import axios from "axios";

export default function LocationModal({ open, onClose, onSelect }) {
  const [input, setInput] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const { setCurrentAddress } = useLocation();

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
  const inputTimer = useRef();

  // --- FIX: Only reset input when modal opens ---
  useEffect(() => {
    if (open) setInput("");
  }, [open]);

  // Autocomplete handler (Google Places API)
  const handleInput = (val) => {
    setInput(val);
    if (inputTimer.current) clearTimeout(inputTimer.current);
    if (!val) {
      setOptions([]);
      return;
    }
    inputTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `${API_BASE_URL}/api/place-autocomplete?input=${encodeURIComponent(val)}`;
        const resp = await axios.get(url);
        setOptions((resp.data.predictions || []));
      } catch {
        setOptions([]);
      }
      setLoading(false);
    }, 300);
  };

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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
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
        <TextField
          fullWidth
          variant="outlined"
          label="Search for address"
          value={input}
          onChange={e => handleInput(e.target.value)}
          autoFocus={open} // Only autofocus on open
          disabled={loading || detecting}
          InputProps={{
            endAdornment: loading
              ? (
                <InputAdornment position="end">
                  <CircularProgress size={18} />
                </InputAdornment>
              ) : null
          }}
        />
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
        {/* Option list */}
        <Box>
          {options.map(option => (
            <Button
              key={option.place_id}
              onClick={() => handleOptionSelect(option)}
              fullWidth
              sx={{
                mt: 2,
                bgcolor: "#eafcf4",
                color: "#13C0A2",
                fontWeight: 700,
                justifyContent: "flex-start",
                textAlign: "left"
              }}
              disabled={loading || detecting}
            >
              {option.description}
            </Button>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" sx={{ fontWeight: 700 }}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
