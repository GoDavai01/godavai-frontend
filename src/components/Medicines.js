// src/components/Medicines.js — GoDavaii 2035 Health OS Marketplace (Customer)
// ✅ Marketplace mode default (no chemist visible)
// ✅ Single delivery only (cart is product-first)
// ✅ Generic suggestions via GLOBAL alternatives endpoint
// ✅ Removed cart pharmacy conflict sheet usage

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Dialog, DialogContent } from "../components/ui/dialog";
import {
  UploadCloud,
  X,
  ChevronLeft,
  ChevronRight,
  Package,
  ArrowLeft,
  Search,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useParams, useNavigate, useLocation as useRouterLocation } from "react-router-dom";
import PrescriptionUploadModal from "../components/PrescriptionUploadModal";
import DoctorPrescriptionViewDialog from "../components/DoctorPrescriptionViewDialog";
import axios from "axios";
import { useLocation as useAppLocation } from "../context/LocationContext";
import { CUSTOMER_CATEGORIES } from "../constants/customerCategories";
import { TYPE_OPTIONS } from "../constants/packSizes";
import GenericSuggestionModal from "../components/generics/GenericSuggestionModal";
import { buildCompositionKey } from "../lib/composition";
import { getDoctorPrescriptionCartSummary } from "../lib/doctorPrescriptionCart";
import { getUserAuthHeaders, getUserAuthToken } from "../lib/userAuth";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DEEP = "#0C5A3E";
const MID = "#0E7A4F";
const ACC = "#00D97E";
const MARKETPLACE_PAGE_SIZE = 80;
const MARKETPLACE_OBSERVER_MARGIN = "320px";

const bottomDock = (hasCart) =>
  `calc(${hasCart ? 144 : 72}px + env(safe-area-inset-bottom,0px) + 12px)`;

function getDoctorPrescriptionCacheKey(prescriptionId) {
  return prescriptionId ? `doctorPrescription:${prescriptionId}` : "";
}

function normalizeDoctorPrescriptionPayload(prescription = null, cartDraft = null) {
  if (!prescription) return null;
  return {
    ...prescription,
    cartDraft: prescription.cartDraft || cartDraft || null,
  };
}

function readCachedDoctorPrescription(prescriptionId) {
  if (!prescriptionId || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage?.getItem(getDoctorPrescriptionCacheKey(prescriptionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return String(parsed?._id || "") === String(prescriptionId) ? parsed : null;
  } catch (_) {
    return null;
  }
}

function storeCachedDoctorPrescription(prescription) {
  const prescriptionId = String(prescription?._id || "").trim();
  if (!prescriptionId || typeof window === "undefined") return;
  try {
    window.sessionStorage?.setItem(
      getDoctorPrescriptionCacheKey(prescriptionId),
      JSON.stringify(normalizeDoctorPrescriptionPayload(prescription))
    );
  } catch (_) {}
}

/* ── MRP display helper ─────────────────────────── */
function hasValidMrp(med) {
  const mrp = Number(med?.mrp);
  const price = Number(med?.price);
  return mrp > 0 && price > 0 && price < mrp;
}

/* ── Image util ─────────────────────────── */
const getImageUrl = (img) => {
  if (!img) return null;
  if (img.startsWith("/uploads/")) return `${API}${img}`;
  if (img.startsWith("http://") || img.startsWith("https://")) return img;
  return null;
};

function MedCardImage({ src, alt }) {
  const [fail, setFail] = useState(!src);
  if (fail || !src)
    return (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "grid",
          placeItems: "center",
          fontSize: 38,
          background: "linear-gradient(145deg,#EEF7F1,#D8EDE2)",
          borderRadius: "inherit",
        }}
      >
        💊
      </div>
    );
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      style={{ height: "100%", width: "100%", objectFit: "contain", padding: 8 }}
      onError={() => setFail(true)}
    />
  );
}

async function ensureDescription(apiBase, medId) {
  try {
    const r = await axios.post(`${apiBase}/api/medicines/${medId}/ensure-description`);
    return r.data?.description || "";
  } catch {
    return "";
  }
}

const allCategories = ["All", ...CUSTOMER_CATEGORIES];

const typeToGroup = (t) => {
  if (!t) return "Other";
  const s = String(Array.isArray(t) ? t[0] : t).trim();
  if (/^drops?\s*\(/i.test(s)) return "Drops";
  if (/^drop(s)?$/i.test(s)) return "Drops";
  return s;
};

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

function medicineListingKey(m = {}) {
  return `${(m.brand || m.name || "").toLowerCase()}|${(m.composition || m.compositionKey || "").toLowerCase()}|${String(
    m.packCount || ""
  )}|${String(m.packUnit || "")}|${String(m.productKind || "")}`;
}

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

function Chip({ label, active, onClick, icon }) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      style={{
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 34,
        padding: icon ? "0 14px 0 10px" : "0 15px",
        borderRadius: 100,
        fontSize: 12,
        fontWeight: active ? 800 : 600,
        fontFamily: "'Sora',sans-serif",
        color: active ? "#fff" : "#3D5A4A",
        background: active
          ? `linear-gradient(135deg,${DEEP},${MID})`
          : "rgba(255,255,255,0.95)",
        border: active ? "none" : "1.5px solid rgba(12,90,62,0.12)",
        boxShadow: active ? "0 4px 14px rgba(12,90,62,0.30)" : "0 1px 4px rgba(0,0,0,0.04)",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      {label}
    </motion.button>
  );
}

const MedCard = React.memo(function MedCard({ med, canDeliver, onTap, onAdd }) {
  const showMrp = hasValidMrp(med);
  const discountPct = showMrp ? Math.round(((med.mrp - med.price) / med.mrp) * 100) : null;
  const isGeneric = !med.brand || String(med.brand).trim() === "";

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 20,
        border: "1px solid rgba(12,90,62,0.08)",
        boxShadow: "0 2px 16px rgba(12,90,62,0.06)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <button
        onClick={onTap}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "4/3",
          background: "linear-gradient(145deg,#F4FAF6,#E8F5EF)",
          border: "none",
          cursor: "pointer",
          padding: 0,
          overflow: "hidden",
        }}
      >
        <MedCardImage src={getImageUrl(med.img)} alt={med.name} />
        <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4 }}>
          {med.prescriptionRequired && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: "#DC2626",
                background: "rgba(254,242,242,0.95)",
                padding: "2px 7px",
                borderRadius: 100,
                border: "1px solid #FCA5A5",
                backdropFilter: "blur(8px)",
              }}
            >
              Rx
            </span>
          )}
          {isGeneric && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: "#065F46",
                background: "rgba(209,250,229,0.95)",
                padding: "2px 7px",
                borderRadius: 100,
                border: "1px solid #6EE7B7",
                backdropFilter: "blur(8px)",
              }}
            >
              Generic
            </span>
          )}
        </div>
        {showMrp && discountPct > 0 && (
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              fontSize: 9.5,
              fontWeight: 800,
              color: "#fff",
              background: `linear-gradient(135deg,#059669,${ACC})`,
              padding: "3px 8px",
              borderRadius: 100,
              boxShadow: "0 2px 8px rgba(5,150,105,0.35)",
            }}
          >
            {discountPct}% OFF
          </div>
        )}
      </button>

      <div style={{ padding: "10px 12px 12px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div
          onClick={onTap}
          title={med.brand || med.name}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#0B1F16",
            fontFamily: "'Sora',sans-serif",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            cursor: "pointer",
            marginBottom: 3,
            minHeight: 34,
          }}
        >
          {med.brand || med.name}
        </div>

        {med.stock > 0 && (
          <div style={{ fontSize: 9, color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: 3, marginBottom: 2, background: "rgba(209,250,229,0.5)", padding: "1px 6px", borderRadius: 100, width: "fit-content" }}>
            <span style={{ fontSize: 8 }}>📍</span> Available near you
          </div>
        )}
        <div
          style={{
            fontSize: 9,
            color: "#6B7280",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 3,
            marginBottom: 6,
          }}
        >
          <ShieldCheck style={{ width: 9, height: 9, color: "#059669" }} />
          Fulfilled by verified pharmacy partner
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
          <span
            style={{
              fontFamily: "'Sora',sans-serif",
              fontSize: 17,
              fontWeight: 800,
              color: DEEP,
              letterSpacing: "-0.3px",
            }}
          >
            ₹{med.price}
          </span>
          {showMrp && (
            <span style={{ fontSize: 11, color: "#CBD5E1", textDecoration: "line-through", fontWeight: 500 }}>
              ₹{med.mrp}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
          {Array.isArray(med.category) && med.category[0] ? (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: DEEP,
                background: "#E8F5EF",
                padding: "3px 8px",
                borderRadius: 100,
                border: `1px solid ${DEEP}18`,
                maxWidth: 80,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {med.category[0]}
            </span>
          ) : (
            <span />
          )}

          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => onAdd(med)}
            disabled={!canDeliver}
            style={{
              height: 32,
              padding: "0 16px",
              borderRadius: 100,
              border: "none",
              background: canDeliver ? `linear-gradient(135deg,${DEEP},${MID})` : "#E2E8F0",
              color: canDeliver ? "#fff" : "#94A3B8",
              fontSize: 12,
              fontWeight: 800,
              fontFamily: "'Sora',sans-serif",
              cursor: canDeliver ? "pointer" : "not-allowed",
              boxShadow: canDeliver ? "0 4px 12px rgba(12,90,62,0.28)" : "none",
            }}
          >
            + Add
          </motion.button>
        </div>
      </div>
    </div>
  );
});

export default function Medicines() {
  const { pharmacyId } = useParams();
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const { cart, addToCart, removeFromCart, clearCartAndStorage, clearCart } = useCart();
  const { token: authToken } = useAuth();
  const { currentAddress } = useAppLocation();
  const scrollRef = useRef(null);
  const initialQuery = useMemo(
    () => (new URLSearchParams(routerLocation.search).get("q") || "").trim(),
    [routerLocation.search]
  );
  const prescriptionId = useMemo(
    () => (new URLSearchParams(routerLocation.search).get("prescriptionId") || "").trim(),
    [routerLocation.search]
  );
  const routedDoctorPrescription = useMemo(() => {
    const candidate = routerLocation.state?.doctorPrescription || null;
    if (!candidate) return null;
    return String(candidate?._id || "") === String(prescriptionId) ? normalizeDoctorPrescriptionPayload(candidate) : null;
  }, [prescriptionId, routerLocation.state]);

  // Customer default is marketplace (no pharmacyId)
  const isMarketplace = !pharmacyId;

  const [pharmacy, setPharmacy] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [marketplacePage, setMarketplacePage] = useState(0);
  const [marketplaceHasMore, setMarketplaceHasMore] = useState(false);
  const [marketplaceTotal, setMarketplaceTotal] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const BRAND_KINDS = ["All", "Branded", "Generic"];
  const [selectedKind, setSelectedKind] = useState("All");
  const [selectedMed, setSelectedMed] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [canDeliver, setCanDeliver] = useState(true);
  const [genericSugg, setGenericSugg] = useState({ open: false, brand: null, generics: [] });
  const [activeImg, setActiveImg] = useState(0);
  const [showSearch, setShowSearch] = useState(!!initialQuery);
  const [searchQ, setSearchQ] = useState(initialQuery);
  const [doctorPrescription, setDoctorPrescription] = useState(null);
  const [doctorPrescriptionLoading, setDoctorPrescriptionLoading] = useState(false);
  const [doctorPrescriptionMessage, setDoctorPrescriptionMessage] = useState("");
  const [doctorPrescriptionDialogOpen, setDoctorPrescriptionDialogOpen] = useState(false);
  const marketplaceRequestSeqRef = useRef(0);
  const marketplaceInFlightRef = useRef(false);
  const loadMoreAnchorRef = useRef(null);

  useEffect(() => {
    setSearchQ(initialQuery);
    setShowSearch(!!initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!routedDoctorPrescription) return;
    storeCachedDoctorPrescription(routedDoctorPrescription);
    setDoctorPrescription((current) =>
      String(current?._id || "") === String(routedDoctorPrescription?._id || "") ? current : routedDoctorPrescription
    );
  }, [routedDoctorPrescription]);

  useEffect(() => {
    let mounted = true;
    const token = getUserAuthToken(authToken);
    const headers = token ? getUserAuthHeaders(token) : undefined;
    const fallbackPrescription = routedDoctorPrescription || readCachedDoctorPrescription(prescriptionId) || null;

    setDoctorPrescriptionMessage("");
    if (!prescriptionId) {
      setDoctorPrescription(null);
      setDoctorPrescriptionLoading(false);
      return () => {
        mounted = false;
      };
    }

    if (fallbackPrescription) {
      setDoctorPrescription(fallbackPrescription);
      storeCachedDoctorPrescription(fallbackPrescription);
    }

    if (!token) {
      setDoctorPrescriptionLoading(false);
      if (!fallbackPrescription) {
        setDoctorPrescription(null);
      }
      return () => {
        mounted = false;
      };
    }

    setDoctorPrescriptionLoading(!fallbackPrescription);
    (async () => {
      try {
        let res = null;
        try {
          res = await axios.get(`${API}/api/prescriptions/cart/by-prescription/${prescriptionId}`, { headers });
        } catch (_) {
          res = await axios.get(`${API}/api/prescriptions/detail/${prescriptionId}`, { headers });
        }

        if (!mounted) return;
        const prescription = normalizeDoctorPrescriptionPayload(res?.data?.prescription, res?.data?.cartDraft);
        setDoctorPrescription(prescription);
        if (!prescription) {
          if (fallbackPrescription) {
            setDoctorPrescription(fallbackPrescription);
          } else {
            setDoctorPrescriptionMessage("Doctor prescription details abhi sync nahi hui hain.");
          }
        } else {
          storeCachedDoctorPrescription(prescription);
        }
      } catch (_) {
        if (!mounted) return;
        if (fallbackPrescription) {
          setDoctorPrescription(fallbackPrescription);
          setDoctorPrescriptionMessage("Live prescription sync nahi hui, cached prescription dikha rahe hain.");
        } else {
          setDoctorPrescription(null);
          setDoctorPrescriptionMessage("Doctor prescription load nahi ho paya. Aap homepage se dobara open karke try kar sakte hain.");
        }
      } finally {
        if (mounted) setDoctorPrescriptionLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [authToken, prescriptionId, routedDoctorPrescription]);

  const doctorPrescriptionSummary = useMemo(
    () => getDoctorPrescriptionCartSummary(doctorPrescription),
    [doctorPrescription]
  );

  const isGenericItem = (m) =>
    m?.productKind === "generic" || !m?.brand || String(m.brand).trim() === "";

  const compKeyOf = (m) => buildCompositionKey(m?.composition || m?.compositionKey || "");

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

  async function fetchGenericsGlobal(key, brandId) {
    try {
      const url =
        `${API}/api/medicines/alternatives?` +
        `brandId=${encodeURIComponent(brandId)}` +
        (key ? `&compositionKey=${encodeURIComponent(key)}` : "");
      const r = await fetch(url);
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }

  function findGenericsLocally(all, brand) {
    const key = compKeyOf(brand);
    const list = all
      .filter(
        (m) =>
          !isGenericItem(brand) &&
          isGenericItem(m) &&
          compKeyOf(m) === key &&
          m.status !== "unavailable" &&
          m.available !== false &&
          samePack(m, brand)
      )
      .sort((a, b) => Number(a.price || a.mrp || 0) - Number(b.price || b.mrp || 0));
    return { brand, generics: list.slice(0, 5) };
  }

  const askedKey = (key) => `GENERIC_ASKED_marketplace_${key}`;
  function shouldAsk(med) {
    if (isGenericItem(med)) return false;
    const key = compKeyOf(med);
    if (!key) return false;
    return !sessionStorage.getItem(askedKey(key));
  }
  function markAsked(med) {
    const key = compKeyOf(med);
    if (key) sessionStorage.setItem(askedKey(key), "1");
  }

  async function addWithGenericCheck(med) {
    if (!canDeliver) return;
    addToCart(med);

    if (!shouldAsk(med)) return;
    markAsked(med);

    const key = compKeyOf(med);

    // 1) server-first global
    let data = await fetchGenericsGlobal(key, med._id);

    if (!data || !Array.isArray(data.generics) || data.generics.length === 0) {
      data = findGenericsLocally(medicines, med);
    } else {
      data.brand = data.brand || med;
    }

    if (data?.generics?.length) {
      setGenericSugg({ open: true, brand: data.brand || med, generics: data.generics });
    }
  }

  const medTypes = useMedTypeChips(medicines);

  const mergeMarketplaceMedicines = useCallback((baseList, incomingList) => {
    const seen = new Map();
    const put = (m) => {
      if (!m) return;
      const key = medicineListingKey(m);
      const existing = seen.get(key);
      if (!existing || (Number(m.price) || 0) < (Number(existing.price) || 0)) {
        seen.set(key, m);
      }
    };
    (baseList || []).forEach(put);
    (incomingList || []).forEach(put);
    return Array.from(seen.values());
  }, []);

  const fetchMarketplacePage = useCallback(
    async (pageToLoad, { reset = false } = {}) => {
      if (!reset && marketplaceInFlightRef.current) return;
      const requestSeq = marketplaceRequestSeqRef.current + 1;
      marketplaceRequestSeqRef.current = requestSeq;
      marketplaceInFlightRef.current = true;
      if (reset) setLoading(true);
      else setLoadingMore(true);

      try {
        const city = currentAddress?.city || localStorage.getItem("city") || "";
        const params = new URLSearchParams();
        if (city) params.append("city", city);
        params.append("paged", "1");
        params.append("page", String(pageToLoad));
        params.append("limit", String(MARKETPLACE_PAGE_SIZE));
        params.append("catalogFallback", "1");
        params.append("catalogSource", "blinkit");

        const res = await axios.get(`${API}/api/medicines/all?${params.toString()}`, { timeout: 20000 });
        const payload = res?.data;
        const items = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
          ? payload.items
          : [];
        const total = Array.isArray(payload) ? items.length : Number(payload?.total || items.length);
        const hasMore = Array.isArray(payload) ? false : !!payload?.hasMore;

        if (requestSeq !== marketplaceRequestSeqRef.current) return;
        setMedicines((prev) => mergeMarketplaceMedicines(reset ? [] : prev, items));
        setMarketplacePage(pageToLoad);
        setMarketplaceTotal(Number.isFinite(total) ? total : items.length);
        setMarketplaceHasMore(hasMore);
      } catch {
        if (requestSeq !== marketplaceRequestSeqRef.current) return;
        if (reset) {
          setMedicines([]);
          setMarketplacePage(0);
          setMarketplaceTotal(0);
          setMarketplaceHasMore(false);
        }
      } finally {
        if (requestSeq !== marketplaceRequestSeqRef.current) return;
        if (reset) setLoading(false);
        setLoadingMore(false);
        marketplaceInFlightRef.current = false;
      }
    },
    [currentAddress?.city, mergeMarketplaceMedicines]
  );

  useEffect(() => {
    const lat = Number(currentAddress?.lat);
    const lng = Number(currentAddress?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    fetch(`${API}/api/delivery/active-partner-nearby?lat=${lat}&lng=${lng}`)
      .then((r) => r.json())
      .then((d) => setCanDeliver(!!d.activePartnerExists))
      .catch(() => setCanDeliver(false));
  }, [currentAddress]);

  useEffect(() => {
    if (isMarketplace) {
      setPharmacy(null);
      return;
    }
    (async () => {
      try {
        const r = await axios.get(`${API}/api/pharmacies?id=${pharmacyId}`);
        if (Array.isArray(r.data)) setPharmacy(r.data[0]);
      } catch {
        setPharmacy(null);
      }
    })();
  }, [pharmacyId, isMarketplace]);

  useEffect(() => {
    if (isMarketplace) {
      setMedicines([]);
      setMarketplacePage(0);
      setMarketplaceHasMore(false);
      setMarketplaceTotal(0);
      setLoadingMore(false);
      fetchMarketplacePage(1, { reset: true });
      return;
    }

    setLoading(true);
    axios
      .get(`${API}/api/medicines?pharmacyId=${pharmacyId}&onlyAvailable=1`, { timeout: 20000 })
      .then((res) => setMedicines(res.data || []))
      .catch(() => setMedicines([]))
      .finally(() => setLoading(false));
  }, [pharmacyId, isMarketplace, fetchMarketplacePage]);

  const loadNextMarketplacePage = useCallback(() => {
    if (!isMarketplace || loading || loadingMore || !marketplaceHasMore) return;
    fetchMarketplacePage(marketplacePage + 1, { reset: false });
  }, [isMarketplace, loading, loadingMore, marketplaceHasMore, marketplacePage, fetchMarketplacePage]);

  useEffect(() => {
    if (!isMarketplace || loading || !marketplaceHasMore) return;
    const root = scrollRef.current;
    const target = loadMoreAnchorRef.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadNextMarketplacePage();
        }
      },
      { root, rootMargin: MARKETPLACE_OBSERVER_MARGIN, threshold: 0.01 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [isMarketplace, loading, marketplaceHasMore, loadNextMarketplacePage, medicines.length]);

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

  const filteredMeds = useMemo(() => {
  const isGenericLocal = (m) =>
    m?.productKind === "generic" || !m?.brand || String(m.brand).trim() === "";

  const kindOk = (m) => {
    if (selectedKind === "All") return true;
    if (selectedKind === "Generic") return isGenericLocal(m);
    if (selectedKind === "Branded") return !isGenericLocal(m);
    return true;
  };

  let meds = medicines
    .filter((m) => m.status !== "unavailable" && m.available !== false)
    .filter((m) => matchCategory(m, selectedCategory) && matchType(m, selectedType))
    .filter((m) => kindOk(m));

  if (searchQ.trim()) {
    const q = searchQ.trim().toLowerCase();
    meds = meds.filter((m) => {
      const fields = [
        m.name,
        m.brand,
        m.company,
        m.composition,
        Array.isArray(m.category) ? m.category.join(" ") : m.category,
      ]
        .filter(Boolean)
        .map(String)
        .join(" ")
        .toLowerCase();
      return fields.includes(q);
    });
  }

  return meds;
  }, [medicines, selectedCategory, selectedType, selectedKind, searchQ]);

  function handleAddDoctorPrescription() {
    if (!doctorPrescriptionSummary.addableProducts.length) {
      setDoctorPrescriptionMessage("Is prescription ke mapped medicines abhi marketplace me available nahi hain.");
      return;
    }
    const nextPharmacyId = doctorPrescriptionSummary.addableProducts[0]?.pharmacyId || "";
    const cartPharmacyId = cart[0]?.pharmacyId || cart[0]?.pharmacy?._id || cart[0]?.pharmacy || "";
    const replacedCart =
      cart.length > 0 &&
      nextPharmacyId &&
      cartPharmacyId &&
      String(nextPharmacyId) !== String(cartPharmacyId);

    if (replacedCart) {
      if (typeof clearCartAndStorage === "function") clearCartAndStorage();
      else if (typeof clearCart === "function") clearCart();
    }
    doctorPrescriptionSummary.addableProducts.forEach((product) => addToCart(product));
    setDoctorPrescriptionMessage(
      replacedCart
        ? `Purana cart replace karke ${doctorPrescriptionSummary.addableCount} prescribed medicines add kar di gayi.`
        : `${doctorPrescriptionSummary.addableCount} prescribed medicines cart me add ho gayi.`
    );
  }

  const images = useMemo(() => {
    if (!selectedMed) return [];
    const arr = (Array.isArray(selectedMed.images) && selectedMed.images.length ? selectedMed.images : [selectedMed.img]).filter(
      Boolean
    );
    return arr;
  }, [selectedMed]);

  const openMed = async (med) => {
    setSelectedMed(med);
    setActiveImg(0);
    if (!med.description || !med.description.trim()) {
      const desc = await ensureDescription(API, med._id);
      if (desc) {
        setSelectedMed((prev) => (prev ? { ...prev, description: desc } : prev));
        setMedicines((ms) => ms.map((m) => (m._id === med._id ? { ...m, description: desc } : m)));
      }
    }
  };

  const totalCount = filteredMeds.length;
  const isDefaultCatalogView =
    selectedCategory === "All" &&
    selectedType === "All" &&
    selectedKind === "All" &&
    !searchQ.trim();
  const countPillText =
    isMarketplace && isDefaultCatalogView && marketplaceTotal > 0
      ? marketplaceHasMore
        ? `${totalCount}/${marketplaceTotal}`
        : `${marketplaceTotal}`
      : `${totalCount}`;

  return (
    <div
      style={{
        position: "relative",
        height: "100dvh",
        width: "100%",
        maxWidth: 480,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#F3F7F5",
        fontFamily: "'Plus Jakarta Sans',sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ flexShrink: 0, zIndex: 20 }}>
        <div
          style={{
            padding: "14px 16px 10px",
            background: `linear-gradient(135deg,${DEEP} 0%,#083D28 100%)`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: -40,
              top: -40,
              width: 140,
              height: 140,
              borderRadius: "50%",
              background: `radial-gradient(circle,${ACC}12,transparent 65%)`,
              pointerEvents: "none",
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => (isMarketplace ? navigate("/home") : navigate(-1))}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                flexShrink: 0,
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <ArrowLeft style={{ width: 16, height: 16, color: "#fff" }} />
            </motion.button>

            <div style={{ flex: 1, minWidth: 0 }}>
              {isMarketplace ? (
                <>
                  <div
                    style={{
                      fontFamily: "'Sora',sans-serif",
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#fff",
                      letterSpacing: "-0.3px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    All Medicines
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: ACC,
                      marginTop: 2,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <ShieldCheck style={{ width: 11, height: 11 }} />
                    Fulfilled by GoDavaii · {currentAddress?.city || "Near You"}
                  </div>
                </>
              ) : pharmacy ? (
                <>
                  <div
                    style={{
                      fontFamily: "'Sora',sans-serif",
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#fff",
                      letterSpacing: "-0.3px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {pharmacy.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: ACC,
                      marginTop: 2,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <ShieldCheck style={{ width: 11, height: 11 }} />
                    Fulfilled by GoDavaii · Verified Partner
                  </div>
                </>
              ) : (
                <div
                  style={{
                    height: 20,
                    width: 140,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.15)",
                    animation: "medPulse 1.5s infinite",
                  }}
                />
              )}
            </div>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                setShowSearch(!showSearch);
                if (showSearch) setSearchQ("");
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                flexShrink: 0,
                background: showSearch ? ACC : "rgba(255,255,255,0.10)",
                border: `1px solid ${showSearch ? ACC : "rgba(255,255,255,0.15)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Search style={{ width: 16, height: 16, color: showSearch ? DEEP : "#fff" }} />
            </motion.button>

            {!loading && totalCount > 0 && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: DEEP,
                  background: ACC,
                  padding: "4px 12px",
                  borderRadius: 100,
                  flexShrink: 0,
                  fontFamily: "'Sora',sans-serif",
                }}
              >
                {countPillText}
              </span>
            )}
          </div>

          {!canDeliver && (
            <div
              style={{
                marginTop: 10,
                background: "rgba(254,226,226,0.15)",
                color: "#FCA5A5",
                fontSize: 11.5,
                fontWeight: 700,
                padding: "7px 12px",
                borderRadius: 10,
                border: "1px solid rgba(252,165,165,0.25)",
              }}
            >
              ⛔ No delivery partner available at your location right now.
            </div>
          )}
        </div>

        {/* Search bar */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: "hidden", background: "#fff", borderBottom: "1px solid rgba(12,90,62,0.06)" }}
            >
              <div style={{ padding: "8px 16px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    height: 40,
                    borderRadius: 12,
                    background: "#F3F7F5",
                    border: "1.5px solid rgba(12,90,62,0.10)",
                    padding: "0 12px",
                    gap: 8,
                  }}
                >
                  <Search style={{ width: 14, height: 14, color: "#94A3B8", flexShrink: 0 }} />
                  <input
                    autoFocus
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="Search medicines here..."
                    style={{
                      flex: 1,
                      background: "none",
                      border: "none",
                      outline: "none",
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: "#0B1F16",
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                    }}
                  />
                  {searchQ && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setSearchQ("")}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: "#E2E8F0",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <X style={{ width: 11, height: 11, color: "#64748B" }} />
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div style={{ background: "#fff", borderBottom: "1px solid rgba(12,90,62,0.06)" }}>
          <div
            style={{
              display: "flex",
              gap: 7,
              overflowX: "auto",
              padding: "8px 14px 6px",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitMaskImage: "linear-gradient(90deg,#000 90%,transparent)",
              maskImage: "linear-gradient(90deg,#000 90%,transparent)",
            }}
          >
            {allCategories.map((c) => (
              <Chip
                key={c}
                label={c}
                active={c === selectedCategory}
                onClick={() => {
                  setSelectedCategory(c);
                  if (scrollRef.current) scrollRef.current.scrollTop = 0;
                }}
              />
            ))}
          </div>

          <div
            style={{
              display: "flex",
              gap: 7,
              overflowX: "auto",
              padding: "4px 14px 8px",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitMaskImage: "linear-gradient(90deg,#000 90%,transparent)",
              maskImage: "linear-gradient(90deg,#000 90%,transparent)",
            }}
          >
            {BRAND_KINDS.map((k) => (
              <Chip key={`kind-${k}`} label={k} active={k === selectedKind} onClick={() => setSelectedKind(k)} />
            ))}
            <div
              style={{
                width: 1.5,
                height: 22,
                background: "rgba(12,90,62,0.12)",
                borderRadius: 1,
                flexShrink: 0,
                alignSelf: "center",
              }}
            />
            {medTypes.map((t) => (
              <Chip key={`type-${t}`} label={t} active={t === selectedType} onClick={() => setSelectedType(t)} />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "12px 12px 140px",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {prescriptionId && (
          <div
            style={{
              marginBottom: 12,
              background: "linear-gradient(135deg,#ECFDF5,#F0FDF4)",
              border: "1px solid rgba(16,185,129,0.18)",
              borderRadius: 20,
              padding: 14,
              boxShadow: "0 8px 24px rgba(12,90,62,0.08)",
            }}
          >
            {doctorPrescriptionLoading ? (
              <div style={{ color: "#166534", fontSize: 12, fontWeight: 800 }}>
                Loading doctor prescription...
              </div>
            ) : doctorPrescriptionSummary.prescriptionId ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 14,
                      background: "rgba(16,185,129,0.12)",
                      display: "grid",
                      placeItems: "center",
                      color: "#059669",
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    Rx
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 800, color: "#0B1F16" }}>
                      Doctor prescription is ready
                    </div>
                    <div style={{ fontSize: 11.5, color: "#4B7A62", fontWeight: 700, marginTop: 2 }}>
                      {doctorPrescriptionSummary.medicineCount} suggested medicines ·{" "}
                      {doctorPrescriptionSummary.addableCount > 0
                        ? `${doctorPrescriptionSummary.addableCount} available to add in one click`
                        : "Review availability below"}
                    </div>
                  </div>
                </div>

                {doctorPrescriptionSummary.resolvedItems.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                    {doctorPrescriptionSummary.resolvedItems.slice(0, 4).map((item) => (
                      <span
                        key={item.id}
                        style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          color: "#166534",
                          background: "#fff",
                          border: "1px solid rgba(16,185,129,0.16)",
                          padding: "5px 9px",
                          borderRadius: 999,
                        }}
                      >
                        {item.prescribedMedicine || "Medicine"}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAddDoctorPrescription}
                    disabled={doctorPrescriptionSummary.addableCount === 0}
                    style={{
                      height: 38,
                      padding: "0 14px",
                      borderRadius: 999,
                      border: "none",
                      background:
                        doctorPrescriptionSummary.addableCount > 0
                          ? `linear-gradient(135deg,${DEEP},${MID})`
                          : "#D1D5DB",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 800,
                      fontFamily: "'Sora',sans-serif",
                      cursor: doctorPrescriptionSummary.addableCount > 0 ? "pointer" : "not-allowed",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <ShoppingCart style={{ width: 14, height: 14 }} />
                    Add all available
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setDoctorPrescriptionDialogOpen(true)}
                    style={{
                      height: 38,
                      padding: "0 14px",
                      borderRadius: 999,
                      border: "1px solid rgba(16,185,129,0.18)",
                      background: "#fff",
                      color: DEEP,
                      fontSize: 12,
                      fontWeight: 800,
                      fontFamily: "'Sora',sans-serif",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    View prescription
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate("/cart")}
                    style={{
                      height: 38,
                      padding: "0 14px",
                      borderRadius: 999,
                      border: "1px solid rgba(12,90,62,0.14)",
                      background: "#fff",
                      color: DEEP,
                      fontSize: 12,
                      fontWeight: 800,
                      fontFamily: "'Sora',sans-serif",
                      cursor: "pointer",
                    }}
                  >
                    View cart
                  </motion.button>
                </div>

                {doctorPrescriptionSummary.unavailableCount > 0 && (
                  <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: "#4B7A62" }}>
                    {doctorPrescriptionSummary.unavailableCount} medicines abhi unavailable hain. Jo mapped hain woh upar ke button se add ho jayengi.
                  </div>
                )}

                {doctorPrescriptionMessage ? (
                  <div style={{ marginTop: 10, fontSize: 11, fontWeight: 800, color: "#166534" }}>
                    {doctorPrescriptionMessage}
                  </div>
                ) : null}
              </>
            ) : (
              <div style={{ color: "#4B7A62", fontSize: 12, fontWeight: 800 }}>
                Doctor prescription load nahi ho paya. Aap homepage se dobara open karke try kar sakte hain.
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                style={{
                  borderRadius: 20,
                  background: "#fff",
                  border: "1px solid rgba(12,90,62,0.06)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    aspectRatio: "4/3",
                    background: "linear-gradient(145deg,#F4FAF6,#E8F5EF)",
                    animation: "medPulse 1.5s ease-in-out infinite",
                  }}
                />
                <div style={{ padding: 12 }}>
                  <div
                    style={{
                      height: 14,
                      width: "80%",
                      borderRadius: 6,
                      background: "#E8F0EC",
                      marginBottom: 8,
                      animation: "medPulse 1.5s ease-in-out infinite",
                    }}
                  />
                  <div
                    style={{
                      height: 10,
                      width: "50%",
                      borderRadius: 6,
                      background: "#F0F5F2",
                      marginBottom: 10,
                      animation: "medPulse 1.5s ease-in-out infinite",
                    }}
                  />
                  <div
                    style={{
                      height: 18,
                      width: "40%",
                      borderRadius: 6,
                      background: "#E8F0EC",
                      animation: "medPulse 1.5s ease-in-out infinite",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : filteredMeds.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", padding: "60px 24px" }}>
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }} style={{ fontSize: 56, marginBottom: 16 }}>
              🔍
            </motion.div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800, color: "#0B1F16", marginBottom: 8 }}>
              No medicines found
            </div>
            <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>
              Try a different category, type, or clear your filters
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setSelectedCategory("All");
                setSelectedType("All");
                setSelectedKind("All");
                setSearchQ("");
              }}
              style={{
                marginTop: 18,
                height: 40,
                padding: "0 24px",
                borderRadius: 100,
                border: "none",
                background: `linear-gradient(135deg,${DEEP},${MID})`,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "'Sora',sans-serif",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(12,90,62,0.25)",
              }}
            >
              Clear all filters
            </motion.button>
            {isMarketplace && marketplaceHasMore && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={loadNextMarketplacePage}
                style={{
                  marginTop: 10,
                  height: 38,
                  padding: "0 18px",
                  borderRadius: 999,
                  border: "1px solid rgba(12,90,62,0.16)",
                  background: "#fff",
                  color: DEEP,
                  fontSize: 12,
                  fontWeight: 800,
                  fontFamily: "'Sora',sans-serif",
                  cursor: "pointer",
                }}
              >
                Search in more medicines
              </motion.button>
            )}
          </motion.div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {filteredMeds.map((med, idx) => (
                <div key={med._id || med.sourceProductId || `${med.name || "med"}-${idx}`}>
                  <MedCard med={med} canDeliver={canDeliver} onTap={() => openMed(med)} onAdd={(m) => addWithGenericCheck(m)} />
                </div>
              ))}
            </div>

            {isMarketplace && (
              <>
                <div ref={loadMoreAnchorRef} style={{ height: 1 }} />
                {loadingMore && (
                  <div
                    style={{
                      marginTop: 14,
                      textAlign: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#4B7A62",
                    }}
                  >
                    Loading more medicines...
                  </div>
                )}
                {!loadingMore && marketplaceHasMore && (
                  <div style={{ marginTop: 14, textAlign: "center" }}>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={loadNextMarketplacePage}
                      style={{
                        height: 38,
                        padding: "0 18px",
                        borderRadius: 999,
                        border: "1px solid rgba(12,90,62,0.16)",
                        background: "#fff",
                        color: DEEP,
                        fontSize: 12,
                        fontWeight: 800,
                        fontFamily: "'Sora',sans-serif",
                        cursor: "pointer",
                      }}
                    >
                      Load more medicines
                    </motion.button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedMed} onOpenChange={(open) => { if (!open) { setSelectedMed(null); setActiveImg(0); } }}>
        <DialogContent style={{ width: "min(96vw,520px)", padding: 0, overflow: "hidden", borderRadius: 24, border: "none" }}>
          {selectedMed && (
            <div>
              <div style={{ padding: "18px 20px 14px", background: `linear-gradient(135deg,${DEEP},${MID})`, position: "relative" }}>
                <button
                  onClick={() => setSelectedMed(null)}
                  style={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.15)",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X style={{ width: 15, height: 15, color: "#fff" }} />
                </button>
                <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, color: "#fff", paddingRight: 40, lineHeight: 1.3 }}>
                  {selectedMed.brand || selectedMed.name}
                </div>
                {selectedMed.company && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{selectedMed.company}</div>
                )}
              </div>

              <div
                style={{
                  margin: "0 16px",
                  marginTop: 12,
                  background: "linear-gradient(135deg, #ECFDF5, #D1FAE5)",
                  borderRadius: 14,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: "1px solid rgba(5,150,105,0.15)",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: "rgba(5,150,105,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <ShieldCheck style={{ width: 18, height: 18, color: "#059669" }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#065F46", fontFamily: "'Sora',sans-serif" }}>
                    Fulfilled by GoDavaii
                  </div>
                  <div style={{ fontSize: 10.5, color: "#6B9E88", fontWeight: 500, marginTop: 1 }}>
                    Nearby verified pharmacy · Quality guaranteed
                  </div>
                </div>
              </div>

              <div style={{ padding: "14px 16px 0" }}>
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: 240,
                    borderRadius: 18,
                    background: "linear-gradient(145deg,#F4FAF6,#E8F5EF)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      display: "flex",
                      transition: "transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)",
                      transform: `translateX(-${activeImg * 100}%)`,
                    }}
                    onTouchStart={(e) => (e.currentTarget.dataset.sx = e.touches[0].clientX)}
                    onTouchEnd={(e) => {
                      const sx = Number(e.currentTarget.dataset.sx || 0);
                      const dx = e.changedTouches[0].clientX - sx;
                      if (dx < -40 && activeImg < images.length - 1) setActiveImg((i) => i + 1);
                      if (dx > 40 && activeImg > 0) setActiveImg((i) => i - 1);
                    }}
                  >
                    {images.map((src, i) => {
                      const imgSrc = getImageUrl(src);
                      return (
                        <div key={i} style={{ minWidth: "100%", height: "100%", display: "grid", placeItems: "center" }}>
                          {imgSrc ? (
                            <img src={imgSrc} alt={selectedMed.name} style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} draggable={false} />
                          ) : (
                            <div style={{ fontSize: 56 }}>💊</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {images.length > 1 && (
                    <>
                      <button
                        onClick={() => setActiveImg((i) => Math.max(0, i - 1))}
                        style={{
                          position: "absolute",
                          left: 8,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.9)",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                        }}
                      >
                        <ChevronLeft style={{ width: 16, height: 16, color: DEEP }} />
                      </button>
                      <button
                        onClick={() => setActiveImg((i) => Math.min(images.length - 1, i + 1))}
                        style={{
                          position: "absolute",
                          right: 8,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.9)",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                        }}
                      >
                        <ChevronRight style={{ width: 16, height: 16, color: DEEP }} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div style={{ padding: "14px 16px 0", maxHeight: 280, overflowY: "auto" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {Array.isArray(selectedMed.category) && selectedMed.category.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: DEEP, background: "#E8F5EF", padding: "3px 10px", borderRadius: 100, border: `1px solid ${DEEP}20` }}>
                      {selectedMed.category.join(", ")}
                    </span>
                  )}
                  {selectedMed.type && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#4A6B5A", background: "#F0F9F4", padding: "3px 10px", borderRadius: 100, border: "1px solid rgba(12,90,62,0.15)" }}>
                      {Array.isArray(selectedMed.type) ? selectedMed.type.join(", ") : selectedMed.type}
                    </span>
                  )}
                  {(selectedMed.packCount || selectedMed.packUnit) && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#4A6B5A", background: "#F0F9F4", padding: "3px 10px", borderRadius: 100, border: "1px solid rgba(12,90,62,0.15)", display: "flex", alignItems: "center", gap: 4 }}>
                      <Package style={{ width: 10, height: 10 }} />
                      {packLabel(selectedMed.packCount, selectedMed.packUnit)}
                    </span>
                  )}
                  {selectedMed.prescriptionRequired && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", background: "#FEF2F2", padding: "3px 10px", borderRadius: 100, border: "1px solid #FCA5A5" }}>
                      Rx Required
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0" }}>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 26, fontWeight: 800, color: DEEP }}>
                    ₹{selectedMed.price}
                  </span>
                  {hasValidMrp(selectedMed) && (
                    <>
                      <span style={{ fontSize: 14, color: "#CBD5E1", textDecoration: "line-through" }}>₹{selectedMed.mrp}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: `linear-gradient(135deg,${DEEP},${MID})`, padding: "3px 10px", borderRadius: 100 }}>
                        {Math.round(((selectedMed.mrp - selectedMed.price) / selectedMed.mrp) * 100)}% OFF
                      </span>
                    </>
                  )}
                </div>

                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, marginBottom: 16, whiteSpace: "pre-line", background: "#F8FBFA", borderRadius: 12, padding: "10px 12px" }}>
                  {selectedMed.description || <span style={{ color: "#94A3B8" }}>No description available.</span>}
                </div>
              </div>

              <div style={{ padding: "12px 16px 16px", display: "flex", gap: 10, borderTop: "1px solid rgba(12,90,62,0.08)" }}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedMed(null)}
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 14,
                    border: "1.5px solid rgba(12,90,62,0.15)",
                    background: "#F8FBFA",
                    color: "#374151",
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: "'Sora',sans-serif",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                  }}
                >
                  <X style={{ width: 14, height: 14 }} /> Close
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={!canDeliver}
                  onClick={async () => {
                    await addWithGenericCheck(selectedMed);
                    setSelectedMed(null);
                  }}
                  style={{
                    flex: 2,
                    height: 48,
                    borderRadius: 14,
                    border: "none",
                    background: canDeliver ? `linear-gradient(135deg,${DEEP},${MID})` : "#E2E8F0",
                    color: canDeliver ? "#fff" : "#94A3B8",
                    fontSize: 14,
                    fontWeight: 800,
                    fontFamily: "'Sora',sans-serif",
                    cursor: canDeliver ? "pointer" : "not-allowed",
                    boxShadow: canDeliver ? "0 4px 16px rgba(12,90,62,0.35)" : "none",
                  }}
                >
                  Add to Cart 🛒
                </motion.button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DoctorPrescriptionViewDialog
        prescription={doctorPrescription}
        open={doctorPrescriptionDialogOpen}
        onOpenChange={setDoctorPrescriptionDialogOpen}
      />

      {/* Generic Suggestion Modal */}
      <GenericSuggestionModal
        open={genericSugg.open}
        onOpenChange={(o) => setGenericSugg((s) => ({ ...s, open: o }))}
        brand={genericSugg.brand}
        generics={genericSugg.generics}
        onReplace={(g) => {
          const qty = (cart.find((i) => (i._id || i.id) === (genericSugg.brand?._id || genericSugg.brand?.id))?.quantity) || 1;
          removeFromCart(genericSugg.brand);
          for (let k = 0; k < qty; k++) addToCart(g);
          setGenericSugg({ open: false, brand: null, generics: [] });
        }}
        onAddAlso={(g) => {
          addToCart(g);
          setGenericSugg({ open: false, brand: null, generics: [] });
        }}
        onKeep={() => setGenericSugg({ open: false, brand: null, generics: [] })}
      />

      {/* Upload Prescription FAB */}
      <motion.div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          zIndex: 1201,
          display: "flex",
          justifyContent: "flex-end",
          paddingRight: 16,
          bottom: bottomDock((cart?.length || 0) > 0),
          pointerEvents: uploadOpen ? "none" : "auto",
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {!uploadOpen && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            aria-label="Upload Prescription"
            onClick={() => setUploadOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              height: 50,
              paddingLeft: 12,
              paddingRight: 22,
              borderRadius: 100,
              border: "none",
              background: `linear-gradient(135deg,${DEEP},${MID})`,
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 8px 28px rgba(12,90,62,0.40)",
              fontFamily: "'Sora',sans-serif",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,rgba(255,255,255,0.12),transparent 60%)", pointerEvents: "none" }} />
            <span style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.15)" }}>
              <UploadCloud style={{ width: 16, height: 16, color: "#fff" }} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, position: "relative", zIndex: 1 }}>Upload Prescription</span>
          </motion.button>
        )}
      </motion.div>

      <PrescriptionUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} userCity={localStorage.getItem("city") || "Delhi"} />

      <style>{`
        @keyframes medPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
