-- Trigram index on title for fuzzy search performance
create index if not exists dataset_title_trgm on "Dataset" using gin (title gin_trgm_ops);

-- Increase ivfflat lists for better recall (tune per corpus size)
drop index if exists dataset_embedding_idx;
create index if not exists dataset_embedding_idx on "Dataset" using ivfflat ("embedding" vector_cosine) with (lists = 200);

