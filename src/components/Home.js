// src/components/Home.js
import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import { useLocation } from "../context/LocationContext";
import BottomNavBar from "./BottomNavBar";
import PrescriptionUploadModal from "./PrescriptionUploadModal";
import Navbar from "./Navbar";
import {
  UploadCloud,
  Pill,
  Stethoscope,
  Clock,
  ChevronRight,
  MapPin,
} from "lucide-react";

function isMedicineInCategory(med, selectedCategory) {
  if (!med || !selectedCategory) return false;
  const target = selectedCategory.trim().toLowerCase();
  let cats = [];
  if (typeof med.category === "string") cats.push(med.category);
  if (Array.isArray(med.category)) cats = cats.concat(med.category);
  if (Array.isArray(med.categories)) cats = cats.concat(med.categories);
  cats = cats.filter(Boolean).map((x) => String(x).toLowerCase());
  return cats.some((c) => c.includes(target) || target.includes(c));
}

const ICONS = {
  pharmacy: "/images/pharmacy-modern.png",
  medicine: "/images/medicine-modern.svg",
  offer: "/images/offer-modern.svg",
  upload: "/images/upload-modern.svg",
  pill: "/images/pill-modern.svg",
};

const categories = [
  "Fever",
  "Diabetes",
  "Cold",
  "Heart",
  "Antibiotic",
  "Ayurveda",
  "Painkiller",
  "Cough",
];
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

/* ---------- Horizontal medicine card (image left, details right) ---------- */
function MedCard({ med, onAdd }) {
  const [src, setSrc] = useState(
    med.img || med.image || med.imageUrl || ICONS.medicine
  );

  const price =
    med.price ?? med.mrp ?? med.sellingPrice ?? med.salePrice ?? "--";

  return (
    <div className="min-w-[260px] max-w-[260px] h-[106px] rounded-2xl bg-white/95 ring-1 ring-[var(--pillo-surface-border)] shadow-sm flex items-center p-3 gap-3 cursor-pointer active:scale-[0.99] transition">
      {/* BIG thumbnail */}
      <div className="h-[78px] w-[86px] rounded-xl bg-white ring-1 ring-[var(--pillo-surface-border)] shadow-sm overflow-hidden grid place-items-center">
        <img
          src={src}
          alt={med.name}
          loading="lazy"
          onError={() => setSrc(ICONS.medicine)}
          className="h-full w-full object-contain"
        />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div
          className="text-[14.5px] font-bold text-[var(--pillo-active-text)]"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {med.name || med.medicineName || "Medicine"}
        </div>

        <div className="mt-0.5 text-[13px] font-semibold text-[var(--pillo-active-text)]">
          ₹{price}
        </div>

        <div className="mt-1 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-[var(--pillo-active-text)] ring-1 ring-[var(--pillo-surface-border)]">
            <Clock className="h-3 w-3" /> ≤ 30 min
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd(med);
            }}
            className="rounded-full bg-[var(--pillo-active-text)] text-white text-[12px] font-bold px-3 py-1.5 shadow hover:brightness-105"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [pharmaciesNearby, setPharmaciesNearby] = useState([]);
  const [mostOrderedByPharmacy, setMostOrderedByPharmacy] = useState({});
  const { user } = useAuth();
  const { cart, addToCart } = useCart();
  const navigate = useNavigate();
  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  const { currentAddress } = useLocation();
  const [userCoords, setUserCoords] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const popupTimeout = useRef(null);
  const [showFallbackMeds, setShowFallbackMeds] = useState(false);
  const noMedicinesTimer = useRef(null);
  const [lastOrder, setLastOrder] = useState(null);
  const dockBottom = `calc(${
    cart.length > 0 ? 144 : 72
  }px + env(safe-area-inset-bottom, 0px) + 12px)`;
  const [allMedsByPharmacy, setAllMedsByPharmacy] = useState({});

  /* === ADDED: state + helper for active order (expanded statuses) === */
  const ACTIVE_STATUSES = new Set([
    "pending",
    "placed",
    "quoted",
    "processing",
    "assigned",
    "accepted",
    "picked_up",
    "out_for_delivery",
  ]);
  const [activeOrder, setActiveOrder] = useState(null);

  function statusLabel(s) {
    return s === "pending"
      ? "Pending"
      : s === "placed"
      ? "Order Placed"
      : s === "quoted"
      ? "Quoted"
      : s === "processing"
      ? "Processing"
      : s === "assigned"
      ? "Assigned"
      : s === "accepted"
      ? "Accepted"
      : s === "picked_up"
      ? "Picked Up"
      : s === "out_for_delivery"
      ? "Out for Delivery"
      : s === "delivered"
      ? "Delivered"
      : s;
  }
  /* === /ADDED === */

  useEffect(() => {
    if (currentAddress?.lat && currentAddress?.lng) {
      setUserCoords({ lat: currentAddress.lat, lng: currentAddress.lng });
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setUserCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        () => setUserCoords(null)
      );
    }
  }, [currentAddress]);

  useEffect(() => {
    async function fetchLastOrder() {
      if (!user?._id && !user?.userId) return;
      const userId = user._id || user.userId;
      const res = await fetch(
        `${API_BASE_URL}/api/allorders/myorders-userid/${userId}`
      );
      const orders = await res.json();
      if (Array.isArray(orders) && orders.length > 0) setLastOrder(orders[0]);
    }
    fetchLastOrder();
  }, [user]);

  /* === ADDED: effect to load active order === */
  useEffect(() => {
    async function getActive() {
      const idFromLS = localStorage.getItem("activeOrderId");
      try {
        if (idFromLS) {
          const r = await fetch(`${API_BASE_URL}/api/orders/${idFromLS}`);
          if (r.ok) {
            const o = await r.json();
            if (ACTIVE_STATUSES.has(o.status)) {
              setActiveOrder(o);
              return;
            }
          }
          // not active anymore
          localStorage.removeItem("activeOrderId");
        }
      } catch {}

      // fallback: look at user’s recent orders and pick the first active one
      if (!user?._id && !user?.userId) return;
      const userId = user._id || user.userId;
      try {
        const r = await fetch(
          `${API_BASE_URL}/api/allorders/myorders-userid/${userId}`
        );
        const orders = await r.json();
        if (Array.isArray(orders) && orders.length) {
          // prefer the most recently updated active order
          const active = orders
            .filter((o) => ACTIVE_STATUSES.has(o.status))
            .sort(
              (a, b) =>
                new Date(b.updatedAt || b.createdAt) -
                new Date(a.updatedAt || a.createdAt)
            )[0];
          if (active) {
            setActiveOrder(active);
            localStorage.setItem("activeOrderId", active._id);
            return;
          }
        }
        setActiveOrder(null);
      } catch {
        /* ignore */
      }
    }
    getActive();
  }, [user]);
  /* === /ADDED === */

  useEffect(() => {
    if (!userCoords) return;
    fetch(`${API_BASE_URL}/api/pharmacies/nearby?lat=${userCoords.lat}&lng=${userCoords.lng}&maxDistance=8000`)
      .then(async (res) => {
      if (!res.ok) throw new Error(`Nearby pharmacies HTTP ${res.status}`);
      return res.json();
      })
      .then((pharmacies) => {
        const active = pharmacies
          .filter((ph) => ph.active !== false)
          .slice(0, 10);
        setPharmaciesNearby(active);
        Promise.all(
          active.slice(0, 5).map((ph) =>
            fetch(`${API_BASE_URL}/api/medicines?pharmacyId=${ph._id}`)
              .then((res) => res.json())
              .then((meds) => ({
                pharmacyId: ph._id,
                medicines: meds.slice(0, 8),
              }))
              .catch(() => ({ pharmacyId: ph._id, medicines: [] }))
          )
        ).then((results) => {
          const map = {};
          results.forEach((r) => {
            map[r.pharmacyId] = r.medicines;
          });
          setMostOrderedByPharmacy(map);
        });
      });
  }, [userCoords]);

  useEffect(() => {
    if (!selectedCategory || pharmaciesNearby.length === 0) return;
    const pharmaciesToFetch = pharmaciesNearby
      .slice(0, 5)
      .filter((ph) => !allMedsByPharmacy[ph._id]);
    if (pharmaciesToFetch.length === 0) return;

    Promise.all(
      pharmaciesToFetch.map((ph) =>
        fetch(`${API_BASE_URL}/api/medicines?pharmacyId=${ph._id}`)
          .then((res) => res.json())
          .then((meds) => ({ pharmacyId: ph._id, medicines: meds }))
          .catch(() => ({ pharmacyId: ph._id, medicines: [] }))
      )
    ).then((results) => {
      setAllMedsByPharmacy((prev) => {
        const newMap = { ...prev };
        results.forEach((r) => {
          newMap[r.pharmacyId] = r.medicines;
        });
        return newMap;
      });
    });
    // eslint-disable-next-line
  }, [selectedCategory, pharmaciesNearby]);

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

  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    setShowFallbackMeds(false);
    if (popupTimeout.current) clearTimeout(popupTimeout.current);
    popupTimeout.current = setTimeout(() => {}, 3000);
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
    const noneHaveMeds = pharmaciesNearby.slice(0, 5).every((ph) => {
      const meds = allMedsByPharmacy[ph._id] || [];
      return !meds.some((med) => isMedicineInCategory(med, selectedCategory));
    });
    if (noneHaveMeds) {
      setShowFallbackMeds(false);
      if (noMedicinesTimer.current) clearTimeout(noMedicinesTimer.current);
      noMedicinesTimer.current = setTimeout(
        () => setShowFallbackMeds(true),
        500
      );
    } else {
      setShowFallbackMeds(false);
      if (noMedicinesTimer.current) clearTimeout(noMedicinesTimer.current);
    }
    return () => {
      if (noMedicinesTimer.current) clearTimeout(noMedicinesTimer.current);
    };
    // eslint-disable-next-line
  }, [
    selectedCategory,
    pharmaciesNearby,
    allMedsByPharmacy,
    mostOrderedByPharmacy,
  ]);

  const filteredPharmacies = pharmaciesNearby
    .slice(0, 5)
    .map((ph) => {
      let allMeds = selectedCategory
        ? allMedsByPharmacy[ph._id] || []
        : mostOrderedByPharmacy[ph._id] || [];
      let filteredMeds = selectedCategory
        ? allMeds.filter((med) => isMedicineInCategory(med, selectedCategory))
        : allMeds;
      if (selectedCategory && filteredMeds.length === 0 && showFallbackMeds)
        filteredMeds = allMeds.slice(0, 8);
      return { ...ph, medicines: filteredMeds, medCount: filteredMeds.length };
    })
    .sort((a, b) => b.medCount - a.medCount);

  return (
    <div className="min-h-screen max-w-md mx-auto bg-[var(--pillo-page-bg,linear-gradient(180deg,#f9fbff,white))] pb-32 relative">
      {/* TOP NAV */}
      <Navbar />

      {/* QUICK ACTIONS — pill buttons */}
      <div className="px-4 mt-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Upload Rx",
              icon: <UploadCloud className="h-5 w-5" />,
              onClick: () => setPrescriptionModalOpen(true),
            },
            {
              label: "Medicines",
              icon: <Pill className="h-5 w-5" />,
              onClick: () => navigate("/pharmacies-near-you"),
            },
            {
              label: "Consult",
              icon: <Stethoscope className="h-5 w-5" />,
              onClick: () => navigate("/doctors"),
            },
          ].map((act) => (
            <motion.button
              key={act.label}
              whileTap={{ scale: 0.98 }}
              whileHover={{ y: -2 }}
              onClick={act.onClick}
              className="flex flex-col items-center justify-center rounded-2xl bg-white/90 backdrop-blur ring-1 ring-[var(--pillo-surface-border)] px-2 py-3 shadow-sm"
            >
              <div className="inline-flex items-center justify-center rounded-xl bg-white text-[var(--pillo-active-text)] ring-1 ring-[var(--pillo-surface-border)] p-2 mb-1">
                {act.icon}
              </div>
              <span className="text-[12.5px] font-semibold text-[var(--pillo-active-text)]">
                {act.label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* STATUS STRIP (bold line) */}
      <div className="px-4 mt-3">
        <div className="flex items-center justify-between rounded-xl bg-white/90 backdrop-blur ring-1 ring-[var(--pillo-surface-border)] px-3 py-2 text-[12.5px] text-[var(--pillo-active-text)] shadow-sm font-bold">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-[var(--pillo-icon-accent)]" />
            <span>{pharmaciesNearby.length} pharmacies near you</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-[var(--pillo-icon-accent)]" />
            <span>≤ 30 min delivery</span>
          </div>
        </div>
      </div>

      {/* Track Order CTA */}
      {activeOrder && (
        <div className="px-4 mt-3">
          <button
            onClick={() => navigate(`/order-tracking/${activeOrder._id}`)}
            className="w-full flex items-center justify-between rounded-2xl bg-emerald-600 text-white px-4 py-3 shadow-lg active:scale-[0.99]"
          >
            <div className="text-left">
              <div className="text-sm font-extrabold">Track current order</div>
              <div className="text-xs text-emerald-100">
                Status: {statusLabel(activeOrder.status)} · Tap to view live map
              </div>
            </div>
            <span className="inline-flex items-center justify-center h-9 px-3 text-sm font-bold bg-white text-emerald-700 rounded-full">
              Track
            </span>
          </button>
        </div>
      )}

      {/* PHARMACIES NEAR YOU (no extra arrow) */}
      <div className="mt-6 px-4">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate("/pharmacies-near-you")}
            className="font-extrabold text-[17px] text-[var(--pillo-active-text)]"
          >
            Pharmacies Near You
          </button>
          <button
            className="text-[var(--pillo-active-text)] text-[14px] font-bold hover:underline"
            onClick={() => navigate("/pharmacies-near-you")}
          >
            See all &gt;
          </button>
        </div>
        <div className="flex gap-4 pb-2 snap-x overflow-x-auto">
          {pharmaciesNearby.slice(0, 10).map((ph, idx) => (
            <div
              key={ph._id || idx}
              className="min-w-[120px] max-w-[140px] px-2 py-6 flex flex-col items-center rounded-2xl shadow-2xl bg-white/90 backdrop-blur ring-1 ring-[var(--pillo-surface-border)] hover:bg-white cursor-pointer transition hover:scale-105 snap-center"
              onClick={() => navigate(`/medicines/${ph._id}`)}
            >
              <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-white ring-1 ring-[var(--pillo-surface-border)] mb-2 shadow">
                <img src={ICONS.pharmacy} className="w-7 h-7" alt="Pharmacy" />
              </span>
              <div className="font-semibold text-[15px] truncate text-center text-[var(--pillo-active-text)]">
                {ph.name}
              </div>
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

      {/* CATEGORIES */}
      <div className="mt-7 px-4">
        <div className="font-extrabold text-base mb-2 text-[var(--pillo-active-text)]">
          Categories
        </div>
        <div className="flex gap-3 pb-1 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className="flex items-center gap-2 rounded-full px-5 py-2 font-bold text-sm border-0 shadow-lg transition hover:scale-105 bg-white/90 text-[var(--pillo-active-text)] ring-1 ring-[var(--pillo-surface-border)]"
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Fallback message */}
      {selectedCategory &&
        !showFallbackMeds &&
        filteredPharmacies.every((ph) => ph.medicines.length === 0) && (
          <div className="text-center text-gray-400 mt-8 text-lg font-semibold">
            No medicines available in "{selectedCategory}" category.
            <br />
            <span className="text-sm text-gray-400">
              Showing other available medicines...
            </span>
          </div>
        )}

      {/* MEDICINES BY PHARMACY (horizontal image-first cards) */}
      {(!selectedCategory ||
        showFallbackMeds ||
        filteredPharmacies.some((ph) => ph.medicines.length > 0)) &&
        filteredPharmacies.map((ph, idx) =>
          ph.medicines.length > 0 ? (
            <div key={ph._id || idx} className="mt-10 px-4">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => navigate(`/medicines/${ph._id}`)}
                  className="font-extrabold text-lg text-[var(--pillo-active-text)] inline-flex items-center gap-2"
                >
                  Medicines at {ph.name}
                </button>
                <button
                  className="text-[var(--pillo-active-text)] text-[15px] font-bold hover:underline"
                  onClick={() => navigate(`/medicines/${ph._id}`)}
                >
                  View All &gt;
                </button>
              </div>

              <div className="flex gap-3 pb-2 snap-x overflow-x-auto">
                {ph.medicines.map((med, mi) => (
                  <div
                    key={med._id || mi}
                    className="snap-center"
                    onClick={() => navigate(`/medicines/${ph._id}`)}
                  >
                    <MedCard med={med} onAdd={handleAddToCart} />
                  </div>
                ))}
              </div>
            </div>
          ) : null
        )}

      {/* DOCTORS */}
      <div className="mt-10 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-extrabold text-base text-[var(--pillo-active-text)]">
            Consult Nearby Doctors
          </span>
          <button
            className="text-[var(--pillo-active-text)] text-[15px] font-bold hover:underline inline-flex items-center gap-1"
            onClick={() => navigate("/doctors")}
          >
            View All <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
          {[
            { name: "Dr. Sharma", spec: "General Physician" },
            { name: "Dr. Gupta", spec: "Pediatrics" },
            { name: "Dr. Iyer", spec: "Dermatology" },
          ].map((d, i) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.98 }}
              className="min-w-[180px] snap-center text-left rounded-2xl bg-white/90 backdrop-blur ring-1 ring-[var(--pillo-surface-border)] shadow px-4 py-3"
              onClick={() => navigate("/doctors")}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white ring-1 ring-[var(--pillo-surface-border)] inline-flex items-center justify-center">
                  <Stethoscope className="h-5 w-5 text-[var(--pillo-active-text)]" />
                </div>
                <div>
                  <div className="font-semibold text-[var(--pillo-active-text)]">
                    {d.name}
                  </div>
                  <div className="text-[12.5px] text-neutral-500">{d.spec}</div>
                </div>
              </div>
              <div className="mt-3">
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--pillo-active-text)] bg-white px-2 py-1 rounded-full ring-1 ring-[var(--pillo-surface-border)]">
                  <Clock className="h-3.5 w-3.5" /> Slots today
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ORDER AGAIN */}
      <div className="mt-12 px-4">
        <div className="font-extrabold text-base mb-2 text-[var(--pillo-active-text)] flex items-center gap-2">
          Order Again
        </div>
        <div className="rounded-2xl shadow-3xl px-4 py-6 flex flex-col items-center gap-2 bg-white/90 backdrop-blur ring-1 ring-[var(--pillo-surface-border)]">
          <div className="font-extrabold text-[17px] text-[var(--pillo-active-text)] mb-1 text-center">
            Your last order
          </div>
          <div className="text-[14px] text-neutral-500 text-center">
            {lastOrder && Array.isArray(lastOrder.items) && lastOrder.items.length
              ? lastOrder.items
                  .map(
                    (i) =>
                      `${i.name || i.medicineName} x${
                        i.quantity || i.qty || 1
                      }`
                  )
                  .join(", ")
              : "No recent orders"}
          </div>
          <div className="flex gap-2 mt-4 justify-center">
            <button
              className="bg-[var(--pillo-active-text)] text-white font-bold shadow-lg rounded-full px-5 py-2 hover:brightness-105 transition"
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

      {/* FLOATING CTA */}
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
          className="pointer-events-auto group inline-flex items-center gap-2 rounded-full pl-3 pr-4 py-2.5 shadow-[0_10px_24px_rgba(16,185,129,0.35)] bg-[var(--pillo-active-text)] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/80 hover:brightness-[1.03] active:scale-[0.99]"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[var(--pillo-active-text)] ring-1 ring-white/70 backdrop-blur group-hover:bg-white transition">
            <UploadCloud className="h-4.5 w-4.5" />
          </span>
          <span className="text-[15px] font-bold">Upload Prescription</span>
        </button>
      </motion.div>

      <BottomNavBar />
    </div>
  );
}
