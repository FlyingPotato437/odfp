import { executeSearch as dbSearch } from "@/lib/search";
import type { SearchQuery, SearchResult } from "@/lib/types";
import { semanticSearch } from "@/lib/ai/indexer";
import { prisma } from "@/lib/db";
import type { Dataset, Variable, Distribution } from "@prisma/client";
import { expandScientificQuery } from "@/lib/ai/scientific-expansion";

type DatasetWithRelations = Dataset & {
  variables: Variable[];
  distributions: Distribution[];
};

export function rrfOrder(lex: SearchResult, sem: Array<{ id: string; score: number }>, k = 100): string[] {
  const rrf: Map<string, number> = new Map();
  const kRR = 60;
  // Lexical ranks
  lex.results.forEach((r, i) => {
    const prev = rrf.get(r.id) || 0;
    rrf.set(r.id, prev + 1 / (kRR + i + 1));
  });
  // Semantic ranks
  sem.forEach((s, i) => {
    const prev = rrf.get(s.id) || 0;
    rrf.set(s.id, prev + 1 / (kRR + i + 1));
  });
  // Sort by rrf score
  return Array.from(rrf.entries()).sort((a, b) => b[1] - a[1]).slice(0, k).map(([id]) => id);
}

export async function hybridSearch(query: SearchQuery): Promise<SearchResult> {
  // Expand query to improve both lexical sorting and semantic recall
  const hasQ = Boolean(query.q && query.q.trim());
  const expansion = hasQ ? await expandScientificQuery(query.q!.trim()) : null;
  const enrichedSemQuery = hasQ
    ? [query.q!.trim(), (expansion?.scientificSynonyms || []).slice(0, 6).join(" "), (expansion?.locationVariants || []).slice(0, 6).join(" ")]
        .filter(Boolean).join(" ")
    : "";
  const enrichedVariables = Array.from(new Set([...(query.variables || []), ...((expansion?.suggestedVariables || []).slice(0, 10))]));

  const [lex] = await Promise.all([
    dbSearch({ ...query, variables: enrichedVariables.length ? enrichedVariables : query.variables, page: 1, size: Math.max(query.size ?? 20, 150) }),
  ]);
  // Run semantic on the enriched query if present
  let sem: Array<{ id: string; score: number }> = [];
  if (hasQ) {
    try {
      sem = await semanticSearch(enrichedSemQuery, 150);
    } catch {
      sem = [];
    }
  }
  const kCandidate = Math.min((lex.results.length + sem.length) || 100, 600);
  const rankedIds = rrfOrder(lex, sem, Math.max(kCandidate, query.size ?? 20));

  // Hydrate: prefer lexical objects; fetch missing ids from DB
  const byIdLex = new Map(lex.results.map(r => [r.id, r]));
  const missingIds = rankedIds.filter(id => !byIdLex.has(id));
  type DatasetWithRel = Dataset & { variables: Variable[]; distributions: Distribution[] };
  let fetched: DatasetWithRel[] = [];
  if (missingIds.length > 0) {
    fetched = await prisma.dataset.findMany({ where: { id: { in: missingIds } }, include: { variables: true, distributions: true } });
  }
  const byIdFetched = new Map(fetched.map(d => [d.id, d]));

  const validServices = ["HTTP", "OPeNDAP", "THREDDS", "ERDDAP", "FTP", "S3"] as const;
  type Service = typeof validServices[number];
  const toServiceStrict = (s: string): Service => ((validServices as readonly string[]).includes(s) ? (s as Service) : "HTTP");

  const hydrated: SearchResult["results"] = rankedIds
    .map((id) => {
      const fromLex = byIdLex.get(id);
      if (fromLex) return fromLex;
      const d = byIdFetched.get(id);
      if (!d) return undefined;
      return {
        id: d.id,
        doi: d.doi || undefined,
        license: (d as DatasetWithRelations).license || undefined,
        sourceSystem: (d as DatasetWithRelations).sourceSystem || undefined,
        title: d.title,
        publisher: d.publisher || undefined,
        abstract: (d as DatasetWithRelations).abstract || undefined,
        time: { start: d.timeStart?.toISOString(), end: d.timeEnd?.toISOString() },
        spatial: { bbox: [d.bboxMinX, d.bboxMinY, d.bboxMaxX, d.bboxMaxY] as [number, number, number, number] | undefined },
        variables: d.variables.map((v) => v.name),
        distributions: d.distributions.map((dist) => ({ url: dist.url, format: dist.format, service: toServiceStrict(dist.accessService) })),
      };
    })
    .filter(Boolean) as SearchResult["results"];

  // Final re-ranking with domain-aware boosts
  const nowYear = new Date().getUTCFullYear();
  const tokens = new Set((enrichedVariables.map(v => v.toLowerCase()) || []));
  const scored = hydrated.map((r, i) => {
    // Base score from initial fused order (RRf proxy)
    let score = 1 / (1 + i);
    // Boost by service quality (prefer programmatic access)
    const services = (r.distributions || []).map(d => d.service);
    if (services.includes('ERDDAP')) score += 0.25;
    if (services.includes('OPeNDAP')) score += 0.2;
    if (services.includes('THREDDS')) score += 0.1;
    // Enhanced variable relevance boost with semantic matching
    const varNames = (r.variables || []).map(v => v.toLowerCase());
    let varScore = 0;
    
    // Direct variable name matches (highest weight)
    const exactMatches = varNames.filter(v => Array.from(tokens).some(t => v === t)).length;
    varScore += exactMatches * 0.15;
    
    // Partial variable name matches  
    const partialMatches = varNames.filter(v => Array.from(tokens).some(t => v.includes(t) || t.includes(v))).length;
    varScore += partialMatches * 0.05;
    
    // Oceanographic term semantic matching
    const oceanographicTerms = {
      'sst': ['sea_surface_temperature', 'surface_temperature', 'temp'],
      'sss': ['sea_surface_salinity', 'surface_salinity', 'salinity'],
      'chlorophyll': ['chlor', 'chl', 'chlorophyll_a'],
      'wind': ['wind_speed', 'wind_direction', 'u_wind', 'v_wind'],
      'wave': ['significant_wave_height', 'wave_period', 'wave_direction'],
      'current': ['sea_water_velocity', 'current_speed', 'current_direction'],
      'ice': ['sea_ice_concentration', 'sea_ice_thickness', 'ice_coverage']
    };
    
    for (const [term, synonyms] of Object.entries(oceanographicTerms)) {
      if (Array.from(tokens).some(t => t.includes(term))) {
        const semanticMatches = varNames.filter(v => 
          synonyms.some(syn => v.includes(syn))
        ).length;
        varScore += semanticMatches * 0.08;
      }
    }
    
    score += Math.min(0.4, varScore);
    // Recency proxy using time end
    const endYear = r.time?.end ? new Date(r.time.end).getUTCFullYear() : undefined;
    if (endYear && Number.isFinite(endYear)) {
      const age = Math.max(0, nowYear - endYear);
      score += Math.max(0, 0.25 - Math.min(0.25, age * 0.03));
    }
    // Enhanced publisher/source credibility boost  
    const pub = (r.publisher || '').toLowerCase();
    // Tier 1: Primary authoritative sources
    if (/noaa|ncei|ncep|nasa|copernicus/.test(pub)) score += 0.15;
    // Tier 2: Major research institutions  
    else if (/whoi|scripps|mbari|imos|ifremer|jamstec/.test(pub)) score += 0.12;
    // Tier 3: Regional observing systems
    else if (/glos|neracoos|secoora|gcoos|hakai/.test(pub)) score += 0.08;
    // Tier 4: Other scientific institutions
    else if (/university|institute|marine|ocean|fisheries/.test(pub)) score += 0.05;
    // DOI / license openness boosts
    if (r.doi) score += 0.05;
    const lic = (r.license || '').toLowerCase();
    if (/(cc|creative commons|odc|public|noaa open)/.test(lic)) score += 0.05;
    // Enhanced query term matching with scientific context
    if (query.q && query.q.trim()) {
      const ql = query.q.trim().toLowerCase();
      const title = (r.title || '').toLowerCase();
      const abstract = (r.abstract || '').toLowerCase();
      
      // Exact phrase matches get highest boost
      if (title.includes(ql)) score += 0.12;
      if (abstract.includes(ql)) score += 0.08;
      
      // Individual word matches  
      const queryWords = ql.split(/\s+/).filter(w => w.length > 2);
      const titleWords = title.split(/\s+/);
      const abstractWords = abstract.split(/\s+/);
      
      const titleMatches = queryWords.filter(qw => 
        titleWords.some(tw => tw.includes(qw) || qw.includes(tw))
      ).length;
      const abstractMatches = queryWords.filter(qw => 
        abstractWords.some(aw => aw.includes(qw) || qw.includes(aw))
      ).length;
      
      score += (titleMatches / Math.max(1, queryWords.length)) * 0.06;
      score += (abstractMatches / Math.max(1, queryWords.length)) * 0.04;
    }
    
    // Dataset completeness factors
    let completenessBoost = 0;
    if (r.spatial?.bbox) completenessBoost += 0.03;
    if (r.time?.start && r.time?.end) completenessBoost += 0.03;
    if (r.variables && r.variables.length > 5) completenessBoost += 0.02;
    if (r.distributions && r.distributions.length > 1) completenessBoost += 0.02;
    score += completenessBoost;
    return { r, score };
  }).sort((a,b) => b.score - a.score).map(x => x.r);

  const total = scored.length;
  const page = query.page ?? 1;
  const size = query.size ?? 20;
  const start = (page - 1) * size;
  const pageItems = scored.slice(start, start + size);
  return { total, page, size, results: pageItems };
}
