"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import useSWR from "swr";

export default function Admin() {
  const [dsl, setDsl] = useState(
    '{\n  "datasets": [\n    {\n      "id": "demo:sst-1",\n      "title": "Demo SST dataset",\n      "publisher": "NOAA NCEI",\n      "distributions": [{"url":"https://example.org/dataset.nc","format":"NetCDF","service":"HTTP"}],\n      "variables":[{"name":"sea_surface_temperature","units":"K"}]\n    }\n  ]\n}'
  );
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const { data: statusLive } = useSWR("/api/v1/admin/status", (u) => fetch(u).then(r => r.json()), { refreshInterval: 5000 });

  const ingest = async () => {
    try {
      const res = await fetch("/api/v1/admin/ingest/dcat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: dsl,
      });
      const json = await res.json();
      alert(JSON.stringify(json));
    } catch (e) {
      alert(String(e));
    }
  };

  const refresh = async () => {
    const res = await fetch("/api/v1/admin/status");
    setStatus(await res.json());
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold dark:text-white">Admin</h1>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardContent>
            <h2 className="mb-2 text-sm font-semibold dark:text-slate-100">DCAT JSON Import</h2>
            <textarea className="h-64 w-full rounded border border-slate-300 p-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={dsl} onChange={(e) => setDsl(e.target.value)} />
            <div className="mt-2 flex gap-2">
              <Button onClick={ingest}>Ingest</Button>
              <Button variant="secondary" onClick={refresh}>Refresh Status</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <h2 className="mb-2 text-sm font-semibold dark:text-slate-100">System Status</h2>
            <div className="mb-2 text-sm text-slate-600 dark:text-slate-300">Live</div>
            <pre className="mb-4 rounded bg-slate-50 p-2 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-200">{statusLive ? JSON.stringify(statusLive, null, 2) : "(no data)"}</pre>
            <div className="text-sm text-slate-600 dark:text-slate-300">Manual</div>
            <pre className="rounded bg-slate-50 p-2 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-200">{status ? JSON.stringify(status, null, 2) : "(no data)"}</pre>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

