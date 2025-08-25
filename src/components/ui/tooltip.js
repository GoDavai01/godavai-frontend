// src/components/ui/tooltip.js
"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

export function TooltipProvider({ children, ...props }) {
  return (
    <TooltipPrimitive.Provider delayDuration={150} {...props}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef(
  ({ className = "", sideOffset = 4, ...props }, ref) => (
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={`z-50 overflow-hidden rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white shadow-md animate-in fade-in-0 zoom-in-95 ${className}`}
      {...props}
    />
  )
);

TooltipContent.displayName = "TooltipContent";
