// src/components/ui/select.js
import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, ChevronUp, Check } from "lucide-react";

// tiny class joiner so this file is self-contained
function cn(...c) {
  return c.filter(Boolean).join(" ");
}

export const Select = SelectPrimitive.Root;

export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef(
  ({ className, children, ...props }, ref) => (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-xl border",
        "bg-white px-3 text-sm",
        "border-slate-300 outline-none ring-0",
        "hover:bg-emerald-50/30",
        "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        <ChevronDown className="h-4 w-4 opacity-60" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
);
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectContent = React.forwardRef(
  ({ className, children, position = "popper", ...props }, ref) => (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        sideOffset={6}
        position={position}
        className={cn(
          "z-[1000] min-w-[10rem] overflow-hidden rounded-xl border bg-white shadow-lg",
          "border-slate-200",
          className
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport className="p-1">
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
);
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectLabel = React.forwardRef(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.Label
      ref={ref}
      className={cn("px-2 py-1.5 text-xs font-semibold text-slate-500", className)}
      {...props}
    />
  )
);
SelectLabel.displayName = SelectPrimitive.Label.displayName;

export const SelectItem = React.forwardRef(
  ({ className, children, ...props }, ref) => (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm",
        "outline-none focus:bg-emerald-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4 text-emerald-700" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText className="pl-5">{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
);
SelectItem.displayName = SelectPrimitive.Item.displayName;

export const SelectSeparator = React.forwardRef(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn("my-1 h-px bg-slate-200", className)}
      {...props}
    />
  )
);
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export const SelectScrollUpButton = React.forwardRef(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollUpButton
      ref={ref}
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronUp className="h-4 w-4" />
    </SelectPrimitive.ScrollUpButton>
  )
);
SelectScrollUpButton.displayName = "SelectScrollUpButton";

export const SelectScrollDownButton = React.forwardRef(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollDownButton
      ref={ref}
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronDown className="h-4 w-4" />
    </SelectPrimitive.ScrollDownButton>
  )
);
SelectScrollDownButton.displayName = "SelectScrollDownButton";
