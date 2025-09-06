// src/components/QuoteReviewModal.js
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Divider,
} from "@mui/material";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";

export default function QuoteReviewModal({ open, order, onClose, onAccept }) {
  if (!order) return null;

  // ---- normalize to a single quote shape (items + total + message) ----
  let items = [];
  let message = "";
  let total = 0;

  // prefer tempQuote.items > quote.items > quote[] > quotes[last].items
  if (order?.tempQuote?.items?.length) {
    items = order.tempQuote.items;
    message = order.tempQuote.message || "";
  } else if (order?.quote?.items?.length) {
    items = order.quote.items;
    message = order.quote.message || "";
  } else if (Array.isArray(order?.quote) && order.quote.length) {
    items = order.quote;
  } else if (Array.isArray(order?.quotes) && order.quotes.length) {
    const latest = order.quotes[order.quotes.length - 1] || {};
    items = latest.items || [];
    message = latest.message || "";
  }

  // total: use explicit price when provided, else sum of available rows
  if (typeof order?.quote?.price === "number") {
    total = order.quote.price;
  } else {
    total = items
      .filter((i) => i.available !== false)
      .reduce(
        (sum, i) => sum + ((Number(i.price) || 0) * (Number(i.quantity) || 1)),
        0
      );
  }

  const compositionOf = (it) =>
    it.composition ?? it.medicineName ?? it.name ?? "-";

  const dialogTitle = (
    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <ReceiptLongIcon style={{ color: "#13C0A2", fontSize: 28 }} />
      Prescription Quote
    </span>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ style: { borderRadius: 16, boxShadow: "0px 8px 32px #13C0A229" } }}
    >
      <DialogTitle sx={{ fontWeight: 700, fontSize: 20 }}>{dialogTitle}</DialogTitle>

      <DialogContent>
        <Typography sx={{ mb: 2, color: "#13C0A2", fontWeight: 700 }}>
          Pharmacy: {order.pharmacy?.name || order.pharmacyName || ""}
        </Typography>

        <Box
          sx={{
            mb: 2,
            borderRadius: 2,
            overflowX: "auto",
            boxShadow: 1,
            bgcolor: "#f6fff7",
            maxWidth: "100%",
            width: "100%",
          }}
        >
          <Table size="small" sx={{ minWidth: 530 }}>
            <TableHead>
              <TableRow style={{ background: "#13C0A2" }}>
                <TableCell sx={{ color: "#fff", fontWeight: 700, minWidth: 140 }}>
                  Composition
                </TableCell>
                <TableCell sx={{ color: "#fff", fontWeight: 700, minWidth: 100 }}>
                  Brand
                </TableCell>
                <TableCell sx={{ color: "#fff", fontWeight: 700, minWidth: 70 }}>
                  Price
                </TableCell>
                <TableCell sx={{ color: "#fff", fontWeight: 700, minWidth: 65 }}>
                  Qty
                </TableCell>
                <TableCell sx={{ color: "#fff", fontWeight: 700, minWidth: 100 }}>
                  Status
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {!items.length ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ color: "#999" }}>
                    No quote details found.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((it, idx) => (
                  <TableRow key={idx}>
                    {/* Composition-first; never fall back to Brand here */}
                    <TableCell sx={{ fontWeight: 700 }}>
                      {compositionOf(it)}
                    </TableCell>
                    <TableCell>{it.brand || "-"}</TableCell>
                    <TableCell>
                      {it.available === false ? "-" : `₹${Number(it.price || 0)}`}
                    </TableCell>
                    <TableCell>{it.quantity ?? "-"}</TableCell>
                    <TableCell
                      sx={{
                        color: it.available === false ? "#d32f2f" : "#198754",
                        fontWeight: 600,
                        letterSpacing: 0.5,
                      }}
                    >
                      {it.available === false ? "Unavailable" : "Available"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography
          sx={{
            fontWeight: 800,
            fontSize: 20,
            color: "#13C0A2",
            textAlign: "right",
            letterSpacing: 0.5,
          }}
        >
          Total Price: <span style={{ color: "#0c725f" }}>₹{total}</span>
        </Typography>

        {!!message && (
          <Typography sx={{ mt: 1, color: "#888" }}>Note: {message}</Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{ minWidth: 100, borderRadius: 3, fontWeight: 700 }}
        >
          Close
        </Button>

        {typeof onAccept === "function" && (
          <Button
            onClick={onAccept}
            variant="contained"
            sx={{
              minWidth: 140,
              bgcolor: "#13C0A2",
              borderRadius: 3,
              fontWeight: 800,
              "&:hover": { bgcolor: "#0e9c87" },
            }}
            disabled={Number(total) <= 0}
          >
            Accept &amp; Pay ₹{total}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
