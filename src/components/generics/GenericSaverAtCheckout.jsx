// src/components/generics/GenericSaverAtCheckout.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";

const DEEP = "#0f6e51";
const LS_KEY = "GENERIC_SAVER_SNOOZE_UNTIL";

function price(m) {
  return Number(m?.price ?? m?.mrp ?? m?.sellingPrice ?? 0) || 0;
}
function savePair(brand, gen) {
  const s = Math.max(0, price(brand) - price(gen));
  return { rupees: s, pct: s ? Math.round((s / price(brand)) * 100) : 0 };
}

export default function GenericSaverAtCheckout({
  open,
  onOpenChange,
  items = [],            // [{ item, qty }]
  fetchAlternatives,     // async (brandItem) -> { brand, generics[] }
  onReplaceItem,         // (brand, bestGeneric, qty) => void
  onProceed,             // () => void
  defaultSnoozeDays = 7,
}) {
  const [rows, setRows] = useState([]);     // [{brand, best, saving, qty}]
  const [loading, setLoading] = useState(true);
  const [readyToRender, setReadyToRender] = useState(false);
  const [step, setStep] = useState(0);      // show ONE item at a time
  const [snoozeDays, setSnoozeDays] = useState(defaultSnoozeDays);

  // reset whenever we open
  useEffect(() => {
    if (!open) return;
    setRows([]);
    setStep(0);
    setLoading(true);
    setReadyToRender(false);
  }, [open]);

  // fetch suggestions
  useEffect(() => {
    if (!open) return;

    (async () => {
      setLoading(true);
      const out = [];
      const start = Date.now();

      for (const { item, qty } of items) {
        const data = await fetchAlternatives(item);
        const best = (data?.generics || [])[0];
        if (data?.brand && best && price(data.brand) > price(best)) {
          out.push({
            brand: data.brand,
            best,
            qty: qty || 1,
            saving: savePair(data.brand, best),
          });
        }
      }

      setRows(out);
      setLoading(false);

      // small delay to avoid flash
      const elapsed = Date.now() - start;
      const MIN_VISIBLE = 350;
      if (elapsed < MIN_VISIBLE) {
        setTimeout(() => setReadyToRender(true), MIN_VISIBLE - elapsed);
      } else {
        setReadyToRender(true);
      }
    })();
  }, [open, items, fetchAlternatives]);

  const totalSaving = useMemo(
    () => rows.reduce((s, r) => s + (r.saving.rupees * (r.qty || 1)), 0),
    [rows]
  );

  // helpers
  const goNext = () => {
    const next = step + 1;
    if (next >= rows.length) {
      onOpenChange(false);
      onProceed();
    } else {
      setStep(next);
    }
  };

  if (!open) return null;

  const current = rows[step];

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
              {/* progress */}
              <div className="mb-2 text-[12px] font-semibold text-emerald-800/80">
                Item {step + 1} of {rows.length}
              </div>

              {/* single card for the current item */}
              <div
                className="rounded-xl border bg-white p-3 shadow-sm"
                style={{ borderColor: "rgba(15,110,81,0.18)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] text-zinc-500">Brand</div>
                    <div className="font-extrabold truncate">
                      {current.brand.brand || current.brand.name}
                    </div>
                    <div className="text-[12px] text-zinc-600 truncate">
                      Qty: {current.qty}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-black" style={{ color: DEEP }}>
                      ₹{price(current.brand)}
                    </div>
                  </div>
                </div>

                <div className="mt-2 grid sm:grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="rounded-lg border p-2">
                    <div className="text-[12px] text-emerald-700">Best Generic</div>
                    <div className="font-bold truncate">
                      {current.best.name || current.best.displayName}
                    </div>
                    {current.best.composition && (
                      <div className="text-[12px] text-zinc-600 truncate">
                        {current.best.composition}
                      </div>
                    )}
                  </div>
                  <div className="text-center font-bold text-emerald-700">
                    ↓ Save ₹{current.saving.rupees} ({current.saving.pct}%)
                  </div>
                  <div className="text-right font-black" style={{ color: DEEP }}>
                    ₹{price(current.best)}
                  </div>
                </div>

                {/* ACTION buttons = immediate */}
                <div className="mt-3 flex gap-2">
                  <Button
                    className="flex-1 font-bold text-white"
                    style={{ backgroundColor: DEEP }}
                    onClick={() => {
                      onReplaceItem(current.brand, current.best, current.qty);
                      goNext();
                    }}
                  >
                    Replace with generic
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 font-bold"
                    onClick={goNext}
                  >
                    Keep brand
                  </Button>
                </div>
              </div>

              {/* Footer: snooze + totals + skip */}
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-sm text-zinc-600">
                  Don’t show for:
                  <label className="ml-2 mr-1">
                    <input
                      type="radio"
                      name="sz"
                      defaultChecked={defaultSnoozeDays === 7}
                      onChange={() => setSnoozeDays(7)}
                    />{" "}
                    7 days
                  </label>
                  <label className="ml-2">
                    <input
                      type="radio"
                      name="sz"
                      onChange={() => setSnoozeDays(3)}
                    />{" "}
                    3 days
                  </label>
                </div>
                <div className="text-right">
                  <div className="text-[12px] text-zinc-600">Potential saving (all)</div>
                  <div className="text-lg font-black" style={{ color: DEEP }}>
                    ₹{totalSaving}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <Button
                  variant="outline"
                  className="font-bold"
                  onClick={() => {
                    const ts = Date.now() + snoozeDays * 24 * 60 * 60 * 1000;
                    localStorage.setItem(LS_KEY, String(ts));
                    onOpenChange(false);
                    onProceed();
                  }}
                >
                  Skip & checkout
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
