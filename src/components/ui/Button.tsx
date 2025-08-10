import { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function Button({ className, variant = "primary", size = "md", ...props }: Props) {
  const base = "inline-flex items-center justify-center rounded-md font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none shadow-sm active:scale-[0.98] focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900";
  const variants: Record<string, string> = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600 shadow-sm hover:shadow-md dark:bg-blue-600 dark:hover:bg-blue-500",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-slate-400 shadow-sm hover:shadow-md dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
    ghost: "bg-transparent text-slate-900 hover:bg-slate-100 focus-visible:ring-slate-300 dark:text-slate-100 dark:hover:bg-slate-800/60",
  };
  const sizes: Record<string, string> = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4",
    lg: "h-12 px-5 text-lg",
  };
  return <button className={clsx(base, variants[variant], sizes[size], className)} {...props} />;
}

