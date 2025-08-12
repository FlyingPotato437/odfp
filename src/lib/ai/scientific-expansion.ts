import { generateLLMAnswer } from "./gemini";

// Scientific term expansion database for oceanographic concepts
const SCIENTIFIC_TERMS = {
  temperature: {
    synonyms: ["temp", "thermal", "thermocline", "heat", "warming", "cooling"],
    related: ["sea_surface_temperature", "sst", "bottom_temperature", "air_temperature", "potential_temperature"],
    units: ["celsius", "kelvin", "fahrenheit", "°C", "°F", "K"],
    contexts: ["surface", "subsurface", "deep", "air-sea interface", "mixed layer"]
  },
  salinity: {
    synonyms: ["salt", "saline", "halocline", "saltiness", "conductivity"],
    related: ["sea_surface_salinity", "sss", "practical_salinity", "absolute_salinity", "psu", "pss-78"],
    units: ["psu", "practical salinity unit", "g/kg", "parts per thousand"],
    contexts: ["surface", "deep", "estuary", "freshwater", "brine"]
  },
  current: {
    synonyms: ["flow", "velocity", "circulation", "drift", "stream"],
    related: ["ocean_current", "geostrophic", "ekman", "tidal", "surface_current", "deep_current"],
    units: ["m/s", "cm/s", "knots", "meters per second"],
    contexts: ["surface", "subsurface", "geostrophic", "ageostrophic", "tidal", "wind-driven"]
  },
  wind: {
    synonyms: ["breeze", "gale", "storm", "air_movement", "atmospheric_forcing"],
    related: ["wind_speed", "wind_direction", "u_wind", "v_wind", "wind_stress", "scatterometer"],
    units: ["m/s", "knots", "km/h", "mph", "meters per second"],
    contexts: ["surface", "10m", "zonal", "meridional", "stress", "forcing"]
  },
  wave: {
    synonyms: ["swell", "sea_state", "whitecap", "surf", "breaker"],
    related: ["significant_wave_height", "wave_period", "wave_direction", "wave_spectrum", "Hs", "Tp"],
    units: ["m", "meters", "seconds", "degrees", "Hz"],
    contexts: ["surface", "deep_water", "shallow_water", "wind_wave", "swell", "breaking"]
  },
  chlorophyll: {
    synonyms: ["chl", "phytoplankton", "algae", "primary_production", "biomass"],
    related: ["chlorophyll_a", "chl_a", "ocean_color", "MODIS", "SeaWiFS", "VIIRS"],
    units: ["mg/m³", "µg/L", "mg/m^3", "micrograms per liter"],
    contexts: ["surface", "euphotic", "bloom", "seasonal", "satellite", "in-situ"]
  },
  ice: {
    synonyms: ["sea_ice", "glacial", "frozen", "ice_sheet", "iceberg"],
    related: ["ice_concentration", "ice_thickness", "ice_extent", "ice_age", "albedo"],
    units: ["percent", "%", "meters", "km²", "fraction"],
    contexts: ["Arctic", "Antarctic", "seasonal", "multi-year", "first-year", "marginal"]
  },
  carbon: {
    synonyms: ["co2", "carbon_dioxide", "carbonate", "bicarbonate", "pH", "acidification"],
    related: ["dissolved_inorganic_carbon", "total_alkalinity", "pCO2", "ocean_acidification", "carbon_flux"],
    units: ["µmol/kg", "ppm", "pH units", "mol/m³", "µatm"],
    contexts: ["surface", "deep", "anthropogenic", "natural", "air-sea", "flux"]
  },
  // Fisheries and living marine resources
  fisheries: {
    synonyms: ["fishing", "catch", "landings", "bycatch", "trawl", "longline", "gillnet", "seine"],
    related: ["cpue", "effort", "haul", "set", "gear_type", "vessel", "specimen", "length", "weight", "species_code"],
    units: ["kg", "tons", "count", "number", "hours", "km", "nm"],
    contexts: ["commercial", "survey", "groundfish", "pelagic", "nearshore", "offshore", "observer", "logbook"]
  },
  habitat: {
    synonyms: ["substrate", "benthic", "reef", "shelf", "slope", "nursery"],
    related: ["bathymetry", "slope", "rugosity", "sediment", "temperature", "salinity", "oxygen", "chlorophyll"],
    units: ["m", "degrees", "psu", "mg/m³"],
    contexts: ["shelf", "slope", "canyon", "coastal", "estuary"]
  }
};

const LOCATION_EXPANSIONS = {
  "california": ["california current", "west coast", "pacific coast", "california coastal", "ccs"],
  "gulf of mexico": ["gom", "gulf", "gulf coast", "texas", "louisiana", "florida"],
  "atlantic": ["north atlantic", "south atlantic", "atlantic ocean", "nadw", "aaiw"],
  "north atlantic": ["na", "subpolar gyre", "gulf stream", "sargasso", "iceland basin", "labrador sea"],
  "pacific": ["north pacific", "south pacific", "pacific ocean", "kuroshio", "california current"],
  "arctic": ["arctic ocean", "beaufort", "chukchi", "barents", "greenland sea", "polar"],
  "antarctic": ["southern ocean", "ross sea", "weddell sea", "circumpolar", "polar"],
  "mediterranean": ["med", "mediterranean sea", "aegean", "adriatic", "tyrrhenian"],
  "caribbean": ["caribbean sea", "antilles", "gulf of mexico", "tropical atlantic"]
};

export interface ExpandedQuery {
  originalQuery: string;
  expandedTerms: string[];
  scientificSynonyms: string[];
  locationVariants: string[];
  suggestedVariables: string[];
  temporalHints: string[];
  confidenceScore: number;
}

export async function expandScientificQuery(query: string): Promise<ExpandedQuery> {
  const lowercaseQuery = query.toLowerCase();
  const words = lowercaseQuery.split(/[\s,\-_]+/).filter(Boolean);
  
  const expandedTerms: Set<string> = new Set([query]);
  const scientificSynonyms: Set<string> = new Set();
  const locationVariants: Set<string> = new Set();
  const suggestedVariables: Set<string> = new Set();
  const temporalHints: Set<string> = new Set();
  let confidenceScore = 0.5;

  // Expand scientific terms
  for (const [concept, expansion] of Object.entries(SCIENTIFIC_TERMS)) {
    const conceptMatch = words.some(word => 
      word === concept || 
      expansion.synonyms.some(syn => word.includes(syn) || syn.includes(word))
    );
    
    if (conceptMatch) {
      confidenceScore += 0.1;
      expansion.synonyms.forEach(syn => scientificSynonyms.add(syn));
      expansion.related.forEach(rel => suggestedVariables.add(rel));
      
      // Add context-aware expansions
      expansion.contexts.forEach(context => {
        expandedTerms.add(`${concept} ${context}`);
        expandedTerms.add(`${context} ${concept}`);
      });
    }
  }

  // Expand locations (also expand abbreviations like 'na' safely when exact match)
  for (const [location, variants] of Object.entries(LOCATION_EXPANSIONS)) {
    if (lowercaseQuery.includes(location) || words.includes(location)) {
      confidenceScore += 0.15;
      variants.forEach(variant => locationVariants.add(variant));
    }
  }

  // Detect temporal hints
  const temporalPatterns = [
    { pattern: /seasonal|monthly|annual|yearly/, hint: "temporal_coverage" },
    { pattern: /trend|change|warming|cooling/, hint: "time_series" },
    { pattern: /recent|latest|current|real.?time/, hint: "recent_data" },
    { pattern: /historical|archive|long.?term|climate/, hint: "historical_data" },
    { pattern: /forecast|prediction|model/, hint: "forecast_data" }
  ];

  temporalPatterns.forEach(({ pattern, hint }) => {
    if (pattern.test(lowercaseQuery)) {
      temporalHints.add(hint);
      confidenceScore += 0.1;
    }
  });

  // Use AI for advanced understanding if confidence is low
  if (confidenceScore < 0.7 && process.env.GEMINI_API_KEY) {
    try {
      const aiPrompt = `As an oceanographic expert, analyze this search query and provide scientific term expansions:
      
Query: "${query}"

Return JSON with:
- expanded_terms: broader scientific terms
- variables: likely variable names  
- locations: geographic variants
- confidence: 0-1 score

Focus on oceanographic, atmospheric, and climate science terminology.`;

      const aiResponse = await generateLLMAnswer(aiPrompt);
      const aiParsed = JSON.parse(aiResponse.replace(/```json\n?|\n?```/g, ''));
      
      if (aiParsed.expanded_terms) {
        aiParsed.expanded_terms.forEach((term: string) => expandedTerms.add(term));
      }
      if (aiParsed.variables) {
        aiParsed.variables.forEach((variable: string) => suggestedVariables.add(variable));
      }
      if (aiParsed.locations) {
        aiParsed.locations.forEach((loc: string) => locationVariants.add(loc));
      }
      if (aiParsed.confidence) {
        confidenceScore = Math.max(confidenceScore, aiParsed.confidence);
      }
    } catch (error) {
      console.warn("AI expansion failed:", error);
    }
  }

  return {
    originalQuery: query,
    expandedTerms: Array.from(expandedTerms),
    scientificSynonyms: Array.from(scientificSynonyms),
    locationVariants: Array.from(locationVariants),
    suggestedVariables: Array.from(suggestedVariables),
    temporalHints: Array.from(temporalHints),
    confidenceScore: Math.min(confidenceScore, 1.0)
  };
}

// Cross-dataset relationship discovery
export interface DatasetRelationship {
  datasetId: string;
  relationshipType: 'complement' | 'temporal' | 'spatial' | 'variable' | 'source';
  score: number;
  explanation: string;
}

export async function discoverDatasetRelationships(
  datasetId: string, 
  allDatasets: Array<{id: string; title: string; variables: string[]; spatial?: { bbox: number[] }; temporal?: { start: string; end?: string }}>
): Promise<DatasetRelationship[]> {
  const target = allDatasets.find(d => d.id === datasetId);
  if (!target) return [];

  const relationships: DatasetRelationship[] = [];

  for (const other of allDatasets) {
    if (other.id === datasetId) continue;

    let score = 0;
    const explanations: string[] = [];

    // Variable similarity
    const commonVars = target.variables.filter(v => 
      other.variables.some(ov => 
        v === ov || 
        v.includes(ov) || 
        ov.includes(v) ||
        SCIENTIFIC_TERMS[v as keyof typeof SCIENTIFIC_TERMS]?.related.includes(ov)
      )
    );

    if (commonVars.length > 0) {
      score += commonVars.length * 0.3;
      explanations.push(`Shares ${commonVars.length} variables: ${commonVars.slice(0, 3).join(', ')}`);
    }

    // Spatial proximity (if bbox available)
    if (target.spatial?.bbox && other.spatial?.bbox) {
      const [minX1, minY1, maxX1, maxY1] = target.spatial.bbox;
      const [minX2, minY2, maxX2, maxY2] = other.spatial.bbox;
      
      const overlap = !(maxX1 < minX2 || maxX2 < minX1 || maxY1 < minY2 || maxY2 < minY1);
      if (overlap) {
        score += 0.4;
        explanations.push("Overlapping spatial coverage");
      }
    }

    // Temporal correlation
    if (target.temporal?.start && other.temporal?.start) {
      const timeDiff = Math.abs(
        new Date(target.temporal.start).getTime() - 
        new Date(other.temporal.start).getTime()
      );
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
      
      if (daysDiff < 30) {
        score += 0.3;
        explanations.push("Similar temporal coverage");
      }
    }

    // Title/content similarity
    const titleSim = calculateStringSimilarity(target.title.toLowerCase(), other.title.toLowerCase());
    if (titleSim > 0.3) {
      score += titleSim * 0.2;
      explanations.push("Similar dataset themes");
    }

    if (score > 0.3) {
      let relationshipType: DatasetRelationship['relationshipType'] = 'complement';
      
      if (commonVars.length > 2) relationshipType = 'variable';
      else if (target.spatial?.bbox && other.spatial?.bbox) relationshipType = 'spatial';
      else if (target.temporal?.start && other.temporal?.start) relationshipType = 'temporal';

      relationships.push({
        datasetId: other.id,
        relationshipType,
        score,
        explanation: explanations.join('; ')
      });
    }
  }

  return relationships.sort((a, b) => b.score - a.score).slice(0, 10);
}

function calculateStringSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));

  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;

  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator   // substitution
      );
    }
  }

  return 1 - matrix[len2][len1] / Math.max(len1, len2);
}
