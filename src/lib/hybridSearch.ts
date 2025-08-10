import { executeSearch as dbSearch } from "@/lib/search";
import type { SearchQuery, SearchResult } from "@/lib/types";
import { semanticSearch } from "@/lib/ai/indexer";
import { prisma } from "@/lib/db";
import type { Dataset, Variable, Distribution } from "@prisma/client";

function rrfOrder(lex: SearchResult, sem: Array<{ id: string; score: number }>, k = 100): string[] {
  const rrf: Map<string, number> = new Map();
  const kRR = 60;
  // Lexical ranks
  lex.results.forEach((r, i) => {
    const prev = rrf.get(r.id) || 0;
    rrf.set(r.id, prev + 1 / (kRR + i + 1));
  });
  // Semantic ranks
  sem.forEach((s, i) => {
    const prev = rrf.get(s.id) || 0;
    rrf.set(s.id, prev + 1 / (kRR + i + 1));
  });
  // Sort by rrf score
  return Array.from(rrf.entries()).sort((a, b) => b[1] - a[1]).slice(0, k).map(([id]) => id);
}

export async function hybridSearch(query: SearchQuery): Promise<SearchResult> {
  const [lex] = await Promise.all([
    dbSearch({ ...query, page: 1, size: Math.max(query.size ?? 20, 100) }),
  ]);
  // Run semantic on the raw query if present
  let sem: Array<{ id: string; score: number }> = [];
  if (query.q && query.q.trim()) {
    try {
      sem = await semanticSearch(query.q, 100);
    } catch {
      sem = [];
    }
  }
  const kCandidate = Math.min((lex.results.length + sem.length) || 100, 500);
  const rankedIds = rrfOrder(lex, sem, Math.max(kCandidate, query.size ?? 20));

  // Hydrate: prefer lexical objects; fetch missing ids from DB
  const byIdLex = new Map(lex.results.map(r => [r.id, r]));
  const missingIds = rankedIds.filter(id => !byIdLex.has(id));
  type DatasetWithRel = Dataset & { variables: Variable[]; distributions: Distribution[] };
  let fetched: DatasetWithRel[] = [];
  if (missingIds.length > 0) {
    fetched = await prisma.dataset.findMany({ where: { id: { in: missingIds } }, include: { variables: true, distributions: true } });
  }
  const byIdFetched = new Map(fetched.map(d => [d.id, d]));

  const validServices = ["HTTP", "OPeNDAP", "THREDDS", "ERDDAP", "FTP", "S3"] as const;
  type Service = typeof validServices[number];
  const toServiceStrict = (s: string): Service => ((validServices as readonly string[]).includes(s) ? (s as Service) : "HTTP");

  const hydrated: SearchResult["results"] = rankedIds
    .map((id) => {
      const fromLex = byIdLex.get(id);
      if (fromLex) return fromLex;
      const d = byIdFetched.get(id);
      if (!d) return undefined;
      return {
        id: d.id,
        doi: d.doi || undefined,
        title: d.title,
        publisher: d.publisher || undefined,
        time: { start: d.timeStart?.toISOString(), end: d.timeEnd?.toISOString() },
        spatial: { bbox: [d.bboxMinX, d.bboxMinY, d.bboxMaxX, d.bboxMaxY] as [number, number, number, number] | undefined },
        variables: d.variables.map((v) => v.name),
        distributions: d.distributions.map((dist) => ({ url: dist.url, format: dist.format, service: toServiceStrict(dist.accessService) })),
      };
    })
    .filter(Boolean) as SearchResult["results"];

  const fused = { total: hydrated.length, page: 1, size: hydrated.length, results: hydrated } satisfies SearchResult;

  // Paginate fused according to requested page/size
  const page = query.page ?? 1;
  const size = query.size ?? 20;
  const start = (page - 1) * size;
  const pageItems = fused.results.slice(start, start + size);
  return { total: fused.results.length, page, size, results: pageItems };
}
