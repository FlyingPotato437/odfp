import { embedTexts } from "@/lib/ai/gemini";
import { executeSearch } from "@/lib/search";
import { prisma } from "@/lib/db";

// DB-backed semantic search using pgvector
export async function semanticSearch(query: string, k = 5): Promise<Array<{ id: string; score: number }>> {
  try {
    const [vec] = await embedTexts([query]);
    // Build vector literal string for pgvector cast
    const vecLiteral = `[${vec.join(",")}]`;
    // IMPORTANT: With transaction poolers like Supavisor/pgbouncer, binding a custom type parameter
    // (e.g., $1::vector) can fail to resolve. Inline the vector literal instead.
    const sql = `select id, (1 - (embedding <=> '${vecLiteral}'::vector)) as score
                 from "Dataset"
                 where embedding is not null
                 order by embedding <=> '${vecLiteral}'::vector asc
                 limit ${Number.isFinite(k) ? Math.max(1, Math.min(1000, k)) : 5}`;
    const rows: Array<{ id: string; score: number }> = await prisma.$queryRawUnsafe(sql);
    return rows;
  } catch {
    const lex = await executeSearch({ q: query, size: k });
    return lex.results.map((r, i) => ({ id: r.id, score: 1 - i * 0.1 }));
  }
}

