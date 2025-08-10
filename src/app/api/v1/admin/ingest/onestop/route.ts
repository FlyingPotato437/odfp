import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// NOAA OneStop harvester (basic, GET-based)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const q: string | undefined = typeof body.q === "string" ? body.q : undefined;
  const queries: string[] = Array.isArray(body.queries) ? body.queries.filter((x: unknown) => typeof x === "string") as string[] : [];
  const size: number = typeof body.size === "number" ? Math.min(200, Math.max(1, body.size)) : 50;
  const pages: number = typeof body.pages === "number" ? Math.min(50, Math.max(1, body.pages)) : 1;

  type OneStopRecord = Record<string, unknown> & {
    source?: { id?: string };
    id?: string; uid?: string; doi?: string; title?: string;
    identification?: { title?: string; abstract?: string };
    abstract?: string; description?: string;
    publisher?: { name?: string };
    organisationName?: string;
    spatial?: { bbox?: [number, number, number, number] };
    extent?: { geographic?: { boundingBox?: [number, number, number, number] } };
    temporal?: { begin?: string; end?: string };
    time?: { start?: string; end?: string };
    links?: Array<{ url?: string; href?: string }>;
    serviceLinks?: Array<{ url?: string; href?: string }>;
  };

  const terms = q ? [q] : (queries.length ? queries : ["ocean"]);
  let ingested = 0;
  let harvestedTargets = 0;

  // Ensure HarvestTarget table exists to avoid runtime errors when upserting
  await prisma.$executeRawUnsafe(
    `create table if not exists "HarvestTarget" (
      id text primary key,
      kind text not null,
      url text not null unique,
      status text,
      "lastChecked" timestamptz,
      attempts integer not null default 0,
      "discoveredFrom" text,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now()
    )`
  );

  const urlsFromRecord = (rec: OneStopRecord): string[] => {
    const urls: string[] = [];
    const push = (u?: string) => { if (typeof u === "string" && u.startsWith("http")) urls.push(u); };
    for (const arr of [rec.links, rec.serviceLinks]) {
      if (Array.isArray(arr)) for (const x of arr) { push(x?.url); push(x?.href); }
    }
    return Array.from(new Set(urls));
  };

  const upsertHarvestTarget = async (kind: string, url: string, discoveredFrom?: string) => {
    try {
      await prisma.harvestTarget.upsert({
        where: { url },
        create: { kind, url, status: "queued", attempts: 0, discoveredFrom },
        update: { kind, status: "queued" },
      });
      harvestedTargets++;
    } catch {}
  };

  for (const term of terms) {
    for (let page = 0; page < pages; page++) {
      // Use NCEI OneStop endpoint which tends to be available
      const base = "https://www.ncei.noaa.gov/onestop/api/search/collections";
      const url = new URL(base);
      url.searchParams.set("q", term);
      url.searchParams.set("pageSize", String(size));
      url.searchParams.set("page", String(page));
      const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } });
      if (!res.ok) break;
      const json: { records?: OneStopRecord[] } | null = await res.json().catch(() => null);
      const recs: OneStopRecord[] = Array.isArray(json?.records) ? json!.records! : [];
      if (recs.length === 0) break;
      for (const rec of recs) {
        const id: string = String(rec.source?.id || rec.id || rec.uid || rec.doi || rec.title || crypto.randomUUID());
        const title: string = String(rec.title || rec.identification?.title || id);
        const abstract: string | null = (rec.abstract || rec.description || rec.identification?.abstract || null) as string | null;
        const publisher: string | null = (rec.publisher?.name || rec.organisationName || null) as string | null;
        const doi: string | null = (rec.doi || null) as string | null;
        const bbox = (rec.spatial?.bbox || rec.extent?.geographic?.boundingBox) as [number, number, number, number] | undefined;
        const start = (rec.temporal?.begin || rec.time?.start || null) as string | null;
        const end = (rec.temporal?.end || rec.time?.end || null) as string | null;

        try {
          await prisma.dataset.upsert({
            where: { id },
            create: {
              id,
              title,
              abstract,
              publisher,
              doi,
              bboxMinX: bbox?.[0] ?? null,
              bboxMinY: bbox?.[1] ?? null,
              bboxMaxX: bbox?.[2] ?? null,
              bboxMaxY: bbox?.[3] ?? null,
              timeStart: start ? new Date(start) : null,
              timeEnd: end ? new Date(end) : null,
              sourceSystem: "OneStop",
            },
            update: {
              title,
              abstract,
              publisher,
              doi,
              bboxMinX: bbox?.[0] ?? null,
              bboxMinY: bbox?.[1] ?? null,
              bboxMaxX: bbox?.[2] ?? null,
              bboxMaxY: bbox?.[3] ?? null,
              timeStart: start ? new Date(start) : null,
              timeEnd: end ? new Date(end) : null,
            },
          });
          ingested++;
        } catch {}

        // Discover downstream services
        const urls = urlsFromRecord(rec);
        for (const u of urls) {
          if (/\/erddap\//i.test(u)) {
            const m = u.match(/^https?:\/\/[^\/]+(?:\/erddap)?/i);
            if (m) await upsertHarvestTarget("erddap_base", m[0], id);
          } else if (/thredds\/catalog\.xml$/i.test(u)) {
            await upsertHarvestTarget("thredds_catalog", u, id);
          } else if (/catalog\.json$/i.test(u) || /\/stac\/?$/i.test(u)) {
            await upsertHarvestTarget("stac_root", u, id);
          }
        }
      }
    }

    // Fallback: NCEI Search Service for access links
    try {
      const ncei = new URL("https://www.ncei.noaa.gov/access/services/search/v1/datasets");
      ncei.searchParams.set("text", term);
      ncei.searchParams.set("limit", String(size));
      ncei.searchParams.set("offset", String(0));
      const r = await fetch(ncei.toString());
      if (r.ok) {
        const j: { results?: Array<{ id?: string; links?: { access?: Array<{ url?: string }>; other?: Array<{ url?: string }>; related?: Array<{ url?: string }> } }> } = await r.json();
        const results: Array<{ id?: string; links?: { access?: Array<{ url?: string }>; other?: Array<{ url?: string }>; related?: Array<{ url?: string }> } }> = Array.isArray(j?.results) ? j.results : [];
        for (const rec of results) {
          const links: { access?: Array<{ url?: string }>; other?: Array<{ url?: string }>; related?: Array<{ url?: string }> } = (rec?.links || {}) as { access?: Array<{ url?: string }>; other?: Array<{ url?: string }>; related?: Array<{ url?: string }> };
          const groups: Array<Array<{ url?: string }> | undefined> = [links.access, links.other, links.related];
          for (const grp of groups) {
            if (!Array.isArray(grp)) continue;
            for (const a of grp) {
              const u: string | undefined = a?.url;
              if (!u || !u.startsWith("http")) continue;
              if (/\/erddap\//i.test(u)) {
                const m = u.match(/^https?:\/\/[^\/]+(?:\/erddap)?/i);
                if (m) await upsertHarvestTarget("erddap_base", m[0], rec.id);
              } else if (/thredds\/catalog\.xml$/i.test(u)) {
                await upsertHarvestTarget("thredds_catalog", u, rec.id);
              } else if (/catalog\.json$/i.test(u) || /\/stac\/?$/i.test(u)) {
                await upsertHarvestTarget("stac_root", u, rec.id);
              }
            }
          }
        }
      }
    } catch {}
  }

  return Response.json({ ok: true, ingested, discovered: harvestedTargets });
}
