import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileUp,
  Filter,
  FlaskConical,
  HeartPulse,
  Home,
  IndianRupee,
  Info,
  Microscope,
  Search,
  ShieldCheck,
  Sparkles,
  TestTube2,
  User2,
  Users,
  Wallet,
  X,
} from "lucide-react";

const BRAND = {
  deep: "#0C5A3E",
  mid: "#0E7A4F",
  acc: "#00D97E",
  ink: "#0F172A",
  sub: "#64748B",
  border: "rgba(12,90,62,0.12)",
  bg1: "#ECFDF5",
  bg2: "#E6F4FF",
  bg3: "#F8FAFC",
};

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const FALLBACK_SLOT_WINDOWS = [
  "06:30 AM - 08:00 AM",
  "08:00 AM - 09:30 AM",
  "09:30 AM - 11:00 AM",
  "11:00 AM - 12:30 PM",
  "04:00 PM - 05:30 PM",
  "05:30 PM - 07:00 PM",
];

function authConfig(extra = {}) {
  const token = localStorage.getItem("token");
  return {
    ...extra,
    headers: {
      ...(extra.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
}
const CATEGORIES = [
  "All",
  "Popular",
  "Full Body",
  "Diabetes",
  "Thyroid",
  "Heart",
  "Women",
  "Senior",
  "Vitamin",
  "Fever",
  "Liver",
  "Kidney",
];

function next4Days() {
  const arr = [];
  for (let i = 0; i < 4; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    arr.push({
      iso: d.toISOString().slice(0, 10),
      day: d.toLocaleDateString("en-IN", { weekday: "short" }),
      date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      full: d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    });
  }
  return arr;
}

function formatMoney(value) {
  return `Rs ${Number(value || 0)}`;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeBookingStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function isCompletedBooking(booking) {
  const doneStatuses = new Set([
    "completed",
    "cancelled",
    "report_ready",
    "report_generated",
    "delivered",
  ]);
  const status = normalizeBookingStatus(booking?.status);
  return (
    doneStatuses.has(status) ||
    Boolean(booking?.reportAvailable) ||
    Boolean(booking?.resultAvailable)
  );
}

function buildPackageDetails(pack) {
  const tests = toArray(pack?.tests);
  const oldPrice = Number(pack?.oldPrice || 0);
  const price = Number(pack?.price || 0);
  const savings = Math.max(0, oldPrice - price);
  const reportTime = pack?.reportTime || "24 hrs";
  const name = String(pack?.name || "Health Package");

  const valueLine =
    savings > 0
      ? `Save Rs ${savings} versus booking tests separately.`
      : `One booking includes ${tests.length || 1} clinically relevant tests.`;

  return {
    whyBest:
      pack?.whyBest ||
      `${name} helps with preventive screening in one go so users do not miss related markers.`,
    idealFor:
      pack?.idealFor || `Best for users who want complete checks with home collection convenience.`,
    valueLine,
    reportCommitment:
      pack?.reportCommitment || `Digital report ETA ${reportTime} with GoDavaii follow-up support.`,
  };
}

function Glass({ children, style }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.88)",
        border: `1px solid ${BRAND.border}`,
        borderRadius: 22,
        boxShadow: "0 10px 26px rgba(2,6,23,0.05)",
        backdropFilter: "blur(14px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ title, action, onClick }) {
  return (
    <div
      style={{
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <div
        style={{
          fontFamily: "'Sora',sans-serif",
          fontSize: 14,
          fontWeight: 900,
          color: BRAND.ink,
        }}
      >
        {title}
      </div>
      {action ? (
        <button
          onClick={onClick}
          style={{
            border: "none",
            background: "transparent",
            color: BRAND.deep,
            fontSize: 11,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {action}
        </button>
      ) : null}
    </div>
  );
}

function Pill({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        height: 33,
        borderRadius: 999,
        border: active ? "none" : "1px solid #D1D5DB",
        background: active ? BRAND.deep : "#fff",
        color: active ? "#fff" : "#1F2937",
        padding: "0 12px",
        fontSize: 11.5,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function TinyBadge({ children, green }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 800,
        background: green ? "#ECFDF5" : "#F8FAFC",
        color: green ? "#166534" : "#334155",
        border: green ? "1px solid #A7F3D0" : "1px solid #E2E8F0",
      }}
    >
      {children}
    </span>
  );
}

export default function LabTests() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [showOnlyHomeCollection, setShowOnlyHomeCollection] = useState(false);

  const [selectedTests, setSelectedTests] = useState([]);
  const [selectedPackageIds, setSelectedPackageIds] = useState([]);

  const [detailItem, setDetailItem] = useState(null);

    const [tests, setTests] = useState([]);
  const [packages, setPackages] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [dateList, setDateList] = useState(() => next4Days());
  const [slotWindows, setSlotWindows] = useState(FALLBACK_SLOT_WINDOWS);

  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [apiError, setApiError] = useState("");

  const [flowOpen, setFlowOpen] = useState(false);
  const [step, setStep] = useState(1);

  const [whoFor, setWhoFor] = useState("self");
  const [profileName, setProfileName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [cityArea, setCityArea] = useState("Noida");
  const [date, setDate] = useState(next4Days()[0]?.iso || "");
  const [slot, setSlot] = useState(FALLBACK_SLOT_WINDOWS[1]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(null);
  const [cancelingBookingId, setCancelingBookingId] = useState("");
  const [vaultBusyBookingId, setVaultBusyBookingId] = useState("");

  useEffect(() => {
    let cancel = false;
    const loadCatalog = async () => {
      setLoadingCatalog(true);
      setApiError("");
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/labs/catalog`, {
          params: {
            q: query || undefined,
            category,
            homeCollection: showOnlyHomeCollection ? 1 : undefined,
          },
        });
        if (cancel) return;
        setTests(Array.isArray(data?.tests) ? data.tests : []);
        setPackages(Array.isArray(data?.packages) ? data.packages : []);
        if (Array.isArray(data?.dateOptions) && data.dateOptions.length) {
          setDateList(data.dateOptions);
          setDate((prev) =>
            data.dateOptions.some((d) => d.iso === prev) ? prev : data.dateOptions[0].iso
          );
        }
        if (Array.isArray(data?.slotWindows) && data.slotWindows.length) {
          setSlotWindows(data.slotWindows);
          setSlot((prev) => (data.slotWindows.includes(prev) ? prev : data.slotWindows[0]));
        }
      } catch (e) {
        if (!cancel) setApiError(e?.response?.data?.error || "Failed to load lab catalog");
      } finally {
        if (!cancel) setLoadingCatalog(false);
      }
    };

    loadCatalog();
    return () => {
      cancel = true;
    };
  }, [query, category, showOnlyHomeCollection]);

  useEffect(() => {
    let cancel = false;
    const loadBookings = async () => {
      setLoadingBookings(true);
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/labs/bookings/my`, authConfig());
        if (cancel) return;
        const rows = Array.isArray(data?.bookings) ? data.bookings : [];
        setBookings(rows);

        const latest = rows[0];
        if (latest) {
          setProfileName(latest.profileName || "");
          setPhone(latest.phone || "");
          setAddress(latest.address || "");
          setLandmark(latest.landmark || "");
          setCityArea(latest.cityArea || "Noida");
        }
      } catch {
        if (!cancel) setBookings([]);
      } finally {
        if (!cancel) setLoadingBookings(false);
      }
    };

    loadBookings();
    return () => {
      cancel = true;
    };
  }, []);

  const filteredTests = useMemo(() => tests, [tests]);

  const filteredPackages = useMemo(() => packages, [packages]);

  const cartRows = useMemo(() => {
    const packageRows = selectedPackageIds
      .map((id) => filteredPackages.find((p) => p.id === id))
      .filter(Boolean)
      .map((pack) => ({
        id: pack.id,
        type: "package",
        name: pack.name,
        price: pack.price,
        reportTime: pack.reportTime,
      }));

    const testRows = selectedTests.map((id) => {
      const found = tests.find((x) => x.id === id);
      return {
        id,
        type: "test",
        name: found?.name || id,
        price: found?.price || 0,
        reportTime: found?.reportTime || "24 hrs",
      };
    });

    return [...packageRows, ...testRows];
  }, [filteredPackages, selectedPackageIds, selectedTests, tests]);

  const total = useMemo(() => cartRows.reduce((sum, row) => sum + Number(row.price || 0), 0), [cartRows]);

  const discount = useMemo(() => {
    const packageDiscount = selectedPackageIds.reduce((sum, id) => {
      const pack = filteredPackages.find((p) => p.id === id);
      return sum + Math.max(0, Number(pack?.oldPrice || 0) - Number(pack?.price || 0));
    }, 0);

    const testsDiscount = selectedTests.reduce((sum, id) => {
      const found = tests.find((x) => x.id === id);
      return sum + Math.max(0, Number(found?.oldPrice || 0) - Number(found?.price || 0));
    }, 0);

    return packageDiscount + testsDiscount;
  }, [filteredPackages, selectedPackageIds, selectedTests, tests]);

  const upcoming = useMemo(() => {
    return [...bookings]
      .filter((booking) => !isCompletedBooking(booking))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .reverse()
      .slice(0, 5);
  }, [bookings]);

  function toggleTest(testId) {
    setSelectedTests((prev) =>
      prev.includes(testId) ? prev.filter((x) => x !== testId) : [...prev, testId]
    );
  }

  function togglePackage(packageId) {
    setSelectedPackageIds((prev) =>
      prev.includes(packageId) ? prev.filter((id) => id !== packageId) : [...prev, packageId]
    );
  }

  function clearSelection() {
    setSelectedPackageIds([]);
    setSelectedTests([]);
  }

  function openCheckout() {
    if (!cartRows.length) return;
    setBookingConfirmed(null);
    setStep(1);
    setFlowOpen(true);
  }

  function closeCheckout() {
    setFlowOpen(false);
    setStep(1);
  }

  function goNextStep() {
    if (step === 1) {
      if (!phone.trim() || !address.trim()) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!paymentMethod) return;
      setStep(4);
      return;
    }
  }

  function goPrevStep() {
    setStep((prev) => Math.max(1, prev - 1));
  }

  async function confirmBooking() {
    if (!paymentMethod || !address.trim() || !phone.trim()) return;

    try {
      setApiError("");

      const formData = new FormData();
      formData.append(
        "items",
        JSON.stringify(
          cartRows.map((r) => ({
            itemId: r.id,
            type: r.type,
            name: r.name,
            price: r.price,
            reportTime: r.reportTime,
          }))
        )
      );
      formData.append("whoFor", whoFor);
      formData.append(
        "profileName",
        profileName.trim() || (whoFor === "self" ? "Self" : "Family Member")
      );
      formData.append("phone", phone.trim());
      formData.append("address", address.trim());
      formData.append("landmark", landmark.trim());
      formData.append("cityArea", cityArea);
      formData.append("date", date);
      formData.append("slot", slot);
      formData.append("paymentMethod", paymentMethod);
      formData.append("paymentStatus", "paid");
      formData.append("confirmNow", "1");
      formData.append("notes", notes.trim());
      if (file) formData.append("file", file);

      const { data } = await axios.post(
        `${API_BASE_URL}/api/labs/bookings/create`,
        formData,
        authConfig({ headers: { "Content-Type": "multipart/form-data" } })
      );

      const booking = data?.booking;
      if (!booking) throw new Error("Booking create failed");

      setBookings((prev) => [booking, ...prev]);
      setBookingConfirmed(booking);

      clearSelection();
      setPaymentMethod("");
      setNotes("");
      setFile(null);
      setStep(5);
    } catch (e) {
      setApiError(e?.response?.data?.error || "Failed to confirm booking");
    }
  }

  function canCancelBooking(status) {
    return !["completed", "cancelled", "report_ready"].includes(String(status || ""));
  }

  async function cancelBooking(bookingId) {
    if (!bookingId || cancelingBookingId) return;
    setCancelingBookingId(bookingId);
    setApiError("");
    try {
      const { data } = await axios.patch(
        `${API_BASE_URL}/api/labs/bookings/${encodeURIComponent(bookingId)}/cancel`,
        { reason: "Cancelled by user from lab tests page" },
        authConfig()
      );
      const updated = data?.booking;
      if (updated?.id) {
        setBookings((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      }
    } catch (e) {
      setApiError(e?.response?.data?.error || "Failed to cancel booking");
    } finally {
      setCancelingBookingId("");
    }
  }

  function getReportUrl(booking) {
    if (!booking?.id) return "";
    return `${API_BASE_URL}/api/labs/bookings/${encodeURIComponent(booking.id)}/report`;
  }

  async function pushReportToVault(bookingId) {
    if (!bookingId || vaultBusyBookingId) return;
    setVaultBusyBookingId(bookingId);
    setApiError("");
    try {
      await axios.post(`${API_BASE_URL}/api/labs/bookings/${encodeURIComponent(bookingId)}/push-to-vault`, {}, authConfig());
    } catch (e) {
      setApiError(e?.response?.data?.error || "Failed to push report to health vault");
    } finally {
      setVaultBusyBookingId("");
    }
  }

  async function openReportSecurely(booking) {
    const url = getReportUrl(booking);
    if (!url) return;
    try {
      const res = await axios.get(url, authConfig({ responseType: "blob" }));
      const blobUrl = window.URL.createObjectURL(res.data);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e) {
      setApiError(e?.response?.data?.error || "Failed to open report");
    }
  }

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "0 auto",
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${BRAND.bg1} 0%, ${BRAND.bg2} 46%, ${BRAND.bg3} 100%)`,
        paddingBottom: 120,
      }}
    >
      <div style={{ padding: 14 }}>
        <Glass
          style={{
            padding: 14,
            background: "linear-gradient(135deg,#0B4D35,#0A623E)",
            border: "none",
            color: "#fff",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: -30,
              top: -30,
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                width: 36,
                height: 36,
                border: "1px solid rgba(255,255,255,0.16)",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
            >
              <ArrowLeft style={{ width: 17, height: 17 }} />
            </button>

            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: "rgba(0,217,126,0.14)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <FlaskConical style={{ width: 21, height: 21, color: BRAND.acc }} />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontFamily: "'Sora',sans-serif",
                  fontSize: 18,
                  fontWeight: 900,
                }}
              >
                Lab Tests
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.74)",
                }}
              >
                GoDavaii 2035 Health OS · Trusted home sample collection
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 8,
            }}
          >
            {[
              { label: "Verified", val: "GoDavaii Labs" },
              { label: "Collection", val: "30-90 min" },
              { label: "Reports", val: "AI Ready" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 13,
                  padding: "8px 9px",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 900 }}>{item.val}</div>
                <div
                  style={{
                    fontSize: 9.5,
                    opacity: 0.84,
                    fontWeight: 700,
                  }}
                >
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexWrap: "wrap",
              gap: 7,
            }}
          >
            <TinyBadge green>
              <ShieldCheck style={{ width: 11, height: 11 }} />
              GoDavaii Verified
            </TinyBadge>
            <TinyBadge green>
              <Sparkles style={{ width: 11, height: 11 }} />
              AI Explained Reports
            </TinyBadge>
            <TinyBadge>
              <Home style={{ width: 11, height: 11 }} />
              Home Collection
            </TinyBadge>
          </div>
        </Glass>

        <div style={{ marginTop: 10, position: "relative" }}>
          <Search
            style={{
              width: 14,
              height: 14,
              color: "#94A3B8",
              position: "absolute",
              top: 12,
              left: 10,
            }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search test, package, symptom, condition..."
            style={inputStyleWithIcon}
          />
        </div>

        {apiError ? (
          <div style={{ marginTop: 8, color: "#B91C1C", fontSize: 11, fontWeight: 800 }}>{apiError}</div>
        ) : null}
        {loadingCatalog ? (
          <div style={{ marginTop: 4, color: "#64748B", fontSize: 10.5, fontWeight: 700 }}>Loading lab catalog...</div>
        ) : null}
        {loadingBookings ? (
          <div style={{ marginTop: 4, color: "#64748B", fontSize: 10.5, fontWeight: 700 }}>Loading previous bookings...</div>
        ) : null}

        <div
          style={{
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <button
            onClick={() => setShowOnlyHomeCollection((v) => !v)}
            style={{
              height: 34,
              borderRadius: 12,
              border: showOnlyHomeCollection ? "none" : "1px solid #D1D5DB",
              background: showOnlyHomeCollection ? BRAND.deep : "#fff",
              color: showOnlyHomeCollection ? "#fff" : "#1F2937",
              padding: "0 12px",
              fontSize: 11,
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Filter style={{ width: 13, height: 13 }} />
            Home Collection
          </button>

          {(selectedPackageIds.length > 0 || selectedTests.length > 0) && (
            <button
              onClick={clearSelection}
              style={{
                height: 34,
                borderRadius: 12,
                border: "1px solid #E2E8F0",
                background: "#fff",
                color: BRAND.sub,
                padding: "0 12px",
                fontSize: 11,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Clear Selection
            </button>
          )}
        </div>

        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 6,
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {CATEGORIES.map((c) => (
            <Pill key={c} active={category === c} onClick={() => setCategory(c)}>
              {c}
            </Pill>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 14px" }}>
        <Glass
          style={{
            padding: 12,
            marginBottom: 12,
            background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(240,253,244,0.92))",
          }}
        >
          <div style={{ display: "flex", alignItems: "start", gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                background: "#ECFDF5",
                border: "1px solid #A7F3D0",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Microscope style={{ width: 18, height: 18, color: BRAND.deep }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 12.6,
                  fontWeight: 900,
                  color: BRAND.ink,
                }}
              >
                Book tests with GoDavaii. Partners stay in the backend.
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 10.8,
                  color: BRAND.sub,
                  fontWeight: 700,
                  lineHeight: 1.45,
                }}
              >
                Customer-facing experience stays GoDavaii-first: booking, support, status,
                report delivery and AI explanation all in one flow.
              </div>
            </div>
          </div>
        </Glass>

        <SectionTitle title="Health Packages" />

        <div
          style={{
            display: "flex",
            gap: 10,
            overflowX: "auto",
            scrollbarWidth: "none",
            paddingBottom: 4,
          }}
        >
          {filteredPackages.map((p) => {
            const active = selectedPackageIds.includes(p.id);
            const packageDetails = buildPackageDetails(p);
            return (
              <motion.button
                key={p.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setDetailItem({ type: "package", data: { ...p, ...packageDetails } })}
                style={{
                  width: 230,
                  flexShrink: 0,
                  textAlign: "left",
                  border: active ? `2px solid ${BRAND.deep}` : "1px solid #E2E8F0",
                  borderRadius: 18,
                  background: "#fff",
                  padding: 12,
                  cursor: "pointer",
                  boxShadow: active ? "0 12px 22px rgba(12,90,62,0.10)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8 }}>
                  <div
                    style={{
                      fontFamily: "'Sora',sans-serif",
                      fontSize: 13,
                      fontWeight: 900,
                      color: BRAND.ink,
                    }}
                  >
                    {p.name}
                  </div>
                  <span
                    style={{
                      padding: "4px 7px",
                      borderRadius: 999,
                      background: "#ECFDF5",
                      border: "1px solid #A7F3D0",
                      color: "#166534",
                      fontSize: 9.5,
                      fontWeight: 900,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.tag}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: 5,
                    fontSize: 10.7,
                    color: BRAND.sub,
                    fontWeight: 700,
                    lineHeight: 1.45,
                  }}
                >
                  {p.desc}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 10.5,
                    color: "#0F766E",
                    fontWeight: 800,
                    lineHeight: 1.35,
                  }}
                >
                  Why best: {packageDetails.whyBest}
                </div>

                <div
                  style={{
                    marginTop: 7,
                    fontSize: 10.2,
                    color: "#475569",
                    fontWeight: 800,
                  }}
                >
                  Includes: {p.tests.join(" + ")}
                </div>

                <div
                  style={{
                    marginTop: 9,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Sora',sans-serif",
                      fontSize: 16,
                      fontWeight: 900,
                      color: BRAND.deep,
                    }}
                  >
                    {formatMoney(p.price)}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#94A3B8",
                      textDecoration: "line-through",
                      fontWeight: 800,
                    }}
                  >
                    {formatMoney(p.oldPrice)}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: 7,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10.3,
                      fontWeight: 900,
                      color: "#0F766E",
                    }}
                  >
                    Report in {p.reportTime}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePackage(p.id);
                    }}
                    style={{
                      minWidth: 88,
                      height: 30,
                      borderRadius: 10,
                      border: active ? "none" : "1px solid #E2E8F0",
                      background: active ? BRAND.deep : "#F8FAFC",
                      color: active ? "#fff" : BRAND.ink,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 10.4,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    {active ? "Added" : "Add"}
                  </button>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailItem({ type: "package", data: { ...p, ...packageDetails } });
                  }}
                  style={{
                    marginTop: 8,
                    width: "100%",
                    height: 30,
                    borderRadius: 9,
                    border: "1px solid #E2E8F0",
                    background: "#F8FAFC",
                    color: "#334155",
                    fontSize: 10.5,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Full Details
                </button>
              </motion.button>
            );
          })}
        </div>

        <div style={{ marginTop: 14 }}>
          <SectionTitle title="Individual Tests" />
          <div style={{ display: "grid", gap: 9 }}>
            {filteredTests.map((t) => {
              const selected = selectedTests.includes(t.id);
              return (
                <Glass key={t.id} style={{ padding: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "start",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div
                      onClick={() => setDetailItem({ type: "test", data: t })}
                      style={{
                        minWidth: 0,
                        flex: 1,
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "start",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            background: "#F0FDF4",
                            border: "1px solid #D1FAE5",
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          <TestTube2 style={{ width: 17, height: 17, color: BRAND.deep }} />
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontFamily: "'Sora',sans-serif",
                              fontSize: 12.8,
                              fontWeight: 900,
                              color: BRAND.ink,
                              lineHeight: 1.35,
                            }}
                          >
                            {t.name}
                          </div>
                          <div
                            style={{
                              marginTop: 3,
                              fontSize: 10.8,
                              color: BRAND.sub,
                              fontWeight: 700,
                            }}
                          >
                            {t.desc}
                          </div>

                          <div
                            style={{
                              marginTop: 7,
                              display: "flex",
                              gap: 7,
                              flexWrap: "wrap",
                            }}
                          >
                            <TinyBadge green>{t.category}</TinyBadge>
                            <TinyBadge>Prep: {t.prep}</TinyBadge>
                            <TinyBadge>Report: {t.reportTime}</TinyBadge>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: 2,
                        }}
                      >
                        <IndianRupee style={{ width: 12, height: 12, color: BRAND.deep }} />
                        <span
                          style={{
                            fontFamily: "'Sora',sans-serif",
                            fontWeight: 900,
                            color: BRAND.deep,
                            fontSize: 14.5,
                          }}
                        >
                          {t.price}
                        </span>
                      </div>

                      {t.oldPrice ? (
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 10.5,
                            color: "#94A3B8",
                            textDecoration: "line-through",
                            fontWeight: 800,
                          }}
                        >
                          {formatMoney(t.oldPrice)}
                        </div>
                      ) : null}

                      <button
                        onClick={() => toggleTest(t.id)}
                        style={{
                          marginTop: 8,
                          height: 31,
                          borderRadius: 10,
                          border: selected ? "none" : "1px solid #D1D5DB",
                          background: selected ? BRAND.deep : "#fff",
                          color: selected ? "#fff" : "#1F2937",
                          fontSize: 11,
                          fontWeight: 900,
                          cursor: "pointer",
                          padding: "0 12px",
                        }}
                      >
                        {selected ? "Added" : "Add"}
                      </button>

                      <button
                        onClick={() => setDetailItem({ type: "test", data: t })}
                        style={{
                          marginTop: 6,
                          width: "100%",
                          height: 28,
                          borderRadius: 9,
                          border: "1px solid #E2E8F0",
                          background: "#F8FAFC",
                          color: "#334155",
                          fontSize: 10.5,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </Glass>
              );
            })}
          </div>
        </div>

        <Glass style={{ marginTop: 12, padding: 12 }}>
          <SectionTitle title="Why users trust this flow" />
          <div style={{ display: "grid", gap: 8 }}>
            {[
              {
                icon: <ShieldCheck style={{ width: 14, height: 14, color: BRAND.deep }} />,
                title: "GoDavaii Verified",
                sub: "Backend fulfilled by verified diagnostic partners, front-end trust stays with GoDavaii.",
              },
              {
                icon: <Clock3 style={{ width: 14, height: 14, color: BRAND.deep }} />,
                title: "Fast collection windows",
                sub: "Selected areas can support quick home collection with clear prep and ETA flow.",
              },
              {
                icon: <Sparkles style={{ width: 14, height: 14, color: BRAND.deep }} />,
                title: "AI-ready reports",
                sub: "Reports can later be pushed to Health Vault and AI explanation without changing the booking UX.",
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  display: "flex",
                  alignItems: "start",
                  gap: 9,
                  padding: "9px 0",
                  borderBottom: "1px solid #EEF2F7",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    background: "#ECFDF5",
                    border: "1px solid #D1FAE5",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: BRAND.ink }}>
                    {item.title}
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 10.7,
                      color: BRAND.sub,
                      fontWeight: 700,
                      lineHeight: 1.45,
                    }}
                  >
                    {item.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Glass>

        <Glass style={{ marginTop: 12, padding: 12, marginBottom: 10 }}>
          <SectionTitle title="Upcoming Lab Bookings" />
          {upcoming.length === 0 ? (
            <div
              style={{
                fontSize: 11.5,
                color: BRAND.sub,
                fontWeight: 700,
              }}
            >
              No upcoming booking yet. Select tests and proceed to home collection.
            </div>
          ) : (
            upcoming.map((booking) => (
              <div
                key={booking.id}
                style={{
                  border: "1px solid #E2E8F0",
                  borderRadius: 14,
                  padding: "9px 10px",
                  marginBottom: 8,
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "start",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 12.2,
                        fontWeight: 900,
                        color: BRAND.ink,
                      }}
                    >
                      {booking.items?.[0]?.name || "Lab Booking"}
                      {booking.items?.length > 1 ? ` +${booking.items.length - 1}` : ""}
                    </div>
                    <div
                      style={{
                        marginTop: 3,
                        fontSize: 10.6,
                        color: BRAND.sub,
                        fontWeight: 700,
                      }}
                    >
                      {booking.dateLabel} · {booking.slot}
                    </div>
                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 10.3,
                        color: "#0F766E",
                        fontWeight: 900,
                      }}
                    >
                      {booking.collectionType} · Report ETA {booking.reportEta}
                    </div>
                  </div>

                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 9.8,
                      fontWeight: 900,
                      color: "#065F46",
                      background: "#ECFDF5",
                      border: "1px solid #A7F3D0",
                      borderRadius: 999,
                      padding: "4px 8px",
                      textTransform: "capitalize",
                    }}
                  >
                      {String(booking.status || "scheduled").replaceAll("_", " ")}
                  </span>
                </div>
                {canCancelBooking(booking.status) ? (
                  <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => cancelBooking(booking.id)}
                      disabled={cancelingBookingId === booking.id}
                      style={{
                        height: 30,
                        borderRadius: 9,
                        border: "1px solid #FECACA",
                        background: cancelingBookingId === booking.id ? "#F8FAFC" : "#FEF2F2",
                        color: "#B91C1C",
                        fontSize: 10.5,
                        fontWeight: 900,
                        cursor: cancelingBookingId === booking.id ? "not-allowed" : "pointer",
                        padding: "0 10px",
                      }}
                    >
                      {cancelingBookingId === booking.id ? "Cancelling..." : "Cancel Booking"}
                    </button>
                  </div>
                ) : null}
                {booking?.reportAvailable ? (
                  <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <button
                      onClick={() => {
                        openReportSecurely(booking);
                      }}
                      style={{
                        height: 30,
                        borderRadius: 9,
                        border: "1px solid #A7F3D0",
                        background: "#ECFDF5",
                        color: "#065F46",
                        fontSize: 10.5,
                        fontWeight: 900,
                        cursor: "pointer",
                        padding: "0 10px",
                      }}
                    >
                      Open Report
                    </button>
                    <button
                      onClick={() => pushReportToVault(booking.id)}
                      disabled={vaultBusyBookingId === booking.id}
                      style={{
                        height: 30,
                        borderRadius: 9,
                        border: "1px solid #BFDBFE",
                        background: "#EFF6FF",
                        color: "#1D4ED8",
                        fontSize: 10.5,
                        fontWeight: 900,
                        cursor: vaultBusyBookingId === booking.id ? "not-allowed" : "pointer",
                        padding: "0 10px",
                      }}
                    >
                      {vaultBusyBookingId === booking.id ? "Saving..." : "Save to Health Vault"}
                    </button>
                    <button
                      onClick={() => navigate(`/ai?autolab=${encodeURIComponent(booking.id)}&source=lab-report&run=${Date.now()}`)}
                      style={{
                        height: 30,
                        borderRadius: 9,
                        border: "1px solid #DDD6FE",
                        background: "#F5F3FF",
                        color: "#5B21B6",
                        fontSize: 10.5,
                        fontWeight: 900,
                        cursor: "pointer",
                        padding: "0 10px",
                      }}
                    >
                      Analyze in AI
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </Glass>

        <div
          style={{
            padding: "2px 2px 10px",
            fontSize: 10.8,
            color: BRAND.sub,
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          <Sparkles style={{ width: 11, height: 11, display: "inline", marginRight: 4 }} />
          Frontend deliberately keeps labs hidden from the surface so brand trust, support and repeat behavior stay with GoDavaii.
        </div>
      </div>

      {!!cartRows.length && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: "calc(74px + env(safe-area-inset-bottom,0px))",
            zIndex: 1200,
            maxWidth: 520,
            margin: "0 auto",
            padding: "0 12px",
          }}
        >
          <motion.button
            whileTap={{ scale: 0.985 }}
            onClick={openCheckout}
            style={{
              width: "100%",
              border: "none",
              borderRadius: 16,
              background: `linear-gradient(135deg, ${BRAND.deep}, ${BRAND.mid})`,
              color: "#fff",
              minHeight: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              boxShadow: "0 14px 30px rgba(12,90,62,0.28)",
              cursor: "pointer",
              gap: 10,
            }}
          >
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 11.2, fontWeight: 900 }}>
                {cartRows.length} item(s) selected
              </div>
              <div style={{ fontSize: 10, opacity: 0.84, fontWeight: 700 }}>
                Discount saved {formatMoney(discount)}
              </div>
            </div>

            <div
              style={{
                fontFamily: "'Sora',sans-serif",
                fontWeight: 900,
                fontSize: 16,
                whiteSpace: "nowrap",
              }}
            >
              {formatMoney(total)}
            </div>

            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                whiteSpace: "nowrap",
              }}
            >
              Book Home Collection
            </div>
          </motion.button>
        </div>
      )}

      <AnimatePresence>
        {detailItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailItem(null)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(2,6,23,0.56)",
                zIndex: 1400,
              }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1401,
                maxWidth: 520,
                margin: "0 auto",
                background: "#fff",
                borderTopLeftRadius: 26,
                borderTopRightRadius: 26,
                padding: "14px 14px calc(14px + env(safe-area-inset-bottom,0px))",
                maxHeight: "88vh",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "start",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontFamily: "'Sora',sans-serif",
                      fontSize: 16,
                      fontWeight: 900,
                      color: BRAND.ink,
                      lineHeight: 1.35,
                    }}
                  >
                    {detailItem.data.name}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: BRAND.sub,
                      fontWeight: 700,
                    }}
                  >
                    {detailItem.data.desc}
                  </div>
                </div>

                <button
                  onClick={() => setDetailItem(null)}
                  style={iconCircleBtn}
                >
                  <X style={{ width: 15, height: 15 }} />
                </button>
              </div>

              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  gap: 7,
                  flexWrap: "wrap",
                }}
              >
                {(detailItem.data.badges || []).map((b) => (
                  <TinyBadge key={b} green>
                    {b}
                  </TinyBadge>
                ))}
              </div>

              <Glass style={{ marginTop: 12, padding: 12 }}>
                <div style={detailGrid}>
                  <MiniInfo icon={<Clock3 style={miniIcon} />} label="Report Time" value={detailItem.data.reportTime} />
                  <MiniInfo
                    icon={<Info style={miniIcon} />}
                    label={detailItem.type === "package" ? "Ideal For" : "Preparation"}
                    value={detailItem.type === "package" ? detailItem.data.idealFor : detailItem.data.prep}
                  />
                  <MiniInfo
                    icon={<TestTube2 style={miniIcon} />}
                    label={detailItem.type === "package" ? "Coverage" : "Sample Type"}
                    value={
                      detailItem.type === "package"
                        ? `${toArray(detailItem.data.tests).length || 1} test markers`
                        : detailItem.data.sampleType
                    }
                  />
                  <MiniInfo icon={<Home style={miniIcon} />} label="Collection" value="Home Sample Available" />
                </div>
              </Glass>

              <Glass style={{ marginTop: 12, padding: 12 }}>
                <div style={detailHeading}>
                  {detailItem.type === "package" ? "Why this package is best" : "Why this test is ordered"}
                </div>
                <div style={detailText}>
                  {detailItem.type === "package"
                    ? detailItem.data.whyBest || detailItem.data.why
                    : detailItem.data.why}
                </div>
              </Glass>

              <Glass style={{ marginTop: 12, padding: 12 }}>
                <div style={detailHeading}>What it includes</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 8 }}>
                  {(detailItem.data.includes || detailItem.data.tests || []).map((item) => (
                    <TinyBadge key={item}>{item}</TinyBadge>
                  ))}
                </div>
              </Glass>

              {detailItem.type === "package" && (
                <Glass style={{ marginTop: 12, padding: 12 }}>
                  <div style={detailHeading}>Value explanation</div>
                  <div style={detailText}>{detailItem.data.valueLine}</div>
                  <div style={{ ...detailText, marginTop: 6 }}>{detailItem.data.reportCommitment}</div>
                </Glass>
              )}

              <Glass style={{ marginTop: 12, padding: 12 }}>
                <div style={detailHeading}>GoDavaii trust layer</div>
                <div style={detailText}>
                  Bookings, support, status tracking, report access and AI-ready explanation stay inside GoDavaii. Processing may be done by a verified diagnostic partner in the backend.
                </div>
              </Glass>

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "'Sora',sans-serif",
                      fontSize: 18,
                      fontWeight: 900,
                      color: BRAND.deep,
                    }}
                  >
                    {formatMoney(detailItem.data.price)}
                  </div>
                  {detailItem.data.oldPrice ? (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#94A3B8",
                        textDecoration: "line-through",
                      }}
                    >
                      {formatMoney(detailItem.data.oldPrice)}
                    </div>
                  ) : null}
                </div>

                <button
                  onClick={() => {
                    if (detailItem.type === "test") {
                      toggleTest(detailItem.data.id);
                    } else {
                      togglePackage(detailItem.data.id);
                    }
                    setDetailItem(null);
                  }}
                  style={{
                    minWidth: 140,
                    height: 42,
                    border: "none",
                    borderRadius: 12,
                    background: BRAND.deep,
                    color: "#fff",
                    fontWeight: 900,
                    fontFamily: "'Sora',sans-serif",
                    cursor: "pointer",
                  }}
                >
                  {detailItem.type === "test"
                    ? selectedTests.includes(detailItem.data.id)
                      ? "Remove Test"
                      : "Add Test"
                    : selectedPackageIds.includes(detailItem.data.id)
                      ? "Remove Package"
                      : "Add Package"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {flowOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeCheckout}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(2,6,23,0.58)",
                zIndex: 1500,
              }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1501,
                maxWidth: 520,
                margin: "0 auto",
                background: "#fff",
                borderTopLeftRadius: 26,
                borderTopRightRadius: 26,
                padding: "14px 14px calc(14px + env(safe-area-inset-bottom,0px))",
                maxHeight: "92vh",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "'Sora',sans-serif",
                      fontSize: 16,
                      fontWeight: 900,
                      color: BRAND.ink,
                    }}
                  >
                    Complete Lab Booking
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 10.8,
                      color: BRAND.sub,
                      fontWeight: 700,
                    }}
                  >
                    GoDavaii booking flow · partner-hidden · trust-first
                  </div>
                </div>

                <button onClick={closeCheckout} style={iconCircleBtn}>
                  <X style={{ width: 15, height: 15 }} />
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                {[
                  { key: 1, label: "Address", icon: <Home style={{ width: 12, height: 12 }} /> },
                  { key: 2, label: "Slot", icon: <CalendarDays style={{ width: 12, height: 12 }} /> },
                  { key: 3, label: "Payment", icon: <Wallet style={{ width: 12, height: 12 }} /> },
                  { key: 4, label: "Confirm", icon: <ShieldCheck style={{ width: 12, height: 12 }} /> },
                ].map((item) => {
                  const active = step >= item.key;
                  return (
                    <div
                      key={item.key}
                      style={{
                        borderRadius: 12,
                        border: active ? "none" : "1px solid #E2E8F0",
                        background: active ? "#DCFCE7" : "#F8FAFC",
                        color: active ? "#166534" : "#475569",
                        padding: "7px 8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        fontSize: 10.2,
                        fontWeight: 900,
                      }}
                    >
                      {item.icon} {item.label}
                    </div>
                  );
                })}
              </div>

              {step === 1 && (
                <>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    {[
                      { key: "self", label: "For Me", icon: <User2 style={{ width: 12, height: 12 }} /> },
                      { key: "family", label: "Family", icon: <Users style={{ width: 12, height: 12 }} /> },
                      { key: "new", label: "New Profile", icon: <HeartPulse style={{ width: 12, height: 12 }} /> },
                    ].map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setWhoFor(p.key)}
                        style={{
                          flex: 1,
                          height: 34,
                          borderRadius: 999,
                          border: whoFor === p.key ? "none" : "1px solid #D1D5DB",
                          background: whoFor === p.key ? BRAND.deep : "#fff",
                          color: whoFor === p.key ? "#fff" : "#1F2937",
                          fontSize: 11,
                          fontWeight: 900,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 5,
                        }}
                      >
                        {p.icon} {p.label}
                      </button>
                    ))}
                  </div>

                  {whoFor !== "self" && (
                    <input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="Patient / profile name"
                      style={inputStyle}
                    />
                  )}

                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Mobile number"
                    style={inputStyle}
                  />

                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Full collection address"
                    style={inputStyle}
                  />

                  <input
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="Landmark (optional)"
                    style={inputStyle}
                  />

                  <input
                    value={cityArea}
                    onChange={(e) => setCityArea(e.target.value)}
                    placeholder="Area / City"
                    style={inputStyle}
                  />

                  <Glass style={{ marginTop: 10, padding: 11 }}>
                    <div style={detailHeading}>Collection trust</div>
                    <div style={detailText}>
                      Home sample collection is scheduled by GoDavaii and may be executed by a trained verified collection executive from a backend diagnostic partner.
                    </div>
                  </Glass>
                </>
              )}

              {step === 2 && (
                <>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      color: BRAND.ink,
                      marginBottom: 6,
                    }}
                  >
                    Choose collection date
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 7,
                      overflowX: "auto",
                      scrollbarWidth: "none",
                    }}
                  >
                    {dateList.map((d) => (
                      <button
                        key={d.iso}
                        onClick={() => setDate(d.iso)}
                        style={{
                          flexShrink: 0,
                          minWidth: 78,
                          borderRadius: 12,
                          border: date === d.iso ? "none" : "1px solid #D1D5DB",
                          background: date === d.iso ? BRAND.deep : "#fff",
                          color: date === d.iso ? "#fff" : "#1F2937",
                          padding: "8px 9px",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontSize: 10.5, fontWeight: 900 }}>{d.day}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.92 }}>{d.date}</div>
                      </button>
                    ))}
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 12,
                      fontWeight: 900,
                      color: BRAND.ink,
                      marginBottom: 6,
                    }}
                  >
                    Choose preferred slot
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 7,
                    }}
                  >
                    {slotWindows.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSlot(s)}
                        style={{
                          height: 36,
                          borderRadius: 10,
                          border: slot === s ? "none" : "1px solid #D1D5DB",
                          background: slot === s ? "#DCFCE7" : "#fff",
                          color: slot === s ? "#166534" : "#1F2937",
                          fontSize: 10.7,
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  <label
                    style={{
                      marginTop: 12,
                      height: 40,
                      borderRadius: 11,
                      border: "1px dashed #94A3B8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontSize: 11,
                      fontWeight: 900,
                      color: "#334155",
                      cursor: "pointer",
                    }}
                  >
                    <FileUp style={{ width: 13, height: 13 }} />
                    Upload prescription / previous report (optional)
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      style={{ display: "none" }}
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </label>

                  {file && (
                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 10.5,
                        color: "#065F46",
                        fontWeight: 800,
                      }}
                    >
                      Attached: {file.name}
                    </div>
                  )}

                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Any note for collection executive (optional)"
                    style={textareaStyle}
                  />
                </>
              )}

              {step === 3 && (
                <>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      color: BRAND.ink,
                      marginBottom: 6,
                    }}
                  >
                    Payment method
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3,1fr)",
                      gap: 7,
                    }}
                  >
                    {[
                      { key: "upi", label: "UPI" },
                      { key: "card", label: "Card" },
                      { key: "netbanking", label: "Netbank" },
                    ].map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setPaymentMethod(p.key)}
                        style={{
                          height: 38,
                          borderRadius: 10,
                          border: paymentMethod === p.key ? "none" : "1px solid #D1D5DB",
                          background: paymentMethod === p.key ? "#DCFCE7" : "#fff",
                          color: paymentMethod === p.key ? "#166534" : "#1F2937",
                          fontSize: 11,
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <Glass style={{ marginTop: 12, padding: 12 }}>
                    <div style={detailHeading}>What customer sees</div>
                    <div style={detailText}>
                      GoDavaii booking confirmation, GoDavaii support, GoDavaii report center.
                    </div>

                    <div style={{ ...detailHeading, marginTop: 10 }}>What partner handles</div>
                    <div style={detailText}>
                      Sample collection, test processing and report generation in the backend.
                    </div>
                  </Glass>
                </>
              )}

              {step === 4 && (
                <>
                  <Glass style={{ padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: BRAND.ink, marginBottom: 6 }}>
                      Booking Summary
                    </div>

                    <div style={{ display: "grid", gap: 4, fontSize: 11, color: "#334155", fontWeight: 700 }}>
                      <span>Items: {cartRows.length}</span>
                      <span>Total: {formatMoney(total)}</span>
                      <span>Discount Saved: {formatMoney(discount)}</span>
                      <span>Date: {dateList.find((d) => d.iso === date)?.full || date}</span>
                      <span>Slot: {slot}</span>
                      <span>Area: {cityArea}</span>
                      <span>Payment: {paymentMethod || "-"}</span>
                      <span>Report ETA: {cartRows.map((r) => r.reportTime).join(", ")}</span>
                    </div>
                  </Glass>

                  <Glass style={{ marginTop: 10, padding: 12 }}>
                    <div style={detailHeading}>Customer-facing messaging</div>
                    <div style={detailText}>
                      “Your GoDavaii sample collection is confirmed.”  
                      “A verified collection executive will arrive in your selected slot.”  
                      “Your report will be available on GoDavaii.”
                    </div>
                  </Glass>
                </>
              )}

              {step === 5 && bookingConfirmed && (
                <>
                  <div
                    style={{
                      padding: 20,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 68,
                        height: 68,
                        borderRadius: "50%",
                        background: "#ECFDF5",
                        border: "1px solid #A7F3D0",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <CheckCircle2 style={{ width: 30, height: 30, color: "#16A34A" }} />
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        fontFamily: "'Sora',sans-serif",
                        fontSize: 18,
                        fontWeight: 900,
                        color: BRAND.ink,
                      }}
                    >
                      Booking Confirmed
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11.3,
                        fontWeight: 700,
                        color: BRAND.sub,
                        lineHeight: 1.55,
                        maxWidth: 330,
                      }}
                    >
                      Your GoDavaii lab booking is confirmed. A verified collection executive will arrive during your selected slot. Reports will be available in GoDavaii after processing.
                    </div>

                    <Glass style={{ width: "100%", marginTop: 14, padding: 12, textAlign: "left" }}>
                      <div style={{ display: "grid", gap: 4, fontSize: 11, color: "#334155", fontWeight: 700 }}>
                        <span>Booking ID: {bookingConfirmed.id}</span>
                        <span>Date: {bookingConfirmed.dateLabel}</span>
                        <span>Slot: {bookingConfirmed.slot}</span>
                        <span>Total Paid: {formatMoney(bookingConfirmed.total)}</span>
                        <span>Status: sample_scheduled</span>
                        <span>Processed by: GoDavaii Verified Diagnostic Partner</span>
                      </div>
                    </Glass>

                    <button
                      onClick={closeCheckout}
                      style={{
                        marginTop: 14,
                        width: "100%",
                        height: 44,
                        border: "none",
                        borderRadius: 12,
                        background: `linear-gradient(135deg, ${BRAND.deep}, ${BRAND.mid})`,
                        color: "#fff",
                        fontWeight: 900,
                        fontFamily: "'Sora',sans-serif",
                        cursor: "pointer",
                      }}
                    >
                      Done
                    </button>
                  </div>
                </>
              )}

              {step < 5 && (
                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    gap: 8,
                  }}
                >
                  {step > 1 ? (
                    <button onClick={goPrevStep} style={secondaryBtnStyle}>
                      Back
                    </button>
                  ) : (
                    <button onClick={closeCheckout} style={secondaryBtnStyle}>
                      Cancel
                    </button>
                  )}

                  {step < 4 ? (
                    <button
                      onClick={goNextStep}
                      style={{
                        ...primaryBtnStyle,
                        background:
                          (step === 1 && (!phone.trim() || !address.trim())) ||
                          (step === 3 && !paymentMethod)
                            ? "#CBD5E1"
                            : `linear-gradient(135deg, ${BRAND.deep}, ${BRAND.mid})`,
                        cursor:
                          (step === 1 && (!phone.trim() || !address.trim())) ||
                          (step === 3 && !paymentMethod)
                            ? "not-allowed"
                            : "pointer",
                      }}
                      disabled={
                        (step === 1 && (!phone.trim() || !address.trim())) ||
                        (step === 3 && !paymentMethod)
                      }
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      onClick={confirmBooking}
                      disabled={!paymentMethod || !address.trim() || !phone.trim()}
                      style={{
                        ...primaryBtnStyle,
                        background:
                          paymentMethod && address.trim() && phone.trim()
                            ? `linear-gradient(135deg, ${BRAND.deep}, ${BRAND.mid})`
                            : "#CBD5E1",
                        cursor:
                          paymentMethod && address.trim() && phone.trim()
                            ? "pointer"
                            : "not-allowed",
                      }}
                    >
                      <CheckCircle2 style={{ width: 15, height: 15 }} />
                      Pay and Confirm
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function MiniInfo({ icon, label, value }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid #E2E8F0",
        background: "#fff",
        padding: 10,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          background: "#ECFDF5",
          border: "1px solid #D1FAE5",
          display: "grid",
          placeItems: "center",
          marginBottom: 8,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 10.2, color: "#64748B", fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 11.2, color: "#0F172A", fontWeight: 900 }}>{value}</div>
    </div>
  );
}

const miniIcon = { width: 13, height: 13, color: "#0C5A3E" };

const inputStyle = {
  marginTop: 8,
  width: "100%",
  height: 38,
  borderRadius: 11,
  border: "1.5px solid #D1D5DB",
  padding: "0 11px",
  fontSize: 12,
  fontWeight: 700,
  outline: "none",
  background: "#fff",
};

const inputStyleWithIcon = {
  width: "100%",
  height: 39,
  borderRadius: 12,
  border: "1.5px solid rgba(12,90,62,0.16)",
  padding: "0 12px 0 32px",
  fontSize: 12.5,
  fontWeight: 700,
  outline: "none",
  background: "#fff",
};

const textareaStyle = {
  marginTop: 12,
  width: "100%",
  borderRadius: 11,
  border: "1.5px solid #D1D5DB",
  padding: 10,
  fontSize: 12,
  fontWeight: 700,
  resize: "none",
  outline: "none",
  background: "#fff",
};

const iconCircleBtn = {
  width: 32,
  height: 32,
  borderRadius: 999,
  border: "1px solid #E2E8F0",
  background: "#fff",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const detailGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 9,
};

const detailHeading = {
  fontSize: 12,
  fontWeight: 900,
  color: "#0F172A",
};

const detailText = {
  marginTop: 4,
  fontSize: 11,
  color: "#64748B",
  fontWeight: 700,
  lineHeight: 1.55,
};

const primaryBtnStyle = {
  flex: 1,
  height: 44,
  border: "none",
  borderRadius: 12,
  color: "#fff",
  fontWeight: 900,
  fontFamily: "'Sora',sans-serif",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
};

const secondaryBtnStyle = {
  width: 110,
  height: 44,
  borderRadius: 12,
  border: "1px solid #D1D5DB",
  background: "#fff",
  color: "#1F2937",
  fontWeight: 900,
  cursor: "pointer",
};














