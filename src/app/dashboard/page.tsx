"use client";
import useSWR from "swr";

type Job = { id: string; createdAt: string; status: string; source?: string };
type StatusPayload = { datasetCount: number; jobs: Job[] };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function Dashboard() {
  const { data } = useSWR<StatusPayload>("/api/v1/admin/status", fetcher, { refreshInterval: 8000 });
  const datasetCount = data?.datasetCount ?? 0;
  const jobs = data?.jobs ?? [];
  const successRate = jobs.length ? Math.round((jobs.filter((j) => j.status === "success").length / jobs.length) * 100) : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-semibold">Dashboard</h1>
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase text-slate-500">Datasets</div>
          <div className="mt-1 text-3xl font-semibold text-slate-900">{Intl.NumberFormat().format(datasetCount)}</div>
          <div className="text-xs text-slate-500">in catalog</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase text-slate-500">Jobs (recent)</div>
          <div className="mt-1 text-3xl font-semibold text-slate-900">{jobs.length}</div>
          <div className="text-xs text-slate-500">last 20 runs</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase text-slate-500">Success rate</div>
          <div className="mt-1 text-3xl font-semibold text-slate-900">{successRate != null ? `${successRate}%` : "—"}</div>
          <div className="text-xs text-slate-500">recent</div>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-2 text-sm font-semibold">Recent Jobs</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">ID</th>
                <th className="py-2">Created</th>
                <th className="py-2">Source</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-slate-100">
                  <td className="py-2 font-mono text-xs text-slate-700">{j.id}</td>
                  <td className="py-2 text-slate-700">{new Date(j.createdAt).toLocaleString()}</td>
                  <td className="py-2 text-slate-700">{j.source || "—"}</td>
                  <td className="py-2">
                    <span className={`${j.status === "success" ? "bg-emerald-100 text-emerald-800" : j.status === "failed" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"} rounded px-2 py-0.5 text-xs`}>{j.status}</span>
                  </td>
                </tr>
              ))}
              {!jobs.length && (
                <tr>
                  <td colSpan={4} className="py-4 text-slate-500">No jobs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

