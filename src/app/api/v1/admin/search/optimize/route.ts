import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

function auth(req: NextRequest): boolean {
  const header = req.headers.get('authorization') || '';
  const token = header.replace(/^bearer\s+/i, '');
  const admin = process.env.ADMIN_TOKEN || 'odfp123';
  return Boolean(token && token === admin);
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const statements: string[] = [
      `create extension if not exists pg_trgm`,
      `create extension if not exists postgis`,
      `create extension if not exists vector`,
      // geom column from bbox
      `alter table "Dataset" add column if not exists geom geometry(Polygon,4326)`,
      `update "Dataset" set geom = ST_MakeEnvelope("bboxMinX","bboxMinY","bboxMaxX","bboxMaxY", 4326) where geom is null and "bboxMinX" is not null and "bboxMinY" is not null and "bboxMaxX" is not null and "bboxMaxY" is not null`,
      `create index if not exists dataset_geom_gist on "Dataset" using gist (geom)`,
      // trigram for fuzzy matches
      `create index if not exists dataset_title_trgm on "Dataset" using gin (title gin_trgm_ops)`,
      `create index if not exists dataset_abstract_trgm on "Dataset" using gin (abstract gin_trgm_ops)`,
      // FTS materialized view over dataset + variables + distributions
      `create materialized view if not exists dataset_fts as
         select d.id,
           to_tsvector('english',
             coalesce(d.title,'') || ' ' || coalesce(d.abstract,'') || ' ' || coalesce(d.publisher,'') || ' ' ||
             coalesce(d.doi,'') || ' ' || coalesce(d.license,'') || ' ' || coalesce(d."sourceSystem",'') || ' ' ||
             coalesce(string_agg(distinct v.name || ' ' || coalesce(v."standardName",'') || ' ' || coalesce(v."longName",''), ' '), '') || ' ' ||
             coalesce(string_agg(distinct (dist.format || ' ' || dist."accessService"), ' '), '')
           ) as tsv
         from "Dataset" d
         left join "Variable" v on v."datasetId" = d.id
         left join "Distribution" dist on dist."datasetId" = d.id
         group by d.id, d.title, d.abstract, d.publisher, d.doi, d.license, d."sourceSystem"`,
      `create index if not exists dataset_fts_gin on dataset_fts using gin (tsv)`
    ];
    for (const sql of statements) {
      try { await prisma.$executeRawUnsafe(sql); } catch { /* ignore each failure */ }
    }
    // Final refresh to ensure it's populated
    try { await prisma.$executeRawUnsafe('refresh materialized view dataset_fts'); } catch {}
    return Response.json({ ok: true });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}

