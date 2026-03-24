import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const TABS = [
  { key: "active", label: "Active", color: "#00D97E" },
  { key: "unassigned", label: "Unassigned", color: "#EF4444" },
  { key: "pending_pharmacy", label: "Pending Pharmacy", color: "#F59E0B" },
  { key: "timed_out", label: "Timed Out", color: "#EF4444" },
  { key: "rerouted", label: "Rerouted", color: "#8B5CF6" },
  { key: "exceptions", label: "Exceptions", color: "#EF4444" },
  { key: "packing", label: "Packing", color: "#3B82F6" },
  { key: "delivered", label: "Delivered", color: "#00D97E" },
  { key: "cancelled", label: "Cancelled", color: "#6B7280" },
  { key: "all", label: "All", color: "#0C5A3E" },
];

const STATUS_COLORS = {
  pending: { bg: "#FEF3C7", text: "#92400E", label: "Pending" },
  processing: { bg: "#DBEAFE", text: "#1E40AF", label: "Processing" },
  assigned: { bg: "#E0E7FF", text: "#3730A3", label: "Assigned" },
  accepted: { bg: "#D1FAE5", text: "#065F46", label: "Accepted" },
  picked_up: { bg: "#CFFAFE", text: "#155E75", label: "Picked Up" },
  out_for_delivery: { bg: "#FDE68A", text: "#78350F", label: "Out for Delivery" },
  delivered: { bg: "#D1FAE5", text: "#065F46", label: "Delivered" },
  cancelled: { bg: "#FEE2E2", text: "#991B1B", label: "Cancelled" },
  rejected: { bg: "#FEE2E2", text: "#991B1B", label: "Rejected" },
  placed: { bg: "#F3F4F6", text: "#374151", label: "Placed" },
  quoted: { bg: "#E0E7FF", text: "#3730A3", label: "Quoted" },
};

export default function AdminControlTower({ token }) {
  const [activeTab, setActiveTab] = useState("active");
  const [orders, setOrders] = useState([]);
  const [tabCounts, setTabCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [expandedOrder, setExpandedOrder] = useState(null);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tab: activeTab, page, limit: 30 });
      if (search.trim()) params.append("search", search.trim());
      const res = await fetch(`${API}/api/orders/admin/control-tower?${params}`, { headers });
      const data = await res.json();
      if (data.ok) {
        setOrders(data.orders || []);
        setTabCounts(data.tabCounts || {});
        setTotal(data.total || 0);
      }
    } catch (err) { console.error("Control tower fetch error:", err); }
    setLoading(false);
  }, [activeTab, page, search, token]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { const iv = setInterval(fetchOrders, 15000); return () => clearInterval(iv); }, [fetchOrders]);

  const handleManualAssign = async (orderId) => {
    const pid = prompt("Enter Pharmacy ID to assign:");
    if (!pid) return;
    try {
      const res = await fetch(`${API}/api/orders/${orderId}/assign-delivery-partner`, {
        method: "PATCH", headers, body: JSON.stringify({ pharmacyId: pid }),
      });
      const data = await res.json();
      if (data.ok || data.order) { alert("Assigned!"); fetchOrders(); }
      else alert(data.error || "Failed");
    } catch { alert("Error assigning"); }
  };

  const handleForceReroute = async (orderId) => {
    if (!window.confirm("Force reroute this order?")) return;
    try {
      await fetch(`${API}/api/orders/${orderId}/auto-assign`, { method: "POST", headers });
      fetchOrders();
    } catch { alert("Reroute failed"); }
  };

  const formatTime = (date) => {
    if (!date) return "—";
    const diff = Math.floor((Date.now() - new Date(date)) / 60000);
    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#0C5A3E]">Order Control Tower</h2>
          <p className="text-xs text-gray-400">Real-time order monitoring - Auto-refreshes every 15s</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-gray-500">LIVE</span>
        </div>
      </div>

      <div className="relative">
        <input type="text" placeholder="Search by order ID or medicine name..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur text-sm focus:outline-none focus:ring-2 focus:ring-[#0C5A3E]/20" />
        <span className="absolute left-3.5 top-3.5 text-gray-400">🔍</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {TABS.map(tab => {
          const count = tabCounts[tab.key] || 0;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); setPage(1); }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                isActive ? "text-white shadow-lg" : "text-gray-500 bg-white/60 border border-gray-100"
              }`} style={isActive ? { background: `linear-gradient(135deg, ${tab.color}, ${tab.color}dd)` } : {}}>
              <span>{tab.label}</span>
              {count > 0 && <span className={`min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                isActive ? "bg-white/30 text-white" : "bg-gray-100 text-gray-600"}`}>{count > 99 ? "99+" : count}</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 rounded-full border-[3px] border-t-[#00D97E] border-r-transparent border-b-transparent border-l-transparent" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><p className="text-sm">No orders in this category</p></div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {orders.map((order, i) => {
              const si = STATUS_COLORS[order.status] || STATUS_COLORS.placed;
              const isExp = expandedOrder === order._id;
              return (
                <motion.div key={order._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }} className="rounded-2xl bg-white/90 backdrop-blur border border-gray-100 overflow-hidden shadow-sm">
                  <div className="p-4 cursor-pointer" onClick={() => setExpandedOrder(isExp ? null : order._id)}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-mono text-gray-400">#{order._id?.slice(-8)}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: si.bg, color: si.text }}>{si.label}</span>
                          {order.sourceType === "prescription" && <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700 font-medium">Rx</span>}
                          {order.isTimedOut && <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 font-medium animate-pulse">TIMED OUT</span>}
                          {order.isPackSlaBreached && <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-100 text-orange-700 font-medium">PACK DELAYED</span>}
                        </div>
                        <p className="text-sm font-medium text-gray-800 line-clamp-1">{order.items?.map(i => i.name).join(", ") || "—"}</p>
                      </div>
                      <div className="text-right ml-3">
                        <p className="text-lg font-bold text-[#0C5A3E]">{"\u20B9"}{order.total || 0}</p>
                        <p className="text-[10px] text-gray-400">{formatTime(order.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>{order.userId?.name || "User"}</span>
                      {order.pharmacy && <span>{order.pharmacy?.name || "Pharmacy"}</span>}
                      {order.deliveryPartner && <span>{order.deliveryPartner?.name || "Rider"}</span>}
                      {order.routingAttempts > 1 && <span className="text-orange-500 font-medium">{order.routingAttempts} attempts</span>}
                      {order.estimatedPayout && <span className="text-green-600">{"\u20B9"}{order.estimatedPayout}</span>}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExp && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">Internal:</span>
                            <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">{order.internalStatus || "—"}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400 block mb-1">Items:</span>
                            {order.items?.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-xs py-1">
                                <span className="text-gray-700">{item.name} x {item.quantity}</span>
                                <span className="text-gray-500">{"\u20B9"}{item.price}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2 pt-2">
                            {!order.pharmacy && <button onClick={() => handleManualAssign(order._id)}
                              className="flex-1 py-2 rounded-xl text-xs font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 shadow">Assign Pharmacy</button>}
                            {(order.isTimedOut || order.status === "pending") && <button onClick={() => handleForceReroute(order._id)}
                              className="flex-1 py-2 rounded-xl text-xs font-medium text-white bg-gradient-to-r from-orange-500 to-orange-600 shadow">Force Reroute</button>}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {total > 30 && (
            <div className="flex justify-center gap-3 pt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-4 py-2 rounded-xl text-sm bg-white border disabled:opacity-40">Prev</button>
              <span className="px-4 py-2 text-sm text-gray-500">{page} / {Math.ceil(total / 30)}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 30 >= total}
                className="px-4 py-2 rounded-xl text-sm bg-white border disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
