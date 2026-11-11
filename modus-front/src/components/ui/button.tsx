import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib";
const variants = cva("button", {
  variants: {
    variant: {
      default: "button-primary",
      outline: "button-outline",
      ghost: "button-ghost",
    },
  },
  defaultVariants: { variant: "default" },
});
export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof variants> {
  loading?: boolean;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, loading = false, disabled, children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      className={cn(variants({ variant }), className)}
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && (
        <LoaderCircle className="button-spinner" size={16} aria-hidden="true" />
      )}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
