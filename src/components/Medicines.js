// src/pages/Medicines.js
import React, { useEffect, useMemo, useRef, useState } from "react";
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

  // =========================
  // --- gallery / zoom state
  // =========================
  const [activeImg, setActiveImg] = useState(0);

  const images = useMemo(() => {
    if (!selectedMed) return [];
    const arr = (Array.isArray(selectedMed.images) && selectedMed.images.length
      ? selectedMed.images
      : [selectedMed.img]
    ).filter(Boolean);
    return arr;
  }, [selectedMed]);

  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });

  const resetZoom = () => { setZoom(1); setOffset({ x:0, y:0 }); setIsDragging(false); draggingRef.current=false; };

  const wheelZoom = (e) => {
    e.preventDefault();
    const next = Math.min(4, Math.max(1, zoom + (e.deltaY > 0 ? -0.1 : 0.1)));
    setZoom(next);
  };

  const startDrag = (x, y) => {
    draggingRef.current = true;
    setIsDragging(true);
    lastRef.current = { x, y };
  };
  const moveDrag = (x, y) => {
    if (!draggingRef.current) return;
    setOffset((o) => ({ x: o.x + (x - lastRef.current.x), y: o.y + (y - lastRef.current.y) }));
    lastRef.current = { x, y };
  };
  const endDrag = () => {
    draggingRef.current = false;
    setIsDragging(false);
  };

  // Close zoom with ESC and lock background scroll while open
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { setZoomOpen(false); resetZoom(); } };
    if (zoomOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", onKey);
    } else {
      document.body.style.overflow = "";
    }
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [zoomOpen]);

  return (
    <div
      className="
        relative h-screen w-full max-w-[420px] mx-auto overflow-hidden
        bg-[var(--pillo-page-bg,linear-gradient(180deg,#f9fbff,white))]
      "
    >
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
      <div className="pl-0 pr-3">
        <div className="grid grid-cols-[100px,1fr] gap-3 items-start">
          {/* LEFT rail */}
          <aside className="sticky self-start" style={{ top: TOP_OFFSET_PX, height: columnHeight }}>
            <div
              className="
                h-full rounded-2xl p-2.5 flex flex-col
                bg-white/90 ring-1 ring-[var(--pillo-surface-border)] shadow-sm backdrop-blur
              "
            >
              <div className="text-[13px] font-semibold mb-1 tracking-wide text-emerald-900/90">
                Categories
              </div>

              <div className="flex-1 flex flex-col gap-1 overflow-y-auto pr-1 no-scrollbar">
                {allCategories.map((c) => {
                  const active = c === selectedCategory;
                  return (
                    <button
                      key={c}
                      onClick={() => setSelectedCategory(c)}
                      className={[
                        "text-left rounded-xl px-3.5 py-2.5 text-[14px] font-semibold transition",
                        active
                          ? "bg-emerald-50/80 text-emerald-900 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]"
                          : "text-[#0b3f30] hover:bg-neutral-50/70",
                      ].join(" ")}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* RIGHT rail */}
          <section
            className="min-w-0 overflow-y-auto no-scrollbar"
            style={{ height: columnHeight, paddingBottom: rightPaddingBottom }}
          >
            {/* Type chips */}
            <div className="sticky top-0 z-10 pb-2 bg-[var(--pillo-page-bg,white)]">
              <div
                className="flex gap-2 overflow-x-auto no-scrollbar pb-1 pr-1"
                style={{
                  WebkitMaskImage:
                    "linear-gradient(90deg, transparent, #000 16px, #000 calc(100% - 16px), transparent)",
                  maskImage:
                    "linear-gradient(90deg, transparent, #000 16px, #000 calc(100% - 16px), transparent)",
                }}
              >
                {medTypes.map((t) => {
                  const active = t === selectedType;
                  return (
                    <button
                      key={t}
                      onClick={() => setSelectedType(t)}
                      className={[
                        "whitespace-nowrap rounded-full px-3.5 py-2 text-[14px] font-semibold ring-1 transition",
                        active
                          ? "bg-white text-emerald-700 ring-emerald-300 shadow-sm"
                          : "bg-white/90 text-neutral-700 ring-[var(--pillo-surface-border)] hover:bg-white",
                      ].join(" ")}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Products */}
            {loading ? (
              <div className="mt-8 text-center text-neutral-400 animate-pulse">
                Loading medicines…
              </div>
            ) : filteredMeds.length === 0 ? (
              <div className="mt-8 text-center text-neutral-400">No medicines found.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredMeds.map((med) => {
                  const hasDiscount = med.mrp && Number(med.price) < Number(med.mrp);
                  const discountPct = hasDiscount
                    ? Math.round(((med.mrp - med.price) / med.mrp) * 100)
                    : null;

                  return (
                    <Card
                      key={med._id}
                      className="
                        p-2 rounded-2xl bg-white ring-1 ring-[var(--pillo-surface-border)]
                        shadow-sm transition-transform hover:-translate-y-0.5
                      "
                    >
                      <button
                        className="
                          w-full aspect-square grid place-items-center rounded-xl
                          bg-white ring-1 ring-[var(--pillo-surface-border)] shadow-sm overflow-hidden
                        "
                        onClick={() => { setSelectedMed(med); setActiveImg(0); }}
                        title="Know more"
                      >
                        <img
                          src={getImageUrl(med.img)}
                          alt={med.name}
                          className="h-full w-full object-contain"
                        />
                      </button>

                      <div className="mt-2">
                        <div
                          className="text-[13px] font-extrabold text-emerald-800 leading-snug cursor-pointer"
                          onClick={() => { setSelectedMed(med); setActiveImg(0); }}
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                          title={med.brand || med.name}
                        >
                          {med.brand || med.name}
                        </div>

                        {med.company && (
                          <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                            {med.company}
                          </div>
                        )}

                        <div className="mt-1 flex items-baseline gap-1">
                          <div className="text-[15px] font-extrabold" style={{ color: DEEP }}>
                            ₹{med.price}
                          </div>
                          {med.mrp && (
                            <div className="text-[11px] text-neutral-400 line-through">
                              ₹{med.mrp}
                            </div>
                          )}
                          {hasDiscount && (
                            <span className="ml-auto text-[10px] font-bold text-emerald-700">
                              {discountPct}% OFF
                            </span>
                          )}
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

      {/* Dialog with bigger gallery + tap-to-zoom */}
      <Dialog
        open={!!selectedMed}
        onOpenChange={() => { setSelectedMed(null); setActiveImg(0); }}
      >
        <DialogContent
          className="
            w-[min(96vw,740px)]
            p-0 overflow-hidden rounded-2xl
            md:w-[720px]
          "
        >
          {selectedMed && (
            <>
              <DialogHeader className="px-5 pt-5 pb-2">
                <DialogTitle className="text-2xl font-extrabold" style={{ color: DEEP }}>
                  {selectedMed.brand || selectedMed.name}
                </DialogTitle>
              </DialogHeader>

              {/* --- GALLERY --- */}
              <div className="px-5">
                <div
                  className="
                    relative w-full h-[320px] md:h-[380px]
                    rounded-xl ring-1 ring-[var(--pillo-surface-border)] bg-white overflow-hidden
                  "
                >
                  {/* swipeable rail */}
                  <div
                    className="h-full flex transition-transform duration-300"
                    style={{ transform: `translateX(-${activeImg * 100}%)` }}
                    onTouchStart={(e)=> (e.currentTarget.dataset.sx = e.touches[0].clientX)}
                    onTouchEnd={(e)=> {
                      const sx = Number(e.currentTarget.dataset.sx || 0);
                      const dx = e.changedTouches[0].clientX - sx;
                      if (dx < -40 && activeImg < images.length - 1) setActiveImg(i => i + 1);
                      if (dx >  40 && activeImg > 0)               setActiveImg(i => i - 1);
                    }}
                  >
                    {images.map((src, i) => (
                      <button
                        key={i}
                        className="min-w-full h-full grid place-items-center"
                        onClick={() => { setActiveImg(i); setZoomOpen(true); resetZoom(); }}
                        title="Tap to zoom"
                      >
                        <img
                          src={getImageUrl(src)}
                          alt={selectedMed.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </button>
                    ))}
                  </div>

                  {/* prev/next */}
                  {images.length > 1 && (
                    <>
                      <button
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 ring-1 ring-black/10 px-2 py-1.5"
                        onClick={() => setActiveImg(i => Math.max(0, i - 1))}
                      >
                        ‹
                      </button>
                      <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 ring-1 ring-black/10 px-2 py-1.5"
                        onClick={() => setActiveImg(i => Math.min(images.length - 1, i + 1))}
                      >
                        ›
                      </button>
                    </>
                  )}

                  {/* dots */}
                  {images.length > 1 && (
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                      {images.map((_, i) => (
                        <span
                          key={i}
                          onClick={()=>setActiveImg(i)}
                          className={`h-1.5 rounded-full cursor-pointer transition-all ${
                            i === activeImg ? "w-5 bg-emerald-600" : "w-2.5 bg-emerald-200"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* tags + info */}
              <div className="px-5 pt-3">
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
                  <div className="text-sm text-neutral-700 mb-1">
                    <b>Composition:</b> {selectedMed.composition}
                  </div>
                )}
                {selectedMed.company && (
                  <div className="text-sm text-neutral-700 mb-2">
                    <b>Company:</b> {selectedMed.company}
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <div className="text-2xl font-extrabold" style={{ color: DEEP }}>
                    ₹{selectedMed.price}
                  </div>
                  {selectedMed.mrp && selectedMed.price < selectedMed.mrp && (
                    <>
                      <div className="text-sm text-neutral-400 line-through">₹{selectedMed.mrp}</div>
                      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold">
                        {Math.round(((selectedMed.mrp - selectedMed.price) / selectedMed.mrp) * 100)}% OFF
                      </Badge>
                    </>
                  )}
                </div>

                <div className="text-sm text-neutral-700 mb-4">
                  {selectedMed.description ? (
                    selectedMed.description
                  ) : (
                    <span className="text-neutral-400">No description available.</span>
                  )}
                </div>
              </div>

              {/* actions */}
              <div className="p-5 pt-0 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedMed(null)}>
                  <X className="h-4 w-4 mr-1" /> Close
                </Button>
                <Button
                  className="flex-1 font-bold"
                  style={{ backgroundColor: DEEP, color: "white" }}
                  onClick={() => { addToCart(selectedMed); setSelectedMed(null); }}
                >
                  Add to Cart
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Full-screen zoom viewer */}
      {zoomOpen && (
        <div
          className="fixed inset-0 z-[2000] bg-black/90"
          onWheel={wheelZoom}
          onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
          onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={(e) => { const t = e.touches[0]; startDrag(t.clientX, t.clientY); }}
          onTouchMove={(e) => { e.preventDefault(); const t = e.touches[0]; moveDrag(t.clientX, t.clientY); }}
          onTouchEnd={endDrag}
        >
          <button
            className="absolute top-4 right-4 text-white/90 bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5"
            onClick={() => { setZoomOpen(false); resetZoom(); }}
          >
            Close
          </button>

          {images.length > 1 && (
            <>
              <button
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/90 bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5"
                onClick={() => setActiveImg(i => Math.max(0, i - 1))}
              >‹</button>
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/90 bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5"
                onClick={() => setActiveImg(i => Math.min(images.length - 1, i + 1))}
              >›</button>
            </>
          )}

          <div className="absolute inset-0 grid place-items-center overflow-hidden">
            <img
              src={getImageUrl(images[activeImg])}
              alt=""
              draggable={false}
              className={`max-w-none ${zoom > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"}`}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transition: isDragging ? "none" : "transform 120ms ease-out",
                willChange: "transform"
              }}
              onDoubleClick={() => setZoom(z => (z >= 2 ? 1 : 2))}
            />
          </div>

          {/* zoom controls */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-6 flex gap-2">
            <button
              className="text-white/90 bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5"
              onClick={() => setZoom(z => Math.max(1, z - 0.25))}
            >–</button>
            <span className="px-2 py-1 text-white/80 text-sm">{Math.round(zoom*100)}%</span>
            <button
              className="text-white/90 bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5"
              onClick={() => setZoom(z => Math.min(4, z + 0.25))}
            >+</button>
            <button
              className="text-white/90 bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5"
              onClick={resetZoom}
            >Reset</button>
          </div>
        </div>
      )}

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
