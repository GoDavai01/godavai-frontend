import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
const DEEP = "#0f6e51";

function price(m){ return Number(m?.price ?? m?.mrp ?? 0) || 0; }
function savePair(brand, gen){
  const s = Math.max(0, price(brand) - price(gen));
  return { rupees: s, pct: s ? Math.round((s / price(brand)) * 100) : 0 };
}
const LS_KEY = "GENERIC_SAVER_SNOOZE_UNTIL";

export default function GenericSaverAtCheckout({
  open, onOpenChange, items = [], pharmacyId, fetchAlternatives, // (brand) => Promise<{brand,generics[]}>
  onReplaceItem, onProceed, defaultSnoozeDays = 7
}) {
  const [rows, setRows] = useState([]);   // [{brand, best, saving, chosen: "brand"|"best"}]
  const [loading, setLoading] = useState(true);
  const [snoozeDays, setSnoozeDays] = useState(defaultSnoozeDays);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const out = [];
      for (const { item, qty } of items) {
        const data = await fetchAlternatives(item); // expects {brand,generics}
        const best = (data?.generics || [])[0];
        if (data?.brand && best) {
          out.push({
            brand: data.brand,
            qty,
            best,
            saving: savePair(data.brand, best),
            chosen: "brand",
          });
        }
      }
      setRows(out);
      setLoading(false);
    })();
  }, [open]); // eslint-disable-line

  const totalSaving = useMemo(
    () => rows.reduce((s, r) => s + (r.saving.rupees * r.qty), 0),
    [rows]
  );

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
          {loading ? (
            <div className="text-sm text-zinc-500">Finding best prices…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-zinc-500">No savings available right now.</div>
          ) : (
            <div className="space-y-3">
              {rows.map((r, idx) => (
                <div key={idx} className="rounded-xl border bg-white p-3 shadow-sm" style={{ borderColor:"rgba(15,110,81,0.18)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[12px] text-zinc-500">Brand</div>
                      <div className="font-extrabold truncate">{r.brand.brand || r.brand.name}</div>
                      <div className="text-[12px] text-zinc-600 truncate">Qty: {r.qty}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[15px] font-black" style={{ color: DEEP }}>₹{price(r.brand)}</div>
                    </div>
                  </div>

                  <div className="mt-2 grid sm:grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <div className="rounded-lg border p-2">
                      <div className="text-[12px] text-emerald-700">Best Generic</div>
                      <div className="font-bold truncate">{r.best.name}</div>
                      <div className="text-[12px] text-zinc-600 truncate">{r.best.composition}</div>
                    </div>
                    <div className="text-center font-bold text-emerald-700">↓ Save ₹{r.saving.rupees} ({r.saving.pct}%)</div>
                    <div className="text-right font-black" style={{ color: DEEP }}>₹{price(r.best)}</div>
                  </div>

                  <div className="mt-2 flex gap-2">
                    <Button
                      className={`flex-1 font-bold ${r.chosen==="best"?"opacity-100":"opacity-80"}`}
                      style={{ backgroundColor: DEEP, color: "white" }}
                      onClick={() => setRows(rs => rs.map((x,i)=> i===idx?{...x, chosen:"best"}:x))}
                    >
                      Replace with generic
                    </Button>
                    <Button
                      variant="outline"
                      className={`flex-1 font-bold ${r.chosen==="brand"?"opacity-100":"opacity-80"}`}
                      onClick={() => setRows(rs => rs.map((x,i)=> i===idx?{...x, chosen:"brand"}:x))}
                    >
                      Keep brand
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-sm text-zinc-600">
              Don’t show for:
              <label className="ml-2 mr-1"><input type="radio" name="sz" defaultChecked={defaultSnoozeDays===7} onChange={()=>setSnoozeDays(7)} /> 7 days</label>
              <label className="ml-2"><input type="radio" name="sz" onChange={()=>setSnoozeDays(3)} /> 3 days</label>
            </div>
            <div className="text-right">
              <div className="text-[12px] text-zinc-600">Potential saving</div>
              <div className="text-lg font-black" style={{ color: DEEP }}>₹{totalSaving}</div>
            </div>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="outline"
              className="font-bold"
              onClick={() => {
                const ts = Date.now() + snoozeDays*24*60*60*1000;
                localStorage.setItem(LS_KEY, String(ts));
                onOpenChange(false);
                onProceed(); // continue without changes
              }}
            >
              Skip now
            </Button>
            <Button
              className="font-bold text-white"
              style={{ backgroundColor: DEEP }}
              onClick={() => {
                // apply chosen replacements
                rows.filter(r => r.chosen === "best").forEach(r => onReplaceItem(r.brand, r.best, r.qty));
                onOpenChange(false);
                onProceed();
              }}
            >
              Apply & proceed
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
