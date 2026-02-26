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
import { useLocation } from "../context/LocationContext";
import { CUSTOMER_CATEGORIES } from "../constants/customerCategories";
import { TYPE_OPTIONS } from "../constants/packSizes";
import GenericSuggestionModal from "../components/generics/GenericSuggestionModal";
import { buildCompositionKey } from "../lib/composition";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0f6e51";

/** Distance under the header where the two-pane section starts. */
const TOP_OFFSET_PX = 70;
/** Lift the upload FAB when the cart bar appears. */
const bottomDock = (hasCart) =>
  `calc(${hasCart ? 144 : 72}px + env(safe-area-inset-bottom,0px) + 12px)`;

/** Image util */
const getImageUrl = (img) => {
  if (!img) return null;
  if (img.startsWith("/uploads/")) return `${API_BASE_URL}${img}`;
  if (img.startsWith("http://") || img.startsWith("https://")) return img;
  return null;
};

// -- ensure a description exists (calls backend once and saves it) --
async function ensureDescription(apiBase, medId) {
  try {
    const r = await axios.post(`${apiBase}/api/medicines/${medId}/ensure-description`);
    return r.data?.description || "";
  } catch {
    return "";
  }
}

// ─── Medicine card image with emoji fallback ──────────────────
function MedCardImage({ src, alt }) {
  const [failed, setFailed] = React.useState(!src);
  if (failed || !src) {
    return (
      <div className="h-full w-full grid place-items-center" style={{ fontSize: 40, background: "linear-gradient(135deg,#E8F5EF,#D1EDE0)", borderRadius: 12 }}>
        💊
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-contain"
      onError={() => setFailed(true)}
    />
  );
}

const allCategories = ["All", ...CUSTOMER_CATEGORIES];

/** Map any raw type to a display group */
const typeToGroup = (t) => {
  if (!t) return "Other";
  const s = String(Array.isArray(t) ? t[0] : t).trim();
  if (/^drops?\s*\(/i.test(s)) return "Drops";
  if (/^drop(s)?$/i.test(s)) return "Drops";
  return s;
};

/** Pretty label like "10 tablets", "60 ml", or just "10" */
const packLabel = (count, unit) => {
  const c = String(count || "").trim();
  const u = String(unit || "").trim().toLowerCase();
  if (!c && !u) return "";
  if (!u) return c;
  const printable =
    u === "ml" || u === "g"
      ? u
      : Number(c) === 1
      ? u.replace(/s$/, "")
      : u.endsWith("s")
      ? u
      : `${u}s`;
  return `${c} ${printable}`.trim();
};

/** Build the chip list from canonical TYPE_OPTIONS + any legacy types found in inventory */
const useMedTypeChips = (medicines) =>
  useMemo(() => {
    const base = TYPE_OPTIONS.map(typeToGroup).filter((t) => t !== "Other");
    const inv = medicines
      .flatMap((m) => (Array.isArray(m?.type) ? m.type : [m?.type]))
      .map(typeToGroup);
    const unique = Array.from(new Set(["All", ...base, ...inv]));
    const out = unique.filter((t) => t !== "Other");
    out.push("Other");
    return out;
  }, [medicines]);

export default function Medicines() {
  const { pharmacyId } = useParams();
  const { cart, addToCart, removeFromCart } = useCart();
  const { currentAddress } = useLocation();

  const [pharmacy, setPharmacy] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedType, setSelectedType] = useState("All");

  // NEW: Branded/Generic toggle
  const BRAND_KINDS = ["All", "Branded", "Generic"];
  const [selectedKind, setSelectedKind] = useState("All");

  const [selectedMed, setSelectedMed] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [canDeliver, setCanDeliver] = useState(true);

  // ===== Generic suggestion state =====
  const [genericSugg, setGenericSugg] = useState({ open: false, brand: null, generics: [] });

  const isGenericItem = (m) =>
    m?.productKind === "generic" || !m?.brand || String(m.brand).trim() === "";

  const compKeyOf = (m) => buildCompositionKey(m?.composition || "");

  const samePack = (a, b) => {
    if (!a || !b) return true;
    const ac = Number(a.packCount || 0),
      bc = Number(b.packCount || 0);
    const au = String(a.packUnit || "").toLowerCase();
    const bu = String(b.packUnit || "").toLowerCase();
    if (ac && bc && ac !== bc) return false;
    if (au && bu && au !== bu) return false;
    return true;
  };

  async function fetchGenericsFromApi(phId, key, brandId) {
    try {
      const url = `${API_BASE_URL}/api/pharmacies/${phId}/alternatives?compositionKey=${encodeURIComponent(
        key
      )}${brandId ? `&brandId=${brandId}` : ""}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("bad");
      return await r.json(); // { brand?, generics: [] }
    } catch {
      return null;
    }
  }

  function findGenericsLocally(all, brand) {
    const key = compKeyOf(brand);
    const list = all
      .filter(
        (m) =>
          !isGenericItem(brand) && // only when brand is actually branded
          isGenericItem(m) &&
          compKeyOf(m) === key &&
          m.status !== "unavailable" &&
          m.available !== false &&
          samePack(m, brand)
      )
      .sort((a, b) => Number(a.price || a.mrp || 0) - Number(b.price || b.mrp || 0));
    return { brand, generics: list.slice(0, 5) };
  }

  const askedKey = (phId, key) => `GENERIC_ASKED_${phId}_${key}`;

  function shouldAsk(med) {
    if (isGenericItem(med)) return false;
    const key = compKeyOf(med);
    if (!key) return false;
    return !sessionStorage.getItem(askedKey(pharmacyId, key));
  }

  function markAsked(med) {
    const key = compKeyOf(med);
    if (key) sessionStorage.setItem(askedKey(pharmacyId, key), "1");
  }

  // Single call site for adding with check
  async function addWithGenericCheck(med) {
    if (!canDeliver) {
      alert("Delivery isn’t available right now.");
      return;
    }
    // Add brand (user explicitly tapped Add)
    addToCart(med);

    if (!shouldAsk(med)) return;
    markAsked(med);

    const key = compKeyOf(med);
    let data = await fetchGenericsFromApi(pharmacyId, key, med._id);
    if (!data || !Array.isArray(data.generics) || data.generics.length === 0) {
      data = findGenericsLocally(medicines, med);
    } else {
      data.brand = data.brand || med;
    }
    if (data.generics && data.generics.length) {
      setGenericSugg({ open: true, brand: data.brand || med, generics: data.generics });
    }
  }

  // Build type chip list (kept in sync with TYPE_OPTIONS + inventory)
  const medTypes = useMedTypeChips(medicines);

  // delivery availability near the user
  useEffect(() => {
    const lat = Number(currentAddress?.lat);
    const lng = Number(currentAddress?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    fetch(`${API_BASE_URL}/api/delivery/active-partner-nearby?lat=${lat}&lng=${lng}`)
      .then((r) => r.json())
      .then((d) => setCanDeliver(!!d.activePartnerExists))
      .catch(() => setCanDeliver(false));
  }, [currentAddress]);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API_BASE_URL}/api/pharmacies?id=${pharmacyId}`);
        if (Array.isArray(r.data)) setPharmacy(r.data[0]);
      } catch {
        setPharmacy(null);
      }
    })();
  }, [pharmacyId]);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API_BASE_URL}/api/medicines?pharmacyId=${pharmacyId}&onlyAvailable=1`)
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
    const types = Array.isArray(med.type) ? med.type : [med.type];
    const groups = types.map(typeToGroup);
    return groups.includes(selected);
  };

  // NEW: filter by branded/generic
  const matchKind = (med, kind) => {
    if (kind === "All") return true;
    if (kind === "Generic") return isGenericItem(med);
    if (kind === "Branded") return !isGenericItem(med);
    return true;
  };

  const filteredMeds = useMemo(
    () =>
      medicines
        .filter((m) => m.status !== "unavailable" && m.available !== false)
        .filter((m) => matchCategory(m, selectedCategory) && matchType(m, selectedType))
        .filter((m) => matchKind(m, selectedKind)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [medicines, selectedCategory, selectedType, selectedKind]
  );

  // Right column height; the page itself does not scroll.
  const columnHeight = `calc(100vh - ${TOP_OFFSET_PX}px)`;
  const rightPaddingBottom = 120;

  // ===== gallery state (no zoom overlay) =====
  const [activeImg, setActiveImg] = useState(0);
  const images = useMemo(() => {
    if (!selectedMed) return [];
    const arr = (Array.isArray(selectedMed.images) && selectedMed.images.length
      ? selectedMed.images
      : [selectedMed.img]
    ).filter(Boolean);
    return arr;
  }, [selectedMed]);

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
            {!canDeliver && (
              <div className="mt-2 bg-red-50 text-red-700 font-bold text-[13.5px] px-3 py-2 rounded-xl">
                ⛔ Sorry, no delivery partner is available at your location right now. Please try again soon.
              </div>
            )}
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
            {/* Sticky filter bars */}
            <div className="sticky top-0 z-10 pb-2 bg-[var(--pillo-page-bg,white)]">
              {/* Branded / Generic toggle */}
              <div className="mb-2 flex gap-1.5">
                {BRAND_KINDS.map((k) => {
                  const active = k === selectedKind;
                  return (
                    <button
                      key={k}
                      onClick={() => setSelectedKind(k)}
                      className={[
                        "rounded-full px-3 py-1.5 text-[13px] font-bold ring-1 transition",
                        active
                          ? "bg-white text-emerald-700 ring-emerald-300 shadow-sm"
                          : "bg-white/90 text-neutral-700 ring-[var(--pillo-surface-border)] hover:bg-white",
                      ].join(" ")}
                      aria-pressed={active}
                    >
                      {k}
                    </button>
                  );
                })}
              </div>

              {/* Type chips */}
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
                          relative w-full aspect-square grid place-items-center rounded-xl
                          bg-white ring-1 ring-[var(--pillo-surface-border)] shadow-sm overflow-hidden
                        "
                        onClick={async () => {
                          setSelectedMed(med);
                          setActiveImg(0);
                          if (!med.description || !med.description.trim()) {
                            const desc = await ensureDescription(API_BASE_URL, med._id);
                            if (desc) {
                              setSelectedMed((prev) => (prev ? { ...prev, description: desc } : prev));
                              setMedicines((ms) =>
                                ms.map((m) => (m._id === med._id ? { ...m, description: desc } : m))
                              );
                            }
                          }
                        }}
                        title="Know more"
                      >
                        <MedCardImage src={getImageUrl(med.img)} alt={med.name} />
                        {med.prescriptionRequired && (
                          <span
                            className="
                           absolute top-2 left-2 rounded-full
                           bg-white text-red-600 border border-red-200
                           text-[10px] font-semibold px-2 py-0.5 shadow-sm
                           "
                            title="Prescription required"
                          >
                            Rx
                          </span>
                        )}
                      </button>

                      <div className="mt-2">
                        <div
                          className="text-[13px] font-extrabold text-emerald-800 leading-snug cursor-pointer"
                          onClick={async () => {
                            setSelectedMed(med);
                            setActiveImg(0);
                            if (!med.description || !med.description.trim()) {
                              const desc = await ensureDescription(API_BASE_URL, med._id);
                              if (desc) {
                                setSelectedMed((prev) => (prev ? { ...prev, description: desc } : prev));
                                setMedicines((ms) =>
                                  ms.map((m) => (m._id === med._id ? { ...m, description: desc } : m))
                                );
                              }
                            }
                          }}
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
                          <div className="text-[11px] text-neutral-500 truncate mt-0.5">{med.company}</div>
                        )}

                        <div className="mt-1 flex items-baseline gap-1">
                          <div className="text-[15px] font-extrabold" style={{ color: DEEP }}>
                            ₹{med.price}
                          </div>
                          {med.mrp && <div className="text-[11px] text-neutral-400 line-through">₹{med.mrp}</div>}
                          {hasDiscount && (
                            <span className="ml-auto text-[10px] font-bold text-emerald-700">{discountPct}% OFF</span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            {Array.isArray(med.category) && med.category[0] && (
                              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold text-[10px] px-2 py-0.5">
                                {med.category[0]}
                              </Badge>
                            )}
                          </div>

                          <Button
                            size="sm"
                            className="h-8 rounded-full px-3 text-[12px] font-bold"
                            style={{ backgroundColor: canDeliver ? DEEP : "#d1d5db", color: "white" }}
                            disabled={!canDeliver}
                            onClick={() => addWithGenericCheck(med)}
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

      {/* Dialog (wider) with swipeable carousel — NO ZOOM OVERLAY */}
      <Dialog
        open={!!selectedMed}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMed(null);
            setActiveImg(0);
          }
        }}
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
                    onTouchStart={(e) => (e.currentTarget.dataset.sx = e.touches[0].clientX)}
                    onTouchEnd={(e) => {
                      const sx = Number(e.currentTarget.dataset.sx || 0);
                      const dx = e.changedTouches[0].clientX - sx;
                      if (dx < -40 && activeImg < images.length - 1) setActiveImg((i) => i + 1);
                      if (dx > 40 && activeImg > 0) setActiveImg((i) => i - 1);
                    }}
                  >
                    {images.map((src, i) => (
                      <div key={i} className="min-w-full h-full grid place-items-center select-none">
                        <img
                          src={getImageUrl(src)}
                          alt={selectedMed.name}
                          className="max-h-full max-w-full object-contain"
                          draggable={false}
                        />
                      </div>
                    ))}
                  </div>

                  {/* prev/next */}
                  {images.length > 1 && (
                    <>
                      <button
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 ring-1 ring-black/10 px-2 py-1.5"
                        onClick={() => setActiveImg((i) => Math.max(0, i - 1))}
                      >
                        ‹
                      </button>
                      <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 ring-1 ring-black/10 px-2 py-1.5"
                        onClick={() => setActiveImg((i) => Math.min(images.length - 1, i + 1))}
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
                          onClick={() => setActiveImg(i)}
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
                  {(selectedMed.packCount || selectedMed.packUnit) && (
                    <Badge className="bg-white text-emerald-700 border border-emerald-200 font-semibold">
                      Pack: {packLabel(selectedMed.packCount, selectedMed.packUnit)}
                    </Badge>
                  )}
                </div>

                {selectedMed.composition && (
                  <div className="text-sm text-neutral-700 mb-1">
                    <b>Composition:</b> {selectedMed.composition}
                  </div>
                )}
                {selectedMed.company && (
                  <div className="text-sm text-neutral-700 mb-1">
                    <b>Company:</b> {selectedMed.company}
                  </div>
                )}
                {(selectedMed.packCount || selectedMed.packUnit) && (
                  <div className="text-sm text-neutral-700 mb-1">
                    <b>Pack size:</b> {packLabel(selectedMed.packCount, selectedMed.packUnit)}
                  </div>
                )}

                {/* Prescription Required */}
                <div className="text-sm text-neutral-700 mb-2">
                  <b>Prescription Required:</b> {selectedMed.prescriptionRequired ? "Yes" : "No"}
                </div>

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

                <div className="text-sm text-neutral-700 mb-4 whitespace-pre-line leading-relaxed">
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
                  style={{ backgroundColor: canDeliver ? DEEP : "#d1d5db", color: "white" }}
                  disabled={!canDeliver}
                  onClick={async () => {
                    await addWithGenericCheck(selectedMed);
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

      {/* Generic suggestion modal */}
      <GenericSuggestionModal
        open={genericSugg.open}
        onOpenChange={(o) => setGenericSugg((s) => ({ ...s, open: o }))}
        brand={genericSugg.brand}
        generics={genericSugg.generics}
        onReplace={(g) => {
          const qty =
            (cart.find(
              (i) => (i._id || i.id) === (genericSugg.brand?._id || genericSugg.brand?.id)
            )?.quantity) || 1;

          const phId = genericSugg.brand?.pharmacy || pharmacyId || cart[0]?.pharmacy;
          const withPharmacy = { ...g, pharmacy: g.pharmacy || phId };

          removeFromCart(genericSugg.brand);
          for (let k = 0; k < qty; k++) addToCart(withPharmacy);
          setGenericSugg({ open: false, brand: null, generics: [] });
        }}
        onAddAlso={(g) => {
          const phId = genericSugg.brand?.pharmacy || pharmacyId || cart[0]?.pharmacy;
          const withPharmacy = { ...g, pharmacy: g.pharmacy || phId };

          addToCart(withPharmacy);
          setGenericSugg({ open: false, brand: null, generics: [] });
        }}
        onKeep={() => setGenericSugg({ open: false, brand: null, generics: [] })}
      />

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