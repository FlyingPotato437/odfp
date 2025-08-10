"use client";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import dynamic from "next/dynamic";
import type { SearchResult } from "@/lib/types";
import { Filters } from "@/components/search/Filters";
import { ResultCard } from "@/components/search/ResultCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { Facets } from "@/components/search/Facets";
import { Button } from "@/components/ui/Button";

const FilterMapClient = dynamic(
  () => import("@/components/map/FilterMap").then(m => ({ default: m.FilterMap })), 
  { 
    ssr: false,
    loading: () => <div style={{ height: 360 }} className="flex w-full items-center justify-center bg-slate-50 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">Loading map…</div>
  }
);

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type SavedSearch = { id: string; label: string; qs: string };

export default function SearchPage() {
  const [params, setParams] = useState<URLSearchParams>(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  });
  const [view, setView] = useState<"list" | "grid">((typeof window !== "undefined" && (localStorage.getItem("odfp-view") as "list" | "grid")) || "list");
  const [saved, setSaved] = useState<SavedSearch[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("odfp-saved") || "[]"); } catch { return []; }
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    // Sync params with current URL on mount and navigation
    const syncParams = () => {
      const newParams = new URLSearchParams(window.location.search);
      setParams(newParams);
    };
    
    // Sync on mount
    syncParams();
    
    // Sync on browser back/forward
    const onPop = () => syncParams();
    window.addEventListener("popstate", onPop);
    
    // Also sync on any URL change (for manual URL editing)
    const interval = setInterval(syncParams, 100);
    
    return () => {
      window.removeEventListener("popstate", onPop);
      clearInterval(interval);
    };
  }, []);

  const qs = useMemo(() => params.toString(), [params]);
  // Check if we have meaningful search parameters
  const qValue = params.get('q')?.trim();
  const variablesValue = params.get('variables')?.trim();
  const publisherValue = params.get('publisher')?.trim();
  const hasSearchQuery = (qValue && qValue.length > 0) || 
                        (variablesValue && variablesValue.length > 0) || 
                        (publisherValue && publisherValue.length > 0) || 
                        params.has('bbox') || 
                        params.has('format') || 
                        params.has('service') || 
                        (params.size > 1); // More than just default parameters
                        
  // Debug logging
  console.log('Search debug:', {
    qValue,
    variablesValue,
    publisherValue,
    hasSearchQuery,
    paramsSize: params.size,
    apiUrl: hasSearchQuery ? `/api/v1/search?${qs}` : null
  });
  
  const { data } = useSWR<SearchResult>(
    hasSearchQuery ? `/api/v1/search?${qs}` : null, 
    fetcher, 
    { revalidateOnFocus: false, dedupingInterval: 1000 }
  );
  const results: SearchResult["results"] = data?.results || [];
  const total = data?.total ?? 0;
  const page = Number(params.get("page") || "1");
  const size = Number(params.get("size") || "20");
  const pages = Math.max(1, Math.ceil(total / size));

  const pushParams = (update: (url: URL) => void) => {
    const url = new URL(window.location.href);
    update(url);
    window.history.pushState({}, "", url.pathname + "?" + url.searchParams.toString());
    setParams(new URLSearchParams(url.search));
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Search Header */}
      <div className="border-b border-slate-200/50 bg-white/90 backdrop-blur-sm dark:border-slate-800/50 dark:bg-slate-900/90">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ocean Data Discovery</h1>
            <p className="text-slate-600 dark:text-slate-400">Search and explore oceanographic datasets from NOAA and partner institutions</p>
          </div>
          <Filters onApply={(newParams) => {
            pushParams((u) => { u.search = ""; newParams.forEach((v, k) => u.searchParams.set(k, v)); });
          }} />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-5">
          <aside className="space-y-6 xl:col-span-1 hidden xl:block sticky top-24 self-start">
            <div className="rounded-xl border border-blue-200/50 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 shadow-lg dark:border-blue-800/50 dark:from-blue-950/50 dark:to-indigo-950/50">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
                  <div className="h-3 w-3 rounded bg-white"></div>
                </div>
                <h2 className="font-semibold text-blue-900 dark:text-blue-100">Filter by Category</h2>
              </div>
            <Facets selected={params} onToggle={(key, value) => pushParams((u) => {
              if (value) u.searchParams.set(key, value); else u.searchParams.delete(key);
              u.searchParams.set("page", "1");
            })} />
            </div>
            
            <div className="rounded-xl border border-green-200/50 bg-gradient-to-br from-green-50 to-emerald-50 p-5 shadow-lg dark:border-green-800/50 dark:from-green-950/50 dark:to-emerald-950/50">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500">
                  <div className="h-3 w-3 rounded bg-white"></div>
                </div>
                <h2 className="font-semibold text-green-900 dark:text-green-100">Geographic Filter</h2>
              </div>
              <p className="mb-3 text-sm text-green-700 dark:text-green-300">Pan and zoom to select a region</p>
            <FilterMapClient
              bbox={(() => {
                const b = params.get("bbox");
                if (!b) return undefined;
                const p = b.split(",").map(Number);
                return p.length === 4 && p.every(Number.isFinite) ? (p as [number, number, number, number]) : undefined;
              })()}
              onBbox={(b) => pushParams((u) => { u.searchParams.set("bbox", b.join(",")); u.searchParams.set("page", "1"); })}
            />
            </div>
            
            <div className="rounded-xl border border-amber-200/50 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-lg dark:border-amber-800/50 dark:from-amber-950/50 dark:to-orange-950/50">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500">
                  <div className="h-3 w-3 rounded bg-white"></div>
                </div>
                <h2 className="font-semibold text-amber-900 dark:text-amber-100">Saved Searches</h2>
              </div>
            <div className="space-y-2">
              {saved.length === 0 && <div className="text-sm text-amber-700 dark:text-amber-300">No saved searches yet.</div>}
              {saved.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                  <button className="truncate text-left text-blue-700 hover:underline" onClick={() => {
                    const url = new URL(window.location.href);
                    url.search = s.qs;
                    window.history.pushState({}, "", url.pathname + "?" + url.search);
                    setParams(new URLSearchParams(url.search));
                  }}>{s.label}</button>
                  <button className="text-slate-500 hover:text-red-600" onClick={() => {
                    const next = saved.filter(x => x.id !== s.id);
                    setSaved(next);
                    localStorage.setItem("odfp-saved", JSON.stringify(next));
                  }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </aside>
        
        {/* Main Content */}
        <section className="xl:col-span-4">
          {/* Results Header */}
          <div className="mb-6 rounded-xl border border-slate-200/50 bg-white/90 backdrop-blur-sm p-6 shadow-lg dark:border-slate-800/50 dark:bg-slate-900/90">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Button className="xl:hidden" variant="secondary" onClick={() => setMobileFiltersOpen(true)}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
                  </svg>
                  Filters
                </Button>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">View:</label>
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-600 dark:bg-slate-800"
                    value={view}
                    onChange={(e) => { const v = e.target.value as "list" | "grid"; setView(v); localStorage.setItem("odfp-view", v); }}
                  >
                    <option value="list">📋 List</option>
                    <option value="grid">⊞ Grid</option>
                  </select>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const label = prompt("Name this search");
                    if (!label) return;
                    const item: SavedSearch = { id: Math.random().toString(36).slice(2), label, qs };
                    const next = [item, ...saved].slice(0, 10);
                    setSaved(next);
                    localStorage.setItem("odfp-saved", JSON.stringify(next));
                  }}
                >
                  Save
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set("output", "csv");
                    window.open("/api/v1/search?" + url.searchParams.toString(), "_blank");
                  }}
                >
                  Export CSV
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => pushParams((u) => { u.search = ""; })}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <label className="text-slate-500">Sort</label>
              <select
                className="rounded border border-slate-200 bg-white px-2 py-1 dark:border-slate-800 dark:bg-slate-900"
                value={params.get("sort") || "relevance"}
                onChange={(e) => pushParams((u) => { u.searchParams.set("sort", e.target.value); u.searchParams.set("page", "1"); })}
              >
                <option value="relevance">Relevance</option>
                <option value="recency">Recency</option>
              </select>
              {params.get("bbox") && (
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  bbox: {params.get("bbox")}
                  <button
                    className="rounded-full border border-blue-200 px-1 text-xs text-blue-700 hover:bg-blue-100 dark:border-blue-700/40 dark:text-blue-300 dark:hover:bg-blue-600/20"
                    onClick={() => pushParams((u) => { u.searchParams.delete("bbox"); u.searchParams.set("page", "1"); })}
                    aria-label="Clear bbox"
                  >
                    ×
                  </button>
                </span>
              )}
              {hasSearchQuery && <span>{total} results</span>}
            </div>
          </div>

          <div className={view === "grid" ? "grid grid-cols-1 gap-4 md:grid-cols-2" : "grid gap-4"}>
            {!hasSearchQuery && (
              <div className="col-span-full text-center py-12">
                <div className="text-slate-500 dark:text-slate-400">
                  <div className="text-lg mb-2">🔍 Start Your Ocean Data Discovery</div>
                  <p className="mb-4">Use the search filters above to find oceanographic datasets.</p>
                  <p className="text-sm">Try searching for terms like sea surface temperature, wind, or chlorophyll.</p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    <Button variant="secondary" onClick={() => pushParams((u) => { u.searchParams.set("q", "sea surface temperature"); u.searchParams.set("page", "1"); })}>Sea Surface Temperature</Button>
                    <Button variant="secondary" onClick={() => pushParams((u) => { u.searchParams.set("q", "wind"); u.searchParams.set("page", "1"); })}>Wind</Button>
                    <Button variant="secondary" onClick={() => pushParams((u) => { u.searchParams.set("q", "chlorophyll"); u.searchParams.set("page", "1"); })}>Chlorophyll</Button>
                    <Button variant="secondary" onClick={() => pushParams((u) => { u.searchParams.set("q", "bathymetry"); u.searchParams.set("page", "1"); })}>Bathymetry</Button>
                  </div>
                </div>
              </div>
            )}
            {hasSearchQuery && !data && (
              <>
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
              </>
            )}
            {data && results.map((r) => (
              <ResultCard key={r.id} {...r} />
            ))}
            {data && results.length === 0 && (
              <div className="rounded border border-slate-200 p-6 text-slate-600">No results. Try adjusting filters.</div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="text-slate-600">Page {page} of {pages}</div>
            <div className="flex items-center gap-2">
              <button
                className="rounded border border-slate-200 px-3 py-1 disabled:opacity-40 dark:border-slate-800"
                disabled={page <= 1}
                onClick={() => pushParams((u) => { u.searchParams.set("page", String(page - 1)); })}
              >
                Prev
              </button>
              <button
                className="rounded border border-slate-200 px-3 py-1 disabled:opacity-40 dark:border-slate-800"
                disabled={page >= pages}
                onClick={() => pushParams((u) => { u.searchParams.set("page", String(page + 1)); })}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
      </div>

      {/* Mobile filters overlay */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 flex items-end xl:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileFiltersOpen(false)} />
          <div className="relative z-10 w-full rounded-t-2xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-800 dark:bg-slate-900 max-h-[80vh] overflow-y-auto">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">Filters</div>
              <button className="text-slate-500" onClick={() => setMobileFiltersOpen(false)}>Close</button>
            </div>
            <Filters onApply={(newParams) => {
              pushParams((u) => { u.search = ""; newParams.forEach((v, k) => u.searchParams.set(k, v)); });
              setMobileFiltersOpen(false);
            }} />
          </div>
        </div>
      )}
    </main>
  );
}

