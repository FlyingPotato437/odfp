import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { pathname } = new URL(req.url);
  const id = decodeURIComponent(pathname.split("/").slice(-3, -2)[0] || "");
  const ds = await prisma.dataset.findUnique({
    where: { id },
    include: { variables: true, distributions: true },
  });
  if (!ds) return Response.json({ error: "Not found" }, { status: 404 });

  // Minimal ISO 19115-like JSON profile (not full metadata record)
  const iso = {
    fileIdentifier: ds.id,
    language: "en",
    hierarchyLevel: "dataset",
    dateStamp: ds.updatedAt?.toISOString(),
    identificationInfo: {
      citation: {
        title: ds.title,
        date: ds.updatedAt?.toISOString(),
        identifier: ds.doi || ds.id,
      },
      abstract: ds.abstract,
      pointOfContact: ds.publisher,
      descriptiveKeywords: (ds.variables || []).map((v: { name: string; standardName: string | null }) => v.standardName || v.name),
      resourceConstraints: ds.license,
      extent: {
        temporal: { begin: ds.timeStart?.toISOString(), end: ds.timeEnd?.toISOString() },
        geographicElement: { west: ds.bboxMinX, south: ds.bboxMinY, east: ds.bboxMaxX, north: ds.bboxMaxY },
      },
      distributionInfo: (ds.distributions || []).map((d: { url: string; accessService: string; format: string }) => ({
        transferOptions: { onLine: { url: d.url, protocol: d.accessService, formatName: d.format } },
      })),
    },
  };

  return Response.json(iso);
}

