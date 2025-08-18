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
                className="flex items-center justify-between gap-2 px-3 py-3 border-b last:border-b-0"
                style={{ borderColor: "rgba(15,110,81,0.10)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[17px] font-extrabold text-zinc-900 truncate">
                    {med.name}
                  </div>
                  {med.brand ? (
                    <div className="text-[13px] font-semibold" style={{ color: DEEP }}>
                      {med.brand}
                    </div>
                  ) : null}
                  <div className="text-[14px] text-zinc-500">
                    ₹{med.price} x {med.quantity}
                    <span className="block font-extrabold" style={{ color: DEEP }}>
                      = ₹{med.price * med.quantity}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
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
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="w-6 text-center font-extrabold" style={{ color: DEEP }}>
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
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-600"
                  onClick={() => removeFromCart(med)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>

          <Separator style={{ background: "rgba(15,110,81,0.12)" }} />
          <div className="px-4 py-3 text-right">
            <div className="text-xl font-black" style={{ color: DEEP }}>
              Total: ₹{total}
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedPharmacy ? (
        <div className="mt-2 flex items-center">
          <div className="mr-2 font-extrabold" style={{ color: DEEP }}>
            Selected Pharmacy:
          </div>
          <div className="font-extrabold truncate" style={{ color: DEEP }}>
            {selectedPharmacy.name || selectedPharmacy.pharmacyName || "Unknown"}
          </div>
          <Button variant="ghost" size="icon" className="ml-1 h-8 w-8" onClick={onChangePharmacy}>
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

      {/* CTAs */}
      <div className="flex items-center justify-end gap-3 pb-1">
        <Button variant="ghost" onClick={onClearCart} className="text-red-500 font-extrabold">
          CLEAR CART
        </Button>
        <Button
          onClick={onCheckout}
          disabled={multiPharmacy}
          className="rounded-full px-6 py-5 text-base font-black shadow-md disabled:opacity-60 hover:brightness-105 text-white"
          style={{ backgroundColor: DEEP }}
        >
          PROCEED TO CHECKOUT
        </Button>
      </div>
    </div>
  );
}
