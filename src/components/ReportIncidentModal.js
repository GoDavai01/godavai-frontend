import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const CATEGORIES = [
  { key: "wrong_medicine", label: "Wrong Medicine", icon: "💊", desc: "Received incorrect medicine" },
  { key: "expired_medicine", label: "Expired Medicine", icon: "⏰", desc: "Medicine past expiry date" },
  { key: "damaged_package", label: "Damaged Package", icon: "📦", desc: "Package arrived damaged" },
  { key: "missing_item", label: "Missing Item", icon: "❓", desc: "Item missing from order" },
  { key: "wrong_quantity", label: "Wrong Quantity", icon: "🔢", desc: "Incorrect quantity received" },
  { key: "delay", label: "Delivery Delay", icon: "🕐", desc: "Order took too long" },
  { key: "quality_concern", label: "Quality Concern", icon: "⚠️", desc: "Concern about medicine quality" },
  { key: "payment_issue", label: "Payment Issue", icon: "💳", desc: "Charged incorrectly" },
  { key: "delivery_issue", label: "Delivery Issue", icon: "🚗", desc: "Problem with delivery" },
  { key: "substitute_issue", label: "Substitute Issue", icon: "🔄", desc: "Issue with substitute medicine" },
  { key: "other", label: "Other", icon: "📌", desc: "Something else" },
];

export default function ReportIncidentModal({ open, onClose, orderId, token }) {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!category || !title || !description) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/incidents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, category, severity, title, description }),
      });
      const data = await res.json();
      if (data.ok) setStep(3);
      else alert(data.error || "Failed to report");
    } catch { alert("Failed to submit report"); }
    setSubmitting(false);
  };

  const reset = () => { setStep(1); setCategory(""); setSeverity("medium"); setTitle(""); setDescription(""); };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
        onClick={e => { if (e.target === e.currentTarget) { onClose(); reset(); } }}>
        <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
          className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto"
          style={{ boxShadow: "0 -4px 40px rgba(0,0,0,0.15)" }}>
          {/* Header */}
          <div className="sticky top-0 bg-white/90 backdrop-blur-lg rounded-t-3xl px-6 py-4 border-b border-gray-100 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#0C5A3E]">Report an Issue</h3>
                <p className="text-xs text-gray-400">We'll resolve this quickly</p>
              </div>
              <button onClick={() => { onClose(); reset(); }} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">✕</button>
            </div>
            <div className="flex gap-1 mt-3">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex-1 h-1 rounded-full overflow-hidden bg-gray-100">
                  <motion.div className="h-full rounded-full" style={{ background: "#00D97E" }}
                    initial={{ width: "0%" }} animate={{ width: step >= s ? "100%" : "0%" }} transition={{ duration: 0.3 }} />
                </div>
              ))}
            </div>
          </div>

          <div className="p-6">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <p className="text-sm font-medium text-gray-700 mb-4">What went wrong?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map(cat => (
                      <button key={cat.key} onClick={() => { setCategory(cat.key); setTitle(cat.label); setStep(2); }}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl text-center transition-all border ${
                          category === cat.key ? "border-[#0C5A3E] bg-[#0C5A3E]/5 shadow-md" : "border-gray-100 bg-white hover:border-gray-200"}`}>
                        <span className="text-2xl">{cat.icon}</span>
                        <span className="text-xs font-medium text-gray-700">{cat.label}</span>
                        <span className="text-[10px] text-gray-400 line-clamp-1">{cat.desc}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{CATEGORIES.find(c => c.key === category)?.icon}</span>
                    <span className="text-sm font-semibold text-gray-700">{CATEGORIES.find(c => c.key === category)?.label}</span>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">How serious is this?</label>
                    <div className="flex gap-2">
                      {[{ key: "low", label: "Low", color: "#6B7280" }, { key: "medium", label: "Medium", color: "#F59E0B" }, { key: "high", label: "High", color: "#EF4444" }].map(s => (
                        <button key={s.key} onClick={() => setSeverity(s.key)}
                          className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                            severity === s.key ? "text-white shadow" : "text-gray-500 bg-white"}`}
                          style={severity === s.key ? { background: s.color, borderColor: s.color } : { borderColor: "#E5E7EB" }}>{s.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Short title</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Wrong medicine delivered"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0C5A3E]/20" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Describe the issue</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell us what happened..." rows={4}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0C5A3E]/20" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setStep(1)} className="px-6 py-3 rounded-xl text-sm font-medium text-gray-500 bg-gray-100">Back</button>
                    <button onClick={handleSubmit} disabled={!title || !description || submitting}
                      className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #0C5A3E, #00D97E)" }}>
                      {submitting ? "Submitting..." : "Submit Report"}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="s3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}
                    className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-4xl">✅</span>
                  </motion.div>
                  <h3 className="text-lg font-bold text-[#0C5A3E]">Report Submitted</h3>
                  <p className="text-sm text-gray-500 mt-1">We'll investigate and get back to you soon</p>
                  <button onClick={() => { onClose(); reset(); }}
                    className="mt-6 px-8 py-3 rounded-xl text-sm font-medium text-white"
                    style={{ background: "linear-gradient(135deg, #0C5A3E, #00D97E)" }}>Done</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
