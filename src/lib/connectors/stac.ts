export type StacLink = { rel?: string; href?: string; type?: string; title?: string };
export type StacAsset = { href: string; type?: string; roles?: string[]; title?: string };
export type StacNode = {
  id?: string;
  type?: string; // Catalog | Collection | Feature
  description?: string;
  title?: string;
  links?: StacLink[];
  assets?: Record<string, StacAsset>;
};

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`STAC fetch failed ${res.status}`);
  return res.json();
}

type StacCrawlItem = { id: string; title?: string; description?: string; assets: Array<{ url: string; type?: string }> };

export async function crawlStac(rootUrl: string, maxDepth = 3): Promise<StacCrawlItem[]> {
  const visited = new Set<string>();
  const out: StacCrawlItem[] = [];

  async function walk(url: string, depth: number) {
    if (depth > maxDepth) return;
    const key = url.split('#')[0];
    if (visited.has(key)) return;
    visited.add(key);

    let node: StacNode;
    try { node = (await fetchJson(url)) as StacNode; } catch { return; }
    const links = Array.isArray(node.links) ? node.links : [];

    // Collect from collections and items
    if (node.type === 'Collection' || node.type === 'Feature') {
      const id = String(node.id || url);
      const title = node.title;
      const description = node.description;
      const assets: Array<{ url: string; type?: string }> = [];
      if (node.assets) {
        for (const a of Object.values(node.assets)) {
          if (a && a.href && a.href.startsWith('http')) assets.push({ url: a.href, type: a.type });
        }
      }
      out.push({ id, title, description, assets });
    }

    // Recurse to children/collections
    for (const l of links) {
      const rel = (l.rel || '').toLowerCase();
      if (rel === 'child' || rel === 'collection' || rel === 'item' || rel === 'items') {
        const href = l.href;
        if (!href) continue;
        const next = new URL(href, url).toString();
        await walk(next, depth + 1);
      }
    }
  }

  await walk(rootUrl, 0);
  return out;
}

