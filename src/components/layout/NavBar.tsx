"use client";
import Link from "next/link";
import { Moon, Search, Sun } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";

export function NavBar() {
  const router = useRouter();
  const [quick, setQuick] = useState("");
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(false);
  const go = () => {
    const url = new URL(window.location.href);
    url.pathname = "/search";
    url.search = "";
    if (quick.trim()) url.searchParams.set("q", quick.trim());
    router.push(url.pathname + "?" + url.searchParams.toString());
  };
  useEffect(() => {
    setMounted(true);
    // Initialize theme from localStorage or system
    const stored = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    const prefersDark = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldDark = stored ? stored === "dark" : prefersDark;
    if (shouldDark) {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    } else {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const el = document.getElementById("odfp-quick-input") as HTMLInputElement | null;
        el?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  };
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/70 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-slate-800/70 dark:bg-slate-900/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-3 text-slate-900 hover:opacity-90 dark:text-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
            <Image src="/globe.svg" alt="ODFP" width={20} height={20} className="brightness-0 invert" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight">ODFP</span>
            <span className="hidden text-xs text-slate-600 dark:text-slate-400 sm:block">Ocean Data Findability Platform</span>
          </div>
        </Link>
        <div className="hidden flex-1 items-center justify-center gap-2 md:flex">
          <Input
            placeholder="Quick search (title, variables, publisher)"
            startIcon={<Search className="h-4 w-4 text-slate-400" />}
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") go(); }}
            id="odfp-quick-input"
          />
          <Button size="sm" onClick={go}>Search</Button>
        </div>
        <nav className="flex items-center gap-3">
          {[
            { href: "/search", label: "Search" },
            { href: "/collections", label: "Collections" },
            { href: "/about", label: "About" },
            { href: "/docs", label: "Docs" },
            { href: "/admin", label: "Admin" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white ${typeof window !== 'undefined' && window.location.pathname.startsWith(l.href) ? 'font-semibold text-slate-900 dark:text-white' : ''}`}
            >
              {l.label}
            </Link>
          ))}
          {mounted && (
            <button
              aria-label="Toggle theme"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={toggleTheme}
              title="Toggle theme"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

