import { HTMLAttributes } from "react";
import { clsx } from "clsx";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-700/40",
        className
      )}
      {...props}
    />
  );
}

