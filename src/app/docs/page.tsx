export default function Docs() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-4 text-3xl font-semibold dark:text-white">API Docs</h1>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold dark:text-slate-100">Search</h2>
          <pre className="mt-2 overflow-auto rounded bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">GET /api/v1/search?q=ssta&bbox=-180,-90,180,90&time_start=2000-01-01&time_end=2020-12-31&variables=sst,chlorophyll&format=NetCDF&service=ERDDAP&publisher=NOAA%20NCEI&sort=relevance&page=1&size=20</pre>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold dark:text-slate-100">Dataset</h2>
          <pre className="mt-2 overflow-auto rounded bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">GET /api/v1/datasets/{'{id}'}\nGET /api/v1/datasets/{'{id}'}/iso</pre>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold dark:text-slate-100">Suggest</h2>
          <pre className="mt-2 overflow-auto rounded bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">GET /api/v1/suggest?type=variable&prefix=chl\nGET /api/v1/suggest?type=publisher&prefix=noaa</pre>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold dark:text-slate-100">Facets</h2>
          <pre className="mt-2 overflow-auto rounded bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">GET /api/v1/stats/facets</pre>
        </section>
      </div>
    </main>
  );
}

