// src/components/ui/select.js
import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";

/** tiny class combiner so we don't depend on any util */
const cn = (...x) => x.filter(Boolean).join(" ");

export const Select = SelectPrimitive.Root;

/**
 * center: when true, the selected value is centered
 * and the chevron is absolutely positioned at the right.
 */
export const SelectTrigger = React.forwardRef(
  ({ className, center, ...props }, ref) => (
    <SelectPrimitive.Trigger
      ref={ref}
      {...props}
      className={cn(
        "relative flex h-10 w-full items-center rounded-xl border border-slate-200 bg-white px-3",
        "text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--pillo-ring)]",
        "data-[placeholder]:text-slate-500",
        center ? "justify-center pr-9" : "justify-between",
        className
      )}
    >
      <SelectPrimitive.Value className={cn(center && "w-full text-center")} />
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 opacity-60" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
);
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectContent = React.forwardRef(
  ({ className, position = "popper", ...props }, ref) => (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        {...props}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-md",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
      >
        <SelectPrimitive.Viewport className="p-1">
          {props.children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
);
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectItem = React.forwardRef(
  ({ className, children, ...props }, ref) => (
    <SelectPrimitive.Item
      ref={ref}
      {...props}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-md",
        "py-2 pl-3 pr-8 text-sm outline-none",
        "focus:bg-emerald-50 focus:text-emerald-700",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
    >
      {/* center the visible text */}
      <SelectPrimitive.ItemText className="w-full text-center">
        {children}
      </SelectPrimitive.ItemText>

      {/* move the tick to the RIGHT so it never overlaps text */}
      <SelectPrimitive.ItemIndicator className="absolute right-2 flex h-4 w-4 items-center justify-center text-emerald-600">
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
);
SelectItem.displayName = SelectPrimitive.Item.displayName;

export const SelectValue = SelectPrimitive.Value;
