"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../../libs/utils"; // keep this path as you created it

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      // transparent container (no white bar)
      "inline-flex h-10 items-center justify-center gap-2 bg-transparent p-0 text-slate-600",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // base
      "inline-flex items-center justify-center whitespace-nowrap px-3 py-2 text-sm font-extrabold",
      "border-b-2 border-transparent transition-all",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ring-offset-white",
      "disabled:pointer-events-none disabled:opacity-50",
      // active (NO background; deep-green underline + text)
      "data-[state=active]:text-emerald-700 data-[state=active]:border-emerald-600",
      // inactive
      "data-[state=inactive]:text-slate-600",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;
