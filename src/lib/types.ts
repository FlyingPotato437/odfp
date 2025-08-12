export type AccessService = "HTTP" | "OPeNDAP" | "THREDDS" | "ERDDAP" | "FTP" | "S3";

export type Distribution = {
  url: string;
  access_service: AccessService;
  format: string; // NetCDF, Zarr, CSV, GeoTIFF
  size?: number; // bytes
  checksum?: string;
  access_rights?: string;
};

export type Variable = {
  name: string;
  standard_name?: string;
  units?: string;
  long_name?: string;
  dimensions?: string[];
  coverage?: { min?: number; max?: number; count?: number };
  vertical_level?: string | number;
};

export type TemporalExtent = { start?: string; end?: string };

export type SpatialExtent = {
  // bbox: [minX, minY, maxX, maxY]
  bbox?: [number, number, number, number];
  // polygon as an array of [lon, lat]
  polygon?: [number, number][];
};

export type Dataset = {
  id: string; // e.g., ncei:abcd-1234
  dataset_version_id?: string;
  source_hash?: string;
  doi?: string;
  title: string;
  abstract?: string;
  keywords?: string[];
  publisher?: string;
  creators?: string[];
  license?: string;
  temporal_extent?: TemporalExtent;
  spatial_extent?: SpatialExtent;
  variables?: Variable[];
  platforms?: string[];
  instruments?: string[];
  distributions?: Distribution[];
  lineage?: string;
  provenance?: string;
  source_system?: string;
  updated_at?: string;
  popularity?: number; // used for ranking tie-breakers
};

export type Collection = {
  id: string;
  title: string;
  description?: string;
  publisher?: string;
  dataset_ids: string[];
};

export type SearchQuery = {
  q?: string;
  bbox?: [number, number, number, number];
  polygon?: [number, number][];
  time_start?: string;
  time_end?: string;
  variables?: string[];
  format?: string;
  publisher?: string;
  platform?: string;
  service?: AccessService;
  license?: string;
  page?: number;
  size?: number;
  sort?: "relevance" | "recency";
};

export type SearchResult = {
  total: number;
  page: number;
  size: number;
  results: Array<{
    id: string;
    doi?: string;
    license?: string;
    sourceSystem?: string;
    title: string;
    publisher?: string;
    abstract?: string;
    time?: TemporalExtent;
    spatial?: SpatialExtent;
    variables?: string[];
    variablesDetailed?: Array<{
      name: string;
      standard_name?: string;
      units?: string;
      long_name?: string;
    }>;
    distributions?: Array<{
      url: string;
      format: string;
      service: AccessService;
    }>;
    distributionsDetailed?: Array<{
      url: string;
      format: string;
      service: AccessService;
      size?: number;
      checksum?: string;
      access_rights?: string;
    }>;
  }>;
};

export type FacetStats = {
  publishers: Record<string, number>;
  formats: Record<string, number>;
  services: Record<string, number>;
  variables: Record<string, number>;
  decades: Record<string, number>;
};
