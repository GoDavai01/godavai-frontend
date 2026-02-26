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
      {/* Scroll container (full viewport). No padding-top/bottom so the modal sits OVER nav bars */}
      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full w-full flex items-center justify-center px-3 py-4">
          {/* Stop propagation so clicks inside content don't close */}
          <div
            className="pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
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
 * - Remove `dark:*` backgrounds so system dark mode can't flip the panel.
 * - Add `dark:!bg-white dark:!text-zinc-900` as a defensive override in case
 *   a parent sets `.dark` (class-based theming).
 * - Add `[color-scheme:light]` to hint the browser to render controls in light.
 */
export function DialogContent({ className = "", children, ...props }) {
  return (
    <div
      {...props}
      className={cn(
        // Force light theme visuals regardless of OS/browser dark mode
        "relative z-[3001] rounded-3xl overflow-hidden shadow-2xl w-full max-w-md p-6 animate-in fade-in-90 scale-in-95 max-h-full",
        "bg-white text-zinc-900",
        // If the app uses class-based dark mode higher up, keep this panel light
        "dark:!bg-white dark:!text-zinc-900",
        // Tell the browser to treat this subtree as light (affects native controls)
        "[color-scheme:light]",
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

export function DialogTitle({ className = "", children, ...props }) {
  // eslint-disable-next-line jsx-a11y/heading-has-content
  return <h2 className={cn("text-xl font-bold mb-2", className)} {...props}>{children}</h2>;
}