import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const PERIODS = [
  { key: "daily", label: "Today" },
  { key: "weekly", label: "This Week" },
  { key: "monthly", label: "This Month" },
];

export default function PharmacySettlementTab({ token, pharmacyId }) {
  const [period, setPeriod] = useState("daily");
  const [summary, setSummary] = useState(null);
  const [payments, setPayments] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("overview");

  const headers = useMemo(
  () => ({
    Authorization: `Bearer ${token}`,
    pharmacyid: pharmacyId || "",
  }),
  [token, pharmacyId]
);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [settleRes, perfRes] = await Promise.all([
        fetch(`${API}/api/settlements/pharmacy/summary?period=${period}`, { headers }),
        fetch(`${API}/api/settlements/pharmacy/performance`, { headers }),
      ]);
      const settleData = await settleRes.json();
      const perfData = await perfRes.json();
      if (settleData.ok) { setSummary(settleData.summary); setPayments(settleData.payments || []); }
      if (perfData.ok) setPerformance(perfData.performance);
    } catch (err) { console.error("Settlement fetch error:", err); }
    setLoading(false);
  }, [period, headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const ScoreRing = ({ score, size = 120 }) => {
    const r = size / 2 - 8;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 90 ? "#00D97E" : score >= 70 ? "#F59E0B" : "#EF4444";
    return (
      <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute transform -rotate-90">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
          <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={circumference} strokeDashoffset={circumference}
            animate={{ strokeDashoffset: offset }} transition={{ duration: 1.5, ease: "easeOut" }} strokeLinecap="round" />
        </svg>
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Score</span>
      </div>
    );
  };

  const StatCard = ({ label, value, prefix = "", icon, trend, color = "#00D97E" }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl p-4"
      style={{ background: "linear-gradient(135deg, rgba(12,90,62,0.08) 0%, rgba(0,217,126,0.04) 100%)", border: "1px solid rgba(12,90,62,0.12)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <span className="text-xs text-gray-400">{prefix}</span>
      <span className="text-2xl font-bold" style={{ color: "#0C5A3E" }}>{typeof value === "number" ? value.toLocaleString("en-IN") : value}</span>
      {trend && <div className={`mt-1 text-xs font-medium ${trend === "improving" ? "text-green-500" : "text-red-400"}`}>
        {trend === "improving" ? "Improving" : "Needs attention"}
      </div>}
      <div className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full opacity-10" style={{ background: color }} />
    </motion.div>
  );

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-10 h-10 rounded-full border-[3px] border-t-[#00D97E] border-r-transparent border-b-transparent border-l-transparent" />
    </div>
  );

  return (
    <div className="space-y-6 pb-24">
      {/* Period Selector */}
      <div className="flex gap-2">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${period === p.key ? "text-white shadow-lg" : "text-gray-500 bg-white/60"}`}
            style={period === p.key ? { background: "linear-gradient(135deg, #0C5A3E, #0E7A4F)" } : {}}>
            {p.label}
          </button>
        ))}
      </div>

      {/* View Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "rgba(12,90,62,0.06)" }}>
        {[{ key: "overview", label: "Overview" }, { key: "transactions", label: "Transactions" }, { key: "performance", label: "Performance" }].map(v => (
          <button key={v.key} onClick={() => setActiveView(v.key)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${activeView === v.key ? "bg-white shadow-md text-[#0C5A3E]" : "text-gray-500"}`}>
            {v.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeView === "overview" && summary && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="relative overflow-hidden rounded-3xl p-6 text-white"
              style={{ background: "linear-gradient(135deg, #0C5A3E 0%, #0E7A4F 50%, #00D97E 100%)" }}>
              <div className="relative z-10">
                <p className="text-sm opacity-80 mb-1">Net Payout ({PERIODS.find(p => p.key === period)?.label})</p>
                <p className="text-4xl font-bold tracking-tight">{"\u20B9"}{summary.netPayout?.toLocaleString("en-IN") || 0}</p>
                <div className="flex gap-4 mt-4 text-sm opacity-80">
                  <span>{summary.totalOrders || 0} orders</span>
                  <span>{"\u20B9"}{summary.totalRevenue?.toLocaleString("en-IN") || 0} revenue</span>
                </div>
              </div>
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
            </motion.div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Your Payout" value={summary.totalPayout || 0} prefix={"\u20B9"} icon="💵" />
              <StatCard label="Platform Fee" value={summary.totalCommission || 0} prefix={"\u20B9"} icon="🏢" color="#F59E0B" />
              <StatCard label="Delivery Fees" value={summary.totalDeliveryFee || 0} prefix={"\u20B9"} icon="🚗" color="#3B82F6" />
              <StatCard label="Penalties" value={summary.totalPenalty || 0} prefix={"\u20B9"} icon="⚠️" color="#EF4444" />
            </div>

            <div className="rounded-2xl p-4 bg-white/80 border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Settlement Status</h3>
              <div className="space-y-2">
                {[{ label: "Paid", count: summary.paidCount || 0, color: "#00D97E" },
                  { label: "Pending", count: summary.pendingCount || 0, color: "#F59E0B" },
                  { label: "Settled", count: summary.settledCount || 0, color: "#3B82F6" }
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      <span className="text-sm text-gray-600">{s.label}</span>
                    </div>
                    <span className="text-sm font-semibold">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeView === "transactions" && (
          <motion.div key="transactions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {payments.length === 0 ? (
              <div className="text-center py-12 text-gray-400"><p>No transactions for this period</p></div>
            ) : payments.map((p, i) => (
              <motion.div key={p._id || i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="rounded-2xl p-4 bg-white/80 border border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-gray-400 font-mono">#{p.orderId?.toString().slice(-8)}</p>
                    <p className="text-sm font-medium text-gray-700 mt-1">{p.orderItems?.map(i => i.name).join(", ").slice(0, 60) || "Order items"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[#0C5A3E]">{"\u20B9"}{p.pharmacyAmount || 0}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      p.paymentStatus === "paid" || p.paymentStatus === "settled" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}>{p.paymentStatus?.toUpperCase()}</span>
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-400">
                  <span>Total: {"\u20B9"}{p.orderTotal}</span>
                  <span>{p.paymentMethod?.toUpperCase()}</span>
                  <span>{new Date(p.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {activeView === "performance" && performance && (
          <motion.div key="performance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="rounded-3xl p-6 text-center relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, rgba(12,90,62,0.04), rgba(0,217,126,0.08))" }}>
              <ScoreRing score={performance.overallScore} size={140} />
              <p className="text-lg font-bold mt-2 text-[#0C5A3E]">{performance.badge}</p>
              <p className="text-xs text-gray-400 mt-1">Last {performance.periodDays} days</p>
              <div className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-medium ${
                performance.trend === "improving" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>{performance.trend === "improving" ? "Trending Up" : "Needs Improvement"}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Acceptance Rate" value={`${performance.acceptanceRate}%`} icon="✅" />
              <StatCard label="Fill Rate" value={`${performance.fillRate}%`} icon="📦" />
              <StatCard label="Avg Response" value={`${performance.avgResponseMinutes} min`} icon="⚡" />
              <StatCard label="Avg Pack Time" value={`${performance.avgPackMinutes} min`} icon="📋" />
              <StatCard label="Total Orders" value={performance.totalOrders} icon="🛒" />
              <StatCard label="Delivered" value={performance.deliveredCount} icon="✔️" />
              <StatCard label="Incidents" value={performance.incidentCount} icon="⚠️" color="#EF4444" />
              <StatCard label="Recent Fill Rate" value={`${performance.recentFillRate}%`} icon="📊" trend={performance.trend} />
            </div>

            <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">Tips to improve score</h4>
              <ul className="text-xs text-blue-700 space-y-1.5">
                {performance.acceptanceRate < 90 && <li>Accept orders within 30 seconds for higher acceptance rate</li>}
                {performance.avgPackMinutes > 8 && <li>Keep medicines pre-sorted for faster packing (target: under 8 min)</li>}
                {performance.incidentCount > 0 && <li>Double-check medicines before handover to reduce incidents</li>}
                {performance.fillRate < 85 && <li>Keep your inventory updated to avoid stock-false-positives</li>}
                {performance.overallScore >= 85 && <li>Great job! Maintain this score for priority order routing</li>}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
