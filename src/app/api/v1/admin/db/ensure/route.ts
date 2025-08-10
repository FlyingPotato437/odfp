import { prisma } from "@/lib/db";

export async function POST() {
  const statements: string[] = [
    `create table if not exists "HarvestTarget" (
      id text primary key,
      kind text not null,
      url text not null unique,
      status text,
      "lastChecked" timestamp with time zone,
      attempts integer not null default 0,
      "discoveredFrom" text,
      "createdAt" timestamp with time zone not null default now(),
      "updatedAt" timestamp with time zone not null default now()
    )`,
    `create or replace function set_updated_at() returns trigger as $$
    begin
      new."updatedAt" := now();
      return new;
    end
    $$ language plpgsql`,
    `drop trigger if exists harvesttarget_set_updated on "HarvestTarget"`,
    `create trigger harvesttarget_set_updated before update on "HarvestTarget" for each row execute procedure set_updated_at()`
  ];
  try {
    for (const sql of statements) {
      await prisma.$executeRawUnsafe(sql);
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

