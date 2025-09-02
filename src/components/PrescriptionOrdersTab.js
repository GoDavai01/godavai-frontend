// src/components/PrescriptionOrdersTab.js
import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Card, CardContent, Button, Stack, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select, Snackbar, Alert
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import axios from "axios";
import RxAiSideBySideDialog from "./RxAiSideBySideDialog";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

/**
 * ---- THEME (matches Pharmacy Dashboard) ----
 * White cards, subtle borders, brand-green accents, bold headings.
 */
const BRAND_GREEN = "#0f7a5a";
const BRAND_GREEN_DARK = "#0c644a";
const SURFACE = "#ffffff";
const SURFACE_SOFT = "#f6faf8";
const BORDER = "#e6ebe9";
const TEXT_PRIMARY = "#102a26";
const TEXT_SECONDARY = "#5b6b66";

// Helper: returns seconds left from now to expiry
function getSecondsLeft(expiry) {
  if (!expiry) return 0;
  const t = Math.floor((new Date(expiry) - new Date()) / 1000);
  return t > 0 ? t : 0;
}

/* ============================
   Validation (updated)
   Allow (Composition OR Brand) for available items
============================ */
function isPartialQuoteValid(quote) {
  if (!Array.isArray(quote) || !quote.length) return false;
  return quote.every(row =>
    row.available === false
      ? (!!row.medicineName || !!row.brand)          // mark what's unavailable
      : ((!!row.medicineName || !!row.brand) &&      // Composition OR Brand
         !!row.quantity && !!row.price)
  );
}

export default function PrescriptionOrdersTab({ token, medicines }) {
  const [orders, setOrders] = useState([]);
  const [timers, setTimers] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [quote, setQuote] = useState([
    { medicineName: "", brand: "", price: "", quantity: "", available: true }
  ]);
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const [pharmacyMeds, setPharmacyMeds] = useState([]);
  const [quoteMode, setQuoteMode] = useState(""); // "accept" or "partial"
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [acceptDialogData, setAcceptDialogData] = useState([]); // [{ medicineName, quantity, brand, price }]

  // Quick Add dialog state
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAdd, setQuickAdd] = useState({ brand: "", composition: "", company: "" });
  function openQuickAddDialog({ brandPrefill = "", compositionPrefill = "" }) {
    setQuickAdd({ brand: brandPrefill, composition: compositionPrefill, company: "" });
    setQuickAddOpen(true);
  }

  // Viewer state
  const [previewOrder, setPreviewOrder] = useState(null);

  // --- fetchOrders helper ---
  const fetchOrders = useCallback(() => {
    if (!token) return;
    axios
      .get(`${API_BASE_URL}/api/prescriptions/pharmacy-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => setOrders(res.data || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [token]);

  // Get all prescription orders for this pharmacy
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchOrders();
  }, [token, fetchOrders]);

  // Auto-refresh every 3s (pause while dialogs are open)
  useEffect(() => {
    if (!token) return;
    const busy = showQuoteDialog || showRejectDialog || acceptDialogOpen;
    const id = setInterval(() => {
      if (!busy) fetchOrders();
    }, 3000);
    return () => clearInterval(id);
  }, [token, fetchOrders, showQuoteDialog, showRejectDialog, acceptDialogOpen]);

  // Set up timers (global tick every 1s, update all order timers)
  useEffect(() => {
    if (!orders.length) return;
    const newTimers = {};
    orders.forEach(order => {
      newTimers[order._id] = getSecondsLeft(order.quoteExpiry);
    });
    setTimers(newTimers);

    const interval = setInterval(() => {
      setTimers(timers => {
        const updated = {};
        orders.forEach(order => {
          updated[order._id] = getSecondsLeft(order.quoteExpiry);
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [orders]);

  // Auto-close quote dialog if timer runs out
  useEffect(() => {
    if (
      showQuoteDialog &&
      selectedOrder &&
      (timers[selectedOrder._id] <= 0 || selectedOrder.status !== "waiting_for_quotes")
    ) {
      setShowQuoteDialog(false);
      setMsg("Quote window expired. You cannot submit a quote now.");
    }
  }, [timers, selectedOrder, showQuoteDialog]);

  // Get all medicines available at this pharmacy (for autocomplete)
  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_BASE_URL}/api/pharmacy/medicines`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => setPharmacyMeds(res.data || []))
      .catch(() => setPharmacyMeds([]));
  }, [token]);

  /* ---------------- QUOTE ACTIONS ---------------- */

  // For Accept: all medicines must be available
  const handleAcceptOrder = (order) => {
    setSelectedOrder(order);
    setQuoteMode("accept");
    const base = (order.ai?.items?.length ? order.ai.items : (order.medicinesRequested || []));
    // Prefer composition if present
    setAcceptDialogData(base.map(med => ({
      medicineName: med.composition || med.name || med.medicineName,
      quantity: med.quantity || 1,
      brand: "",
      price: ""
    })));
    setAcceptDialogOpen(true);
  };

  // For Partial: pharmacist can select available/unavailable
  const handlePartialFulfill = (order) => {
    setSelectedOrder(order);
    setQuoteMode("partial");
    const base = (order.ai?.items?.length ? order.ai.items : (order.medicinesRequested || []));
    const meds = base.length
      ? base.map((med) => ({
          medicineName: med.composition || med.name || med.medicineName,
          brand: "",
          price: "",
          quantity: med.quantity || 1,
          available: true
        }))
      : [{ medicineName: "", brand: "", price: "", quantity: "", available: true }];
    setQuote(meds);
    setShowQuoteDialog(true);
  };

  // For Reject: just show confirm dialog
  const handleRejectOrder = (order) => {
    setSelectedOrder(order);
    setShowRejectDialog(true);
  };

  // Confirm reject
  const confirmRejectOrder = async () => {
    try {
      await axios.post(
        `${API_BASE_URL}/api/prescriptions/respond/${selectedOrder._id}`,
        { response: "rejected" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMsg("Order rejected!");
      setShowRejectDialog(false);
      setSelectedOrder(null);
    } catch {
      setMsg("Failed to reject order!");
      setShowRejectDialog(false);
    }
  };

  // Submit quote for this prescription order (partial flow)
  const handleSubmitQuote = async () => {
    // Extra guard on frontend (backend also has a check!)
    if (
      !selectedOrder ||
      timers[selectedOrder._id] <= 0 ||
      selectedOrder.status !== "waiting_for_quotes"
    ) {
      setMsg("Quote window expired. You cannot submit a quote now.");
      setShowQuoteDialog(false);
      return;
    }
    if (quoteMode === "partial" && !isPartialQuoteValid(quote)) {
      setMsg("Fill all fields for available items!");
      return;
    }
    if (quoteMode === "accept" && quote.some(row => !row.available)) {
      setMsg("All medicines must be available to accept the order!");
      return;
    }
    // Ensure each row has a boolean 'available'
    const cleanedQuote = quote.map(row => ({
      ...row,
      available: row.available === false ? false : true
    }));
    try {
      await axios.post(
        `${API_BASE_URL}/api/prescriptions/quote/${selectedOrder._id}`,
        { quote: cleanedQuote, mode: quoteMode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMsg("Quote submitted!");
      setShowQuoteDialog(false);
    } catch {
      setMsg("Failed to submit quote!");
    }
  };

  // Add/remove/edit quote lines
  const addRow = () =>
    setQuote([
      ...quote,
      { medicineName: "", brand: "", price: "", quantity: "", available: true }
    ]);
  const updateRow = (i, key, val) => {
    const arr = [...quote];
    arr[i][key] = val;
    setQuote(arr);
  };

  // AcceptDialog total calculation
  const acceptDialogTotal = acceptDialogData.reduce(
    (sum, row) => sum + ((Number(row.price) || 0) * (Number(row.quantity) || 1)),
    0
  );

  if (loading) return <Typography sx={{ color: TEXT_PRIMARY, fontWeight: 700 }}>Loading prescription orders…</Typography>;
  if (!orders.length) return <Typography sx={{ color: TEXT_PRIMARY, fontWeight: 700 }}>No prescription orders yet.</Typography>;

  return (
    <Box sx={{ mb: 4 }}>
      {orders.map((order) => {
        const timer = timers[order._id] ?? 0;
        const isRejected = order.status === "cancelled" || order.userResponse === "rejected";
        const showActions = order.status === "waiting_for_quotes" && timer > 0 && !isRejected;

        return (
          <Card
            key={order._id}
            sx={{
              mb: 2,
              bgcolor: SURFACE,
              border: "1px solid",
              borderColor: BORDER,
              borderRadius: 2
            }}
          >
            <CardContent>
              <Typography variant="subtitle1" sx={{ color: TEXT_PRIMARY, fontWeight: 800 }}>
                Order #{order._id.slice(-5)} —{" "}
                <Box component="span" sx={{ color: BRAND_GREEN, fontWeight: 800, textTransform: "capitalize" }}>
                  {order.status || "pending"}
                </Box>
              </Typography>

              <Typography sx={{ mt: 1, color: TEXT_PRIMARY, fontWeight: 600 }}>
                Prescription:{" "}
                {order.prescriptionUrl ? (
                  <a
                    href={
                      order.prescriptionUrl.startsWith("/uploads/")
                        ? `${API_BASE_URL}${order.prescriptionUrl}`
                        : order.prescriptionUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: BRAND_GREEN, fontWeight: 800, textDecoration: "underline" }}
                  >
                    View
                  </a>
                ) : (
                  <span style={{ color: TEXT_SECONDARY, fontWeight: 600 }}>Not Available</span>
                )}
              </Typography>

              {/* Quick viewer launch */}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setPreviewOrder(order)}
                  sx={{
                    color: BRAND_GREEN,
                    borderColor: BRAND_GREEN,
                    fontWeight: 800,
                    "&:hover": { borderColor: BRAND_GREEN_DARK, color: BRAND_GREEN_DARK }
                  }}
                >
                  View Rx + AI
                </Button>
              </Stack>

              {/* AI suggestions */}
              {(order.ai?.items?.length > 0) && (
                <Box
                  sx={{
                    mt: 1,
                    bgcolor: SURFACE_SOFT,
                    borderRadius: 1.5,
                    p: 1.5,
                    border: "1px solid",
                    borderColor: BORDER
                  }}
                >
                  <Typography sx={{ color: TEXT_PRIMARY, fontWeight: 800, fontSize: 14 }}>
                    AI suggestions (pharmacist must verify):
                  </Typography>
                  <Typography sx={{ color: TEXT_SECONDARY, fontWeight: 600, fontSize: 14 }}>
                    {order.ai.items.map(i =>
                      `${i.name}${i.strength ? " " + i.strength : ""}${i.form ? " (" + i.form + ")" : ""} × ${i.quantity || 1}`
                    ).join(", ")}
                  </Typography>
                </Box>
              )}

              {/* Already Fulfilled Items from Parent */}
              {order.alreadyFulfilledItems && order.alreadyFulfilledItems.length > 0 && (
                <Box
                  sx={{
                    mt: 1,
                    mb: 1,
                    bgcolor: SURFACE_SOFT,
                    borderRadius: 1.5,
                    p: 1.5,
                    border: "1px solid",
                    borderColor: BORDER
                  }}
                >
                  <Typography sx={{ color: TEXT_PRIMARY, fontWeight: 800, fontSize: 14 }}>
                    Already fulfilled in this order:
                  </Typography>
                  <Typography sx={{ color: TEXT_PRIMARY, fontWeight: 700, fontSize: 15 }}>
                    {order.alreadyFulfilledItems.map(med =>
                      med.medicineName + (med.quantity ? ` (${med.quantity})` : '')
                    ).join(", ")}
                  </Typography>
                  <Typography sx={{ color: TEXT_SECONDARY, fontSize: 13, mt: 1, fontWeight: 600 }}>
                    Please quote for the <b>remaining</b> medicines below.
                  </Typography>
                </Box>
              )}
              {order.notes && (
                <Typography sx={{ mt: 1, color: TEXT_PRIMARY, fontWeight: 700 }}>
                  User Message: {order.notes}
                </Typography>
              )}
              {order.unavailableItems && order.unavailableItems.length > 0 && (
                <Typography color="error" sx={{ fontWeight: 700 }}>
                  Unavailable: {order.unavailableItems.join(", ")}
                </Typography>
              )}

              <Typography variant="body2" sx={{ mt: 0.5, color: TEXT_SECONDARY, fontWeight: 600 }}>
                Created: {order.createdAt ? new Date(order.createdAt).toLocaleString() : "-"}
              </Typography>

              {/* Actions */}
              {showActions && (
                <Box sx={{ mt: 2 }}>
                  <Typography sx={{ mb: 1, color: TEXT_PRIMARY, fontWeight: 800 }}>
                    Select Action:
                  </Typography>
                  <Stack spacing={1}>
                    <Button
                      variant="contained"
                      size="large"
                      fullWidth
                      sx={{ fontWeight: 800, letterSpacing: 0.5, bgcolor: BRAND_GREEN, "&:hover": { bgcolor: BRAND_GREEN_DARK } }}
                      onClick={() => handleAcceptOrder(order)}
                    >
                      ACCEPT (ALL AVAILABLE)
                    </Button>
                    <Button
                      variant="outlined"
                      size="large"
                      fullWidth
                      sx={{ fontWeight: 800, letterSpacing: 0.5, borderColor: BRAND_GREEN, color: BRAND_GREEN, "&:hover": { borderColor: BRAND_GREEN_DARK, color: BRAND_GREEN_DARK } }}
                      onClick={() => handlePartialFulfill(order)}
                    >
                      PARTIAL FULFILL
                    </Button>
                    <Button
                      variant="contained"
                      color="error"
                      size="large"
                      fullWidth
                      sx={{ fontWeight: 800, letterSpacing: 0.5 }}
                      onClick={() => handleRejectOrder(order)}
                    >
                      REJECT
                    </Button>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2 }}>
                    <Typography sx={{ color: TEXT_SECONDARY, fontWeight: 800 }}>
                      ⏳ {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, "0")} left
                    </Typography>
                  </Stack>
                </Box>
              )}

              {/* After actions or other statuses */}
              {!showActions && !isRejected && (
                <>
                  {order.status === "quoted" ? (
                    <Typography color="success.main" sx={{ fontWeight: 800, mt: 2 }}>
                      Quote submitted
                    </Typography>
                  ) : timer > 0 ? (
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 2 }}>
                      <Typography sx={{ color: TEXT_SECONDARY, fontWeight: 800 }}>
                        ⏳ {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, "0")} left to quote
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handlePartialFulfill(order)}
                        sx={{ color: BRAND_GREEN, borderColor: BRAND_GREEN, fontWeight: 800, "&:hover": { borderColor: BRAND_GREEN_DARK, color: BRAND_GREEN_DARK } }}
                      >
                        Submit Quote
                      </Button>
                    </Stack>
                  ) : (
                    <Typography color="error" sx={{ fontWeight: 900, mt: 2 }}>
                      Quote window expired
                    </Typography>
                  )}
                </>
              )}
              {isRejected && (
                <Typography color="error" sx={{ fontWeight: 900, mt: 2 }}>
                  Order rejected
                </Typography>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* --- AcceptDialog (All Available) --- */}
      <Dialog open={acceptDialogOpen} onClose={() => setAcceptDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 900, color: TEXT_PRIMARY }}>
          Accept (All Available) - Specify Brands, Qty & Price
        </DialogTitle>
        <DialogContent>
          {/* UPGRADED TABLE */}
          <Box sx={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
                textAlign: "left",
              }}
            >
              <thead style={{ position: "sticky", top: 0, background: SURFACE_SOFT, zIndex: 1 }}>
                <tr>
                  <th style={{ padding: 10, fontWeight: 900, minWidth: 200 }}>Composition</th>
                  <th style={{ padding: 10, fontWeight: 900, minWidth: 120 }}>Brand</th>
                  <th style={{ padding: 10, fontWeight: 900, width: 70 }}>Qty</th>
                  <th style={{ padding: 10, fontWeight: 900, width: 90 }}>Price</th>
                  <th style={{ padding: 10, fontWeight: 900, width: 60 }}></th>
                  <th style={{ padding: 10, fontWeight: 900, width: 160 }}></th>
                </tr>
              </thead>

              <tbody>
                {acceptDialogData.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      background: i % 2 === 0 ? "#fafafa" : "white",
                      verticalAlign: "middle",
                    }}
                  >
                    {/* Composition (with pharmacyMeds autocomplete) */}
                    <td style={{ padding: 8 }}>
                      <Autocomplete
                        freeSolo
                        options={pharmacyMeds || []}
                        getOptionLabel={(option) =>
                          typeof option === "string"
                            ? option
                            : (option.composition || option.brand || option.name || "")
                        }
                        value={
                          pharmacyMeds.find(
                            (med) =>
                              (med.composition || med.brand || med.name || "") === row.medicineName
                          ) || { name: row.medicineName }
                        }
                        onChange={(_, value) => {
                          const arr = [...acceptDialogData];
                          if (typeof value === "string") {
                            arr[i].medicineName = value; // typed composition
                          } else if (value) {
                            arr[i].medicineName = value.composition || value.brand || value.name || "";
                            arr[i].brand = value.brand || arr[i].brand || "";
                            arr[i].price = value.price || arr[i].price || "";
                          }
                          setAcceptDialogData(arr);
                        }}
                        onInputChange={(_, value) => {
                          const arr = [...acceptDialogData];
                          arr[i].medicineName = value;
                          setAcceptDialogData(arr);
                        }}
                        renderOption={(props, option) => (
                          <li {...props}>
                            <span style={{ fontWeight: 600 }}>
                              {option.composition || option.brand || option.name}
                            </span>
                            {!!option.prescriptionRequired && (
                              <span style={{ marginLeft: 8, fontSize: 11, color: "#f43f5e", fontWeight: 800 }}>
                                Rx
                              </span>
                            )}
                          </li>
                        )}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            fullWidth
                            placeholder="Composition"
                            size="small"
                            variant="outlined"
                            InputProps={{
                              ...params.InputProps,
                              style: { fontWeight: 600 },
                            }}
                          />
                        )}
                      />
                    </td>

                    {/* Brand */}
                    <td style={{ padding: 8 }}>
                      <TextField
                        fullWidth
                        placeholder="Brand"
                        value={row.brand}
                        onChange={(e) => {
                          const arr = [...acceptDialogData];
                          arr[i].brand = e.target.value;
                          setAcceptDialogData(arr);
                        }}
                        size="small"
                        variant="outlined"
                      />
                    </td>

                    {/* Qty */}
                    <td style={{ padding: 8 }}>
                      <TextField
                        type="number"
                        value={row.quantity}
                        onChange={(e) => {
                          const arr = [...acceptDialogData];
                          arr[i].quantity = e.target.value;
                          setAcceptDialogData(arr);
                        }}
                        size="small"
                        variant="outlined"
                        sx={{ width: 70 }}
                        inputProps={{ min: 1 }}
                      />
                    </td>

                    {/* Price */}
                    <td style={{ padding: 8 }}>
                      <TextField
                        type="number"
                        value={row.price}
                        onChange={(e) => {
                          const arr = [...acceptDialogData];
                          arr[i].price = e.target.value;
                          setAcceptDialogData(arr);
                        }}
                        size="small"
                        variant="outlined"
                        sx={{ width: 90 }}
                        inputProps={{ min: 0 }}
                      />
                    </td>

                    {/* Remove */}
                    <td style={{ padding: 8 }}>
                      {acceptDialogData.length > 1 && (
                        <Button
                          variant="text"
                          size="small"
                          color="error"
                          onClick={() =>
                            setAcceptDialogData(acceptDialogData.filter((_, j) => j !== i))
                          }
                          sx={{ fontWeight: 800 }}
                          aria-label="Remove row"
                          title="Remove row"
                        >
                          ✖
                        </Button>
                      )}
                    </td>

                    {/* Quick Add (draft) */}
                    <td style={{ padding: 8 }}>
                      <Button
                        variant="text"
                        size="small"
                        sx={{ fontWeight: 800, color: BRAND_GREEN }}
                        onClick={() =>
                          openQuickAddDialog({
                            brandPrefill: row.brand || "",
                            compositionPrefill: row.medicineName || "",
                          })
                        }
                      >
                        + Add to Inventory (draft)
                      </Button>
                    </td>
                  </tr>
                ))}

                {/* Add row */}
                <tr>
                  <td colSpan={6} style={{ textAlign: "right", padding: 10 }}>
                    <Button
                      variant="outlined"
                      onClick={() =>
                        setAcceptDialogData([
                          ...acceptDialogData,
                          { medicineName: "", brand: "", quantity: 1, price: "" },
                        ])
                      }
                      size="small"
                      sx={{
                        color: BRAND_GREEN,
                        borderColor: BRAND_GREEN,
                        fontWeight: 800,
                        "&:hover": { borderColor: BRAND_GREEN_DARK, color: BRAND_GREEN_DARK },
                      }}
                    >
                      + Add Medicine
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </Box>

          <Typography sx={{ mt: 1, fontSize: 12, fontWeight: 700, color: TEXT_SECONDARY }}>
            Fill either <b>Composition</b> or <b>Brand</b> (or both). <b>Company</b> is optional.
          </Typography>

          <Typography sx={{ mt: 2, fontWeight: 900, color: TEXT_PRIMARY, fontSize: 18 }}>
            Total Price: ₹{acceptDialogTotal}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAcceptDialogOpen(false)} sx={{ fontWeight: 800 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              const cleanedQuote = acceptDialogData.map(row => ({
                medicineName: row.medicineName,
                brand: row.brand,
                price: Number(row.price) || 0,
                quantity: Number(row.quantity) || 1,
                available: true
              }));
              await axios.post(
                `${API_BASE_URL}/api/prescriptions/quote/${selectedOrder._id}`,
                {
                  quote: cleanedQuote,
                  mode: "accept",
                  approxPrice: acceptDialogTotal
                },
                { headers: { Authorization: `Bearer ${token}` } }
              );
              setAcceptDialogOpen(false);
              setMsg("Quote sent to user for confirmation.");
            }}
            disabled={
              acceptDialogData.length === 0 ||
              acceptDialogData.some(row => (!row.brand && !row.medicineName) || !row.quantity || !row.price) ||
              !selectedOrder ||
              timers[selectedOrder._id] <= 0 ||
              selectedOrder.status !== "waiting_for_quotes"
            }
            sx={{ fontWeight: 900, bgcolor: BRAND_GREEN, "&:hover": { bgcolor: BRAND_GREEN_DARK } }}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      {/* --- Quote Submission Dialog (Partial) --- */}
      <Dialog
        open={showQuoteDialog}
        onClose={() => setShowQuoteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 900, color: TEXT_PRIMARY }}>
          {quoteMode === "accept"
            ? "Submit Quote (All Medicines Available)"
            : "Submit Partial Quote"}
        </DialogTitle>
        <DialogContent>
          {/* UPGRADED TABLE */}
          <Box sx={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
                textAlign: "left",
              }}
            >
              <thead style={{ position: "sticky", top: 0, background: SURFACE_SOFT, zIndex: 1 }}>
                <tr>
                  <th style={{ padding: 10, fontWeight: 900, minWidth: 180 }}>Composition</th>
                  <th style={{ padding: 10, fontWeight: 900, minWidth: 120 }}>Brand</th>
                  <th style={{ padding: 10, fontWeight: 900, width: 70 }}>Qty</th>
                  <th style={{ padding: 10, fontWeight: 900, width: 90 }}>Price</th>
                  <th style={{ padding: 10, fontWeight: 900, width: 110 }}>Available</th>
                  <th></th>
                  <th style={{ padding: 10, fontWeight: 900, width: 160 }}></th>
                </tr>
              </thead>
              <tbody>
                {quote.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      background: i % 2 === 0 ? "#fafafa" : "white",
                      verticalAlign: "middle",
                    }}
                  >
                    {/* Composition */}
                    <td style={{ padding: 8 }}>
                      <TextField
                        fullWidth
                        value={row.medicineName}
                        onChange={(e) => updateRow(i, "medicineName", e.target.value)}
                        placeholder="Composition (e.g., Paracetamol 650 mg)"
                        size="small"
                        variant="outlined"
                        InputProps={{ style: { fontWeight: 600 } }}
                      />
                    </td>

                    {/* Brand */}
                    <td style={{ padding: 8 }}>
                      <TextField
                        fullWidth
                        value={row.brand}
                        onChange={(e) => updateRow(i, "brand", e.target.value)}
                        placeholder="Brand"
                        size="small"
                        variant="outlined"
                      />
                    </td>

                    {/* Quantity */}
                    <td style={{ padding: 8 }}>
                      <TextField
                        type="number"
                        value={row.quantity}
                        onChange={(e) => updateRow(i, "quantity", e.target.value)}
                        size="small"
                        variant="outlined"
                        sx={{ width: 70 }}
                      />
                    </td>

                    {/* Price */}
                    <td style={{ padding: 8 }}>
                      <TextField
                        type="number"
                        value={row.price}
                        onChange={(e) => updateRow(i, "price", e.target.value)}
                        size="small"
                        variant="outlined"
                        sx={{ width: 90 }}
                      />
                    </td>

                    {/* Availability */}
                    <td style={{ padding: 8 }}>
                      <Select
                        value={String(row.available)}
                        onChange={(e) => updateRow(i, "available", e.target.value === "true")}
                        size="small"
                        variant="outlined"
                        sx={{ width: 120 }}
                      >
                        <MenuItem value="true">✅ Available</MenuItem>
                        <MenuItem value="false">❌ Not Available</MenuItem>
                      </Select>
                    </td>

                    {/* Remove Button */}
                    <td style={{ padding: 8 }}>
                      {quote.length > 1 && (
                        <Button
                          variant="text"
                          color="error"
                          size="small"
                          onClick={() => setQuote(quote.filter((_, j) => j !== i))}
                        >
                          ✖
                        </Button>
                      )}
                    </td>

                    {/* Quick Add (draft) */}
                    <td style={{ padding: 8 }}>
                      <Button
                        variant="text"
                        size="small"
                        sx={{ fontWeight: 800, color: BRAND_GREEN }}
                        onClick={() =>
                          openQuickAddDialog({
                            brandPrefill: row.brand || "",
                            compositionPrefill: row.medicineName || "",
                          })
                        }
                      >
                        + Add to Inventory (draft)
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>

          <Typography sx={{ mt: 1, fontSize: 12, fontWeight: 700, color: TEXT_SECONDARY }}>
            Fill either <b>Composition</b> or <b>Brand</b> (or both). <b>Company</b> is optional.
          </Typography>
        </DialogContent>
        <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ m: 2 }}>
          <Button onClick={() => setShowQuoteDialog(false)} sx={{ fontWeight: 800 }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmitQuote}
            disabled={
              !selectedOrder ||
              timers[selectedOrder._id] <= 0 ||
              selectedOrder.status !== "waiting_for_quotes" ||
              (quoteMode === "partial" && !isPartialQuoteValid(quote))
            }
            sx={{ fontWeight: 900, bgcolor: BRAND_GREEN, "&:hover": { bgcolor: BRAND_GREEN_DARK } }}
          >
            Submit Quote
          </Button>
        </Stack>
      </Dialog>

      {/* --- Quick Add to Inventory (Draft) Dialog --- */}
      <Dialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900, color: TEXT_PRIMARY }}>
          Quick Add to Inventory (Draft)
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Brand (required)"
              value={quickAdd.brand}
              onChange={(e) => setQuickAdd(q => ({ ...q, brand: e.target.value }))}
              required
            />
            <TextField
              label="Composition (optional)"
              placeholder="e.g., Paracetamol 650 mg"
              value={quickAdd.composition}
              onChange={(e) => setQuickAdd(q => ({ ...q, composition: e.target.value }))}
            />
            <TextField
              label="Company (optional)"
              value={quickAdd.company}
              onChange={(e) => setQuickAdd(q => ({ ...q, company: e.target.value }))}
            />
            <Typography sx={{ fontSize: 12, color: TEXT_SECONDARY, fontWeight: 700 }}>
              Drafts are hidden from customers. Add image/price later to activate.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickAddOpen(false)} sx={{ fontWeight: 800 }}>Cancel</Button>
          <Button
            variant="contained"
            sx={{ fontWeight: 900, bgcolor: BRAND_GREEN, "&:hover": { bgcolor: BRAND_GREEN_DARK } }}
            disabled={!quickAdd.brand}
            onClick={async () => {
              try {
                await axios.post(
                  `${API_BASE_URL}/api/pharmacy/medicines/quick-add-draft`,
                  {
                    name: quickAdd.brand || quickAdd.composition || "Draft",
                    brand: quickAdd.brand,
                    composition: quickAdd.composition || "",
                    company: quickAdd.company || "",
                  },
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                setMsg("Draft medicine added to your inventory.");
                setQuickAddOpen(false);
                // refresh local inventory for autocompletes
                const res = await axios.get(`${API_BASE_URL}/api/pharmacy/medicines`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                setPharmacyMeds(res.data || []);
              } catch {
                setMsg("Failed to add draft medicine.");
              }
            }}
          >
            Add as Draft
          </Button>
        </DialogActions>
      </Dialog>

      {/* --- Reject Confirmation Dialog --- */}
      <Dialog open={showRejectDialog} onClose={() => setShowRejectDialog(false)}>
        <DialogTitle sx={{ fontWeight: 900, color: TEXT_PRIMARY }}>Reject Order?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: TEXT_PRIMARY, fontWeight: 700 }}>
            Are you sure you want to <span style={{ color: "#ef4444", fontWeight: 800 }}>reject</span> this prescription order? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRejectDialog(false)} sx={{ fontWeight: 800 }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmRejectOrder} sx={{ fontWeight: 900 }}>
            Yes, Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Viewer dialog (side-by-side Rx + AI) */}
      <RxAiSideBySideDialog
        open={!!previewOrder}
        onClose={() => setPreviewOrder(null)}
        order={previewOrder}
        token={token}
        onRefetched={() => fetchOrders()}
      />

      <Snackbar
        open={!!msg}
        autoHideDuration={2200}
        onClose={() => setMsg("")}
      >
        <Alert
          onClose={() => setMsg("")}
          severity={msg.toLowerCase().includes("fail") ? "error" : "success"}
        >
          {msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
