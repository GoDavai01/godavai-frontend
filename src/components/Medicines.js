// src/pages/Medicines.js
import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { UploadCloud, X } from "lucide-react";
import { motion } from "framer-motion";
import { useCart } from "../context/CartContext";
import { useParams } from "react-router-dom";
import PrescriptionUploadModal from "../components/PrescriptionUploadModal";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0f6e51";

/** Distance under the header where the two-pane section starts. */
const TOP_OFFSET_PX = 70;
/** Lift the upload FAB when the cart bar appears. */
const bottomDock = (hasCart) =>
  `calc(${hasCart ? 144 : 72}px + env(safe-area-inset-bottom,0px) + 12px)`;

/** Image util */
const getImageUrl = (img) => {
  if (!img)
    return "https://img.freepik.com/free-vector/medicine-bottle-pills-isolated_1284-42391.jpg?w=400";
  if (img.startsWith("/uploads/")) return `${API_BASE_URL}${img}`;
  if (img.startsWith("http://") || img.startsWith("https://")) return img;
  return img;
};

const allCategories = ["All","Painkiller","Fever","Cough & Cold","Diabetes","Heart","Antibiotic","Ayurveda"];
const medTypes      = ["All","Tablet","Syrup","Injection","Cream","Ointment","Drop","Spray","Inhaler"];

export default function Medicines() {
  const { pharmacyId } = useParams();
  const { cart, addToCart } = useCart();

  const [pharmacy, setPharmacy] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedType, setSelectedType] = useState("All");

  const [selectedMed, setSelectedMed] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API_BASE_URL}/api/pharmacies?id=${pharmacyId}`);
        if (Array.isArray(r.data)) setPharmacy(r.data[0]);
      } catch { setPharmacy(null); }
    })();
  }, [pharmacyId]);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API_BASE_URL}/api/medicines?pharmacyId=${pharmacyId}`)
      .then((res) => setMedicines(res.data || []))
      .catch(() => setMedicines([]))
      .finally(() => setLoading(false));
  }, [pharmacyId]);

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

  const filteredMeds = useMemo(
    () => medicines.filter((m) => matchCategory(m, selectedCategory) && matchType(m, selectedType)),
    [medicines, selectedCategory, selectedType]
  );

  // Right column height; the page itself does not scroll.
  const columnHeight = `calc(100vh - ${TOP_OFFSET_PX}px)`;
  const rightPaddingBottom = 120;

  return (
    <div className="relative h-screen w-full max-w-[420px] mx-auto bg-[var(--pillo-page-bg,linear-gradient(180deg,#f9fbff,white))] overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4">
        {pharmacy ? (
          <div className="mb-2">
            <div className="text-[18px] font-extrabold" style={{ color: DEEP }}>
              {pharmacy.name}
            </div>
            <div className="text-xs text-neutral-500">
              {pharmacy.area}, {pharmacy.city}
            </div>
          </div>
        ) : (
          <div className="h-6 w-40 rounded bg-neutral-100 animate-pulse mb-2" />
        )}
      </div>

      {/* Two columns */}
      <div className="px-3">
        <div className="grid grid-cols-[94px,1fr] gap-3 items-start">
          {/* LEFT rail — fills to bottom (no gap) and scrolls only when long */}
          <aside className="sticky self-start" style={{ top: TOP_OFFSET_PX, height: columnHeight }}>
            <div className="h-full rounded-2xl bg-white/95 ring-1 ring-[var(--pillo-surface-border)] shadow-sm p-2 flex flex-col">
              <div className="text-[11px] font-bold mb-1" style={{ color: DEEP }}>
                Categories
              </div>
              {/* Take remaining height; scroll when overflow. */}
              <div
                className="flex-1 flex flex-col gap-1 overflow-y-auto pr-1 no-scrollbar"
                /* header (≈20–24px) is accounted for by flex-1 on this list */
              >
                {allCategories.map((c) => {
                  const active = c === selectedCategory;
                  return (
                    <button
                      key={c}
                      onClick={() => setSelectedCategory(c)}
                      className={`text-left rounded-xl px-3 py-2 text-[12px] font-bold transition ${
                        active ? "bg-emerald-50 ring-1 ring-emerald-200" : "hover:bg-neutral-50"
                      }`}
                      style={{ color: active ? DEEP : "#0b3f30" }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* RIGHT rail — the only vertical scroller */}
          <section
            className="min-w-0 overflow-y-auto no-scrollbar"
            style={{ height: columnHeight, paddingBottom: rightPaddingBottom }}
          >
            {/* Type chips */}
            <div className="sticky top-0 z-10 pb-2 bg-[var(--pillo-page-bg,white)]">
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 pr-1">
                {medTypes.map((t) => {
                  const active = t === selectedType;
                  return (
                    <button
                      key={t}
                      onClick={() => setSelectedType(t)}
                      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-bold ring-1 transition ${
                        active
                          ? "bg-white text-emerald-700 ring-emerald-300"
                          : "bg-white/90 text-neutral-700 ring-[var(--pillo-surface-border)] hover:bg-white"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Products */}
            {loading ? (
              <div className="mt-8 text-center text-neutral-400 animate-pulse">Loading medicines…</div>
            ) : filteredMeds.length === 0 ? (
              <div className="mt-8 text-center text-neutral-400">No medicines found.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredMeds.map((med) => {
                  const hasDiscount = med.mrp && Number(med.price) < Number(med.mrp);
                  const discountPct = hasDiscount ? Math.round(((med.mrp - med.price) / med.mrp) * 100) : null;

                  return (
                    <Card key={med._id} className="p-2 rounded-2xl bg-white ring-1 ring-[var(--pillo-surface-border)] shadow-sm">
                      <button
                        className="w-full aspect-square grid place-items-center rounded-xl bg-white ring-1 ring-[var(--pillo-surface-border)] shadow-sm overflow-hidden"
                        onClick={() => setSelectedMed(med)}
                        title="Know more"
                      >
                        <img src={getImageUrl(med.img)} alt={med.name} className="h-full w-full object-contain" />
                      </button>

                      <div className="mt-2">
                        <div
                          className="text-[13px] font-extrabold text-emerald-800 leading-snug cursor-pointer"
                          onClick={() => setSelectedMed(med)}
                          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                          title={med.brand || med.name}
                        >
                          {med.brand || med.name}
                        </div>

                        {med.company && <div className="text-[11px] text-neutral-500 truncate mt-0.5">{med.company}</div>}

                        <div className="mt-1 flex items-baseline gap-1">
                          <div className="text-[15px] font-extrabold" style={{ color: DEEP }}>₹{med.price}</div>
                          {med.mrp && <div className="text-[11px] text-neutral-400 line-through">₹{med.mrp}</div>}
                          {hasDiscount && <span className="ml-auto text-[10px] font-bold text-emerald-700">{discountPct}% OFF</span>}
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          {Array.isArray(med.category) && med.category[0] && (
                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold text-[10px] px-2 py-0.5">
                              {med.category[0]}
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            className="h-8 rounded-full px-3 text-[12px] font-bold"
                            style={{ backgroundColor: DEEP, color: "white" }}
                            onClick={() => addToCart(med)}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={!!selectedMed} onOpenChange={() => setSelectedMed(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
          {selectedMed && (
            <>
              <DialogHeader className="px-4 pt-4 pb-1">
                <DialogTitle className="text-xl font-extrabold" style={{ color: DEEP }}>
                  {selectedMed.brand || selectedMed.name}
                </DialogTitle>
              </DialogHeader>

              <div className="px-4">
                <div className="w-full grid place-items-center rounded-xl ring-1 ring-[var(--pillo-surface-border)] bg-white mb-3">
                  <img src={getImageUrl(selectedMed.img)} alt={selectedMed.name} className="max-h-40 object-contain p-3" />
                </div>

                <div className="flex flex-wrap gap-2 mb-2">
                  {Array.isArray(selectedMed.category) && selectedMed.category.length > 0 && (
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold">
                      {selectedMed.category.join(", ")}
                    </Badge>
                  )}
                  {selectedMed.type && (
                    <Badge className="bg-white text-emerald-700 border border-emerald-200 font-semibold">
                      {Array.isArray(selectedMed.type) ? selectedMed.type.join(", ") : selectedMed.type}
                    </Badge>
                  )}
                </div>

                {selectedMed.composition && (
                  <div className="text-sm text-neutral-700 mb-1"><b>Composition:</b> {selectedMed.composition}</div>
                )}
                {selectedMed.company && (
                  <div className="text-sm text-neutral-700 mb-2"><b>Company:</b> {selectedMed.company}</div>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <div className="text-2xl font-extrabold" style={{ color: DEEP }}>₹{selectedMed.price}</div>
                  {selectedMed.mrp && selectedMed.price < selectedMed.mrp && (
                    <>
                      <div className="text-sm text-neutral-400 line-through">₹{selectedMed.mrp}</div>
                      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold">
                        {Math.round(((selectedMed.mrp - selectedMed.price) / selectedMed.mrp) * 100)}% OFF
                      </Badge>
                    </>
                  )}
                </div>

                <div className="text-sm text-neutral-700 mb-3">
                  {selectedMed.description ? selectedMed.description : <span className="text-neutral-400">No description available.</span>}
                </div>
              </div>

              <div className="p-4 pt-0 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedMed(null)}>
                  <X className="h-4 w-4 mr-1" /> Close
                </Button>
                <Button
                  className="flex-1 font-bold"
                  style={{ backgroundColor: DEEP, color: "white" }}
                  onClick={() => {
                    addToCart(selectedMed);
                    setSelectedMed(null);
                  }}
                >
                  Add to Cart
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Prescription FAB */}
      <motion.div
        className="fixed right-0 left-0 z-[1201] flex justify-end px-5"
        style={{ bottom: bottomDock((cart?.length || 0) > 0), pointerEvents: uploadOpen ? "none" : "auto" }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {!uploadOpen && (
          <button
            type="button"
            aria-label="Upload Prescription"
            onClick={() => setUploadOpen(true)}
            className="group inline-flex items-center gap-2 rounded-full pl-3 pr-4 py-2.5 shadow-[0_10px_24px_rgba(16,185,129,0.35)]"
            style={{ background: DEEP, color: "white" }}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[color:var(--pillo-active-text)] ring-1 ring-white/70 backdrop-blur group-hover:bg-white transition">
              <UploadCloud className="h-4.5 w-4.5" />
            </span>
            <span className="text-[15px] font-bold">Upload Prescription</span>
          </button>
        )}
      </motion.div>

      <PrescriptionUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        userCity={localStorage.getItem("city") || "Delhi"}
      />
    </div>
  );
}
