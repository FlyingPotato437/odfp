import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!isAdmin(req as unknown as Request)) return Response.json({ error: "forbidden" }, { status: 403 });

  // Ensure columns exist (in case migrations lag behind)
  const ensureStmts = [
    `create extension if not exists postgis;`,
    `create extension if not exists pg_trgm;`,
    `alter table "Dataset" add column if not exists geom geometry(Polygon, 4326);`,
    `alter table "Dataset" add column if not exists search_tsvector tsvector;`,
  ];
  for (const s of ensureStmts) {
    try { await prisma.$executeRawUnsafe(s); } catch {}
  }

  const tsvUpdated: number = await prisma.$executeRawUnsafe(
    `update "Dataset"
     set search_tsvector =
       setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
       setweight(to_tsvector('simple', coalesce(abstract,'')), 'B') ||
       setweight(to_tsvector('simple', coalesce(publisher,'')), 'C')`
  );

  const geomUpdated: number = await prisma.$executeRawUnsafe(
    `update "Dataset"
     set geom = ST_MakeEnvelope("bboxMinX", "bboxMinY", "bboxMaxX", "bboxMaxY", 4326)
     where geom is null and "bboxMinX" is not null and "bboxMinY" is not null and "bboxMaxX" is not null and "bboxMaxY" is not null`
  );

  return Response.json({ ok: true, tsvUpdated, geomUpdated });
}

