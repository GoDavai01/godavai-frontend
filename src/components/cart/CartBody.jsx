import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Separator } from "../../components/ui/separator";
import { Badge } from "../../components/ui/badge";
import { Trash2, Plus, Minus, Pencil } from "lucide-react";
import { useCart } from "../../context/CartContext";

// Deep green brand tone
const DEEP = "#0f6e51";

export default function CartBody({
  onChangePharmacy,
  onClearCart,
  onCheckout,
  loadingPharmacies,
  pharmacies = [],
  selectedPharmacy,
  multiPharmacy,
  openSelectDialog,
}) {
  const { cart, addToCart, removeOneFromCart, removeFromCart } = useCart();
  const total = cart.reduce((s, m) => s + m.price * m.quantity, 0);

  return (
    <div className="space-y-3">
      <Card
        className="rounded-2xl bg-white shadow-xl"
        style={{ border: "1px solid rgba(15,110,81,0.14)" }}
      >
        <CardContent className="p-0">
          <AnimatePresence initial={false}>
            {cart.map((med) => (
              <motion.div
                key={med._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="flex items-start sm:items-center justify-between gap-2 px-3 py-3 border-b last:border-b-0 flex-wrap"
                style={{ borderColor: "rgba(15,110,81,0.10)" }}
              >
                {/* Left: names/prices */}
                <div className="min-w-0 flex-1 pr-1">
                  <div
                    className="text-[15px] sm:text-[17px] font-extrabold text-zinc-900 truncate"
                    title={med.name}
                  >
                    {med.name}
                  </div>

                  {med.brand ? (
                    <div
                      className="text-[12px] sm:text-[13px] font-semibold truncate"
                      style={{ color: DEEP }}
                      title={med.brand}
                    >
                      {med.brand}
                    </div>
                  ) : null}

                  <div className="text-[13px] sm:text-[14px] text-zinc-500">
                    ₹{med.price} × {med.quantity}
                    <span
                      className="block font-extrabold"
                      style={{ color: DEEP }}
                    >
                      = ₹{med.price * med.quantity}
                    </span>
                  </div>
                </div>

                {/* Center: qty controls */}
                <div className="flex items-center gap-1.5 mt-1 sm:mt-0">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-gray-50"
                    style={{
                      borderColor: "rgba(15,110,81,0.40)",
                      background: "rgba(15,110,81,0.06)",
                      color: DEEP,
                    }}
                    disabled={med.quantity === 1}
                    onClick={() => removeOneFromCart(med)}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>

                  <div
                    className="w-6 text-center font-extrabold select-none"
                    style={{ color: DEEP }}
                    aria-live="polite"
                  >
                    {med.quantity}
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-gray-50"
                    style={{
                      borderColor: "rgba(15,110,81,0.40)",
                      background: "rgba(15,110,81,0.06)",
                      color: DEEP,
                    }}
                    onClick={() => addToCart(med)}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Right: delete */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-600 shrink-0"
                  onClick={() => removeFromCart(med)}
                  aria-label="Remove item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>

          <Separator style={{ background: "rgba(15,110,81,0.12)" }} />

          {/* Total */}
          <div className="px-4 py-3 text-right">
            <div
              className="text-lg sm:text-xl font-black whitespace-nowrap"
              style={{ color: DEEP }}
            >
              Total: ₹{total}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Pharmacy / Select button */}
      {selectedPharmacy ? (
        <div className="mt-2 flex items-center gap-1 min-w-0">
          <div className="mr-1 font-extrabold shrink-0" style={{ color: DEEP }}>
            Selected Pharmacy:
          </div>
          <div
            className="font-extrabold truncate"
            style={{ color: DEEP }}
            title={
              selectedPharmacy.name ||
              selectedPharmacy.pharmacyName ||
              "Unknown"
            }
          >
            {selectedPharmacy.name ||
              selectedPharmacy.pharmacyName ||
              "Unknown"}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-1 h-8 w-8 shrink-0"
            onClick={onChangePharmacy}
            aria-label="Change pharmacy"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div>
          <Button
            variant="outline"
            onClick={openSelectDialog}
            className="font-bold hover:bg-gray-50"
            style={{ borderColor: "rgba(15,110,81,0.40)", color: DEEP }}
          >
            Select Pharmacy
          </Button>
        </div>
      )}

      {/* CTAs: stack on mobile, row on wider */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pb-1">
        <Button
          variant="ghost"
          onClick={onClearCart}
          className="text-red-600 hover:text-red-700 !font-black w-full sm:w-auto"
        >
          <span className="font-black tracking-wide">CLEAR CART</span>
        </Button>

        <Button
          onClick={onCheckout}
          disabled={multiPharmacy}
          className="rounded-full px-5 sm:px-6 py-4 sm:py-5 text-[15px] sm:text-base font-black shadow-md disabled:opacity-60 hover:brightness-105 text-white w-full sm:w-auto"
          style={{ backgroundColor: DEEP }}
        >
          PROCEED TO CHECKOUT
        </Button>
      </div>
    </div>
  );
}
