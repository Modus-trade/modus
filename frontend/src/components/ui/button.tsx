import * as React from "react";
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
    VariantProps<typeof variants> {}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(variants({ variant }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
