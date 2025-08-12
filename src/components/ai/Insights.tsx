"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import Markdown from "@/components/ui/Markdown";

type Props = { query: string };

type Synthesis = {
  synthesizedInsight: string;
  recommendedDatasets: Array<{ id: string; title: string; relevanceReason: string; confidenceScore: number; dataQualityScore: number }>;
  temporalAnalysis?: { timeRange?: string };
  spatialAnalysis?: { coverage?: string };
  nextSteps?: string[];
  crossDatasetInsights?: string[];
};

export function Insights({ query }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Synthesis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/v1/ai/synthesize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "Failed to synthesize");
    } finally { setLoading(false); }
  };

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-gradient-to-b from-white to-slate-50 p-0 shadow-md dark:border-slate-800/60 dark:from-slate-900 dark:to-slate-950">
      <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-500 px-4 py-3 text-white">
        <div className="font-semibold">AI Insights</div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm md:inline">for: {query || "(no query)"}</span>
          <Button onClick={run} disabled={loading || !query}>
            {loading ? "Analyzing…" : "Generate"}
          </Button>
        </div>
      </div>
      {error && <div className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>}
      {loading && !data && (
        <div className="px-4 py-6 text-sm text-slate-600 dark:text-slate-300">Generating insights…</div>
      )}
      {data && (
        <div className="grid gap-6 p-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <Markdown text={data.synthesizedInsight || ""} />
          </div>
          <div className="space-y-3">
            {data.temporalAnalysis?.timeRange && (
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs uppercase text-slate-500">Time Range</div>
                <div className="mt-1 font-medium">{data.temporalAnalysis.timeRange}</div>
              </div>
            )}
            {data.spatialAnalysis?.coverage && (
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs uppercase text-slate-500">Spatial Coverage</div>
                <div className="mt-1 font-medium">{data.spatialAnalysis.coverage}</div>
              </div>
            )}
            {data.nextSteps && data.nextSteps.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs uppercase text-slate-500">Recommended Next Steps</div>
                <ul className="mt-1 list-disc pl-5">
                  {data.nextSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {data.recommendedDatasets?.length > 0 && (
            <div className="md:col-span-3">
              <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Recommended datasets</div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {data.recommendedDatasets.map((d) => (
                  <a key={d.id} href={`/dataset/${encodeURIComponent(d.id)}`} className="group block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                    <div className="font-medium text-slate-900 group-hover:text-sky-600 dark:text-white">{d.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{d.relevanceReason}</div>
                  </a>
                ))}
              </div>
            </div>
          )}
          {data.crossDatasetInsights && data.crossDatasetInsights.length > 0 && (
            <div className="md:col-span-3">
              <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Cross-dataset opportunities</div>
              <ul className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900 list-disc pl-5">
                {data.crossDatasetInsights.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
