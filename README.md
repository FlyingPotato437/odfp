This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## AI Insights

- Endpoint: `POST /api/v1/ai/synthesize` with JSON `{ "query": "..." }`.
- Config: set `GEMINI_API_KEY` to enable LLM synthesis. Without it, the app falls back to a heuristic analysis using retrieved dataset metadata.
- What it does now:
  - Expands scientific terms (including fisheries: CPUE, haul, gear type, etc.) and location variants (e.g., North Atlantic, Gulf Stream).
  - Runs enriched semantic search and ranks datasets by relevance and multi-factor quality (recency, coverage, variables, access, provenance).
  - Computes temporal range and detects multi-year gaps; summarizes spatial coverage from dataset bounding boxes.
  - Derives cross-dataset opportunities from variable overlap, spatial/temporal alignment, and title similarity.
  - Produces a structured analysis with sections: Key Datasets, Data Limitations, Temporal/Spatial, Cross-dataset Opportunities, Next Steps.

Tip: You can view AI Insights on the Search page after running a query; click “Generate”.

## Supabase + Postgres Integration

- Point Prisma to Supabase: set `DATABASE_URL` to your Supabase Postgres connection string (project settings → Database → Connection string → Node). Example:
  - `DATABASE_URL=postgresql://postgres:YOUR-PASSWORD@db.YOUR-HOST.supabase.co:5432/postgres`
- Recommended extensions in your database (SQL):
  - `create extension if not exists vector;` (pgvector for embeddings)
  - `create extension if not exists pg_trgm;` (trigram similarity for text ranking)
  - `create extension if not exists postgis;` (geospatial `geom` support; optional—code falls back to bbox if absent)
- Recommended indexes on `Dataset` for best search performance:
  - Full-text: a generated column `search_tsvector` and GIN index
  - Trigram: `gin` index on `title` and `abstract`
  - Spatial: `geom geometry(Polygon,4326)` with a `gist` index (optional; bbox fallback in code)
- Health check: GET `/api/v1/health/db` returns `{ prismaOk, supabaseConfigured }`.

Note: If PostGIS or `geom` are not present, spatial search falls back gracefully to bbox-based filters. If `pgvector` is not available, semantic search falls back to lexical ranking.
