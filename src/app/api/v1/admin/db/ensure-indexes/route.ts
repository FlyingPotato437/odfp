import { prisma } from "@/lib/db";

// Applies key indexes directly (useful when remote migration push has issues)
export async function POST() {
  const stmts = [
    `create extension if not exists pg_trgm;`,
    `create index if not exists dataset_title_trgm on "Dataset" using gin (title gin_trgm_ops);`,
    `drop index if exists dataset_embedding_idx;`,
    `create index if not exists dataset_embedding_idx on "Dataset" using ivfflat ("embedding" vector_cosine) with (lists = 200);`,
  ];
  let applied = 0;
  for (const s of stmts) {
    try { await prisma.$executeRawUnsafe(s); applied++; } catch {}
  }
  return Response.json({ ok: true, applied });
}

