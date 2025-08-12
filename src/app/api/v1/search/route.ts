import { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { SearchQuery } from "@/lib/types";
import { hybridSearch } from "@/lib/hybridSearch";
import { prisma } from "@/lib/db";

function parseArrayParam(value: string | null): string[] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return value.split(",").map((v) => v.trim()).filter(Boolean);
  }
}

function parseBbox(value: string | null): [number, number, number, number] | undefined {
  if (!value) return undefined;
  const parts = value.split(",").map((x) => Number(x.trim()));
  if (parts.length === 4 && parts.every((x) => Number.isFinite(x))) {
    return [parts[0], parts[1], parts[2], parts[3]];
  }
  return undefined;
}

function parsePolygon(value: string | null): [number, number][] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((p) => Array.isArray(p) && p.length === 2)) {
      return parsed as [number, number][];
    }
  } catch {
    // try "lon lat; lon lat; ..."
    const pairs = value.split(";").map((s) => s.trim()).filter(Boolean);
    const coords: [number, number][] = [];
    for (const pair of pairs) {
      const [lon, lat] = pair.split(/\s+/).map((t) => Number(t));
      if (Number.isFinite(lon) && Number.isFinite(lat)) coords.push([lon, lat]);
    }
    if (coords.length >= 4) return coords;
  }
  return undefined;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || undefined;
  const bbox = parseBbox(url.searchParams.get("bbox"));
  const polygon = parsePolygon(url.searchParams.get("polygon"));
  const time_start = url.searchParams.get("time_start") || undefined;
  const time_end = url.searchParams.get("time_end") || undefined;
  const variables = parseArrayParam(url.searchParams.get("variables"));
  const format = url.searchParams.get("format") || undefined;
  const publisher = url.searchParams.get("publisher") || undefined;
  const platform = url.searchParams.get("platform") || undefined;
  const service = (url.searchParams.get("service") || undefined) as SearchQuery["service"];
  const license = url.searchParams.get("license") || undefined;
  const page = url.searchParams.get("page");
  const size = url.searchParams.get("size");
  const sort = (url.searchParams.get("sort") || undefined) as SearchQuery["sort"];
  const out = (url.searchParams.get("output") || url.searchParams.get("out") || "json").toLowerCase();
  const include = (url.searchParams.get("include") || "").toLowerCase();

  const query: SearchQuery = {
    q,
    bbox,
    polygon,
    time_start,
    time_end,
    variables,
    format,
    publisher,
    platform: platform || undefined,
    service,
    license,
    page: page ? Math.max(1, Number(page)) : undefined,
    size: size ? Math.min(100, Math.max(1, Number(size))) : undefined,
    sort,
  };

  const result = await hybridSearch(query);
  // Clean null bbox values in response to avoid frontend map errors
  result.results = result.results.map((r) => {
    const b = r.spatial?.bbox;
    const hasValid = Array.isArray(b) && b.length === 4 && b.every((v) => typeof v === 'number' && Number.isFinite(v));
    if (!hasValid) return { ...r, spatial: { bbox: undefined } };
    return r;
  });
  // If lexical was empty but semantic likely has hits (q provided), fall back to semantic endpoint
  if (result.total === 0 && q) {
    try {
      const alt = await fetch(`${url.origin}/api/v1/ai/semantic-search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q, k: query.size ?? 20 }) });
      if (alt.ok) {
        const json: { results?: Array<{ dataset: { id: string; doi?: string; title: string; publisher?: string; timeStart?: string; timeEnd?: string; bboxMinX?: number; bboxMinY?: number; bboxMaxX?: number; bboxMaxY?: number; variables?: Array<{ name: string }>; distributions?: Array<{ url: string; format: string; accessService: string }> } | null }> } = await alt.json();
        const items: Array<{ id: string; doi?: string; title: string; publisher?: string; timeStart?: string; timeEnd?: string; bboxMinX?: number; bboxMinY?: number; bboxMaxX?: number; bboxMaxY?: number; variables?: Array<{ name: string }>; distributions?: Array<{ url: string; format: string; accessService: string }> }>
          = (json.results || []).map((r) => r.dataset).filter((d): d is NonNullable<typeof d> => Boolean(d)).slice(0, query.size ?? 20);
        if (items.length) {
          return Response.json({ total: items.length, page: 1, size: items.length, results: items.map((d) => ({
            id: d.id,
            doi: d.doi || undefined,
            title: d.title,
            publisher: d.publisher || undefined,
            time: { start: d.timeStart, end: d.timeEnd },
            spatial: { bbox: [d.bboxMinX, d.bboxMinY, d.bboxMaxX, d.bboxMaxY] },
            variables: (d.variables || []).map((v) => v.name),
            distributions: (d.distributions || []).map((dist) => ({ url: dist.url, format: dist.format, service: dist.accessService as "HTTP" | "OPeNDAP" | "THREDDS" | "ERDDAP" | "FTP" | "S3" })),
          })) });
        }
      }
    } catch {}
  }

  // Second fallback: query NCEI Search Service live (beyond OneStop)
  if ((result.total === 0 || !Array.isArray(result.results) || result.results.length === 0) && q) {
    try {
      const ncei = new URL("https://www.ncei.noaa.gov/access/services/search/v1/datasets");
      ncei.searchParams.set("text", q);
      ncei.searchParams.set("limit", String(query.size ?? 20));
      ncei.searchParams.set("offset", "0");
      const r = await fetch(ncei.toString(), { headers: { 'Accept': 'application/json' } });
      if (r.ok) {
        const j: { results?: Array<{ id?: string; title?: string; summary?: string; temporal?: { begin?: string; end?: string }; links?: { access?: Array<{ url?: string }>; other?: Array<{ url?: string }>; related?: Array<{ url?: string }> } }> } = await r.json();
        const items = (Array.isArray(j?.results) ? j!.results! : []).slice(0, query.size ?? 20);
        if (items.length) {
          const toSafe = (u?: string) => (typeof u === 'string' ? u : '').trim();
          type Service = "HTTP" | "OPeNDAP" | "THREDDS" | "ERDDAP";
          const mapDist = (u: string) => {
            const format = u.endsWith('.nc') ? 'NetCDF' : (u.endsWith('.csv') ? 'CSV' : 'HTTP');
            const detected = /(erddap|opendap|thredds)/i.exec(u)?.[1]?.toUpperCase();
            let service: Service = 'HTTP';
            if (detected === 'ERDDAP') service = 'ERDDAP';
            else if (detected === 'THREDDS') service = 'THREDDS';
            else if (detected === 'OPENDAP') service = 'OPeNDAP';
            return { url: u, format, service };
          };
          return Response.json({
            total: items.length,
            page: 1,
            size: items.length,
            results: items.map((d) => ({
              id: String(d.id || toSafe(d.title) || Math.random().toString(36).slice(2)),
              title: String(d.title || d.id || 'Untitled dataset'),
              publisher: undefined,
              time: { start: d.temporal?.begin, end: d.temporal?.end },
              spatial: { bbox: undefined },
              variables: [],
              distributions: [
                ...((d.links?.access || []).map(x => toSafe(x.url)).filter(Boolean).map(mapDist)),
                ...((d.links?.related || []).map(x => toSafe(x.url)).filter(Boolean).map(mapDist))
              ],
            }))
          });
        }
      }
    } catch {}
  }

  // CSV export if requested
  const wantsCsv = out === "csv" || req.headers.get("accept")?.includes("text/csv");
  if (wantsCsv) {
    const headers = [
      "id",
      "title",
      "publisher",
      "start",
      "end",
      "variables",
      "formats",
      "services",
      "doi",
      "bbox",
    ];
    const encode = (v: unknown) => {
      const s = v == null ? "" : String(v);
      if (s.includes(",") || s.includes("\n") || s.includes('"')) {
        return '"' + s.replaceAll('"', '""') + '"';
      }
      return s;
    };
    const rows = result.results.map((r) => {
      const start = r.time?.start ?? "";
      const end = r.time?.end ?? "";
      const variablesJoined = (r.variables || []).join("; ");
      const formatsJoined = (r.distributions || []).map((d) => d.format).filter(Boolean).join("; ");
      const servicesJoined = (r.distributions || []).map((d) => d.service).filter(Boolean).join("; ");
      const bbox = r.spatial?.bbox ? r.spatial.bbox.join(",") : "";
      const doi = r.doi ?? "";
      return [r.id, r.title, r.publisher || "", start, end, variablesJoined, formatsJoined, servicesJoined, doi, bbox].map(encode).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const filename = `odfp-search-${new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16)}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }
  // Enrich with detailed variables and distributions if requested
  if (include.includes('vars') || include.includes('full')) {
    try {
      const ids = result.results.map(r => r.id);
      if (ids.length > 0) {
        const rows = await prisma.dataset.findMany({ where: { id: { in: ids } }, include: { variables: true, distributions: true } });
        const map = new Map(rows.map(d => [d.id, d]));
        result.results = result.results.map(r => {
          const d = map.get(r.id);
          if (!d) return r;
          return {
            ...r,
            variablesDetailed: d.variables.map(v => ({ name: v.name, standard_name: v.standardName || undefined, units: v.units || undefined, long_name: v.longName || undefined })),
            distributionsDetailed: d.distributions.map(dist => ({ url: dist.url, format: dist.format, service: dist.accessService as any, size: dist.size || undefined, checksum: dist.checksum || undefined, access_rights: dist.accessRights || undefined }))
          };
        });
      }
    } catch {}
  }

  return Response.json(result, { status: 200 });
}
