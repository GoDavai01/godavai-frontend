import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import { useLocation } from "../context/LocationContext";
import BottomNavBar from "./BottomNavBar";
import PrescriptionUploadModal from "./PrescriptionUploadModal";
import Navbar from "./Navbar";
import { UploadCloud, Pill, Stethoscope, Clock, ChevronRight, MapPin } from "lucide-react";

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

const ICONS = {
  pharmacy: "/images/pharmacy-modern.png",
  medicine: "/images/medicine-modern.svg",
  offer: "/images/offer-modern.svg",
  upload: "/images/upload-modern.svg",
  pill: "/images/pill-modern.svg",
};

const categories = ["Fever","Diabetes","Cold","Heart","Antibiotic","Ayurveda","Painkiller","Cough"];
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
  const dockBottom = `calc(${cart.length > 0 ? 144 : 72}px + env(safe-area-inset-bottom, 0px) + 12px)`;

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
      if (Array.isArray(orders) && orders.length > 0) setLastOrder(orders[0]);
    }
    fetchLastOrder();
  }, [user]);

  useEffect(() => {
    if (!userCoords) return;
    fetch(`${API_BASE_URL}/api/pharmacies/nearby?lat=${userCoords.lat}&lng=${userCoords.lng}&maxDistance=8000`)
      .then(res => res.json())
      .then(pharmacies => {
        const active = pharmacies.filter(ph => ph.active !== false).slice(0, 10);
        setPharmaciesNearby(active);
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

  const handleAddToCart = (med) => {
    if (cart.length > 0) {
      const cartPharmacyId = cart[0]?.pharmacy?._id || cart[0]?.pharmacy;
      if (med.pharmacy?._id !== cartPharmacyId && med.pharmacy !== cartPharmacyId) {
        alert("You can only order medicines from one pharmacy at a time.");
        return;
      }
    }
    addToCart(med);
  };

  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    setShowCategoryNotification(true);
    setShowFallbackMeds(false);
    if (popupTimeout.current) clearTimeout(popupTimeout.current);
    popupTimeout.current = setTimeout(() => setShowCategoryNotification(false), 4000);
  };

  useEffect(() => {
    return () => {
      if (popupTimeout.current) clearTimeout(popupTimeout.current);
      if (noMedicinesTimer.current) clearTimeout(noMedicinesTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!selectedCategory) {
      setShowFallbackMeds(false);
      if (noMedicinesTimer.current) clearTimeout(noMedicinesTimer.current);
      return;
    }
    const noneHaveMeds = pharmaciesNearby.slice(0, 5).every(ph => {
      const meds = allMedsByPharmacy[ph._id] || [];
      return !meds.some(med => isMedicineInCategory(med, selectedCategory));
    });
    if (noneHaveMeds) {
      setShowFallbackMeds(false);
      if (noMedicinesTimer.current) clearTimeout(noMedicinesTimer.current);
      noMedicinesTimer.current = setTimeout(() => setShowFallbackMeds(true), 500);
    } else {
      setShowFallbackMeds(false);
      if (noMedicinesTimer.current) clearTimeout(noMedicinesTimer.current);
    }
    return () => { if (noMedicinesTimer.current) clearTimeout(noMedicinesTimer.current); };
    // eslint-disable-next-line
  }, [selectedCategory, pharmaciesNearby, allMedsByPharmacy, mostOrderedByPharmacy]);

  const greetUser = () => {
    const hour = new Date().getHours();
    const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    return `${hello}, ${user?.name?.split(" ")[0] || "Friend"}!`;
  };

  const filteredPharmacies = pharmaciesNearby.slice(0, 5).map(ph => {
    let allMeds = selectedCategory ? allMedsByPharmacy[ph._id] || [] : mostOrderedByPharmacy[ph._id] || [];
    let filteredMeds = selectedCategory ? allMeds.filter(med => isMedicineInCategory(med, selectedCategory)) : allMeds;
    if (selectedCategory && filteredMeds.length === 0 && showFallbackMeds) filteredMeds = allMeds.slice(0, 8);
    return { ...ph, medicines: filteredMeds, medCount: filteredMeds.length };
  }).sort((a, b) => b.medCount - a.medCount);

  return (
    <div className="min-h-screen max-w-md mx-auto bg-gradient-to-br from-[#f8fbfc] via-white to-[#f5f8fa] pb-32 relative">
      <Navbar />

      {/* Quick Actions */}
      <div className="px-4 mt-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Upload Rx", icon: <UploadCloud className="h-5 w-5" />, onClick: () => setPrescriptionModalOpen(true) },
            { label: "Medicines", icon: <Pill className="h-5 w-5" />, onClick: () => navigate("/pharmacies-near-you") },
            { label: "Consult", icon: <Stethoscope className="h-5 w-5" />, onClick: () => navigate("/doctors") },
          ].map(act => (
            <motion.button
              key={act.label}
              whileTap={{ scale: 0.98 }}
              whileHover={{ y: -2 }}
              onClick={act.onClick}
              className="flex flex-col items-center justify-center rounded-2xl bg-white/90 backdrop-blur ring-1 ring-[#e1f0fa]/70 px-2 py-3 shadow-sm"
            >
              <div className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-teal-100 to-emerald-100 p-2 mb-1">
                {act.icon}
              </div>
              <span className="text-[12.5px] font-semibold text-teal-700">{act.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Offer Banner */}
      <div className="px-4 pt-5 pb-0">
        <AnimatePresence>
          <motion.div initial={{ y: -18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -32, opacity: 0 }}>
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

      {/* Status strip */}
      <div className="px-4 mt-2">
        <div className="flex items-center justify-between rounded-xl bg-white/90 backdrop-blur ring-1 ring-[#e1f0fa]/70 px-3 py-2 text-[12.5px] text-teal-700">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            <span>{pharmaciesNearby.length} pharmacies near you</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            <span>≤ 30 min delivery</span>
          </div>
        </div>
      </div>

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
          <button className="text-[#13C0A2] text-[15px] font-bold hover:underline" onClick={() => navigate("/pharmacies-near-you")}>
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
                {ph.dist?.calculated ? (ph.dist.calculated > 1000 ? `${(ph.dist.calculated / 1000).toFixed(1)} km` : `<1 km`) : "--"}
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
              className={`flex items-center gap-2 rounded-full px-5 py-2 font-bold text-sm border-0 shadow-lg transition hover:scale-105 ${
                i % 2 === 0
                  ? "bg-gradient-to-r from-[#eafcf4]/80 to-[#d7ede4]/80 text-[#13C0A2] ring-1 ring-[#13C0A2]/10"
                  : "bg-gradient-to-r from-[#fff8e1]/80 to-[#ffe9b3]/90 text-[#e8950c] ring-1 ring-[#FFD43B]/10"
              } hover:bg-white/90`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Fallback message */}
      {selectedCategory && !showFallbackMeds && filteredPharmacies.every(ph => ph.medicines.length === 0) && (
        <div className="text-center text-gray-400 mt-8 text-lg font-semibold">
          No medicines available in "{selectedCategory}" category.<br />
          <span className="text-sm text-gray-400">Showing other available medicines...</span>
        </div>
      )}

      {/* Medicines by pharmacy */}
      {(!selectedCategory || showFallbackMeds || filteredPharmacies.some(ph => ph.medicines.length > 0)) &&
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
                <button className="text-[#13C0A2] text-[15px] font-bold hover:underline" onClick={() => navigate(`/medicines/${ph._id}`)}>
                  View All &gt;
                </button>
              </div>

              <div className="flex gap-4 pb-2 snap-x overflow-x-auto">
                {ph.medicines.map((med, mi) => (
                  <div
                    key={med._id || mi}
                    className="relative min-w-[130px] max-w-[150px] px-3 pt-5 pb-4 flex flex-col items-center rounded-2xl shadow-xl bg-white/90 backdrop-blur ring-1 ring-[#e1f0fa]/60 hover:bg-[#e1f7fa]/70 cursor-pointer transition hover:scale-105 snap-center"
                    onClick={() => navigate(`/medicines/${ph._id}`)}
                  >
                    {/* FIXED: anchored badge */}
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full shadow">
                      <Clock className="h-3 w-3" /> ≤ 30 min
                    </span>

                    <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-tr from-[#e8f9f3] to-[#d1f2eb] mb-2 shadow">
                      <img src={med.img || ICONS.medicine} className="w-7 h-7" alt="Medicine" />
                    </span>
                    <div className="font-semibold text-[15px] truncate text-center text-[#187477]">{med.name}</div>
                    <div className="text-xs text-[#13C0A2] font-semibold">₹{med.price}</div>
                    <button
                      className="mt-1 px-4 py-1 text-xs bg-[#13C0A2] rounded-full text-white font-bold shadow hover:bg-[#0e9c87] transition"
                      onClick={(e) => { e.stopPropagation(); handleAddToCart(med); }}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null
        )
      }

      {/* Moved to bottom: Doctors teaser */}
      <div className="mt-10 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-extrabold text-base text-[#187477]">Consult Nearby Doctors</span>
          <button
            className="text-[#13C0A2] text-[15px] font-bold hover:underline inline-flex items-center gap-1"
            onClick={() => navigate("/doctors")}
          >
            View All <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
          {[{ name: "Dr. Sharma", spec: "General Physician" }, { name: "Dr. Gupta", spec: "Pediatrics" }, { name: "Dr. Iyer", spec: "Dermatology" }].map((d, i) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.98 }}
              className="min-w-[180px] snap-center text-left rounded-2xl bg-white/90 backdrop-blur ring-1 ring-[#e1f0fa]/70 shadow px-4 py-3"
              onClick={() => navigate("/doctors")}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-teal-100 to-emerald-100 inline-flex items-center justify-center">
                  <Stethoscope className="h-5 w-5 text-teal-700" />
                </div>
                <div>
                  <div className="font-semibold text-[#187477]">{d.name}</div>
                  <div className="text-[12.5px] text-neutral-500">{d.spec}</div>
                </div>
              </div>
              <div className="mt-3">
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-teal-700 bg-teal-50 px-2 py-1 rounded-full">
                  <Clock className="h-3.5 w-3.5" /> Slots today
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Order Again */}
      <div className="mt-12 px-4">
        <div className="font-extrabold text-base mb-2 text-[#187477] flex items-center gap-2">Order Again</div>
        <div className="rounded-2xl shadow-3xl px-4 py-6 flex flex-col items-center gap-2 bg-white/90 backdrop-blur ring-1 ring-[#e1f0fa]/70">
          <div className="font-extrabold text-[17px] text-[#187477] mb-1 text-center">Your last order</div>
          <div className="text-[14px] text-neutral-400 text-center">
            {lastOrder && Array.isArray(lastOrder.items) && lastOrder.items.length
              ? lastOrder.items.map(i => `${i.name || i.medicineName} x${i.quantity || i.qty || 1}`).join(", ")
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

      {/* Floating Upload Prescription CTA — right aligned, screenshot icon */}
<motion.div
  className="fixed right-0 left-0 z-[1201] flex justify-end px-5"
  style={{ bottom: dockBottom, pointerEvents: "none" }}
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.18, ease: "easeOut" }}
>
  <button
    type="button"
    aria-label="Upload Prescription"
    onClick={() => setPrescriptionModalOpen(true)}
    className="
      pointer-events-auto
      group inline-flex items-center gap-2
      rounded-full pl-3 pr-4 py-2.5
      shadow-[0_10px_24px_rgba(16,185,129,0.35)]
      bg-gradient-to-r from-emerald-500 to-teal-500 text-white
      focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/80
      hover:brightness-[1.03] active:scale-[0.99]
    "
  >
    <span
      className="
        inline-flex h-8 w-8 items-center justify-center rounded-full
        bg-white/90 text-emerald-600
        ring-1 ring-white/70
        backdrop-blur
        group-hover:bg-white
        transition
      "
    >
      {/* Use Lucide icon; if you prefer your PNG, swap this span with your <img src={ICONS.upload} .../> */}
      <UploadCloud className="h-4.5 w-4.5" />
    </span>
    <span className="text-[15px] font-bold">Upload Prescription</span>
  </button>
</motion.div>

      <BottomNavBar />
    </div>
  );
}
