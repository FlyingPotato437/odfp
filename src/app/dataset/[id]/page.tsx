import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { DatasetMap } from "@/components/map/DatasetMap";

export default async function DatasetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const row = await prisma.dataset.findUnique({ where: { id: decoded }, include: { variables: true, distributions: true } });
  if (!row) return notFound();
  const ds = {
    id: row.id,
    doi: row.doi || undefined,
    title: row.title,
    abstract: row.abstract || undefined,
    publisher: row.publisher || undefined,
    temporal_extent: { start: row.timeStart?.toISOString(), end: row.timeEnd?.toISOString() },
    spatial_extent: { bbox: [row.bboxMinX, row.bboxMinY, row.bboxMaxX, row.bboxMaxY] as [number, number, number, number] | undefined },
    variables: row.variables.map((v) => ({ name: v.name, standard_name: v.standardName || undefined, units: v.units || undefined, long_name: v.longName || undefined })),
    distributions: row.distributions.map((d) => ({ url: d.url, format: d.format, access_service: d.accessService as "HTTP" | "OPeNDAP" | "THREDDS" | "ERDDAP" | "FTP" | "S3" })),
    updated_at: row.updatedAt?.toISOString(),
    creators: undefined,
  } as const;
  if (!ds) return notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-3 text-sm text-slate-600">
        <a href={"/search"} className="text-blue-700 hover:underline">← Back to search</a>
      </div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">{ds.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          {ds.publisher && <Badge>{ds.publisher}</Badge>}
          {ds.doi && <a href={`https://doi.org/${ds.doi}`} target="_blank" className="text-blue-700 hover:underline">DOI: {ds.doi}</a>}
          {(ds.temporal_extent?.start || ds.temporal_extent?.end) && (
            <span>
              {ds.temporal_extent?.start || "?"} – {ds.temporal_extent?.end || "?"}
            </span>
          )}
        </div>
      </div>

      {ds.abstract && (
        <p className="mb-6 text-slate-700 leading-relaxed dark:text-slate-300">{ds.abstract}</p>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardContent>
            <Tabs tabs={[{ id: "vars", label: "Variables" }, { id: "citation", label: "Citation" }, { id: "export", label: "Exports" }, { id: "map", label: "Map" }]}>                
              {/* Variables */}
              <div>
                <div className="flex flex-wrap gap-2">
                  {(ds.variables || []).map((v) => (
                    <Badge key={v.name} variant="info">{v.standard_name || v.name}{v.units ? ` (${v.units})` : ""}</Badge>
                  ))}
                </div>
              </div>
              {/* Citation */}
                <div className="space-y-2 text-sm">
                <div>
                    <div className="font-semibold dark:text-slate-100">Citation</div>
                    <div className="text-slate-700 dark:text-slate-300">{(Array.isArray(ds.creators) ? (ds.creators as string[]).join(", ") : ds.publisher) || ""} ({new Date(ds.updated_at || Date.now()).getFullYear()}). {ds.title}. {ds.publisher}. {ds.doi ? `doi:${ds.doi}` : ""}</div>
                </div>
                <div>
                    <div className="font-semibold dark:text-slate-100">Landing</div>
                    <div className="text-slate-700 dark:text-slate-300">{ds.doi ? `https://doi.org/${ds.doi}` : "N/A"}</div>
                </div>
              </div>
              {/* Exports */}
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-semibold dark:text-slate-100">DCAT JSON</div>
                  <a className="text-blue-700 hover:underline" href={`/api/v1/datasets/${encodeURIComponent(ds.id)}`} target="_blank">View</a>
                </div>
                <div>
                  <div className="font-semibold dark:text-slate-100">ISO 19115 JSON</div>
                  <a className="text-blue-700 hover:underline" href={`/api/v1/datasets/${encodeURIComponent(ds.id)}/iso`} target="_blank">View</a>
                </div>
              </div>
              {/* Map */}
              <div className="space-y-2">
                <DatasetMap bbox={ds.spatial_extent?.bbox} height={400} />
              </div>
            </Tabs>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Distributions</h2>
            <ul className="space-y-2 text-sm">
              {(ds.distributions || []).map((d) => (
                <li key={d.url} className="flex items-center justify-between gap-2">
                  <div className="text-slate-700">{d.format} <span className="text-slate-400">({d.access_service})</span></div>
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">Open</a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

    </main>
  );
}

