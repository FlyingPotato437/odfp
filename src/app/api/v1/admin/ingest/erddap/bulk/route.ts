import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { fetchErddapAllDatasets, fetchErddapInfo } from "@/lib/connectors/erddap";

export async function POST(req: NextRequest) {
  if (!isAdmin(req as unknown as Request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const baseUrls: string[] = Array.isArray(body.baseUrls) ? body.baseUrls.filter((u: unknown) => typeof u === "string") as string[] : [];
  const limitPerHost: number = typeof body.limitPerHost === "number" ? body.limitPerHost : 50;
  const targets = baseUrls;
  if (targets.length === 0) {
    return Response.json({ error: "baseUrls required" }, { status: 400 });
  }

  const summary: Array<{ baseUrl: string; ingested: number; failed: number; errors?: string[] }> = [];

  for (const baseUrl of targets) {
    const errors: string[] = [];
    let ok = 0; let fail = 0;
    try {
      const list = await fetchErddapAllDatasets(baseUrl);
      const toIngest = list.slice(0, limitPerHost);
      const host = new URL(baseUrl).host;
      for (const ds of toIngest) {
        try {
          const info = await fetchErddapInfo(baseUrl, ds.datasetID);
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
              variables: { create: info.variables.map((v) => ({ name: v.name || "var", standardName: v.standard_name || null, units: v.units || null, longName: v.long_name || null })) },
              distributions: { create: [
                { url: `${baseUrl}/erddap/tabledap/${encodeURIComponent(ds.datasetID)}.csv`, accessService: "ERDDAP", format: "CSV" },
                { url: `${baseUrl}/erddap/griddap/${encodeURIComponent(ds.datasetID)}.nc`, accessService: "ERDDAP", format: "NetCDF" },
              ] },
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
              distributions: {
                deleteMany: {},
                create: [
                  { url: `${baseUrl}/erddap/tabledap/${encodeURIComponent(ds.datasetID)}.csv`, accessService: "ERDDAP", format: "CSV" },
                  { url: `${baseUrl}/erddap/griddap/${encodeURIComponent(ds.datasetID)}.nc`, accessService: "ERDDAP", format: "NetCDF" },
                ],
              },
            },
          });
          ok++;
        } catch (e) {
          fail++;
          errors.push(`${ds.datasetID}: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      errors.push(`list: ${(e as Error).message}`);
    }
    summary.push({ baseUrl, ingested: ok, failed: fail, errors: errors.slice(0, 5) });
  }

  return Response.json({ ok: true, sources: summary });
}

