"use client";
import React from "react";

export function ProgressBar({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="relative h-1 w-full overflow-hidden rounded bg-slate-200 dark:bg-slate-800">
      <div className="absolute inset-y-0 left-0 w-1/3 animate-progress rounded bg-gradient-to-r from-sky-400 via-cyan-400 to-indigo-400 dark:from-sky-500 dark:via-cyan-500 dark:to-indigo-500" />
      <style jsx>{`
        @keyframes progress {
          0% { transform: translateX(-150%); }
          50% { transform: translateX(50%); }
          100% { transform: translateX(250%); }
        }
        .animate-progress { animation: progress 1.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

export default ProgressBar;

