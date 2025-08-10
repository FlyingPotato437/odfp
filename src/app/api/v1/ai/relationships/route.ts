import { prisma } from "@/lib/db";
import { discoverDatasetRelationships } from "@/lib/ai/scientific-expansion";
import { semanticSearch } from "@/lib/ai/indexer";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const datasetId = typeof body.datasetId === "string" ? body.datasetId : "";
  const limit = typeof body.limit === "number" ? Math.min(body.limit, 50) : 10;
  
  if (!datasetId) {
    return Response.json({ error: "Missing datasetId" }, { status: 400 });
  }

  try {
    // Get the target dataset
    const targetDataset = await prisma.dataset.findUnique({
      where: { id: datasetId },
      include: { variables: true, distributions: true }
    });

    if (!targetDataset) {
      return Response.json({ error: "Dataset not found" }, { status: 404 });
    }

    // Get contextual datasets for relationship analysis
    const allDatasets = await prisma.dataset.findMany({
      select: {
        id: true,
        title: true,
        publisher: true,
        timeStart: true,
        timeEnd: true,
        bboxMinX: true,
        bboxMinY: true,
        bboxMaxX: true,
        bboxMaxY: true,
        variables: {
          select: { name: true }
        }
      },
      take: 1000 // Reasonable subset for analysis
    });

    // Transform for relationship analysis
    const datasetsForAnalysis = allDatasets.map(d => ({
      id: d.id,
      title: d.title,
      variables: d.variables.map(v => v.name),
      spatial: (d.bboxMinX !== null && d.bboxMinY !== null && d.bboxMaxX !== null && d.bboxMaxY !== null) ? {
        bbox: [d.bboxMinX, d.bboxMinY, d.bboxMaxX, d.bboxMaxY]
      } : undefined,
      temporal: d.timeStart ? {
        start: d.timeStart.toISOString(),
        end: d.timeEnd?.toISOString()
      } : undefined
    }));

    // Discover relationships
    const relationships = await discoverDatasetRelationships(
      datasetId,
      datasetsForAnalysis
    );

    // Also use semantic search for content-based relationships
    const searchText = `${targetDataset.title} ${targetDataset.abstract || ''} ${targetDataset.variables.map(v => v.name).join(' ')}`;
    const semanticRelated = await semanticSearch(searchText, 15);

    // Merge and deduplicate
    const allRelatedIds = new Set([
      ...relationships.map(r => r.datasetId),
      ...semanticRelated.map(s => s.id).filter(id => id !== datasetId)
    ]);

    // Get full dataset info for results
    const relatedDatasets = await prisma.dataset.findMany({
      where: { id: { in: Array.from(allRelatedIds) } },
      include: { variables: true, distributions: true },
      take: limit
    });

    // Combine relationship scores
    const results = relatedDatasets.map(dataset => {
      const structuralRel = relationships.find(r => r.datasetId === dataset.id);
      const semanticRel = semanticRelated.find(s => s.id === dataset.id);
      
      const combinedScore = (structuralRel?.score || 0) * 0.6 + (semanticRel?.score || 0) * 0.4;
      
      return {
        dataset: {
          id: dataset.id,
          title: dataset.title,
          publisher: dataset.publisher,
          timeStart: dataset.timeStart?.toISOString(),
          timeEnd: dataset.timeEnd?.toISOString(),
          spatial: {
            bbox: dataset.bboxMinX !== null 
              ? [dataset.bboxMinX, dataset.bboxMinY, dataset.bboxMaxX, dataset.bboxMaxY]
              : null
          },
          variables: dataset.variables.map(v => v.name),
          distributions: dataset.distributions.map(d => ({
            url: d.url,
            format: d.format,
            accessService: d.accessService
          }))
        },
        relationship: {
          type: structuralRel?.relationshipType || 'semantic',
          score: combinedScore,
          explanation: structuralRel?.explanation || `Semantically related (${(semanticRel?.score || 0).toFixed(3)})`
        }
      };
    });

    // Sort by combined score
    results.sort((a, b) => b.relationship.score - a.relationship.score);

    return Response.json({
      targetDatasetId: datasetId,
      relationships: results.slice(0, limit),
      totalFound: results.length
    });

  } catch (error) {
    console.error("Relationship discovery error:", error);
    return Response.json(
      { error: "Failed to discover relationships" },
      { status: 500 }
    );
  }
}