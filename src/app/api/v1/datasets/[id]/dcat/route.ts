import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { pathname } = new URL(req.url);
  const id = decodeURIComponent(pathname.split("/").slice(-3, -2)[0] || "");
  const ds = await prisma.dataset.findUnique({
    where: { id },
    include: { variables: true, distributions: true },
  });
  if (!ds) return Response.json({ error: "Not found" }, { status: 404 });

  const dcat = {
    id: ds.id,
    title: ds.title,
    description: ds.abstract,
    identifier: ds.doi || ds.id,
    publisher: ds.publisher,
    license: ds.license,
    temporal: { start: ds.timeStart?.toISOString(), end: ds.timeEnd?.toISOString() },
    spatial: { bbox: [ds.bboxMinX, ds.bboxMinY, ds.bboxMaxX, ds.bboxMaxY] },
    variables: ds.variables.map((v: { name: string; standardName: string | null; units: string | null; longName: string | null }) => ({ name: v.name, standard_name: v.standardName || undefined, units: v.units || undefined, long_name: v.longName || undefined })),
    distributions: ds.distributions.map((d: { url: string; accessService: string; format: string }) => ({ url: d.url, service: d.accessService as string, format: d.format })),
  };
  return Response.json(dcat);
}

