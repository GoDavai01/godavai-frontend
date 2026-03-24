import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const CATEGORIES = [
  { key: "wrong_medicine", label: "Wrong Medicine", icon: "💊", color: "#EF4444" },
  { key: "expired_medicine", label: "Expired Medicine", icon: "⏰", color: "#DC2626" },
  { key: "damaged_package", label: "Damaged Package", icon: "📦", color: "#F59E0B" },
  { key: "missing_item", label: "Missing Item", icon: "❓", color: "#8B5CF6" },
  { key: "wrong_quantity", label: "Wrong Quantity", icon: "🔢", color: "#F97316" },
  { key: "delay", label: "Delivery Delay", icon: "🕐", color: "#6366F1" },
  { key: "stock_false_positive", label: "Stock False Positive", icon: "📊", color: "#EC4899" },
  { key: "cancellation_dispute", label: "Cancellation Dispute", icon: "🚫", color: "#78716C" },
  { key: "delivery_issue", label: "Delivery Issue", icon: "🚗", color: "#0EA5E9" },
  { key: "payment_issue", label: "Payment Issue", icon: "💳", color: "#14B8A6" },
  { key: "quality_concern", label: "Quality Concern", icon: "⚠️", color: "#EAB308" },
  { key: "prescription_mismatch", label: "Rx Mismatch", icon: "📋", color: "#A855F7" },
  { key: "substitute_issue", label: "Substitute Issue", icon: "🔄", color: "#F43F5E" },
  { key: "other", label: "Other", icon: "📌", color: "#6B7280" },
];

const SEVERITY_CONFIG = {
  critical: { color: "#EF4444", bg: "#FEE2E2", label: "CRITICAL" },
  high: { color: "#F97316", bg: "#FFF7ED", label: "HIGH" },
  medium: { color: "#F59E0B", bg: "#FEF3C7", label: "MEDIUM" },
  low: { color: "#6B7280", bg: "#F3F4F6", label: "LOW" },
};

const STATUS_OPTIONS = [
  { key: "open", label: "Open", color: "#EF4444" },
  { key: "investigating", label: "Investigating", color: "#F59E0B" },
  { key: "action_taken", label: "Action Taken", color: "#3B82F6" },
  { key: "resolved", label: "Resolved", color: "#00D97E" },
  { key: "escalated", label: "Escalated", color: "#8B5CF6" },
  { key: "closed", label: "Closed", color: "#6B7280" },
];

const RESOLUTION_ACTIONS = [
  { key: "refund", label: "Refund" }, { key: "replacement", label: "Replacement" },
  { key: "credit", label: "Credit" }, { key: "warning", label: "Warning" },
  { key: "penalty", label: "Penalty" }, { key: "no_action", label: "No Action" },
  { key: "other", label: "Other" },
];

export default function AdminIncidentManager({ token }) {
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: "", category: "", severity: "" });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [resolveForm, setResolveForm] = useState({});
  const [view, setView] = useState("list");

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (filter.status) params.append("status", filter.status);
      if (filter.category) params.append("category", filter.category);
      if (filter.severity) params.append("severity", filter.severity);
      const [incRes, statsRes] = await Promise.all([
        fetch(`${API}/api/incidents/admin/all?${params}`, { headers }),
        fetch(`${API}/api/incidents/admin/stats`, { headers }),
      ]);
      const incData = await incRes.json();
      const statsData = await statsRes.json();
      if (incData.ok) { setIncidents(incData.incidents || []); setTotal(incData.total || 0); }
      if (statsData.ok) setStats(statsData.stats);
    } catch (err) { console.error("Incident fetch error:", err); }
    setLoading(false);
  }, [page, filter, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleResolve = async (incidentId) => {
    const form = resolveForm[incidentId];
    if (!form?.status) return alert("Select a status");
    try {
      const body = { status: form.status, note: form.note || "" };
      if (["resolved", "closed"].includes(form.status)) {
        body.resolution = {
          action: form.action || "no_action", note: form.resolutionNote || "",
          pharmacyPenalty: parseFloat(form.pharmacyPenalty) || 0,
          refundAmount: parseFloat(form.refundAmount) || 0,
        };
      }
      await fetch(`${API}/api/incidents/admin/${incidentId}`, { method: "PATCH", headers, body: JSON.stringify(body) });
      setResolveForm(prev => { const n = { ...prev }; delete n[incidentId]; return n; });
      setExpandedId(null);
      fetchData();
    } catch { alert("Failed to update"); }
  };

  const uf = (id, field, value) => setResolveForm(p => ({ ...p, [id]: { ...p[id], [field]: value } }));

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#0C5A3E]">Incident Manager</h2>
          <p className="text-xs text-gray-400">Track, resolve & prevent issues</p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-gray-100">
          {[{ key: "list", label: "List" }, { key: "stats", label: "Stats" }].map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === v.key ? "bg-white shadow text-[#0C5A3E]" : "text-gray-400"}`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-2">
          {[{ label: "Open", value: stats.totalOpen, color: "#EF4444" },
            { label: "Resolved", value: stats.totalResolved, color: "#00D97E" },
            { label: "SLA Breached", value: stats.slaBreached, color: "#F59E0B" },
            { label: "Avg Resolution", value: `${stats.avgResolutionHours}h`, color: "#3B82F6" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: `${s.color}10`, border: `1px solid ${s.color}20` }}>
              <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] text-gray-500 uppercase">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {view === "stats" && stats ? (
          <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="rounded-2xl p-4 bg-white/80 border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">By Category</h3>
              <div className="space-y-2">
                {stats.byCategory?.map(c => {
                  const cat = CATEGORIES.find(x => x.key === c.category) || { icon: "📌", label: c.category, color: "#6B7280" };
                  const maxCount = Math.max(...stats.byCategory.map(x => x.count), 1);
                  return (
                    <div key={c.category} className="flex items-center gap-2">
                      <span className="w-5 text-center">{cat.icon}</span>
                      <span className="text-xs text-gray-600 w-28 truncate">{cat.label}</span>
                      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(c.count / maxCount) * 100}%` }}
                          className="h-full rounded-full" style={{ background: cat.color }} />
                      </div>
                      <span className="text-xs font-semibold w-8 text-right">{c.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-2xl p-4 bg-white/80 border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">By Severity</h3>
              <div className="grid grid-cols-4 gap-2">
                {["critical", "high", "medium", "low"].map(sev => (
                  <div key={sev} className="text-center rounded-xl p-3" style={{ background: SEVERITY_CONFIG[sev].bg }}>
                    <p className="text-xl font-bold" style={{ color: SEVERITY_CONFIG[sev].color }}>{stats.bySeverity?.[sev] || 0}</p>
                    <p className="text-[10px] uppercase font-medium" style={{ color: SEVERITY_CONFIG[sev].color }}>{SEVERITY_CONFIG[sev].label}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : view === "list" ? (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <select value={filter.status} onChange={e => { setFilter(f => ({ ...f, status: e.target.value })); setPage(1); }}
                className="text-xs rounded-xl border border-gray-200 px-3 py-2 bg-white/80 text-gray-600">
                <option value="">All Status</option>
                {STATUS_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <select value={filter.severity} onChange={e => { setFilter(f => ({ ...f, severity: e.target.value })); setPage(1); }}
                className="text-xs rounded-xl border border-gray-200 px-3 py-2 bg-white/80 text-gray-600">
                <option value="">All Severity</option>
                {["critical", "high", "medium", "low"].map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
              <select value={filter.category} onChange={e => { setFilter(f => ({ ...f, category: e.target.value })); setPage(1); }}
                className="text-xs rounded-xl border border-gray-200 px-3 py-2 bg-white/80 text-gray-600">
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>

            {loading ? (
              <div className="text-center py-16"><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="inline-block w-8 h-8 rounded-full border-2 border-t-[#00D97E] border-r-transparent border-b-transparent border-l-transparent" /></div>
            ) : incidents.length === 0 ? (
              <div className="text-center py-16 text-gray-400"><p className="text-sm">No incidents found</p></div>
            ) : incidents.map((inc, i) => {
              const cat = CATEGORIES.find(c => c.key === inc.category) || { icon: "📌", label: inc.category, color: "#6B7280" };
              const sev = SEVERITY_CONFIG[inc.severity] || SEVERITY_CONFIG.medium;
              const statusOpt = STATUS_OPTIONS.find(s => s.key === inc.status) || STATUS_OPTIONS[0];
              const isExp = expandedId === inc._id;
              const isSlaBreached = inc.slaDeadline && new Date(inc.slaDeadline) < new Date() && !["resolved", "closed"].includes(inc.status);

              return (
                <motion.div key={inc._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className={`rounded-2xl bg-white/90 backdrop-blur border overflow-hidden shadow-sm ${isSlaBreached ? "border-red-200" : "border-gray-100"}`}>
                  <div className="p-4 cursor-pointer" onClick={() => setExpandedId(isExp ? null : inc._id)}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: `${cat.color}15` }}>{cat.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${inc.severity === "critical" ? "animate-pulse" : ""}`}
                            style={{ background: sev.bg, color: sev.color }}>{sev.label}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ background: `${statusOpt.color}15`, color: statusOpt.color }}>{statusOpt.label}</span>
                          {isSlaBreached && <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 font-medium animate-pulse">SLA BREACHED</span>}
                        </div>
                        <p className="text-sm font-medium text-gray-800 line-clamp-1">{inc.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                          <span>{inc.reportedBy?.name || "User"}</span>
                          {inc.pharmacyId?.name && <span>{inc.pharmacyId.name}</span>}
                          <span>{new Date(inc.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExp && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
                          <p className="text-xs text-gray-600">{inc.description}</p>
                          {inc.timeline?.length > 0 && (
                            <div>
                              <span className="text-xs text-gray-400 block mb-1">Timeline:</span>
                              {inc.timeline.map((t, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                  <span className="text-gray-500">{t.note}</span>
                                  <span className="text-gray-300 ml-auto">{new Date(t.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {!["resolved", "closed"].includes(inc.status) && (
                            <div className="rounded-xl p-3 bg-gray-50 space-y-2">
                              <span className="text-xs font-semibold text-gray-600">Take Action:</span>
                              <select value={resolveForm[inc._id]?.status || ""} onChange={e => uf(inc._id, "status", e.target.value)}
                                className="w-full text-xs rounded-lg border px-3 py-2">
                                <option value="">Select Status</option>
                                {STATUS_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                              </select>
                              {["resolved", "closed"].includes(resolveForm[inc._id]?.status) && (
                                <>
                                  <select value={resolveForm[inc._id]?.action || ""} onChange={e => uf(inc._id, "action", e.target.value)}
                                    className="w-full text-xs rounded-lg border px-3 py-2">
                                    <option value="">Resolution Action</option>
                                    {RESOLUTION_ACTIONS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                                  </select>
                                  <div className="grid grid-cols-2 gap-2">
                                    <input type="number" placeholder="Refund amount" value={resolveForm[inc._id]?.refundAmount || ""}
                                      onChange={e => uf(inc._id, "refundAmount", e.target.value)} className="text-xs rounded-lg border px-3 py-2" />
                                    <input type="number" placeholder="Penalty amount" value={resolveForm[inc._id]?.pharmacyPenalty || ""}
                                      onChange={e => uf(inc._id, "pharmacyPenalty", e.target.value)} className="text-xs rounded-lg border px-3 py-2" />
                                  </div>
                                </>
                              )}
                              <textarea placeholder="Note..." rows={2} value={resolveForm[inc._id]?.note || ""}
                                onChange={e => uf(inc._id, "note", e.target.value)} className="w-full text-xs rounded-lg border px-3 py-2 resize-none" />
                              <button onClick={() => handleResolve(inc._id)}
                                className="w-full py-2.5 rounded-xl text-xs font-semibold text-white"
                                style={{ background: "linear-gradient(135deg, #0C5A3E, #0E7A4F)" }}>Submit Resolution</button>
                            </div>
                          )}

                          {inc.resolution?.action && (
                            <div className="rounded-xl p-3 bg-green-50 border border-green-100">
                              <span className="text-xs font-semibold text-green-700 block mb-1">Resolution:</span>
                              <p className="text-xs text-green-600">Action: {inc.resolution.action}</p>
                              {inc.resolution.note && <p className="text-xs text-green-600">Note: {inc.resolution.note}</p>}
                              {inc.resolution.refundAmount > 0 && <p className="text-xs text-green-600">Refund: {"\u20B9"}{inc.resolution.refundAmount}</p>}
                              {inc.resolution.pharmacyPenalty > 0 && <p className="text-xs text-red-500">Penalty: {"\u20B9"}{inc.resolution.pharmacyPenalty}</p>}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {total > 30 && (
              <div className="flex justify-center gap-3 pt-4">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 rounded-xl text-sm bg-white border disabled:opacity-40">Prev</button>
                <span className="px-4 py-2 text-sm text-gray-500">{page} / {Math.ceil(total / 30)}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page * 30 >= total} className="px-4 py-2 rounded-xl text-sm bg-white border disabled:opacity-40">Next</button>
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
