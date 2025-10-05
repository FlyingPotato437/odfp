import { embedTexts } from "@/lib/ai/gemini";
import { executeSearch } from "@/lib/search";
import { prisma } from "@/lib/db";

// Hybrid search combining semantic (vector) and lexical (full-text) search
// Uses 60% semantic similarity + 40% lexical relevance for optimal results
export async function semanticSearch(query: string, k = 5): Promise<Array<{ id: string; score: number }>> {
  try {
    // Run both semantic and lexical search in parallel
    const [semanticResults, lexicalResults] = await Promise.all([
      performSemanticSearch(query, k * 3), // Fetch more candidates for reranking
      performLexicalSearch(query, k * 3)
    ]);

    // Combine results using hybrid scoring
    const combinedScores = new Map<string, { semantic: number; lexical: number }>();

    // Add semantic scores
    semanticResults.forEach(result => {
      combinedScores.set(result.id, {
        semantic: result.score,
        lexical: 0
      });
    });

    // Add lexical scores
    lexicalResults.forEach(result => {
      const existing = combinedScores.get(result.id);
      if (existing) {
        existing.lexical = result.score;
      } else {
        combinedScores.set(result.id, {
          semantic: 0,
          lexical: result.score
        });
      }
    });

    // Calculate hybrid scores: 60% semantic + 40% lexical
    const hybridResults = Array.from(combinedScores.entries())
      .map(([id, scores]) => ({
        id,
        score: scores.semantic * 0.6 + scores.lexical * 0.4
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);

    return hybridResults;
  } catch (error) {
    console.error("Hybrid search failed, falling back to lexical:", error);
    const lex = await executeSearch({ q: query, size: k });
    return lex.results.map((r, i) => ({ id: r.id, score: 1 - i * 0.1 }));
  }
}

// Pure semantic search using pgvector
async function performSemanticSearch(query: string, k: number): Promise<Array<{ id: string; score: number }>> {
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
  } catch (error) {
    console.error("Semantic search failed:", error);
    return [];
  }
}

// Lexical search using full-text search
async function performLexicalSearch(query: string, k: number): Promise<Array<{ id: string; score: number }>> {
  try {
    const lex = await executeSearch({ q: query, size: k });
    // Normalize scores to 0-1 range based on rank
    return lex.results.map((r, i) => ({
      id: r.id,
      score: Math.max(0, 1 - (i / k))  // Linear decay based on rank
    }));
  } catch (error) {
    console.error("Lexical search failed:", error);
    return [];
  }
}

