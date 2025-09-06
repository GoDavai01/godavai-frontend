// src/components/RxAiSideBySideDialog.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { ScrollArea } from "../components/ui/scroll-area";
import { Progress } from "../components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  List,
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const DARK_BG = "bg-[#0f1318]";
const BORDER = "border-emerald-900/30";

/**
 * Props:
 * - open, onClose
 * - order (expects .attachments[] OR .prescriptionUrl, and optional .ai, .notes, ._id)
 * - token (jwt)
 * - onRefetched (optional cb after reparse)
 */
export default function RxAiSideBySideDialog({ open, onClose, order, token, onRefetched }) {
  const containerRef = useRef(null);
  const touchesRef = useRef(new Map()); // pointerId -> {x,y}
  const pinchStart = useRef({ dist: 0, scale: 1, center: { x: 0, y: 0 }, offset: { x: 0, y: 0 } });

  // Build attachment list
  const attachments = useMemo(() => {
    const list =
      Array.isArray(order?.attachments) && order.attachments.length
        ? order.attachments
        : order?.prescriptionUrl
        ? [order.prescriptionUrl]
        : [];
    return list.map((u) => (u.startsWith("/uploads/") ? `${API_BASE_URL}${u}` : u));
  }, [order]);

  const [pageIdx, setPageIdx] = useState(0);
  const imgUrl = attachments[pageIdx] || "";
  const isPDF = /\.pdf($|\?)/i.test(imgUrl);

  // zoom/pan
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });
  const [isPinching, setIsPinching] = useState(false);

  // AI
  const [ai, setAi] = useState(order?.ai || null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Mobile AI sheet
  const [sheetOpen, setSheetOpen] = useState(false);

  // seed AI when order changes
  useEffect(() => {
    setAi(order?.ai || null);
  }, [order?._id]);

  // fetch AI when opened
  useEffect(() => {
    if (!open || !order?._id || !token) return;
    let active = true;
    (async () => {
      try {
        setLoadingAi(true);
        const { data } = await axios.get(`${API_BASE_URL}/api/prescriptions/ai/${order._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (active) setAi(data || { items: [] });
      } catch {
        if (active) setAi(order?.ai || { items: [] });
      } finally {
        if (active) setLoadingAi(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // reset on close
  useEffect(() => {
    if (!open) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
      setDragging(false);
      setIsPinching(false);
      touchesRef.current.clear();
      setSheetOpen(false);
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
      setOffset((o) => ({ x: o.x - dx * ratio, y: o.y - dy * ratio }));
    }
    setScale(newScale);
  };

  // Wheel zoom (desktop)
  const onWheel = (e) => {
    // allow scroll inside AI table when mouse not over image zone – so only prevent here:
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const center = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    zoomBy(e.deltaY > 0 ? -0.12 : 0.12, center);
  };

  // Pointer (drag + pinch)
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (touchesRef.current.size === 2) {
      const pts = Array.from(touchesRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const rect = containerRef.current.getBoundingClientRect();
      const center = { x: (pts[0].x + pts[1].x) / 2 - rect.left, y: (pts[0].y + pts[1].y) / 2 - rect.top };
      pinchStart.current = { dist, scale, center, offset: { ...offset } };
      setIsPinching(true);
      setDragging(false);
      return;
    }

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
    touchesRef.current.delete(e.pointerId);
    if (touchesRef.current.size < 2 && isPinching) {
      setIsPinching(false);
      pinchStart.current = { dist: 0, scale: 1, center: { x: 0, y: 0 }, offset: { x: 0, y: 0 } };
    }
    setDragging(false);
  };

  const aiItems = ai?.items || [];

  const copyAi = async () => {
    try {
      const text = aiItems
        .map((i) => {
          const parts = [i.name];
          if (i.strength) parts.push(i.strength);
          if (i.form) parts.push(`(${i.form})`);
          parts.push(`x${i.quantity || 1}`);
          return parts.join(" ");
        })
        .join("\n");
      await navigator.clipboard.writeText(text || "");
    } catch {}
  };

  const reScanActive = async () => {
    if (!imgUrl) return;
    try {
      setLoadingAi(true);
      const { data } = await axios.get(`${API_BASE_URL}/api/prescriptions/ai-scan`, { params: { url: imgUrl } });
      setAi(data || { items: [] });
    } catch {} finally {
      setLoadingAi(false);
    }
    if (order?._id && token) {
      try {
        await axios.post(`${API_BASE_URL}/api/prescriptions/reparse/${order._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        onRefetched && onRefetched();
      } catch {}
    }
  };

  const scanAll = async () => {
    if (!attachments.length) return;
    try {
      setLoadingAi(true);
      const { data } = await axios.get(`${API_BASE_URL}/api/prescriptions/ai-scan-multi`, {
        params: { urls: attachments },
        paramsSerializer: (p) => (p.urls || []).map((u) => `urls=${encodeURIComponent(u)}`).join("&"),
      });
      setAi(data || { items: [] });
    } catch {} finally {
      setLoadingAi(false);
    }
    if (order?._id && token) {
      try {
        await axios.post(`${API_BASE_URL}/api/prescriptions/reparse/${order._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        onRefetched && onRefetched();
      } catch {}
    }
  };

  // ---- RENDER ----
  const ImagePane = (
    <Card className={`rounded-2xl ${BORDER} border overflow-hidden ${DARK_BG}`}>
      <div className="flex items-center gap-2 border-b border-emerald-900/30 px-2.5 py-2">
        <Badge className="bg-slate-800/80 text-emerald-200 font-bold">Original Prescription</Badge>

        {imgUrl && (
          <Button variant="ghost" size="sm" className="text-teal-300 hover:text-teal-200" asChild>
            <a href={imgUrl} target="_blank" rel="noreferrer">
              Open Original <ExternalLink className="ml-1 h-4 w-4" />
            </a>
          </Button>
        )}

        {/* Pager */}
        <div className="ml-1 inline-flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-emerald-200"
            disabled={pageIdx <= 0}
            onClick={() => setPageIdx((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-emerald-100/80 tabular-nums">
            {attachments.length ? `${pageIdx + 1} / ${attachments.length}` : "0 / 0"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-emerald-200"
            disabled={pageIdx >= attachments.length - 1}
            onClick={() => setPageIdx((i) => Math.min(attachments.length - 1, i + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="ml-auto inline-flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-200" onClick={() => zoomBy(-0.2)}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-200" onClick={() => zoomBy(+0.2)}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-emerald-200"
            onClick={() => {
              setScale(1);
              setOffset({ x: 0, y: 0 });
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Image / PDF */}
      {!imgUrl ? (
        <CardContent className="p-6 text-slate-300">No prescription file.</CardContent>
      ) : isPDF ? (
        <CardContent className="p-6 text-slate-300">
          This prescription is a PDF. Use{" "}
          <a href={imgUrl} target="_blank" rel="noreferrer" className="text-teal-300 underline">
            Open Original
          </a>{" "}
          to view.
        </CardContent>
      ) : (
        <div
          ref={containerRef}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUpOrLeave}
          onPointerCancel={onPointerUpOrLeave}
          onPointerLeave={onPointerUpOrLeave}
          onDoubleClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            zoomBy(scale < 2 ? +0.9 : -0.9, { x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          className="relative h-[70vh] md:h-[520px] overflow-hidden cursor-grab select-none touch-none"
          style={{
            backgroundImage:
              "linear-gradient(45deg, #0b1114 25%, transparent 25%),linear-gradient(-45deg, #0b1114 25%, transparent 25%),linear-gradient(45deg, transparent 75%, #0b1114 75%),linear-gradient(-45deg, transparent 75%, #0b1114 75%)",
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          }}
        >
          <motion.img
            src={imgUrl}
            alt="Prescription"
            draggable={false}
            className="pointer-events-none block max-h-full max-w-full mx-auto"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: "center" }}
          />
          <div className="absolute right-2 bottom-2 rounded bg-black/50 px-2 py-0.5 text-xs text-emerald-100">
            {Math.round(scale * 100)}%
          </div>

          {/* Mobile FAB to open AI list */}
          <Button
            size="icon"
            className="md:hidden absolute right-3 bottom-3 rounded-full h-12 w-12 bg-teal-500 hover:bg-teal-600"
            onClick={() => setSheetOpen(true)}
          >
            <List className="h-6 w-6 text-black" />
          </Button>
        </div>
      )}
    </Card>
  );

  const AiPane = (
    <Card className={`rounded-2xl ${BORDER} border overflow-hidden ${DARK_BG}`}>
      <div className="flex items-center gap-2 border-b border-emerald-900/30 px-3 py-2">
        <Badge className="bg-slate-800/80 text-emerald-200 font-bold">AI suggestions</Badge>
        <span className="text-xs text-emerald-100/80">(Verify manually; AI may miss or misread.)</span>
        <div className="ml-auto inline-flex gap-2">
          <Button variant="outline" size="sm" className="border-emerald-800 text-emerald-200" onClick={copyAi}>
            Copy list
          </Button>
          <Button variant="outline" size="sm" className="border-emerald-800 text-emerald-200" onClick={reScanActive}>
            <RotateCcw className="mr-1 h-4 w-4" />
            Re-scan
          </Button>
          <Button variant="outline" size="sm" className="border-emerald-800 text-emerald-200" onClick={scanAll}>
            Scan All
          </Button>
        </div>
      </div>

      <CardContent className="p-0">
        {loadingAi ? (
          <div className="p-4 text-slate-300">Scanning…</div>
        ) : !(aiItems?.length) ? (
          <div className="p-4 text-slate-300">No AI items yet for this order.</div>
        ) : (
          <ScrollArea className="max-h-[70vh] md:max-h-[520px]">
            <Table className="text-emerald-100/90">
              <TableHeader>
                <TableRow className="bg-slate-900/60">
                  <TableHead className="text-emerald-200">Name</TableHead>
                  <TableHead className="text-emerald-200">Strength / Form</TableHead>
                  <TableHead className="text-emerald-200 text-center">Qty</TableHead>
                  <TableHead className="text-emerald-200 w-44">Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aiItems.map((i, idx) => {
                  const conf = Math.round((i.confidence || 0) * 100);
                  return (
                    <TableRow key={idx} className={idx % 2 ? "bg-slate-900/30" : ""}>
                      <TableCell>
                        <div className="font-semibold text-emerald-50">{i.name}</div>
                        {i.composition ? (
                          <div className="text-xs text-emerald-200/70">{i.composition}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-emerald-100">
                        {(i.strength || "-")}{i.form ? ` • ${i.form}` : ""}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-slate-800/80 text-emerald-100">{i.quantity || 1}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={conf} className="h-2" />
                          <div className="text-xs text-emerald-200/70">{conf}%</div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        {order?.notes ? (
          <div className="m-3 rounded-xl border border-dashed border-emerald-900/40 p-3">
            <div className="text-teal-300 font-semibold mb-1">User Note</div>
            <div className="text-emerald-100">{order.notes}</div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[1000px] p-0 border-emerald-900/40">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="text-teal-300">Rx & AI Viewer</DialogTitle>
          <p className="text-xs text-emerald-100/70">
            Compare the original prescription with AI suggestions before quoting.
          </p>
        </DialogHeader>

        <div className="px-3 pb-3">
          {/* Grid: side-by-side on md+, stacked on mobile with AI in sheet */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[58%_42%]">
            {ImagePane}
            <div className="hidden md:block">{AiPane}</div>
          </div>
        </div>

        <DialogFooter className="px-4 pb-4">
          <Button variant="outline" className="border-emerald-800 text-emerald-200" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Mobile AI Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-[72vh] bg-[#0f1318] text-white border-emerald-900/40">
          <SheetHeader>
            <SheetTitle className="text-teal-300">AI suggestions</SheetTitle>
          </SheetHeader>
          <div className="mt-2">{AiPane}</div>
        </SheetContent>
      </Sheet>
    </Dialog>
  );
}
