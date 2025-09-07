// components/ui/dialog.js
import * as React from "react";
import { createPortal } from "react-dom";

// tiny classNames helper
function cn(...args) {
  return args.filter(Boolean).join(" ");
}

export function Dialog({ open, onOpenChange, children }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // Lock body scroll while dialog is open (we portal to <body>)
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
    const onKey = (e) => {
      if (e.key === "Escape") onOpenChange?.(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open || !mounted) return null;

  // Close when clicking the dimmed backdrop (but not the content)
  const handleBackdropMouseDown = (e) => {
    if (e.target === e.currentTarget) onOpenChange?.(false);
  };

  const node = (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={handleBackdropMouseDown}
      // must be higher than Sheet (overlay 2000, content 2001)
      style={{ zIndex: 3000 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm"
      // Force light scheme inside the overlay (prevents iOS/Android dark inversion)
      data-theme="light"
    >
      {/* Full-viewport scroll container with modern viewport units */}
      <div className="absolute inset-0 overflow-auto overscroll-contain">
        <div
          className="
            min-h-[100svh] w-full
            flex items-center justify-center
            px-3 py-4 sm:py-6
          "
          // Respect notches / system bars
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
          }}
        >
          {/* Stop propagation so clicks inside content don't close */}
          <div className="pointer-events-auto max-w-full" onMouseDown={(e) => e.stopPropagation()}>
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
 * - Fits on every device: uses svh/dvh clamps and internal scroll.
 * - Keeps light color scheme regardless of OS theme.
 * - API unchanged; consumer className still augments/overrides.
 */
export function DialogContent({ className = "", children, ...props }) {
  return (
    <div
      {...props}
      className={cn(
        // Sizing: fill width up to a sensible max; never exceed viewport height
        "relative z-[3001] w-full",
        "max-w-[min(96vw,740px)] md:max-w-[min(92vw,920px)]",
        // Height clamp with modern viewport units + fallback
        "max-h-[min(92svh,calc(100dvh-32px))] md:max-h-[min(92svh,calc(100dvh-64px))]",
        // Rounded and shadow; allow internal scrolling if content is long
        "rounded-2xl sm:rounded-3xl shadow-2xl overflow-auto",
        // Default padding (callers can override with className)
        "p-6",
        // Force light visuals
        "bg-white text-zinc-900 dark:!bg-white dark:!text-zinc-900 [color-scheme:light]",
        // Entry animation
        "animate-in fade-in-90 scale-in-95",
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
