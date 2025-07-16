// src/components/Navbar.js
import React, { useState, useEffect } from "react";
import {
  Box, IconButton, Avatar, Typography, CircularProgress, Tooltip, Button
} from "@mui/material";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import SearchIcon from "@mui/icons-material/Search";
import PersonIcon from "@mui/icons-material/Person";
import { useNavigate, useLocation as useRouterLocation } from "react-router-dom";
import LocationModal from "./LocationModal";
import { useLocation } from "../context/LocationContext";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export default function Navbar({
  search: searchProp = "",
  onSearchChange = () => {},
  onSearchEnter = () => {},
  onProfile = () => window.location.href = "/profile"
}) {
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();

  // Use context for current address!
  const { currentAddress, setCurrentAddress } = useLocation();

  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  // Search bar state
  const [search, setSearch] = useState(searchProp);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // When user updates their address in modal
  const handleAddressChange = (addrObj) => {
    setCurrentAddress(addrObj); // Handles localStorage and context
    setLocationModalOpen(false);
  };

  // Auto-detect location (get address by GPS)
  const handleDetectLocation = async () => {
    setLocating(true);
    if (!navigator.geolocation) {
      alert("Geolocation not supported!");
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const url = `${API_BASE_URL}/api/geocode?lat=${lat}&lng=${lng}`;
        const res = await axios.get(url);
        const place = res.data.results[0];
        if (place) {
          const formatted = place.formatted_address;
          const addrObj = {
            formatted,
            lat,
            lng,
            place_id: place.place_id,
          };
          handleAddressChange(addrObj);
        } else {
          alert("Could not detect address.");
        }
      } catch (err) {
        alert("Could not detect address.");
      }
      setLocating(false);
    }, () => {
      alert("Location detection denied.");
      setLocating(false);
    });
  };

  // Autocomplete search type based on route
  function getSearchType() {
    if (routerLocation.pathname.startsWith("/medicines")) return "medicine";
    if (routerLocation.pathname.startsWith("/doctors")) return "doctor";
    if (routerLocation.pathname.startsWith("/labs")) return "lab";
    return "all";
  }

  useEffect(() => { setSearch(searchProp); }, [searchProp]);
  useEffect(() => {
    if (!search) {
      setOptions([]);
      return;
    }
    setLoading(true);
    const type = getSearchType();
    axios.get(`${API_BASE_URL}/api/search-autocomplete?q=${search}&type=${type}`)
      .then(res => setOptions(res.data))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [search, routerLocation.pathname]);

  return (
    <Box sx={{
      width: "100vw",
      bgcolor: "#13C0A2",
      boxShadow: 3,
      position: "sticky",
      top: 0,
      zIndex: 1200,
      pb: 1.2,
      borderBottomLeftRadius: 22,
      borderBottomRightRadius: 22,
    }}>
      {/* Delivery address bar */}
      <Box sx={{
        display: "flex",
        alignItems: "center",
        px: 2,
        pt: 1.2,
        pb: 1,
        justifyContent: "space-between",
      }}>
        <Box
          sx={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1 }}
          onClick={() => setLocationModalOpen(true)}
        >
          <LocationOnIcon sx={{ color: "#FFD43B", fontSize: 27, mr: 1 }} />
          <Typography
            fontWeight={700}
            fontSize={17}
            color="#fff"
            noWrap
            sx={{ cursor: "pointer", mr: 1, flex: 1, minWidth: 0 }}
          >
            {currentAddress?.formatted
              ? `${currentAddress.formatted.length > 40 ? currentAddress.formatted.slice(0, 40) + "..." : currentAddress.formatted}`
              : "Set delivery location"}
          </Typography>
        </Box>
        <IconButton onClick={onProfile} sx={{ ml: 1 }}>
          <Avatar sx={{ bgcolor: "#FFD43B", width: 36, height: 36, color: "#13C0A2" }}>
            <PersonIcon />
          </Avatar>
        </IconButton>
      </Box>
      {/* Search bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          bgcolor: "#fff",
          borderRadius: 3,
          mx: 2,
          px: 2,
          height: 46,
          boxShadow: 2,
          mt: 1
        }}
      >
        <SearchIcon color="action" sx={{ fontSize: 24 }} />
        <Autocomplete
          freeSolo
          options={options}
          loading={loading}
          onInputChange={(event, value) => setSearch(value)}
          value={search}
          sx={{ flex: 1 }}
          inputValue={search}
          onChange={(event, newValue) => {
            setSearch(newValue || "");
            if (newValue) navigate(`/search?q=${encodeURIComponent(newValue)}`);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              variant="standard"
              placeholder={
                getSearchType() === "medicine"
                  ? "Search Medicines"
                  : getSearchType() === "doctor"
                  ? "Search Doctors"
                  : getSearchType() === "lab"
                  ? "Search Labs"
                  : "Search for Medicines, Doctors, Labs"
              }
              InputProps={{
                ...params.InputProps,
                disableUnderline: true,
                style: { fontSize: 17 }
              }}
            />
          )}
        />
        {loading && <CircularProgress size={18} sx={{ ml: 1 }} />}
      </Box>
      {/* Location modal */}
      <LocationModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onSelect={handleAddressChange}
      />
    </Box>
  );
}
