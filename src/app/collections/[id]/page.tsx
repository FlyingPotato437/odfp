"use client";
import useSWR from "swr";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

type Collection = { id: string; title: string; description?: string; dataset_ids: string[] };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function CollectionDetail() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const { data } = useSWR<Collection>(`/api/v1/collections/${encodeURIComponent(id)}`, fetcher);
  const col = data;
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {!col ? (
        <div className="rounded border border-slate-200 bg-white p-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">Loading…</div>
      ) : (
        <>
          <h1 className="mb-2 text-3xl font-semibold dark:text-white">{col.title}</h1>
          <p className="mb-6 text-slate-700 dark:text-slate-300">{col.description || ""}</p>
          <div className="grid grid-cols-1 gap-3">
            {col.dataset_ids.map((ds) => (
              <Card key={ds}>
                <CardHeader>
                  <Link className="font-semibold text-blue-700 hover:underline" href={`/dataset/${encodeURIComponent(ds)}`}>{ds}</Link>
                </CardHeader>
                <CardContent className="text-sm text-slate-600 dark:text-slate-400">Dataset in this collection</CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

