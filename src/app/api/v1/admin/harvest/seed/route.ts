import { prisma } from "@/lib/db";

export async function POST() {
  // Ensure table exists
  await prisma.$executeRawUnsafe(
    `create table if not exists "HarvestTarget" (
      id text primary key,
      kind text not null,
      url text not null unique,
      status text,
      "lastChecked" timestamptz,
      attempts integer not null default 0,
      "discoveredFrom" text,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now()
    )`
  );

  // Dynamic seeding now flows through the OneStop harvester.
  // Keep this endpoint as a no-op success for compatibility.
  return Response.json({ ok: true, queued: 0, note: "Use /api/v1/admin/ingest/onestop then /api/v1/admin/harvest/run" });
}

