import * as React from "react";
import { cn } from "@/lib/utils";

function Avatar({ className, ...props }) {
  return (
    <span
      className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  );
}

function AvatarImage({ className, src, alt, ...props }) {
  return (
    <img
      className={cn("aspect-square h-full w-full", className)}
      src={src}
      alt={alt}
      {...props}
    />
  );
}

function AvatarFallback({ className, children, ...props }) {
  return (
    <span
      className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}
      {...props}
    >
      {children}
    </span>
  );
}

export { Avatar, AvatarImage, AvatarFallback };
