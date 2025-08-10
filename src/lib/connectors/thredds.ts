import { parseStringPromise } from "xml2js";

export type ThreddsDataset = {
  id: string;
  title?: string;
  summary?: string;
  publisher?: string;
  distributions: Array<{ url: string; service: string; format?: string }>;
};

export async function fetchThreddsCatalog(baseUrl: string): Promise<ThreddsDataset[]> {
  const url = baseUrl.endsWith("catalog.xml") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/catalog.xml`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch THREDDS catalog: ${res.status}`);
  const xml = await res.text();
  const doc = await parseStringPromise(xml, { explicitArray: false, mergeAttrs: true });
  const catalog = doc.catalog || doc["catalog"];
  if (!catalog) return [];

  const services: Record<string, string> = {};
  const serviceEntries = catalog.service?.service || [];
  const listServices = Array.isArray(serviceEntries) ? serviceEntries : [serviceEntries];
  for (const s of listServices) {
    if (!s) continue;
    services[s.name] = s.base || s.baseUrl || s.baseURI || "";
  }

  const datasets: ThreddsDataset[] = [];
  const dsEntries = catalog.dataset?.dataset || [];
  const listDs = Array.isArray(dsEntries) ? dsEntries : [dsEntries];

  for (const d of listDs) {
    if (!d) continue;
    const id = d.ID || d.id || d.name || d.urlPath || d.title;
    if (!id) continue;
    const access = d.access || [];
    const listAccess = Array.isArray(access) ? access : [access];
    const dist: ThreddsDataset["distributions"] = [];
    for (const a of listAccess) {
      const serviceName = a.serviceName || a.service || a.name;
      const urlPath = a.urlPath || a.url || d.urlPath;
      const base = serviceName && services[serviceName] ? services[serviceName] : "";
      if (urlPath) {
        const full = new URL((base || "/") + urlPath, baseUrl).toString();
        const format = a.dataFormat || a.format || undefined;
        dist.push({ url: full, service: serviceName || "HTTP", format });
      }
    }
    datasets.push({ id, title: d.title, summary: d.summary, distributions: dist });
  }

  return datasets;
}

type ThreddsCatalog = {
  service?: { service?: Array<{ name?: string; base?: string; baseUrl?: string; baseURI?: string }> };
  dataset?: unknown;
  catalogRef?: unknown;
};

async function parseCatalog(baseUrl: string): Promise<ThreddsCatalog> {
  const url = baseUrl.endsWith("catalog.xml") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/catalog.xml`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch THREDDS catalog: ${res.status}`);
  const xml = await res.text();
  const doc = await parseStringPromise(xml, { explicitArray: false, mergeAttrs: true });
  return (doc.catalog || doc["catalog"] || {}) as ThreddsCatalog;
}

export async function crawlThredds(baseUrl: string, maxDepth = 3): Promise<ThreddsDataset[]> {
  const visited = new Set<string>();
  const out: ThreddsDataset[] = [];

  async function crawl(url: string, depth: number) {
    if (depth > maxDepth) return;
    const key = url;
    if (visited.has(key)) return;
    visited.add(key);

    let catalog: ThreddsCatalog;
    try { catalog = await parseCatalog(url); } catch { return; }

    const services: Record<string, string> = {};
    const serviceEntries = (catalog as ThreddsCatalog).service?.service || [];
    const listServices = Array.isArray(serviceEntries) ? serviceEntries : [serviceEntries];
    for (const s of listServices) {
      if (!s) continue;
      const name = s.name || "";
      services[name] = s.base || s.baseUrl || s.baseURI || "";
    }

    type Ds = { ID?: string; id?: string; name?: string; urlPath?: string; title?: string; summary?: string; access?: Array<Record<string, unknown>> | Record<string, unknown> };
    const collectDataset = (d: Ds) => {
      const id = d.ID || d.id || d.name || d.urlPath || d.title;
      if (!id) return;
      const access = d.access || [];
      const listAccess = Array.isArray(access) ? access : [access];
      const dist: ThreddsDataset["distributions"] = [];
      for (const a of listAccess) {
        const aRec = a as Record<string, unknown>;
        const serviceName = (aRec.serviceName || aRec.service || aRec.name) as string | undefined;
        const urlPath = (aRec.urlPath || aRec.url || d.urlPath) as string | undefined;
        const base = serviceName && services[serviceName] ? services[serviceName] : "";
        if (urlPath) {
          const full = new URL((base || "/") + urlPath, url).toString();
          const format = (aRec.dataFormat || aRec.format || undefined) as string | undefined;
          dist.push({ url: full, service: serviceName || "HTTP", format });
        }
      }
      out.push({ id: String(id), title: d.title, summary: d.summary, distributions: dist });
    };

    // Datasets (including nested)
    const dsRoot = (catalog as ThreddsCatalog).dataset as unknown as Ds | { dataset?: Ds | Ds[] } | Ds[] | undefined;
    const dsEntries: unknown = (dsRoot as { dataset?: Ds | Ds[] } | undefined)?.dataset || dsRoot || [];
    const listDs = Array.isArray(dsEntries) ? dsEntries : [dsEntries];
    for (const d of listDs) {
      if (!d) continue;
      const dd = d as Ds & { dataset?: Ds | Ds[] };
      if (dd.dataset) {
        const nested = Array.isArray(dd.dataset) ? dd.dataset : [dd.dataset];
        for (const nd of nested) collectDataset(nd);
      } else {
        collectDataset(dd as Ds);
      }
    }

    // Sub catalogs
    type Ref = { href?: string; "xlink:href"?: string; url?: string; link?: string };
    const refs: unknown = (catalog as ThreddsCatalog).catalogRef || [];
    const listRefs = Array.isArray(refs) ? refs : [refs];
    for (const r of listRefs) {
      if (!r) continue;
      const rr = r as Ref;
      const href = (rr.href || rr["xlink:href"] || rr.url || rr.link) as string | undefined;
      if (!href) continue;
      const next = new URL(href, url).toString();
      await crawl(next, depth + 1);
    }
  }

  await crawl(baseUrl, 0);
  return out;
}
