import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileUp,
  FlaskConical,
  Home,
  IndianRupee,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";

const DEEP = "#0C5A3E";
const MID = "#0E7A4F";
const ACC = "#00D97E";

const BOOKING_KEY = "gd_lab_bookings_v1";

const CATEGORIES = ["All", "Popular", "Diabetes", "Thyroid", "Heart", "Women", "Senior", "Vitamin"];

const TESTS = [
  { id: "t1", name: "Complete Blood Count (CBC)", category: "Popular", reportTime: "12-18 hrs", prep: "No fasting", price: 299, desc: "RBC, WBC, platelets, hemoglobin." },
  { id: "t2", name: "Thyroid Profile (T3, T4, TSH)", category: "Thyroid", reportTime: "24 hrs", prep: "No fasting", price: 399, desc: "Checks thyroid hormone balance." },
  { id: "t3", name: "HbA1c", category: "Diabetes", reportTime: "24 hrs", prep: "No fasting", price: 349, desc: "Average glucose for last 3 months." },
  { id: "t4", name: "Fasting Blood Sugar", category: "Diabetes", reportTime: "8 hrs", prep: "8-10 hr fasting", price: 129, desc: "Single fasting glucose value." },
  { id: "t5", name: "Lipid Profile", category: "Heart", reportTime: "24 hrs", prep: "10-12 hr fasting", price: 449, desc: "Cholesterol and triglycerides." },
  { id: "t6", name: "Liver Function Test (LFT)", category: "Popular", reportTime: "24 hrs", prep: "No fasting", price: 499, desc: "Liver enzyme panel." },
  { id: "t7", name: "Kidney Function Test (KFT)", category: "Popular", reportTime: "24 hrs", prep: "No fasting", price: 449, desc: "Creatinine, urea, uric acid." },
  { id: "t8", name: "Vitamin D (25-OH)", category: "Vitamin", reportTime: "24-36 hrs", prep: "No fasting", price: 799, desc: "Vitamin D deficiency check." },
  { id: "t9", name: "Vitamin B12", category: "Vitamin", reportTime: "24-36 hrs", prep: "No fasting", price: 699, desc: "B12 deficiency evaluation." },
  { id: "t10", name: "Iron Studies", category: "Women", reportTime: "24 hrs", prep: "No fasting", price: 899, desc: "Ferritin + iron profile." },
  { id: "t11", name: "PCOS Basic Panel", category: "Women", reportTime: "24-48 hrs", prep: "As advised", price: 1499, desc: "Hormone markers for PCOS screening." },
  { id: "t12", name: "Senior Wellness Basic", category: "Senior", reportTime: "24-48 hrs", prep: "8 hr fasting", price: 1899, desc: "Comprehensive panel for 55+ age." },
];

const PACKAGES = [
  { id: "p1", name: "Full Body Basic", tests: ["CBC", "LFT", "KFT", "Lipid", "HbA1c"], reportTime: "24 hrs", price: 999, oldPrice: 2199 },
  { id: "p2", name: "Diabetes Care", tests: ["FBS", "PPBS", "HbA1c", "KFT"], reportTime: "24 hrs", price: 799, oldPrice: 1499 },
  { id: "p3", name: "Women Wellness", tests: ["CBC", "Iron", "Thyroid", "Vitamin D", "B12"], reportTime: "24-48 hrs", price: 1399, oldPrice: 2999 },
];

const SLOT_WINDOWS = ["06:30 AM - 08:00 AM", "08:00 AM - 09:30 AM", "09:30 AM - 11:00 AM", "11:00 AM - 12:30 PM", "04:00 PM - 05:30 PM", "05:30 PM - 07:00 PM"];

function safeRead() {
  try {
    const parsed = JSON.parse(localStorage.getItem(BOOKING_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveBookings(rows) {
  localStorage.setItem(BOOKING_KEY, JSON.stringify(rows));
}

function next4Days() {
  const arr = [];
  for (let i = 0; i < 4; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    arr.push({
      iso: d.toISOString().slice(0, 10),
      day: d.toLocaleDateString("en-IN", { weekday: "short" }),
      date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      full: d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }),
    });
  }
  return arr;
}

function Glass({ children, style }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.88)",
        border: "1px solid rgba(12,90,62,0.08)",
        borderRadius: 22,
        boxShadow: "0 8px 26px rgba(0,0,0,0.05)",
        backdropFilter: "blur(12px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function LabTests() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedTests, setSelectedTests] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [bookings, setBookings] = useState(() => safeRead());

  const [flowOpen, setFlowOpen] = useState(false);
  const [whoFor, setWhoFor] = useState("self");
  const [profileName, setProfileName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [date, setDate] = useState(next4Days()[0].iso);
  const [slot, setSlot] = useState(SLOT_WINDOWS[1]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);

  const dateList = useMemo(() => next4Days(), []);

  const filteredTests = useMemo(() => {
    return TESTS.filter((t) => {
      const catOk = category === "All" || t.category === category || (category === "Popular" && ["Popular", "Diabetes", "Thyroid"].includes(t.category));
      const q = query.trim().toLowerCase();
      const qOk = !q || t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [query, category]);

  const cartRows = useMemo(() => {
    if (selectedPackage) {
      return [{
        id: selectedPackage.id,
        type: "package",
        name: selectedPackage.name,
        price: selectedPackage.price,
        reportTime: selectedPackage.reportTime,
      }];
    }
    return selectedTests.map((id) => {
      const t = TESTS.find((x) => x.id === id);
      return { id, type: "test", name: t?.name || id, price: t?.price || 0, reportTime: t?.reportTime || "24 hrs" };
    });
  }, [selectedPackage, selectedTests]);

  const total = useMemo(() => cartRows.reduce((sum, r) => sum + Number(r.price || 0), 0), [cartRows]);

  const upcoming = useMemo(
    () =>
      [...bookings]
        .sort((a, b) => new Date(`${a.date} ${a.slot}`) - new Date(`${b.date} ${b.slot}`))
        .slice(0, 5),
    [bookings]
  );

  function toggleTest(testId) {
    setSelectedPackage(null);
    setSelectedTests((prev) => (prev.includes(testId) ? prev.filter((x) => x !== testId) : [...prev, testId]));
  }

  function selectPackage(pack) {
    setSelectedTests([]);
    setSelectedPackage((prev) => (prev?.id === pack.id ? null : pack));
  }

  function openCheckout() {
    if (!cartRows.length) return;
    setFlowOpen(true);
  }

  function confirmBooking() {
    if (!paymentMethod || !address.trim() || !phone.trim()) return;
    const dObj = dateList.find((d) => d.iso === date);
    const newBooking = {
      id: `lab-${Date.now()}`,
      items: cartRows,
      total,
      whoFor,
      profileName: profileName.trim() || (whoFor === "self" ? "Self" : "Family Member"),
      phone: phone.trim(),
      address: address.trim(),
      landmark: landmark.trim(),
      date,
      dateLabel: dObj?.full || date,
      slot,
      paymentMethod,
      paymentStatus: "paid",
      transactionId: `LABTXN-${Date.now()}`,
      notes: notes.trim(),
      attachedFileName: file?.name || null,
      status: "sample_scheduled",
      reportEta: cartRows.map((r) => r.reportTime).join(", "),
      createdAt: new Date().toISOString(),
    };
    const next = [newBooking, ...bookings];
    setBookings(next);
    saveBookings(next);

    setFlowOpen(false);
    setSelectedPackage(null);
    setSelectedTests([]);
    setPaymentMethod("");
    setNotes("");
    setFile(null);
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100vh", paddingBottom: 120, background: "linear-gradient(180deg,#ECFDF5 0%,#E6F4FF 45%,#F8FAFC 100%)" }}>
      <div style={{ padding: "14px" }}>
        <Glass style={{ padding: 14, background: "linear-gradient(135deg,#0B4D35,#0A623E)", border: "none", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(0,217,126,0.16)", display: "grid", placeItems: "center" }}>
              <FlaskConical style={{ width: 20, height: 20, color: ACC }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 900 }}>Lab Tests</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.74)" }}>Book home sample collection in under 60 seconds.</div>
            </div>
          </div>

          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {[
              { label: "NABL Labs", val: "Verified" },
              { label: "Collection", val: "30-90 min" },
              { label: "Reports", val: "AI-ready" },
            ].map((x) => (
              <div key={x.label} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "8px 9px" }}>
                <div style={{ fontSize: 10, fontWeight: 900 }}>{x.val}</div>
                <div style={{ fontSize: 9.5, opacity: 0.82, fontWeight: 700 }}>{x.label}</div>
              </div>
            ))}
          </div>
        </Glass>

        <div style={{ marginTop: 10, position: "relative" }}>
          <Search style={{ width: 14, height: 14, color: "#94A3B8", position: "absolute", top: 12, left: 10 }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search test, package, condition..." style={inputStyleWithIcon} />
        </div>

        <div style={{ marginTop: 8, display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)} style={{ flexShrink: 0, height: 32, borderRadius: 999, border: category === c ? "none" : "1px solid #D1D5DB", background: category === c ? DEEP : "#fff", color: category === c ? "#fff" : "#1F2937", padding: "0 12px", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 14px" }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 900, color: "#0F172A", marginBottom: 8 }}>Health Packages</div>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
          {PACKAGES.map((p) => {
            const active = selectedPackage?.id === p.id;
            return (
              <motion.button key={p.id} whileTap={{ scale: 0.98 }} onClick={() => selectPackage(p)} style={{ width: 220, flexShrink: 0, textAlign: "left", border: active ? `2px solid ${DEEP}` : "1px solid #E2E8F0", borderRadius: 16, background: "#fff", padding: 12, cursor: "pointer" }}>
                <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 900, color: "#0F172A" }}>{p.name}</div>
                <div style={{ marginTop: 4, fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>{p.tests.join(" + ")}</div>
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, color: DEEP }}>Rs {p.price}</span>
                  <span style={{ fontSize: 11, color: "#94A3B8", textDecoration: "line-through", fontWeight: 700 }}>Rs {p.oldPrice}</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 10.5, color: "#0F766E", fontWeight: 800 }}>Report in {p.reportTime}</div>
              </motion.button>
            );
          })}
        </div>

        <div style={{ marginTop: 12, fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 900, color: "#0F172A", marginBottom: 8 }}>Individual Tests</div>
        <div style={{ display: "grid", gap: 8 }}>
          {filteredTests.map((t) => {
            const selected = selectedTests.includes(t.id);
            return (
              <Glass key={t.id} style={{ padding: 12 }}>
                <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 12.8, fontWeight: 900, color: "#0F172A" }}>{t.name}</div>
                    <div style={{ fontSize: 10.8, color: "#64748B", fontWeight: 700, marginTop: 2 }}>{t.desc}</div>
                    <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#0F766E", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "3px 7px", borderRadius: 999 }}>{t.category}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#475569" }}>Prep: {t.prep}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#475569" }}>Report: {t.reportTime}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                      <IndianRupee style={{ width: 12, height: 12, color: DEEP }} />
                      <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, color: DEEP, fontSize: 14.5 }}>{t.price}</span>
                    </div>
                    <button onClick={() => toggleTest(t.id)} style={{ marginTop: 8, height: 30, borderRadius: 9, border: selected ? "none" : "1px solid #D1D5DB", background: selected ? DEEP : "#fff", color: selected ? "#fff" : "#1F2937", fontSize: 11, fontWeight: 800, cursor: "pointer", padding: "0 12px" }}>
                      {selected ? "Added" : "Add"}
                    </button>
                  </div>
                </div>
              </Glass>
            );
          })}
        </div>

        <Glass style={{ marginTop: 12, padding: 12 }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 900, color: "#0F172A", marginBottom: 6 }}>Upcoming Lab Bookings</div>
          {upcoming.length === 0 ? (
            <div style={{ fontSize: 11.5, color: "#64748B", fontWeight: 700 }}>No upcoming booking. Select tests and proceed.</div>
          ) : (
            upcoming.map((b) => (
              <div key={b.id} style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: "8px 9px", marginBottom: 7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#0F172A" }}>{b.items[0]?.name}{b.items.length > 1 ? ` +${b.items.length - 1}` : ""}</div>
                    <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>{b.dateLabel} | {b.slot}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 900, color: "#065F46", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 999, padding: "4px 8px" }}>{b.status}</span>
                </div>
              </div>
            ))
          )}
        </Glass>
      </div>

      {!!cartRows.length && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(74px + env(safe-area-inset-bottom,0px))", zIndex: 1200, maxWidth: 520, margin: "0 auto", padding: "0 12px" }}>
          <motion.button whileTap={{ scale: 0.98 }} onClick={openCheckout} style={{ width: "100%", border: "none", borderRadius: 14, background: `linear-gradient(135deg,${DEEP},${MID})`, color: "#fff", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", boxShadow: "0 12px 28px rgba(12,90,62,0.28)", cursor: "pointer" }}>
            <span style={{ fontSize: 12, fontWeight: 900 }}>{cartRows.length} item(s)</span>
            <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: 16 }}>Rs {total}</span>
            <span style={{ fontSize: 12, fontWeight: 900 }}>Book Home Collection</span>
          </motion.button>
        </div>
      )}

      <AnimatePresence>
        {flowOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFlowOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.55)", zIndex: 1300 }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 260 }} style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1301, maxWidth: 520, margin: "0 auto", background: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: "14px 14px calc(14px + env(safe-area-inset-bottom,0px))", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 900, color: "#0F172A" }}>Complete Lab Booking</div>
                <button onClick={() => setFlowOpen(false)} style={{ width: 30, height: 30, borderRadius: 999, border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}>
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {[
                  { icon: <Home style={{ width: 12, height: 12 }} />, text: "Address" },
                  { icon: <CalendarDays style={{ width: 12, height: 12 }} />, text: "Slot" },
                  { icon: <Wallet style={{ width: 12, height: 12 }} />, text: "Payment" },
                  { icon: <ShieldCheck style={{ width: 12, height: 12 }} />, text: "Confirm" },
                ].map((s, idx) => (
                  <div key={idx} style={{ flex: 1, borderRadius: 10, background: "#F8FAFC", border: "1px solid #E2E8F0", padding: "6px 8px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 10.2, fontWeight: 800, color: "#334155" }}>
                    {s.icon} {s.text}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {[
                  { key: "self", label: "For Me" },
                  { key: "family", label: "Family" },
                  { key: "new", label: "New Profile" },
                ].map((p) => (
                  <button key={p.key} onClick={() => setWhoFor(p.key)} style={{ flex: 1, height: 32, borderRadius: 999, border: whoFor === p.key ? "none" : "1px solid #D1D5DB", background: whoFor === p.key ? DEEP : "#fff", color: whoFor === p.key ? "#fff" : "#1F2937", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                    {p.label}
                  </button>
                ))}
              </div>

              {whoFor !== "self" && <input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Profile name" style={inputStyle} />}
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" style={inputStyle} />
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full collection address" style={inputStyle} />
              <input value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Landmark (optional)" style={inputStyle} />

              <div style={{ marginTop: 8, display: "flex", gap: 7, overflowX: "auto", scrollbarWidth: "none" }}>
                {dateList.map((d) => (
                  <button key={d.iso} onClick={() => setDate(d.iso)} style={{ flexShrink: 0, minWidth: 72, borderRadius: 10, border: date === d.iso ? "none" : "1px solid #D1D5DB", background: date === d.iso ? DEEP : "#fff", color: date === d.iso ? "#fff" : "#1F2937", padding: "6px 7px", cursor: "pointer" }}>
                    <div style={{ fontSize: 10.5, fontWeight: 900 }}>{d.day}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.9 }}>{d.date}</div>
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {SLOT_WINDOWS.map((s) => (
                  <button key={s} onClick={() => setSlot(s)} style={{ height: 32, borderRadius: 9, border: slot === s ? "none" : "1px solid #D1D5DB", background: slot === s ? "#DCFCE7" : "#fff", color: slot === s ? "#166534" : "#1F2937", fontSize: 10.5, fontWeight: 800, cursor: "pointer" }}>{s}</button>
                ))}
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11.5, fontWeight: 900, color: "#0F172A", marginBottom: 5 }}>Payment Method</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                  {[
                    { key: "upi", label: "UPI" },
                    { key: "card", label: "Card" },
                    { key: "netbanking", label: "Netbank" },
                  ].map((p) => (
                    <button key={p.key} onClick={() => setPaymentMethod(p.key)} style={{ height: 34, borderRadius: 9, border: paymentMethod === p.key ? "none" : "1px solid #D1D5DB", background: paymentMethod === p.key ? "#DCFCE7" : "#fff", color: paymentMethod === p.key ? "#166534" : "#1F2937", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{p.label}</button>
                  ))}
                </div>
              </div>

              <label style={{ marginTop: 8, height: 34, borderRadius: 9, border: "1px dashed #94A3B8", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 11, fontWeight: 800, color: "#334155", cursor: "pointer" }}>
                <FileUp style={{ width: 12, height: 12 }} /> Upload prescription/report (optional)
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              {file && <div style={{ marginTop: 4, fontSize: 10.5, color: "#065F46", fontWeight: 800 }}>Attached: {file.name}</div>}

              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any notes for phlebotomist (optional)" style={{ marginTop: 8, width: "100%", borderRadius: 10, border: "1.5px solid #D1D5DB", padding: 10, fontSize: 12, fontWeight: 700, resize: "none", outline: "none" }} />

              <div style={{ marginTop: 8, borderRadius: 12, border: "1px solid #D1D5DB", padding: "8px 10px", background: "#F8FAFC" }}>
                <div style={{ fontSize: 11.5, fontWeight: 900, color: "#0F172A", marginBottom: 4 }}>Booking Summary</div>
                <div style={{ fontSize: 10.8, color: "#334155", fontWeight: 700, display: "grid", gap: 3 }}>
                  <span>{cartRows.length} item(s) | Total Rs {total}</span>
                  <span>Date: {dateList.find((d) => d.iso === date)?.full || date}</span>
                  <span>Slot: {slot}</span>
                  <span>Report ETA: {cartRows.map((r) => r.reportTime).join(", ")}</span>
                </div>
              </div>

              <button onClick={confirmBooking} disabled={!paymentMethod || !address.trim() || !phone.trim()} style={{ marginTop: 10, width: "100%", height: 42, border: "none", borderRadius: 12, background: paymentMethod && address.trim() && phone.trim() ? `linear-gradient(135deg,${DEEP},${MID})` : "#CBD5E1", color: "#fff", fontWeight: 900, fontFamily: "'Sora',sans-serif", cursor: paymentMethod && address.trim() && phone.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <CheckCircle2 style={{ width: 15, height: 15 }} /> Pay and Confirm Lab Booking
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div style={{ padding: "0 14px 14px", fontSize: 11, color: "#64748B", fontWeight: 700 }}>
        <Sparkles style={{ width: 11, height: 11, display: "inline", marginRight: 4 }} />
        Reports from this flow can be pushed to Health Vault and AI analysis in backend phase.
      </div>
    </div>
  );
}

const inputStyle = {
  marginTop: 8,
  width: "100%",
  height: 36,
  borderRadius: 10,
  border: "1.5px solid #D1D5DB",
  padding: "0 10px",
  fontSize: 12,
  fontWeight: 700,
  outline: "none",
  background: "#fff",
};

const inputStyleWithIcon = {
  width: "100%",
  height: 38,
  borderRadius: 12,
  border: "1.5px solid rgba(12,90,62,0.16)",
  padding: "0 10px 0 32px",
  fontSize: 12.5,
  fontWeight: 700,
  outline: "none",
  background: "#fff",
};
