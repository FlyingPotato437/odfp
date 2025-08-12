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

// Load .env and .env.local so DATABASE_URL is available
loadEnvFile('.env');
loadEnvFile('.env.local');

const { PrismaClient } = require('@prisma/client');

async function main() {
  const out = { env: {}, checks: {} };
  out.env.hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  out.env.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || null;
  out.env.hasSupabaseAnon = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  out.env.hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const prisma = new PrismaClient();
  try {
    const [ping] = await prisma.$queryRawUnsafe('select 1 as ok');
    out.checks.prismaPing = ping?.ok === 1;
  } catch (e) {
    out.checks.prismaPing = false;
    out.checks.prismaError = String(e?.message || e);
  }

  try {
    const rows = await prisma.$queryRawUnsafe("select extname from pg_extension where extname in ('pg_trgm','postgis','vector') order by extname");
    out.checks.extensions = rows.map(r => r.extname);
  } catch (e) {
    out.checks.extensions = [];
  }

  try {
    const [{ count }] = await prisma.$queryRawUnsafe('select count(*)::int as count from "Dataset"');
    out.checks.datasetCount = count;
  } catch (e) {
    out.checks.datasetCount = null;
    out.checks.datasetCountError = String(e?.message || e);
  }

  try {
    // pgvector simple sanity if table has an embedding column
    const rows = await prisma.$queryRawUnsafe("select to_regclass('public." + "Dataset" + "') as reg");
    if (rows?.[0]?.reg) {
      out.checks.pgvectorTablePresent = true;
    } else {
      out.checks.pgvectorTablePresent = false;
    }
  } catch {}

  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('db-health fatal:', e);
  process.exit(1);
});

