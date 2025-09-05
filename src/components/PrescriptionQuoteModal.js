// src/components/PrescriptionQuoteModal.js
import React, { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Typography, Stack, Chip, Divider, Snackbar, Alert
} from "@mui/material";
import PaymentIcon from "@mui/icons-material/Payment";
import axios from "axios";

// Use API base from environment variable
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export default function PrescriptionQuoteModal({ open, onClose, quote, token, refreshOrders }) {
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  // Normalize shape: accept either order or quote object
  const items =
    (quote?.quote?.items && Array.isArray(quote.quote.items) && quote.quote.items) ||
    (quote?.items && Array.isArray(quote.items) && quote.items) ||
    [];

  const computedTotal = typeof quote?.quote?.price === "number"
    ? quote.quote.price
    : items
        .filter(it => it.available !== false)
        .reduce((sum, it) => sum + ((Number(it.price) || 0) * (Number(it.quantity) || 1)), 0);

  const payNow = async () => {
    setLoading(true);
    try {
      const razorpayOrder = await axios.post(
        `${API_BASE_URL}/api/payment/razorpay/order`,
        { amount: Math.round(computedTotal * 100), currency: "INR", receipt: "quote_" + quote._id }
      );
      const options = {
        key: "rzp_test_GAXFOxUCCrxVvr",
        amount: razorpayOrder.data.amount,
        currency: "INR",
        name: "GoDavaii - Medicine Delivery",
        description: "Prescription Quote Payment",
        order_id: razorpayOrder.data.id,
        handler: async function (response) {
          try {
            await axios.post(
              `${API_BASE_URL}/api/orders/${quote._id}/payment-success`,
              { paymentDetails: response },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const convertRes = await axios.post(
              `${API_BASE_URL}/api/prescriptions/${quote._id}/convert-to-order`,
              {},
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (convertRes.data && convertRes.data.orderId) {
              window.location.href = `/orders/${convertRes.data.orderId}`;
              return;
            } else {
              setSnackbar({ open: true, message: "Payment done, but failed to update order!", severity: "error" });
            }
          } catch {
            setSnackbar({ open: true, message: "Payment succeeded but order update failed!", severity: "error" });
          }
          setLoading(false);
          onClose();
          refreshOrders && refreshOrders();
        },
        prefill: { name: quote.user?.name || "", email: quote.user?.email || "" },
        theme: { color: "#13c7ae" },
        modal: { ondismiss: () => setLoading(false) },
      };
      setLoading(false);
      if (window.Razorpay) new window.Razorpay(options).open();
      else setSnackbar({ open: true, message: "Payment gateway not loaded.", severity: "error" });
    } catch {
      setSnackbar({ open: true, message: "Failed to initiate payment.", severity: "error" });
      setLoading(false);
    }
  };

  if (!quote) return null;

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>
          Prescription Quote Ready <PaymentIcon sx={{ color: "#FFD43B", ml: 1 }} />
        </DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            The pharmacy has sent a quote for your prescription.
          </Typography>

          {/* New table that matches the quote shape */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead style={{ background: "#f6faf8" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: 8, fontWeight: 800 }}>Composition</th>
                  <th style={{ textAlign: "left", padding: 8, fontWeight: 800 }}>Brand</th>
                  <th style={{ textAlign: "left", padding: 8, fontWeight: 800, width: 70 }}>Qty</th>
                  <th style={{ textAlign: "left", padding: 8, fontWeight: 800, width: 90 }}>Price</th>
                  <th style={{ textAlign: "left", padding: 8, fontWeight: 800, width: 120 }}>Available</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} style={{ background: i % 2 ? "#fff" : "#fafafa" }}>
                    <td style={{ padding: 8, fontWeight: 700 }}>{it.medicineName || it.name || "-"}</td>
                    <td style={{ padding: 8 }}>{it.brand || "-"}</td>
                    <td style={{ padding: 8 }}>{it.quantity ?? "-"}</td>
                    <td style={{ padding: 8 }}>₹{Number(it.price || 0)}</td>
                    <td style={{ padding: 8 }}>{it.available === false ? "❌ Not Available" : "✅ Available"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" sx={{ color: "#17879c", fontWeight: 700 }}>
            Total Quoted Price: ₹{computedTotal}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            onClick={async () => {
              setLoading(true);
              try {
                await axios.put(
                  `${API_BASE_URL}/api/orders/${quote._id}/reject`,
                  {},
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                setSnackbar({ open: true, message: "Quote Rejected.", severity: "info" });
                setTimeout(() => {
                  setLoading(false);
                  onClose();
                  refreshOrders && refreshOrders();
                }, 1200);
              } catch {
                setSnackbar({ open: true, message: "Rejection failed!", severity: "error" });
                setLoading(false);
              }
            }}
            disabled={loading}
          >
            Reject
          </Button>
          <Button
            variant="contained"
            onClick={payNow}
            disabled={loading}
            sx={{ bgcolor: "#13c7ae", fontWeight: 700 }}
          >
            {loading ? "Processing..." : `Accept & Pay ₹${computedTotal}`}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={1800}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

