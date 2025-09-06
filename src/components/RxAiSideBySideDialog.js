// src/components/RxAiSideBySideDialog.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Chip, Divider, LinearProgress, Stack, IconButton, Fab, SwipeableDrawer, useMediaQuery
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ListAltIcon from "@mui/icons-material/ListAlt";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const DARK_BG = "#181d23";
const DARK_CARD = "#21272b";
const BORDER = "#2f3840";

export default function RxAiSideBySideDialog({ open, onClose, order, token, onRefetched }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // attachments list (fallback to single)
  const attachments = useMemo(() => {
    const list = Array.isArray(order?.attachments) && order.attachments.length
      ? order.attachments
      : (order?.prescriptionUrl ? [order.prescriptionUrl] : []);
    return list.map(u => (u.startsWith("/uploads/") ? `${API_BASE_URL}${u}` : u));
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

  // pinch-to-zoom state
  const touchesRef = useRef(new Map()); // pointerId -> {x,y}
  const pinchStart = useRef({ dist: 0, scale: 1, center: { x: 0, y: 0 }, offset: { x: 0, y: 0 } });
  const [isPinching, setIsPinching] = useState(false);

  // --- AI state/polling ---
  const [ai, setAi] = useState(order?.ai || null);
  const [loadingAi, setLoadingAi] = useState(false);

  // mobile AI drawer
  const [aiOpen, setAiOpen] = useState(false);

  // seed local AI when order changes
  useEffect(() => {
    setAi(order?.ai || null);
  }, [order?._id]);

  // fetch AI once when dialog opens
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
      setAiOpen(false);
      touchesRef.current.clear();
    }
  }, [open]);

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const zoomBy = (delta, center) => {
    const oldScale = scale;
    const newScale = clamp(oldScale + delta, 1, 5);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cx = center?.x ?? rect.width / 2;
      const cy = center?.y ?? rect.height / 2;

      const dx = cx - rect.width / 2 - offset.x;
      const dy = cy - rect.height / 2 - offset.y;

      const ratio = newScale / oldScale - 1;
      setOffset(o => ({ x: o.x - dx * ratio, y: o.y - dy * ratio }));
    }
    setScale(newScale);
  };

  const handleWheel = (e) => {
    // desktop smooth zoom
    if (isMobile) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const center = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    zoomBy(delta, center);
  };

  const onPointerDown = (e) => {
    // record pointer for potential pinch
    e.currentTarget.setPointerCapture?.(e.pointerId);
    touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (touchesRef.current.size === 2) {
      // start pinch
      const pts = Array.from(touchesRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const center = {
        x: (pts[0].x + pts[1].x) / 2 - e.currentTarget.getBoundingClientRect().left,
        y: (pts[0].y + pts[1].y) / 2 - e.currentTarget.getBoundingClientRect().top,
      };
      pinchStart.current = { dist, scale, center, offset: { ...offset } };
      setIsPinching(true);
      setDragging(false);
      return;
    }

    // single-finger drag
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

      const newScale = clamp(pinchStart.current.scale * factor, 1, 5);
      setScale(newScale);

      // keep the pinch center stable by adjusting offset
      const rect = containerRef.current.getBoundingClientRect();
      const cx = pinchStart.current.center.x;
      const cy = pinchStart.current.center.y;
      const ratio = newScale / pinchStart.current.scale - 1;
      const dxCenter = cx - rect.width / 2 - pinchStart.current.offset.x;
      const dyCenter = cy - rect.height / 2 - pinchStart.current.offset.y;

      setOffset({
        x: pinchStart.current.offset.x - dxCenter * ratio,
        y: pinchStart.current.offset.y - dyCenter * ratio,
      });
      return;
    }

    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({ x: startOffset.current.x + dx, y: startOffset.current.y + dy });
  };

  const onPointerUpOrLeave = (e) => {
    touchesRef.current.delete(e.pointerId);
    if (touchesRef.current.size < 2 && isPinching) {
      setIsPinching(false);
      pinchStart.current = { dist: 0, scale: 1, center: { x: 0, y: 0 }, offset: { x: 0, y: 0 } };
    }
    setDragging(false);
  };

  const aiItems = ai?.items || [];

  const copyAiList = async () => {
    const text = aiItems.map(i => {
      const parts = [i.name];
      if (i.strength) parts.push(i.strength);
      if (i.form) parts.push(`(${i.form})`);
      parts.push(`x${i.quantity || 1}`);
      return parts.join(" ");
    }).join("\n");
    try { await navigator.clipboard.writeText(text || ""); } catch {}
  };

  const AiList = (
    <Box sx={{ p: 2, bgcolor: DARK_CARD, height: "100%", display: "flex", flexDirection: "column" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Chip size="small" label="AI suggestions" sx={{ bgcolor: "#26313a", color: "#cfe9e5", fontWeight: 700 }} />
        <Typography variant="body2" sx={{ color: "#9cc9c2" }}>
          (You must verify. AI can miss or misread.)
        </Typography>
        <Box sx={{ ml: "auto" }}>
          <Button onClick={copyAiList} size="small" variant="outlined" sx={{ color: "#8dd3c7", borderColor: "#3a4a55" }}>
            Copy list
          </Button>
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
                  await axios.post(`${API_BASE_URL}/api/prescriptions/reparse/${order._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
                  onRefetched && onRefetched();
                } catch {}
              }
            }}
            size="small"
            variant="outlined"
            sx={{ ml: 1, color: "#8dd3c7", borderColor: "#3a4a55" }}
            startIcon={<RestartAltIcon fontSize="small" />}
          >
            Re-scan
          </Button>
          <Button
            onClick={async () => {
              if (!attachments.length) return;
              try {
                setLoadingAi(true);
                const res = await axios.get(`${API_BASE_URL}/api/prescriptions/ai-scan-multi`, {
                  params: { urls: attachments },
                  paramsSerializer: p => (p.urls || []).map(u => `urls=${encodeURIComponent(u)}`).join("&"),
                });
                setAi(res.data || { items: [] });
              } catch {} finally { setLoadingAi(false); }
              if (order?._id && token) {
                try {
                  await axios.post(`${API_BASE_URL}/api/prescriptions/reparse/${order._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
                  onRefetched && onRefetched();
                } catch {}
              }
            }}
            size="small"
            variant="outlined"
            sx={{ ml: 1, color: "#8dd3c7", borderColor: "#3a4a55" }}
          >
            Scan All
          </Button>
        </Box>
      </Stack>

      {loadingAi ? (
        <Typography sx={{ color: "#9aa7b0", mt: 1 }}>Scanning…</Typography>
      ) : (!aiItems.length) ? (
        <Typography sx={{ color: "#9aa7b0", mt: 1 }}>No AI items yet for this order.</Typography>
      ) : (
        <Box
          sx={{
            border: `1px solid ${BORDER}`,
            borderRadius: 1.5,
            overflow: "hidden",
            flex: 1,
            minHeight: 200,
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
                        <Typography variant="caption" sx={{ color: "#9cc9c2" }}>{i.composition}</Typography>
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
                        <LinearProgress variant="determinate" value={conf} color={confColor} sx={{ height: 8, borderRadius: 1 }} />
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
        <>
          <Divider sx={{ my: 1.5, borderColor: BORDER }} />
          <Box sx={{ p: 1.5, bgcolor: "#1d232a", border: `1px dashed ${BORDER}`, borderRadius: 1.5 }}>
            <Typography sx={{ color: "#8dd3c7", fontWeight: 700, mb: 0.5 }}>User Note</Typography>
            <Typography sx={{ color: "#cfe9e5" }}>{order.notes}</Typography>
          </Box>
        </>
      )}
    </Box>
  );

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
          {/* LEFT (or Top on mobile): Image area */}
          <Box
            sx={{
              position: "relative",
              borderRight: { md: `1px solid ${BORDER}` },
              bgcolor: "#0f1318",
              height: "100%",
              minHeight: isMobile ? 420 : 520
            }}
          >
            {/* Top toolbar */}
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

              {/* Pager (attachments) */}
              <Box sx={{ ml: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
                <IconButton size="small" disabled={pageIdx <= 0} onClick={() => setPageIdx(i => Math.max(0, i - 1))} sx={{ color: "#cfe9e5" }}>
                  <ChevronLeftIcon fontSize="small" />
                </IconButton>
                <Typography variant="caption" sx={{ color: "#cfe9e5" }}>
                  {attachments.length ? `${pageIdx + 1} / ${attachments.length}` : "0 / 0"}
                </Typography>
                <IconButton
                  size="small"
                  disabled={pageIdx >= attachments.length - 1}
                  onClick={() => setPageIdx(i => Math.min(attachments.length - 1, i + 1))}
                  sx={{ color: "#cfe9e5" }}
                >
                  <ChevronRightIcon fontSize="small" />
                </IconButton>
              </Box>

              <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
                <IconButton size="small" onClick={() => zoomBy(-0.2)} sx={{ color: "#cfe9e5" }}><ZoomOutIcon fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => zoomBy(+0.2)} sx={{ color: "#cfe9e5" }}><ZoomInIcon fontSize="small" /></IconButton>
                <IconButton
                  size="small"
                  onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
                  sx={{ color: "#cfe9e5" }}
                >
                  <RestartAltIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>

            {/* Image / PDF area */}
            {(!imgUrl) ? (
              <Box sx={{ p: 3, color: "#9aa7b0" }}>No prescription file.</Box>
            ) : isPDF ? (
              <Box sx={{ p: 3, color: "#9aa7b0" }}>
                This prescription is a PDF. Click{" "}
                <a href={imgUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#8dd3c7" }}>Open Original</a> to view.
              </Box>
            ) : (
              <Box
                ref={containerRef}
                onWheel={handleWheel}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUpOrLeave}
                onPointerCancel={onPointerUpOrLeave}
                onPointerLeave={onPointerUpOrLeave}
                onDoubleClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  zoomBy(scale < 2 ? +0.9 : -0.9, { x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                sx={{
                  position: "relative",
                  overflow: "hidden",
                  height: { xs: 420, md: 520 },
                  cursor: dragging || isPinching ? "grabbing" : "grab",
                  touchAction: "none", // allow custom pinch/drag
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

                {/* Mobile FAB to open AI list */}
                {isMobile && (
                  <Fab
                    color="primary"
                    size="medium"
                    onClick={() => setAiOpen(true)}
                    sx={{
                      position: "absolute",
                      right: 16,
                      bottom: 16,
                      bgcolor: "#14b8a6",
                      "&:hover": { bgcolor: "#0ea5a2" }
                    }}
                  >
                    <ListAltIcon />
                  </Fab>
                )}
              </Box>
            )}
          </Box>

          {/* RIGHT panel only on desktop; on mobile we use the drawer */}
          {!isMobile && (
            <Box sx={{ p: 2.5, bgcolor: DARK_CARD, minHeight: 420 }}>
              {AiList}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ borderTop: `1px solid ${BORDER}` }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderColor: "#3a4a55", color: "#cfe9e5" }}>
          Close
        </Button>
      </DialogActions>

      {/* Mobile AI Drawer */}
      {isMobile && (
        <SwipeableDrawer
          anchor="bottom"
          open={aiOpen}
          onOpen={() => setAiOpen(true)}
          onClose={() => setAiOpen(false)}
          PaperProps={{
            sx: {
              bgcolor: DARK_BG,
              color: "#fff",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              height: "70vh",
            }
          }}
        >
          <Box sx={{ height: "100%" }}>
            <Box sx={{ width: 48, height: 4, bgcolor: "#374151", borderRadius: 999, mx: "auto", mt: 1.2, mb: 1 }} />
            {AiList}
          </Box>
        </SwipeableDrawer>
      )}
    </Dialog>
  );
}
