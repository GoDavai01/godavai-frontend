// src/components/ui/radio-group.js
import * as React from "react";

// tiny cn helper so we don't depend on lib/utils here
const cn = (...a) => a.filter(Boolean).join(" ");

/**
 * Controlled RadioGroup that supports BOTH:
 *   - onChange({ target: { value }})   // your old signature
 *   - onValueChange(value)             // shadcn-ish signature
 * Also injects name/checked into Radio/RadioGroupItem children.
 */
export function RadioGroup({
  value,
  onChange,
  onValueChange,
  name,
  className = "",
  children,
  ...props
}) {
  const groupName = React.useMemo(
    () => name || `rg-${Math.random().toString(36).slice(2)}`,
    [name]
  );

  const notify = (val) => {
    // keep backward compatibility with your previous onChange signature
    onChange?.({ target: { value: val } });
    onValueChange?.(val);
  };

  const items = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;

    // Works for both <Radio> and <RadioGroupItem>
    const childValue = child.props.value;
    if (!childValue) return child;

    return React.cloneElement(child, {
      name: groupName,
      checked: value === childValue,
      onChange: (e) => {
        if (e?.target?.checked) notify(childValue);
        child.props.onChange?.(e);
      },
    });
  });

  return (
    <div role="radiogroup" className={cn("flex flex-wrap gap-3", className)} {...props}>
      {items}
    </div>
  );
}

/**
 * Your original Radio – kept as-is but works in the new group too.
 */
export function Radio({ checked, value, children, className = "", ...props }) {
  return (
    <label className={cn("flex items-center gap-2 cursor-pointer", className)}>
      <input
        type="radio"
        checked={!!checked}
        value={value}
        className="accent-teal-600 h-4 w-4"
        {...props}
        readOnly
      />
      <span className="text-sm">{children}</span>
    </label>
  );
}

/**
 * New: Styled item like shadcn’s <RadioGroupItem>.
 * Use inside <RadioGroup>. Example:
 *   <RadioGroup value={v} onValueChange={setV}>
 *     <RadioGroupItem value="cod">Cash on Delivery</RadioGroupItem>
 *     <RadioGroupItem value="upi">UPI</RadioGroupItem>
 *   </RadioGroup>
 */
export const RadioGroupItem = React.forwardRef(
  ({ className = "", children, disabled, ...props }, ref) => {
    return (
      <label
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-2",
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "cursor-pointer hover:bg-zinc-50",
          "border-zinc-200",
          className
        )}
      >
        <input
          ref={ref}
          type="radio"
          className="h-4 w-4 rounded-full border-zinc-300 text-teal-600 focus:ring-teal-500"
          disabled={disabled}
          {...props}
        />
        <span className="text-sm font-medium text-zinc-800">{children}</span>
      </label>
    );
  }
);
RadioGroupItem.displayName = "RadioGroupItem";
