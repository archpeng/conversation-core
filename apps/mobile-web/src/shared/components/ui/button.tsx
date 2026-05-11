import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../utils.js";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary: "border-ink bg-ink text-white hover:bg-black",
  secondary: "border-border bg-white text-ink hover:bg-neutral-50",
  ghost: "border-transparent bg-transparent text-ink hover:bg-neutral-100",
  danger: "border-red-600 bg-red-600 text-white hover:bg-red-700"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant = "secondary", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    />
  );
});
