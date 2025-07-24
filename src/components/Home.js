import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import { useLocation } from "../context/LocationContext";
import BottomNavBar from "./BottomNavBar";
import PrescriptionUploadModal from "./PrescriptionUploadModal";
import Navbar from "./Navbar";

// Point to your real SVG/PNG assets
const ICONS = {
  pharmacy: "/images/pharmacy-modern.png",
  medicine: "/images/medicine-modern.svg",
  offer: "/images/offer-modern.svg",
  upload: "/images/upload-modern.svg",
  pill: "/images/pill-modern.svg",
};

const categories = [
  "Fever", "Diabetes", "Cold", "Heart", "Antibiotic", "Ayurveda", "Painkiller", "Cough"
];

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export default function Home() {
  const [pharmaciesNearby, setPharmaciesNearby] = useState([]);
  const [mostOrderedByPharmacy, setMostOrderedByPharmacy] = useState({});
  const { user } = useAuth();
  const { cart, addToCart } = useCart();
  const navigate = useNavigate();
  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  const { currentAddress } = useLocation();
  const [userCoords, setUserCoords] = useState(null);
  const [showCategoryNotification, setShowCategoryNotification] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(""); // e.g. "Fever", "Diabetes", etc.

  useEffect(() => {
    if (currentAddress?.lat && currentAddress?.lng) {
      setUserCoords({ lat: currentAddress.lat, lng: currentAddress.lng });
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserCoords(null)
      );
    }
  }, [currentAddress]);

  // Get nearby pharmacies (max 5, 8km radius)
  // In Home.js
useEffect(() => {
  if (!userCoords) return;
  fetch(
    `${API_BASE_URL}/api/pharmacies/nearby?lat=${userCoords.lat}&lng=${userCoords.lng}&maxDistance=8000`
  )
    .then(res => res.json())
    .then(pharmacies => {
      const active = pharmacies.filter(ph => ph.active !== false).slice(0, 10); // <-- 10 here!
      setPharmaciesNearby(active);

      // Get medicines for first 5 only
      Promise.all(
        active.slice(0, 5).map(ph =>
          fetch(`${API_BASE_URL}/api/medicines?pharmacyId=${ph._id}`)
            .then(res => res.json())
            .then(meds => ({ pharmacyId: ph._id, medicines: meds.slice(0, 8) }))
            .catch(() => ({ pharmacyId: ph._id, medicines: [] }))
        )
      ).then(results => {
        const map = {};
        results.forEach(r => { map[r.pharmacyId] = r.medicines; });
        setMostOrderedByPharmacy(map);
      });
    });
}, [userCoords]);

  // Only allow one pharmacy's medicines in cart
  const handleAddToCart = (med) => {
    if (cart.length > 0) {
      const cartPharmacyId = cart[0]?.pharmacy?._id || cart[0]?.pharmacy;
      if (
        med.pharmacy?._id !== cartPharmacyId &&
        med.pharmacy !== cartPharmacyId
      ) {
        alert("You can only order medicines from one pharmacy at a time.");
        return;
      }
    }
    addToCart(med);
  };

  // 1. Add this handler inside Home
  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    setShowCategoryNotification(true);
    setTimeout(() => {
      setShowCategoryNotification(false);
    }, 4000);
  };

  // Get user first name or fallback
  const greetUser = () => {
    const hour = new Date().getHours();
    const hello =
      hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    return `${hello}, ${user?.name?.split(" ")[0] || "Friend"}!`;
  };

    // 1. For each pharmacy, count matching category medicines
const filteredPharmacies = pharmaciesNearby.slice(0, 5)
  .map(ph => {
    const allMeds = mostOrderedByPharmacy[ph._id] || [];
    const filteredMeds = selectedCategory
      ? allMeds.filter(med =>
          (typeof med.category === "string" && med.category.toLowerCase() === selectedCategory.toLowerCase()) ||
          (Array.isArray(med.categories) && med.categories.some(
            c => typeof c === "string" && c.toLowerCase() === selectedCategory.toLowerCase()
          ))
        )
      : allMeds;
    return {
      ...ph,
      medicines: filteredMeds,
      medCount: filteredMeds.length,
    };
  })
  .sort((a, b) => b.medCount - a.medCount);

  return (
    <div className="min-h-screen max-w-md mx-auto bg-gradient-to-br from-[#f8fbfc] via-white to-[#f5f8fa] pb-32 relative">
      {/* 1. Header: Navbar with location and profile, search bar */}
      <Navbar />

      {/* 2. Offer Banner */}
      <div className="px-4 pt-5 pb-0">
        <AnimatePresence>
          <motion.div
            initial={{ y: -18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -32, opacity: 0 }}
          >
            <div className="rounded-2xl flex items-center px-4 py-3 bg-[#fff8e1]/80 shadow-md border-0 mb-2">
              <img src={ICONS.offer} alt="Offer" className="w-6 h-6 mr-2" />
              <div>
                <span className="font-semibold text-[#e8950c]">Flat 10% off on every order!</span>
                <span className="ml-2 text-[#b7870c] font-bold">Use code <b>GoDavaii10</b></span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      {showCategoryNotification && selectedCategory && (
  <div className="rounded-2xl px-4 py-3 bg-[#fff8e1]/80 shadow-md border-0 mb-3 flex items-center justify-between mx-4 mt-3">
    <span>
      <b>Did you get your {selectedCategory.toLowerCase()} medicines?</b>
      <br />
      If not, browse more options from&nbsp;
      <a className="text-[#13C0A2] font-semibold underline" href="/pharmacies-near-you">
        pharmacies near you
      </a>.
    </span>
    <button
      onClick={() => setShowCategoryNotification(false)}
      className="ml-3 text-[#13C0A2] font-bold text-xl"
      style={{ lineHeight: 1 }}
    >
      ✕
    </button>
  </div>
)}


      {/* 3. Nearby Pharmacies */}
      <div className="mt-5 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-extrabold text-lg text-[#13C0A2] flex items-center gap-1">Pharmacies Near You</span>
          <button
            className="text-[#13C0A2] text-[15px] font-bold hover:underline"
            onClick={() => navigate("/pharmacies-near-you")}
          >
            See all &gt;
          </button>
        </div>
        <div className="flex gap-4 pb-2 snap-x overflow-x-auto">
          {pharmaciesNearby.slice(0, 10).map((ph, idx) => (
            <div
              key={ph._id || idx}
              className="min-w-[120px] max-w-[140px] px-2 py-6 flex flex-col items-center rounded-2xl shadow-2xl bg-white/90 backdrop-blur ring-1 ring-[#e3f7fc]/50 hover:bg-[#e1f7fa]/60 cursor-pointer transition hover:scale-105 snap-center"
              onClick={() => navigate(`/medicines/${ph._id}`)}
            >
              <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-tr from-[#e3f9fe] to-[#d4f5f7] mb-2 shadow">
                <img src={ICONS.pharmacy} className="w-7 h-7" alt="Pharmacy" />
              </span>
              <div className="font-semibold text-[15px] truncate text-center text-[#187477]">{ph.name}</div>
              <div className="text-xs text-neutral-400 mt-0.5">
                {ph.dist?.calculated
                  ? ph.dist.calculated > 1000
                    ? `${(ph.dist.calculated / 1000).toFixed(1)} km`
                    : `<1 km`
                  : "--"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Categories: Pills */}
      <div className="mt-7 px-4">
        <div className="font-extrabold text-base mb-2 text-[#187477]">Categories</div>
        <div className="flex gap-3 pb-1 overflow-x-auto">
          {categories.map((cat, i) => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className={`
                flex items-center gap-2 rounded-full px-5 py-2 font-bold text-sm border-0 shadow-lg transition hover:scale-105
                ${i % 2 === 0
                  ? "bg-gradient-to-r from-[#eafcf4]/80 to-[#d7ede4]/80 text-[#13C0A2] ring-1 ring-[#13C0A2]/10"
                  : "bg-gradient-to-r from-[#fff8e1]/80 to-[#ffe9b3]/90 text-[#e8950c] ring-1 ring-[#FFD43B]/10"}
                hover:bg-white/90`}
            >
             
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Medicines at [Pharmacy]: Repeat for each nearby pharmacy */}
{filteredPharmacies.map((ph, idx) =>
  ph.medicines.length > 0 ? ( // Only show if any medicine in this category
    <div key={ph._id || idx} className="mt-10 px-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-extrabold text-lg text-[#187477] flex items-center gap-2">
          Medicines at {ph.name}
        </span>
        <button
          className="text-[#13C0A2] text-[15px] font-bold hover:underline"
          onClick={() => navigate(`/medicines/${ph._id}`)}
        >
          View All &gt;
        </button>
      </div>
      <div className="flex gap-4 pb-2 snap-x overflow-x-auto">
        {ph.medicines.map((med, mi) => (
          <div
            key={med._id || mi}
            className="min-w-[130px] max-w-[150px] px-2 py-6 flex flex-col items-center rounded-2xl shadow-xl bg-white/90 backdrop-blur ring-1 ring-[#e1f0fa]/60 hover:bg-[#e1f7fa]/70 cursor-pointer transition hover:scale-105 snap-center"
            onClick={() => navigate(`/medicines/${ph._id}`)}
          >
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-[#e8f9f3] to-[#d1f2eb] mb-2 shadow">
              <img src={med.img || ICONS.medicine} className="w-7 h-7" alt="Medicine" />
            </span>
            <div className="font-semibold text-[15px] truncate text-center text-[#187477]">{med.name}</div>
            <div className="text-xs text-[#13C0A2] font-semibold">
              ₹{med.price}
            </div>
            <button
              className="mt-1 px-4 py-1 text-xs bg-[#13C0A2] rounded-full text-white font-bold shadow hover:bg-[#0e9c87] transition"
              onClick={e => { e.stopPropagation(); handleAddToCart(med); }}
            >
              Add
            </button>
          </div>
        ))}
      </div>
    </div>
  ) : null // Don't render anything if no medicines
)}

      {/* 6. Order Again */}
      <div className="mt-12 px-4">
        <div className="font-extrabold text-base mb-2 text-[#187477] flex items-center gap-2">
          Order Again
        </div>
        <div className="rounded-2xl shadow-3xl px-7 py-6 flex flex-col gap-2 bg-white/90 backdrop-blur ring-1 ring-[#e1f0fa]/70">
          <div className="font-extrabold text-[17px] text-[#187477] mb-1">Your last order</div>
          <div className="text-[14px] text-neutral-400 truncate">
            {cart.length
              ? cart.map(i => `${i.name} x${i.quantity}`).join(", ")
              : "No recent orders"}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              className="bg-gradient-to-r from-[#13C0A2] to-[#6decb9] text-white font-bold shadow-lg rounded-full px-5 py-2 hover:scale-105 transition"
              onClick={() => navigate("/orders")}
            >
              Order Again
            </button>
          </div>
        </div>
      </div>

      {/* 7. Floating Upload Prescription FAB */}
     <button
  className="fixed bottom-24 right-5 z-50 flex items-center gap-2 rounded-full px-6 py-3 bg-[#13C0A2] text-white font-bold shadow-xl hover:bg-[#0e9c87] transition-all duration-150"
  onClick={() => setPrescriptionModalOpen(true)}
  style={{ fontSize: "16px" }}
>
  <img src={ICONS.upload} alt="Upload" className="w-6 h-6" />
  Upload Prescription
</button>

      <PrescriptionUploadModal
        open={prescriptionModalOpen}
        onClose={() => setPrescriptionModalOpen(false)}
        userCity={localStorage.getItem("city") || "Mumbai"}
      />

      {/* 8. Bottom Navigation */}
      <BottomNavBar />
    </div>
  );
}
