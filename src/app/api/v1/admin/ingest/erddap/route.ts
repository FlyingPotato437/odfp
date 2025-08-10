import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { fetchErddapAllDatasets, fetchErddapInfo } from "@/lib/connectors/erddap";

export async function POST(req: NextRequest) {
  if (!isAdmin(req as unknown as Request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl : "";
  const limit = typeof body.limit === "number" ? body.limit : 200;
  if (!baseUrl) return Response.json({ error: "Missing baseUrl" }, { status: 400 });

  const list = await fetchErddapAllDatasets(baseUrl);
  const toIngest = list.slice(0, limit);

  const results: Array<{ id: string; status: string; message?: string }> = [];

  const host = new URL(baseUrl).host;
  for (const ds of toIngest) {
    try {
      const info = await fetchErddapInfo(baseUrl, ds.datasetID);
      const datasetId = `${host}:${ds.datasetID}`;
      
      // Create appropriate URLs based on dataset structure
      const baseUrlFixed = baseUrl.replace(/\/erddap\/?$/, '');
      const distributions = [];
      if (ds.dataStructure === 'grid') {
        distributions.push(
          { url: `${baseUrlFixed}/erddap/griddap/${encodeURIComponent(ds.datasetID)}.nc`, accessService: "ERDDAP", format: "NetCDF" },
          { url: `${baseUrlFixed}/erddap/griddap/${encodeURIComponent(ds.datasetID)}.html`, accessService: "ERDDAP", format: "HTML" }
        );
      } else if (ds.dataStructure === 'table') {
        distributions.push(
          { url: `${baseUrlFixed}/erddap/tabledap/${encodeURIComponent(ds.datasetID)}.csv`, accessService: "ERDDAP", format: "CSV" },
          { url: `${baseUrlFixed}/erddap/tabledap/${encodeURIComponent(ds.datasetID)}.html`, accessService: "ERDDAP", format: "HTML" }
        );
      } else {
        // Default to both if unknown
        distributions.push(
          { url: `${baseUrlFixed}/erddap/tabledap/${encodeURIComponent(ds.datasetID)}.csv`, accessService: "ERDDAP", format: "CSV" },
          { url: `${baseUrlFixed}/erddap/griddap/${encodeURIComponent(ds.datasetID)}.nc`, accessService: "ERDDAP", format: "NetCDF" }
        );
      }
      
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
            create: info.variables.map((v) => ({
              name: v.name || "var",
              standardName: v.standard_name || null,
              units: v.units || null,
              longName: v.long_name || null,
            })),
          },
          distributions: {
            create: distributions,
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
          variables: {
            deleteMany: {},
            create: info.variables.map((v) => ({
              name: v.name || "var",
              standardName: v.standard_name || null,
              units: v.units || null,
              longName: v.long_name || null,
            })),
          },
          distributions: {
            deleteMany: {},
            create: distributions,
          },
        },
      });
      results.push({ id: datasetId, status: "success" });
    } catch (e) {
      const err = e as Error;
      results.push({ id: `${host}:${ds.datasetID}`, status: "failed", message: err?.message || String(e) });
    }
  }

  return Response.json({ ok: true, count: results.length, results });
}
