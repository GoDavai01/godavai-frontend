import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Footprints,
  Play,
  Pause,
  Square,
  MapPinned,
  Flame,
  Gauge,
  Route,
  Clock3,
  Activity,
  Ruler,
  Weight,
  MapPin,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  ChevronUp,
  Pencil,
  Navigation,
  Timer,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const GOOGLE_MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";

const DEEP = "#0A5A3B";
const MID = "#0F7A53";
const ACCENT = "#18E2A1";
const BG_TOP = "#F4FBF8";
const BG_MID = "#EEF8F4";
const BG_BOT = "#F7FAFF";
const GLASS = "rgba(255,255,255,0.92)";
const BORDER = "rgba(12,90,62,0.08)";
const TEXT = "#10231A";
const SUB = "#6A7A73";

const MAX_ACCURACY_METERS = 30;
const MIN_DISTANCE_DELTA = 2.0;
const MAX_DISTANCE_DELTA = 150;

/* ── Pedometer tuning ── */
const STEP_PEAK_GRAVITY = 11.4;    // raised slightly from 11.2
const STEP_VALLEY_GRAVITY = 9.0;
const STEP_PEAK_PURE = 2.5;        // raised from 2.2
const STEP_VALLEY_PURE = 0.6;
const STEP_MIN_MS = 280;           // ~214 steps/min max (fast run)
const STEP_MAX_MS = 2000;
const WARMUP_MS = 3000;            // ignore first 3s of motion after start
const CONSECUTIVE_NEEDED = 3;      // need 3 valid cycles before we start counting

function Glass({ children, style, ...rest }) {
  return (<div style={{ background: GLASS, border: `1px solid ${BORDER}`, borderRadius: 24, boxShadow: "0 16px 34px rgba(16,24,40,0.05)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", ...style }} {...rest}>{children}</div>);
}

function formatDuration(t = 0) {
  const s = Math.max(0, Math.floor(t));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
function metersToKm(m = 0) { return (Number(m || 0) / 1000).toFixed(2); }

function haversineMeters(a, b) {
  if (!a || !b) return 0;
  const R = 6371000, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180, lat2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function calcSteps(dist = 0, manual = 0, stride = 0.78) {
  const s = Number(stride || 0.78) > 0 ? Number(stride) : 0.78;
  return Math.max(Number(manual || 0), Math.round(Number(dist || 0) / s), 0);
}

function calcCal({ distanceMeters = 0, steps = 0, weightKg = null }) {
  if (!weightKg || Number(weightKg) <= 0) return null;
  const km = Number(distanceMeters || 0) / 1000;
  return Math.round(Math.max(km * Number(weightKg) * 0.75, Number(steps || 0) * 0.04, 0));
}

function calcPace(dur = 0, dist = 0) {
  const km = Number(dist || 0) / 1000;
  if (!km || km <= 0) return "--";
  const mpk = dur / 60 / km, min = Math.floor(mpk), sec = Math.round((mpk - min) * 60);
  return `${min}:${String(sec).padStart(2, "0")} /km`;
}

function normPtsPath(pts, w = 320, h = 220, pad = 16) {
  if (!pts || pts.length < 2) return "";
  const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng);
  const mnLat = Math.min(...lats), mxLat = Math.max(...lats), mnLng = Math.min(...lngs), mxLng = Math.max(...lngs);
  const lR = mxLat - mnLat || 0.0001, gR = mxLng - mnLng || 0.0001;
  return pts.map(p => `${pad + ((p.lng - mnLng) / gR) * (w - pad * 2)},${h - pad - ((p.lat - mnLat) / lR) * (h - pad * 2)}`).join(" ");
}

function cmToFtIn(cm) { const c = Number(cm || 0); if (!c || c <= 0) return { feet: "", inches: "" }; const tot = c / 2.54, f = Math.floor(tot / 12), i = Math.round(tot - f * 12); if (i === 12) return { feet: String(f + 1), inches: "0" }; return { feet: String(f), inches: String(i) }; }
function ftInToCm(f, i) { const tot = Number(f || 0) * 12 + Number(i || 0); return tot <= 0 ? null : Math.round(tot * 2.54); }

function extractToken(t) {
  if (t) return t;
  const c = [localStorage.getItem("token"), localStorage.getItem("authToken"), localStorage.getItem("accessToken"), localStorage.getItem("userToken")].filter(Boolean);
  if (c.length) return c[0];
  const ax = axios?.defaults?.headers?.common?.Authorization || axios?.defaults?.headers?.common?.authorization;
  if (typeof ax === "string" && ax.startsWith("Bearer ")) return ax.slice(7).trim();
  return null;
}

/* ═══ Sub-components ═══ */

function FallbackRouteMap({ points, title = "Live Route", badge = "Outdoor" }) {
  const poly = normPtsPath(points); const hasR = points && points.length >= 2;
  return (
    <Glass style={{ padding: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 38, height: 38, borderRadius: 14, background: "rgba(24,226,161,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><MapPinned style={{ width: 17, height: 17, color: DEEP }} /></div>
          <div><div style={{ fontSize: 13, fontWeight: 900, color: TEXT, fontFamily: "'Sora',sans-serif" }}>{title}</div><div style={{ fontSize: 11, color: SUB, fontWeight: 700 }}>Start → path → end</div></div>
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 900, color: DEEP, background: "rgba(24,226,161,0.10)", padding: "6px 10px", borderRadius: 999 }}>{badge}</div>
      </div>
      <div style={{ width: "100%", height: 260, borderRadius: 20, background: "linear-gradient(180deg,#F8FCFA,#EEF8F4)", border: `1px solid ${BORDER}`, overflow: "hidden" }}>
        <svg width="100%" height="100%" viewBox="0 0 320 220" preserveAspectRatio="none">
          <defs><linearGradient id="rGF" x1="0%" x2="100%"><stop offset="0%" stopColor="#0A5A3B" /><stop offset="100%" stopColor="#18E2A1" /></linearGradient></defs>
          {hasR ? (<><polyline points={poly} fill="none" stroke="url(#rGF)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" /><circle cx={poly.split(" ")[0].split(",")[0]} cy={poly.split(" ")[0].split(",")[1]} r="6" fill="#0A5A3B" />{(() => { const l = poly.split(" ").slice(-1)[0].split(","); return <circle cx={l[0]} cy={l[1]} r="7" fill="#18E2A1" stroke="#0A5A3B" strokeWidth="2" />; })()}</>) : (<text x="160" y="110" textAnchor="middle" fill="#8AA39A" fontSize="13" fontWeight="700">Start a walk to see your route</text>)}
        </svg>
      </div>
    </Glass>
  );
}

function StatCard({ icon: Icon, label, value, helper, accent }) {
  return (
    <Glass style={{ padding: 14, minHeight: 118 }}>
      <div style={{ width: 40, height: 40, borderRadius: 15, background: accent ? "rgba(24,226,161,0.18)" : "rgba(24,226,161,0.10)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><Icon style={{ width: 17, height: 17, color: accent ? ACCENT : DEEP }} /></div>
      <div style={{ fontSize: 11, fontWeight: 800, color: SUB, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 1000, color: TEXT, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#8A9A94", lineHeight: 1.4 }}>{helper}</div>
    </Glass>
  );
}

/* ═══ Enhanced Session Card with full walk details ═══ */
function SessionCard({ session, onOpenMap }) {
  const st = session.stats || {};
  const dur = Number(st.durationSec || 0);
  const dist = Number(st.distanceMeters || 0);
  const steps = Number(st.steps || 0);
  const cal = st.caloriesKcal != null ? Math.round(st.caloriesKcal) : null;
  const pace = st.avgPaceMinPerKm && st.avgPaceMinPerKm > 0 ? `${Math.floor(st.avgPaceMinPerKm)}:${String(Math.round((st.avgPaceMinPerKm % 1) * 60)).padStart(2, "0")} /km` : "--";
  const maxSpd = st.maxSpeedKmh ? `${st.maxSpeedKmh.toFixed(1)} km/h` : "--";

  return (
    <Glass style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 900, color: TEXT }}>{new Date(session.startedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
          <div style={{ fontSize: 11, color: SUB, fontWeight: 700, marginTop: 2 }}>{new Date(session.startedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} {session.endedAt ? `— ${new Date(session.endedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => onOpenMap?.(session)} style={{ border: "none", background: `linear-gradient(135deg,${DEEP},${MID})`, color: "#fff", borderRadius: 999, padding: "8px 14px", fontSize: 10.5, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <Navigation style={{ width: 12, height: 12 }} /> Route
          </motion.button>
          <div style={{ fontSize: 10.5, fontWeight: 900, color: session.status === "ended" ? DEEP : "#C2410C", background: session.status === "ended" ? "rgba(24,226,161,0.10)" : "#FFF7ED", padding: "6px 10px", borderRadius: 999 }}>{session.status === "ended" ? "Done" : "Active"}</div>
        </div>
      </div>

      {/* Stats grid — 2 rows */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 8 }}>
        {[
          { icon: Footprints, l: "Steps", v: steps.toLocaleString() },
          { icon: Route, l: "Distance", v: `${metersToKm(dist)} km` },
          { icon: Timer, l: "Duration", v: formatDuration(dur) },
        ].map(x => (
          <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <x.icon style={{ width: 13, height: 13, color: DEEP, flexShrink: 0 }} />
            <div><div style={{ fontSize: 9.5, color: SUB, fontWeight: 700 }}>{x.l}</div><div style={{ fontSize: 12.5, color: TEXT, fontWeight: 1000, fontFamily: "'Sora',sans-serif" }}>{x.v}</div></div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {[
          { icon: Flame, l: "Calories", v: cal != null ? `${cal} kcal` : "--" },
          { icon: Gauge, l: "Pace", v: pace },
          { icon: TrendingUp, l: "Top Speed", v: maxSpd },
        ].map(x => (
          <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <x.icon style={{ width: 13, height: 13, color: DEEP, flexShrink: 0 }} />
            <div><div style={{ fontSize: 9.5, color: SUB, fontWeight: 700 }}>{x.l}</div><div style={{ fontSize: 12.5, color: TEXT, fontWeight: 1000, fontFamily: "'Sora',sans-serif" }}>{x.v}</div></div>
          </div>
        ))}
      </div>
    </Glass>
  );
}

function PermissionBanner({ permGps, permMotion, onRequestGps, onRequestMotion }) {
  const allOk = permGps === "granted" && (permMotion === "granted" || permMotion === "na");
  if (allOk) return null;
  return (
    <Glass style={{ padding: 14, marginBottom: 16, background: "#FFFBEB", border: "1px solid rgba(245,158,11,0.18)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><AlertTriangle style={{ width: 18, height: 18, color: "#D97706", flexShrink: 0 }} /><div style={{ fontSize: 13, fontWeight: 900, color: "#92400E" }}>Permissions needed</div></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {permGps !== "granted" && (
          <motion.button whileTap={{ scale: 0.97 }} onClick={onRequestGps} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 16, border: "1px solid rgba(10,90,59,0.12)", background: "#fff", cursor: "pointer", width: "100%", textAlign: "left" }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: permGps === "denied" ? "#FEE2E2" : "rgba(24,226,161,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><MapPin style={{ width: 16, height: 16, color: permGps === "denied" ? "#DC2626" : DEEP }} /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 900, color: TEXT }}>Location Access</div><div style={{ fontSize: 11, color: SUB, fontWeight: 700 }}>{permGps === "denied" ? "Blocked — open settings" : "Tap to allow GPS"}</div></div>
            {permGps !== "denied" && <div style={{ fontSize: 10.5, fontWeight: 900, color: "#fff", background: DEEP, padding: "6px 12px", borderRadius: 999 }}>Allow</div>}
          </motion.button>
        )}
        {permMotion !== "granted" && permMotion !== "na" && (
          <motion.button whileTap={{ scale: 0.97 }} onClick={onRequestMotion} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 16, border: "1px solid rgba(10,90,59,0.12)", background: "#fff", cursor: "pointer", width: "100%", textAlign: "left" }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(24,226,161,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Smartphone style={{ width: 16, height: 16, color: DEEP }} /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 900, color: TEXT }}>Motion Sensor</div><div style={{ fontSize: 11, color: SUB, fontWeight: 700 }}>Tap to enable step counting</div></div>
            <div style={{ fontSize: 10.5, fontWeight: 900, color: "#fff", background: DEEP, padding: "6px 12px", borderRadius: 999 }}>Allow</div>
          </motion.button>
        )}
      </div>
    </Glass>
  );
}

function BodyMetricsCard({ weightInput, setWeightInput, feetInput, setFeetInput, inchInput, setInchInput, savingMetrics, onSave, hasWeight, hasHeight }) {
  const [editing, setEditing] = useState(!hasWeight || !hasHeight);
  useEffect(() => { if (hasWeight && hasHeight) setEditing(false); }, [hasWeight, hasHeight]);

  if (hasWeight && hasHeight && !editing) {
    return (
      <Glass style={{ padding: 14, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: "rgba(24,226,161,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><CheckCircle2 style={{ width: 18, height: 18, color: DEEP }} /></div>
          <div><div style={{ fontSize: 13, fontWeight: 900, color: TEXT }}>Body metrics saved</div><div style={{ fontSize: 11.5, color: SUB, fontWeight: 700 }}>{weightInput} kg · {feetInput}'{inchInput}"</div></div>
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setEditing(true)} style={{ border: "none", background: "rgba(24,226,161,0.10)", color: DEEP, borderRadius: 999, padding: "8px 12px", fontSize: 10.5, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Pencil style={{ width: 12, height: 12 }} /> Edit</motion.button>
      </Glass>
    );
  }

  return (
    <Glass style={{ padding: 14, marginBottom: 16, background: !hasWeight || !hasHeight ? "#FFF9EE" : "#F4FBF8", border: !hasWeight || !hasHeight ? "1px solid rgba(245,158,11,0.22)" : `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 14, background: "rgba(245,158,11,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Weight style={{ width: 17, height: 17, color: "#B45309" }} /></div>
        <div><div style={{ fontSize: 13, fontWeight: 900, color: "#92400E", marginBottom: 4 }}>{!hasWeight || !hasHeight ? "Set your body metrics" : "Update metrics"}</div><div style={{ fontSize: 11.5, color: "#A16207", fontWeight: 700, lineHeight: 1.5 }}>Needed for accurate calorie & step tracking.</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.75fr 0.75fr auto", gap: 10, alignItems: "end" }}>
        {[
          { label: "Weight (kg)", val: weightInput, set: v => setWeightInput(v.replace(/[^\d.]/g, "").slice(0, 5)), ph: "70", icon: Weight, mode: "decimal" },
          { label: "Feet", val: feetInput, set: v => setFeetInput(v.replace(/[^\d]/g, "").slice(0, 1)), ph: "5", icon: Ruler, mode: "numeric" },
          { label: "Inch", val: inchInput, set: v => setInchInput(v.replace(/[^\d]/g, "").slice(0, 2)), ph: "8", icon: Ruler, mode: "numeric" },
        ].map(f => (
          <div key={f.label}><div style={{ fontSize: 10.5, fontWeight: 800, color: SUB, marginBottom: 6 }}>{f.label}</div>
            <div style={{ height: 46, borderRadius: 14, border: "1px solid rgba(12,90,62,0.10)", background: "#fff", display: "flex", alignItems: "center", padding: "0 12px", gap: 8 }}>
              <f.icon style={{ width: 15, height: 15, color: DEEP }} /><input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} inputMode={f.mode} style={{ border: "none", outline: "none", width: "100%", background: "transparent", fontSize: 14, fontWeight: 800, color: TEXT }} />
            </div></div>
        ))}
        <motion.button whileTap={{ scale: 0.96 }} onClick={onSave} disabled={savingMetrics} style={{ height: 46, padding: "0 16px", borderRadius: 14, border: "none", background: `linear-gradient(135deg,${DEEP},${MID})`, color: "#fff", fontWeight: 1000, fontFamily: "'Sora',sans-serif", cursor: savingMetrics ? "wait" : "pointer", whiteSpace: "nowrap" }}>{savingMetrics ? "..." : "Save"}</motion.button>
      </div>
      {hasWeight && hasHeight && <motion.button whileTap={{ scale: 0.97 }} onClick={() => setEditing(false)} style={{ marginTop: 10, border: "none", background: "none", color: SUB, fontWeight: 800, cursor: "pointer", fontSize: 11.5, display: "flex", alignItems: "center", gap: 4 }}><ChevronUp style={{ width: 14, height: 14 }} /> Cancel</motion.button>}
    </Glass>
  );
}

/* ═══ Google Map ═══ */
function loadGMaps(k) {
  return new Promise((res, rej) => {
    if (!k) { rej(new Error("No key")); return; }
    if (window.google?.maps) { res(window.google.maps); return; }
    const ex = document.getElementById("gd-gmaps");
    if (ex) { ex.addEventListener("load", () => res(window.google.maps)); ex.addEventListener("error", rej); return; }
    const s = document.createElement("script"); s.id = "gd-gmaps"; s.src = `https://maps.googleapis.com/maps/api/js?key=${k}`; s.async = true; s.defer = true; s.onload = () => res(window.google.maps); s.onerror = rej; document.body.appendChild(s);
  });
}

function GoogleRouteMap({ currentPoints, recentEndedSessions, selectedMapSessionId, onSelectSession }) {
  const mapRef = useRef(null), mapInst = useRef(null), polyRef = useRef(null), markersRef = useRef([]);
  const [mapsReady, setMapsReady] = useState(false), [mapsFailed, setMapsFailed] = useState(false);
  const selSess = useMemo(() => (!selectedMapSessionId || selectedMapSessionId === "live") ? null : recentEndedSessions.find(s => s._id === selectedMapSessionId) || null, [recentEndedSessions, selectedMapSessionId]);
  const displayPts = useMemo(() => selSess?.points?.length ? selSess.points : currentPoints || [], [currentPoints, selSess]);

  useEffect(() => { let m = true; loadGMaps(GOOGLE_MAPS_KEY).then(() => m && setMapsReady(true)).catch(() => m && setMapsFailed(true)); return () => { m = false; }; }, []);
  useEffect(() => { if (!mapsReady || !mapRef.current || !window.google?.maps || mapInst.current) return; mapInst.current = new window.google.maps.Map(mapRef.current, { center: { lat: 27.18, lng: 78.02 }, zoom: 14, disableDefaultUI: true, zoomControl: true, styles: [{ elementType: "geometry", stylers: [{ color: "#edf5f1" }] }, { featureType: "poi", stylers: [{ visibility: "off" }] }, { featureType: "transit", stylers: [{ visibility: "off" }] }, { featureType: "road", elementType: "geometry", stylers: [{ color: "#d6e6df" }] }, { featureType: "water", elementType: "geometry", stylers: [{ color: "#d7efe6" }] }] }); }, [mapsReady]);

  useEffect(() => {
    if (!mapsReady || !mapInst.current || !window.google?.maps) return;
    const map = mapInst.current, maps = window.google.maps;
    if (polyRef.current) { polyRef.current.setMap(null); polyRef.current = null; }
    markersRef.current.forEach(m => m.setMap(null)); markersRef.current = [];
    if (!displayPts?.length) return;
    const path = displayPts.map(p => ({ lat: Number(p.lat), lng: Number(p.lng) }));
    polyRef.current = new maps.Polyline({ path, geodesic: true, strokeColor: selSess ? MID : DEEP, strokeOpacity: 0.95, strokeWeight: 5, map });
    markersRef.current.push(
      new maps.Marker({ position: path[0], map, title: "Start", icon: { path: maps.SymbolPath.CIRCLE, scale: 6, fillColor: DEEP, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } }),
      new maps.Marker({ position: path[path.length - 1], map, title: selSess ? "End" : "Now", icon: { path: maps.SymbolPath.CIRCLE, scale: 8, fillColor: ACCENT, fillOpacity: 1, strokeColor: DEEP, strokeWeight: 2 } }),
    );
    const bounds = new maps.LatLngBounds(); path.forEach(p => bounds.extend(p)); map.fitBounds(bounds, 40);
    if (path.length === 1) { map.setCenter(path[0]); map.setZoom(16); }
  }, [displayPts, mapsReady, selSess]);

  const tabs = (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 10, paddingBottom: 2 }}>
      {[{ id: "live", label: "Live walk" }, ...recentEndedSessions.slice(0, 5).map((s, i) => ({ id: s._id, label: `Walk ${i + 1}` }))].map(t => (
        <button key={t.id} onClick={() => onSelectSession(t.id)} style={{ cursor: "pointer", whiteSpace: "nowrap", borderRadius: 999, padding: "9px 14px", fontSize: 11.5, fontWeight: 900, background: selectedMapSessionId === t.id ? `linear-gradient(135deg,${DEEP},${MID})` : "#fff", color: selectedMapSessionId === t.id ? "#fff" : TEXT, boxShadow: selectedMapSessionId === t.id ? "0 8px 20px rgba(10,90,59,0.16)" : "0 2px 10px rgba(0,0,0,0.04)", border: selectedMapSessionId === t.id ? "none" : `1px solid ${BORDER}` }}>{t.label}</button>
      ))}
    </div>
  );

  if (!GOOGLE_MAPS_KEY || mapsFailed) return <div><FallbackRouteMap points={displayPts} title={selSess ? "Walk Route" : "Live Route"} badge={selSess ? "History" : "Outdoor"} />{tabs}</div>;

  return (
    <Glass style={{ padding: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 14, background: "rgba(24,226,161,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><MapPinned style={{ width: 17, height: 17, color: DEEP }} /></div>
        <div><div style={{ fontSize: 13, fontWeight: 900, color: TEXT, fontFamily: "'Sora',sans-serif" }}>{selSess ? "Walk Route" : "Live Route"}</div><div style={{ fontSize: 11, color: SUB, fontWeight: 700 }}>{selSess ? "Route replay" : "Real-time GPS"}</div></div>
      </div>
      <div ref={mapRef} style={{ width: "100%", height: 320, borderRadius: 20, overflow: "hidden", border: `1px solid ${BORDER}`, background: "#eef6f2" }} />
      {tabs}
    </Glass>
  );
}

/* ═══════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════ */
export default function StepTracker() {
  const navigate = useNavigate();
  const { user, setUser, token } = useAuth();

  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState("idle");
  const [routePoints, setRoutePoints] = useState([]);
  const [durationSec, setDurationSec] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [steps, setSteps] = useState(0);
  const [calories, setCalories] = useState(null);
  const [pace, setPace] = useState("--");
  const [todaySummary, setTodaySummary] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [starting, setStarting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [liveSource, setLiveSource] = useState("gps+estimate");
  const [selectedMapSessionId, setSelectedMapSessionId] = useState("live");
  const [weightInput, setWeightInput] = useState(String(user?.weightKg || user?.weight || ""));
  const initH = cmToFtIn(user?.heightCm || user?.height || "");
  const [feetInput, setFeetInput] = useState(initH.feet);
  const [inchInput, setInchInput] = useState(initH.inches);
  const [savingMetrics, setSavingMetrics] = useState(false);
  const [permGps, setPermGps] = useState("prompt");
  const [permMotion, setPermMotion] = useState("prompt");

  const watchIdRef = useRef(null), timerRef = useRef(null), pointsBufferRef = useRef([]), lastPointRef = useRef(null);
  const motionEnabledRef = useRef(false), motionHandlerRef = useRef(null);
  const distanceRef = useRef(0), stepsRef = useRef(0), durationRef = useRef(0), caloriesRef = useRef(null), manualStepsRef = useRef(0);

  /* Pedometer state with warmup + consecutive validation */
  const pedoState = useRef({
    phase: "idle",
    lastPeakTs: 0,
    lastMag: 9.81,
    peakVal: 0,
    startedAt: 0,            // when tracking started — for warmup
    consecutiveValid: 0,      // must hit CONSECUTIVE_NEEDED before real counting
    warmupDone: false,
  });

  /* ─── FIX: Disable iOS shake-to-undo ─── */
  useEffect(() => {
    const blockUndo = (e) => { e.preventDefault(); };
    // This meta approach + event prevention stops "Undo Typing" on iOS Safari
    const meta = document.createElement("meta");
    meta.name = "apple-mobile-web-app-capable";
    meta.content = "yes";
    document.head.appendChild(meta);

    window.addEventListener("beforeinput", (e) => {
      if (e.inputType === "historyUndo" || e.inputType === "historyRedo") e.preventDefault();
    });

    return () => {
      if (meta.parentNode) meta.parentNode.removeChild(meta);
    };
  }, []);

  useEffect(() => {
    setWeightInput(String(user?.weightKg || user?.weight || ""));
    const h = cmToFtIn(user?.heightCm || user?.height || "");
    setFeetInput(h.feet); setInchInput(h.inches);
  }, [user?.weightKg, user?.weight, user?.heightCm, user?.height]);

  const weightKg = useMemo(() => { const r = user?.weightKg || user?.weight; return r ? Number(r) : null; }, [user?.weightKg, user?.weight]);
  const heightCm = useMemo(() => { const r = user?.heightCm || user?.height; return r ? Number(r) : null; }, [user?.heightCm, user?.height]);
  const hasWeight = !!weightKg && weightKg > 0, hasHeight = !!heightCm && heightCm > 0;
  const strideM = hasHeight ? Math.max(0.5, heightCm * 0.00415) : 0.78;
  const strideMRef = useRef(strideM), weightKgRef = useRef(weightKg);
  useEffect(() => { strideMRef.current = strideM; }, [strideM]);
  useEffect(() => { weightKgRef.current = weightKg; }, [weightKg]);

  const authHeaders = useMemo(() => { const t = extractToken(token); return t ? { Authorization: `Bearer ${t}` } : {}; }, [token]);

  useEffect(() => {
    if (navigator.permissions) navigator.permissions.query({ name: "geolocation" }).then(r => { setPermGps(r.state); r.onchange = () => setPermGps(r.state); }).catch(() => {});
    if (typeof DeviceMotionEvent === "undefined") setPermMotion("na");
    else if (typeof DeviceMotionEvent.requestPermission !== "function") setPermMotion("granted");
  }, []);

  const requestGps = useCallback(async () => {
    try { await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 })); setPermGps("granted"); setPermissionError(""); } catch { setPermGps("denied"); setPermissionError("Location blocked. Enable in browser settings."); }
  }, []);

  const requestMotion = useCallback(async () => {
    try { if (typeof DeviceMotionEvent?.requestPermission === "function") { const r = await DeviceMotionEvent.requestPermission(); setPermMotion(r === "granted" ? "granted" : "denied"); } else setPermMotion("granted"); } catch { setPermMotion("denied"); }
  }, []);

  const saveMetrics = useCallback(async () => {
    const nW = Number(weightInput), nH = ftInToCm(feetInput, inchInput);
    if (!nW || nW <= 0) { setPermissionError("Enter valid weight."); return; }
    if (!nH || nH <= 0) { setPermissionError("Enter valid height."); return; }
    if (!user?._id) { setPermissionError("User not found."); return; }
    try {
      setSavingMetrics(true); setPermissionError("");
      const p = { ...user, weightKg: nW, weight: nW, heightCm: nH, height: nH, profileCompleted: true };
      await axios.put(`${API}/api/users/${user._id}`, p, { headers: authHeaders });
      if (typeof setUser === "function") setUser(p);
      weightKgRef.current = nW;
      const cal = calcCal({ distanceMeters: distanceRef.current, steps: stepsRef.current, weightKg: nW });
      setCalories(cal); caloriesRef.current = cal;
    } catch (e) { setPermissionError(e?.response?.data?.message || "Unable to save."); }
    finally { setSavingMetrics(false); }
  }, [authHeaders, feetInput, inchInput, setUser, user, weightInput]);

  /* ═══ Pedometer with warmup + consecutive filter ═══ */
  const setupMotion = useCallback(() => {
    if (motionHandlerRef.current) window.removeEventListener("devicemotion", motionHandlerRef.current);
    const handler = (e) => {
      if (!motionEnabledRef.current) return;
      const st = pedoState.current;

      // Warmup: ignore first N seconds
      if (!st.warmupDone) {
        if (Date.now() - st.startedAt < WARMUP_MS) return;
        st.warmupDone = true;
      }

      const hasPure = e.acceleration && (e.acceleration.x !== null || e.acceleration.y !== null);
      const acc = hasPure ? e.acceleration : e.accelerationIncludingGravity;
      if (!acc) return;

      const mag = Math.sqrt((Number(acc.x || 0)) ** 2 + (Number(acc.y || 0)) ** 2 + (Number(acc.z || 0)) ** 2);
      const smoothed = 0.25 * mag + 0.75 * st.lastMag;
      st.lastMag = smoothed;

      const peakT = hasPure ? STEP_PEAK_PURE : STEP_PEAK_GRAVITY;
      const valT = hasPure ? STEP_VALLEY_PURE : STEP_VALLEY_GRAVITY;
      const now = Date.now();

      if (st.phase === "idle") {
        if (smoothed > peakT) { st.phase = "peaked"; st.peakVal = smoothed; }
      } else if (st.phase === "peaked") {
        if (smoothed > st.peakVal) st.peakVal = smoothed;
        if (smoothed < valT) {
          const elapsed = now - st.lastPeakTs;
          st.lastPeakTs = now;
          st.phase = "idle";
          st.peakVal = 0;

          if (elapsed > STEP_MIN_MS && elapsed < STEP_MAX_MS) {
            st.consecutiveValid += 1;

            // Only start counting after CONSECUTIVE_NEEDED valid cycles
            // This filters out single random jolts
            if (st.consecutiveValid >= CONSECUTIVE_NEEDED) {
              // If we just passed the threshold, retroactively add the warmup steps
              if (st.consecutiveValid === CONSECUTIVE_NEEDED) {
                manualStepsRef.current += CONSECUTIVE_NEEDED;
              } else {
                manualStepsRef.current += 1;
              }

              const d = distanceRef.current, str = strideMRef.current, w = weightKgRef.current;
              const ns = calcSteps(d, manualStepsRef.current, str);
              stepsRef.current = ns; setSteps(ns);
              if (w > 0) { const c = calcCal({ distanceMeters: d, steps: ns, weightKg: w }); caloriesRef.current = c; setCalories(c); }
            }
          } else {
            // Invalid interval — reset consecutive counter
            st.consecutiveValid = 0;
          }
        }
      }
    };
    motionHandlerRef.current = handler;
    window.addEventListener("devicemotion", handler);
  }, []);

  const refreshHistory = useCallback(async () => {
    if (!Object.keys(authHeaders).length) { setTodaySummary(null); setRecentSessions([]); return; }
    setLoadingHistory(true);
    try {
      const [sR, ssR] = await Promise.all([axios.get(`${API}/api/step-tracker/summary/today`, { headers: authHeaders }), axios.get(`${API}/api/step-tracker/sessions`, { headers: authHeaders })]);
      setTodaySummary(sR.data || null); setRecentSessions(Array.isArray(ssR.data?.sessions) ? ssR.data.sessions : []);
    } catch { setTodaySummary(null); setRecentSessions([]); } finally { setLoadingHistory(false); }
  }, [authHeaders]);

  useEffect(() => { refreshHistory(); }, [refreshHistory]);
  useEffect(() => () => {
    if (watchIdRef.current !== null) navigator.geolocation?.clearWatch(watchIdRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (motionHandlerRef.current) window.removeEventListener("devicemotion", motionHandlerRef.current);
  }, []);

  const flushPts = useCallback(async (extra = {}) => {
    if (!sessionId) return;
    const batch = [...pointsBufferRef.current]; if (!batch.length && !Object.keys(extra).length) return;
    pointsBufferRef.current = []; setSyncing(true);
    try { await axios.post(`${API}/api/step-tracker/sessions/${sessionId}/points`, { points: batch, steps: stepsRef.current, distanceMeters: distanceRef.current, caloriesKcal: caloriesRef.current, durationSec: durationRef.current, ...extra }, { headers: authHeaders }); }
    catch { pointsBufferRef.current = [...batch, ...pointsBufferRef.current]; }
    finally { setSyncing(false); }
  }, [authHeaders, sessionId]);

  const enableMotion = useCallback(async () => {
    try {
      if (typeof DeviceMotionEvent?.requestPermission === "function") { const r = await DeviceMotionEvent.requestPermission(); if (r !== "granted") { setPermMotion("denied"); return false; } }
      motionEnabledRef.current = true; setPermMotion("granted"); setupMotion(); return true;
    } catch { return false; }
  }, [setupMotion]);

  const startGps = useCallback(() => {
    if (!navigator.geolocation) { setPermissionError("Geolocation not supported."); return; }
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    watchIdRef.current = navigator.geolocation.watchPosition(pos => {
      const acc = pos.coords.accuracy; if (acc > MAX_ACCURACY_METERS) return;
      const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: acc, speed: pos.coords.speed ?? 0, heading: pos.coords.heading ?? null, recordedAt: new Date().toISOString(), source: "gps" };
      setRoutePoints(prev => [...prev, pt].slice(-1500));
      pointsBufferRef.current.push(pt);
      if (lastPointRef.current) {
        const delta = haversineMeters(lastPointRef.current, pt);
        const combAcc = (acc + (lastPointRef.current.accuracy || 0)) / 2;
        const minD = Math.max(MIN_DISTANCE_DELTA, combAcc * 0.5);
        if (delta > minD && delta < MAX_DISTANCE_DELTA) {
          const nd = distanceRef.current + delta; distanceRef.current = nd; setDistanceMeters(nd);
          const ns = calcSteps(nd, manualStepsRef.current, strideMRef.current); stepsRef.current = ns; setSteps(ns);
          const cal = calcCal({ distanceMeters: nd, steps: ns, weightKg: weightKgRef.current }); caloriesRef.current = cal; setCalories(cal);
          setPace(calcPace(durationRef.current, nd));
        }
      }
      lastPointRef.current = pt;
    }, () => { setPermGps("denied"); setPermissionError("Location denied. Enable in settings."); }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
  }, []);

  const beginTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => { durationRef.current += 1; setDurationSec(durationRef.current); if (distanceRef.current > 0) setPace(calcPace(durationRef.current, distanceRef.current)); }, 1000);
  }, []);

  const stopAll = useCallback(() => {
    if (watchIdRef.current !== null) { navigator.geolocation?.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (motionHandlerRef.current) window.removeEventListener("devicemotion", motionHandlerRef.current);
    motionEnabledRef.current = false;
  }, []);

  const handleStart = useCallback(async () => {
    setStarting(true); setPermissionError("");
    try {
      const motionOk = await enableMotion(); setLiveSource(motionOk ? "gps+pedometer" : "gps+estimate");
      const cur = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }));
      setPermGps("granted");
      const sp = { lat: cur.coords.latitude, lng: cur.coords.longitude, accuracy: cur.coords.accuracy };
      const r = await axios.post(`${API}/api/step-tracker/start`, { startLocation: sp, device: { platform: navigator.platform, userAgent: navigator.userAgent } }, { headers: authHeaders });
      setSessionId(r.data?.session?._id); setStatus("tracking"); setSelectedMapSessionId("live");
      setRoutePoints([{ ...sp, recordedAt: new Date().toISOString(), speed: 0, heading: null, source: "gps" }]);
      lastPointRef.current = sp; manualStepsRef.current = 0;
      durationRef.current = 0; distanceRef.current = 0; stepsRef.current = 0; caloriesRef.current = hasWeight ? 0 : null;

      // Reset pedometer with warmup
      pedoState.current = { phase: "idle", lastPeakTs: 0, lastMag: 9.81, peakVal: 0, startedAt: Date.now(), consecutiveValid: 0, warmupDone: false };

      setDurationSec(0); setDistanceMeters(0); setSteps(0); setCalories(hasWeight ? 0 : null); setPace("--");
      beginTimer(); startGps();
    } catch (e) {
      if (e?.code === 1) { setPermGps("denied"); setPermissionError("Location denied. Enable in browser settings."); }
      else setPermissionError(e?.response?.data?.message || e?.message || "Unable to start.");
    } finally { setStarting(false); }
  }, [authHeaders, beginTimer, enableMotion, hasWeight, startGps]);

  const handlePause = useCallback(async () => { if (!sessionId) return; stopAll(); await flushPts(); try { await axios.patch(`${API}/api/step-tracker/sessions/${sessionId}/pause`, {}, { headers: authHeaders }); } catch {} setStatus("paused"); }, [authHeaders, flushPts, sessionId, stopAll]);

  const handleResume = useCallback(async () => {
    if (!sessionId) return;
    try { await axios.patch(`${API}/api/step-tracker/sessions/${sessionId}/resume`, {}, { headers: authHeaders }); } catch {}
    // Reset warmup on resume too
    pedoState.current.startedAt = Date.now();
    pedoState.current.warmupDone = false;
    pedoState.current.consecutiveValid = 0;
    await enableMotion(); beginTimer(); startGps();
    setStatus("tracking"); setSelectedMapSessionId("live");
  }, [authHeaders, beginTimer, enableMotion, sessionId, startGps]);

  const handleEnd = useCallback(async () => {
    if (!sessionId) return; stopAll(); await flushPts();
    try { const el = routePoints.length > 0 ? { lat: routePoints[routePoints.length - 1].lat, lng: routePoints[routePoints.length - 1].lng, accuracy: routePoints[routePoints.length - 1].accuracy } : null; await axios.patch(`${API}/api/step-tracker/sessions/${sessionId}/end`, { endLocation: el, steps: stepsRef.current, distanceMeters: distanceRef.current, caloriesKcal: caloriesRef.current, durationSec: durationRef.current }, { headers: authHeaders }); } catch {}
    setStatus("ended"); setSessionId(null); await refreshHistory();
  }, [authHeaders, flushPts, refreshHistory, routePoints, sessionId, stopAll]);

  useEffect(() => { if (status !== "tracking" || !sessionId) return; const t = setInterval(() => flushPts(), 12000); return () => clearInterval(t); }, [flushPts, sessionId, status]);

  const endedWithPts = useMemo(() => recentSessions.filter(s => s.status === "ended" && s.points?.length > 1).slice(0, 5), [recentSessions]);
  const todaySteps = Number(todaySummary?.steps || 0) + (status === "tracking" || status === "paused" ? steps : 0);
  const todayDist = Number(todaySummary?.distanceMeters || 0) + (status === "tracking" || status === "paused" ? distanceMeters : 0);
  const todayCal = hasWeight ? Number(todaySummary?.caloriesKcal || 0) + (status === "tracking" || status === "paused" ? Number(calories || 0) : 0) : null;
  const stepGoal = 10000, goalPct = Math.min(100, Math.round((todaySteps / stepGoal) * 100));

  return (
    <div style={{ minHeight: "100vh", width: "100%", maxWidth: 520, margin: "0 auto", background: `linear-gradient(180deg,${BG_TOP} 0%,${BG_MID} 48%,${BG_BOT} 100%)`, position: "relative", overflowX: "hidden", fontFamily: "'Plus Jakarta Sans',sans-serif", paddingBottom: 40 }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at top right, rgba(24,226,161,0.08), transparent 26%), radial-gradient(circle at bottom left, rgba(15,122,83,0.05), transparent 30%)" }} />

      {/* Sticky Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, padding: "14px 18px 16px", backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", background: "linear-gradient(180deg, rgba(244,251,248,0.94), rgba(244,251,248,0.82))", borderBottom: "1px solid rgba(12,90,62,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <motion.button whileTap={{ scale: 0.92 }} onClick={() => navigate("/home")} style={{ width: 44, height: 44, borderRadius: 16, background: GLASS, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 12px 28px rgba(16,24,40,0.04)", flexShrink: 0 }}><ArrowLeft style={{ width: 18, height: 18, color: TEXT }} /></motion.button>
          <div style={{ flex: 1 }}><div style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 1000, color: TEXT }}>Step Tracker</div><div style={{ fontSize: 12, color: SUB, fontWeight: 700, marginTop: 4 }}>GoDavaii Health OS</div></div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 999, background: status === "tracking" ? "rgba(24,226,161,0.15)" : GLASS, border: `1px solid ${status === "tracking" ? "rgba(24,226,161,0.35)" : BORDER}` }}>
            {status === "tracking" && <span style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENT, animation: "pulse 1.5s ease-in-out infinite" }} />}
            <span style={{ fontSize: 10.5, fontWeight: 900, color: status === "tracking" ? DEEP : TEXT }}>{status === "tracking" ? "LIVE" : status === "paused" ? "PAUSED" : "READY"}</span>
          </div>
        </div>

        <Glass style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: SUB, fontWeight: 800, marginBottom: 5 }}>Today goal</div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 24, fontWeight: 1000, color: TEXT, marginBottom: 6 }}>{todaySteps.toLocaleString()} <span style={{ fontSize: 14, color: SUB, fontWeight: 800 }}>/ {stepGoal.toLocaleString()}</span></div>
              <div style={{ fontSize: 11.5, color: "#82938D", fontWeight: 700 }}>{metersToKm(todayDist)} km · {hasWeight ? `${Math.round(todayCal || 0)} kcal` : "add weight for kcal"}</div>
            </div>
            <div style={{ minWidth: 72, height: 72, borderRadius: "50%", background: `conic-gradient(${DEEP} 0 ${goalPct}%, rgba(24,226,161,0.12) ${goalPct}% 100%)`, display: "grid", placeItems: "center" }}><div style={{ width: 56, height: 56, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 1000, color: TEXT, fontFamily: "'Sora',sans-serif" }}>{goalPct}%</div></div>
          </div>
        </Glass>

        <Glass style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
            <div><div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 1000, color: TEXT }}>Control Center</div><div style={{ fontSize: 11.5, color: SUB, fontWeight: 700, marginTop: 3 }}>Manage your walk</div></div>
            {syncing && <div style={{ fontSize: 10.5, fontWeight: 900, color: DEEP, background: "rgba(24,226,161,0.10)", padding: "6px 10px", borderRadius: 999 }}>Syncing...</div>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[
              { label: starting ? "Starting..." : "Start", icon: Play, onClick: handleStart, disabled: starting || status === "tracking" || status === "paused", active: status === "idle" || status === "ended", gradient: true },
              { label: status === "paused" ? "Resume" : "Pause", icon: status === "paused" ? Play : Pause, onClick: status === "paused" ? handleResume : handlePause, disabled: status !== "tracking" && status !== "paused" },
              { label: "End", icon: Square, onClick: handleEnd, disabled: status !== "tracking" && status !== "paused", danger: true },
            ].map(b => (
              <motion.button key={b.label} whileTap={{ scale: 0.96 }} onClick={b.onClick} disabled={b.disabled} style={{
                height: 54, borderRadius: 16, border: b.danger ? "1px solid rgba(239,68,68,0.16)" : b.gradient && b.active ? "none" : "1px solid rgba(12,90,62,0.10)",
                background: b.danger ? "#FFF5F5" : b.gradient && b.active ? `linear-gradient(135deg,${DEEP},${MID})` : b.disabled ? "#E2E8F0" : "#fff",
                color: b.danger && !b.disabled ? "#B91C1C" : b.gradient && b.active ? "#fff" : b.disabled ? "#94A3B8" : TEXT,
                fontWeight: 1000, fontFamily: "'Sora',sans-serif", cursor: b.disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: b.gradient && b.active ? "0 10px 24px rgba(10,90,59,0.18)" : "none",
              }}><b.icon style={{ width: b.danger ? 14 : 16, height: b.danger ? 14 : 16 }} /> {b.label}</motion.button>
            ))}
          </div>
        </Glass>
      </div>

      {/* Content */}
      <div style={{ padding: "18px 18px 0", position: "relative", zIndex: 1 }}>
        <PermissionBanner permGps={permGps} permMotion={permMotion} onRequestGps={requestGps} onRequestMotion={requestMotion} />
        <BodyMetricsCard weightInput={weightInput} setWeightInput={setWeightInput} feetInput={feetInput} setFeetInput={setFeetInput} inchInput={inchInput} setInchInput={setInchInput} savingMetrics={savingMetrics} onSave={saveMetrics} hasWeight={hasWeight} hasHeight={hasHeight} />

        {permissionError && <Glass style={{ padding: 14, marginBottom: 16, border: "1px solid #FECACA", background: "#FFF8F6" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><AlertTriangle style={{ width: 16, height: 16, color: "#DC2626", flexShrink: 0 }} /><div style={{ fontSize: 12, color: "#991B1B", fontWeight: 700 }}>{permissionError}</div></div></Glass>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 18 }}>
          <StatCard icon={Footprints} label="Steps" value={steps.toLocaleString()} helper={`Source: ${liveSource}`} accent={status === "tracking"} />
          <StatCard icon={Route} label="Distance" value={`${metersToKm(distanceMeters)} km`} helper="GPS route distance" />
          <StatCard icon={Flame} label="Calories" value={hasWeight ? `${Math.round(calories || 0)} kcal` : "--"} helper={hasWeight ? `Based on ${weightKg} kg` : "Save weight above"} />
          <StatCard icon={Gauge} label="Pace" value={pace} helper="Avg pace this session" />
          <StatCard icon={Clock3} label="Duration" value={formatDuration(durationSec)} helper="Active time" />
          <StatCard icon={Activity} label="Status" value={status === "idle" ? "Ready" : status === "tracking" ? "Tracking" : status === "paused" ? "Paused" : "Completed"} helper="Session state" />
        </div>

        <div style={{ marginBottom: 18 }}>
          <GoogleRouteMap currentPoints={routePoints} recentEndedSessions={endedWithPts} selectedMapSessionId={selectedMapSessionId} onSelectSession={setSelectedMapSessionId} />
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 1000, color: TEXT }}>Walk History</div>
            <button onClick={refreshHistory} style={{ background: "none", border: "none", color: DEEP, fontWeight: 900, cursor: "pointer", fontSize: 12.5 }}>Refresh</button>
          </div>
          {loadingHistory ? <Glass style={{ padding: 16 }}><div style={{ fontSize: 13, color: SUB, fontWeight: 800 }}>Loading...</div></Glass> : recentSessions.length ? (
            <div style={{ display: "grid", gap: 10 }}>{recentSessions.slice(0, 8).map(s => <SessionCard key={s._id} session={s} onOpenMap={session => { setSelectedMapSessionId(session._id); window.scrollTo({ top: 0, behavior: "smooth" }); }} />)}</div>
          ) : <Glass style={{ padding: 16 }}><div style={{ fontSize: 13, fontWeight: 900, color: TEXT, marginBottom: 4 }}>No sessions yet</div><div style={{ fontSize: 11.5, color: SUB, fontWeight: 700 }}>Start your first walk above.</div></Glass>}
        </div>
        <div style={{ height: 12 }} />
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}`}</style>
    </div>
  );
}