// src/pages/PharmaciesNearYou.js
import React, { useEffect, useState } from "react";
import {
  Box, Typography, Card, Button, Stack, Chip, Fab, Rating, Divider
} from "@mui/material";
import LocalPharmacyIcon from "@mui/icons-material/LocalPharmacy";
import PrescriptionUploadModal from "../components/PrescriptionUploadModal";
import { useLocation } from "../context/LocationContext";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export default function PharmaciesNearYou() {
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canDeliver, setCanDeliver] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const navigate = useNavigate();

  // Use context for current address
  const { currentAddress } = useLocation();

  // Refetch on address change (and on mount)
  useEffect(() => {
    if (!currentAddress?.lat || !currentAddress?.lng) {
      setLoading(false);
      setPharmacies([]);
      return;
    }
    setLoading(true);
    fetch(`${API_BASE_URL}/api/pharmacies/nearby?lat=${currentAddress.lat}&lng=${currentAddress.lng}`)
      .then(res => res.json())
      .then(data => setPharmacies(data))
      .catch(() => setPharmacies([]))
      .finally(() => setLoading(false));
  }, [currentAddress]);

  // Delivery partner check (now by lat/lng)
  useEffect(() => {
    if (!currentAddress?.lat || !currentAddress?.lng) {
      setCanDeliver(false);
      return;
    }
    fetch(`${API_BASE_URL}/api/delivery/active-partner-nearby?lat=${currentAddress.lat}&lng=${currentAddress.lng}`)
      .then(res => res.json())
      .then(data => setCanDeliver(!!data.activePartnerExists))
      .catch(() => setCanDeliver(false));
  }, [currentAddress]);

  return (
    <Box sx={{ bgcolor: "#f9fafb", minHeight: "100vh", pb: 12, pt: 2 }}>
      <Box sx={{ maxWidth: 480, mx: "auto", px: 0 }}>
        {/* Offer banner */}
        <Box
          sx={{
            bgcolor: "#eafcf4",
            color: "#13C0A2",
            fontWeight: 800,
            fontSize: 18,
            borderRadius: 6,
            px: 2.5,
            py: 1.6,
            mb: 2,
            display: "flex",
            alignItems: "center",
            boxShadow: 1,
            gap: 1,
            mx: 2
          }}
        >
          <span role="img" aria-label="lightning" style={{ color: "#FFD43B", fontSize: 22, marginRight: 10 }}>⚡</span>
          <span>Flat 15% OFF on health supplements! Use code <b>HEALTH15</b></span>
        </Box>

        {/* Heading */}
        <Stack direction="row" alignItems="center" spacing={1} mb={1} mx={2}>
          <LocalPharmacyIcon sx={{ color: "#FFD43B", fontSize: 28, mr: 1 }} />
          <Typography fontWeight={900} fontSize={23} color="#1199a6" sx={{ letterSpacing: 0.5 }}>
            Pharmacies Near You
          </Typography>
          {currentAddress?.formatted && (
            <Chip
              label={currentAddress.formatted.length > 23
                ? currentAddress.formatted.slice(0, 23) + "..."
                : currentAddress.formatted}
              sx={{
                bgcolor: "#13C0A2",
                color: "#fff",
                ml: 1,
                fontWeight: 700,
                fontSize: 13,
                borderRadius: 2,
                px: 1.2,
                cursor: "default",
                pointerEvents: "none"
              }}
              size="small"
            />
          )}
        </Stack>

        <Divider sx={{ my: 1 }} />

        {/* Delivery partner block */}
        {!canDeliver && (
          <Box sx={{
            bgcolor: "#ffebee",
            color: "#b71c1c",
            p: 2,
            borderRadius: 2,
            my: 2,
            textAlign: "center",
            fontWeight: 700,
            fontSize: 16
          }}>
            <span role="img" aria-label="no-delivery" style={{ fontSize: 20, marginRight: 8 }}>⛔</span>
            Sorry, no delivery partner is available at your location right now.<br />
            Please try again soon.
          </Box>
        )}

        {/* Pharmacies list */}
        <Box sx={{ px: 2, pt: 0.5 }}>
          {loading ? (
            <Typography sx={{ mt: 6, color: "#888" }}>Loading pharmacies...</Typography>
          ) : pharmacies.length === 0 ? (
            <Typography sx={{ mt: 6, color: "#888" }}>
              No pharmacies found near your location.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {pharmacies.map((pharmacy) => (
                <Card
                  key={pharmacy._id}
                  sx={{
                    opacity: canDeliver ? 1 : 0.55,
                    pointerEvents: canDeliver ? "auto" : "none",
                    borderRadius: 5,
                    boxShadow: 3,
                    px: 2,
                    py: 1.7,
                    bgcolor: "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.6,
                    cursor: canDeliver ? "pointer" : "not-allowed",
                    transition: "box-shadow 0.13s",
                    "&:hover": canDeliver ? { boxShadow: 7, bgcolor: "#fafbfa" } : {},
                  }}
                  onClick={() => canDeliver && navigate(`/medicines/${pharmacy._id}`)}
                >
                  {/* Pharmacy Icon */}
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      background: "#e8faf7",
                      borderRadius: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mr: 1
                    }}
                  >
                    <img
                      src="/pharmacy-icon.png"
                      alt="Pharmacy"
                      style={{
                        width: 32,
                        height: 32,
                        objectFit: "contain",
                        display: "block"
                      }}
                    />
                  </Box>
                  {/* Main info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      fontWeight={800}
                      fontSize={16}
                      color="#138a72"
                      sx={{
                        overflowWrap: "break-word",
                        wordBreak: "break-all",
                        whiteSpace: "normal",
                        maxWidth: 165,
                        lineHeight: 1.2
                      }}
                      title={pharmacy.name}
                    >
                      {pharmacy.name}
                    </Typography>
                    <Typography fontSize={14} color="#666" sx={{ mt: 0.1 }}>
                      {pharmacy.address?.area || pharmacy.area}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.7 }}>
                      <Chip
                        size="small"
                        label={`13–29 min`}
                        sx={{
                          bgcolor: "#13C0A225",
                          color: "#13C0A2",
                          fontWeight: 700,
                          fontSize: 13
                        }}
                      />
                      <Chip
                        size="small"
                        label="✅Verified"
                        sx={{
                          bgcolor: "#FFD43B22",
                          color: "#f49f00",
                          fontWeight: 700,
                          fontSize: 13
                        }}
                      />
                    </Stack>
                  </Box>
                  <Stack alignItems="flex-end" spacing={1}>
                    <Rating
                      value={pharmacy.rating || 4.5}
                      precision={0.1}
                      readOnly
                      size="small"
                      sx={{ fontSize: 18, mb: 0.3 }}
                    />
                    <Button
                      size="small"
                      variant="contained"
                      sx={{
                        bgcolor: "#328439",
                        color: "#fff",
                        borderRadius: 99,
                        px: 2.3,
                        py: 0.6,
                        fontWeight: 700,
                        textTransform: "none",
                        fontSize: 15,
                        boxShadow: "none",
                        "&:hover": { bgcolor: "#146b2d" }
                      }}
                      disabled={!canDeliver}
                      onClick={e => {
                        e.stopPropagation();
                        if (canDeliver) navigate(`/medicines/${pharmacy._id}`);
                      }}
                    >
                      View
                    </Button>
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </Box>
      </Box>

      {/* Floating: Upload Prescription */}
      {!uploadOpen && (
        <Fab
          variant="extended"
          sx={{
            position: "fixed",
            bottom: 140,
            right: 18,
            zIndex: 2001,
            bgcolor: "#FFD43B",
            color: "#1199a6",
            fontWeight: 700,
            boxShadow: 7,
            pl: 2,
            pr: 2.6,
            "&:hover": { bgcolor: "#f2c200" }
          }}
          onClick={() => setUploadOpen(true)}
          title="Upload Prescription"
        >
          <UploadFileIcon sx={{ fontSize: 23, mr: 1 }} />
          Upload Prescription
        </Fab>
      )}
      <PrescriptionUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        userAddress={currentAddress}
      />
    </Box>
  );
}
