import Papa from "papaparse";

export type ErddapDatasetSummary = {
  datasetID: string;
  title?: string;
  summary?: string;
  institution?: string;
  dataStructure?: string;
};

export async function fetchErddapAllDatasets(baseUrl: string): Promise<ErddapDatasetSummary[]> {
  // ERDDAP expects a query like: ?datasetID,title,summary,institution,dataStructure&orderBy(%22datasetID%22)
  const finalUrl = new URL("/erddap/tabledap/allDatasets.csv", baseUrl);
  finalUrl.search = "?datasetID,title,summary,institution,dataStructure&orderBy(%22datasetID%22)";
  const res = await fetch(finalUrl.toString());
  if (!res.ok) throw new Error(`Failed to fetch ERDDAP allDatasets: ${res.status}`);
  const csv = await res.text();
  const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: true });
  const rows: string[][] = parsed.data as string[][];
  // Expect header on first row
  const header = rows[0] || [];
  const idx = {
    datasetID: header.indexOf("datasetID"),
    title: header.indexOf("title"),
    summary: header.indexOf("summary"),
    institution: header.indexOf("institution"),
    dataStructure: header.indexOf("dataStructure"),
  };
  const out: ErddapDatasetSummary[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const datasetID = r[idx.datasetID];
    if (!datasetID) continue;
    out.push({
      datasetID,
      title: r[idx.title] || undefined,
      summary: r[idx.summary] || undefined,
      institution: r[idx.institution] || undefined,
      dataStructure: r[idx.dataStructure] || undefined,
    });
  }
  return out;
}

export type ErddapInfo = {
  variables: Array<{ name: string; standard_name?: string; units?: string; long_name?: string }>;
  bbox?: [number, number, number, number];
  timeStart?: string;
  timeEnd?: string;
};

export async function fetchErddapInfo(baseUrl: string, datasetID: string): Promise<ErddapInfo> {
  // ERDDAP info JSON: /erddap/info/{datasetID}/index.json
  const url = new URL(`/erddap/info/${encodeURIComponent(datasetID)}/index.json`, baseUrl);
  const res = await fetch(url.toString());
  if (!res.ok) return { variables: [] };
  const json: unknown = await res.json().catch(() => null);
  // The structure is a table with rows/columns
  // We'll scan for attributes of interest and variable rows
  const table = (json as { table?: { rows?: unknown[]; columnNames?: string[] } } | null)?.table;
  const rows: unknown[] = Array.isArray(table?.rows) ? table!.rows! : [];
  const columns: string[] = Array.isArray(table?.columnNames) ? table!.columnNames! : [];
  const colIndex: Record<string, number> = Object.fromEntries(columns.map((c, i) => [c, i]));

  const get = (row: unknown[], key: string) => (row as Record<number, unknown>)[colIndex[key]] as unknown;

  const variables: ErddapInfo["variables"] = [];
  let lonMin: number | undefined, lonMax: number | undefined, latMin: number | undefined, latMax: number | undefined;
  let timeStart: string | undefined, timeEnd: string | undefined;

  for (const r of rows as unknown[][]) {
    const t = get(r, "rowType") as string | undefined;
    if (t === "variable") {
      variables.push({
        name: String((get(r, "variableName") as string | undefined) ?? ""),
        standard_name: (get(r, "standard_name") as string | undefined) || undefined,
        units: (get(r, "units") as string | undefined) || undefined,
        long_name: (get(r, "long_name") as string | undefined) || undefined,
      });
    }
    if (t === "attribute") {
      const aName = get(r, "attributeName") as string | undefined;
      const aValue = get(r, "value") as string | number | undefined;
      switch (aName) {
        case "geospatial_lon_min": lonMin = Number(aValue); break;
        case "geospatial_lon_max": lonMax = Number(aValue); break;
        case "geospatial_lat_min": latMin = Number(aValue); break;
        case "geospatial_lat_max": latMax = Number(aValue); break;
        case "time_coverage_start": timeStart = aValue ? String(aValue) : undefined; break;
        case "time_coverage_end": timeEnd = aValue ? String(aValue) : undefined; break;
      }
    }
  }

  const bbox = (lonMin != null && lonMax != null && latMin != null && latMax != null)
    ? [lonMin, latMin, lonMax, latMax] as [number, number, number, number]
    : undefined;

  return { variables, bbox, timeStart, timeEnd };
}
