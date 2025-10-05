// Global ERDDAP server connector for accessing worldwide oceanographic data
// Connects to major ERDDAP servers beyond NOAA

import { fetchErddapAllDatasets, fetchErddapInfo } from './erddap';

// Comprehensive ERDDAP servers worldwide for maximum oceanographic data coverage
export const GLOBAL_ERDDAP_SERVERS = {
  // NOAA - Primary US oceanographic data sources
  'NOAA_COASTWATCH': 'https://coastwatch.pfeg.noaa.gov',
  'NOAA_UPWELL': 'https://upwell.pfeg.noaa.gov', 
  'NOAA_NCEI_ERDDAP': 'https://data.nodc.noaa.gov',
  'NOAA_OSMC': 'https://osmc.noaa.gov',
  
  // European Marine Data Infrastructure
  'EMODnet_PHYSICS': 'https://erddap.emodnet-physics.eu',
  'EMODnet_CHEMISTRY': 'https://erddap.emodnet-chemistry.eu',
  'IFREMER': 'https://data-sextant.ifremer.fr',
  'MARINE_COPERNICUS': 'https://nrt.cmems-du.eu',
  'CORIOLIS': 'https://data.coriolis.eu.org',
  'BSH_GERMANY': 'https://erddap.bsh.de',
  'IMR_NORWAY': 'https://erddap.imr.no',
  
  // Asia-Pacific Region  
  'IMOS_AUSTRALIA': 'https://thredds.aodn.org.au',
  'JAMSTEC_JAPAN': 'https://www.godac.jamstec.go.jp',
  'KIOST_KOREA': 'https://erddap.kiost.ac.kr',
  'JMA_JAPAN': 'https://ds.data.jma.go.jp',
  
  // North America - Canada & Research Institutions
  'BCCFISHERIES': 'https://data.pac-dfo.gc.ca',
  'HAKAI': 'https://goose.hakai.org',
  'MEDS_CANADA': 'https://www.meds-sdmm.dfo-mpo.gc.ca',
  
  // US Academic & Research Institutions
  'SCRIPPS_IO': 'https://sio-argo.ucsd.edu',
  'WHOI': 'https://erddap.whoi.edu', 
  'MBARI': 'https://dods.mbari.org',
  'RUTGERS': 'https://rucool.marine.rutgers.edu',
  'AXIOMDATASCIENCE': 'https://data.axiomdatascience.com',
  
  // Regional Ocean Observing Systems (IOOS)
  'GLOS': 'https://data.glos.us',
  'NERACOOS': 'https://www.neracoos.org',
  'SECOORA': 'https://erddap.secoora.org',
  'GCOOS': 'https://data.gcoos.org',
  
  // International & Multi-national
  'SOCIB': 'https://api.socib.es',
  'PUERTOS_ESPANA': 'https://portus.puertos.es',
  'MARINE_IE': 'https://erddap.marine.ie',
  'OOI': 'https://ooinet.oceanobservatories.org',
  
  // Specialized Climate & Satellite Data
  'PODAAC_NASA': 'https://podaac-opendap.jpl.nasa.gov',
  'GHRSST': 'https://podaac-opendap.jpl.nasa.gov',
  'REMSS': 'https://data.remss.com'
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
            
            // Build access URLs based on dataset structure
            const isGriddap = datasetSummary.dataStructure === 'griddap' || info.variables.some(v =>
              v.name && ['longitude', 'latitude', 'time'].includes(v.name.toLowerCase())
            );
            const dataService = isGriddap ? 'griddap' : 'tabledap';

            // Normalize server URL - ensure it ends with /erddap but no double slashes
            const normalizedUrl = serverUrl.replace(/\/+$/, ''); // Remove trailing slashes
            const baseErddapUrl = normalizedUrl.endsWith('/erddap') ? normalizedUrl : `${normalizedUrl}/erddap`;

            // Use .html for interactive data access (always works)
            // Users can specify constraints and download from the form
            const accessUrls = [
              {
                type: 'data' as const,
                format: 'HTML',
                url: `${baseErddapUrl}/${dataService}/${datasetSummary.datasetID}.html`
              },
              {
                type: 'preview' as const,
                format: 'Graph',
                url: `${baseErddapUrl}/${dataService}/${datasetSummary.datasetID}.graph`
              },
              {
                type: 'metadata' as const,
                format: 'JSON',
                url: `${baseErddapUrl}/info/${datasetSummary.datasetID}/index.json`
              },
              {
                type: 'data' as const,
                format: 'DDS',
                url: `${baseErddapUrl}/${dataService}/${datasetSummary.datasetID}.dds`
              }
            ];

            // Add WMS if griddap (spatial data)
            if (isGriddap) {
              accessUrls.push({
                type: 'metadata' as const,
                format: 'WMS',
                url: `${baseErddapUrl}/wms/${datasetSummary.datasetID}/request?service=WMS&version=1.3.0&request=GetCapabilities`
              });
            }
            
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
    // NOAA
    'NOAA_COASTWATCH': 'NOAA CoastWatch West Coast',
    'NOAA_UPWELL': 'NOAA Upwelling Research',
    'NOAA_NCEI_ERDDAP': 'NOAA National Centers for Environmental Information',
    'NOAA_OSMC': 'NOAA Observing System Monitoring Center',
    
    // European
    'EMODnet_PHYSICS': 'EMODnet Physics',
    'EMODnet_CHEMISTRY': 'EMODnet Chemistry',
    'IFREMER': 'IFREMER France',
    'MARINE_COPERNICUS': 'Copernicus Marine Environment Monitoring Service',
    'CORIOLIS': 'Coriolis Oceanographic Data Center',
    'BSH_GERMANY': 'German Maritime and Hydrographic Agency',
    'IMR_NORWAY': 'Institute of Marine Research Norway',
    
    // Asia-Pacific
    'IMOS_AUSTRALIA': 'Integrated Marine Observing System Australia',
    'JAMSTEC_JAPAN': 'Japan Agency for Marine-Earth Science and Technology',
    'KIOST_KOREA': 'Korea Institute of Ocean Science and Technology', 
    'JMA_JAPAN': 'Japan Meteorological Agency',
    
    // North America
    'BCCFISHERIES': 'Fisheries and Oceans Canada Pacific',
    'HAKAI': 'Hakai Institute',
    'MEDS_CANADA': 'Marine Environmental Data Service Canada',
    
    // US Academic
    'SCRIPPS_IO': 'Scripps Institution of Oceanography',
    'WHOI': 'Woods Hole Oceanographic Institution',
    'MBARI': 'Monterey Bay Aquarium Research Institute',
    'RUTGERS': 'Rutgers University Coastal Ocean Observation Lab',
    'AXIOMDATASCIENCE': 'Axiom Data Science',
    
    // Regional Ocean Observing  
    'GLOS': 'Great Lakes Observing System',
    'NERACOOS': 'Northeastern Regional Association of Coastal Ocean Observing Systems',
    'SECOORA': 'Southeast Coastal Ocean Observing Regional Association',
    'GCOOS': 'Gulf of Mexico Coastal Ocean Observing System',
    
    // International
    'SOCIB': 'Balearic Islands Coastal Observing and Forecasting System',
    'PUERTOS_ESPANA': 'Puertos del Estado Spain',
    'MARINE_IE': 'Marine Institute Ireland',
    'OOI': 'Ocean Observatories Initiative',
    
    // Satellite/Climate
    'PODAAC_NASA': 'NASA Physical Oceanography Distributed Active Archive Center',
    'GHRSST': 'Group for High Resolution Sea Surface Temperature',
    'REMSS': 'Remote Sensing Systems'
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