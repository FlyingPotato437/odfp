import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { fetchGlobalErddapData, transformGlobalErddapDataset, GLOBAL_ERDDAP_SERVERS } from "@/lib/connectors/global-erddap";
import { updateDatasetEmbedding } from "@/lib/embeddings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for global ingestion

export async function POST(req: NextRequest) {
  if (!isAdmin(req as unknown as Request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const maxDatasetsPerServer = typeof body.maxPerServer === "number" ? 
    Math.min(body.maxPerServer, 100) : 25; // Conservative default
  const selectedServers = Array.isArray(body.servers) ? 
    body.servers : Object.keys(GLOBAL_ERDDAP_SERVERS).slice(0, 5); // Limit to 5 servers
  const embed: boolean = body.embed === true;
  
  const serverUrls: Record<string, string> = {};
  selectedServers.forEach((serverId: string) => {
    if (GLOBAL_ERDDAP_SERVERS[serverId as keyof typeof GLOBAL_ERDDAP_SERVERS]) {
      serverUrls[serverId] = GLOBAL_ERDDAP_SERVERS[serverId as keyof typeof GLOBAL_ERDDAP_SERVERS];
    }
  });

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let embeddedOk = 0;
  let embeddedFail = 0;
  const errors: string[] = [];

  try {
    console.log(`Starting global ERDDAP ingestion from ${Object.keys(serverUrls).length} servers...`);
    
    const globalDatasets = await fetchGlobalErddapData(serverUrls, maxDatasetsPerServer);
    console.log(`Fetched ${globalDatasets.length} datasets from global ERDDAP servers`);

    // Process datasets in batches to avoid overwhelming the database
    const batchSize = 10;
    for (let i = 0; i < globalDatasets.length; i += batchSize) {
      const batch = globalDatasets.slice(i, i + batchSize);
      
      for (const globalDataset of batch) {
        try {
          const odfpDataset = transformGlobalErddapDataset(globalDataset);
          
          // Check if dataset already exists
          const existing = await prisma.dataset.findUnique({
            where: { id: odfpDataset.id }
          });

          if (existing) {
            // Update existing dataset
            await prisma.dataset.update({
              where: { id: odfpDataset.id },
              data: {
                title: odfpDataset.title,
                abstract: odfpDataset.abstract,
                publisher: odfpDataset.publisher,
                timeStart: odfpDataset.timeStart,
                timeEnd: odfpDataset.timeEnd,
                bboxMinX: odfpDataset.bboxMinX,
                bboxMinY: odfpDataset.bboxMinY,
                bboxMaxX: odfpDataset.bboxMaxX,
                bboxMaxY: odfpDataset.bboxMaxY,
                variables: {
                  deleteMany: {},
                  create: odfpDataset.variables
                },
                distributions: {
                  deleteMany: {},
                  create: odfpDataset.distributions
                }
              }
            });
            totalUpdated++;
          } else {
            // Create new dataset
            await prisma.dataset.create({
              data: {
                id: odfpDataset.id,
                title: odfpDataset.title,
                abstract: odfpDataset.abstract,
                publisher: odfpDataset.publisher,
                sourceSystem: odfpDataset.sourceSystem,
                timeStart: odfpDataset.timeStart,
                timeEnd: odfpDataset.timeEnd,
                bboxMinX: odfpDataset.bboxMinX,
                bboxMinY: odfpDataset.bboxMinY,
                bboxMaxX: odfpDataset.bboxMaxX,
                bboxMaxY: odfpDataset.bboxMaxY,
                variables: {
                  create: odfpDataset.variables
                },
                distributions: {
                  create: odfpDataset.distributions
                }
              }
            });
            totalCreated++;
          }

          // Generate embeddings if requested
          if (embed) {
            const embeddingText = [
              odfpDataset.title,
              odfpDataset.abstract || '',
              odfpDataset.publisher || '',
              odfpDataset.variables.map(v => v.name).join(', ')
            ].filter(Boolean).join('\n');

            const embeddingSuccess = await updateDatasetEmbedding(odfpDataset.id, embeddingText);
            if (embeddingSuccess) {
              embeddedOk++;
            } else {
              embeddedFail++;
            }
          }

          totalProcessed++;

          // Progress logging
          if (totalProcessed % 20 === 0) {
            console.log(`Processed ${totalProcessed}/${globalDatasets.length} datasets...`);
          }

        } catch (error) {
          const errorMsg = `Failed to process dataset ${globalDataset.datasetId} from ${globalDataset.serverId}: ${error}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }
      
      // Small delay between batches
      if (i + batchSize < globalDatasets.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Global ERDDAP ingestion complete: ${totalCreated} created, ${totalUpdated} updated`);

    return Response.json({
      success: true,
      summary: {
        totalProcessed,
        totalCreated,
        totalUpdated,
        embeddedOk,
        embeddedFail,
        serversProcessed: Object.keys(serverUrls),
        errorCount: errors.length
      },
      errors: errors.slice(0, 10) // Return first 10 errors
    });

  } catch (error) {
    console.error("Global ERDDAP ingestion failed:", error);
    return Response.json({
      success: false,
      error: "Global ERDDAP ingestion failed",
      details: error instanceof Error ? error.message : String(error),
      summary: {
        totalProcessed,
        totalCreated,
        totalUpdated,
        embeddedOk,
        embeddedFail,
        errorCount: errors.length
      },
      errors: errors.slice(0, 10)
    }, { status: 500 });
  }
}