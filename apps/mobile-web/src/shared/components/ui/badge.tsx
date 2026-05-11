import { type HTMLAttributes } from "react";
import { cn } from "../utils.js";

type BadgeTone = "neutral" | "success" | "warning" | "danger";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

const tones: Record<BadgeTone, string> = {
  neutral: "border-border bg-neutral-100 text-neutral-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-700"
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return <span className={cn("inline-flex max-w-full items-center rounded px-2 py-1 text-xs font-medium", tones[tone], className)} {...props} />;
}
