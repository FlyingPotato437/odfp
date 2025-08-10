import { HTMLAttributes } from "react";
import { clsx } from "clsx";

type Props = HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "success" | "warning" | "info" };

export function Badge({ className, variant = "default", ...props }: Props) {
  const variants: Record<string, string> = {
    default: "bg-slate-100 text-slate-800",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    info: "bg-blue-100 text-blue-800",
  };
  return <span className={clsx("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium", variants[variant], className)} {...props} />;
}

