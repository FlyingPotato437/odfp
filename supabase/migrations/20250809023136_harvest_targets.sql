-- Create HarvestTarget discovery queue
create table if not exists "HarvestTarget" (
  id text primary key,
  kind text not null,
  url text not null unique,
  status text,
  "lastChecked" timestamptz,
  attempts integer not null default 0,
  "discoveredFrom" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
