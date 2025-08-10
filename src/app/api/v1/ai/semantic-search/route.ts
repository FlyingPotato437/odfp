import { semanticSearch } from "@/lib/ai/indexer";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const q = typeof body.q === "string" ? body.q : "";
  if (!q) return Response.json({ q: "", results: [] }, { status: 200 });
  const k = typeof body.k === "number" ? body.k : 10;
  const scored = await semanticSearch(q, k);
  const ids = scored.map((s: { id: string }) => s.id);
  const rows = ids.length ? await prisma.dataset.findMany({ where: { id: { in: ids } }, include: { variables: true, distributions: true } }) : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const results = scored.map((s: { id: string; score: number }) => ({ score: s.score, dataset: byId.get(s.id) || null }));
  return Response.json({ q, results });
}

