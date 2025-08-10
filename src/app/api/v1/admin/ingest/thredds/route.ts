import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fetchThreddsCatalog } from "@/lib/connectors/thredds";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl : "";
  const baseUrls: string[] = Array.isArray(body.baseUrls) ? body.baseUrls.filter((u: unknown) => typeof u === "string") as string[] : [];
  const targets = baseUrl ? [baseUrl] : baseUrls;
  if (targets.length === 0) {
    return Response.json({ error: "baseUrl or baseUrls required" }, { status: 400 });
  }

  let count = 0;
  for (const target of targets) {
    const list = await fetchThreddsCatalog(target);
    for (const d of list) {
    try {
      await prisma.dataset.upsert({
        where: { id: d.id },
        create: {
          id: d.id,
          title: d.title || d.id,
          abstract: d.summary || null,
          publisher: null,
          sourceSystem: "THREDDS",
          variables: { create: [] },
          distributions: {
            create: d.distributions.map((x) => ({ url: x.url, accessService: x.service, format: x.format || "" })),
          },
        },
        update: {
          title: d.title || d.id,
          abstract: d.summary || null,
          distributions: {
            deleteMany: {},
            create: d.distributions.map((x) => ({ url: x.url, accessService: x.service, format: x.format || "" })),
          },
        },
      });
      count++;
      } catch {}
    }
  }

  return Response.json({ ok: true, count });
}
