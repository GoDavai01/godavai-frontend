// src/components/ui/sheet.js
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";

// tiny classNames helper
const cn = (...a) => a.filter(Boolean).join(" ");

export const Sheet        = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose   = Dialog.Close;

function getSideClasses(side = "right") {
  switch (side) {
    case "left":
      return {
        content:
          "fixed inset-y-0 left-0 w-3/4 max-w-sm rounded-r-xl " +
          "data-[state=open]:animate-in data-[state=closed]:animate-out " +
          "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
      };
    case "right":
      return {
        content:
          "fixed inset-y-0 right-0 w-3/4 max-w-sm rounded-l-xl " +
          "data-[state=open]:animate-in data-[state=closed]:animate-out " +
          "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
      };
    case "top":
      return {
        content:
          "fixed inset-x-0 top-0 w-full rounded-b-2xl " +
          "data-[state=open]:animate-in data-[state=closed]:animate-out " +
          "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
      };
    case "bottom":
    default:
      return {
        content:
          "fixed inset-x-0 bottom-0 w-full rounded-t-2xl " +
          "data-[state=open]:animate-in data-[state=closed]:animate-out " +
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
      };
  }
}

export const SheetContent = React.forwardRef(
  ({ className, side = "right", ...props }, ref) => {
    const sideCls = getSideClasses(side).content;
    return (
      <Dialog.Portal>
        {/* Sheet must stack ABOVE the dialog */}
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-[10055] bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        <Dialog.Content
          ref={ref}
          {...props}
          className={cn(
            "z-[10060] shadow-2xl outline-none border border-zinc-200/40", // no forced bg; caller provides
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
  <div className={cn("px-4 py-3 border-b border-zinc-200/40", className)} {...p} />
);
export const SheetFooter = ({ className = "", ...p }) => (
  <div className={cn("px-4 py-3 border-t border-zinc-200/40", className)} {...p} />
);
export const SheetTitle = React.forwardRef(({ className = "", ...p }, ref) => (
  <Dialog.Title ref={ref} className={cn("text-lg font-semibold", className)} {...p} />
));
SheetTitle.displayName = "SheetTitle";
export const SheetDescription = React.forwardRef(({ className = "", ...p }, ref) => (
  <Dialog.Description ref={ref} className={cn("text-sm text-zinc-500", className)} {...p} />
));
SheetDescription.displayName = "SheetDescription";
