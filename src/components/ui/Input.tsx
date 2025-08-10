import { InputHTMLAttributes } from "react";
import { clsx } from "clsx";

type Props = InputHTMLAttributes<HTMLInputElement> & { startIcon?: React.ReactNode; endIcon?: React.ReactNode };

export function Input({ className, startIcon, endIcon, ...props }: Props) {
  return (
    <div className={clsx("flex items-center gap-2 rounded-md border border-slate-200 bg-white/90 px-3 shadow-sm focus-within:ring-2 focus-within:ring-blue-600 dark:border-slate-700 dark:bg-slate-900/70", className)}>
      {startIcon}
      <input className="h-10 w-full bg-transparent outline-none placeholder:text-slate-400 dark:text-slate-100" {...props} />
      {endIcon}
    </div>
  );
}

