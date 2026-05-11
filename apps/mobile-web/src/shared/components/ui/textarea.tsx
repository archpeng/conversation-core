import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../utils.js";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn("min-h-24 w-full resize-none rounded-md border border-border bg-white px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-ink", className)}
      {...props}
    />
  );
});
