// Global ERDDAP server connector for accessing worldwide oceanographic data
// Connects to major ERDDAP servers beyond NOAA

import { fetchErddapAllDatasets, fetchErddapInfo } from './erddap';

// Major ERDDAP servers worldwide
export const GLOBAL_ERDDAP_SERVERS = {
  // NOAA (already covered but included for completeness)
  'NOAA_COASTWATCH': 'https://coastwatch.pfeg.noaa.gov',
  'NOAA_UPWELL': 'https://upwell.pfeg.noaa.gov',
  
  // International servers
  'EMODnet_PHYSICS': 'https://erddap.emodnet-physics.eu',
  'IFREMER': 'https://data-sextant.ifremer.fr',
  'BCCFISHERIES': 'https://data.pac-dfo.gc.ca',
  'IMOS_AUSTRALIA': 'https://thredds.aodn.org.au',
  'MARINE_COPERNICUS': 'https://nrt.cmems-du.eu',
  'CORIOLIS': 'https://data.coriolis.eu.org',
  'HAKAI': 'https://goose.hakai.org',
  
  // Academic and research institutions
  'SCRIPPS_IO': 'https://sio-argo.ucsd.edu',
  'WHOI': 'https://erddap.whoi.edu',
  'MBARI': 'https://dods.mbari.org',
  'SOCIB': 'https://api.socib.es',
  'PUERTOS_ESPANA': 'https://portus.puertos.es'
};

export interface GlobalErddapDataset {
  serverId: string;
  serverName: string;
  serverUrl: string;
  datasetId: string;
  title: string;
  summary?: string;
  institution?: string;
  variables: Array<{
    name: string;
    standard_name?: string;
    units?: string;
    long_name?: string;
  }>;
  spatial?: {
    bbox: [number, number, number, number];
  };
  temporal?: {
    start: string;
    end: string;
  };
  accessUrls: Array<{
    type: 'data' | 'metadata' | 'preview';
    format: string;
    url: string;
  }>;
}

export async function fetchGlobalErddapData(
  servers: Record<string, string> = GLOBAL_ERDDAP_SERVERS,
  maxDatasetsPerServer: number = 50
): Promise<GlobalErddapDataset[]> {
  const allDatasets: GlobalErddapDataset[] = [];
  
  // Process servers in parallel but limit concurrency
  const serverEntries = Object.entries(servers);
  const batchSize = 3; // Process 3 servers at a time
  
  for (let i = 0; i < serverEntries.length; i += batchSize) {
    const batch = serverEntries.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async ([serverId, serverUrl]) => {
      try {
        console.log(`Fetching from ${serverId}: ${serverUrl}`);
        
        // Get dataset list
        const datasets = await fetchErddapAllDatasets(serverUrl);
        const limitedDatasets = datasets.slice(0, maxDatasetsPerServer);
        
        // Get detailed info for each dataset (with rate limiting)
        const detailedDatasets: GlobalErddapDataset[] = [];
        
        for (let j = 0; j < limitedDatasets.length; j++) {
          try {
            // Add delay to avoid overwhelming servers
            if (j > 0 && j % 10 === 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            const datasetSummary = limitedDatasets[j];
            const info = await fetchErddapInfo(serverUrl, datasetSummary.datasetID);
            
            // Build access URLs
            const accessUrls = [
              {
                type: 'data' as const,
                format: 'NetCDF',
                url: `${serverUrl}/erddap/tabledap/${datasetSummary.datasetID}.nc`
              },
              {
                type: 'data' as const,
                format: 'CSV',
                url: `${serverUrl}/erddap/tabledap/${datasetSummary.datasetID}.csv`
              },
              {
                type: 'metadata' as const,
                format: 'JSON',
                url: `${serverUrl}/erddap/info/${datasetSummary.datasetID}/index.json`
              },
              {
                type: 'preview' as const,
                format: 'HTML',
                url: `${serverUrl}/erddap/tabledap/${datasetSummary.datasetID}.graph`
              }
            ];
            
            detailedDatasets.push({
              serverId,
              serverName: getServerDisplayName(serverId),
              serverUrl,
              datasetId: datasetSummary.datasetID,
              title: datasetSummary.title || datasetSummary.datasetID,
              summary: datasetSummary.summary,
              institution: datasetSummary.institution,
              variables: info.variables,
              spatial: info.bbox ? { bbox: info.bbox } : undefined,
              temporal: info.timeStart && info.timeEnd ? {
                start: info.timeStart,
                end: info.timeEnd
              } : undefined,
              accessUrls
            });
            
          } catch (error) {
            console.warn(`Failed to get info for dataset ${limitedDatasets[j].datasetID} from ${serverId}:`, error);
          }
        }
        
        return detailedDatasets;
        
      } catch (error) {
        console.error(`Failed to fetch from ${serverId} (${serverUrl}):`, error);
        return [];
      }
    });
    
    // Wait for batch to complete
    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(datasets => allDatasets.push(...datasets));
    
    // Delay between batches
    if (i + batchSize < serverEntries.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return allDatasets;
}

function getServerDisplayName(serverId: string): string {
  const names: Record<string, string> = {
    'NOAA_COASTWATCH': 'NOAA CoastWatch',
    'NOAA_UPWELL': 'NOAA Upwelling',
    'EMODnet_PHYSICS': 'EMODnet Physics',
    'IFREMER': 'IFREMER France',
    'BCCFISHERIES': 'Fisheries and Oceans Canada',
    'IMOS_AUSTRALIA': 'IMOS Australia',
    'MARINE_COPERNICUS': 'Copernicus Marine',
    'CORIOLIS': 'Coriolis France',
    'HAKAI': 'Hakai Institute',
    'SCRIPPS_IO': 'Scripps Institution',
    'WHOI': 'Woods Hole Oceanographic Institution',
    'MBARI': 'Monterey Bay Aquarium Research Institute',
    'SOCIB': 'SOCIB Balearic Islands',
    'PUERTOS_ESPANA': 'Puertos del Estado Spain'
  };
  
  return names[serverId] || serverId.replace(/_/g, ' ');
}

// Transform global ERDDAP dataset to ODFP format
export function transformGlobalErddapDataset(dataset: GlobalErddapDataset) {
  return {
    id: `${dataset.serverId.toLowerCase()}:${dataset.datasetId}`,
    title: dataset.title,
    abstract: dataset.summary,
    publisher: dataset.serverName,
    sourceSystem: 'ERDDAP',
    timeStart: dataset.temporal?.start ? new Date(dataset.temporal.start) : undefined,
    timeEnd: dataset.temporal?.end ? new Date(dataset.temporal.end) : undefined,
    bboxMinX: dataset.spatial?.bbox[0],
    bboxMinY: dataset.spatial?.bbox[1],
    bboxMaxX: dataset.spatial?.bbox[2], 
    bboxMaxY: dataset.spatial?.bbox[3],
    variables: dataset.variables.map(v => ({
      name: v.name,
      standardName: v.standard_name,
      units: v.units,
      longName: v.long_name
    })),
    distributions: dataset.accessUrls.map(access => ({
      url: access.url,
      accessService: 'ERDDAP',
      format: access.format
    }))
  };
}