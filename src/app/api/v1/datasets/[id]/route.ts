import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { pathname } = new URL(req.url);
  const id = decodeURIComponent(pathname.split("/").pop() || "");
  const ds = await prisma.dataset.findUnique({ where: { id }, include: { variables: true, distributions: true } });
  if (!ds) return Response.json({ error: "Not found" }, { status: 404 });
  const canonical = {
    id: ds.id,
    doi: ds.doi || undefined,
    title: ds.title,
    abstract: ds.abstract || undefined,
    publisher: ds.publisher || undefined,
    license: ds.license || undefined,
    temporal_extent: { start: ds.timeStart?.toISOString(), end: ds.timeEnd?.toISOString() },
    spatial_extent: { bbox: [ds.bboxMinX, ds.bboxMinY, ds.bboxMaxX, ds.bboxMaxY] as [number, number, number, number] | undefined },
    variables: ds.variables.map((v) => ({ name: v.name, standard_name: v.standardName || undefined, units: v.units || undefined, long_name: v.longName || undefined })),
    distributions: ds.distributions.map((d) => ({ url: d.url, access_service: d.accessService as "HTTP" | "OPeNDAP" | "THREDDS" | "ERDDAP" | "FTP" | "S3", format: d.format })),
    source_system: ds.sourceSystem || undefined,
    updated_at: ds.updatedAt?.toISOString(),
  };
  return Response.json(canonical);
}

