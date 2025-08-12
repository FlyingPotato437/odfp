import Papa from "papaparse";

export type ErddapDatasetSummary = {
  datasetID: string;
  title?: string;
  summary?: string;
  institution?: string;
  dataStructure?: string;
};

export async function fetchErddapAllDatasets(baseUrl: string): Promise<ErddapDatasetSummary[]> {
  const results: ErddapDatasetSummary[] = [];
  
  // Try both tabledap and griddap dataset listings
  const endpoints = [
    { path: '/erddap/tabledap/allDatasets.csv', type: 'tabledap' },
    { path: '/erddap/griddap/allDatasets.csv', type: 'griddap' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const finalUrl = new URL(endpoint.path, baseUrl);
      finalUrl.search = "?datasetID,title,summary,institution,dataStructure&orderBy(%22datasetID%22)";
      const res = await fetch(finalUrl.toString());
      if (!res.ok) {
        console.warn(`Failed to fetch ${endpoint.type} datasets from ${baseUrl}: ${res.status}`);
        continue;
      }
      
      const csv = await res.text();
      const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: true });
      const rows: string[][] = parsed.data as string[][];
      
      // Expect header on first row
      const header = rows[0] || [];
      const idx = {
        datasetID: header.indexOf("datasetID"),
        title: header.indexOf("title"),
        summary: header.indexOf("summary"),
        institution: header.indexOf("institution"),
        dataStructure: header.indexOf("dataStructure"),
      };
      
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const datasetID = r[idx.datasetID];
        if (!datasetID) continue;
        
        // Avoid duplicates between tabledap and griddap
        if (results.some(existing => existing.datasetID === datasetID)) continue;
        
        results.push({
          datasetID,
          title: r[idx.title] || undefined,
          summary: r[idx.summary] || undefined,
          institution: r[idx.institution] || undefined,
          dataStructure: r[idx.dataStructure] || endpoint.type,
        });
      }
      
      console.log(`Fetched ${rows.length - 1} ${endpoint.type} datasets from ${baseUrl}`);
    } catch (error) {
      console.warn(`Error fetching ${endpoint.type} datasets from ${baseUrl}:`, error);
    }
  }
  
  return results;
}

export type ErddapInfo = {
  variables: Array<{ name: string; standard_name?: string; units?: string; long_name?: string }>;
  bbox?: [number, number, number, number];
  timeStart?: string;
  timeEnd?: string;
};

export async function fetchErddapInfo(baseUrl: string, datasetID: string): Promise<ErddapInfo> {
  try {
    // ERDDAP info JSON: /erddap/info/{datasetID}/index.json
    const url = new URL(`/erddap/info/${encodeURIComponent(datasetID)}/index.json`, baseUrl);
    const res = await fetch(url.toString(), { 
      headers: { 'User-Agent': 'ODFP-Bot/1.0' }
    });
    if (!res.ok) {
      console.warn(`ERDDAP info request failed for ${datasetID} at ${baseUrl}: ${res.status} ${res.statusText}`);
      return { variables: [] };
    }
    
    const json: unknown = await res.json().catch((e) => {
      console.warn(`Failed to parse JSON for ${datasetID}:`, e);
      return null;
    });
    
    if (!json) return { variables: [] };
    
    // The structure is a table with rows/columns
    // We'll scan for attributes of interest and variable rows
    const table = (json as { table?: { rows?: unknown[]; columnNames?: string[] } } | null)?.table;
    const rows: unknown[] = Array.isArray(table?.rows) ? table!.rows! : [];
    const columns: string[] = Array.isArray(table?.columnNames) ? table!.columnNames! : [];
    const colIndex: Record<string, number> = Object.fromEntries(columns.map((c, i) => [c, i]));

    const get = (row: unknown[], key: string) => {
      // Try both snake_case and space-separated variations for column names
      const possibleKeys = {
        rowType: ['rowType', 'Row Type'],
        variableName: ['variableName', 'Variable Name'],
        attributeName: ['attributeName', 'Attribute Name'],
        value: ['value', 'Value'],
        dataType: ['dataType', 'Data Type']
      };
      
      const keys = possibleKeys[key as keyof typeof possibleKeys] || [key];
      for (const k of keys) {
        if (colIndex[k] !== undefined) {
          return (row as Record<number, unknown>)[colIndex[k]] as unknown;
        }
      }
      return undefined;
    };

    const variables: ErddapInfo["variables"] = [];
    let lonMin: number | undefined, lonMax: number | undefined, latMin: number | undefined, latMax: number | undefined;
    let timeStart: string | undefined, timeEnd: string | undefined;
    
    // Enhanced attribute name mapping for broader compatibility
    const spatialAttrs = {
      lonMin: ['geospatial_lon_min', 'longitude_min', 'westernmost_longitude', 'geospatial_westernmost_longitude'],
      lonMax: ['geospatial_lon_max', 'longitude_max', 'easternmost_longitude', 'geospatial_easternmost_longitude'], 
      latMin: ['geospatial_lat_min', 'latitude_min', 'southernmost_latitude', 'geospatial_southernmost_latitude'],
      latMax: ['geospatial_lat_max', 'latitude_max', 'northernmost_latitude', 'geospatial_northernmost_latitude']
    };
    
    const temporalAttrs = {
      start: ['time_coverage_start', 'temporal_coverage_start', 'start_time', 'time_start', 'temporal_start'],
      end: ['time_coverage_end', 'temporal_coverage_end', 'end_time', 'time_end', 'temporal_end']
    };

    // Enhanced variable extraction with better attribute handling
    for (const r of rows as unknown[][]) {
      const t = get(r, "rowType") as string | undefined;
      if (t === "variable") {
        const varName = String((get(r, "variableName") as string | undefined) ?? "");
        if (varName) {
          // For variables, some attributes might be stored as separate attribute rows
          // We'll collect them in a second pass
          variables.push({
            name: varName,
            standard_name: undefined, // Will be filled in second pass
            units: undefined, // Will be filled in second pass  
            long_name: undefined, // Will be filled in second pass
          });
        }
      }
      if (t === "attribute") {
        const aName = get(r, "attributeName") as string | undefined;
        const aValue = get(r, "value") as string | number | undefined;
        const varName = get(r, "variableName") as string | undefined;
        
        if (!aName || aValue == null) continue;
        
        // If this attribute is for a specific variable, update that variable
        if (varName && varName !== 'NC_GLOBAL') {
          const variable = variables.find(v => v.name === varName);
          if (variable) {
            if (aName === 'standard_name') variable.standard_name = String(aValue);
            if (aName === 'units') variable.units = String(aValue);
            if (aName === 'long_name') variable.long_name = String(aValue);
          }
        }
        
        // For global attributes, extract spatial/temporal metadata
        if (varName === 'NC_GLOBAL' || !varName) {
          // Spatial bounds - check all variants
          for (const attr of spatialAttrs.lonMin) {
            if (aName === attr) {
              const val = parseFloat(String(aValue));
              if (!isNaN(val)) lonMin = val;
            }
          }
          for (const attr of spatialAttrs.lonMax) {
            if (aName === attr) {
              const val = parseFloat(String(aValue));
              if (!isNaN(val)) lonMax = val;
            }
          }
          for (const attr of spatialAttrs.latMin) {
            if (aName === attr) {
              const val = parseFloat(String(aValue));
              if (!isNaN(val)) latMin = val;
            }
          }
          for (const attr of spatialAttrs.latMax) {
            if (aName === attr) {
              const val = parseFloat(String(aValue));
              if (!isNaN(val)) latMax = val;
            }
          }
          
          // Temporal bounds - check all variants and normalize formats
          for (const attr of temporalAttrs.start) {
            if (aName === attr && !timeStart) {
              timeStart = normalizeTimeString(String(aValue));
            }
          }
          for (const attr of temporalAttrs.end) {
            if (aName === attr && !timeEnd) {
              timeEnd = normalizeTimeString(String(aValue));
            }
          }
        }
      }
    }
    
    // Additional fallbacks: try to extract from dimension variables
    if (!timeStart || !timeEnd) {
      const timeVars = variables.filter(v => 
        ['time', 'TIME', 'Time'].includes(v.name) ||
        v.standard_name?.includes('time') ||
        v.units?.includes('since')
      );
      if (timeVars.length > 0) {
        console.log(`Found ${timeVars.length} time variables for ${datasetID}, attempting dimension metadata extraction`);
        // Could implement dimension bounds extraction here
      }
    }
    
    if (lonMin == null || lonMax == null || latMin == null || latMax == null) {
      const spatialVars = variables.filter(v => 
        ['longitude', 'lon', 'LONGITUDE', 'LON', 'latitude', 'lat', 'LATITUDE', 'LAT'].includes(v.name) ||
        v.standard_name?.includes('longitude') || v.standard_name?.includes('latitude')
      );
      if (spatialVars.length > 0) {
        console.log(`Found ${spatialVars.length} spatial variables for ${datasetID}, attempting dimension metadata extraction`);
        // Could implement dimension bounds extraction here
      }
    }

    const bbox = (lonMin != null && lonMax != null && latMin != null && latMax != null)
      ? [lonMin, latMin, lonMax, latMax] as [number, number, number, number]
      : undefined;

    // Log extraction results for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`ERDDAP metadata for ${datasetID}:`, {
        variables: variables.length,
        bbox: bbox ? `[${bbox.join(', ')}]` : 'Unknown',
        timeRange: timeStart && timeEnd ? `${timeStart} to ${timeEnd}` : 'Unknown'
      });
    }

    return { variables, bbox, timeStart, timeEnd };
  } catch (error) {
    console.error(`Error fetching ERDDAP info for ${datasetID} at ${baseUrl}:`, error);
    return { variables: [] };
  }
}

// Helper function to normalize various time string formats
function normalizeTimeString(timeStr: string): string | undefined {
  if (!timeStr || timeStr === 'null' || timeStr === 'undefined') return undefined;
  
  try {
    // Handle various formats: ISO strings, epoch seconds, etc.
    const str = timeStr.trim();
    
    // If it's already an ISO string format, return as-is
    if (str.match(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/)) {
      return str;
    }
    
    // If it's a number, assume epoch seconds and convert
    if (str.match(/^\d+(\.\d+)?$/)) {
      const epoch = parseFloat(str);
      const date = new Date(epoch * 1000);
      if (date.getTime() > 0) {
        return date.toISOString();
      }
    }
    
    // Try to parse as date and convert to ISO
    const date = new Date(str);
    if (!isNaN(date.getTime()) && date.getFullYear() > 1900) {
      return date.toISOString();
    }
    
    return str; // Return original if we can't normalize
  } catch (error) {
    console.warn(`Failed to normalize time string '${timeStr}':`, error);
    return timeStr;
  }
}
