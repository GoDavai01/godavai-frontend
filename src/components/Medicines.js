import React, { useEffect, useState } from "react";
import {
  Box, Typography, Card, Button, Stack, Chip, Fab, Snackbar, Alert, Divider, MenuItem, Select, InputLabel, FormControl, Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import PrescriptionUploadModal from "../components/PrescriptionUploadModal";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import CategoryIcon from "@mui/icons-material/Category";
import { useCart } from "../context/CartContext";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SwipeableViews from 'react-swipeable-views';
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

// Only this function changed: Now always uses relative path for production.
const getImageUrl = (img) => {
  if (!img)
    return "https://img.freepik.com/free-vector/medicine-bottle-pills-isolated_1284-42391.jpg?w=400";
  if (img.startsWith("/uploads/")) {
    // Always fetch from backend!
    return `${API_BASE_URL}${img}`;
  }
  // If already absolute URL
  if (img.startsWith("http://") || img.startsWith("https://")) return img;
  return img;
};

const allCategories = ["All", "Painkiller", "Fever", "Cough & Cold", "Diabetes", "Heart", "Antibiotic", "Ayurveda"];
const medTypes = ["All", "Tablet", "Syrup", "Injection", "Cream", "Ointment", "Drop", "Spray", "Inhaler"];

export default function Medicines() {
  const { pharmacyId } = useParams();
  const { addToCart } = useCart();
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [pharmacy, setPharmacy] = useState(null);
  const [selectedMed, setSelectedMed] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const city = localStorage.getItem("city") || "Delhi";
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPharmacy = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/pharmacies?id=${pharmacyId}`);
        if (Array.isArray(res.data)) {
          setPharmacy(res.data[0]);
        }
      } catch {
        setPharmacy(null);
      }
    };
    fetchPharmacy();
  }, [pharmacyId]);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API_BASE_URL}/api/medicines?pharmacyId=${pharmacyId}`)
      .then((res) => setMedicines(res.data))
      .catch(() => setMedicines([]))
      .finally(() => setLoading(false));
  }, [pharmacyId]);

  // --- THE MAIN FIX: this function now supports arrays for category/type ---
  const matchCategory = (med, selected) => {
    if (selected === "All") return true;
    if (!med.category) return false;
    if (Array.isArray(med.category)) return med.category.includes(selected);
    return med.category === selected;
  };

  const matchType = (med, selected) => {
    if (selected === "All") return true;
    if (!med.type) return false;
    if (Array.isArray(med.type)) return med.type.includes(selected);
    return med.type === selected;
  };

  const filteredMeds = medicines.filter(med => matchCategory(med, selectedCategory) && matchType(med, selectedType));

  return (
    <Box sx={{ bgcolor: "#f9fafb", minHeight: "100vh", pb: 12, pt: 3 }}>
      <Box sx={{ maxWidth: 480, mx: "auto", px: 2 }}>
        {pharmacy && (
          <Box sx={{ mb: 2, pb: 1 }}>
            <Typography fontWeight={900} fontSize={22} color="#13C0A2">
              🏥 {pharmacy.name}
            </Typography>
            <Typography fontSize={14} color="#555">
              {pharmacy.area}, {pharmacy.city}
            </Typography>
            <Divider sx={{ mt: 1.5 }} />
          </Box>
        )}

        {/* Filter Section */}
        <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={selectedCategory}
              label="Category"
              onChange={(e) => setSelectedCategory(e.target.value)}
              startAdornment={<FilterAltIcon sx={{ mr: 1, color: "#13C0A2" }} />}
              sx={{ fontWeight: 700, bgcolor: "#eafaf3", borderRadius: 2 }}
            >
              {allCategories.map(cat => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={selectedType}
              label="Type"
              onChange={(e) => setSelectedType(e.target.value)}
              startAdornment={<CategoryIcon sx={{ mr: 1, color: "#13C0A2" }} />}
              sx={{ fontWeight: 700, bgcolor: "#eafaf3", borderRadius: 2 }}
            >
              {medTypes.map(type => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {loading ? (
          <Typography color="text.secondary">Loading medicines...</Typography>
        ) : filteredMeds.length === 0 ? (
          <Typography color="text.secondary">No medicines found.</Typography>
        ) : (
          <Stack spacing={2}>
            {filteredMeds.map((med) => {
              const mrp = med.mrp;
              const discount = Math.round(((med.mrp - med.price) / med.mrp) * 100);

              return (
                <Card
                  key={med._id}
                  sx={{
                    display: "flex", p: 1.6, borderRadius: 4, boxShadow: 2,
                    bgcolor: "#fff", alignItems: "center", justifyContent: "space-between"
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box
                      component="img"
                      src={getImageUrl(med.img)}
                      alt={med.name}
                      onClick={() => setSelectedMed(med)}
                      sx={{ width: 72, height: 72, borderRadius: 3, bgcolor: "#f1fff7", objectFit: "contain", cursor: "pointer" }}
                    />
                    <Box>
                      <Typography fontWeight={700} fontSize={16} color="#07908A" sx={{ mb: 0.2, cursor: "pointer" }} onClick={() => setSelectedMed(med)}>
  {med.brand || med.name}
</Typography>

                      {med.brand && med.brand.trim() && (
                        <Typography
                          fontWeight={600}
                          fontSize={14}
                          color="#146e6e"
                          sx={{ mb: 0.2 }}
                        >
                          {med.brand}
                        </Typography>
                      )}
                      {med.composition && (
  <Typography fontSize={13} color="#4b5563" sx={{ mb: 0.2 }}>
    {med.composition}
  </Typography>
)}
{med.company && (
  <Typography fontSize={12} color="#6b7280" sx={{ mb: 0.5 }}>
    {med.company}
  </Typography>
)}
                      <Typography fontSize={13} color="#666" sx={{ mb: 0.5 }}>
                        {/* Show ALL categories, not just one */}
                        {Array.isArray(med.category) ? med.category.join(", ") : (med.category || "Miscellaneous")}
                      </Typography>
                      <Stack direction="row" spacing={1} mt={1}>
                        <Button
                          size="medium"
                          onClick={() => setSelectedMed(med)}
                          sx={{ px: 1.5, fontSize: 15, borderRadius: 2, textTransform: "none" }}
                        >
                          Know More
                        </Button>
                        <Button
                          variant="contained"
                          size="medium"
                          sx={{
                            bgcolor: "#13C0A2", color: "#fff", px: 2,
                            fontWeight: 800, borderRadius: 2, fontSize: 14, textTransform: "none",
                            "&:hover": { bgcolor: "#0e9c87" }
                          }}
                          onClick={() => {
                            addToCart(med);
                            setSnackbar({ open: true, message: `${med.brand || med.name} added to cart!`, severity: "success" });
                          }}
                        >
                          Add to Cart
                        </Button>
                      </Stack>
                    </Box>
                  </Box>
                  <Box textAlign="right">
                    {med.mrp ? (
                      <>
                        <Typography fontSize={14} sx={{ textDecoration: "line-through", color: "#999" }}>
                          MRP: ₹{med.mrp}
                        </Typography>
                        <Typography fontWeight={900} fontSize={18} color="#13C0A2">
                          ₹{med.price}
                        </Typography>
                        {med.price < med.mrp && (
                          <Chip
                            label={`${Math.round(((med.mrp - med.price) / med.mrp) * 100)}% OFF`}
                            size="small"
                            color="success"
                            sx={{ height: 20, fontWeight: 700, mt: 0.5 }}
                          />
                        )}
                      </>
                    ) : (
                      <>
                        <Typography fontSize={18} fontWeight={900} color="#13C0A2">
                          ₹{med.price}
                        </Typography>
                        <Typography fontSize={13} color="gray">
                          MRP not available
                        </Typography>
                      </>
                    )}
                  </Box>
                </Card>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* Know More Modal */}
      <Dialog
  open={!!selectedMed}
  onClose={() => setSelectedMed(null)}
  fullWidth
  maxWidth="xs"
  PaperProps={{
    sx: {
      borderRadius: 4,
      p: 0,
      overflow: "hidden",
      maxWidth: 380, // you can set 360/380 for mobile style
      mx: "auto",
      // for mobile chrome "safe area"
      mb: { xs: 2, sm: 0 }
    }
  }}
>
  {selectedMed && (
    <Box sx={{ bgcolor: "#fff" }}>
      {/* IMAGES */}
      <Box sx={{
  width: "100%",
  bgcolor: "#f5f7fa",
  pt: 0, // No top padding!
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  overflow: "hidden"
}}>
  <SwipeableViews
    enableMouseEvents
    style={{ width: "100%", margin: 0 }}
    containerStyle={{ width: "100%" }}
  >
    {(selectedMed.images?.length ? selectedMed.images : [selectedMed.img]).map((src, i) => (
      <Box
        key={i}
        sx={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start", // Top-align
          minHeight: 0, // Remove forced height!
          p: 0, // Remove padding
          m: 0
        }}
      >
        <img
          src={getImageUrl(src)}
          alt={`Medicine ${selectedMed.name} img${i + 1}`}
          style={{
            width: "100%",
            maxWidth: 280,
            height: "auto",
            maxHeight: 180,
            objectFit: "contain",
            borderRadius: 10,
            background: "#fff",
            border: "1px solid #e3e3e3",
            boxShadow: "0 1px 4px 0 #e6e6e6",
            margin: "0 auto"
          }}
        />
      </Box>
    ))}
  </SwipeableViews>
</Box>

      {/* NAME + BRAND */}
      <Box sx={{ p: 2, pt: 1 }}>
        <Typography fontWeight={800} fontSize={20} color="#13807e">
  {selectedMed.brand || selectedMed.name}
</Typography>
        {selectedMed.brand && (
          <Typography fontSize={14} color="#888" mb={1}>
            {selectedMed.brand}
          </Typography>
        )}
        {selectedMed.composition && (
  <Typography fontSize={14} color="#666" mb={0.2}>
    Composition: {selectedMed.composition}
  </Typography>
)}
{selectedMed.company && (
  <Typography fontSize={14} color="#666" mb={1}>
    Company: {selectedMed.company}
  </Typography>
)}


        {/* PRICE + DISCOUNT */}
        <Stack direction="row" alignItems="center" spacing={1} mb={1}>
          <Typography fontSize={22} fontWeight={900} color="#12ba94">
            ₹{selectedMed.price}
          </Typography>
          {selectedMed.mrp && selectedMed.price < selectedMed.mrp && (
            <>
              <Typography
                fontSize={16}
                color="gray"
                sx={{ textDecoration: "line-through" }}
              >
                ₹{selectedMed.mrp}
              </Typography>
              <Chip
                label={`-${Math.round(
                  ((selectedMed.mrp - selectedMed.price) / selectedMed.mrp) * 100
                )}%`}
                size="small"
                color="success"
                sx={{
                  height: 22,
                  fontWeight: 700,
                  bgcolor: "#e6ffed",
                  color: "#199356",
                  ml: 1
                }}
              />
            </>
          )}
        </Stack>

        {/* CATEGORY, TYPE */}
        <Typography fontSize={14} color="text.secondary" mb={0.2}>
          <b>Category:</b>{" "}
          {Array.isArray(selectedMed.category)
            ? selectedMed.category.join(", ")
            : selectedMed.category || "—"}
        </Typography>
        <Typography fontSize={14} color="text.secondary" mb={1}>
          <b>Type:</b> {selectedMed.type}
        </Typography>

        {/* DESCRIPTION */}
        <Typography fontSize={14} color="#444" sx={{ my: 1 }}>
          {selectedMed.description || (
            <span style={{ color: "#999" }}>No description available.</span>
          )}
        </Typography>
      </Box>

      {/* ACTION BUTTONS */}
      <Box
        sx={{
          p: 2,
          pt: 0,
          display: "flex",
          justifyContent: "space-between",
          gap: 2,
          bgcolor: "#fff",
          borderTop: "1px solid #eee"
        }}
      >
        <Button
          onClick={() => setSelectedMed(null)}
          sx={{
            flex: 1,
            bgcolor: "#f3f3f3",
            color: "#777",
            fontWeight: 700,
            borderRadius: 2
          }}
        >
          Close
        </Button>
        <Button
          variant="contained"
          sx={{
            flex: 2,
            bgcolor: "#13C0A2",
            color: "#fff",
            fontWeight: 800,
            borderRadius: 2,
            boxShadow: 2,
            ml: 1,
            "&:hover": { bgcolor: "#099076" }
          }}
          onClick={() => {
            addToCart(selectedMed);
            setSnackbar({
              open: true,
              message: `${selectedMed.name} added to cart!`,
              severity: "success"
            });
            setSelectedMed(null);
          }}
        >
          Add to Cart
        </Button>
      </Box>
    </Box>
  )}
</Dialog>


      {/* Floating Upload Prescription */}
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
        userCity={city}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={1600}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
