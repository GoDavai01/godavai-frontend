"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent } from "../components/ui/dialog";
import { useLocation } from "../context/LocationContext";
import { useNavigate } from "react-router-dom";
import { Pill, MapPin, UploadCloud, CheckCircle, Timer } from "lucide-react";
import PrescriptionUploadModal from "../components/PrescriptionUploadModal";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export default function PharmaciesNearYou() {
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canDeliver, setCanDeliver] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const navigate = useNavigate();
  const { currentAddress } = useLocation();

  // Fetch pharmacies when address changes
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

  // Check if delivery is available
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
    <div className="bg-gradient-to-br from-[#f9fafb] to-[#eafcf4] min-h-screen pb-24 pt-4">
      <div className="max-w-md mx-auto px-2">
        {/* Offer banner */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center gap-2 bg-[#eafcf4] text-[#13C0A2] font-extrabold text-base rounded-xl px-4 py-3 mb-4 shadow-sm mx-2"
        >
          <span className="text-[#FFD43B] text-2xl">⚡</span>
          <span>
            Flat 15% OFF on health supplements! Use code <b>HEALTH15</b>
          </span>
        </motion.div>

        {/* Heading */}
        <div className="flex items-center gap-2 mb-1 mx-2">
          <Pill className="text-[#FFD43B] w-7 h-7" />
          <span className="font-extrabold text-xl tracking-tight text-[#1199a6]">
            Pharmacies Near You
          </span>
          {currentAddress?.formatted && (
            <Badge
              variant="secondary"
              className="bg-[#13C0A2] text-white ml-2 font-bold text-xs rounded-lg px-2 pointer-events-none select-none"
            >
              {currentAddress.formatted.length > 23
                ? currentAddress.formatted.slice(0, 23) + "..."
                : currentAddress.formatted}
            </Badge>
          )}
        </div>

        <div className="border-b border-gray-100 my-2" />

        {/* Delivery warning */}
        {!canDeliver && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-red-50 text-red-700 p-3 rounded-lg my-3 text-center font-bold text-sm flex flex-col items-center"
          >
            <span className="text-2xl mb-1">⛔</span>
            Sorry, no delivery partner is available at your location right now.
            <br />
            Please try again soon.
          </motion.div>
        )}

        {/* Pharmacy list */}
        <div className="px-2 pt-1">
          {loading ? (
            <div className="text-gray-400 mt-10 text-center animate-pulse">
              Loading pharmacies...
            </div>
          ) : pharmacies.length === 0 ? (
            <div className="text-gray-400 mt-10 text-center">
              No pharmacies found near your location.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <AnimatePresence>
                {pharmacies.map((pharmacy) => (
                  <motion.div
                    key={pharmacy._id}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 140, damping: 20 }}
                  >
                    <Card
                      className={`flex items-center gap-4 rounded-2xl shadow-md p-4 bg-white cursor-pointer transition hover:shadow-xl hover:bg-gray-50 ${
                        canDeliver ? "opacity-100" : "opacity-60 pointer-events-none"
                      }`}
                      onClick={() => canDeliver && navigate(`/medicines/${pharmacy._id}`)}
                    >
                      {/* Pharmacy icon */}
                      <div className="w-14 h-14 flex items-center justify-center rounded-xl bg-[#e8faf7] mr-2 shrink-0">
                        <img
                          src="/pharmacy-icon.png"
                          alt="Pharmacy"
                          className="w-8 h-8 object-contain"
                        />
                      </div>
                      {/* Pharmacy details */}
                      <div className="flex-1 min-w-0">
                        <div
                          className="font-bold text-[#138a72] text-base truncate"
                          title={pharmacy.name}
                        >
                          {pharmacy.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate">
                          {pharmacy.address?.area || pharmacy.area}
                        </div>
                        <div className="flex gap-2 mt-1">
                          <Badge className="bg-[#13C0A2]/10 text-[#13C0A2] font-bold text-xs">
                            <Timer className="w-4 h-4 mr-1 inline-block" /> 13–29 min
                          </Badge>
                          <Badge className="bg-[#FFD43B]/10 text-[#f49f00] font-bold text-xs">
                            <CheckCircle className="w-4 h-4 mr-1 inline-block" /> Verified
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <div className="flex items-center gap-1 text-xs text-yellow-500 font-bold">
                          {/* Simple rating star, can be upgraded with real shadcn star rating */}
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                            viewBox="0 0 24 24" className="inline-block">
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                          </svg>
                          {pharmacy.rating || 4.5}
                        </div>
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-[#328439] text-white rounded-full px-4 py-1 font-bold text-sm shadow-none hover:bg-[#146b2d]"
                          disabled={!canDeliver}
                          onClick={e => {
                            e.stopPropagation();
                            if (canDeliver) navigate(`/medicines/${pharmacy._id}`);
                          }}
                        >
                          View
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Floating action button: Upload Prescription */}
      {!uploadOpen && (
        <Button
          variant="outline"
          size="lg"
          className="fixed bottom-32 right-5 z-50 bg-[#FFD43B] text-[#1199a6] font-bold shadow-lg px-6 py-3 rounded-full flex items-center gap-2 hover:bg-yellow-400"
          onClick={() => setUploadOpen(true)}
        >
          <UploadCloud className="w-6 h-6" />
          Upload Prescription
        </Button>
      )}
      <PrescriptionUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        userAddress={currentAddress}
      />
    </div>
  );
}
