import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

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

  try {
    // Find all distributions with double /erddap/erddap/ in the URL
    const brokenDistributions = await prisma.distribution.findMany({
      where: {
        url: {
          contains: '/erddap/erddap/'
        }
      }
    });

    console.log(`Found ${brokenDistributions.length} broken URLs`);

    let fixed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const dist of brokenDistributions) {
      try {
        // Fix the URL by replacing /erddap/erddap/ with /erddap/
        const fixedUrl = dist.url.replace(/\/erddap\/erddap\//g, '/erddap/');

        await prisma.distribution.update({
          where: { id: dist.id },
          data: { url: fixedUrl }
        });

        fixed++;

        if (fixed % 100 === 0) {
          console.log(`Fixed ${fixed} URLs so far...`);
        }
      } catch (e: unknown) {
        const error = e instanceof Error ? e.message : String(e);
        errors.push({ id: dist.id, error });
      }
    }

    return Response.json({
      ok: true,
      found: brokenDistributions.length,
      fixed,
      errors: errors.length > 0 ? errors : undefined
    }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
