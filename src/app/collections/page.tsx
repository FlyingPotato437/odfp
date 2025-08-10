"use client";
import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

type Collection = { id: string; title: string; description?: string; dataset_ids: string[] };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function Collections() {
  const { data } = useSWR<{ total: number; results: Collection[] }>("/api/v1/collections", fetcher);
  const cols = data?.results || [];
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-4 text-3xl font-semibold dark:text-white">Collections</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cols.map((c) => (
          <Card key={c.id} className="hover:shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Link className="text-lg font-semibold hover:underline dark:text-slate-100" href={`/collections/${encodeURIComponent(c.id)}`}>{c.title}</Link>
                <span className="text-sm text-slate-500 dark:text-slate-400">{c.dataset_ids.length} datasets</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 dark:text-slate-300">{c.description || ""}</p>
            </CardContent>
          </Card>
        ))}
        {cols.length === 0 && (
          <div className="rounded border border-slate-200 bg-white p-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">No collections found.</div>
        )}
      </div>
    </main>
  );
}

