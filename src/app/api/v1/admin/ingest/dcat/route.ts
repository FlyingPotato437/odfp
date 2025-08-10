import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export async function POST(req: Request) {
  if (!isAdmin(req)) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  type InputVar = { name?: string; standard_name?: string; units?: string; long_name?: string };
  type InputDist = { url?: string; href?: string; service?: string; access_service?: string; protocol?: string; format?: string; mediaType?: string; size?: number; checksum?: string; access_rights?: string };
  type InputItem = {
    id?: string;
    identifier?: string;
    title?: string;
    doi?: string;
    abstract?: string;
    description?: string;
    license?: string;
    publisher?: string | { name?: string };
    time?: { start?: string; end?: string };
    temporal?: { start?: string; end?: string };
    spatial?: { bbox?: [number, number, number, number]; value?: [number, number, number, number] };
    bbox?: [number, number, number, number];
    variables?: InputVar[];
    distributions?: InputDist[];
    distribution?: InputDist[];
  };
  const items: InputItem[] = Array.isArray(body?.datasets) ? (body.datasets as InputItem[]) : [];
  if (items.length === 0) return Response.json({ error: "No datasets provided" }, { status: 400 });

  for (const it of items) {
    const id: string = it.id || it.identifier || crypto.randomUUID();
    const title: string = it.title || "Untitled";
    const doi: string | undefined = it.doi || it.identifier;
    const publisher: string | undefined = typeof it.publisher === "string" ? it.publisher : (it.publisher?.name ?? undefined);
    const license: string | undefined = it.license;
    const abstract: string | undefined = it.description || it.abstract;

    const bbox = it.spatial?.bbox || it.spatial?.value || it.bbox;
    let bboxVals: [number, number, number, number] | undefined;
    if (Array.isArray(bbox) && bbox.length === 4) bboxVals = [bbox[0], bbox[1], bbox[2], bbox[3]];

    const timeStart = it.temporal?.start || it.time?.start;
    const timeEnd = it.temporal?.end || it.time?.end;

    await prisma.dataset.upsert({
      where: { id },
      create: {
        id,
        title,
        doi,
        abstract,
        publisher,
        license,
        timeStart: timeStart ? new Date(timeStart) : undefined,
        timeEnd: timeEnd ? new Date(timeEnd) : undefined,
        bboxMinX: bboxVals?.[0],
        bboxMinY: bboxVals?.[1],
        bboxMaxX: bboxVals?.[2],
        bboxMaxY: bboxVals?.[3],
        variables: {
          create: (it.variables || []).map((v) => ({
            name: v.name || v.standard_name || v.long_name || "var",
            standardName: v.standard_name || null,
            units: v.units || null,
            longName: v.long_name || null,
          })),
        },
        distributions: {
          create: ((it.distributions || it.distribution || []) as InputDist[]).map((d) => ({
            url: d.url || d.href || "",
            accessService: d.service || d.access_service || d.protocol || "HTTP",
            format: d.format || d.mediaType || "",
            size: d.size || null,
            checksum: d.checksum || null,
            accessRights: d.access_rights || null,
          })),
        },
      },
      update: {
        title,
        doi,
        abstract,
        publisher,
        license,
        timeStart: timeStart ? new Date(timeStart) : undefined,
        timeEnd: timeEnd ? new Date(timeEnd) : undefined,
        bboxMinX: bboxVals?.[0],
        bboxMinY: bboxVals?.[1],
        bboxMaxX: bboxVals?.[2],
        bboxMaxY: bboxVals?.[3],
      },
    });
  }

  return Response.json({ ok: true, count: items.length });
}

