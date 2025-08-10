import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { crawlStac } from "@/lib/connectors/stac";
import { updateDatasetEmbedding } from "@/lib/embeddings";

function inferFormat(url: string, mime?: string): string {
  if (mime) {
    if (/netcdf/i.test(mime)) return "NetCDF";
    if (/csv/i.test(mime)) return "CSV";
    if (/json/i.test(mime)) return "JSON";
    if (/geotiff|tiff/i.test(mime)) return "GeoTIFF";
    if (/zip/i.test(mime)) return "ZIP";
  }
  const u = url.toLowerCase();
  if (u.endsWith(".nc")) return "NetCDF";
  if (u.endsWith(".csv")) return "CSV";
  if (u.endsWith(".json")) return "JSON";
  if (u.endsWith(".zip")) return "ZIP";
  if (u.endsWith(".tif") || u.endsWith(".tiff")) return "GeoTIFF";
  return "HTTP";
}

function hasUk37(text?: string): boolean {
  if (!text) return false;
  const n = text.toLowerCase();
  return /u\s*'?k\s*(?:prime|['′’])?\s*37|uk['′’]?\s*37|u37k['′’]?/i.test(n) || n.includes("alkenone");
}

function hasD18O(text?: string): boolean {
  if (!text) return false;
  const n = text.toLowerCase();
  return /(?:δ|d)\s*?18\s*?o/.test(n) || n.includes("oxygen isotope");
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req as unknown as Request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const rootUrl = typeof body.rootUrl === "string" ? body.rootUrl : "https://stac.pangaea.de/catalog.json";
  const limit = typeof body.limit === "number" ? body.limit : 200;
  const depth = typeof body.depth === "number" ? Math.max(1, Math.min(5, body.depth)) : 3;
  const embed: boolean = body.embed === true;

  let count = 0;
  let embeddedOk = 0, embeddedFail = 0;
  const errors: string[] = [];

  try {
    const items = await crawlStac(rootUrl, depth);
    for (const it of items.slice(0, limit)) {
      try {
        const id = `pangaea:${it.id}`;
        const title = it.title || it.id;
        const abstract = it.description || null;
        const foundUk = hasUk37(title) || hasUk37(abstract || undefined);
        const foundD = hasD18O(title) || hasD18O(abstract || undefined);

        const vars: Array<{ name: string; standardName?: string | null; units?: string | null; longName?: string | null }> = [];
        if (foundD) {
          vars.push(
            { name: "δ18O", longName: "Oxygen isotope ratio" },
            { name: "d18O" },
            { name: "delta 18O" },
            { name: "oxygen isotope" }
          );
        }
        if (foundUk) {
          vars.push(
            { name: "Uk'37", longName: "Alkenone unsaturation index" },
            { name: "UK37" },
            { name: "U37K'" },
            { name: "alkenone" }
          );
        }

        const dists = (it.assets || []) as Array<{ url: string; type?: string }>;

        await prisma.dataset.upsert({
          where: { id },
          create: {
            id,
            title,
            abstract,
            publisher: "PANGAEA",
            sourceSystem: "STAC",
            variables: { create: vars },
            distributions: {
              create: dists.map((a) => ({ url: a.url, accessService: "HTTP", format: inferFormat(a.url, a.type) })),
            },
          },
          update: {
            title,
            abstract,
            distributions: {
              deleteMany: {},
              create: dists.map((a) => ({ url: a.url, accessService: "HTTP", format: inferFormat(a.url, a.type) })),
            },
          },
        });
        if (embed) {
          const text = `${title}\n${abstract || ""}\nPANGAEA\n${vars.map(v => v.name).join("; ")}`.trim();
          const ok = await updateDatasetEmbedding(id, text);
          if (ok) embeddedOk++; else embeddedFail++;
        }
        count++;
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
  } catch (e) {
    errors.push((e as Error).message);
  }

  return Response.json({ ok: true, count, embeddedOk, embeddedFail, errors: errors.slice(0, 10) });
}


