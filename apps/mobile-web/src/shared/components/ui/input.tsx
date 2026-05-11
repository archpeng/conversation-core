import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../utils.js";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn("min-h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-ink outline-none focus:border-ink", className)}
      {...props}
    />
  );
});
