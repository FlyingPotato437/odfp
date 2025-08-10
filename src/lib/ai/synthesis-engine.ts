import { generateLLMAnswer } from "./gemini";
import { semanticSearch } from "./indexer";
import { prisma } from "@/lib/db";
import { expandScientificQuery } from "./scientific-expansion";

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

  // Variable richness
  const variableRichness = Math.min(1.0, dataset.variables.length / 10);

  // Accessibility score
  const hasOPeNDAP = dataset.distributions.some(d => d.accessService === 'OPeNDAP');
  const hasERDDAP = dataset.distributions.some(d => d.accessService === 'ERDDAP');
  const hasNetCDF = dataset.distributions.some(d => d.format === 'NetCDF');
  const accessibilityScore = 0.3 + (hasOPeNDAP ? 0.3 : 0) + (hasERDDAP ? 0.2 : 0) + (hasNetCDF ? 0.2 : 0);

  // Completeness (basic heuristic)
  const completeness = [
    dataset.title ? 0.2 : 0,
    hasTime ? 0.2 : 0,
    hasBbox ? 0.2 : 0,
    dataset.variables.length > 0 ? 0.2 : 0,
    dataset.distributions.length > 0 ? 0.2 : 0
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
    
    // Find relevant datasets
    const semanticResults = await semanticSearch(query, 20);
    const datasetIds = semanticResults.map(r => r.id);
    
    // Get full dataset information
    const datasets = await prisma.dataset.findMany({
      where: { id: { in: datasetIds } },
      include: { variables: true, distributions: true },
      take: 15
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

    const temporalAnalysis = {
      timeRange: earliestStart && latestEnd ? 
        `${earliestStart.getFullYear()}-${latestEnd.getFullYear()}` : "Unknown",
      temporalGaps: [], // TODO: implement gap analysis
      seasonalityHints: expansion.temporalHints
    };

    // Spatial analysis
    const bboxes = datasets
      .filter(d => d.bboxMinX !== null && d.bboxMaxX !== null)
      .map(d => [d.bboxMinX!, d.bboxMinY!, d.bboxMaxX!, d.bboxMaxY!]);
    
    const spatialAnalysis = {
      coverage: bboxes.length > 0 ? `${bboxes.length} spatial regions covered` : "Limited spatial info",
      spatialGaps: [], // TODO: implement spatial gap analysis
      resolutionNotes: []
    };

    // Generate AI synthesis
    const contextText = rankedDatasets.slice(0, 10).map(item => 
      `${item.dataset.title} (${item.dataset.publisher || 'Unknown'}) - Variables: ${item.dataset.variables.map(v => v.name).slice(0, 5).join(', ')} - Quality: ${(item.overallQuality * 100).toFixed(0)}%`
    ).join('\n');

    const synthesisPrompt = `As an oceanographic data expert, provide insights for this research query:

Query: "${query}"
Scientific context: ${expansion.expandedTerms.join(', ')}

Available datasets:
${contextText}

Provide a comprehensive analysis covering:
1. Key datasets that best address this query
2. Data limitations and gaps
3. Temporal and spatial considerations  
4. Cross-dataset opportunities for combined analysis
5. Recommended next steps for research

Keep response concise but technically accurate.`;

    const synthesizedInsight = await generateLLMAnswer(synthesisPrompt);

    // Cross-dataset insights
    const crossDatasetPrompt = `Identify potential synergies between these ocean datasets:
${contextText}

What complementary analysis opportunities exist when combining these datasets?`;
    
    const crossInsights = await generateLLMAnswer(crossDatasetPrompt);

    return {
      query,
      synthesizedInsight,
      recommendedDatasets: rankedDatasets.slice(0, 8).map(item => ({
        id: item.dataset.id,
        title: item.dataset.title,
        relevanceReason: `Relevance: ${(item.relevanceScore * 100).toFixed(0)}% | Quality: ${(item.overallQuality * 100).toFixed(0)}%`,
        confidenceScore: item.relevanceScore,
        dataQualityScore: item.overallQuality
      })),
      temporalAnalysis,
      spatialAnalysis,
      crossDatasetInsights: crossInsights.split('\n').filter(line => line.trim().length > 20),
      nextSteps: [
        "Download and examine data samples",
        "Check data formats and accessibility",
        "Assess temporal/spatial coverage gaps",
        "Consider data fusion opportunities",
        "Plan quality control procedures"
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