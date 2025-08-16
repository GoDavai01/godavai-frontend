import * as React from "react";

export function Separator({ className = "", orientation = "horizontal", decorative = true, ...props }) {
  return (
    <div
      role={decorative ? "none" : "separator"}
      aria-orientation={orientation}
      className={
        "shrink-0 bg-zinc-200 " +
        (orientation === "vertical" ? "w-px h-full" : "h-px w-full") +
        (className ? ` ${className}` : "")
      }
      {...props}
    />
  );
}

export default Separator;
