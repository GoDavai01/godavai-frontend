// src/components/RxAiSideBySideDialog.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";

// shadcn/ui (your local components)
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";

// lucide-react
import {
  ZoomIn, ZoomOut, RotateCcw, ExternalLink, ChevronLeft, ChevronRight, List,
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const BG = "bg-[#0b1114]";                   // deep slate/teal
const CARD = "bg-[#0d1418]";                 // card bg
const BORDER = "border-emerald-900/40";      // subtle emerald border
const TXT_WEAK = "text-emerald-100/75";
const TXT = "text-emerald-100";

export default function RxAiSideBySideDialog({ open, onClose, order, token, onRefetched }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const touchesRef = useRef(new Map());
  const pinchStart = useRef({ dist: 0, scale: 1, center: { x: 0, y: 0 }, offset: { x: 0, y: 0 } });

  // live container + image sizing for clamping
  const [ctrSize, setCtrSize] = useState({ w: 0, h: 0 });
  const [imgNat, setImgNat] = useState({ w: 0, h: 0 });

  // ---- attachments
  const attachments = useMemo(() => {
    const list = Array.isArray(order?.attachments) && order.attachments.length
      ? order.attachments
      : (order?.prescriptionUrl ? [order.prescriptionUrl] : []);
    return list.map((u) => (u.startsWith("/uploads/") ? `${API_BASE_URL}${u}` : u));
  }, [order]);

  const [pageIdx, setPageIdx] = useState(0);
  const imgUrl = attachments[pageIdx] || "";
  const isPDF = /\.pdf($|\?)/i.test(imgUrl);

  // ---- zoom/pan
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });

  // ---- AI
  const [ai, setAi] = useState(order?.ai || null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // seed AI when order changes
  useEffect(() => setAi(order?.ai || null), [order?._id]);

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
        active && setAi(data || { items: [] });
      } catch {
        active && setAi(order?.ai || { items: [] });
      } finally {
        active && setLoadingAi(false);
      }
    })();
    return () => { active = false; };
  }, [open, order?._id, token]); // eslint-disable-line

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

  // observe container size for proper clamping
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setCtrSize({ w: r.width, h: r.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // read natural image size once per url
  useEffect(() => {
    if (!imgUrl || isPDF) return;
    const img = new Image();
    img.onload = () => setImgNat({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imgUrl;
  }, [imgUrl, isPDF]);

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  // compute “fit” size for scale=1 (contain)
  const fitSize = (() => {
    if (!ctrSize.w || !ctrSize.h || !imgNat.w || !imgNat.h) return { w: 0, h: 0 };
    const scaleFit = Math.min(ctrSize.w / imgNat.w, ctrSize.h / imgNat.h);
    return { w: imgNat.w * scaleFit, h: imgNat.h * scaleFit };
  })();

  // clamp offset so the image can’t fly away
  const clampOffset = (next) => {
    if (!fitSize.w || !fitSize.h || !ctrSize.w || !ctrSize.h) return next;
    const contentW = fitSize.w * scale;
    const contentH = fitSize.h * scale;
    const maxX = Math.max(0, (contentW - ctrSize.w) / 2);
    const maxY = Math.max(0, (contentH - ctrSize.h) / 2);
    return {
      x: clamp(next.x, -maxX, maxX),
      y: clamp(next.y, -maxY, maxY),
    };
  };

  const zoomBy = (delta, center) => {
    const old = scale;
    const next = clamp(old + delta, 1, 5);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cx = center?.x ?? rect.width / 2;
      const cy = center?.y ?? rect.height / 2;
      const dx = cx - rect.width / 2 - offset.x;
      const dy = cy - rect.height / 2 - offset.y;
      const ratio = next / old - 1;
      const projected = { x: offset.x - dx * ratio, y: offset.y - dy * ratio };
      setOffset(clampOffset(projected));
    }
    setScale(next);
  };

  // (B) Re-clamp whenever scale/container/image changes
  useEffect(() => {
    setOffset((o) => clampOffset(o));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, ctrSize.w, ctrSize.h, imgNat.w, imgNat.h]);

  // wheel zoom (desktop)
  const onWheel = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const center = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    zoomBy(e.deltaY > 0 ? -0.12 : 0.12, center);
  };

  // pointer handlers (drag + pinch)
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

    // (A) ⛔ no panning when scale is 1 (fit-to-screen)
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
      const nextScale = clamp(pinchStart.current.scale * factor, 1, 5);
      setScale(nextScale);

      const rect = containerRef.current.getBoundingClientRect();
      const cx = pinchStart.current.center.x;
      const cy = pinchStart.current.center.y;
      const ratio = nextScale / pinchStart.current.scale - 1;
      const dxC = cx - rect.width / 2 - pinchStart.current.offset.x;
      const dyC = cy - rect.height / 2 - pinchStart.current.offset.y;
      setOffset(clampOffset({
        x: pinchStart.current.offset.x - dxC * ratio,
        y: pinchStart.current.offset.y - dyC * ratio,
      }));
      return;
    }

    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset(clampOffset({ x: startOffset.current.x + dx, y: startOffset.current.y + dy }));
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
      const text = aiItems.map(i => {
        const parts = [i.name];
        if (i.strength) parts.push(i.strength);
        if (i.form) parts.push(`(${i.form})`);
        parts.push(`x${i.quantity || 1}`);
        return parts.join(" ");
      }).join("\n");
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
        paramsSerializer: (p) => (p.urls || []).map(u => `urls=${encodeURIComponent(u)}`).join("&"),
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

  // ───────────────────────── P A N E S ─────────────────────────
  const ImagePane = (
    <Card className={`rounded-2xl ${BORDER} border overflow-hidden ${CARD}`}>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-emerald-900/40 px-2.5 py-2 bg-[#0d1418]/95 backdrop-blur">
        <Badge className="bg-slate-900 text-emerald-200 font-bold">Original Prescription</Badge>

        {imgUrl && (
          <Button variant="ghost" size="sm" className="text-teal-300 hover:text-teal-200" asChild>
            <a href={imgUrl} target="_blank" rel="noreferrer">
              Open Original <ExternalLink className="ml-1 h-4 w-4" />
            </a>
          </Button>
        )}

        <div className="ml-1 inline-flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-200"
                  disabled={pageIdx <= 0}
                  onClick={() => { setPageIdx(i => Math.max(0, i - 1)); setScale(1); setOffset({x:0,y:0}); }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs tabular-nums text-emerald-100/80">
            {attachments.length ? `${pageIdx + 1} / ${attachments.length}` : "0 / 0"}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-200"
                  disabled={pageIdx >= attachments.length - 1}
                  onClick={() => { setPageIdx(i => Math.min(attachments.length - 1, i + 1)); setScale(1); setOffset({x:0,y:0}); }}>
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
          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-200"
                  onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!imgUrl ? (
        <CardContent className={`p-6 ${TXT_WEAK}`}>No prescription file.</CardContent>
      ) : isPDF ? (
        <CardContent className={`p-6 ${TXT_WEAK}`}>
          This prescription is a PDF. Use{" "}
          <a href={imgUrl} target="_blank" rel="noreferrer" className="text-teal-300 underline">Open Original</a>{" "}
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
          className={`relative h-[70vh] md:h-[520px] overflow-hidden ${scale > 1 ? "cursor-grab" : "cursor-default"} select-none touch-none ${BG}`}
          style={{
            backgroundImage:
              "linear-gradient(45deg, #0a1013 25%, transparent 25%),linear-gradient(-45deg, #0a1013 25%, transparent 25%),linear-gradient(45deg, transparent 75%, #0a1013 75%),linear-gradient(-45deg, transparent 75%, #0a1013 75%)",
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          }}
        >
          <motion.img
            ref={imgRef}
            src={imgUrl}
            alt="Prescription"
            draggable={false}
            className="pointer-events-none block max-h-full max-w-full mx-auto"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: "center" }}
          />
          <div className="absolute right-2 bottom-2 rounded bg-black/60 px-2 py-0.5 text-xs text-emerald-100">
            {Math.round(scale * 100)}%
          </div>

          {/* Mobile: FAB to open AI list */}
          <Button
            size="icon"
            className="md:hidden absolute right-3 bottom-3 rounded-full h-12 w-12 bg-teal-500 hover:bg-teal-600"
            onClick={() => setSheetOpen(true)}
            aria-label="Open AI suggestions"
          >
            <List className="h-6 w-6 text-black" />
          </Button>
        </div>
      )}
    </Card>
  );

  const AiPane = (
    <Card className={`rounded-2xl ${BORDER} border overflow-hidden ${CARD}`}>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-emerald-900/40 px-3 py-2 bg-[#0d1418]/95 backdrop-blur">
        <Badge className="bg-slate-900 text-emerald-200 font-bold">AI suggestions</Badge>
        <span className={`text-xs ${TXT_WEAK}`}>(Verify manually; AI may miss or misread.)</span>
        <div className="ml-auto inline-flex gap-2">
          <Button variant="outline" size="sm" className="border-emerald-800 text-emerald-200" onClick={copyAi}>
            Copy list
          </Button>
          <Button variant="outline" size="sm" className="border-emerald-800 text-emerald-200" onClick={reScanActive}>
            <RotateCcw className="mr-1 h-4 w-4" /> Re-scan
          </Button>
          <Button variant="outline" size="sm" className="border-emerald-800 text-emerald-200" onClick={scanAll}>
            Scan All
          </Button>
        </div>
      </div>

      <CardContent className="p-0">
        {loadingAi ? (
          <div className={`p-4 ${TXT_WEAK}`}>Scanning…</div>
        ) : !(aiItems?.length) ? (
          <div className={`p-4 ${TXT_WEAK}`}>No AI items yet for this order.</div>
        ) : (
          <ScrollArea className="max-h-[70vh] md:max-h-[520px]">
            <Table className={`${TXT}`}>
              <TableHeader>
                <TableRow className="bg-slate-950/70">
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
                    <TableRow key={idx} className={idx % 2 ? "bg-slate-900/40" : ""}>
                      <TableCell>
                        <div className="font-semibold text-emerald-50">{i.name}</div>
                        {i.composition ? <div className="text-xs text-emerald-200/70">{i.composition}</div> : null}
                      </TableCell>
                      <TableCell className="text-emerald-100">
                        {(i.strength || "-")}{i.form ? ` • ${i.form}` : ""}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-slate-900 text-emerald-100">{i.quantity || 1}</Badge>
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
            <div className={`${TXT}`}>{order.notes}</div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {/* High z-index to ensure it’s above everything */}
      <DialogContent
        appearance="custom"
        className={`z-[10050] sm:max-w-[1000px] p-0 ${BORDER} !bg-[#0b1114] !text-emerald-100`}
      >
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="text-teal-300">Rx & AI Viewer</DialogTitle>
          <p className={`text-xs ${TXT_WEAK}`}>Compare the original prescription with AI suggestions before quoting.</p>
        </DialogHeader>

        <div className="px-3 pb-3">
          {/* Side-by-side on md+, stacked on mobile (AI in bottom sheet) */}
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

      {/* Mobile AI Sheet with high z-index too */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="z-[10060] h-[72vh] bg-[#0b1114] text-white border-emerald-900/40">
          <SheetHeader>
            <SheetTitle className="text-teal-300">AI suggestions</SheetTitle>
          </SheetHeader>
          <div className="mt-2">{AiPane}</div>
        </SheetContent>
      </Sheet>
    </Dialog>
  );
}
