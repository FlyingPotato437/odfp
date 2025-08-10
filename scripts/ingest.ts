/*
 Simple CLI to seed the catalog with real data sources.
 Usage:
   ADMIN_TOKEN=odfp123 BASE_URL=http://localhost:3000 ts-node scripts/ingest.ts
*/
import 'cross-fetch/dist/node-polyfill.js';
// Deprecated: static seeds removed. Provide explicit baseUrls via CLI or rely on harvest queue.

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'odfp123';

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} -> ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  console.log('Seeding harvest targets from OneStop (dynamic) ...');
  const onestop = await post('/api/v1/admin/ingest/onestop', { queries: ['ocean', 'sea surface temperature'], size: 100, pages: 2 });
  console.log('OneStop seed result:', JSON.stringify(onestop));

  console.log('Running harvest for ERDDAP targets ...');
  const erddapRun = await post('/api/v1/admin/harvest/run', { kind: 'erddap_base', limitTargets: 5, perTarget: 25 });
  console.log('ERDDAP harvest result:', JSON.stringify(erddapRun));

  console.log('Running harvest for THREDDS targets ...');
  const threddsRun = await post('/api/v1/admin/harvest/run', { kind: 'thredds_catalog', limitTargets: 3, perTarget: 50 });
  console.log('THREDDS harvest result:', JSON.stringify(threddsRun));

  console.log('Running harvest for STAC targets ...');
  const stacRun = await post('/api/v1/admin/harvest/run', { kind: 'stac_root', limitTargets: 3, perTarget: 50 });
  console.log('STAC harvest result:', JSON.stringify(stacRun));

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

