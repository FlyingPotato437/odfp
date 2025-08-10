import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fetchErddapAllDatasets, fetchErddapInfo } from "@/lib/connectors/erddap";
import { crawlThredds } from "@/lib/connectors/thredds";
import { crawlStac } from "@/lib/connectors/stac";

async function harvestErddapBase(url: string, limit: number): Promise<{ ingested: number; failed: number }> {
  let ok = 0, fail = 0;
  try {
    const list = await fetchErddapAllDatasets(url);
    const toIngest = list.slice(0, limit);
    const host = new URL(url).host;
    for (const ds of toIngest) {
      try {
        const info = await fetchErddapInfo(url, ds.datasetID);
        const datasetId = `${host}:${ds.datasetID}`;
        await prisma.dataset.upsert({
          where: { id: datasetId },
          create: {
            id: datasetId,
            title: ds.title || ds.datasetID,
            abstract: ds.summary || null,
            publisher: ds.institution || null,
            bboxMinX: info.bbox?.[0] ?? null,
            bboxMinY: info.bbox?.[1] ?? null,
            bboxMaxX: info.bbox?.[2] ?? null,
            bboxMaxY: info.bbox?.[3] ?? null,
            timeStart: info.timeStart ? new Date(info.timeStart) : null,
            timeEnd: info.timeEnd ? new Date(info.timeEnd) : null,
            sourceSystem: "ERDDAP",
            variables: {
              create: info.variables.map((v) => ({ name: v.name || "var", standardName: v.standard_name || null, units: v.units || null, longName: v.long_name || null })),
            },
            distributions: {
              create: [
                { url: `${url}/erddap/tabledap/${encodeURIComponent(ds.datasetID)}.csv`, accessService: "ERDDAP", format: "CSV" },
                { url: `${url}/erddap/griddap/${encodeURIComponent(ds.datasetID)}.nc`, accessService: "ERDDAP", format: "NetCDF" },
              ],
            },
          },
          update: {
            title: ds.title || ds.datasetID,
            abstract: ds.summary || null,
            publisher: ds.institution || null,
            bboxMinX: info.bbox?.[0] ?? null,
            bboxMinY: info.bbox?.[1] ?? null,
            bboxMaxX: info.bbox?.[2] ?? null,
            bboxMaxY: info.bbox?.[3] ?? null,
            timeStart: info.timeStart ? new Date(info.timeStart) : null,
            timeEnd: info.timeEnd ? new Date(info.timeEnd) : null,
            distributions: { deleteMany: {}, create: [
              { url: `${url}/erddap/tabledap/${encodeURIComponent(ds.datasetID)}.csv`, accessService: "ERDDAP", format: "CSV" },
              { url: `${url}/erddap/griddap/${encodeURIComponent(ds.datasetID)}.nc`, accessService: "ERDDAP", format: "NetCDF" },
            ] },
          },
        });
        ok++;
      } catch {
        fail++;
      }
    }
  } catch {
    // ignore
  }
  return { ingested: ok, failed: fail };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const kind = typeof body.kind === "string" ? body.kind : "erddap_base";
  const limitTargets = typeof body.limitTargets === "number" ? Math.max(1, Math.min(50, body.limitTargets)) : 5;
  const perTarget = typeof body.perTarget === "number" ? Math.max(1, Math.min(500, body.perTarget)) : 50;

  // Ensure table exists (runtime safety if migration hasn't been applied yet)
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

  // Fetch queued targets of the requested kind
  const targets: Array<{ url: string }> = await prisma.$queryRawUnsafe(
    `select url from "HarvestTarget" where kind = $1 and coalesce(status,'queued') = 'queued' order by coalesce("lastChecked", '1970-01-01') asc limit $2`,
    kind,
    limitTargets,
  );

  let totalIngested = 0, totalFailed = 0, processed = 0;
  for (const t of targets) {
    processed++;
    // mark running
    await prisma.$executeRawUnsafe(`update "HarvestTarget" set status = 'running', attempts = attempts + 1 where url = $1`, t.url);
    if (kind === "erddap_base") {
      const res = await harvestErddapBase(t.url, perTarget);
      totalIngested += res.ingested;
      totalFailed += res.failed;
    } else if (kind === "thredds_catalog") {
      try {
        const list = await crawlThredds(t.url, 2);
        for (const ds of list.slice(0, perTarget)) {
          try {
            const id = `${new URL(t.url).host}:${ds.id}`;
            await prisma.dataset.upsert({
              where: { id },
              create: {
                id,
                title: ds.title || ds.id,
                abstract: ds.summary || null,
                sourceSystem: "THREDDS",
                distributions: { create: ds.distributions.map(d => ({ url: d.url, accessService: d.service || 'HTTP', format: d.format || 'HTTP' })) },
              },
              update: {
                title: ds.title || ds.id,
                abstract: ds.summary || null,
                distributions: { deleteMany: {}, create: ds.distributions.map(d => ({ url: d.url, accessService: d.service || 'HTTP', format: d.format || 'HTTP' })) },
              },
            });
            totalIngested++;
          } catch { totalFailed++; }
        }
      } catch { totalFailed++; }
    } else if (kind === "stac_root") {
      try {
        const list = await crawlStac(t.url, 2);
        for (const c of list.slice(0, perTarget)) {
          try {
            const id = `${new URL(t.url).host}:${c.id}`;
            await prisma.dataset.upsert({
              where: { id },
              create: {
                id,
                title: c.title || c.id,
                abstract: c.description || null,
                sourceSystem: "STAC",
                distributions: { create: c.assets.map(a => ({ url: a.url, accessService: 'HTTP', format: a.type || 'HTTP' })) },
              },
              update: {
                title: c.title || c.id,
                abstract: c.description || null,
                distributions: { deleteMany: {}, create: c.assets.map(a => ({ url: a.url, accessService: 'HTTP', format: a.type || 'HTTP' })) },
              },
            });
            totalIngested++;
          } catch { totalFailed++; }
        }
      } catch { totalFailed++; }
    }
    await prisma.$executeRawUnsafe(`update "HarvestTarget" set status = 'success', "lastChecked" = now() where url = $1`, t.url);
  }

  return Response.json({ ok: true, kind, processed, ingested: totalIngested, failed: totalFailed });
}

