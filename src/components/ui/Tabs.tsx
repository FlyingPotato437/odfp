"use client";
import { useEffect, useState } from "react";

type Tab = { id: string; label: string };

export function Tabs({ tabs, children, hashSync = true }: { tabs: Tab[]; children: React.ReactNode[]; hashSync?: boolean }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!hashSync) return;
    const applyFromHash = () => {
      const raw = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
      if (!raw) return;
      const index = tabs.findIndex((t) => t.id.toLowerCase() === raw.toLowerCase());
      if (index >= 0) setActive(index);
    };
    applyFromHash();
    window.addEventListener("hashchange", applyFromHash);
    return () => window.removeEventListener("hashchange", applyFromHash);
  }, [hashSync, tabs]);

  const onClickTab = (i: number) => {
    setActive(i);
    if (hashSync) {
      const id = tabs[i]?.id;
      if (id) {
        try { window.location.hash = id; } catch {}
      }
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${i === active ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
            onClick={() => onClickTab(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="pt-4">{children[active]}</div>
    </div>
  );
}

