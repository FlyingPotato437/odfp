import { SelectHTMLAttributes } from "react";
import { clsx } from "clsx";

type Props = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: Props) {
  return (
    <select
      className={clsx(
        "h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

