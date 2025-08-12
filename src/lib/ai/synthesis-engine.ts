import { generateLLMAnswer } from "./gemini";
import { semanticSearch } from "./indexer";
import { prisma } from "@/lib/db";
import { expandScientificQuery, discoverDatasetRelationships } from "./scientific-expansion";

export interface DataSynthesis {
  query: string;
  synthesizedInsight: string;
  recommendedDatasets: Array<{
    id: string;
    title: string;
    relevanceReason: string;
    confidenceScore: number;
    dataQualityScore: number;
  }>;
  temporalAnalysis: {
    timeRange: string;
    temporalGaps: string[];
    seasonalityHints: string[];
  };
  spatialAnalysis: {
    coverage: string;
    spatialGaps: string[];
    resolutionNotes: string[];
  };
  crossDatasetInsights: string[];
  nextSteps: string[];
}

export interface DataQualityMetrics {
  completeness: number; // 0-1
  recency: number; // 0-1  
  spatialCoverage: number; // 0-1
  temporalCoverage: number; // 0-1
  variableRichness: number; // 0-1
  accessibilityScore: number; // 0-1
}

export async function assessDataQuality(dataset: {
  id: string;
  title: string;
  timeStart?: Date | null;
  timeEnd?: Date | null;
  bboxMinX?: number | null;
  bboxMaxX?: number | null;
  bboxMinY?: number | null;
  bboxMaxY?: number | null;
  variables: Array<{ name: string }>;
  distributions: Array<{ url: string; accessService: string; format: string }>;
  updatedAt: Date;
  doi?: string | null;
  publisher?: string | null;
  license?: string | null;
}): Promise<DataQualityMetrics> {
  
  const now = new Date();
  const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  // Recency score
  const recency = dataset.updatedAt > yearAgo ? 1.0 : 
                 Math.max(0, 1 - (now.getTime() - dataset.updatedAt.getTime()) / (365 * 24 * 60 * 60 * 1000 * 5));

  // Spatial coverage score
  const hasBbox = dataset.bboxMinX !== null && dataset.bboxMinY !== null && 
                  dataset.bboxMaxX !== null && dataset.bboxMaxY !== null;
  const spatialCoverage = hasBbox ? 
    Math.min(1.0, (Math.abs(dataset.bboxMaxX! - dataset.bboxMinX!) * 
                   Math.abs(dataset.bboxMaxY! - dataset.bboxMinY!)) / 10000) : 0.5;

  // Temporal coverage score
  const hasTime = dataset.timeStart && dataset.timeEnd;
  const temporalCoverage = hasTime ? 
    Math.min(1.0, (dataset.timeEnd!.getTime() - dataset.timeStart!.getTime()) / 
                  (365 * 24 * 60 * 60 * 1000 * 10)) : 0.5;

  // Variable richness (count + metadata depth if available)
  const varCountScore = Math.min(1.0, dataset.variables.length / 10);
  // Try to infer metadata depth when fields exist on variables
  const enrichedMetaCount = (dataset.variables as any[]).filter(v => v?.standard_name || v?.units || v?.long_name).length;
  const metaDepthScore = dataset.variables.length > 0 ? Math.min(1.0, enrichedMetaCount / Math.max(1, dataset.variables.length)) : 0;
  const variableRichness = Math.min(1.0, 0.7 * varCountScore + 0.3 * metaDepthScore);

  // Accessibility score
  const hasOPeNDAP = dataset.distributions.some(d => d.accessService === 'OPeNDAP');
  const hasERDDAP = dataset.distributions.some(d => d.accessService === 'ERDDAP');
  const hasNetCDF = dataset.distributions.some(d => d.format === 'NetCDF');
  const accessibilityScore = 0.3 + (hasOPeNDAP ? 0.3 : 0) + (hasERDDAP ? 0.2 : 0) + (hasNetCDF ? 0.2 : 0);

  // Completeness (basic heuristic + provenance)
  const completeness = [
    dataset.title ? 0.16 : 0,
    hasTime ? 0.16 : 0,
    hasBbox ? 0.16 : 0,
    dataset.variables.length > 0 ? 0.16 : 0,
    dataset.distributions.length > 0 ? 0.16 : 0,
    (dataset.doi || dataset.license || dataset.publisher) ? 0.2 : 0
  ].reduce((a, b) => a + b, 0);

  return {
    completeness,
    recency,
    spatialCoverage,
    temporalCoverage,
    variableRichness,
    accessibilityScore
  };
}

export async function synthesizeDataInsights(query: string): Promise<DataSynthesis> {
  try {
    // Expand the query scientifically
    const expansion = await expandScientificQuery(query);
    const enrichedQuery = [
      query,
      expansion.suggestedVariables.slice(0, 10).join(" "),
      expansion.locationVariants.slice(0, 8).join(" ")
    ].filter(Boolean).join(" ");
    
    // Find relevant datasets
    const semanticResults = await semanticSearch(enrichedQuery, 30);
    const datasetIds = semanticResults.map(r => r.id);
    
    // Get full dataset information
    const datasets = await prisma.dataset.findMany({
      where: { id: { in: datasetIds } },
      include: { variables: true, distributions: true },
      take: 20
    });

    // Assess data quality for each dataset
    const datasetsWithQuality = await Promise.all(
      datasets.map(async (dataset) => {
        const quality = await assessDataQuality(dataset);
        const overallQuality = Object.values(quality).reduce((a, b) => a + b, 0) / 6;
        return { dataset, quality, overallQuality };
      })
    );

    // Sort by combined relevance and quality
    const rankedDatasets = datasetsWithQuality
      .map((item, index) => ({
        ...item,
        relevanceScore: semanticResults[index]?.score || 0
      }))
      .sort((a, b) => (b.relevanceScore * 0.7 + b.overallQuality * 0.3) - 
                      (a.relevanceScore * 0.7 + a.overallQuality * 0.3));

    // Temporal analysis
    const timeRanges = datasets
      .filter(d => d.timeStart && d.timeEnd)
      .map(d => ({ start: d.timeStart!, end: d.timeEnd! }));
    
    const earliestStart = timeRanges.length > 0 ? 
      new Date(Math.min(...timeRanges.map(t => t.start.getTime()))) : null;
    const latestEnd = timeRanges.length > 0 ? 
      new Date(Math.max(...timeRanges.map(t => t.end.getTime()))) : null;

    // Temporal gaps (simple union-of-intervals, report gaps > 1 year)
    const temporalGaps: string[] = [];
    if (timeRanges.length > 1) {
      const sorted = timeRanges.sort((a, b) => a.start.getTime() - b.start.getTime());
      let curStart = sorted[0].start;
      let curEnd = sorted[0].end;
      for (let i = 1; i < sorted.length; i++) {
        const next = sorted[i];
        if (next.start.getTime() <= curEnd.getTime()) {
          if (next.end.getTime() > curEnd.getTime()) curEnd = next.end;
        } else {
          const gapYears = (next.start.getTime() - curEnd.getTime()) / (365 * 24 * 60 * 60 * 1000);
          if (gapYears > 1) temporalGaps.push(`${curEnd.getFullYear()}–${next.start.getFullYear()}`);
          curStart = next.start;
          curEnd = next.end;
        }
      }
    }
    const temporalAnalysis = {
      timeRange: earliestStart && latestEnd ? `${earliestStart.getFullYear()}-${latestEnd.getFullYear()}` : "Unknown",
      temporalGaps,
      seasonalityHints: expansion.temporalHints
    };

    // Spatial analysis
    const bboxes = datasets
      .filter(d => d.bboxMinX !== null && d.bboxMaxX !== null)
      .map(d => [d.bboxMinX!, d.bboxMinY!, d.bboxMaxX!, d.bboxMaxY!]);
    
    // Spatial analysis heuristics
    let spatialCoverage = "Limited spatial info";
    const spatialGaps: string[] = [];
    if (bboxes.length > 0) {
      const minX = Math.min(...bboxes.map(b => b[0]));
      const minY = Math.min(...bboxes.map(b => b[1]));
      const maxX = Math.max(...bboxes.map(b => b[2]));
      const maxY = Math.max(...bboxes.map(b => b[3]));
      spatialCoverage = `Approx bbox: [${minX.toFixed(1)}, ${minY.toFixed(1)}, ${maxX.toFixed(1)}, ${maxY.toFixed(1)}]`;
      // If there are multiple non-overlapping boxes, report potential gaps
      if (bboxes.length > 1) {
        const centers = bboxes.map(b => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]);
        let separatedPairs = 0;
        for (let i = 0; i < bboxes.length; i++) {
          for (let j = i + 1; j < bboxes.length; j++) {
            const overlap = !(bboxes[i][2] < bboxes[j][0] || bboxes[j][2] < bboxes[i][0] || bboxes[i][3] < bboxes[j][1] || bboxes[j][3] < bboxes[i][1]);
            if (!overlap) separatedPairs++;
          }
        }
        if (separatedPairs > 0) spatialGaps.push("Datasets cover disjoint spatial regions; integration may require mosaicking.");
      }
    }
    const spatialAnalysis = {
      coverage: spatialCoverage,
      spatialGaps,
      resolutionNotes: []
    };

    // Generate AI synthesis
    const summarizeDataset = (item: typeof rankedDatasets[number]) => {
      const d = item.dataset as any;
      const time = d.timeStart && d.timeEnd ? `${new Date(d.timeStart).getFullYear()}–${new Date(d.timeEnd).getFullYear()}` : "Unknown";
      const bbox = d.bboxMinX != null && d.bboxMinY != null && d.bboxMaxX != null && d.bboxMaxY != null
        ? `[${d.bboxMinX.toFixed?.(1) ?? d.bboxMinX}, ${d.bboxMinY.toFixed?.(1) ?? d.bboxMinY}, ${d.bboxMaxX.toFixed?.(1) ?? d.bboxMaxX}, ${d.bboxMaxY.toFixed?.(1) ?? d.bboxMaxY}]`
        : "Unknown";
      const vars = (d.variables || []).slice(0, 8).map((v: any) => {
        const name = v.name || '';
        const unit = v.units ? ` [${v.units}]` : '';
        const std = v.standardName ? ` (${v.standardName})` : '';
        return `${name}${std}${unit}`.trim();
      }).join(', ');
      const services = (d.distributions || []).map((x: any) => x.accessService || x.access_service).filter(Boolean);
      const svc = Array.from(new Set(services)).slice(0, 4).join(', ');
      const notes = d.abstract ? ` | Notes: ${String(d.abstract).slice(0, 160)}…` : '';
      const doi = d.doi ? ` | DOI: ${d.doi}` : '';
      const lic = d.license ? ` | License: ${d.license}` : '';
      return `• ${d.title} | Publisher: ${d.publisher || 'Unknown'} | Time: ${time} | BBOX: ${bbox} | Vars: ${vars || 'Unknown'} | Access: ${svc || 'Unknown'}${doi}${lic} | Quality ${(item.overallQuality * 100).toFixed(0)}% | Relevance ${(item.relevanceScore * 100).toFixed(0)}%${notes}`;
    };
    const contextText = rankedDatasets.slice(0, 10).map(summarizeDataset).join('\n');

    // Compute relationship-based synergy hints
    const relationshipInputs = rankedDatasets.slice(0, 10).map(x => ({
      id: x.dataset.id,
      title: x.dataset.title,
      variables: x.dataset.variables.map(v => v.name),
      spatial: (x.dataset.bboxMinX != null && x.dataset.bboxMinY != null && x.dataset.bboxMaxX != null && x.dataset.bboxMaxY != null)
        ? { bbox: [x.dataset.bboxMinX!, x.dataset.bboxMinY!, x.dataset.bboxMaxX!, x.dataset.bboxMaxY!] }
        : undefined,
      temporal: (x.dataset.timeStart && x.dataset.timeEnd) ? { start: x.dataset.timeStart.toISOString(), end: x.dataset.timeEnd.toISOString() } : undefined
    }));
    const relationshipMap: Record<string, { type: string; score: number; explanation: string }[]> = {};
    for (const d of relationshipInputs) {
      const rels = await discoverDatasetRelationships(d.id, relationshipInputs);
      relationshipMap[d.id] = rels.map(r => ({ type: r.relationshipType, score: r.score, explanation: r.explanation }));
    }

    const synthesisPrompt = `As an oceanographic data expert, provide a rigorous, non-speculative synthesis for this research query. If specific details are missing in the context, explicitly say "Unknown" and recommend how to verify from metadata.

Query: "${query}"
Scientific context: ${expansion.expandedTerms.join(', ')}

Available datasets:
${contextText}

Detected dataset relationships (heuristics):
${Object.entries(relationshipMap).slice(0,3).map(([k, v]) => `- ${k}: ${v.slice(0,2).map(x=>x.explanation).join('; ')}`).join('\n')}

Provide a comprehensive analysis covering:
1. Key datasets that best address this query
2. Data limitations and gaps
3. Temporal and spatial considerations  
4. Cross-dataset opportunities for combined analysis
5. Recommended next steps for research

Requirements:
- Cite concrete attributes from the context (time ranges, bbox, variables, access services) when possible.
- Distinguish between coverage vs. resolution; do not assume resolution without evidence.
- Call out missing variables critical to the topic and suggest proxies.
- Include a short rationale for top 3 datasets referencing variables and coverage.

Format as concise markdown with clear section headers.`;

    let synthesizedInsight = await generateLLMAnswer(synthesisPrompt);
    const aiUnavailable = /AI is not configured/i.test(synthesizedInsight || "");
    if (aiUnavailable) {
      const top = rankedDatasets.slice(0, 5);
      const bullets = top.map((x, i) => `- ${i + 1}. ${x.dataset.title} (${x.dataset.publisher || 'Unknown'}) — vars: ${x.dataset.variables.map(v => v.name).slice(0,4).join(', ') || 'Unknown'}; time: ${x.dataset.timeStart && x.dataset.timeEnd ? `${x.dataset.timeStart.getFullYear()}–${x.dataset.timeEnd.getFullYear()}` : 'Unknown'}`);
      synthesizedInsight = [
        `## Key Datasets`,
        bullets.join('\n'),
        `\n## Data Limitations and Gaps`,
        `- Variable details: ${top.some(x => x.dataset.variables.length === 0) ? 'Some datasets missing variable lists' : 'Most datasets list key variables'}`,
        temporalGaps.length > 0 ? `- Temporal gaps: ${temporalGaps.join(', ')}` : `- Temporal gaps: None detected above 1 year`,
        spatialAnalysis.spatialGaps.length > 0 ? `- Spatial gaps: ${spatialAnalysis.spatialGaps.join('; ')}` : `- Spatial gaps: Not evident from bbox` ,
        `\n## Temporal and Spatial Considerations`,
        `- Combined time range: ${temporalAnalysis.timeRange}`,
        `- Approx spatial coverage: ${spatialAnalysis.coverage}`,
        `\n## Cross-dataset Opportunities`,
        (Object.values(relationshipMap).flat().slice(0,5).map(r => `- ${r.explanation} (${r.type})`).join('\n') || '- Complementary variables and overlapping coverage'),
        `\n## Recommended Next Steps`,
        `- Examine metadata for variables, units, and coordinate grids`,
        `- Validate temporal/spatial alignment across top datasets`,
        `- Assess quality flags and missing values; define QC rules`,
        `- Prototype programmatic access and sample downloads`,
        `- Plan standardization (names, units, CRS) and integration`
      ].join('\n');
    }

    // Cross-dataset insights
    const crossInsights = Object.values(relationshipMap)
      .flat()
      .sort((a,b) => b.score - a.score)
      .slice(0,8)
      .map(r => `- ${r.explanation} (${r.type})`)
      .join('\n');

    return {
      query,
      synthesizedInsight,
      recommendedDatasets: rankedDatasets.slice(0, 8).map(item => {
        const varNames = item.dataset.variables.map(v => v.name.toLowerCase());
        const queryTerms = new Set([
          ...expansion.suggestedVariables.map(v => v.toLowerCase()),
          ...expansion.scientificSynonyms.map(v => v.toLowerCase()),
          ...expansion.expandedTerms.map(v => v.toLowerCase())
        ]);
        const matches = Array.from(new Set(varNames.filter(v => Array.from(queryTerms).some(t => v.includes(t) || t.includes(v))))).slice(0, 3);
        const timeStr = item.dataset.timeStart && item.dataset.timeEnd ? `${item.dataset.timeStart.getFullYear()}–${item.dataset.timeEnd.getFullYear()}` : "Unknown time";
        const reasonDetail = matches.length > 0 ? ` | Vars match: ${matches.join(', ')}` : "";
        return ({
          id: item.dataset.id,
          title: item.dataset.title,
          relevanceReason: `Relevance ${(item.relevanceScore * 100).toFixed(0)}% | Quality ${(item.overallQuality * 100).toFixed(0)}% | ${timeStr}${reasonDetail}`,
          confidenceScore: item.relevanceScore,
          dataQualityScore: item.overallQuality
        });
      }),
      temporalAnalysis,
      spatialAnalysis,
      crossDatasetInsights: crossInsights ? crossInsights.split('\n').filter(Boolean) : [],
      nextSteps: [
        "Examine metadata for variables, units, and coordinate grids",
        "Validate temporal/spatial alignment across top datasets",
        "Assess quality flags and missing values; define QC rules",
        "Prototype data access (e.g., ERDDAP/OPeNDAP) and sample downloads",
        "Plan standardization (names, units, CRS) and integration"
      ]
    };

  } catch (error) {
    console.error("Data synthesis error:", error);
    
    // Fallback synthesis
    return {
      query,
      synthesizedInsight: "Analysis temporarily unavailable. Please try individual dataset search.",
      recommendedDatasets: [],
      temporalAnalysis: { timeRange: "Unknown", temporalGaps: [], seasonalityHints: [] },
      spatialAnalysis: { coverage: "Unknown", spatialGaps: [], resolutionNotes: [] },
      crossDatasetInsights: [],
      nextSteps: ["Try simplified search terms", "Use map-based filtering", "Check individual datasets"]
    };
  }
}
