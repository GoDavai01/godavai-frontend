// src/components/ui/sheet.js
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";

// tiny classNames helper (or import your cn)
const cn = (...a) => a.filter(Boolean).join(" ");

export const Sheet        = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose   = Dialog.Close;

function getSideClasses(side = "right") {
  // Responsive, viewport-safe dimensions:
  // - Left/Right: full height (100svh), internal scroll, width adapts by device
  // - Top/Bottom: full width, max height capped to viewport (svh), internal scroll
  switch (side) {
    case "left":
      return {
        content: [
          "fixed inset-y-0 left-0",
          "h-[100svh] max-h-[100svh] overflow-y-auto overscroll-contain",
          "w-[92vw] sm:w-[420px] md:w-[480px] lg:w-[520px]",
          "rounded-r-xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        ].join(" "),
      };
    case "right":
      return {
        content: [
          "fixed inset-y-0 right-0",
          "h-[100svh] max-h-[100svh] overflow-y-auto overscroll-contain",
          "w-[92vw] sm:w-[420px] md:w-[480px] lg:w-[520px]",
          "rounded-l-xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        ].join(" "),
      };
    case "top":
      return {
        content: [
          "fixed inset-x-0 top-0 w-full",
          "max-h-[92svh] md:max-h-[88svh] overflow-y-auto overscroll-contain",
          "rounded-b-2xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
       ].join(" "),
      };
    case "bottom":
    default:
      return {
        content: [
          "fixed inset-x-0 bottom-0 w-full",
          "max-h-[92svh] md:max-h-[88svh] overflow-y-auto overscroll-contain",
          "rounded-t-2xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        ].join(" "),
      };
  }
}

export const SheetContent = React.forwardRef(
  ({ className, side = "right", ...props }, ref) => {
    const sideCls = getSideClasses(side).content;
    return (
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        <Dialog.Content
          ref={ref}
          {...props}
          className={cn(
            "z-[2001] bg-white shadow-2xl outline-none",
            sideCls,
            className
          )}
        />
      </Dialog.Portal>
    );
  }
);
SheetContent.displayName = "SheetContent";

export const SheetHeader = ({ className = "", ...p }) => (
  <div className={cn("px-4 py-3 border-b border-zinc-200", className)} {...p} />
);
export const SheetFooter = ({ className = "", ...p }) => (
  <div className={cn("px-4 py-3 border-t border-zinc-200", className)} {...p} />
);
export const SheetTitle = React.forwardRef(({ className = "", ...p }, ref) => (
  <Dialog.Title ref={ref} className={cn("text-lg font-semibold", className)} {...p} />
));
SheetTitle.displayName = "SheetTitle";
export const SheetDescription = React.forwardRef(({ className = "", ...p }, ref) => (
  <Dialog.Description ref={ref} className={cn("text-sm text-zinc-500", className)} {...p} />
));
SheetDescription.displayName = "SheetDescription";
