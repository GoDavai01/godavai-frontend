// src/components/generics/GenericSuggestionModal.jsx
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

const DEEP = "#0f6e51";

function priceOf(m) {
  return Number(m?.price ?? m?.mrp ?? m?.sellingPrice ?? 0) || 0;
}
function savings(brand, generic) {
  const b = priceOf(brand), g = priceOf(generic);
  if (!b || !g || g >= b) return { rupees: 0, pct: 0 };
  const rupees = Math.max(0, b - g);
  const pct = Math.round((rupees / b) * 100);
  return { rupees, pct };
}

export default function GenericSuggestionModal({
  open,
  onOpenChange,
  brand,
  generics = [],
  onReplace,   // (generic) => void
  onAddAlso,   // (generic) => void
  onKeep,      // () => void
}) {
  if (!brand) generics = [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,760px)] rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-xl font-black" style={{ color: DEEP }}>
            Save with the same composition
          </DialogTitle>
          <div className="px-0 text-sm text-zinc-600">
            Options shown are from the <b>same pharmacy</b>, with the <b>same active composition</b>.
          </div>
        </DialogHeader>

        <div className="px-5 pb-4">
          {/* Brand anchor — price aligned to the right (like generic cards) */}
          <div
            className="mb-3 rounded-xl border bg-white p-3 shadow-sm"
            style={{ borderColor: "rgba(15,110,81,0.18)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-zinc-500">Selected (Brand)</div>
                <div className="mt-1 font-extrabold text-zinc-900 truncate">{brand?.brand || brand?.name}</div>
                {brand?.composition && (
                  <div className="text-[12px] text-zinc-600 truncate">
                    Composition: {brand.composition}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-[15px] font-black" style={{ color: DEEP }}>
                  ₹{priceOf(brand)}
                </div>
              </div>
            </div>
          </div>

          {/* Generic list */}
          {generics.length === 0 ? (
            <div className="text-sm text-zinc-500">No generic option available right now.</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {generics.map((g) => {
                const sv = savings(brand, g);
                return (
                  <div
                    key={g._id || g.id}
                    className="rounded-xl border bg-white p-3 shadow-sm"
                    style={{ borderColor: "rgba(15,110,81,0.18)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-emerald-700">Generic</div>
                        <div className="font-extrabold text-zinc-900 truncate" title={g.displayName || g.name}>
                          {g.displayName || g.name || g.composition}
                        </div>
                        {g.composition && (
                          <div className="text-[12px] text-zinc-600 truncate">
                            Composition: {g.composition}
                          </div>
                        )}
                        {(g.packCount || g.packUnit) && (
                          <div className="text-[12px] text-zinc-600">
                            Pack: {g.packCount || "-"} {g.packUnit || ""}
                          </div>
                        )}
                        {g.requiresRx && (
                          <Badge className="mt-1 bg-white text-red-600 border border-red-200">Rx</Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-[15px] font-black" style={{ color: DEEP }}>
                          ₹{priceOf(g)}
                        </div>
                        {sv.rupees > 0 && (
                          <div className="text-[12px] font-extrabold text-emerald-700">
                            Save ₹{sv.rupees} ({sv.pct}%)
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Swapped buttons: Add also (left) / Replace brand (right) */}
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 font-bold"
                        onClick={() => onAddAlso?.(g)}
                      >
                        Add also
                      </Button>
                      <Button
                        className="flex-1 font-bold text-white"
                        style={{ backgroundColor: DEEP }}
                        onClick={() => onReplace?.(g)}
                      >
                        Replace brand
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" className="font-bold" onClick={onKeep}>
              Keep brand
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
