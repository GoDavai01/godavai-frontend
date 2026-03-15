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
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const DEEP = "#0A5A3B";
const MID = "#0F7A53";
const BG_TOP = "#F4FBF8";
const BG_MID = "#EEF8F4";
const BG_BOT = "#F7FAFF";
const GLASS = "rgba(255,255,255,0.92)";
const BORDER = "rgba(12,90,62,0.08)";
const TEXT = "#10231A";
const SUB = "#6A7A73";

function Glass({ children, style }) {
  return (
    <div
      style={{
        background: GLASS,
        border: `1px solid ${BORDER}`,
        borderRadius: 24,
        boxShadow: "0 16px 34px rgba(16,24,40,0.05)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function formatDuration(totalSec = 0) {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function metersToKm(m = 0) {
  return (Number(m || 0) / 1000).toFixed(2);
}

function haversineMeters(a, b) {
  if (!a || !b) return 0;
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function calculateEstimatedSteps(distanceMeters = 0, manualSteps = 0) {
  const distanceBasedSteps = Math.round(Number(distanceMeters || 0) / 0.78);
  return Math.max(Number(manualSteps || 0), distanceBasedSteps, 0);
}

function calculateCalories({ distanceMeters = 0, steps = 0, weightKg = 70 }) {
  const distanceKm = Number(distanceMeters || 0) / 1000;
  const byDistance = distanceKm * Number(weightKg || 70) * 0.75;
  const bySteps = Number(steps || 0) * 0.04;
  return Math.round(Math.max(byDistance, bySteps, 0));
}

function calculatePace(durationSec = 0, distanceMeters = 0) {
  const km = Number(distanceMeters || 0) / 1000;
  if (!km || km <= 0) return "--";
  const minPerKm = durationSec / 60 / km;
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}:${String(sec).padStart(2, "0")} /km`;
}

function normalizePointsForPath(points, width = 320, height = 180, pad = 14) {
  if (!points || points.length < 2) return "";
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latRange = maxLat - minLat || 0.0001;
  const lngRange = maxLng - minLng || 0.0001;

  return points
    .map((p) => {
      const x = pad + ((p.lng - minLng) / lngRange) * (width - pad * 2);
      const y = height - pad - ((p.lat - minLat) / latRange) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
}

function MiniRouteMap({ points }) {
  const poly = normalizePointsForPath(points);
  const hasRoute = points && points.length >= 2;

  return (
    <Glass style={{ padding: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 14,
              background: "rgba(24,226,161,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MapPinned style={{ width: 17, height: 17, color: DEEP }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: TEXT, fontFamily: "'Sora',sans-serif" }}>
              Live Route
            </div>
            <div style={{ fontSize: 11, color: SUB, fontWeight: 700 }}>Start → path → end</div>
          </div>
        </div>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 900,
            color: DEEP,
            background: "rgba(24,226,161,0.10)",
            padding: "6px 10px",
            borderRadius: 999,
          }}
        >
          Outdoor
        </div>
      </div>

      <div
        style={{
          width: "100%",
          height: 190,
          borderRadius: 20,
          background:
            "radial-gradient(circle at top right, rgba(24,226,161,0.12), transparent 26%), linear-gradient(180deg,#F8FCFA 0%,#EEF8F4 100%)",
          border: `1px solid ${BORDER}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 320 190" preserveAspectRatio="none">
          <defs>
            <linearGradient id="routeGradient" x1="0%" x2="100%">
              <stop offset="0%" stopColor="#0A5A3B" />
              <stop offset="100%" stopColor="#18E2A1" />
            </linearGradient>
          </defs>

          {hasRoute ? (
            <>
              <polyline
                points={poly}
                fill="none"
                stroke="url(#routeGradient)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.95"
              />
              <circle cx={poly.split(" ")[0].split(",")[0]} cy={poly.split(" ")[0].split(",")[1]} r="6" fill="#0A5A3B" />
              {(() => {
                const last = poly.split(" ").slice(-1)[0].split(",");
                return <circle cx={last[0]} cy={last[1]} r="7" fill="#18E2A1" stroke="#0A5A3B" strokeWidth="2" />;
              })()}
            </>
          ) : (
            <text x="160" y="95" textAnchor="middle" fill="#8AA39A" fontSize="13" fontWeight="700">
              Start a walk to see your live route
            </text>
          )}
        </svg>
      </div>
    </Glass>
  );
}

function StatCard({ icon: Icon, label, value, helper }) {
  return (
    <Glass style={{ padding: 14, minHeight: 118 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 15,
          background: "rgba(24,226,161,0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <Icon style={{ width: 17, height: 17, color: DEEP }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, color: SUB, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 1000, color: TEXT, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#8A9A94", lineHeight: 1.4 }}>{helper}</div>
    </Glass>
  );
}

function SessionCard({ session }) {
  return (
    <Glass style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 900, color: TEXT }}>
            {new Date(session.startedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </div>
          <div style={{ fontSize: 11, color: SUB, fontWeight: 700, marginTop: 2 }}>
            {new Date(session.startedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 900,
            color: session.status === "ended" ? DEEP : "#C2410C",
            background: session.status === "ended" ? "rgba(24,226,161,0.10)" : "#FFF7ED",
            padding: "6px 10px",
            borderRadius: 999,
          }}
        >
          {session.status === "ended" ? "Completed" : "Active"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        <div>
          <div style={{ fontSize: 10.5, color: SUB, fontWeight: 700 }}>Steps</div>
          <div style={{ fontSize: 13.5, color: TEXT, fontWeight: 1000, fontFamily: "'Sora',sans-serif" }}>
            {Number(session.stats?.steps || 0).toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: SUB, fontWeight: 700 }}>Distance</div>
          <div style={{ fontSize: 13.5, color: TEXT, fontWeight: 1000, fontFamily: "'Sora',sans-serif" }}>
            {metersToKm(session.stats?.distanceMeters)} km
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: SUB, fontWeight: 700 }}>Calories</div>
          <div style={{ fontSize: 13.5, color: TEXT, fontWeight: 1000, fontFamily: "'Sora',sans-serif" }}>
            {Math.round(session.stats?.caloriesKcal || 0)} kcal
          </div>
        </div>
      </div>
    </Glass>
  );
}

export default function StepTracker() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState("idle");
  const [routePoints, setRoutePoints] = useState([]);
  const [durationSec, setDurationSec] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [steps, setSteps] = useState(0);
  const [calories, setCalories] = useState(0);
  const [pace, setPace] = useState("--");
  const [todaySummary, setTodaySummary] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [starting, setStarting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [liveSource, setLiveSource] = useState("gps+estimate");

  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  const pointsBufferRef = useRef([]);
  const lastPointRef = useRef(null);
  const manualMotionStepsRef = useRef(0);
  const motionEnabledRef = useRef(false);
  const lastMotionPeakTsRef = useRef(0);

  const weightKg = Number(user?.weightKg || user?.weight || 70);

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const handleDeviceMotion = useCallback(
    (e) => {
      if (!motionEnabledRef.current) return;
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;

      const x = Number(acc.x || 0);
      const y = Number(acc.y || 0);
      const z = Number(acc.z || 0);

      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();

      if (magnitude > 12.2 && now - lastMotionPeakTsRef.current > 360) {
        lastMotionPeakTsRef.current = now;
        manualMotionStepsRef.current += 1;
        setSteps((prev) =>
          Math.max(prev + 1, calculateEstimatedSteps(distanceMeters, manualMotionStepsRef.current))
        );
      }
    },
    [distanceMeters]
  );

  const refreshHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const [summaryRes, sessionsRes] = await Promise.all([
        axios.get(`${API}/api/step-tracker/summary/today`, { headers: authHeaders }),
        axios.get(`${API}/api/step-tracker/sessions`, { headers: authHeaders }),
      ]);
      setTodaySummary(summaryRes.data || null);
      setRecentSessions(Array.isArray(sessionsRes.data?.sessions) ? sessionsRes.data.sessions : []);
    } catch {
      setTodaySummary(null);
      setRecentSessions([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener("devicemotion", handleDeviceMotion);
    };
  }, [handleDeviceMotion]);

  const flushPoints = useCallback(
    async (extra = {}) => {
      if (!sessionId) return;
      const batch = [...pointsBufferRef.current];
      if (!batch.length && !Object.keys(extra).length) return;

      pointsBufferRef.current = [];
      setSyncing(true);
      try {
        await axios.post(
          `${API}/api/step-tracker/sessions/${sessionId}/points`,
          {
            points: batch,
            steps,
            distanceMeters,
            caloriesKcal: calories,
            durationSec,
            ...extra,
          },
          { headers: authHeaders }
        );
      } catch {
        pointsBufferRef.current = [...batch, ...pointsBufferRef.current];
      } finally {
        setSyncing(false);
      }
    },
    [authHeaders, calories, distanceMeters, durationSec, sessionId, steps]
  );

  const recomputeLiveMetrics = useCallback(
    (nextDistance, explicitSteps = null) => {
      const computedSteps = calculateEstimatedSteps(nextDistance, explicitSteps ?? manualMotionStepsRef.current);
      const nextCalories = calculateCalories({ distanceMeters: nextDistance, steps: computedSteps, weightKg });
      setSteps(computedSteps);
      setCalories(nextCalories);
      setPace(calculatePace(durationSec, nextDistance));
    },
    [durationSec, weightKg]
  );

  const enableMotionTracking = useCallback(async () => {
    try {
      if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
        const result = await DeviceMotionEvent.requestPermission();
        if (result !== "granted") return false;
      }
      motionEnabledRef.current = true;
      window.addEventListener("devicemotion", handleDeviceMotion);
      return true;
    } catch {
      return false;
    }
  }, [handleDeviceMotion]);

  const startGpsWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setPermissionError("Geolocation is not supported on this device/browser.");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed ?? 0,
          heading: pos.coords.heading ?? null,
          recordedAt: new Date().toISOString(),
          source: "gps",
        };

        setRoutePoints((prev) => {
          const next = [...prev, point];
          return next.slice(-1500);
        });

        pointsBufferRef.current.push(point);

        if (lastPointRef.current) {
          const delta = haversineMeters(lastPointRef.current, point);
          if (delta > 1 && delta < 120) {
            setDistanceMeters((prev) => {
              const nextDistance = prev + delta;
              recomputeLiveMetrics(nextDistance);
              return nextDistance;
            });
          }
        }

        lastPointRef.current = point;
      },
      (err) => {
        setPermissionError(err?.message || "Unable to access live location.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2500,
        timeout: 12000,
      }
    );
  }, [recomputeLiveMetrics]);

  const beginTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDurationSec((prev) => prev + 1);
    }, 1000);
  }, []);

  useEffect(() => {
    setPace(calculatePace(durationSec, distanceMeters));
  }, [distanceMeters, durationSec]);

  const handleStart = useCallback(async () => {
    setStarting(true);
    setPermissionError("");

    try {
      const motionOk = await enableMotionTracking();
      if (motionOk) setLiveSource("gps+motion");
      else setLiveSource("gps+estimate");

      const current = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        });
      });

      const startPoint = {
        lat: current.coords.latitude,
        lng: current.coords.longitude,
        accuracy: current.coords.accuracy,
      };

      const res = await axios.post(
        `${API}/api/step-tracker/start`,
        {
          startLocation: startPoint,
          device: {
            platform: navigator.platform,
            userAgent: navigator.userAgent,
          },
        },
        { headers: authHeaders }
      );

      const id = res.data?.session?._id;
      setSessionId(id);
      setStatus("tracking");
      setRoutePoints([
        {
          ...startPoint,
          recordedAt: new Date().toISOString(),
          speed: 0,
          heading: null,
          source: "gps",
        },
      ]);
      lastPointRef.current = startPoint;
      manualMotionStepsRef.current = 0;
      setDurationSec(0);
      setDistanceMeters(0);
      setSteps(0);
      setCalories(0);

      beginTimer();
      startGpsWatch();
    } catch (err) {
      setPermissionError(err?.message || "Unable to start tracking.");
    } finally {
      setStarting(false);
    }
  }, [authHeaders, beginTimer, enableMotionTracking, startGpsWatch]);

  const handlePause = useCallback(async () => {
    if (!sessionId) return;

    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    window.removeEventListener("devicemotion", handleDeviceMotion);
    motionEnabledRef.current = false;

    await flushPoints();

    try {
      await axios.patch(`${API}/api/step-tracker/sessions/${sessionId}/pause`, {}, { headers: authHeaders });
    } catch {}

    setStatus("paused");
  }, [authHeaders, flushPoints, handleDeviceMotion, sessionId]);

  const handleResume = useCallback(async () => {
    if (!sessionId) return;

    try {
      await axios.patch(`${API}/api/step-tracker/sessions/${sessionId}/resume`, {}, { headers: authHeaders });
    } catch {}

    await enableMotionTracking();
    beginTimer();
    startGpsWatch();
    setStatus("tracking");
  }, [authHeaders, beginTimer, enableMotionTracking, sessionId, startGpsWatch]);

  const handleEnd = useCallback(async () => {
    if (!sessionId) return;

    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    window.removeEventListener("devicemotion", handleDeviceMotion);
    motionEnabledRef.current = false;

    await flushPoints();

    try {
      const endLocation =
        routePoints.length > 0
          ? {
              lat: routePoints[routePoints.length - 1].lat,
              lng: routePoints[routePoints.length - 1].lng,
              accuracy: routePoints[routePoints.length - 1].accuracy,
            }
          : null;

      await axios.patch(
        `${API}/api/step-tracker/sessions/${sessionId}/end`,
        {
          endLocation,
          steps,
          distanceMeters,
          caloriesKcal: calories,
          durationSec,
        },
        { headers: authHeaders }
      );
    } catch {}

    setStatus("ended");
    setSessionId(null);
    await refreshHistory();
  }, [
    authHeaders,
    calories,
    distanceMeters,
    durationSec,
    flushPoints,
    handleDeviceMotion,
    refreshHistory,
    routePoints,
    sessionId,
    steps,
  ]);

  useEffect(() => {
    if (status !== "tracking" || !sessionId) return;
    const t = setInterval(() => {
      flushPoints();
    }, 12000);
    return () => clearInterval(t);
  }, [flushPoints, sessionId, status]);

  const todaySteps = Number(todaySummary?.steps || 0) + (status === "tracking" || status === "paused" ? steps : 0);
  const todayDistance =
    Number(todaySummary?.distanceMeters || 0) + (status === "tracking" || status === "paused" ? distanceMeters : 0);
  const todayCalories =
    Number(todaySummary?.caloriesKcal || 0) + (status === "tracking" || status === "paused" ? calories : 0);
  const stepGoal = 10000;
  const goalPct = Math.min(100, Math.round((todaySteps / stepGoal) * 100));

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        maxWidth: 520,
        margin: "0 auto",
        background: `linear-gradient(180deg,${BG_TOP} 0%,${BG_MID} 48%,${BG_BOT} 100%)`,
        position: "relative",
        overflowX: "hidden",
        fontFamily: "'Plus Jakarta Sans',sans-serif",
        paddingBottom: 120,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at top right, rgba(24,226,161,0.08), transparent 26%), radial-gradient(circle at bottom left, rgba(15,122,83,0.05), transparent 30%)",
        }}
      />

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          padding: "14px 18px 16px",
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
          background: "linear-gradient(180deg, rgba(244,251,248,0.94), rgba(244,251,248,0.82))",
          borderBottom: "1px solid rgba(12,90,62,0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate("/home")}
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              background: GLASS,
              border: `1px solid ${BORDER}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 12px 28px rgba(16,24,40,0.04)",
              flexShrink: 0,
            }}
          >
            <ArrowLeft style={{ width: 18, height: 18, color: TEXT }} />
          </motion.button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 1000, color: TEXT, lineHeight: 1.16 }}>
              Step Tracker
            </div>
            <div style={{ fontSize: 12, color: SUB, fontWeight: 700, marginTop: 4 }}>
              Premium outdoor walk tracking for GoDavaii Health OS
            </div>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 999,
              background: GLASS,
              border: `1px solid ${BORDER}`,
            }}
          >
            <ShieldCheck style={{ width: 13, height: 13, color: DEEP }} />
            <span style={{ fontSize: 10.5, fontWeight: 900, color: TEXT }}>Live</span>
          </div>
        </div>

        <Glass style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: SUB, fontWeight: 800, marginBottom: 5 }}>Today goal</div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 24, fontWeight: 1000, color: TEXT, marginBottom: 6 }}>
                {todaySteps.toLocaleString()} / {stepGoal.toLocaleString()}
              </div>
              <div style={{ fontSize: 11.5, color: "#82938D", fontWeight: 700 }}>
                Distance {metersToKm(todayDistance)} km · {Math.round(todayCalories)} kcal
              </div>
            </div>
            <div
              style={{
                minWidth: 72,
                height: 72,
                borderRadius: "50%",
                background: `conic-gradient(${DEEP} 0 ${goalPct}%, rgba(24,226,161,0.12) ${goalPct}% 100%)`,
                display: "grid",
                placeItems: "center",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  fontWeight: 1000,
                  color: TEXT,
                  fontFamily: "'Sora',sans-serif",
                }}
              >
                {goalPct}%
              </div>
            </div>
          </div>
        </Glass>
      </div>

      <div style={{ padding: "18px 18px 0", position: "relative", zIndex: 1 }}>
        {permissionError ? (
          <Glass style={{ padding: 14, marginBottom: 16, border: "1px solid #FECACA", background: "#FFF8F6" }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#991B1B", marginBottom: 4 }}>Permission issue</div>
            <div style={{ fontSize: 12, color: "#B45309", fontWeight: 700 }}>{permissionError}</div>
          </Glass>
        ) : null}

        <div style={{ marginBottom: 18 }}>
          <MiniRouteMap points={routePoints} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 18 }}>
          <StatCard icon={Footprints} label="Steps" value={steps.toLocaleString()} helper={`Source: ${liveSource}`} />
          <StatCard icon={Route} label="Distance" value={`${metersToKm(distanceMeters)} km`} helper="Live outdoor route distance" />
          <StatCard icon={Flame} label="Calories" value={`${Math.round(calories)} kcal`} helper={`Based on ${weightKg} kg estimate`} />
          <StatCard icon={Gauge} label="Pace" value={pace} helper="Average pace for current session" />
          <StatCard icon={Clock3} label="Duration" value={formatDuration(durationSec)} helper="Walk session timer" />
          <StatCard
            icon={Activity}
            label="Status"
            value={status === "idle" ? "Ready" : status === "tracking" ? "Tracking" : status === "paused" ? "Paused" : "Completed"}
            helper="Live session mode"
          />
        </div>

        <Glass style={{ padding: 14, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 1000, color: TEXT }}>Control Center</div>
              <div style={{ fontSize: 11.5, color: SUB, fontWeight: 700, marginTop: 3 }}>
                Start, pause, resume, and end your premium walking session
              </div>
            </div>
            {syncing ? (
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 900,
                  color: DEEP,
                  background: "rgba(24,226,161,0.10)",
                  padding: "6px 10px",
                  borderRadius: 999,
                }}
              >
                Syncing...
              </div>
            ) : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleStart}
              disabled={starting || status === "tracking" || status === "paused"}
              style={{
                height: 54,
                borderRadius: 16,
                border: "none",
                background: status === "idle" || status === "ended" ? `linear-gradient(135deg,${DEEP},${MID})` : "#E2E8F0",
                color: status === "idle" || status === "ended" ? "#fff" : "#94A3B8",
                fontWeight: 1000,
                fontFamily: "'Sora',sans-serif",
                cursor: starting || status === "tracking" || status === "paused" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: status === "idle" || status === "ended" ? "0 10px 24px rgba(10,90,59,0.18)" : "none",
              }}
            >
              <Play style={{ width: 16, height: 16 }} /> {starting ? "Starting..." : "Start"}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={status === "paused" ? handleResume : handlePause}
              disabled={status !== "tracking" && status !== "paused"}
              style={{
                height: 54,
                borderRadius: 16,
                border: "1px solid rgba(12,90,62,0.10)",
                background: "#fff",
                color: status === "tracking" || status === "paused" ? TEXT : "#94A3B8",
                fontWeight: 1000,
                fontFamily: "'Sora',sans-serif",
                cursor: status !== "tracking" && status !== "paused" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {status === "paused" ? <Play style={{ width: 16, height: 16 }} /> : <Pause style={{ width: 16, height: 16 }} />}
              {status === "paused" ? "Resume" : "Pause"}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleEnd}
              disabled={status !== "tracking" && status !== "paused"}
              style={{
                height: 54,
                borderRadius: 16,
                border: "1px solid rgba(239,68,68,0.16)",
                background: "#FFF5F5",
                color: status === "tracking" || status === "paused" ? "#B91C1C" : "#D1D5DB",
                fontWeight: 1000,
                fontFamily: "'Sora',sans-serif",
                cursor: status !== "tracking" && status !== "paused" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Square style={{ width: 14, height: 14 }} /> End
            </motion.button>
          </div>
        </Glass>

        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 1000, color: TEXT }}>
              Recent Walk Sessions
            </div>
            <button
              onClick={refreshHistory}
              style={{ background: "none", border: "none", color: DEEP, fontWeight: 900, cursor: "pointer", fontSize: 12.5 }}
            >
              Refresh
            </button>
          </div>

          {loadingHistory ? (
            <Glass style={{ padding: 16 }}>
              <div style={{ fontSize: 13, color: SUB, fontWeight: 800 }}>Loading sessions...</div>
            </Glass>
          ) : recentSessions.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {recentSessions.map((s) => (
                <SessionCard key={s._id} session={s} />
              ))}
            </div>
          ) : (
            <Glass style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: TEXT, marginBottom: 4 }}>No sessions yet</div>
              <div style={{ fontSize: 11.5, color: SUB, fontWeight: 700 }}>
                Start your first premium walk session from above.
              </div>
            </Glass>
          )}
        </div>

        <Glass style={{ padding: 14, marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 16,
                background: "rgba(24,226,161,0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ChevronRight style={{ width: 18, height: 18, color: DEEP }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: TEXT }}>Launch-ready note</div>
              <div style={{ fontSize: 11.5, color: SUB, fontWeight: 700, lineHeight: 1.5 }}>
                GPS route, duration, distance, estimated steps, and calories are fully supported here. On native Android/iOS later,
                you can enhance this same product with Health Connect / HealthKit pedometer sync.
              </div>
            </div>
          </div>
        </Glass>
      </div>
    </div>
  );
}