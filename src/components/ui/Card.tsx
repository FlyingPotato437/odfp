import { HTMLAttributes } from "react";
import { clsx } from "clsx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow dark:border-slate-800 dark:bg-slate-900", className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("p-4 border-b border-slate-200 dark:border-slate-800", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("p-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("p-4 border-t border-slate-200 dark:border-slate-800", className)} {...props} />;
}

