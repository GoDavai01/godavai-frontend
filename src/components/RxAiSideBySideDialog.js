// src/components/RxAiSideBySideDialog.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Chip, Divider, LinearProgress, Stack, IconButton
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DARK_BG = "#181d23";
const DARK_CARD = "#21272b";
const BORDER = "#2f3840";

export default function RxAiSideBySideDialog({ open, onClose, order, token, onRefetched }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // attachments list (fallback to single)
  const attachments = useMemo(() => {
    const list = Array.isArray(order?.attachments) && order.attachments.length
      ? order.attachments
      : (order?.prescriptionUrl ? [order.prescriptionUrl] : []);
    return list.map(u =>
      u.startsWith("/uploads/") ? `${API_BASE_URL}${u}` : u
    );
  }, [order]);

  const [pageIdx, setPageIdx] = useState(0);
  const imgUrl = attachments[pageIdx] || "";
  const isPDF = /\.pdf($|\?)/i.test(imgUrl);

  // zoom/pan state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });

  // pinch-zoom tracking
  const touchesRef = useRef(new Map()); // pointerId -> {x,y}
  const pinchStart = useRef({ dist: 0, scale: 1, center: { x: 0, y: 0 }, offset: { x: 0, y: 0 } });
  const [isPinching, setIsPinching] = useState(false);

  // swipe to change page (one-finger flick when not zoomed)
  const swipeStartX = useRef(null);
  const swipeStartT = useRef(0);

  // --- AI state/polling ---
  const [ai, setAi] = useState(order?.ai || null);
  const [loadingAi, setLoadingAi] = useState(false);

  // seed local AI when order changes
  useEffect(() => {
    setAi(order?.ai || null);
  }, [order?._id]);

  // fetch AI ONCE when dialog opens (no auto-rescan / polling)
  useEffect(() => { 
    if (!open || !order?._id || !token) return;
    let active = true;

    (async () => {
      try {
        setLoadingAi(true);
        const res = await axios.get(`${API_BASE_URL}/api/prescriptions/ai/${order._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (active) setAi(res.data || { items: [] });
      } catch {
        if (active) setAi(order?.ai || { items: [] });
      } finally {
        if (active) setLoadingAi(false);
      }
    })();

    return () => { active = false; };
  }, [open, order?._id, token]);

  useEffect(() => {
    if (!open) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
      setDragging(false);
      setIsPinching(false);
      touchesRef.current.clear();
    }
  }, [open]);

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const zoomBy = (delta, center) => {
    const oldScale = scale;
    const newScale = clamp(oldScale + delta, 1, 4);

    if (containerRef.current && imgRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cx = center?.x ?? rect.width / 2;
      const cy = center?.y ?? rect.height / 2;

      const dx = (cx - rect.width / 2 - offset.x);
      const dy = (cy - rect.height / 2 - offset.y);

      const ratio = newScale / oldScale - 1;
      setOffset(o => ({ x: o.x - dx * ratio, y: o.y - dy * ratio }));
    }
    setScale(newScale);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const center = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    zoomBy(delta, center);
  };

  // ---- Pointer + Pinch handlers ----
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // record for swipe (single finger, scale==1)
    if (touchesRef.current.size === 1 && scale <= 1.0001) {
      swipeStartX.current = e.clientX;
      swipeStartT.current = Date.now();
    }

    if (touchesRef.current.size === 2) {
      const pts = Array.from(touchesRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const rect = containerRef.current.getBoundingClientRect();
      const center = {
        x: (pts[0].x + pts[1].x) / 2 - rect.left,
        y: (pts[0].y + pts[1].y) / 2 - rect.top,
      };
      pinchStart.current = { dist, scale, center, offset: { ...offset } };
      setIsPinching(true);
      setDragging(false);
      return;
    }

    // allow panning only when zoomed in
    if (scale <= 1.0001) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { ...offset };
  };

  const onPointerMove = (e) => {
    if (isPinching) {
      touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchesRef.current.size < 2) return;
      const pts = Array.from(touchesRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);

      const factor = clamp(dist / (pinchStart.current.dist || 1), 0.2, 5);
      const newScale = clamp(pinchStart.current.scale * factor, 1, 4);
      setScale(newScale);

      const rect = containerRef.current.getBoundingClientRect();
      const cx = pinchStart.current.center.x;
      const cy = pinchStart.current.center.y;
      const ratio = newScale / pinchStart.current.scale - 1;
      const dxC = cx - rect.width / 2 - pinchStart.current.offset.x;
      const dyC = cy - rect.height / 2 - pinchStart.current.offset.y;
      setOffset({
        x: pinchStart.current.offset.x - dxC * ratio,
        y: pinchStart.current.offset.y - dyC * ratio,
      });
      return;
    }

    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({ x: startOffset.current.x + dx, y: startOffset.current.y + dy });
  };

  const onPointerUpOrLeave = (e) => {
    // swipe page change (single finger, not zoomed)
    if (scale <= 1.0001 && swipeStartX.current != null && touchesRef.current.size <= 1) {
      const dx = (e.clientX ?? swipeStartX.current) - swipeStartX.current;
      const dt = Date.now() - swipeStartT.current;
      const THRESH = 60; // px
      const SPEED_OK = dt < 500;
      if (Math.abs(dx) > THRESH && SPEED_OK) {
        if (dx < 0 && pageIdx < attachments.length - 1) {
          setPageIdx(i => Math.min(attachments.length - 1, i + 1));
        } else if (dx > 0 && pageIdx > 0) {
          setPageIdx(i => Math.max(0, i - 1));
        }
      }
    }
    swipeStartX.current = null;

    touchesRef.current.delete(e.pointerId);
    if (touchesRef.current.size < 2 && isPinching) {
      setIsPinching(false);
      pinchStart.current = { dist: 0, scale: 1, center: { x: 0, y: 0 }, offset: { x: 0, y: 0 } };
    }
    setDragging(false);
  };

  const aiItems = ai?.items || [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{ sx: { bgcolor: DARK_BG, color: "#fff", borderRadius: 2 } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        Rx & AI Viewer
        <Typography variant="body2" sx={{ opacity: 0.75 }}>
          Compare the original prescription with AI suggestions (you must verify before quoting).
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: BORDER, p: 0 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "58% 42%" },
            gap: 0,
            minHeight: 420
          }}
        >
          {/* LEFT: Image area */}
          <Box
            sx={{
              position: "relative",
              borderRight: { md: `1px solid ${BORDER}` },
              bgcolor: "#0f1318",
              height: "100%",
              minHeight: 420
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, borderBottom: `1px solid ${BORDER}` }}>
              <Chip size="small" label="Original Prescription" sx={{ bgcolor: "#23292e", color: "#cfe9e5", fontWeight: 700 }} />
              {!!imgUrl && (
                <Button
                  size="small"
                  variant="text"
                  endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
                  sx={{ color: "#8dd3c7" }}
                  href={imgUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Original
                </Button>
              )}

              {/* Pager counter */}
              <Box sx={{ ml: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
                <Typography variant="caption" sx={{ color: "#cfe9e5" }}>
                  {attachments.length ? `${pageIdx + 1} / ${attachments.length}` : "0 / 0"}
                </Typography>
              </Box>

              <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
                <IconButton size="small" onClick={() => zoomBy(-0.2)} sx={{ color: "#cfe9e5" }}><ZoomOutIcon fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => zoomBy(+0.2)} sx={{ color: "#cfe9e5" }}><ZoomInIcon fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }} sx={{ color: "#cfe9e5" }}><RestartAltIcon fontSize="small" /></IconButton>
              </Box>
            </Box>

            {/* Image / PDF area */}
            {(!imgUrl) ? (
              <Box sx={{ p: 3, color: "#9aa7b0" }}>No prescription file.</Box>
            ) : isPDF ? (
              <Box sx={{ p: 3, color: "#9aa7b0" }}>
                This prescription is a PDF. Click <a href={imgUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#8dd3c7" }}>Open Original</a> to view.
              </Box>
            ) : (
              <Box
                ref={containerRef}
                onWheel={handleWheel}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUpOrLeave}
                onPointerLeave={onPointerUpOrLeave}
                onPointerCancel={onPointerUpOrLeave}
                onDoubleClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  zoomBy(scale < 2 ? +0.8 : -0.8, { x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                sx={{
                  position: "relative",
                  overflow: "hidden",
                  height: { xs: 360, md: 520 },
                  cursor: scale > 1 && dragging ? "grabbing" : scale > 1 ? "grab" : "default",
                  userSelect: "none",
                  backgroundImage:
                    "linear-gradient(45deg, #111 25%, transparent 25%)," +
                    "linear-gradient(-45deg, #111 25%, transparent 25%)," +
                    "linear-gradient(45deg, transparent 75%, #111 75%)," +
                    "linear-gradient(-45deg, transparent 75%, #111 75%)",
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                }}
              >
                {/* Big overlay page arrows */}
                <IconButton
                  size="large"
                  onClick={() => setPageIdx(i => Math.max(0, i - 1))}
                  disabled={pageIdx <= 0}
                  sx={{
                    position: "absolute", top: "50%", left: 8, transform: "translateY(-50%)",
                    bgcolor: "rgba(0,0,0,0.35)", color: "#e6f2ef", "&:hover": { bgcolor: "rgba(0,0,0,0.5)" }
                  }}
                >
                  <ChevronLeftIcon />
                </IconButton>
                <IconButton
                  size="large"
                  onClick={() => setPageIdx(i => Math.min(attachments.length - 1, i + 1))}
                  disabled={pageIdx >= attachments.length - 1}
                  sx={{
                    position: "absolute", top: "50%", right: 8, transform: "translateY(-50%)",
                    bgcolor: "rgba(0,0,0,0.35)", color: "#e6f2ef", "&:hover": { bgcolor: "rgba(0,0,0,0.5)" }
                  }}
                >
                  <ChevronRightIcon />
                </IconButton>

                <img
                  ref={imgRef}
                  src={imgUrl}
                  alt="Prescription"
                  draggable={false}
                  style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    transformOrigin: "center center",
                    maxWidth: "100%",
                    maxHeight: "100%",
                    pointerEvents: "none",
                    display: "block",
                    margin: "auto",
                  }}
                />

                <Box
                  sx={{
                    position: "absolute",
                    right: 8, bottom: 8,
                    bgcolor: "rgba(0,0,0,0.5)",
                    px: 1, py: 0.5, borderRadius: 1,
                    fontSize: 12, color: "#cfe9e5"
                  }}
                >
                  {Math.round(scale * 100)}%
                </Box>
              </Box>
            )}
          </Box>

          {/* RIGHT: AI list */}
          <Box sx={{ display: "flex", flexDirection: "column", bgcolor: DARK_CARD, minHeight: 420 }}>
            <Box sx={{ p: 2.5 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Chip size="small" label="AI suggestions" sx={{ bgcolor: "#26313a", color: "#cfe9e5", fontWeight: 700 }} />
                <Typography variant="body2" sx={{ color: "#9cc9c2" }}>
                  (You must verify. AI can miss or misread.)
                </Typography>
              </Stack>

              {loadingAi ? (
                <Typography sx={{ color: "#9aa7b0", mt: 1 }}>Scanning…</Typography>
              ) : (!aiItems.length) ? (
                <Typography sx={{ color: "#9aa7b0", mt: 1 }}>
                  No AI items yet for this order.
                </Typography>
              ) : (
                <Box
                  sx={{
                    border: `1px solid ${BORDER}`,
                    borderRadius: 1.5,
                    overflow: "hidden",
                    maxHeight: { xs: 300, md: 520 },
                    overflowY: "auto",
                  }}
                >
                  <Box
                    component="table"
                    sx={{
                      width: "100%",
                      borderCollapse: "collapse",
                      "& th, & td": { p: 1, borderBottom: `1px solid ${BORDER}` },
                      "& th": { bgcolor: "#1f2630", fontWeight: 700, color: "#cfe9e5" }
                    }}
                  >
                    <thead>
                      <tr>
                        <th align="left">Name</th>
                        <th align="left">Strength / Form</th>
                        <th align="center">Qty</th>
                        <th align="left" style={{ width: 160 }}>Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiItems.map((i, idx) => {
                        const conf = Math.round((i.confidence || 0) * 100);
                        const confColor = conf >= 70 ? "success" : conf >= 45 ? "warning" : "error";
                        return (
                          <tr key={idx} style={{ background: idx % 2 ? "#1a2027" : "transparent" }}>
                            <td>
                              <Typography sx={{ fontWeight: 700, color: "#e6f2ef" }}>{i.name}</Typography>
                              {!!i.composition && (
                                <Typography variant="caption" sx={{ color: "#9cc9c2" }}>
                                  {i.composition}
                                </Typography>
                              )}
                            </td>
                            <td>
                              <Typography sx={{ color: "#cfe9e5" }}>
                                {i.strength || "-"} {i.form ? `• ${i.form}` : ""}
                              </Typography>
                            </td>
                            <td align="center">
                              <Chip size="small" label={i.quantity || 1} sx={{ bgcolor: "#2d3943", color: "#cfe9e5" }} />
                            </td>
                            <td>
                              <Stack spacing={0.5}>
                                <LinearProgress
                                  variant="determinate"
                                  value={conf}
                                  color={confColor}
                                  sx={{ height: 8, borderRadius: 1 }}
                                />
                                <Typography variant="caption" sx={{ color: "#9aa7b0" }}>{conf}%</Typography>
                              </Stack>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Box>
                </Box>
              )}

              {!!order?.notes && (
                <Box sx={{ mt: 1.5, p: 1.5, bgcolor: "#1d232a", border: `1px dashed ${BORDER}`, borderRadius: 1.5 }}>
                  <Typography sx={{ color: "#8dd3c7", fontWeight: 700, mb: 0.5 }}>User Note</Typography>
                  <Typography sx={{ color: "#cfe9e5" }}>{order.notes}</Typography>
                </Box>
              )}
            </Box>

            {/* Sticky footer actions moved to bottom (purple area) */}
            <Box
              sx={{
                mt: "auto",
                borderTop: `1px solid ${BORDER}`,
                p: 1.5,
                display: "flex",
                gap: 1,
                justifyContent: "flex-end",
                bgcolor: "#1b2229",
              }}
            >
              {/* Re-scan current */}
              <Button
                onClick={async () => {
                  if (imgUrl) {
                    try {
                      setLoadingAi(true);
                      const res = await axios.get(`${API_BASE_URL}/api/prescriptions/ai-scan`, { params: { url: imgUrl } });
                      setAi(res.data || { items: [] });
                    } catch {} finally { setLoadingAi(false); }
                  }
                  if (order?._id && token) {
                    try {
                      await axios.post(
                        `${API_BASE_URL}/api/prescriptions/reparse/${order._id}`,
                        {},
                        { headers: { Authorization: `Bearer ${token}` } }
                      );
                      onRefetched && onRefetched();
                    } catch {}
                  }
                }}
                size="small"
                variant="outlined"
                sx={{ color: "#8dd3c7", borderColor: "#3a4a55" }}
                startIcon={<RestartAltIcon fontSize="small" />}
              >
                Re-scan
              </Button>

              {/* Scan all */}
              <Button
                onClick={async () => {
                  if (!attachments.length) return;
                  try {
                    setLoadingAi(true);
                    const res = await axios.get(`${API_BASE_URL}/api/prescriptions/ai-scan-multi`, {
                      params: { urls: attachments },
                      paramsSerializer: params => {
                        const qs = [];
                        (params.urls || []).forEach(u => qs.push(`urls=${encodeURIComponent(u)}`));
                        return qs.join("&");
                      }
                    });
                    setAi(res.data || { items: [] });
                  } catch {} finally { setLoadingAi(false); }

                  if (order?._id && token) {
                    try {
                      await axios.post(
                        `${API_BASE_URL}/api/prescriptions/reparse/${order._id}`,
                        {},
                        { headers: { Authorization: `Bearer ${token}` } }
                      );
                      onRefetched && onRefetched();
                    } catch {}
                  }
                }}
                size="small"
                variant="outlined"
                sx={{ color: "#8dd3c7", borderColor: "#3a4a55" }}
              >
                Scan All
              </Button>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ borderTop: `1px solid ${BORDER}` }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderColor: "#3a4a55", color: "#cfe9e5" }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
