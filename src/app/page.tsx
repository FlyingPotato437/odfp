"use client";
import { useState } from "react";
import { Hero } from "@/components/ui/hero";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [nlQuery, setNlQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const onApplyQuery = (params: URLSearchParams) => {
    const url = new URL(window.location.href);
    url.pathname = "/search";
    url.search = "";
    params.forEach((v, k) => url.searchParams.set(k, v));
    router.push(url.pathname + "?" + url.searchParams.toString());
  };

  const runAiBuilder = async () => {
    if (!nlQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ai/parse-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: nlQuery }),
      });
      const json = await res.json();
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(json.query || {})) {
        if (v == null) continue;
        if (Array.isArray(v)) params.set(k, v.join(","));
        else params.set(k, String(v));
      }
      params.set("page", "1");
      onApplyQuery(params);
    } finally {
      setLoading(false);
    }
  };

  const goSearch = () => {
    const p = new URLSearchParams();
    if (nlQuery.trim()) p.set("q", nlQuery.trim());
    p.set("page", "1");
    onApplyQuery(p);
  };

  return (
    <main>
      {/* Hero Section with Globe */}
      <Hero />
      
      {/* Search Section */}
      <section id="search-section" className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-slate-50 p-8 shadow-md dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
          <div className="grid gap-6 md:grid-cols-5">
            <div className="md:col-span-3">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl dark:text-white">
                Start Your Ocean Data Search
              </h2>
              <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
                Search across NOAA/NCEI and partner datasets. Filter by location, time, variables, and formats. Export results in DCAT & ISO formats.
              </p>
              <div className="mt-6 flex flex-col gap-3 md:flex-row">
                <Input
                  className="flex-1"
                  placeholder="Ask in natural language (e.g., global monthly SST 2000–2020, NetCDF, 1°)"
                  value={nlQuery}
                  onChange={(e) => setNlQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") goSearch(); }}
                />
                <div className="flex gap-2">
                  <Button onClick={goSearch}>Search</Button>
                  <Button variant="secondary" onClick={runAiBuilder} disabled={loading}>
                    {loading ? "Building…" : "AI Build Query"}
                  </Button>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Tip: Try &quot;weekly chlorophyll in Pacific 2010–2020, NetCDF, ERDDAP&quot;.
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-xs uppercase text-slate-500">Datasets</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">10k+</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">from NOAA/NCEI & partners</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-xs uppercase text-slate-500">Variables</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">2k+</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">with units & standards</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-xs uppercase text-slate-500">Formats</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">NetCDF, Zarr</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">and more</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-xs uppercase text-slate-500">Services</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">ERDDAP, THREDDS</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">HTTP, OPeNDAP, S3</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
