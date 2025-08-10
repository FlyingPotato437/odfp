-- Enable required extensions
create extension if not exists vector;
create extension if not exists postgis;
create extension if not exists pg_trgm;

-- Dataset embedding vector and indexes (Gemini text-embedding-004 dimension 768)
alter table "Dataset" add column if not exists "embedding" vector(768);
create index if not exists dataset_embedding_idx on "Dataset" using ivfflat ("embedding" vector_cosine_ops) with (lists = 100);

-- Geometry for spatial filtering
alter table "Dataset" add column if not exists "geom" geometry(Polygon, 4326);
create index if not exists dataset_geom_gix on "Dataset" using gist ("geom");

-- Full-text search
alter table "Dataset" add column if not exists "search_tsvector" tsvector;
create index if not exists dataset_search_tsv_gin on "Dataset" using gin ("search_tsvector");

-- Trigger to keep tsvector in sync
create or replace function dataset_tsv_trigger() returns trigger as $$
begin
  new.search_tsvector :=
    setweight(to_tsvector('simple', coalesce(new.title,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.abstract,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.publisher,'')), 'C');
  return new;
end
$$ language plpgsql;

drop trigger if exists dataset_tsv_update on "Dataset";
create trigger dataset_tsv_update before insert or update on "Dataset"
for each row execute procedure dataset_tsv_trigger();

-- Backfill existing rows
update "Dataset" set search_tsvector =
  setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
  setweight(to_tsvector('simple', coalesce(abstract,'')), 'B') ||
  setweight(to_tsvector('simple', coalesce(publisher,'')), 'C');

-- Optional: derive geom from bbox where present
update "Dataset"
set geom = ST_MakeEnvelope("bboxMinX", "bboxMinY", "bboxMaxX", "bboxMaxY", 4326)
where geom is null and "bboxMinX" is not null and "bboxMinY" is not null and "bboxMaxX" is not null and "bboxMaxY" is not null;
