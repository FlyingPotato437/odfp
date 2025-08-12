import { prisma } from "@/lib/db";
import type { Prisma, Dataset, Variable, Distribution } from "@prisma/client";
import { SearchQuery, SearchResult } from "@/lib/types";

type DatasetWithRelations = Dataset & {
  variables: Variable[];
  distributions: Distribution[];
};

const validServices = ["HTTP", "OPeNDAP", "THREDDS", "ERDDAP", "FTP", "S3"] as const;
type Service = typeof validServices[number];
const toServiceStrict = (s: string): Service => ((validServices as readonly string[]).includes(s) ? (s as Service) : "HTTP");

function getVariableRelevanceScore(variables: Array<{ name: string; longName?: string | null; standardName?: string | null }>, tokens: Set<string>): number {
  let score = 0;
  for (const v of variables) {
    const fields = [v.name, v.longName || "", v.standardName || ""].map((s) => s.toLowerCase());
    for (const t of tokens) {
      for (const field of fields) {
        if (field.includes(t)) {
          // Exact match gets highest score
          if (field === t || field.replace(/[\s_-]/g, ' ') === t.replace(/[\s_-]/g, ' ')) {
            score += 20;
          }
          // Multi-word phrase match gets high score
          else if (t.includes(' ') && field.includes(t)) {
            const wordCount = t.split(' ').length;
            score += wordCount * 8; // More words = higher score
          }
          // Contains token gets medium score  
          else if (field.includes(t)) {
            score += t.length > 3 ? 5 : 2; // Longer tokens get more weight
          }
          
          // Semantic similarity bonuses for common patterns
          const semanticBonuses = [
            { patterns: ['wind', 'eastward', 'northward'], fields: ['wind', 'u_component', 'v_component', 'eastward', 'northward'], bonus: 6 },
            { patterns: ['temperature', 'temp', 'sst'], fields: ['temperature', 'temp', 'sst', 'thermal'], bonus: 6 },
            { patterns: ['current', 'velocity'], fields: ['current', 'velocity', 'flow', 'stream'], bonus: 6 },
            { patterns: ['salinity', 'salt'], fields: ['salinity', 'salt', 'saline'], bonus: 6 },
            { patterns: ['surface', 'sea_surface'], fields: ['surface', 'sea_surface', 'skin'], bonus: 4 },
          ];
          
          for (const { patterns, fields: semanticFields, bonus } of semanticBonuses) {
            if (patterns.some(p => t.includes(p)) && semanticFields.some(f => field.includes(f))) {
              score += bonus;
            }
          }
        }
      }
    }
  }
  return score;
}

function buildWhere(query: SearchQuery): { where: Prisma.DatasetWhereInput; variableTokens?: string[]; requirePlatform?: string } {
  const { q, bbox, polygon, time_start, time_end, variables, format, publisher, service, license, platform } = query;
  const AND: Prisma.DatasetWhereInput[] = [];

  if (publisher) AND.push({ publisher: { equals: publisher } });
  if (license) AND.push({ license: { equals: license } });

  const bboxToUse = (() => {
    if (bbox) return bbox;
    if (polygon && polygon.length >= 4) {
      const lons = polygon.map((p) => p[0]);
      const lats = polygon.map((p) => p[1]);
      const minX = Math.min(...lons);
      const maxX = Math.max(...lons);
      const minY = Math.min(...lats);
      const maxY = Math.max(...lats);
      return [minX, minY, maxX, maxY] as [number, number, number, number];
    }
    return undefined;
  })();

  if (bboxToUse) {
    const [minX, minY, maxX, maxY] = bboxToUse;
    // Exclude datasets without bbox and those that do not intersect
    AND.push({ NOT: [{ bboxMinX: null }, { bboxMinY: null }, { bboxMaxX: null }, { bboxMaxY: null }] });
    AND.push({ NOT: [{ bboxMaxX: { lt: minX } }, { bboxMinX: { gt: maxX } }, { bboxMaxY: { lt: minY } }, { bboxMinY: { gt: maxY } }] });
  }

  if (time_start) {
    AND.push({ OR: [{ timeEnd: null }, { timeEnd: { gte: new Date(time_start) } }] });
  }
  if (time_end) {
    AND.push({ OR: [{ timeStart: null }, { timeStart: { lte: new Date(time_end) } }] });
  }

  if (format) {
    AND.push({ distributions: { some: { format: { equals: format } } } });
  }
  if (service) {
    AND.push({ distributions: { some: { accessService: service } } });
  }

  if (q) {
    const qLike = q;
    AND.push({
      OR: [
        { title: { contains: qLike } },
        { abstract: { contains: qLike } },
        { publisher: { contains: qLike } },
        { doi: { contains: qLike } },
        { license: { contains: qLike } },
        { sourceSystem: { contains: qLike } },
        {
          variables: {
            some: {
              OR: [
                { name: { contains: qLike } },
                { longName: { contains: qLike } },
                { standardName: { contains: qLike } },
              ],
            },
          },
        },
        {
          distributions: {
            some: {
              OR: [
                { format: { contains: qLike } },
                { accessService: { contains: qLike as unknown as Service } },
              ],
            },
          },
        },
      ],
    });
  }

  // Variable tokens - preserve phrase context, don't just use individual words
  const variableTokens: string[] | undefined = (() => {
    if (!variables || variables.length === 0) return undefined;
    const tokens: string[] = [];
    for (const raw of variables) {
      if (!raw) continue;
      const leaf = raw.includes(">") ? raw.split(">").pop()!.trim() : raw.trim();
      if (leaf) {
        // Add the full variable name/phrase as primary token
        tokens.push(leaf);
        // Add meaningful subphrases (2+ words) to maintain context
        const words = leaf.split(/[\s_/,-]+/).map((w) => w.trim()).filter(Boolean);
        if (words.length >= 2) {
          // Add bi-grams and tri-grams to preserve phrase relationships
          for (let i = 0; i < words.length - 1; i++) {
            const bigram = words.slice(i, i + 2).join(' ');
            tokens.push(bigram);
            if (i < words.length - 2) {
              const trigram = words.slice(i, i + 3).join(' ');
              tokens.push(trigram);
            }
          }
        }
        // Only add individual words if they're meaningful (4+ chars) and not common stop words
        const meaningfulWords = words.filter(w => w.length >= 4 && !['data', 'time', 'level'].includes(w.toLowerCase()));
        tokens.push(...meaningfulWords);
      }
    }
    return Array.from(new Set(tokens.map((t) => t.toLowerCase())));
  })();

  const where: Prisma.DatasetWhereInput = AND.length ? { AND } : {};
  return {
    where,
    variableTokens,
    requirePlatform: platform || undefined,
  } as const;
}

export async function executeSearch(query: SearchQuery): Promise<SearchResult> {
  const { page = 1, size = 20, sort = "relevance" } = query;
  const { where, variableTokens, requirePlatform } = buildWhere(query);
  
  // If bbox/polygon provided, prefer PostGIS ST_Intersects using geom
  const hasSpatial = Boolean(query.bbox || (query.polygon && query.polygon.length >= 4));
  const textQuery = ((query.q || "") + " " + (variableTokens?.join(" ") || "")).trim();

  if (hasSpatial || textQuery) {
    // Attempt dataset_fts view (variables + distributions), then fallback to Dataset FTS
    try {
      const params: Array<string | number> = [];
      let sql = `select df.id from dataset_fts df`;
      const clauses: string[] = [];

      if (hasSpatial) {
        if (query.bbox) {
          const [minX, minY, maxX, maxY] = query.bbox;
          params.push(minX, minY, maxX, maxY);
          sql += ` join "Dataset" d on d.id = df.id`;
          clauses.push(`d.geom is not null and ST_Intersects(d.geom, ST_MakeEnvelope($${params.length-3}, $${params.length-2}, $${params.length-1}, $${params.length}, 4326))`);
        } else if (query.polygon && query.polygon.length >= 4) {
          const wkt = `POLYGON((${query.polygon.map(([x,y]) => `${x} ${y}`).join(", ")}))`;
          params.push(wkt);
          sql += ` join "Dataset" d on d.id = df.id`;
          clauses.push(`d.geom is not null and ST_Intersects(d.geom, ST_GeomFromText($${params.length}, 4326))`);
        }
      }

      if (textQuery) {
        const phraseQuery = textQuery.replace(/[^\w\s]/g, ' ').trim();
        params.push(textQuery, phraseQuery);
        clauses.push(`(df.tsv @@ phraseto_tsquery('english', $${params.length}) or df.tsv @@ plainto_tsquery('english', $${params.length-1}))`);
      }

      if (clauses.length) sql += ` where ` + clauses.join(" and ");
      sql += ` order by 
        CASE WHEN df.tsv @@ phraseto_tsquery('english', $${textQuery ? params.length : (params.push('') && params.length)})
             THEN ts_rank_cd(df.tsv, phraseto_tsquery('english', $${textQuery ? params.length : params.length}))
             ELSE 0 END desc,
        ts_rank_cd(df.tsv, plainto_tsquery('english', $${textQuery ? params.length-1 : params.length})) desc`;
      sql += ` limit $${params.push(size)} offset $${params.push((page - 1) * size)}`;

      const idRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(sql, ...params);
      let ids = idRows.map(r => r.id);

      // Expand id set with simple Prisma contains matches on DOI/license/sourceSystem when q is present
      if (query.q && query.q.trim()) {
        const extra = await prisma.dataset.findMany({
          where: {
            OR: [
              { doi: { contains: query.q } },
              { license: { contains: query.q } },
              { sourceSystem: { contains: query.q } },
            ],
          },
          select: { id: true },
          take: Math.max(size * 2, 100),
        });
        const extraIds = new Set(extra.map(e => e.id));
        ids = Array.from(new Set([...ids, ...extraIds]));
      }
      const items = await prisma.dataset.findMany({ where: { id: { in: ids }, ...(where as unknown as Prisma.DatasetWhereInput) }, include: { variables: true, distributions: true } });

    let filtered = items;
    if (variableTokens && variableTokens.length > 0) {
      const tokens = new Set(variableTokens.map((t) => t.toLowerCase()));
      // Sort by variable relevance instead of hard filtering
      filtered = filtered.sort((a, b) => {
        const aScore = getVariableRelevanceScore(a.variables, tokens);
        const bScore = getVariableRelevanceScore(b.variables, tokens);
        return bScore - aScore;
      });
    }
    if (requirePlatform) {
      filtered = filtered.filter((d) => {
        const platforms: unknown = (d as unknown as { platforms?: unknown }).platforms;
        const list = Array.isArray(platforms) ? (platforms as unknown[]).map(String) : [];
        return list.some((p) => p.toLowerCase() === String(requirePlatform).toLowerCase());
      });
    }

      return {
        total: ids.length,
        page,
        size,
        results: filtered.map((d) => ({
          id: d.id,
          doi: d.doi || undefined,
          license: d.license || undefined,
          sourceSystem: (d as DatasetWithRelations).sourceSystem || undefined,
          title: d.title,
          publisher: d.publisher || undefined,
          abstract: d.abstract || undefined,
          time: { start: d.timeStart?.toISOString(), end: d.timeEnd?.toISOString() },
          spatial: { bbox: [d.bboxMinX, d.bboxMinY, d.bboxMaxX, d.bboxMaxY] as [number, number, number, number] | undefined },
          variables: d.variables.map((v) => v.name),
            distributions: d.distributions.map((dist) => ({ url: dist.url, format: dist.format, service: toServiceStrict(dist.accessService) })),
        })),
      };
    } catch {
      // Likely missing dataset_fts; will fallback to Prisma or Dataset FTS below.
    }
    try {
      // Fallback to Dataset table with FTS/trigram
      const params: Array<string | number> = [];
      let sql = `select id from "Dataset"`;
      const clauses: string[] = [];
      if (hasSpatial) {
        if (query.bbox) {
          const [minX, minY, maxX, maxY] = query.bbox;
          params.push(minX, minY, maxX, maxY);
          clauses.push(`geom is not null and ST_Intersects(geom, ST_MakeEnvelope($${params.length-3}, $${params.length-2}, $${params.length-1}, $${params.length}, 4326))`);
        } else if (query.polygon && query.polygon.length >= 4) {
          const wkt = `POLYGON((${query.polygon.map(([x,y]) => `${x} ${y}`).join(", ")}))`;
          params.push(wkt);
          clauses.push(`geom is not null and ST_Intersects(geom, ST_GeomFromText($${params.length}, 4326))`);
        }
      }
      if (textQuery) {
        const phraseQuery = textQuery.replace(/[^\w\s]/g, ' ').trim();
        params.push(textQuery, phraseQuery);
        clauses.push(`(
          search_tsvector @@ phraseto_tsquery('english', $${params.length}) or
          search_tsvector @@ plainto_tsquery('english', $${params.length-1}) or
          similarity(title, $${params.length-1}) > 0.2 or
          similarity(abstract, $${params.length-1}) > 0.15
        )`);
      }
      if (clauses.length) sql += ` where ` + clauses.join(" and ");
      sql += ` order by 
        CASE WHEN search_tsvector @@ phraseto_tsquery('english', $${textQuery ? params.length : (params.push('') && params.length)}) 
             THEN ts_rank_cd(search_tsvector, phraseto_tsquery('english', $${textQuery ? params.length : params.length})) 
             ELSE 0 END desc,
        ts_rank_cd(search_tsvector, plainto_tsquery('english', $${textQuery ? params.length-1 : params.length})) desc, 
        similarity(title, $${textQuery ? params.length-1 : params.length}) desc, 
        "updatedAt" desc`;
      sql += ` limit $${params.push(size)} offset $${params.push((page - 1) * size)}`;
      const idRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(sql, ...params);
      const ids = idRows.map(r => r.id);
      const [totalRow] = await prisma.$queryRawUnsafe<Array<{ count: number }>>(`select count(*)::int as count from (${sql.replace(/limit \$\d+ offset \$\d+$/,'')}) s`, ...params.slice(0, params.length - 2));
      const items = await prisma.dataset.findMany({ where: { id: { in: ids }, ...(where as unknown as Prisma.DatasetWhereInput) }, include: { variables: true, distributions: true } });
      let filtered = items;
      if (variableTokens && variableTokens.length > 0) {
        const tokens = new Set(variableTokens.map((t) => t.toLowerCase()));
        filtered = filtered.sort((a, b) => {
          const aScore = getVariableRelevanceScore(a.variables, tokens);
          const bScore = getVariableRelevanceScore(b.variables, tokens);
          return bScore - aScore;
        });
      }
      if (requirePlatform) {
        filtered = filtered.filter((d) => {
          const platforms: unknown = (d as unknown as { platforms?: unknown }).platforms;
          const list = Array.isArray(platforms) ? (platforms as unknown[]).map(String) : [];
          return list.some((p) => p.toLowerCase() === String(requirePlatform).toLowerCase());
        });
      }
      return {
        total: totalRow?.count ?? filtered.length,
        page,
        size,
        results: filtered.map((d) => ({
          id: d.id,
          doi: d.doi || undefined,
          license: d.license || undefined,
          sourceSystem: (d as DatasetWithRelations).sourceSystem || undefined,
          title: d.title,
          publisher: d.publisher || undefined,
          abstract: d.abstract || undefined,
          time: { start: d.timeStart?.toISOString(), end: d.timeEnd?.toISOString() },
          spatial: { bbox: [d.bboxMinX, d.bboxMinY, d.bboxMaxX, d.bboxMaxY] as [number, number, number, number] | undefined },
          variables: d.variables.map((v) => v.name),
          distributions: d.distributions.map((dist) => ({ url: dist.url, format: dist.format, service: toServiceStrict(dist.accessService) })),
        })),
      };
    } catch {
      // Fall back to Prisma filtering below
    }
  }

  // Fallback: existing Prisma-based search
  const orderBy = sort === "recency" ? [{ updatedAt: "desc" as const }] : [{ updatedAt: "desc" as const }];
  const [total, items] = await Promise.all([
    prisma.dataset.count({ where }),
    prisma.dataset.findMany({
      where,
      include: { variables: true, distributions: true },
      orderBy,
      skip: (page - 1) * size,
      take: size,
    }),
  ]);

  let filtered = items;
  if (variableTokens && variableTokens.length > 0) {
    const tokens = new Set(variableTokens.map((t) => t.toLowerCase()));
    // Sort by variable relevance instead of hard filtering
    filtered = filtered.sort((a, b) => {
      const aScore = getVariableRelevanceScore(a.variables, tokens);
      const bScore = getVariableRelevanceScore(b.variables, tokens);
      return bScore - aScore;
    });
  }
  if (requirePlatform) {
    filtered = filtered.filter((d) => {
      const platforms: unknown = (d as unknown as { platforms?: unknown }).platforms;
      const list = Array.isArray(platforms) ? (platforms as unknown[]).map(String) : [];
      return list.some((p) => p.toLowerCase() === String(requirePlatform).toLowerCase());
    });
  }

  // use hoisted toServiceStrict

  return {
    total,
    page,
    size,
    results: filtered.map((d) => ({
      id: d.id,
      doi: d.doi || undefined,
      license: d.license || undefined,
      sourceSystem: (d as DatasetWithRelations).sourceSystem || undefined,
      title: d.title,
      publisher: d.publisher || undefined,
      abstract: d.abstract || undefined,
      time: { start: d.timeStart?.toISOString(), end: d.timeEnd?.toISOString() },
      spatial: { bbox: [d.bboxMinX, d.bboxMinY, d.bboxMaxX, d.bboxMaxY] as [number, number, number, number] | undefined },
      variables: d.variables.map((v) => v.name),
      distributions: d.distributions.map((dist) => ({ url: dist.url, format: dist.format, service: toServiceStrict(dist.accessService) })),
    })),
  };
}
