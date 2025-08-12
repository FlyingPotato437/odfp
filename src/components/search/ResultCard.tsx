import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ExternalLink, Download, Calendar, Globe2, Map as MapIcon, Share2 } from "lucide-react";

type Props = {
  id: string;
  title: string;
  publisher?: string;
  doi?: string;
  license?: string;
  sourceSystem?: string;
  abstract?: string;
  time?: { start?: string; end?: string };
  variables?: string[];
  variablesDetailed?: Array<{ name: string; units?: string; standard_name?: string; long_name?: string }>;
  distributions?: Array<{ url: string; format: string; service: string }>;
};

export function ResultCard({ id, title, publisher, doi, license, sourceSystem, abstract, time, variables, variablesDetailed, distributions }: Props) {
  const cleanDoi = doi ? doi.replace(/^doi:\s*/i, '').replace(/^https?:\/\/doi\.org\//i, '') : undefined;
  return (
    <Card className="card-hover overflow-hidden border border-slate-200/70 bg-white/90 backdrop-blur-sm transition-shadow dark:border-slate-800/70 dark:bg-slate-900/70">
      <CardHeader className="flex flex-col gap-2 bg-gradient-to-b from-white to-slate-50/60 dark:from-slate-900 dark:to-slate-900/40">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/dataset/${encodeURIComponent(id)}`} className="highlight-underline text-lg font-semibold text-slate-900 hover:underline dark:text-slate-100">
            {title}
          </Link>
          <div className="flex items-center gap-1">
            {publisher && <Badge className="whitespace-nowrap glow bg-sky-50 text-sky-700 dark:bg-slate-800 dark:text-sky-300">{publisher}</Badge>}
            {sourceSystem && <Badge className="whitespace-nowrap bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{sourceSystem}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          {time?.start || time?.end ? (
            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300"><Calendar className="h-4 w-4" />
              {time?.start || "?"} – {time?.end || "?"}
            </span>
          ) : null}
          {Boolean(variables?.length) && <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400"><Globe2 className="h-4 w-4" />{variables?.length} variable{variables!.length === 1 ? "" : "s"}</span>}
          <div className="flex flex-wrap gap-1">
            {variablesDetailed && variablesDetailed.length > 0
              ? variablesDetailed.slice(0, 6).map((vd, i) => (
                  <Badge key={`${vd.name}-${i}`} variant="info" className="bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                    {vd.name}{vd.units ? ` [${vd.units}]` : ''}
                  </Badge>
                ))
              : (variables || []).slice(0, 6).map((v) => (
                  <Badge key={v} variant="info" className="bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">{v}</Badge>
                ))}
          </div>
        </div>
        {abstract && (
          <div className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
            {abstract}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        {(distributions || []).slice(0, 3).map((d) => (
          <a key={d.url} href={d.url} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60">
            <Download className="h-4 w-4 text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200" />
            <span className="text-slate-700 group-hover:text-slate-900 dark:text-slate-200 dark:group-hover:text-white">{d.format}</span>
            <span className="text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300">({d.service})</span>
          </a>
        ))}
        {cleanDoi && (
          <a
            href={`https://doi.org/${encodeURIComponent(cleanDoi)}`}
            target="_blank"
            className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
          >
            DOI
          </a>
        )}
        {license && (
          <span className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
            {license}
          </span>
        )}
        <Link href={`/dataset/${encodeURIComponent(id)}#map`} className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60">
          <MapIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" /> Map
        </Link>
        <a
          href={`/api/v1/datasets/${encodeURIComponent(id)}`}
          target="_blank"
          className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
        >
          <Share2 className="h-4 w-4 text-slate-500 dark:text-slate-400" /> DCAT
        </a>
        <a
          href={`/api/v1/datasets/${encodeURIComponent(id)}/iso`}
          target="_blank"
          className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
        >
          <Share2 className="h-4 w-4 text-slate-500 dark:text-slate-400" /> ISO
        </a>
        <Link href={`/dataset/${encodeURIComponent(id)}`} className="ml-auto inline-flex items-center gap-1 text-sm text-blue-700 hover:underline">
          View details
          <ExternalLink className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
