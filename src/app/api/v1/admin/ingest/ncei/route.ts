import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

type NceiDataset = {
  id: string;
  fileId?: string;
  name: string;
  description?: string;
  organization?: { name?: string };
  startDate?: string;
  endDate?: string;
  location?: { type?: string; coordinates?: number[][][] };
  links?: { access?: Array<{ name?: string; type?: string; url: string }>; other?: Array<{ type?: string; url: string }>; documentation?: Array<{ type?: string; url: string }>; };
  parsedKeywords?: string[];
};

function toBboxFromPolygon(poly: number[][][] | undefined): [number, number, number, number] | undefined {
  if (!poly || !Array.isArray(poly) || poly.length === 0) return undefined;
  const ring = poly[0] || [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pt of ring) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const [x, y] = pt;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (![minX, minY, maxX, maxY].every((v) => Number.isFinite(v))) return undefined;
  return [minX, minY, maxX, maxY];
}

function inferFormatFromUrl(url: string): string {
  const u = url.toLowerCase();
  if (u.endsWith(".nc") || u.includes("format=netcdf")) return "NetCDF";
  if (u.endsWith(".csv") || u.includes("format=csv")) return "CSV";
  if (u.endsWith(".json") || u.includes("format=json")) return "JSON";
  if (u.endsWith(".zarr") || u.includes("zarr")) return "Zarr";
  if (u.endsWith(".tif") || u.endsWith(".tiff") || u.includes("geotiff")) return "GeoTIFF";
  return "HTTP";
}

function shouldKeepVariable(name: string): boolean {
  const n = name.toLowerCase();
  // Preserve key ocean and paleo-climate proxies so search can find δ18O and Uk'37
  const paleoTerms = [
    "d18o", "δ18o", "delta 18o", "delta-18o", "oxygen isotope", "stable oxygen isotope",
    "uk37", "uk'37", "u37k", "u37k'", "alkenone", "tex86", "mg/ca", "foraminifera", "foram",
  ];
  const oceanTerms = [
    "temperature", "sst", "salinity", "chlorophyll", "oxygen", "precip", "wind", "pressure", "wave", "ph", "nitrate",
  ];
  const hasUk37 = /u\s*'?k\s*(?:prime|['′’])?\s*37|uk'?\s*37|u37k'?/i.test(n);
  const hasD18O = /(?:δ|d)\s*?18\s*?o/.test(n) || n.includes("oxygen isotope");
  return hasUk37 || hasD18O || [...paleoTerms, ...oceanTerms].some((k) => n.includes(k));
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req as unknown as Request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const text: string | undefined = typeof body.text === "string" ? body.text : undefined;
  const limit: number = typeof body.limit === "number" ? body.limit : 100;
  const available: boolean = body.available !== false; // default true
  const embed: boolean = body.embed === true;

  const base = "https://www.ncei.noaa.gov/access/services/search/v1/datasets";
  const pageSize = 50;
  let offset = 0;
  let ingested = 0;
  let embeddedOk = 0, embeddedFail = 0;
  const errors: string[] = [];

  while (ingested < limit) {
    const toFetch = Math.min(pageSize, limit - ingested);
    const url = new URL(base);
    url.searchParams.set("limit", String(toFetch));
    url.searchParams.set("offset", String(offset));
    if (text) url.searchParams.set("text", text);
    if (available) url.searchParams.set("available", "true");
    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        errors.push(`fetch ${url.toString()} -> ${res.status}`);
        break;
      }
      const json = (await res.json()) as { results?: NceiDataset[] };
      const items = Array.isArray(json.results) ? json.results : [];
      if (items.length === 0) break;

      for (const d of items) {
        try {
          const datasetId = `ncei:${d.id}`;
          const bbox = toBboxFromPolygon(d.location?.coordinates);
          const timeStart = d.startDate ? new Date(d.startDate) : null;
          const timeEnd = d.endDate ? new Date(d.endDate) : null;
          const publisher = d.organization?.name || "NOAA NCEI";
          const accessLinks = d.links?.access || [];

          const upserted = await prisma.dataset.upsert({
            where: { id: datasetId },
            create: {
              id: datasetId,
              title: d.name,
              abstract: d.description || null,
              publisher,
              timeStart,
              timeEnd,
              bboxMinX: bbox?.[0] ?? null,
              bboxMinY: bbox?.[1] ?? null,
              bboxMaxX: bbox?.[2] ?? null,
              bboxMaxY: bbox?.[3] ?? null,
              sourceSystem: "NCEI OneStop",
              keywords: d.parsedKeywords ? (d.parsedKeywords as unknown as object) : undefined,
              variables: {
                create: (Array.isArray(d.parsedKeywords) ? d.parsedKeywords : [])
                  .map((k) => ({ name: k }))
                  .filter((v) => shouldKeepVariable(v.name))
                  .slice(0, 20),
              },
              distributions: {
                create: accessLinks.slice(0, 6).map((l) => ({
                  url: l.url,
                  accessService: "HTTP",
                  format: inferFormatFromUrl(l.url),
                })),
              },
            },
            update: {
              title: d.name,
              abstract: d.description || null,
              publisher,
              timeStart,
              timeEnd,
              bboxMinX: bbox?.[0] ?? null,
              bboxMinY: bbox?.[1] ?? null,
              bboxMaxX: bbox?.[2] ?? null,
              bboxMaxY: bbox?.[3] ?? null,
              distributions: {
                deleteMany: {},
                create: accessLinks.slice(0, 6).map((l) => ({
                  url: l.url,
                  accessService: "HTTP",
                  format: inferFormatFromUrl(l.url),
                })),
              },
            },
          });
          if (embed) {
            const vars = (upserted as unknown as { variables?: Array<{ name: string }> }).variables || [];
            const textForEmbed = `${d.name}\n${d.description || ""}\n${publisher}\n${vars.map(v => v.name).join("; ")}`.trim();
            try {
              const { updateDatasetEmbedding } = await import("@/lib/embeddings");
              const ok = await updateDatasetEmbedding(datasetId, textForEmbed);
              if (ok) embeddedOk++; else embeddedFail++;
            } catch {
              embeddedFail++;
            }
          }
          ingested++;
          if (ingested >= limit) break;
        } catch (e) {
          errors.push(`${d.id}: ${(e as Error).message}`);
        }
      }
      if (items.length < toFetch) break;
      offset += toFetch;
    } catch (e) {
      errors.push((e as Error).message);
      break;
    }
  }

  return Response.json({ ok: true, ingested, errors: errors.slice(0, 10) });
}

