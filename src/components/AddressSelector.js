// src/components/AddressSelector.js
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Home,
  Briefcase,
  MapPin,
  LocateFixed,
  MapPinPlus,
  Pencil,
  Trash2,
} from "lucide-react";

const TYPE_ICONS = {
  Home: <Home className="h-4 w-4 text-teal-600" />,
  Work: <Briefcase className="h-4 w-4 text-amber-600" />,
  Other: <MapPin className="h-4 w-4 text-blue-600" />,
  Current: <LocateFixed className="h-4 w-4 text-yellow-500" />,
};

export default function AddressSelector({
  addresses = [],
  selectedAddressId,
  onSelect,
  onAddAddress,
  onEdit,
  onDelete,
}) {
  return (
    <div className="mb-3 w-full max-w-full">
      <h3 className="text-base sm:text-lg font-bold mb-2">Delivery Address</h3>

      <div className="rounded-2xl bg-zinc-50/60 p-2">
        {addresses.length === 0 && (
          <div className="p-2">
            <button
              type="button"
              onClick={onAddAddress}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 text-white font-semibold py-2.5 shadow hover:bg-teal-700"
            >
              <MapPinPlus className="h-4 w-4" />
              Add New Address
            </button>
          </div>
        )}

        <AnimatePresence initial={false}>
          {addresses.map((address) => {
            const selected = selectedAddressId === address.id;
            return (
              <motion.div
                key={address.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                className={`relative mb-2 last:mb-0 rounded-2xl border p-3 cursor-pointer max-w-full
                  ${
                    selected
                      ? "bg-amber-50 border-amber-300 shadow-sm"
                      : "bg-white border-zinc-200 hover:bg-zinc-50"
                  }`}
                onClick={() => onSelect(address.id)}
              >
                {/* Content row */}
                <div className="flex items-start gap-2.5 sm:gap-3 pr-2 sm:pr-16 flex-wrap">
                  {/* Type chip */}
                  <div className="inline-flex items-center gap-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 px-2 py-1 text-[11px] font-semibold shrink-0">
                    {TYPE_ICONS[address.type] || TYPE_ICONS.Other}
                    <span className="ml-1">{address.type || "Other"}</span>
                  </div>

                  {/* Texts */}
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-[14.5px] sm:text-[15px] font-bold leading-snug break-words"
                      title={[
                        address.name,
                        address.addressLine,
                        address.floor && `Floor: ${address.floor}`,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    >
                      {address.name}
                      {address.addressLine ? `, ${address.addressLine}` : ""}
                      {address.floor ? `, Floor: ${address.floor}` : ""}
                    </div>

                    <div
                      className="mt-0.5 text-[12.5px] sm:text-[13px] text-zinc-600 leading-snug line-clamp-2 sm:line-clamp-3 break-words"
                      title={[
                        address.formatted || address.addressLine,
                        address.landmark && `Landmark: ${address.landmark}`,
                        address.phone,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    >
                      {address.formatted ? address.formatted : address.addressLine}
                      {address.landmark ? `, Landmark: ${address.landmark}` : ""}
                      {address.phone ? `, ${address.phone}` : ""}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {/* On small screens, show actions inline below content; on >=sm keep absolute top-right */}
                <div className="mt-2 sm:mt-0 sm:absolute sm:right-2 sm:top-2 flex items-center gap-1.5 justify-end">
                  <button
                    type="button"
                    aria-label="Edit Address"
                    className="rounded-lg p-1.5 hover:bg-zinc-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(address);
                    }}
                  >
                    <Pencil className="h-4 w-4 text-zinc-700" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete Address"
                    className="rounded-lg p-1.5 hover:bg-zinc-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onDelete) onDelete(address);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={onAddAddress}
        className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 text-white font-semibold py-2.5 shadow hover:bg-teal-700"
      >
        <MapPinPlus className="h-4 w-4" />
        Add New Address
      </button>
    </div>
  );
}
