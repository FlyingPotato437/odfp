// Copernicus Marine Environment Monitoring Service (CMEMS) connector
// Provides comprehensive European ocean monitoring data

export interface CopernicusDataset {
  id: string;
  title: string;
  abstract?: string;
  spatialResolution?: string;
  temporalResolution?: string;
  variables: string[];
  geographicCoverage: {
    bbox?: [number, number, number, number];
    regions: string[];
  };
  temporalCoverage: {
    start?: string;
    end?: string;
  };
  accessUrls: Array<{
    protocol: string;
    url: string;
    format: string;
  }>;
}

export async function fetchCopernicusDatasets(
  apiBaseUrl: string = "https://data.marine.copernicus.eu/api",
  limit: number = 100
): Promise<CopernicusDataset[]> {
  const results: CopernicusDataset[] = [];
  
  try {
    // Copernicus uses a REST API for metadata
    const catalogUrl = `${apiBaseUrl}/catalog/search?limit=${limit}&format=json`;
    const response = await fetch(catalogUrl);
    
    if (!response.ok) {
      console.warn(`Copernicus API failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const datasets = Array.isArray(data.results) ? data.results : [];

    for (const dataset of datasets) {
      if (!dataset.id || !dataset.title) continue;

      // Extract variables from dataset metadata
      const variables = [];
      if (dataset.variables && Array.isArray(dataset.variables)) {
        variables.push(...dataset.variables.map((v: unknown) => {
          const variable = v as { name?: string; id?: string };
          return variable.name || variable.id || String(v);
        }));
      }

      // Extract spatial coverage
      let bbox: [number, number, number, number] | undefined;
      const regions: string[] = [];
      
      if (dataset.spatial) {
        if (dataset.spatial.bbox && Array.isArray(dataset.spatial.bbox)) {
          bbox = dataset.spatial.bbox as [number, number, number, number];
        }
        if (dataset.spatial.regions) {
          regions.push(...dataset.spatial.regions);
        }
      }

      // Extract temporal coverage
      const temporalCoverage: { start?: string; end?: string } = {};
      if (dataset.temporal) {
        temporalCoverage.start = dataset.temporal.start;
        temporalCoverage.end = dataset.temporal.end;
      }

      // Extract access URLs
      const accessUrls: Array<{ protocol: string; url: string; format: string }> = [];
      if (dataset.access && Array.isArray(dataset.access)) {
        for (const access of dataset.access) {
          accessUrls.push({
            protocol: access.protocol || 'HTTP',
            url: access.url || access.endpoint,
            format: access.format || 'NetCDF'
          });
        }
      }

      results.push({
        id: dataset.id,
        title: dataset.title,
        abstract: dataset.abstract || dataset.description,
        spatialResolution: dataset.spatialResolution,
        temporalResolution: dataset.temporalResolution,
        variables,
        geographicCoverage: { bbox, regions },
        temporalCoverage,
        accessUrls
      });
    }

  } catch (error) {
    console.error("Copernicus connector error:", error);
  }

  return results;
}

// Transform Copernicus dataset to ODFP format
export function transformCopernicusDataset(dataset: CopernicusDataset) {
  return {
    id: `copernicus:${dataset.id}`,
    title: dataset.title,
    abstract: dataset.abstract,
    publisher: "Copernicus Marine Environment Monitoring Service",
    sourceSystem: "Copernicus",
    timeStart: dataset.temporalCoverage.start ? new Date(dataset.temporalCoverage.start) : undefined,
    timeEnd: dataset.temporalCoverage.end ? new Date(dataset.temporalCoverage.end) : undefined,
    bboxMinX: dataset.geographicCoverage.bbox?.[0],
    bboxMinY: dataset.geographicCoverage.bbox?.[1], 
    bboxMaxX: dataset.geographicCoverage.bbox?.[2],
    bboxMaxY: dataset.geographicCoverage.bbox?.[3],
    variables: dataset.variables.map(name => ({
      name,
      standardName: name,
      longName: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    })),
    distributions: dataset.accessUrls.map(access => ({
      url: access.url,
      accessService: mapProtocolToService(access.protocol),
      format: access.format
    }))
  };
}

function mapProtocolToService(protocol: string): string {
  const proto = protocol.toLowerCase();
  if (proto.includes('opendap') || proto.includes('dods')) return 'OPeNDAP';
  if (proto.includes('thredds')) return 'THREDDS';
  if (proto.includes('erddap')) return 'ERDDAP';
  if (proto.includes('ftp')) return 'FTP';
  return 'HTTP';
}