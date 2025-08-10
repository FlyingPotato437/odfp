export default function About() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-3 text-3xl font-semibold dark:text-white">About ODFP</h1>
      <p className="text-slate-700 dark:text-slate-300">
        ODFP is a single search and access layer that crawls NOAA/NCEI and partner catalogs,
        normalizes metadata to a canonical schema, and exposes everything through fast APIs and a clean web app
        with map/time/variable filters.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">MVP</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 dark:text-slate-300">
            <li>Harvesting + normalization</li>
            <li>Search + dataset pages</li>
            <li>Exports (DCAT/ISO)</li>
          </ul>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">V2</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 dark:text-slate-300">
            <li>On-demand transforms (subset/regrid/Zarr/Parquet)</li>
            <li>Semantic search</li>
            <li>SDKs/CLI, Jupyter/QGIS plugins</li>
          </ul>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Architecture</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 dark:text-slate-300">
            <li>Connectors: NCEI, ERDDAP/THREDDS, PANGAEA</li>
            <li>Postgres/PostGIS + OpenSearch</li>
            <li>FastAPI backend, Next.js frontend</li>
            <li>AWS: ECS, RDS, S3, CloudFront, Cognito</li>
            <li>OpenTelemetry → Dynatrace</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

