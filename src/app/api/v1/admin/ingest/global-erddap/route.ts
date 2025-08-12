import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { fetchGlobalErddapData, transformGlobalErddapDataset, GLOBAL_ERDDAP_SERVERS } from '@/lib/connectors/global-erddap';

interface ServerRecord {
  [key: string]: string;
}

interface VariableData {
  name: string;
  standardName?: string;
  units?: string;
  longName?: string;
}

interface DistributionData {
  url: string;
  accessService: string;
  format: string;
}


interface ErrorRecord {
  id: string;
  error: string;
}

function auth(req: NextRequest): boolean {
  const header = req.headers.get('authorization') || '';
  const token = header.replace(/^bearer\s+/i, '');
  const admin = process.env.ADMIN_TOKEN || 'odfp123';
  return Boolean(token && token === admin);
}

export async function POST(req: NextRequest) {
  if (!auth(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const maxPer = Number(body?.maxDatasetsPerServer ?? 20);
  const serverKeys: string[] = Array.isArray(body?.servers) ? body.servers : Object.keys(GLOBAL_ERDDAP_SERVERS);

  const servers: ServerRecord = {};
  for (const key of serverKeys) {
    const typedServers = GLOBAL_ERDDAP_SERVERS as ServerRecord;
    if (typedServers[key]) servers[key] = typedServers[key];
  }
  if (Object.keys(servers).length === 0) {
    return Response.json({ error: 'No valid servers specified' }, { status: 400 });
  }

  try {
    const datasets = await fetchGlobalErddapData(servers, Math.max(1, Math.min(200, maxPer)));
    const transformed = datasets.map(transformGlobalErddapDataset);

    let created = 0, updated = 0;
    const errors: ErrorRecord[] = [];
    for (const d of transformed) {
      try {
        const exists = await prisma.dataset.findUnique({ where: { id: d.id } });
        if (!exists) {
          await prisma.dataset.create({
            data: {
              id: d.id,
              title: d.title,
              abstract: d.abstract,
              publisher: d.publisher,
              sourceSystem: d.sourceSystem,
              timeStart: d.timeStart,
              timeEnd: d.timeEnd,
              bboxMinX: d.bboxMinX,
              bboxMinY: d.bboxMinY,
              bboxMaxX: d.bboxMaxX,
              bboxMaxY: d.bboxMaxY,
              variables: { create: d.variables.map((v: VariableData) => ({ name: v.name, standardName: v.standardName, units: v.units, longName: v.longName })) },
              distributions: { create: d.distributions.map((x: DistributionData) => ({ url: x.url, accessService: x.accessService, format: x.format })) },
            },
          });
          created++;
        } else {
          await prisma.dataset.update({
            where: { id: d.id },
            data: {
              title: d.title,
              abstract: d.abstract,
              publisher: d.publisher,
              sourceSystem: d.sourceSystem,
              timeStart: d.timeStart,
              timeEnd: d.timeEnd,
              bboxMinX: d.bboxMinX,
              bboxMinY: d.bboxMinY,
              bboxMaxX: d.bboxMaxX,
              bboxMaxY: d.bboxMaxY,
              variables: { deleteMany: {}, create: d.variables.map((v: VariableData) => ({ name: v.name, standardName: v.standardName, units: v.units, longName: v.longName })) },
              distributions: { deleteMany: {}, create: d.distributions.map((x: DistributionData) => ({ url: x.url, accessService: x.accessService, format: x.format })) },
            },
          });
          updated++;
        }
      } catch (e: unknown) {
        const error = e instanceof Error ? e.message : String(e);
        errors.push({ id: d.id, error });
      }
    }

    // Refresh materialized FTS view if it exists
    try { await prisma.$executeRawUnsafe('refresh materialized view dataset_fts'); } catch {}

    return Response.json({ servers: Object.keys(servers), fetched: datasets.length, created, updated, errors }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
