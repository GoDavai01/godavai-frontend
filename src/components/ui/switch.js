// src/components/ui/switch.js
import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

// tiny class joiner so this file is self-contained
function cn(...c) {
  return c.filter(Boolean).join(" ");
}

/**
 * Usage:
 *  <Switch checked={value} onCheckedChange={setValue} />
 */
export const Switch = React.forwardRef(
  ({ className, ...props }, ref) => (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full",
        "border border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500",
        "data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-slate-300",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow",
          "transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
);
Switch.displayName = "Switch";
export default Switch;
