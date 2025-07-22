import * as React from "react";
import { cn } from "../../lib/utils";

const Alert = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn("relative w-full rounded-lg border p-4 text-sm", className)} {...props} />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn("font-semibold mb-1 leading-none tracking-tight", className)} {...props} />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-muted-foreground", className)} {...props} />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
