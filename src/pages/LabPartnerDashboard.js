import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  FlaskConical,
  HandCoins,
  Loader2,
  LogOut,
  MapPin,
  Phone,
  RefreshCcw,
  Search,
  ShieldCheck,
  Upload,
  User,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const TABS = ["new", "collections", "processing", "reports", "catalog", "profile"];

const TAB_LABELS = {
  new: "New Requests",
  collections: "Collections",
  processing: "Processing",
  reports: "Reports",
  catalog: "Catalog",
  profile: "Profile",
};

const STATUS_TEXT = {
  new_request: "New Request",
  accepted: "Accepted",
  sample_scheduled: "Sample Scheduled",
  collector_assigned: "Collector Assigned",
  sample_collected: "Sample Collected",
  processing: "Processing",
  report_ready: "Report Ready",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
  unable_to_collect: "Unable To Collect",
  delayed: "Delayed",
};

const PARTNER_STATUS = {
  applied: ["#FFF7ED", "#9A3412", "#FDBA74", "Applied"],
  under_review: ["#FFFBEB", "#854D0E", "#FDE68A", "Under Review"],
  docs_pending: ["#FFF7ED", "#9A3412", "#FDBA74", "Docs Pending"],
  verification_in_review: ["#ECFEFF", "#155E75", "#67E8F9", "Verification In Review"],
  approved: ["#ECFDF5", "#065F46", "#86EFAC", "Approved"],
  live: ["#ECFDF5", "#065F46", "#86EFAC", "Live"],
  suspended: ["#FEF2F2", "#991B1B", "#FCA5A5", "Suspended"],
  rejected: ["#FEF2F2", "#991B1B", "#FCA5A5", "Rejected"],
};

const toArr = (v) => (Array.isArray(v) ? v : []);
const s = (v) => String(v || "").trim().toLowerCase();

function authConfig() {
  return { headers: { Authorization: `Bearer ${localStorage.getItem("labPartnerToken") || ""}` } };
}

function money(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? `Rs ${n.toLocaleString("en-IN")}` : "-";
}

function maskPhone(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length < 10) return phone || "-";
  return `${d.slice(0, 2)}XXXXXX${d.slice(-2)}`;
}

function statusLabel(status) {
  return STATUS_TEXT[s(status)] || String(status || "-").replace(/_/g, " ");
}

function chipTone(key) {
  if (key === "red") return { bg: "#FEF2F2", fg: "#991B1B", border: "#FCA5A5" };
  if (key === "yellow") return { bg: "#FFFBEB", fg: "#92400E", border: "#FCD34D" };
  return { bg: "#ECFDF5", fg: "#065F46", border: "#86EFAC" };
}

function getTat(booking) {
  const eta = String(booking?.reportEta || "24");
  const nums = eta.match(/\d+/g);
  const hrs = nums?.length ? Math.max(...nums.map(Number)) : 24;
  const base = new Date(booking?.sampleCollectedAt || booking?.processingStartedAt || booking?.createdAt || Date.now()).getTime();
  const due = base + hrs * 60 * 60 * 1000;
  const diff = due - Date.now();
  if (diff <= 0) {
    const mins = Math.round(Math.abs(diff) / 60000);
    return { tone: "red", text: mins < 60 ? `Overdue by ${mins} min` : `Overdue by ${Math.round(mins / 60)} hr` };
  }
  const mins = Math.round(diff / 60000);
  if (mins <= 180) return { tone: "yellow", text: `Due in ${mins} min` };
  return { tone: "green", text: `Due in ${Math.round(mins / 60)} hr` };
}

function normalizeBooking(raw, me) {
  const assignedToMe = String(raw?.assignedPartnerId || "") === String(me?.id || "");
  let st = s(raw?.status) || "sample_scheduled";
  if (st === "sample_scheduled" && !assignedToMe) st = "new_request";
  if (st === "sample_scheduled" && assignedToMe) st = "accepted";
  const items = toArr(raw?.items).map((i) => i?.name).filter(Boolean);
  return {
    ...raw,
    status: st,
    assignedToMe,
    bookingId: raw?.bookingId || raw?.id || raw?._id,
    patientName: raw?.profileName || "Customer",
    testsText: items.join(", ") || "Tests not listed",
    cityArea: raw?.cityArea || "",
    phone: raw?.phone || "",
    fasting: raw?.fasting || raw?.fastingRequired || "As advised",
  };
}

function dedupe(rows) {
  const map = new Map();
  rows.forEach((r) => map.set(String(r.bookingId || r.id || r._id || ""), r));
  return Array.from(map.values()).filter((x) => !!x.bookingId || !!x.id || !!x._id);
}

function canRevealPhone(b) {
  return b.assignedToMe || ["accepted", "collector_assigned", "sample_collected", "processing", "report_ready", "completed"].includes(s(b.status));
}

export default function LabPartnerDashboard() {
  const [profile, setProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("labPartnerProfile") || "null");
    } catch (_) {
      return null;
    }
  });
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState("new");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState("");
  const [selected, setSelected] = useState(null);
  const [reportFiles, setReportFiles] = useState({});
  const [online, setOnline] = useState(true);
  const [proposals, setProposals] = useState([]);

  const [testForm, setTestForm] = useState({ testName: "", category: "", price: "", oldPrice: "", reportTime: "24 hrs", fastingRequired: "no", sampleType: "", description: "", includedParameters: "", homeCollection: "yes", sourcing: "in_house", available: "yes", serviceAreas: "", notesForAdmin: "" });
  const [packageForm, setPackageForm] = useState({ packageName: "", category: "", includedTests: "", customIncludesText: "", price: "", oldPrice: "", reportTime: "24-48 hrs", fastingRequired: "no", description: "", homeCollection: "yes", available: "yes", serviceAreas: "", notesForAdmin: "" });

  const partnerLive = s(profile?.partnerStatus) === "live" && !!profile?.active;

  const compliance = useMemo(() => {
    const v = profile?.verification || {};
    const docs = v?.complianceDocuments || {};
    const legal = v?.legalAgreement || {};
    const tech = v?.techReportFlow || {};
    const checklist = v?.checklist || {};
    const missing = [
      !docs.stateLocalRegistrationCertificate && "Registration certificate missing",
      !docs.panCardCopy && "PAN pending",
      !v?.banking?.bankProofCancelledCheque && "Bank proof pending",
      !legal.signedPartnerAgreementDeclaration && "Agreement not signed",
      !tech.reportUploadTestPassed && "Signed report upload test pending",
    ].filter(Boolean);
    return {
      missing,
      bankVerified: !!checklist.bankVerified,
      agreementSigned: !!legal.signedPartnerAgreementDeclaration,
      reportUploadTested: !!tech.reportUploadTestPassed,
    };
  }, [profile]);

  const catalogActive = useMemo(() => {
    const fromApi = toArr(profile?.capabilities);
    if (fromApi.length) return fromApi;
    return [
      { id: "c1", name: "CBC", category: "Hematology", partnerPrice: 210, reportTAT: "24 hrs", homeCollection: true, status: "active" },
      { id: "c2", name: "Full Body Basic", category: "Preventive", partnerPrice: 760, reportTAT: "24-48 hrs", homeCollection: true, status: "active" },
    ];
  }, [profile]);

  const bookingData = useMemo(() => bookings.map((b) => normalizeBooking(b, profile)), [bookings, profile]);

  const filtered = useMemo(() => {
    const q = s(search);
    return bookingData.filter((b) => {
      const hit = !q || s(b.patientName).includes(q) || s(String(b.bookingId)).includes(q) || s(b.phone).includes(q) || s(b.cityArea).includes(q) || s(maskPhone(b.phone)).includes(q);
      if (!hit) return false;
      if (filter === "today") return String(b.date || "").slice(0, 10) === new Date().toISOString().slice(0, 10);
      if (filter !== "all") return s(b.status) === filter;
      return true;
    });
  }, [bookingData, search, filter]);

  const tabRows = useMemo(() => ({
    new: filtered.filter((b) => s(b.status) === "new_request"),
    collections: filtered.filter((b) => ["accepted", "sample_scheduled", "collector_assigned"].includes(s(b.status))),
    processing: filtered.filter((b) => ["sample_collected", "processing", "delayed"].includes(s(b.status))),
    reports: filtered.filter((b) => ["sample_collected", "processing", "report_ready"].includes(s(b.status))),
  }), [filtered]);

  const stats = useMemo(() => {
    const c = (arr, st) => arr.filter((b) => st.includes(s(b.status))).length;
    return [
      { k: "new", t: "New Bookings", v: c(bookingData, ["new_request"]) },
      { k: "sch", t: "Scheduled", v: c(bookingData, ["accepted", "sample_scheduled", "collector_assigned"]) },
      { k: "col", t: "Collected", v: c(bookingData, ["sample_collected"]) },
      { k: "pro", t: "Processing", v: c(bookingData, ["processing", "delayed"]) },
      { k: "ready", t: "Report Ready", v: c(bookingData, ["report_ready"]) },
      { k: "done", t: "Completed", v: c(bookingData, ["completed"]) },
    ];
  }, [bookingData]);

  const payout = useMemo(() => {
    const done = bookingData.filter((b) => s(b.status) === "completed");
    const pending = bookingData.filter((b) => ["sample_collected", "processing", "report_ready"].includes(s(b.status)));
    return {
      estimated: done.reduce((n, b) => n + Number(b.total || 0), 0),
      pending: pending.reduce((n, b) => n + Number(b.total || 0), 0),
      lastSettlementDate: profile?.verification?.banking?.lastSettlementDate || "-",
      settlementStatus: profile?.verification?.banking?.settlementStatus || "Pending",
    };
  }, [bookingData, profile]);

  async function loadProfile() {
    const { data } = await axios.get(`${API_BASE_URL}/api/lab-partners/me`, authConfig());
    const p = data?.partner || null;
    setProfile(p);
    if (Array.isArray(p?.catalogProposals)) {
      setProposals(p.catalogProposals);
      localStorage.setItem("labPartnerCatalogProposals", JSON.stringify(p.catalogProposals));
    }
    localStorage.setItem("labPartnerProfile", JSON.stringify(p || {}));
  }

  async function loadBookings() {
    const calls = [
      axios.get(`${API_BASE_URL}/api/lab-partners/bookings?status=all&unassigned=1`, authConfig()),
      axios.get(`${API_BASE_URL}/api/lab-partners/bookings?status=completed&unassigned=0`, authConfig()),
      axios.get(`${API_BASE_URL}/api/lab-partners/bookings?status=cancelled&unassigned=0`, authConfig()),
    ];
    const settled = await Promise.allSettled(calls);
    const rows = settled.filter((x) => x.status === "fulfilled").flatMap((x) => x.value?.data?.bookings || []);
    setBookings(dedupe(rows));
  }

  async function refresh() {
    setRefreshing(true);
    setError("");
    setSuccess("");
    try {
      await loadProfile();
      await loadBookings();
      setSuccess("Dashboard refreshed.");
    } catch (e) {
      setError(e?.response?.data?.error || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        await loadProfile();
        await loadBookings();
      } catch (e) {
        setError(e?.response?.data?.error || "Unable to load dashboard");
      } finally {
        setLoading(false);
      }
    })();

    try {
      const p = JSON.parse(localStorage.getItem("labPartnerCatalogProposals") || "[]");
      setProposals(Array.isArray(p) ? p : []);
    } catch (_) {
      setProposals([]);
    }
  }, []);

  function saveProposals(next) {
    setProposals(next);
    localStorage.setItem("labPartnerCatalogProposals", JSON.stringify(next));
  }

  function patchBooking(nextBooking) {
    setBookings((prev) => {
      const k = String(nextBooking?.bookingId || nextBooking?.id || nextBooking?._id || "");
      const i = prev.findIndex((x) => String(x?.bookingId || x?.id || x?._id || "") === k);
      if (i === -1) return [nextBooking, ...prev];
      const n = [...prev];
      n[i] = { ...n[i], ...nextBooking };
      return n;
    });
  }

  async function runAction(booking, action, extra = {}) {
    const id = String(booking?.bookingId || booking?.id || booking?._id || "");
    if (!id) return;
    setBusy(`${id}-${action}`);
    setError("");
    setSuccess("");
    try {
      let res;
      if (extra.reportFile) {
        const fd = new FormData();
        fd.append("action", action);
        fd.append("reportFile", extra.reportFile);
        if (extra.reason) fd.append("reason", extra.reason);
        if (extra.notes) fd.append("notes", extra.notes);
        res = await axios.patch(`${API_BASE_URL}/api/lab-partners/bookings/${id}/status`, fd, {
          ...authConfig(),
          headers: { ...authConfig().headers, "Content-Type": "multipart/form-data" },
        });
      } else {
        res = await axios.patch(`${API_BASE_URL}/api/lab-partners/bookings/${id}/status`, {
          action,
          reason: extra.reason || "",
          notes: extra.notes || "",
          collectorName: extra.collectorName || "",
        }, authConfig());
      }
      if (res?.data?.booking) patchBooking(res.data.booking);
      setSuccess(`Action done: ${action.replace(/_/g, " ")}`);
    } catch (e) {
      setError(e?.response?.data?.error || "Action failed");
    } finally {
      setBusy("");
    }
  }

  async function submitProposal(type) {
    if (type === "test") {
      if (!testForm.testName || !testForm.category || !testForm.price) {
        setError("Please fill required test proposal fields.");
        return;
      }
      const payload = {
        type: "Test",
        name: testForm.testName,
        category: testForm.category,
        price: Number(testForm.price),
        oldPrice: Number(testForm.oldPrice || 0),
        reportTime: testForm.reportTime,
        fastingRequired: testForm.fastingRequired,
        sampleType: testForm.sampleType,
        description: testForm.description,
        includedParameters: testForm.includedParameters,
        homeCollection: testForm.homeCollection,
        sourcing: testForm.sourcing,
        available: testForm.available,
        serviceAreas: testForm.serviceAreas,
        notesForAdmin: testForm.notesForAdmin,
      };
      try {
        const { data } = await axios.post(`${API_BASE_URL}/api/lab-partners/catalog/proposals`, payload, authConfig());
        if (Array.isArray(data?.proposals)) saveProposals(data.proposals);
      } catch (_) {
        const next = [{ id: `prop-${Date.now()}`, type: "Test", name: testForm.testName, category: testForm.category, price: Number(testForm.price), status: "submitted_for_review", adminComment: "Pending admin review", createdAt: new Date().toISOString(), payload: testForm }, ...proposals];
        saveProposals(next);
      }
      setSuccess("Test proposal submitted for review. It will not go live automatically.");
      setTestForm({ testName: "", category: "", price: "", oldPrice: "", reportTime: "24 hrs", fastingRequired: "no", sampleType: "", description: "", includedParameters: "", homeCollection: "yes", sourcing: "in_house", available: "yes", serviceAreas: "", notesForAdmin: "" });
      return;
    }
    if (!packageForm.packageName || !packageForm.category || !packageForm.price) {
      setError("Please fill required package proposal fields.");
      return;
    }
    const payload = {
      type: "Package",
      name: packageForm.packageName,
      category: packageForm.category,
      price: Number(packageForm.price),
      oldPrice: Number(packageForm.oldPrice || 0),
      reportTime: packageForm.reportTime,
      fastingRequired: packageForm.fastingRequired,
      description: packageForm.description,
      includedTests: packageForm.includedTests,
      customIncludesText: packageForm.customIncludesText,
      homeCollection: packageForm.homeCollection,
      available: packageForm.available,
      serviceAreas: packageForm.serviceAreas,
      notesForAdmin: packageForm.notesForAdmin,
    };
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/lab-partners/catalog/proposals`, payload, authConfig());
      if (Array.isArray(data?.proposals)) saveProposals(data.proposals);
    } catch (_) {
      const next = [{ id: `prop-${Date.now()}`, type: "Package", name: packageForm.packageName, category: packageForm.category, price: Number(packageForm.price), status: "submitted_for_review", adminComment: "Pending admin review", createdAt: new Date().toISOString(), payload: packageForm }, ...proposals];
      saveProposals(next);
    }
    setSuccess("Package proposal submitted for review. It will not go live automatically.");
    setPackageForm({ packageName: "", category: "", includedTests: "", customIncludesText: "", price: "", oldPrice: "", reportTime: "24-48 hrs", fastingRequired: "no", description: "", homeCollection: "yes", available: "yes", serviceAreas: "", notesForAdmin: "" });
  }

  function logout() {
    localStorage.removeItem("labPartnerToken");
    localStorage.removeItem("labPartnerProfile");
    window.location.href = "/lab-partner/login";
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loaderWrap}>
          <Loader2 style={{ width: 20, height: 20, color: "#0B5D3B" }} />
          <div style={{ fontWeight: 800, color: "#14532D" }}>Loading Lab Partner Dashboard...</div>
        </div>
      </div>
    );
  }

  const pStyle = PARTNER_STATUS[s(profile?.partnerStatus)] || PARTNER_STATUS.under_review;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} style={styles.hero}>
          <div style={styles.heroTop}>
            <div>
              <div style={styles.heroIdentity}>
                <div style={styles.iconBox}><FlaskConical style={{ width: 18, height: 18 }} /></div>
                <div>
                  <h1 style={styles.heroTitle}>{profile?.name || "Lab Partner"}</h1>
                  <p style={styles.heroSub}>{profile?.organization || "GoDavaii Diagnostic Partner"}</p>
                </div>
              </div>
              <div style={styles.heroMeta}>
                <Chip icon={MapPin} text={profile?.city || "City not set"} />
                <StatusChip text={profile?.partnerStatusLabel || pStyle[3]} bg={pStyle[0]} fg={pStyle[1]} border={pStyle[2]} />
                <StatusChip text={online ? "Online" : "Offline"} icon={online ? Wifi : WifiOff} bg={online ? "#ECFDF5" : "#F3F4F6"} fg={online ? "#065F46" : "#374151"} border={online ? "#86EFAC" : "#D1D5DB"} />
              </div>
            </div>
            <div style={styles.heroActions}>
              <button style={styles.heroBtn} onClick={() => setOnline((v) => !v)}>{online ? <Wifi style={styles.i} /> : <WifiOff style={styles.i} />}{online ? "Go Offline" : "Go Online"}</button>
              <button style={styles.heroBtn} onClick={refresh} disabled={refreshing}><RefreshCcw style={styles.i} />{refreshing ? "Refreshing" : "Refresh"}</button>
              <button style={styles.logoutBtn} onClick={logout}><LogOut style={styles.i} />Logout</button>
            </div>
          </div>

          {!partnerLive ? (
            <div style={styles.bannerDanger}><AlertTriangle style={{ width: 15, height: 15 }} /> Bookings are disabled until verification is completed and status is Live.</div>
          ) : null}
        </motion.section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}><ShieldCheck style={styles.sectionIcon} />Verification / Compliance</div>
          <div style={styles.grid5}>
            <MiniStat title="Verification" value={profile?.partnerStatusLabel || "Under Review"} />
            <MiniStat title="Missing Docs" value={String(compliance.missing.length)} tone={compliance.missing.length ? "warn" : "ok"} />
            <MiniStat title="Bank Verified" value={compliance.bankVerified ? "Yes" : "No"} tone={compliance.bankVerified ? "ok" : "warn"} />
            <MiniStat title="Agreement" value={compliance.agreementSigned ? "Signed" : "Pending"} tone={compliance.agreementSigned ? "ok" : "warn"} />
            <MiniStat title="Report Upload Test" value={compliance.reportUploadTested ? "Passed" : "Pending"} tone={compliance.reportUploadTested ? "ok" : "warn"} />
          </div>
          {compliance.missing.length ? (
            <div style={{ display: "grid", gap: 6 }}>
              {compliance.missing.map((m) => (<div key={m} style={styles.warnLine}><AlertTriangle style={{ width: 13, height: 13 }} /> {m}</div>))}
              <div style={styles.warnLine}><AlertTriangle style={{ width: 13, height: 13 }} /> Bookings disabled until compliance is complete.</div>
            </div>
          ) : (
            <div style={styles.okLine}><CheckCircle2 style={{ width: 13, height: 13 }} /> Compliance checks are on track.</div>
          )}
        </section>

        <section style={styles.statsGrid}>{stats.map((x) => <StatCard key={x.k} title={x.t} value={x.v} />)}</section>

        <section style={styles.card}>
          <div style={styles.searchRow}>
            <div style={styles.searchBox}><Search style={{ width: 15, height: 15, color: "#64748B" }} /><input style={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by patient, booking id, phone, area" /></div>
            <select style={styles.select} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All</option><option value="today">Today</option><option value="new_request">New</option><option value="accepted">Scheduled</option><option value="sample_collected">Collected</option><option value="processing">Processing</option><option value="report_ready">Ready</option><option value="completed">Completed</option>
            </select>
          </div>

          <div style={styles.tabs}>{TABS.map((k) => <button key={k} style={{ ...styles.tab, ...(tab === k ? styles.tabActive : null) }} onClick={() => setTab(k)}>{TAB_LABELS[k]}</button>)}</div>

          {["new", "collections", "processing", "reports"].includes(tab) ? (
            <div style={{ display: "grid", gap: 10 }}>
              {!tabRows[tab]?.length ? <Empty text="No bookings in this section right now." /> : null}
              {(tabRows[tab] || []).map((b) => {
                const k = String(b.bookingId || b.id || b._id);
                const tat = getTat(b);
                const tone = chipTone(tat.tone);
                const st = s(b.status);
                const stTone = st === "completed" || st === "report_ready" ? chipTone("green") : ["cancelled", "rejected", "unable_to_collect"].includes(st) ? chipTone("red") : chipTone("yellow");
                const phoneText = canRevealPhone(b) ? (b.phone || "-") : maskPhone(b.phone);
                return (
                  <div key={k} style={styles.queueCard}>
                    <div style={styles.rowBetween}>
                      <div>
                        <div style={styles.title}>{b.testsText}</div>
                        <div style={styles.sub}>Booking ID: {b.bookingId}</div>
                      </div>
                      <StatusChip text={statusLabel(b.status)} bg={stTone.bg} fg={stTone.fg} border={stTone.border} />
                    </div>
                    <div style={styles.infoGrid}>
                      <Info k="Patient" v={b.patientName} icon={User} />
                      <Info k="Phone" v={phoneText} icon={Phone} />
                      <Info k="Area" v={b.cityArea || "-"} icon={MapPin} />
                      <Info k="Date / Slot" v={`${b.dateLabel || b.date || "-"} • ${b.slot || "-"}`} icon={CalendarClock} />
                      <Info k="Fasting" v={b.fasting || "As advised"} />
                      <Info k="Amount" v={money(b.total)} icon={Banknote} />
                    </div>
                    {tab === "collections" ? (
                      <div style={styles.infoGrid}>
                        <Info k="Address" v={b.address || "-"} />
                        <Info k="Landmark" v={b.landmark || "-"} />
                        <Info k="Collector" v={b.collectorName || "Not assigned"} />
                      </div>
                    ) : null}
                    {tab === "processing" ? (
                      <div style={styles.infoGrid}>
                        <Info k="Sample collected time" v={b.sampleCollectedAt ? new Date(b.sampleCollectedAt).toLocaleString() : "-"} />
                        <Info k="Expected TAT" v={b.reportEta || "24 hrs"} />
                        <Info k="Remarks" v={b.notes || "-"} />
                      </div>
                    ) : null}
                    {tab === "reports" ? (
                      <div style={styles.infoGrid}>
                        <Info k="Report due by" v={tat.text} />
                        <Info k="Uploaded file" v={b.reportFileName || b.attachedFileName || "Not uploaded"} />
                      </div>
                    ) : null}
                    {!canRevealPhone(b) ? <div style={styles.note}>Customer contact shared only after booking acceptance.</div> : null}
                    {b.notes ? <div style={styles.note}>Notes: {b.notes}</div> : null}
                    <div style={styles.rowWrap}>
                      <StatusChip text={tat.text} icon={Clock3} bg={tone.bg} fg={tone.fg} border={tone.border} />
                      <Chip text={`ETA: ${b.reportEta || "24 hrs"}`} />
                    </div>
                    <div style={styles.rowWrap}>
                      {tab !== "reports" ? (
                        (tab === "new" ? [
                          { t: "Accept Booking", a: "accept", v: "p" },
                          { t: "Reject Booking", a: "cancel", v: "g", payload: { reason: "Rejected by lab partner" } },
                        ] : tab === "collections" ? [
                          { t: "Confirm Slot", a: "accept", v: "g" },
                          { t: "Mark Reached", a: "accept", v: "g", d: true },
                          { t: "Mark Sample Collected", a: "collect", v: "p" },
                          { t: "Reschedule", a: "cancel", v: "g", d: true },
                          { t: "Unable to Collect", a: "cancel", v: "g", payload: { reason: "Unable to collect sample" } },
                        ] : [
                          { t: "Start Processing", a: "processing", v: "p" },
                          { t: "Mark In Progress", a: "processing", v: "g" },
                          { t: "Mark Delayed", a: "processing", v: "g", d: true },
                        ]).map((btn) => {
                          const bKey = `${k}-${btn.a}`;
                          const isBusy = busy === bKey;
                          return <button key={btn.t} style={btn.v === "p" ? styles.btnP : styles.btnG} disabled={btn.d || isBusy} onClick={() => runAction(b, btn.a, btn.payload || {})}>{isBusy ? <Loader2 style={{ width: 12, height: 12 }} /> : null}{btn.t}</button>;
                        })
                      ) : null}

                      {tab === "reports" ? (
                        <>
                          <label style={styles.fileLabel}><Upload style={{ width: 12, height: 12 }} /><input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => setReportFiles((prev) => ({ ...prev, [k]: e.target.files?.[0] || null }))} />{reportFiles[k] ? reportFiles[k].name : "Choose signed report"}</label>
                          <button style={styles.btnP} disabled={!reportFiles[k]} onClick={() => runAction(b, "upload_report", { reportFile: reportFiles[k] })}>Upload Signed PDF</button>
                          <button style={styles.btnG} disabled={!reportFiles[k]} onClick={() => runAction(b, "upload_report", { reportFile: reportFiles[k] })}>Replace Report</button>
                          <button style={styles.btnP} onClick={() => runAction(b, "report_ready", { reportFile: reportFiles[k] })}>Mark Report Ready</button>
                          <button style={styles.btnG} onClick={() => runAction(b, "completed")}>Mark Completed</button>
                        </>
                      ) : null}
                      <button style={styles.btnG} onClick={() => setSelected(b)}>View Details</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {tab === "catalog" ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={styles.infoBlue}><ShieldCheck style={{ width: 14, height: 14 }} /> Customer-facing catalog is controlled by GoDavaii. Partner proposals require admin approval before going live.</div>
              <div style={styles.innerCard}>
                <div style={styles.sectionTitle}><Activity style={styles.sectionIcon} />Active Tests & Packages</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {catalogActive.map((c) => (
                    <div key={c.id || c.name} style={styles.simpleRow}>
                      <div><div style={styles.title}>{c.name}</div><div style={styles.sub}>{c.category || "General"}</div></div>
                      <div style={{ display: "grid", gap: 4, justifyItems: "end" }}>
                        <Chip text={money(c.partnerPrice || c.price)} />
                        <Chip text={c.reportTAT || "24 hrs"} />
                        <Chip text={c.homeCollection ? "Home collection: Yes" : "Home collection: No"} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={styles.innerCard}>
                <div style={styles.sectionTitle}><Clock3 style={styles.sectionIcon} />Pending Approval</div>
                {!proposals.length ? <Empty text="No pending proposals yet." /> : null}
                <div style={{ display: "grid", gap: 8 }}>
                  {proposals.map((p) => <div key={p.id} style={styles.simpleRow}><div><div style={styles.title}>{p.name}</div><div style={styles.sub}>{p.type} • {p.category} • {money(p.price)}</div><div style={styles.note}>Admin comment: {p.adminComment || "-"}</div></div><Chip text={statusLabel(p.status) || "Draft"} /></div>)}
                </div>
              </div>

              <div style={styles.innerCard}>
                <div style={styles.sectionTitle}><FlaskConical style={styles.sectionIcon} />Add New Test</div>
                <div style={styles.formGrid}>
                  <input style={styles.input} placeholder="Test Name" value={testForm.testName} onChange={(e) => setTestForm((x) => ({ ...x, testName: e.target.value }))} />
                  <input style={styles.input} placeholder="Category" value={testForm.category} onChange={(e) => setTestForm((x) => ({ ...x, category: e.target.value }))} />
                  <input style={styles.input} placeholder="Price" value={testForm.price} onChange={(e) => setTestForm((x) => ({ ...x, price: e.target.value }))} />
                  <input style={styles.input} placeholder="Old Price (optional)" value={testForm.oldPrice} onChange={(e) => setTestForm((x) => ({ ...x, oldPrice: e.target.value }))} />
                  <input style={styles.input} placeholder="Report Time" value={testForm.reportTime} onChange={(e) => setTestForm((x) => ({ ...x, reportTime: e.target.value }))} />
                  <input style={styles.input} placeholder="Sample Type" value={testForm.sampleType} onChange={(e) => setTestForm((x) => ({ ...x, sampleType: e.target.value }))} />
                  <input style={styles.input} placeholder="Included Parameters" value={testForm.includedParameters} onChange={(e) => setTestForm((x) => ({ ...x, includedParameters: e.target.value }))} />
                  <input style={styles.input} placeholder="Service Areas" value={testForm.serviceAreas} onChange={(e) => setTestForm((x) => ({ ...x, serviceAreas: e.target.value }))} />
                  <select style={styles.select} value={testForm.fastingRequired} onChange={(e) => setTestForm((x) => ({ ...x, fastingRequired: e.target.value }))}><option value="yes">Fasting Required: Yes</option><option value="no">Fasting Required: No</option></select>
                  <select style={styles.select} value={testForm.homeCollection} onChange={(e) => setTestForm((x) => ({ ...x, homeCollection: e.target.value }))}><option value="yes">Home Collection: Yes</option><option value="no">Home Collection: No</option></select>
                  <select style={styles.select} value={testForm.sourcing} onChange={(e) => setTestForm((x) => ({ ...x, sourcing: e.target.value }))}><option value="in_house">In-house</option><option value="outsourced">Outsourced</option></select>
                  <select style={styles.select} value={testForm.available} onChange={(e) => setTestForm((x) => ({ ...x, available: e.target.value }))}><option value="yes">Available: Yes</option><option value="no">Available: No</option></select>
                  <textarea style={styles.textarea} placeholder="Description" value={testForm.description} onChange={(e) => setTestForm((x) => ({ ...x, description: e.target.value }))} />
                  <textarea style={styles.textarea} placeholder="Notes for Admin" value={testForm.notesForAdmin} onChange={(e) => setTestForm((x) => ({ ...x, notesForAdmin: e.target.value }))} />
                  <button style={styles.btnP} onClick={() => submitProposal("test")}>Submit Test Proposal</button>
                </div>
              </div>

              <div style={styles.innerCard}>
                <div style={styles.sectionTitle}><FileText style={styles.sectionIcon} />Add New Package</div>
                <div style={styles.formGrid}>
                  <input style={styles.input} placeholder="Package Name" value={packageForm.packageName} onChange={(e) => setPackageForm((x) => ({ ...x, packageName: e.target.value }))} />
                  <input style={styles.input} placeholder="Category" value={packageForm.category} onChange={(e) => setPackageForm((x) => ({ ...x, category: e.target.value }))} />
                  <input style={styles.input} placeholder="Included Tests" value={packageForm.includedTests} onChange={(e) => setPackageForm((x) => ({ ...x, includedTests: e.target.value }))} />
                  <input style={styles.input} placeholder="Custom Includes Text" value={packageForm.customIncludesText} onChange={(e) => setPackageForm((x) => ({ ...x, customIncludesText: e.target.value }))} />
                  <input style={styles.input} placeholder="Price" value={packageForm.price} onChange={(e) => setPackageForm((x) => ({ ...x, price: e.target.value }))} />
                  <input style={styles.input} placeholder="Old Price (optional)" value={packageForm.oldPrice} onChange={(e) => setPackageForm((x) => ({ ...x, oldPrice: e.target.value }))} />
                  <input style={styles.input} placeholder="Report Time" value={packageForm.reportTime} onChange={(e) => setPackageForm((x) => ({ ...x, reportTime: e.target.value }))} />
                  <input style={styles.input} placeholder="Service Areas" value={packageForm.serviceAreas} onChange={(e) => setPackageForm((x) => ({ ...x, serviceAreas: e.target.value }))} />
                  <select style={styles.select} value={packageForm.fastingRequired} onChange={(e) => setPackageForm((x) => ({ ...x, fastingRequired: e.target.value }))}><option value="yes">Fasting Required: Yes</option><option value="no">Fasting Required: No</option></select>
                  <select style={styles.select} value={packageForm.homeCollection} onChange={(e) => setPackageForm((x) => ({ ...x, homeCollection: e.target.value }))}><option value="yes">Home Collection: Yes</option><option value="no">Home Collection: No</option></select>
                  <select style={styles.select} value={packageForm.available} onChange={(e) => setPackageForm((x) => ({ ...x, available: e.target.value }))}><option value="yes">Available: Yes</option><option value="no">Available: No</option></select>
                  <textarea style={styles.textarea} placeholder="Description" value={packageForm.description} onChange={(e) => setPackageForm((x) => ({ ...x, description: e.target.value }))} />
                  <textarea style={styles.textarea} placeholder="Notes for Admin" value={packageForm.notesForAdmin} onChange={(e) => setPackageForm((x) => ({ ...x, notesForAdmin: e.target.value }))} />
                  <button style={styles.btnP} onClick={() => submitProposal("package")}>Submit Package Proposal</button>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "profile" ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={styles.innerCard}>
                <div style={styles.sectionTitle}><MapPin style={styles.sectionIcon} />Registered Lab Location</div>
                <div style={styles.infoGrid}><Info k="Lab name" v={profile?.name || "-"} /><Info k="Organization" v={profile?.organization || "-"} /><Info k="Registered address" v={profile?.labAddress || "-"} /><Info k="City" v={profile?.city || "-"} /><Info k="Pincode" v={profile?.pincode || "-"} /></div>
              </div>
              <div style={styles.innerCard}>
                <div style={styles.sectionTitle}><Activity style={styles.sectionIcon} />Service Coverage</div>
                <div style={styles.infoGrid}><Info k="Service areas" v={profile?.areas?.join(", ") || profile?.serviceAreasText || "-"} /><Info k="Service radius" v={profile?.verification?.operations?.serviceRadius || "-"} /><Info k="Home collection" v={profile?.homeCollectionAvailable ? "Yes" : "No"} /><Info k="Sunday availability" v={profile?.verification?.operations?.sundayAvailability || "-"} /></div>
              </div>
              <div style={styles.innerCard}>
                <div style={styles.sectionTitle}><ShieldCheck style={styles.sectionIcon} />Verification Summary</div>
                <div style={styles.infoGrid}>
                  <Info k="Partner status" v={profile?.partnerStatusLabel || "Under Review"} />
                  <Info k="Missing docs" v={String(compliance?.missing?.length || 0)} />
                  <Info k="Bank verified" v={compliance?.bankVerified ? "Yes" : "No"} />
                  <Info k="Agreement signed" v={compliance?.agreementSigned ? "Yes" : "No"} />
                  <Info k="Report upload tested" v={compliance?.reportUploadTested ? "Yes" : "No"} />
                </div>
              </div>
              <div style={styles.innerCard}>
                <div style={styles.sectionTitle}><FileText style={styles.sectionIcon} />Uploaded Docs Summary</div>
                <div style={styles.infoGrid}>
                  <Info k="Basic docs" v={String((profile?.documents || []).length)} />
                  <Info k="License number" v={profile?.licenseNumber || "-"} />
                  <Info k="Status notes" v={profile?.statusNotes || "-"} />
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section style={styles.bottomGrid}>
          <div style={styles.card}><div style={styles.sectionTitle}><HandCoins style={styles.sectionIcon} />Payout Summary</div><div style={styles.infoGrid}><Info k="Estimated earnings" v={money(payout.estimated)} /><Info k="Payout pending" v={money(payout.pending)} /><Info k="Last settlement" v={payout.lastSettlementDate} /><Info k="Settlement status" v={payout.settlementStatus} /></div></div>
          <div style={styles.card}><div style={styles.sectionTitle}><Phone style={styles.sectionIcon} />GoDavaii Ops Support</div><p style={styles.muted}>Escalate collection/report issues to Ops. For urgent route or patient coordination, use support channel.</p><div style={styles.rowWrap}><button style={styles.btnG}>WhatsApp Support</button><button style={styles.btnG}>Report Issue</button></div><div style={styles.note}>Partner proposals require admin approval before going live.</div></div>
        </section>

        {error ? <div style={styles.err}>{error}</div> : null}
        {success ? <div style={styles.ok}>{success}</div> : null}
      </div>

      {selected ? <BookingDrawer booking={normalizeBooking(selected, profile)} onClose={() => setSelected(null)} onAction={runAction} busy={busy} reportFile={reportFiles[String(selected.bookingId || selected.id || selected._id)]} setReportFile={(f) => setReportFiles((prev) => ({ ...prev, [String(selected.bookingId || selected.id || selected._id)]: f }))} /> : null}
    </div>
  );
}

function BookingDrawer({ booking, onClose, onAction, busy, reportFile, setReportFile }) {
  const tat = getTat(booking);
  const tone = chipTone(tat.tone);
  const statusTone = ["completed", "report_ready"].includes(s(booking.status)) ? chipTone("green") : ["cancelled", "rejected", "unable_to_collect"].includes(s(booking.status)) ? chipTone("red") : chipTone("yellow");
  const k = String(booking.bookingId || booking.id || booking._id);

  function Act({ label, action, payload = {}, disabled = false }) {
    const b = busy === `${k}-${action}`;
    return <button style={styles.btnP} disabled={disabled || b} onClick={() => onAction(booking, action, payload)}>{b ? <Loader2 style={{ width: 12, height: 12 }} /> : null}{label}</button>;
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.drawer}>
        <div style={styles.rowBetween}><div style={styles.sectionTitle}><FileText style={styles.sectionIcon} />Booking Details</div><button style={styles.closeBtn} onClick={onClose}><XCircle style={{ width: 18, height: 18 }} /></button></div>
        <div style={styles.infoGrid}>
          <Info k="Booking ID" v={booking.bookingId} /><Info k="Patient" v={booking.patientName} /><Info k="Phone" v={canRevealPhone(booking) ? booking.phone : maskPhone(booking.phone)} /><Info k="Address" v={booking.address || "-"} /><Info k="Landmark" v={booking.landmark || "-"} /><Info k="City / Area" v={booking.cityArea || "-"} /><Info k="Slot" v={`${booking.dateLabel || booking.date || "-"} • ${booking.slot || "-"}`} /><Info k="Tests" v={booking.testsText} /><Info k="Fasting" v={booking.fasting || "As advised"} /><Info k="Payment status" v={booking.paymentStatus || "pending"} /><Info k="Current status" v={statusLabel(booking.status)} /><Info k="Collector" v={booking.collectorName || "Not assigned"} /><Info k="Attached prescription/report" v={booking.attachedFileName || "-"} /><Info k="Report file" v={booking.reportFileName || "Not uploaded"} />
        </div>
        <div style={styles.rowWrap}><StatusChip text={tat.text} icon={Clock3} bg={tone.bg} fg={tone.fg} border={tone.border} /><StatusChip text={statusLabel(booking.status)} bg={statusTone.bg} fg={statusTone.fg} border={statusTone.border} /></div>
        <div style={styles.infoBlue}><FileCheck2 style={{ width: 14, height: 14 }} /> Upload original signed lab report only. Do not replace report branding with GoDavaii branding.</div>
        <label style={styles.fileLabel}><Upload style={{ width: 12, height: 12 }} /><input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => setReportFile(e.target.files?.[0] || null)} />{reportFile ? reportFile.name : "Choose file (.pdf/.jpg/.jpeg/.png)"}</label>
        <div style={styles.rowWrap}><Act label="Accept" action="accept" /><Act label="Collected" action="collect" /><Act label="Processing" action="processing" /><Act label="Upload Report" action="upload_report" payload={{ reportFile }} disabled={!reportFile} /><Act label="Report Ready" action="report_ready" payload={{ reportFile }} /><Act label="Completed" action="completed" /></div>
      </div>
    </div>
  );
}

function Chip({ icon: Icon, text }) { return <span style={styles.chip}>{Icon ? <Icon style={{ width: 12, height: 12 }} /> : null}{text}</span>; }
function StatusChip({ icon: Icon, text, bg, fg, border }) { return <span style={{ ...styles.chip, background: bg, color: fg, border: `1px solid ${border}` }}>{Icon ? <Icon style={{ width: 12, height: 12 }} /> : null}{text}</span>; }
function Empty({ text }) { return <div style={styles.empty}><Clock3 style={{ width: 15, height: 15 }} />{text}</div>; }
function StatCard({ title, value }) { return <div style={styles.stat}><div style={styles.statTitle}>{title}</div><div style={styles.statValue}>{value}</div></div>; }
function MiniStat({ title, value, tone = "n" }) { const t = tone === "warn" ? ["#FFFBEB", "#92400E", "#FCD34D"] : tone === "ok" ? ["#ECFDF5", "#065F46", "#86EFAC"] : ["#F8FAFC", "#0F172A", "#E2E8F0"]; return <div style={{ borderRadius: 12, border: `1px solid ${t[2]}`, background: t[0], padding: 9 }}><div style={styles.miniTitle}>{title}</div><div style={{ fontWeight: 900, color: t[1], fontSize: 14, marginTop: 2 }}>{value}</div></div>; }
function Info({ k, v, icon: Icon }) { return <div style={{ display: "grid", gap: 2 }}><div style={styles.k}>{Icon ? <Icon style={{ width: 12, height: 12 }} /> : null}{k}</div><div style={styles.v}>{v || "-"}</div></div>; }

const styles = {
  page: { minHeight: "100vh", background: "linear-gradient(180deg,#EAF8F1 0%,#EFF6FF 45%,#F8FAFC 100%)", padding: 12, fontFamily: "'Plus Jakarta Sans',sans-serif" },
  container: { maxWidth: 1040, margin: "0 auto", display: "grid", gap: 12 },
  loaderWrap: { minHeight: "80vh", display: "grid", placeItems: "center", gap: 8 },
  hero: { borderRadius: 22, padding: 14, background: "linear-gradient(135deg,#0A4E37,#0D6B47)", color: "#fff", border: "1px solid rgba(255,255,255,.16)", boxShadow: "0 16px 38px rgba(5,70,45,.25)" },
  heroTop: { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  heroIdentity: { display: "flex", alignItems: "center", gap: 10 },
  iconBox: { width: 44, height: 44, borderRadius: 14, background: "rgba(255,255,255,.12)", display: "grid", placeItems: "center" },
  heroTitle: { margin: 0, fontFamily: "'Sora',sans-serif", fontSize: 21, fontWeight: 900 },
  heroSub: { margin: "2px 0 0", fontSize: 12, opacity: .9, fontWeight: 600 },
  heroMeta: { marginTop: 9, display: "flex", gap: 7, flexWrap: "wrap" },
  heroActions: { display: "flex", gap: 7, flexWrap: "wrap", alignItems: "flex-start" },
  heroBtn: { height: 35, borderRadius: 11, border: "1px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 12, fontWeight: 800, padding: "0 10px", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" },
  logoutBtn: { height: 35, borderRadius: 11, border: "none", background: "#fff", color: "#0B5D3B", fontSize: 12, fontWeight: 900, padding: "0 10px", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" },
  i: { width: 13, height: 13 },
  bannerDanger: { marginTop: 10, borderRadius: 11, border: "1px solid rgba(254,202,202,.55)", background: "rgba(127,29,29,.25)", color: "#FEF2F2", fontSize: 12, fontWeight: 800, padding: "9px 11px", display: "flex", alignItems: "center", gap: 6 },
  card: { borderRadius: 20, background: "rgba(255,255,255,.95)", border: "1px solid rgba(15,23,42,.08)", boxShadow: "0 8px 26px rgba(15,23,42,.06)", padding: 12, display: "grid", gap: 10 },
  innerCard: { borderRadius: 16, border: "1px solid #E2E8F0", background: "#fff", padding: 10, display: "grid", gap: 10 },
  sectionTitle: { fontSize: 16, color: "#0F172A", fontWeight: 900, fontFamily: "'Sora',sans-serif", display: "flex", gap: 7, alignItems: "center" },
  sectionIcon: { width: 15, height: 15, color: "#0B5D3B" },
  grid5: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 },
  warnLine: { borderRadius: 10, border: "1px solid #FDBA74", background: "#FFF7ED", color: "#9A3412", fontSize: 12, fontWeight: 800, padding: "7px 9px", display: "flex", alignItems: "center", gap: 6 },
  okLine: { borderRadius: 10, border: "1px solid #86EFAC", background: "#ECFDF5", color: "#065F46", fontSize: 12, fontWeight: 800, padding: "7px 9px", display: "flex", alignItems: "center", gap: 6 },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 },
  stat: { borderRadius: 14, border: "1px solid rgba(15,23,42,.08)", background: "#fff", padding: 10 },
  statTitle: { fontSize: 11, color: "#64748B", fontWeight: 700 },
  statValue: { marginTop: 2, fontSize: 24, color: "#0B5D3B", fontWeight: 900 },
  searchRow: { display: "grid", gap: 8 },
  searchBox: { border: "1px solid #CBD5E1", background: "#fff", borderRadius: 12, height: 40, display: "flex", alignItems: "center", gap: 7, padding: "0 10px" },
  searchInput: { flex: 1, border: "none", outline: "none", fontSize: 13, fontWeight: 700, background: "transparent", color: "#0F172A" },
  select: { height: 40, borderRadius: 12, border: "1px solid #CBD5E1", background: "#fff", fontSize: 13, fontWeight: 700, color: "#0F172A", padding: "0 10px" },
  tabs: { display: "flex", gap: 7, flexWrap: "wrap" },
  tab: { height: 34, borderRadius: 999, border: "1px solid #D1D5DB", background: "#fff", color: "#334155", fontSize: 12, fontWeight: 800, padding: "0 12px", cursor: "pointer" },
  tabActive: { borderColor: "#0B5D3B", background: "linear-gradient(135deg,#0B5D3B,#0D6B47)", color: "#fff" },
  queueCard: { borderRadius: 16, border: "1px solid #E2E8F0", background: "#fff", padding: 10, display: "grid", gap: 8 },
  rowBetween: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" },
  rowWrap: { display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" },
  title: { fontSize: 15, fontWeight: 900, color: "#0F172A" },
  sub: { marginTop: 2, fontSize: 12, color: "#64748B", fontWeight: 700 },
  note: { fontSize: 12, color: "#334155", fontWeight: 700 },
  infoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 },
  chip: { height: 28, borderRadius: 999, border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#334155", fontSize: 11, fontWeight: 800, padding: "0 9px", display: "inline-flex", alignItems: "center", gap: 6, width: "fit-content" },
  btnP: { height: 33, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#0B5D3B,#0D6B47)", color: "#fff", fontSize: 12, fontWeight: 800, padding: "0 10px", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" },
  btnG: { height: 33, borderRadius: 10, border: "1px solid #D1D5DB", background: "#fff", color: "#0F172A", fontSize: 12, fontWeight: 800, padding: "0 10px", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" },
  fileLabel: { height: 33, borderRadius: 10, border: "1px dashed #94A3B8", background: "#F8FAFC", color: "#0F172A", fontSize: 12, fontWeight: 700, padding: "0 10px", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", maxWidth: "100%" },
  empty: { borderRadius: 12, border: "1px dashed #CBD5E1", background: "#F8FAFC", color: "#64748B", fontSize: 13, fontWeight: 700, padding: 12, display: "flex", alignItems: "center", gap: 7 },
  bottomGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 10 },
  muted: { margin: 0, color: "#475569", fontSize: 13, lineHeight: 1.5, fontWeight: 600 },
  infoBlue: { borderRadius: 10, border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1E3A8A", fontSize: 12, fontWeight: 800, padding: "8px 10px", display: "flex", alignItems: "center", gap: 7 },
  err: { borderRadius: 10, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#991B1B", padding: "8px 10px", fontSize: 12, fontWeight: 800 },
  ok: { borderRadius: 10, border: "1px solid #86EFAC", background: "#ECFDF5", color: "#065F46", padding: "8px 10px", fontSize: 12, fontWeight: 800 },
  overlay: { position: "fixed", inset: 0, background: "rgba(2,6,23,.45)", display: "flex", justifyContent: "center", alignItems: "flex-end", zIndex: 80, padding: 10 },
  drawer: { width: "100%", maxWidth: 680, maxHeight: "92vh", overflowY: "auto", borderRadius: 20, background: "#fff", border: "1px solid #E2E8F0", boxShadow: "0 20px 45px rgba(2,6,23,.25)", padding: 12, display: "grid", gap: 10 },
  closeBtn: { width: 32, height: 32, borderRadius: 10, border: "1px solid #D1D5DB", background: "#fff", color: "#64748B", display: "grid", placeItems: "center", cursor: "pointer" },
  formGrid: { display: "grid", gap: 8 },
  input: { height: 36, borderRadius: 10, border: "1px solid #CBD5E1", padding: "0 10px", fontSize: 12.5, fontWeight: 700, outline: "none", width: "100%" },
  textarea: { minHeight: 70, borderRadius: 10, border: "1px solid #CBD5E1", padding: "8px 10px", fontSize: 12.5, fontWeight: 700, outline: "none", width: "100%", resize: "vertical" },
  simpleRow: { borderRadius: 12, border: "1px solid #E2E8F0", background: "#fff", padding: 10, display: "flex", justifyContent: "space-between", gap: 10 },
  miniTitle: { fontSize: 11, color: "#64748B", fontWeight: 700 },
  k: { fontSize: 11, color: "#64748B", fontWeight: 700, display: "flex", gap: 5, alignItems: "center" },
  v: { fontSize: 13, color: "#0F172A", fontWeight: 800 },
};
