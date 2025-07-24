import React, { useState, useEffect } from "react";
import {
  Box, IconButton, Avatar, Typography, CircularProgress, Tooltip
} from "@mui/material";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PersonIcon from "@mui/icons-material/Person";
import SearchIcon from "@mui/icons-material/Search";
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
  const { currentAddress, setCurrentAddress } = useLocation();
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [search, setSearch] = useState(searchProp);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleAddressChange = (addrObj) => {
    setCurrentAddress(addrObj);
    setLocationModalOpen(false);
  };

  useEffect(() => { setSearch(searchProp); }, [searchProp]);
  useEffect(() => {
    if (!search) {
      setOptions([]);
      return;
    }
    setLoading(true);
    const type = (() => {
      if (routerLocation.pathname.startsWith("/medicines")) return "medicine";
      if (routerLocation.pathname.startsWith("/doctors")) return "doctor";
      if (routerLocation.pathname.startsWith("/labs")) return "lab";
      return "all";
    })();
    axios.get(`${API_BASE_URL}/api/search-autocomplete?q=${search}&type=${type}`)
      .then(res => setOptions(res.data))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [search, routerLocation.pathname]);

  return (
    <Box sx={{
      width: "100vw",
      background: "rgba(19, 192, 162, 0.68)",
      backdropFilter: "blur(18px)",
      WebkitBackdropFilter: "blur(18px)",
      boxShadow: "0 2px 18px 2px rgba(25,46,89,0.11)",
      position: "sticky",
      top: 0,
      zIndex: 1200,
      pb: 1.2,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      transition: "all 0.18s",
      border: "1.5px solid #eafcf4",
      mx: "auto",
      maxWidth: 520
    }}>
      {/* Delivery address bar */}
      <Box sx={{
        display: "flex",
        alignItems: "center",
        px: 2.2,
        pt: 1.6,
        pb: 1.1,
        justifyContent: "space-between",
      }}>
        <Box
          sx={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1, cursor: "pointer" }}
          onClick={() => setLocationModalOpen(true)}
        >
          <LocationOnIcon sx={{ color: "#FFD43B", fontSize: 27, mr: 1.2 }} />
          <Typography
            fontWeight={800}
            fontSize={18}
            color="#fff"
            noWrap
            sx={{ mr: 1, flex: 1, minWidth: 0, letterSpacing: -0.5 }}
          >
            {currentAddress?.formatted
              ? `${currentAddress.formatted.length > 40 ? currentAddress.formatted.slice(0, 40) + "..." : currentAddress.formatted}`
              : "Set delivery location"}
          </Typography>
        </Box>
        <Tooltip title="Profile">
          <IconButton onClick={onProfile} sx={{ ml: 1 }}>
            <Avatar sx={{
              bgcolor: "#FFD43B",
              width: 39,
              height: 39,
              color: "#13C0A2",
              boxShadow: "0 1.5px 10px 1.5px rgba(255, 212, 67, 0.18)"
            }}>
              <PersonIcon fontSize="medium" />
            </Avatar>
          </IconButton>
        </Tooltip>
      </Box>
      {/* Search bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          background: "rgba(255,255,255,0.84)",
          borderRadius: 4,
          mx: 2.2,
          px: 2,
          height: 48,
          boxShadow: "0 1px 7px 0 rgba(25,46,89,0.06)",
          mt: 1,
          border: "1px solid #eafcf4",
          backdropFilter: "blur(6px)"
        }}
      >
        <SearchIcon color="action" sx={{ fontSize: 23, opacity: 0.74 }} />
        <Autocomplete
          freeSolo
          options={options}
          loading={loading}
          onInputChange={(event, value) => setSearch(value)}
          value={search}
          sx={{ flex: 1, ml: 0.8 }}
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
                routerLocation.pathname.startsWith("/medicines") ? "Search Medicines"
                : routerLocation.pathname.startsWith("/doctors") ? "Search Doctors"
                : routerLocation.pathname.startsWith("/labs") ? "Search Labs"
                : "Search for Medicines, Doctors, Labs"
              }
              InputProps={{
                ...params.InputProps,
                disableUnderline: true,
                style: { fontSize: 17, fontWeight: 600, letterSpacing: -0.3, color: "#213342" }
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
