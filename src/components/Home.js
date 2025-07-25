import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import { useLocation } from "../context/LocationContext";
import BottomNavBar from "./BottomNavBar";
import PrescriptionUploadModal from "./PrescriptionUploadModal";
import Navbar from "./Navbar";

function isMedicineInCategory(med, selectedCategory) {
  if (!med || !selectedCategory) return false;
  const target = selectedCategory.trim().toLowerCase();
  let cats = [];
  if (typeof med.category === "string") cats.push(med.category);
  if (Array.isArray(med.category)) cats = cats.concat(med.category);
  if (Array.isArray(med.categories)) cats = cats.concat(med.categories);
  cats = cats.filter(Boolean).map(x => String(x).toLowerCase());
  return cats.some(c => c.includes(target) || target.includes(c));
}

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
  const [selectedCategory, setSelectedCategory] = useState("");
  const popupTimeout = useRef(null);
  const [showFallbackMeds, setShowFallbackMeds] = useState(false);
  const noMedicinesTimer = useRef(null);
  const [lastOrder, setLastOrder] = useState(null);

  // ADDED: cache of all medicines for each pharmacy
  const [allMedsByPharmacy, setAllMedsByPharmacy] = useState({});

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

  useEffect(() => {
  async function fetchLastOrder() {
    if (!user?._id && !user?.userId) return;
    const userId = user._id || user.userId;
    const res = await fetch(`${API_BASE_URL}/api/allorders/myorders-userid/${userId}`);
    const orders = await res.json();
    if (Array.isArray(orders) && orders.length > 0) {
      setLastOrder(orders[0]); // most recent order first (should already be sorted)
    }
  }
  fetchLastOrder();
}, [user]);

  // Get nearby pharmacies (max 5, 8km radius)
  useEffect(() => {
    if (!userCoords) return;
    fetch(
      `${API_BASE_URL}/api/pharmacies/nearby?lat=${userCoords.lat}&lng=${userCoords.lng}&maxDistance=8000`
    )
      .then(res => res.json())
      .then(pharmacies => {
        const active = pharmacies.filter(ph => ph.active !== false).slice(0, 10);
        setPharmaciesNearby(active);

        // Always fetch top 8 for speed (for default display)
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

  // When a category is selected, fetch ALL medicines for all visible pharmacies, cache them
  useEffect(() => {
    if (!selectedCategory || pharmaciesNearby.length === 0) return;
    const pharmaciesToFetch = pharmaciesNearby.slice(0, 5).filter(ph => !allMedsByPharmacy[ph._id]);
    if (pharmaciesToFetch.length === 0) return;

    Promise.all(
      pharmaciesToFetch.map(ph =>
        fetch(`${API_BASE_URL}/api/medicines?pharmacyId=${ph._id}`)
          .then(res => res.json())
          .then(meds => ({ pharmacyId: ph._id, medicines: meds }))
          .catch(() => ({ pharmacyId: ph._id, medicines: [] }))
      )
    ).then(results => {
      setAllMedsByPharmacy(prev => {
        const newMap = { ...prev };
        results.forEach(r => { newMap[r.pharmacyId] = r.medicines; });
        return newMap;
      });
    });
    // eslint-disable-next-line
  }, [selectedCategory, pharmaciesNearby]);

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

  // CATEGORY BUTTON: timer robust
  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    setShowCategoryNotification(true);
    setShowFallbackMeds(false);
    if (popupTimeout.current) clearTimeout(popupTimeout.current);
    popupTimeout.current = setTimeout(() => {
      setShowCategoryNotification(false);
    }, 4000);
  };

  // Clean up popup timer on unmount
  useEffect(() => {
    return () => {
      if (popupTimeout.current) clearTimeout(popupTimeout.current);
      if (noMedicinesTimer.current) clearTimeout(noMedicinesTimer.current);
    };
  }, []);

  // Fallback: show "No medicines..." for 0.5s, then show all again
  useEffect(() => {
  if (!selectedCategory) {
    setShowFallbackMeds(false);
    if (noMedicinesTimer.current) clearTimeout(noMedicinesTimer.current);
    return;
  }
  // Use robust category check here!
  const noneHaveMeds = pharmaciesNearby.slice(0, 5).every(ph => {
    const meds = allMedsByPharmacy[ph._id] || [];
    return !meds.some(med => isMedicineInCategory(med, selectedCategory));
  });
  if (noneHaveMeds) {
    setShowFallbackMeds(false);
    if (noMedicinesTimer.current) clearTimeout(noMedicinesTimer.current);
    noMedicinesTimer.current = setTimeout(() => {
      setShowFallbackMeds(true);
    }, 500);
  } else {
    setShowFallbackMeds(false);
    if (noMedicinesTimer.current) clearTimeout(noMedicinesTimer.current);
  }
  return () => {
    if (noMedicinesTimer.current) clearTimeout(noMedicinesTimer.current);
  };
  // eslint-disable-next-line
}, [selectedCategory, pharmaciesNearby, allMedsByPharmacy, mostOrderedByPharmacy]);

  // GREET
  const greetUser = () => {
    const hour = new Date().getHours();
    const hello =
      hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    return `${hello}, ${user?.name?.split(" ")[0] || "Friend"}!`;
  };

  // MAIN filter: use allMedsByPharmacy for category, mostOrderedByPharmacy otherwise
  const filteredPharmacies = pharmaciesNearby.slice(0, 5).map(ph => {
  let allMeds = selectedCategory
    ? allMedsByPharmacy[ph._id] || []
    : mostOrderedByPharmacy[ph._id] || [];

  let filteredMeds = selectedCategory
    ? allMeds.filter(med => isMedicineInCategory(med, selectedCategory))
    : allMeds;

  if (selectedCategory && filteredMeds.length === 0 && showFallbackMeds) {
    filteredMeds = allMeds.slice(0, 8);
  }
  return {
    ...ph,
    medicines: filteredMeds,
    medCount: filteredMeds.length,
  };
})
.sort((a, b) => b.medCount - a.medCount);

  return (
    <div className="min-h-screen max-w-md mx-auto bg-gradient-to-br from-[#f8fbfc] via-white to-[#f5f8fa] pb-32 relative">
      <Navbar />

      {/* Offer Banner */}
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

      {/* Pharmacies Near You */}
      <div className="mt-5 px-4">
        <div className="flex items-center justify-between mb-2">
  <span
    className="font-extrabold text-lg text-[#13C0A2] flex items-center gap-1 cursor-pointer hover:underline"
    onClick={() => navigate("/pharmacies-near-you")}
    style={{ userSelect: "none" }}
    tabIndex={0}
    onKeyPress={e => { if (e.key === "Enter") navigate("/pharmacies-near-you"); }}
    role="button"
    aria-label="See all pharmacies near you"
  >
    Pharmacies Near You
  </span>
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

      {/* Categories */}
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

      {/* Fallback: Show no medicines message */}
      {selectedCategory && !showFallbackMeds && filteredPharmacies.every(ph => ph.medicines.length === 0) && (
  <div className="text-center text-gray-400 mt-8 text-lg font-semibold">
    No medicines available in "{selectedCategory}" category.<br />
    <span className="text-sm text-gray-400">Showing other available medicines...</span>
  </div>
)}

      {/* Medicines by pharmacy */}
      {(!selectedCategory || showFallbackMeds || filteredPharmacies.some(ph => ph.medicines.length > 0)) && (
        filteredPharmacies.map((ph, idx) =>
          ph.medicines.length > 0 ? (
            <div key={ph._id || idx} className="mt-10 px-4">
              <div className="flex items-center justify-between mb-2">
                <span
  className="font-extrabold text-lg text-[#187477] flex items-center gap-2 cursor-pointer hover:underline"
  onClick={() => navigate(`/medicines/${ph._id}`)}
  style={{ userSelect: "none" }}
  tabIndex={0}
  onKeyPress={e => { if (e.key === "Enter") navigate(`/medicines/${ph._id}`); }}
  role="button"
  aria-label={`View all medicines at ${ph.name}`}
>
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
          ) : null
        )
      )}

      {/* Order Again */}
      <div className="mt-12 px-4">
  <div className="font-extrabold text-base mb-2 text-[#187477] flex items-center gap-2">
    Order Again
  </div>
  <div className="rounded-2xl shadow-3xl px-4 py-6 flex flex-col items-center gap-2 bg-white/90 backdrop-blur ring-1 ring-[#e1f0fa]/70">
    <div className="font-extrabold text-[17px] text-[#187477] mb-1 text-center">Your last order</div>
    <div className="text-[14px] text-neutral-400 text-center">
  {lastOrder && Array.isArray(lastOrder.items) && lastOrder.items.length
    ? lastOrder.items
        .map(i => `${i.name || i.medicineName} x${i.quantity || i.qty || 1}`)
        .join(", ")
    : "No recent orders"}
</div>

    <div className="flex gap-2 mt-4 justify-center">
      <button
        className="bg-gradient-to-r from-[#13C0A2] to-[#6decb9] text-white font-bold shadow-lg rounded-full px-5 py-2 hover:scale-105 transition"
        onClick={() => navigate("/orders")}
      >
        Order Again
      </button>
    </div>
  </div>
</div>

<PrescriptionUploadModal
  open={prescriptionModalOpen}
  onClose={() => setPrescriptionModalOpen(false)}
  userCity={localStorage.getItem("city") || "Mumbai"}
/>

<div
  className="fixed right-0 left-0 z-[1201] flex justify-end px-5 transition-all duration-300"
  style={{
    bottom: cart.length > 0 ? 120 : 70, // <- tweak these values as per your bars
    pointerEvents: "none", // ensures children handle clicks but not this container
  }}
>
  <button
    className="pointer-events-auto flex items-center gap-2 rounded-full px-6 py-3 bg-[#13C0A2] text-white font-bold shadow-xl hover:bg-[#0e9c87] transition-all duration-150"
    onClick={() => setPrescriptionModalOpen(true)}
    style={{ fontSize: "16px" }}
  >
    <img src={ICONS.upload} alt="Upload" className="w-6 h-6" />
    Upload Prescription
  </button>
</div>

<BottomNavBar />

    </div>
  );
}
