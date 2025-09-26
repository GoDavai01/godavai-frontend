// src/components/generics/GenericSaverAtCheckout.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";

const DEEP = "#0f6e51";

function price(m) {
  return Number(m?.price ?? m?.mrp ?? m?.sellingPrice ?? 0) || 0;
}
function savePair(brand, gen) {
  const s = Math.max(0, price(brand) - price(gen));
  return { rupees: s, pct: s ? Math.round((s / price(brand)) * 100) : 0 };
}

// Reusable 3D button look (same color for both actions)
const BTN3D_CLASS =
  "flex-1 relative font-extrabold text-white rounded-xl px-3 py-2 " +
  "cursor-pointer transition-transform focus:outline-none focus:ring-2 focus:ring-emerald-300 " +
  "hover:translate-y-[1px] active:translate-y-[2px]";
const BTN3D_STYLE = {
  background: "linear-gradient(180deg, #13a079 0%, #0f6e51 100%)",
  boxShadow: "0 4px 0 #0b4f3d, 0 8px 16px rgba(15,110,81,0.30)",
};

export default function GenericSaverAtCheckout({
  open,
  onOpenChange,
  items = [],            // [{ item, qty }]
  fetchAlternatives,     // async (brandItem) -> { brand, generics[] }
  onReplaceItem,         // (brand, bestGeneric, qty) => void
  onProceed,             // () => void
  defaultSnoozeDays = 7, // unused now; kept to avoid prop errors elsewhere
}) {
  const [rows, setRows] = useState([]);   // [{brand, best, saving, qty}]
  const [loading, setLoading] = useState(true);
  const [readyToRender, setReadyToRender] = useState(false);

  // Reset all state every time we open (prevents stale rows)
  useEffect(() => {
    if (!open) return;
    setRows([]);
    setLoading(true);
    setReadyToRender(false);
  }, [open]);

  // Load suggestions
  useEffect(() => {
    if (!open) return;

    (async () => {
      setLoading(true);
      const out = [];
      const start = Date.now();

      for (const { item, qty } of items) {
        const data = await fetchAlternatives(item); // { brand, generics }
        const best = (data?.generics || [])[0];

        if (data?.brand && best && price(data.brand) > price(best)) {
          out.push({
            brand: data.brand,
            qty: qty || 1,
            best,
            saving: savePair(data.brand, best),
          });
        }
      }

      setRows(out);
      setLoading(false);

      const elapsed = Date.now() - start;
      const MIN_VISIBLE = 350;
      if (elapsed < MIN_VISIBLE) {
        setTimeout(() => setReadyToRender(true), MIN_VISIBLE - elapsed);
      } else {
        setReadyToRender(true);
      }
    })();
  }, [open, items, fetchAlternatives]);

  const remainingPotential = useMemo(
    () => rows.reduce((s, r) => s + (r.saving.rupees * (r.qty || 1)), 0),
    [rows]
  );

  const maybeFinish = (nextRows) => {
    if (nextRows.length === 0) {
      onOpenChange(false);
      onProceed();
    }
  };

  const doReplaceNow = (idx) => {
    setRows(prev => {
      const r = prev[idx];
      if (r) onReplaceItem(r.brand, r.best, r.qty);
      const next = prev.filter((_, i) => i !== idx);
      setTimeout(() => maybeFinish(next), 0);
      return next;
    });
  };

  const keepBrandNow = (idx) => {
    setRows(prev => {
      const next = prev.filter((_, i) => i !== idx);
      setTimeout(() => maybeFinish(next), 0);
      return next;
    });
  };

  const replaceAllAndProceed = () => {
    rows.forEach(r => onReplaceItem(r.brand, r.best, r.qty));
    onOpenChange(false);
    onProceed();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,820px)] rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-xl font-black" style={{ color: DEEP }}>
            Save with generics before checkout
          </DialogTitle>
          <div className="px-0 text-sm text-zinc-600">
            These options match the same <b>composition</b> from this pharmacy.
          </div>
        </DialogHeader>

        <div className="px-5 pb-4">
          {loading || !readyToRender ? (
            <div className="text-sm text-zinc-500">Finding best prices…</div>
          ) : rows.length === 0 ? (
            <div className="space-y-3">
              <div className="text-sm text-zinc-500">
                No savings available right now. You can continue to checkout.
              </div>
              <div className="flex justify-end">
                <Button
                  className="font-bold text-white"
                  style={{ backgroundColor: DEEP }}
                  onClick={() => {
                    onOpenChange(false);
                    onProceed();
                  }}
                >
                  Continue to checkout
                </Button>
              </div>
            </div>
          ) : (
            <>
              {rows.length > 1 && (
                <div className="mb-2 flex justify-end">
                  <Button
                    className="font-bold text-white"
                    style={{ backgroundColor: DEEP }}
                    onClick={replaceAllAndProceed}
                  >
                    Replace all & proceed
                  </Button>
                </div>
              )}

              <div className="text-[12px] text-emerald-700 mb-2">
                Tap a button below to apply immediately. You can handle items one by one.
              </div>

              <div className="space-y-3">
                {rows.map((r, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border bg-white p-3 shadow-sm"
                    style={{ borderColor: "rgba(15,110,81,0.18)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[12px] text-zinc-500">Brand</div>
                        <div className="font-extrabold truncate">
                          {r.brand.brand || r.brand.name}
                        </div>
                        <div className="text-[12px] text-zinc-600 truncate">
                          Qty: {r.qty}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[15px] font-black" style={{ color: DEEP }}>
                          ₹{price(r.brand)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 grid sm:grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div className="rounded-lg border p-2">
                        <div className="text-[12px] text-emerald-700">Best Generic</div>
                        <div className="font-bold truncate">
                          {r.best.name || r.best.displayName}
                        </div>
                        {r.best.composition && (
                          <div className="text-[12px] text-zinc-600 truncate">
                            {r.best.composition}
                          </div>
                        )}
                      </div>
                      <div className="text-center font-bold text-emerald-700">
                        ↓ Save ₹{r.saving.rupees} ({r.saving.pct}%)
                      </div>
                      <div className="text-right font-black" style={{ color: DEEP }}>
                        ₹{price(r.best)}
                      </div>
                    </div>

                    {/* Actions — Keep Brand (left), Replace with Generic (right) */}
                    <div className="mt-2 flex gap-2">
                      <Button
                        className={BTN3D_CLASS}
                        style={BTN3D_STYLE}
                        onClick={() => keepBrandNow(idx)}
                      >
                        Keep Brand
                      </Button>
                      <Button
                        className={BTN3D_CLASS}
                        style={BTN3D_STYLE}
                        onClick={() => doReplaceNow(idx)}
                      >
                        Replace with Generic
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Footer — potential saving + proceed */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-sm text-zinc-600" />
            <div className="text-right">
              <div className="text-[12px] text-zinc-600">Potential saving</div>
              <div className="text-lg font-black" style={{ color: DEEP }}>
                ₹{remainingPotential}
              </div>
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              className="font-bold text-white"
              style={{ backgroundColor: DEEP }}
              onClick={() => {
                onOpenChange(false);
                onProceed();
              }}
            >
              Proceed to checkout
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
