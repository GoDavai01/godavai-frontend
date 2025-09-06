// components/ui/dialog.js
import * as React from "react";
import { createPortal } from "react-dom";

function cn(...args) {
  return args.filter(Boolean).join(" ");
}

export function Dialog({ open, onOpenChange, children }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Lock body scroll when open
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [open]);

  // Close on ESC
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onOpenChange?.(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open || !mounted) return null;

  const handleBackdropMouseDown = (e) => {
    if (e.target === e.currentTarget) onOpenChange?.(false);
  };

  const node = (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={handleBackdropMouseDown}
      className="fixed inset-0 z-[10040] bg-black/60 backdrop-blur-sm"
    >
      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full w-full flex items-center justify-center px-3 py-4">
          <div className="pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

/**
 * DialogContent
 * appearance:
 *  - "light"  (default): white panel
 *  - "dark"             : dark preset
 *  - "custom"           : no bg/text classes; you style via className
 */
export function DialogContent({ className = "", appearance = "light", children, ...props }) {
  const palette =
    appearance === "dark"
      ? "bg-[#0b1114] text-emerald-100"
      : appearance === "custom"
      ? "" // caller fully controls styling
      : "bg-white text-zinc-900"; // light default

  return (
    <div
      {...props}
      className={cn(
        "relative z-[10050] w-full max-w-md max-h-full rounded-3xl overflow-hidden shadow-2xl",
        "p-6 animate-in fade-in-90 scale-in-95",
        palette,
        className
      )}
    >
      {children}
    </div>
  );
}

export function DialogHeader({ className = "", ...props }) {
  return <div className={cn("mb-4", className)} {...props} />;
}

export function DialogFooter({ className = "", ...props }) {
  return <div className={cn("mt-6 flex justify-end gap-2", className)} {...props} />;
}

export function DialogTitle({ className = "", ...props }) {
  return <h2 className={cn("text-xl font-bold mb-2", className)} {...props} />;
}
