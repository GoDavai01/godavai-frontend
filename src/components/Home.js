// src/components/Home.js
import React, { useEffect, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Avatar } from "../components/ui/avatar";
import { ScrollArea } from "../components/ui/scroll-area";
import { ChevronRight, UploadCloud, MapPin, Bell, User, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import BottomNavBar from "./BottomNavBar";
import PrescriptionUploadModal from "./PrescriptionUploadModal";

// --- Constants ---
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const categories = [
  "Fever", "Diabetes", "Cold", "Heart", "Antibiotic", "Ayurveda", "Painkiller", "Cough"
];

export default function Home() {
  // State
  const [mostOrdered, setMostOrdered] = useState([]);
  const [pharmaciesNearby, setPharmaciesNearby] = useState([]);
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const { cart, addToCart } = useCart();
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const navigate = useNavigate();
  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  const [offerBannerVisible, setOfferBannerVisible] = useState(true);

  // Fetch Data
  useEffect(() => {
    const city = localStorage.getItem("city") || "Mumbai";
    const area = localStorage.getItem("area") || "";
    fetch(`${API_BASE_URL}/api/pharmacies?city=${encodeURIComponent(city)}${area ? `&area=${encodeURIComponent(area)}` : ""}`)
      .then(res => res.json())
      .then(pharmacies => {
        const active = pharmacies.filter(ph => ph.active);
        setPharmaciesNearby(active.slice(0, 10));
        fetch(`${API_BASE_URL}/api/medicines/most-ordered?city=${encodeURIComponent(city)}`)
          .then(res => res.json())
          .then(meds => {
            const filtered = meds.filter(med => med.pharmacy && active.some(ph => ph._id === (med.pharmacy._id || med.pharmacy)));
            setMostOrdered(filtered.slice(0, 10));
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

  // Last Order Summary
  const lastOrderItemsSummary = cart.length
    ? cart.map(i => `${i.name} x${i.quantity}`).join(", ")
    : "No recent orders";

  // --- UI ---
  return (
    <div className="relative min-h-screen max-w-md mx-auto bg-gradient-to-br from-slate-50 via-yellow-50 to-blue-100 pb-28">
      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-30 bg-white/70 backdrop-blur-lg border-b border-gray-200 px-5 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => navigate("/set-location")}>
          <MapPin className="text-primary w-6 h-6" />
          <span className="font-bold text-lg text-gray-800 truncate max-w-[150px]">
            {localStorage.getItem("area") || "Set delivery location"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/notifications")}>
            <Bell className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
            <Avatar className="w-8 h-8 bg-gradient-to-r from-yellow-300 via-pink-200 to-blue-200 border">
              <User className="w-5 h-5 text-gray-700" />
            </Avatar>
          </Button>
        </div>
      </div>

      {/* Greeting & Hero */}
      <div className="px-5 pt-4 flex items-center gap-4">
        <div>
          <div className="text-xl font-extrabold text-gray-900">
            {timeGreet()}, {user?.name?.split(" ")[0] || "Friend"}!
          </div>
          <div className="text-base text-gray-500 mt-0.5">What do you need today?</div>
        </div>
        {/* Modern SVG Hero */}
        <img src="/img/hero-medicine-girl.svg" alt="" className="w-16 h-16 drop-shadow-xl ml-auto hidden sm:block" />
      </div>

      {/* Offer Banner (Dismissible, glassmorphic) */}
      <AnimatePresence>
        {offerBannerVisible && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            className="px-5 mt-4"
          >
            <Alert className="border border-yellow-200 bg-gradient-to-r from-yellow-50 via-white/90 to-orange-50 shadow-md backdrop-blur-md rounded-2xl flex items-center">
              <div className="flex-1">
                <AlertTitle className="font-bold text-yellow-700">🎉 Offer!</AlertTitle>
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
      <div className="px-5 mt-5">
        <div className="relative">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search.trim() && navigate(`/search?q=${encodeURIComponent(search.trim())}`)}
            placeholder="Search for Medicines, Doctors, Labs"
            className="rounded-2xl border border-gray-200 bg-white/80 shadow focus:ring-primary/40 text-base pl-12 py-3"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary w-6 h-6" />
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-2 gap-5 mt-8 px-5">
        <div
          onClick={() => navigate("/pharmacies-near-you")}
          className="group rounded-3xl bg-gradient-to-br from-blue-50 via-white to-yellow-100 shadow-xl border border-gray-100 cursor-pointer flex flex-col items-center py-8 transition hover:scale-105 hover:shadow-2xl"
        >
          <img src="/img/modern-medicine.svg" className="w-14 h-14 mb-3 group-hover:scale-110 transition" alt="" />
          <div className="font-extrabold text-xl text-blue-700 mb-1">Medicines</div>
          <div className="text-xs text-gray-500">Order Now</div>
        </div>
        <div
          onClick={() => navigate("/doctors")}
          className="group rounded-3xl bg-gradient-to-br from-pink-50 via-white to-purple-100 shadow-xl border border-gray-100 cursor-pointer flex flex-col items-center py-8 transition hover:scale-105 hover:shadow-2xl"
        >
          <img src="/img/modern-doctor.svg" className="w-14 h-14 mb-3 group-hover:scale-110 transition" alt="" />
          <div className="font-extrabold text-xl text-pink-700 mb-1">Doctors</div>
          <div className="text-xs text-gray-500">Book Now</div>
        </div>
      </div>

      {/* Pharmacies Near You (Horizontal scroll) */}
      <div className="mt-9 px-5">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-lg text-blue-800 flex items-center gap-1">
            <span className="bg-blue-100 rounded-full p-1 mr-1">🏥</span> Pharmacies Near You
          </span>
          <Button size="sm" variant="link" className="font-bold text-primary"
            onClick={() => navigate("/pharmacies-near-you")}
          >
            See all <ChevronRight className="inline w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-2">
            {pharmaciesNearby.map((ph, idx) => (
              <div
                key={ph._id || idx}
                className="min-w-[110px] max-w-[120px] px-2 py-4 flex flex-col items-center rounded-2xl shadow-lg bg-white/90 border border-blue-50 hover:bg-blue-50 cursor-pointer transition hover:scale-105"
                onClick={() => navigate(`/medicines/${ph._id}`)}
              >
                <img src="/img/pharmacy-modern.svg" className="w-8 h-8 mb-2" alt="" />
                <div className="font-bold text-[16px] truncate text-center text-blue-800">{ph.name}</div>
                <div className="text-xs text-gray-500">{ph.distanceKm ? ph.distanceKm.toFixed(1) : "1.2"} km</div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Medicines Near You (Horizontal scroll) */}
      <div className="mt-8 px-5">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-lg text-pink-700 flex items-center gap-1">
            <span className="bg-pink-100 rounded-full p-1 mr-1">💊</span> Medicines Near You
          </span>
          <Button size="sm" variant="link" className="font-bold text-primary"
            onClick={() => navigate("/pharmacies-near-you")}
          >
            View all <ChevronRight className="inline w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-2">
            {mostOrdered.map((med, idx) => (
              <div
                key={med._id || idx}
                className="min-w-[120px] max-w-[130px] px-2 py-4 flex flex-col items-center rounded-2xl shadow-lg bg-white/90 border border-pink-50 hover:bg-pink-50 cursor-pointer transition hover:scale-105"
                onClick={() => navigate("/pharmacies-near-you")}
              >
                <img src="/img/medicine-modern.svg" className="w-9 h-9 mb-2" alt="" />
                <div className="font-bold text-[15px] truncate text-center text-pink-700">{med.name}</div>
                <div className="text-xs text-primary font-bold">₹{med.price}</div>
                <Button
                  size="xs"
                  className="mt-1 bg-gradient-to-r from-blue-300 to-yellow-200 text-xs text-gray-700 shadow rounded-full hover:scale-105"
                  onClick={e => { e.stopPropagation(); addToCart(med); }}
                >Add</Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Categories Chips */}
      <div className="mt-9 px-5">
        <div className="font-bold text-base mb-3 text-gray-800">Categories</div>
        <div className="flex gap-3 flex-wrap">
          {categories.map((cat, i) => (
            <button
              key={cat}
              onClick={() => navigate(`/search?q=${encodeURIComponent(cat)}`)}
              className={`flex items-center gap-1 rounded-full px-5 py-2 font-semibold text-sm border shadow-md transition hover:scale-105
                ${i % 2 === 0 ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}
                hover:bg-white`}
            >
              {/* You can add category icons here */}
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Order Again */}
      <div className="mt-10 px-5">
        <div className="font-bold text-base mb-2 text-blue-800 flex items-center gap-1">
          <span className="bg-blue-100 rounded-full p-1">🔁</span> Order Again
        </div>
        <Card className="rounded-2xl shadow-2xl px-5 py-5 flex flex-col gap-2 bg-white/90 border border-blue-100">
          <div className="font-bold text-[16px] text-gray-900 mb-1">Your last order</div>
          <div className="text-[14px] text-gray-500 truncate">
            {lastOrderItemsSummary}
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              className="bg-gradient-to-r from-blue-400 to-green-200 text-white font-bold shadow rounded-full px-4 py-2 hover:scale-105 transition"
              onClick={() => navigate("/orders")}
            >
              Order Again
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-yellow-400/90 text-primary font-bold shadow rounded-full px-4 py-2 flex gap-2 items-center hover:scale-105 transition"
              onClick={() => setPrescriptionModalOpen(true)}
            >
              <UploadCloud className="w-5 h-5" />
              Upload Prescription
            </Button>
          </div>
        </Card>
      </div>

      {/* Floating Upload Prescription Button (MOBILE FAB style) */}
      <Button
        variant="default"
        size="lg"
        className="fixed bottom-28 right-6 z-50 rounded-full shadow-2xl bg-gradient-to-r from-yellow-400 to-orange-300 text-primary font-bold flex gap-2 px-7 py-4 border-2 border-white/80 hover:scale-110 transition"
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
