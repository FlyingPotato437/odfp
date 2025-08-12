const fs = require('fs');
const path = require('path');
function loadEnvFile(file) {
  try {
    const p = path.resolve(process.cwd(), file);
    if (!fs.existsSync(p)) return;
    const text = fs.readFileSync(p, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_\.]*)=(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] == null) process.env[key] = val;
    }
  } catch {}
}
loadEnvFile('.env');
loadEnvFile('.env.local');

const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const out = { queries: {} };
  try {
    const items = await prisma.$queryRawUnsafe('select id, title from "Dataset" where lower(title) like $1 limit 5', '%temperature%');
    out.queries.temperatureLike = items.map(r => r.title).slice(0,3);
  } catch (e) {
    out.queries.temperatureLike = { error: String(e?.message || e) };
  }
  try {
    // crude bbox overlap check: datasets that have min/max coords within range
    const bbox = [-80, 20, -30, 55]; // North Atlantic rough box
    const items = await prisma.$queryRawUnsafe(
      'select id, title from "Dataset" where "bboxMinX" is not null and not ("bboxMaxX" < $1 or "bboxMinX" > $3 or "bboxMaxY" < $2 or "bboxMinY" > $4) limit 5',
      bbox[0], bbox[1], bbox[2], bbox[3]
    );
    out.queries.bboxOverlap = items.map(r => r.title).slice(0,3);
  } catch (e) {
    out.queries.bboxOverlap = { error: String(e?.message || e) };
  }
  try {
    const [{ c }] = await prisma.$queryRawUnsafe('select count(*)::int as c from "Dataset" where embedding is not null');
    out.queries.embeddingCount = c;
  } catch (e) {
    out.queries.embeddingCount = { error: String(e?.message || e) };
  }
  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
