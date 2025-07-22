import * as React from "react";
import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("relative overflow-auto", className)}
    style={{ ...style, WebkitOverflowScrolling: "touch" }}
    {...props}
  />
));
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
