import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

// Facets computed over the filtered dataset set derived from the current query params
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || undefined;
  const publisher = url.searchParams.get("publisher") || undefined;
  const format = url.searchParams.get("format") || undefined;
  const service = url.searchParams.get("service") || undefined as string | undefined;
  const variablesCsv = url.searchParams.get("variables") || "";
  const variables = variablesCsv ? variablesCsv.split(",").map((v) => v.trim()).filter(Boolean) : [];
  const timeStart = url.searchParams.get("time_start") || undefined;
  const timeEnd = url.searchParams.get("time_end") || undefined;

  const AND: Prisma.DatasetWhereInput[] = [];
  if (publisher) AND.push({ publisher: { equals: publisher } });
  if (format) AND.push({ distributions: { some: { format: { equals: format } } } });
  if (service) AND.push({ distributions: { some: { accessService: service } } });
  if (q) {
    AND.push({ OR: [
      { title: { contains: q } },
      { abstract: { contains: q } },
      { publisher: { contains: q } },
      { variables: { some: { OR: [ { name: { contains: q } }, { longName: { contains: q } }, { standardName: { contains: q } } ] } } },
    ] });
  }
  if (timeStart) AND.push({ OR: [{ timeEnd: null }, { timeEnd: { gte: new Date(timeStart) } }] });
  if (timeEnd) AND.push({ OR: [{ timeStart: null }, { timeStart: { lte: new Date(timeEnd) } }] });
  if (variables.length > 0) {
    const orVars = variables.map((v) => ({ variables: { some: { OR: [
      { name: { contains: v } },
      { longName: { contains: v } },
      { standardName: { contains: v } },
    ] } } }));
    AND.push({ OR: orVars });
  }

  const where: Prisma.DatasetWhereInput = AND.length ? { AND } : {};
  const distWhere: Prisma.DistributionWhereInput = { dataset: where };
  const varWhere: Prisma.VariableWhereInput = { dataset: where };

  const [pubs, fmts, svcs, vars, times] = await Promise.all([
    prisma.dataset.groupBy({ by: ["publisher"], _count: true, where: { ...where, publisher: { not: null } } }),
    prisma.distribution.groupBy({ by: ["format"], _count: true, where: distWhere }),
    prisma.distribution.groupBy({ by: ["accessService"], _count: true, where: distWhere }),
    prisma.variable.groupBy({ by: ["name"], _count: true, where: varWhere }),
    prisma.dataset.findMany({ select: { timeStart: true }, where }),
  ]);

  const decadesCount: Record<string, number> = {};
  for (const d of times) {
    const year = d.timeStart ? new Date(d.timeStart).getUTCFullYear() : null;
    if (year) {
      const decade = `${Math.floor(year / 10) * 10}s`;
      decadesCount[decade] = (decadesCount[decade] || 0) + 1;
    }
  }

  return Response.json({
    publishers: Object.fromEntries(pubs.filter(p => p.publisher).map((p) => [p.publisher as string, p._count])),
    formats: Object.fromEntries(fmts.map((f) => [f.format, f._count])),
    services: Object.fromEntries(svcs.map((s) => [s.accessService, s._count])),
    variables: Object.fromEntries(vars.map((v) => [v.name, v._count])),
    decades: decadesCount,
  });
}

