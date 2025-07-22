// src/components/Home.js
import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, UploadCloud, MapPin, Bell, User, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import BottomNavBar from "./BottomNavBar"; // Use your modernized one
import PrescriptionUploadModal from "./PrescriptionUploadModal";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

// Categories shown as chips
const categories = [
  "Fever", "Diabetes", "Cold", "Heart", "Antibiotic", "Ayurveda", "Painkiller", "Cough"
];

export default function Home() {
  // ----- Your existing logic -----
  const [mostOrdered, setMostOrdered] = useState([]);
  const [pharmaciesNearby, setPharmaciesNearby] = useState([]);
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const { cart, addToCart } = useCart();
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const navigate = useNavigate();

  // For floating prescription modal
  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  // Dismissible offer banner
  const [offerBannerVisible, setOfferBannerVisible] = useState(true);

  // Get user's city/area for fetching nearby
  useEffect(() => {
    const city = localStorage.getItem("city") || "Mumbai";
    const area = localStorage.getItem("area") || "";
    // Fetch pharmacies nearby (active only)
    fetch(`${API_BASE_URL}/api/pharmacies?city=${encodeURIComponent(city)}${area ? `&area=${encodeURIComponent(area)}` : ""}`)
      .then(res => res.json())
      .then(pharmacies => {
        const active = pharmacies.filter(ph => ph.active);
        setPharmaciesNearby(active.slice(0, 10)); // top 10 nearby
        // Now fetch most-ordered medicines from these pharmacies
        fetch(`${API_BASE_URL}/api/medicines/most-ordered?city=${encodeURIComponent(city)}`)
          .then(res => res.json())
          .then(meds => {
            const filtered = meds.filter(med => med.pharmacy && active.some(ph => ph._id === (med.pharmacy._id || med.pharmacy)));
            setMostOrdered(filtered.slice(0, 10)); // Top 10 nearby medicines
          })
          .catch(() => setMostOrdered([]));
      })
      .catch(() => {
        setPharmaciesNearby([]);
        setMostOrdered([]);
      });
  }, []);

  // Greeting
  const timeGreet = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Last order summary (mock, replace as needed)
  const lastOrderItemsSummary = cart.length
    ? cart.map(i => `${i.name} x${i.quantity}`).join(", ")
    : "No recent orders";

  // ---- UI STARTS ----
  return (
    <div className="relative min-h-screen bg-muted pb-24 max-w-md mx-auto">

      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-30 bg-background/95 border-b border-muted px-4 py-3 flex items-center justify-between backdrop-blur">
        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => navigate("/set-location")}>
          <MapPin className="text-primary w-6 h-6" />
          <span className="font-semibold text-base truncate max-w-[150px]">
            {localStorage.getItem("area") || "Set delivery location"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/notifications")}>
            <Bell className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
            <Avatar className="w-8 h-8"><User /></Avatar>
          </Button>
        </div>
      </div>

      {/* Greeting */}
      <div className="px-4 pt-3">
        <div className="text-lg font-bold text-foreground">
          {timeGreet()}, {user?.name?.split(" ")[0] || "Friend"}!
        </div>
      </div>

      {/* Offer Banner (Dismissible) */}
      <AnimatePresence>
        {offerBannerVisible && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            className="px-4 mt-3"
          >
            <Alert className="border-primary bg-gradient-to-r from-yellow-50 to-orange-50 flex items-center">
              <div className="flex-1">
                <AlertTitle className="font-bold text-primary">🎉 Offer!</AlertTitle>
                <AlertDescription>
                  <span className="font-semibold">25% off your next order!</span> Use code <b>SUPER25</b>
                </AlertDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ml-2"
                onClick={() => setOfferBannerVisible(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Bar */}
      <div className="px-4 mt-4">
        <div className="relative">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search.trim() && navigate(`/search?q=${encodeURIComponent(search.trim())}`)}
            placeholder="Search for Medicines, Doctors, Labs"
            className="rounded-xl border-muted bg-background shadow-sm text-base pl-10"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-2 gap-4 px-4 mt-6">
        <Card
          className="rounded-2xl shadow-md cursor-pointer hover:shadow-xl transition"
          onClick={() => navigate("/pharmacies-near-you")}
        >
          <CardContent className="flex flex-col items-center py-6">
            <img src="/icons/medicines.svg" className="w-9 h-9 mb-2" alt="" />
            <div className="font-bold text-lg mb-1">Medicines</div>
            <div className="text-xs text-muted-foreground">Order Now</div>
          </CardContent>
        </Card>
        <Card
          className="rounded-2xl shadow-md cursor-pointer hover:shadow-xl transition"
          onClick={() => navigate("/doctors")}
        >
          <CardContent className="flex flex-col items-center py-6">
            <img src="/icons/doctor.svg" className="w-9 h-9 mb-2" alt="" />
            <div className="font-bold text-lg mb-1">Doctors</div>
            <div className="text-xs text-muted-foreground">Book Now</div>
          </CardContent>
        </Card>
      </div>

      {/* Pharmacies Near You (Horizontal scroll) */}
      <div className="mt-7 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-base text-foreground">🏥 Pharmacies Near You</span>
          <Button size="sm" variant="link" className="font-bold text-primary"
            onClick={() => navigate("/pharmacies-near-you")}
          >
            See all <ChevronRight className="inline w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-3 pb-2">
            {pharmaciesNearby.map((ph, idx) => (
              <Card
                key={ph._id || idx}
                className="min-w-[110px] max-w-[120px] px-2 py-3 flex flex-col items-center rounded-2xl shadow-sm bg-background hover:bg-accent cursor-pointer"
                onClick={() => navigate(`/medicines/${ph._id}`)}
              >
                <img src="/pharmacy-icon.png" className="w-8 h-8 mb-2" alt="" />
                <div className="font-semibold text-[15px] truncate text-center">{ph.name}</div>
                <div className="text-xs text-muted-foreground">{ph.distanceKm ? ph.distanceKm.toFixed(1) : "1.2"} km</div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Medicines Near You (Horizontal scroll) */}
      <div className="mt-6 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-base text-foreground">💊 Medicines Near You</span>
          <Button size="sm" variant="link" className="font-bold text-primary"
            onClick={() => navigate("/pharmacies-near-you")}
          >
            View all <ChevronRight className="inline w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-3 pb-2">
            {mostOrdered.map((med, idx) => (
              <Card
                key={med._id || idx}
                className="min-w-[110px] max-w-[120px] px-2 py-3 flex flex-col items-center rounded-2xl shadow-sm bg-background hover:bg-accent cursor-pointer"
                onClick={() => navigate("/pharmacies-near-you")}
              >
                <img src="/medicine.svg" className="w-7 h-7 mb-2" alt="" />
                <div className="font-semibold text-[15px] truncate text-center">{med.name}</div>
                <div className="text-xs text-primary font-bold">₹{med.price}</div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Categories Chips */}
      <div className="mt-6 px-4">
        <div className="font-bold text-base mb-2">Categories</div>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            {categories.map(cat => (
              <Badge
                key={cat}
                className="rounded-full bg-muted px-4 py-2 font-semibold text-[14px] cursor-pointer hover:bg-primary hover:text-white transition"
                onClick={() => navigate(`/search?q=${encodeURIComponent(cat)}`)}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Order Again */}
      <div className="mt-8 px-4">
        <div className="font-bold text-base mb-2">🔁 Order Again</div>
        <Card className="rounded-2xl shadow-md px-4 py-3 flex flex-col gap-2">
          <div className="font-semibold text-[16px]">Your last order</div>
          <div className="text-[14px] text-muted-foreground truncate">
            {lastOrderItemsSummary}
          </div>
          <Button size="sm" className="w-fit mt-2" onClick={() => navigate("/orders")}>
            Order Again
          </Button>
        </Card>
      </div>

      {/* Floating Upload Prescription Button */}
      <Button
        variant="default"
        size="lg"
        className="fixed bottom-24 right-5 z-50 rounded-full shadow-lg bg-yellow-400 text-primary font-bold flex gap-2 px-6 py-3"
        onClick={() => setPrescriptionModalOpen(true)}
      >
        <UploadCloud className="w-6 h-6" />
        Upload Prescription
      </Button>
      <PrescriptionUploadModal
        open={prescriptionModalOpen}
        onClose={() => setPrescriptionModalOpen(false)}
        userCity={localStorage.getItem("city") || "Mumbai"}
      />

      {/* Bottom Navbar */}
      <BottomNavBar />
    </div>
  );
}
