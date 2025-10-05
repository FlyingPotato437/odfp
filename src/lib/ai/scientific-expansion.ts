import { generateLLMAnswer } from "./gemini";

// Scientific term expansion database for oceanographic concepts
// Massively expanded with 25+ oceanographic categories covering physical, chemical, biological, and geological oceanography
const SCIENTIFIC_TERMS = {
  temperature: {
    synonyms: ["temp", "thermal", "thermocline", "heat", "warming", "cooling", "sst", "potential_temperature", "conservative_temperature"],
    related: ["sea_surface_temperature", "bottom_temperature", "air_temperature", "potential_temperature", "heat_flux", "heat_content", "thermal_gradient", "ocean_heat"],
    units: ["celsius", "kelvin", "fahrenheit", "°C", "°F", "K", "deg_C"],
    contexts: ["surface", "subsurface", "deep", "air-sea interface", "mixed layer", "seasonal", "anomaly", "climatology", "profile"]
  },
  salinity: {
    synonyms: ["salt", "saline", "halocline", "saltiness", "conductivity", "sss", "practical_salinity", "absolute_salinity"],
    related: ["sea_surface_salinity", "practical_salinity", "absolute_salinity", "psu", "pss-78", "density", "stratification", "freshwater", "evaporation", "precipitation"],
    units: ["psu", "practical salinity unit", "g/kg", "parts per thousand", "pss-78"],
    contexts: ["surface", "deep", "estuary", "freshwater", "brine", "profile", "anomaly", "climatology"]
  },
  current: {
    synonyms: ["flow", "velocity", "circulation", "drift", "stream", "advection", "transport"],
    related: ["ocean_current", "geostrophic", "ekman", "tidal", "surface_current", "deep_current", "eddy", "gyre", "upwelling", "downwelling", "gulf_stream", "kuroshio", "thermohaline"],
    units: ["m/s", "cm/s", "knots", "meters per second"],
    contexts: ["surface", "subsurface", "geostrophic", "ageostrophic", "tidal", "wind-driven", "zonal", "meridional", "eastward", "northward", "barotropic", "baroclinic"]
  },
  wind: {
    synonyms: ["breeze", "gale", "storm", "air_movement", "atmospheric_forcing", "wind_stress"],
    related: ["wind_speed", "wind_direction", "u_wind", "v_wind", "wind_stress", "scatterometer", "wind_curl", "wind_divergence", "zonal_wind", "meridional_wind"],
    units: ["m/s", "knots", "km/h", "mph", "meters per second", "N/m2"],
    contexts: ["surface", "10m", "zonal", "meridional", "stress", "forcing", "u-component", "v-component", "speed", "direction"]
  },
  wave: {
    synonyms: ["swell", "sea_state", "whitecap", "surf", "breaker", "significant_wave_height", "swh"],
    related: ["significant_wave_height", "wave_period", "wave_direction", "wave_spectrum", "Hs", "Tp", "peak_period", "mean_period", "wave_energy"],
    units: ["m", "meters", "seconds", "degrees", "Hz", "feet"],
    contexts: ["surface", "deep_water", "shallow_water", "wind_wave", "swell", "breaking", "significant", "maximum", "mean", "spectrum"]
  },
  chlorophyll: {
    synonyms: ["chl", "phytoplankton", "algae", "primary_production", "biomass", "chl_a", "chlorophyll_a"],
    related: ["chlorophyll_a", "chl_a", "ocean_color", "MODIS", "SeaWiFS", "VIIRS", "productivity", "bloom", "photosynthesis", "npp", "gpp", "euphotic_zone"],
    units: ["mg/m³", "µg/L", "mg/m^3", "micrograms per liter", "mg m-3"],
    contexts: ["surface", "euphotic", "bloom", "seasonal", "satellite", "in-situ", "concentration", "anomaly"]
  },
  ice: {
    synonyms: ["sea_ice", "glacial", "frozen", "ice_sheet", "iceberg", "ice_concentration", "ice_extent"],
    related: ["ice_concentration", "ice_thickness", "ice_extent", "ice_age", "albedo", "ice_drift", "polynya", "lead", "ice_shelf", "glacier"],
    units: ["percent", "%", "meters", "km²", "fraction", "thickness"],
    contexts: ["Arctic", "Antarctic", "seasonal", "multi-year", "first-year", "marginal", "extent", "concentration", "melt", "formation"]
  },
  carbon: {
    synonyms: ["co2", "carbon_dioxide", "carbonate", "bicarbonate", "acidification", "dic", "pco2"],
    related: ["dissolved_inorganic_carbon", "total_alkalinity", "pCO2", "ocean_acidification", "carbon_flux", "carbon_sequestration", "carbonate_system", "pH"],
    units: ["µmol/kg", "ppm", "pH units", "mol/m³", "µatm", "mmol/m3"],
    contexts: ["surface", "deep", "anthropogenic", "natural", "air-sea", "flux", "uptake", "storage"]
  },
  fisheries: {
    synonyms: ["fishing", "catch", "landings", "bycatch", "trawl", "longline", "gillnet", "seine", "fish_stock"],
    related: ["cpue", "effort", "haul", "set", "gear_type", "vessel", "specimen", "length", "weight", "species_code", "abundance", "spawning_biomass"],
    units: ["kg", "tons", "count", "number", "hours", "km", "nm", "metric tons"],
    contexts: ["commercial", "survey", "groundfish", "pelagic", "nearshore", "offshore", "observer", "logbook", "stock_assessment"]
  },
  habitat: {
    synonyms: ["substrate", "benthic", "reef", "shelf", "slope", "nursery", "ecosystem", "marine_habitat"],
    related: ["bathymetry", "slope", "rugosity", "sediment", "temperature", "salinity", "oxygen", "chlorophyll", "coral_reef", "seagrass", "mangrove", "essential_fish_habitat"],
    units: ["m", "degrees", "psu", "mg/m³", "km2"],
    contexts: ["shelf", "slope", "canyon", "coastal", "estuary", "deep_sea", "pelagic", "protected_area"]
  },
  nutrient: {
    synonyms: ["nitrate", "phosphate", "silicate", "nitrogen", "phosphorus", "nutrients", "no3", "po4", "sio4"],
    related: ["nitrate", "phosphate", "silicate", "nitrogen", "phosphorus", "ammonia", "nitrite", "eutrophication", "nutrient_limitation", "upwelling", "nutrient_flux"],
    units: ["µmol/l", "µmol/kg", "mmol/m3", "mg/l", "µM", "umol/kg"],
    contexts: ["surface", "subsurface", "concentration", "profile", "limitation", "ratio", "stoichiometry", "deep"]
  },
  oxygen: {
    synonyms: ["dissolved_oxygen", "do", "o2", "oxygen_concentration", "hypoxia", "dissolved_o2"],
    related: ["dissolved_oxygen", "hypoxia", "anoxia", "oxygen_minimum_zone", "omz", "oxygen_saturation", "dead_zone", "respiration", "ventilation"],
    units: ["ml/l", "µmol/kg", "mg/l", "% saturation", "umol/kg"],
    contexts: ["surface", "subsurface", "bottom", "saturation", "deficit", "minimum zone", "profile"]
  },
  ph: {
    synonyms: ["acidity", "ocean_acidity", "hydrogen_ion", "ph_level", "alkalinity"],
    related: ["acidification", "alkalinity", "carbon_dioxide", "carbonate_saturation", "aragonite", "calcite", "total_alkalinity"],
    units: ["ph units", "total scale", "seawater scale"],
    contexts: ["surface", "subsurface", "anomaly", "trend", "acidification"]
  },
  density: {
    synonyms: ["sigma_t", "potential_density", "in_situ_density", "seawater_density", "rho", "density_anomaly"],
    related: ["stratification", "buoyancy", "mixed_layer", "pycnocline", "density_gradient", "stability", "sigma_theta"],
    units: ["kg/m3", "sigma-t", "sigma-theta"],
    contexts: ["surface", "subsurface", "profile", "anomaly", "stratification"]
  },
  mixedlayer: {
    synonyms: ["mixed_layer_depth", "mld", "mixing_depth", "surface_mixed_layer", "boundary_layer"],
    related: ["stratification", "thermocline", "halocline", "pycnocline", "mixing", "entrainment", "detrainment"],
    units: ["m", "meters", "depth"],
    contexts: ["depth", "seasonal", "diurnal", "climatology"]
  },
  turbidity: {
    synonyms: ["suspended_sediment", "total_suspended_matter", "tsm", "water_clarity", "transparency", "secchi_depth"],
    related: ["sediment", "runoff", "erosion", "light_attenuation", "particulate_matter", "turbid_water", "suspended_particulate_matter"],
    units: ["ntu", "fnu", "mg/l", "g/m3", "meters"],
    contexts: ["surface", "coastal", "river_plume", "nearshore"]
  },
  bathymetry: {
    synonyms: ["depth", "ocean_depth", "seafloor", "topography", "bottom", "seafloor_depth", "bathymetric"],
    related: ["seamount", "ridge", "trench", "continental_shelf", "slope", "abyssal_plain", "submarine_canyon", "topography"],
    units: ["m", "meters", "fathoms", "feet"],
    contexts: ["seafloor", "bottom", "depth", "elevation", "contour"]
  },
  tide: {
    synonyms: ["tidal", "sea_level", "water_level", "tidal_height", "tide_gauge", "tidal_elevation"],
    related: ["surge", "tidal_current", "tidal_range", "spring_tide", "neap_tide", "astronomical_tide", "storm_surge", "harmonic"],
    units: ["m", "meters", "cm", "feet"],
    contexts: ["prediction", "observation", "residual", "anomaly", "harmonic"]
  },
  altimetry: {
    synonyms: ["sea_surface_height", "ssh", "sea_level_anomaly", "sla", "sea_surface_anomaly", "satellite_altimetry"],
    related: ["satellite_altimetry", "jason", "topex", "geostrophic_current", "eddy", "mesoscale", "absolute_dynamic_topography"],
    units: ["m", "cm", "meters"],
    contexts: ["anomaly", "absolute", "gridded", "along-track"]
  },
  precipitation: {
    synonyms: ["rainfall", "rain", "precipitation_rate", "precip", "rainfall_rate"],
    related: ["evaporation", "freshwater_flux", "salinity", "river_discharge", "runoff"],
    units: ["mm", "mm/day", "mm/hr", "inches"],
    contexts: ["rate", "accumulation", "anomaly", "climatology"]
  },
  evaporation: {
    synonyms: ["evap", "evapotranspiration", "surface_evaporation", "evaporation_rate"],
    related: ["precipitation", "freshwater_flux", "salinity", "latent_heat", "humidity"],
    units: ["mm", "mm/day", "kg/m2/s"],
    contexts: ["rate", "flux", "net", "climatology"]
  },
  radiation: {
    synonyms: ["solar_radiation", "shortwave", "longwave", "net_radiation", "insolation", "par"],
    related: ["heat_flux", "albedo", "cloud_cover", "photosynthetically_active_radiation", "par", "irradiance"],
    units: ["w/m2", "watts per square meter", "µmol/m2/s"],
    contexts: ["surface", "downwelling", "upwelling", "net", "shortwave", "longwave"]
  },
  pressure: {
    synonyms: ["sea_level_pressure", "slp", "atmospheric_pressure", "barometric_pressure", "surface_pressure"],
    related: ["wind", "storm", "high_pressure", "low_pressure", "pressure_gradient"],
    units: ["hpa", "mb", "millibar", "pa", "inches hg"],
    contexts: ["sea level", "surface", "anomaly", "gradient"]
  },
  zooplankton: {
    synonyms: ["zooplankton_biomass", "copepod", "krill", "zooplankton_abundance", "zooplankton_community"],
    related: ["phytoplankton", "food_web", "grazing", "marine_ecosystem", "secondary_production", "biomass"],
    units: ["mg/m3", "individuals/m3", "biomass"],
    contexts: ["biomass", "abundance", "size class", "community"]
  },
  soundspeed: {
    synonyms: ["sound_velocity", "acoustic_velocity", "speed_of_sound", "sound_speed_profile"],
    related: ["sonar", "acoustic", "temperature", "salinity", "pressure", "sound_channel", "sofar"],
    units: ["m/s", "meters per second"],
    contexts: ["profile", "surface", "sound channel", "sofar"]
  },
  // Additional measurement types and platforms
  satellite: {
    synonyms: ["remote_sensing", "satellite_data", "earth_observation", "space_based"],
    related: ["modis", "viirs", "sentinel", "landsat", "aqua", "terra", "altimetry", "ocean_color", "sar"],
    units: [],
    contexts: ["l2", "l3", "level-2", "level-3", "daily", "monthly", "composite"]
  },
  insitu: {
    synonyms: ["in_situ", "in-situ", "observation", "measurement", "field_data"],
    related: ["ctd", "adcp", "buoy", "glider", "argo", "mooring", "ship", "profile"],
    units: [],
    contexts: ["profile", "time_series", "survey", "cruise", "station"]
  },
  model: {
    synonyms: ["numerical_model", "forecast", "simulation", "reanalysis", "hindcast"],
    related: ["hycom", "roms", "nemo", "mom", "forecast", "nowcast", "reanalysis", "operational"],
    units: [],
    contexts: ["forecast", "hindcast", "nowcast", "reanalysis", "operational", "research"]
  }
};

const LOCATION_EXPANSIONS = {
  "california": ["california current", "west coast", "pacific coast", "california coastal", "ccs", "southern california bight", "monterey bay"],
  "gulf of mexico": ["gom", "gulf", "gulf coast", "texas", "louisiana", "florida", "gulf of mexico basin"],
  "atlantic": ["north atlantic", "south atlantic", "atlantic ocean", "nadw", "aaiw", "atlantic basin"],
  "north atlantic": ["na", "subpolar gyre", "gulf stream", "sargasso", "iceland basin", "labrador sea", "north atlantic drift"],
  "south atlantic": ["sa", "south atlantic ocean", "brazil current", "benguela current", "south atlantic gyre"],
  "pacific": ["north pacific", "south pacific", "pacific ocean", "kuroshio", "california current", "pacific basin"],
  "north pacific": ["np", "north pacific ocean", "kuroshio", "oyashio", "alaska gyre", "north pacific gyre"],
  "south pacific": ["sp", "south pacific ocean", "east australian current", "humboldt current", "south pacific gyre"],
  "arctic": ["arctic ocean", "beaufort", "chukchi", "barents", "greenland sea", "polar", "beaufort gyre", "transpolar drift"],
  "antarctic": ["southern ocean", "ross sea", "weddell sea", "circumpolar", "polar", "antarctic circumpolar current", "acc"],
  "mediterranean": ["med", "mediterranean sea", "aegean", "adriatic", "tyrrhenian", "balearic", "ligurian", "ionian"],
  "caribbean": ["caribbean sea", "antilles", "tropical atlantic", "greater antilles", "lesser antilles"],
  "north sea": ["north sea", "northern european shelf", "dogger bank"],
  "baltic": ["baltic sea", "baltic", "bothnian sea", "gulf of finland", "gulf of riga"],
  "bering": ["bering sea", "bering strait", "aleutian basin"],
  "barents": ["barents sea", "barents", "norwegian sea"],
  "black sea": ["black sea", "sea of azov"],
  "red sea": ["red sea", "gulf of aqaba", "gulf of suez"],
  "east china": ["east china sea", "yellow sea", "bohai sea"],
  "south china": ["south china sea", "scs", "gulf of thailand", "gulf of tonkin"],
  "indian": ["indian ocean", "arabian sea", "bay of bengal", "andaman sea"],
  "labrador": ["labrador sea", "davis strait", "baffin bay"],
  "greenland": ["greenland sea", "denmark strait"],
  "norwegian": ["norwegian sea", "norwegian coast"],
  "beaufort": ["beaufort sea", "beaufort gyre", "mackenzie shelf"],
  "chukchi": ["chukchi sea", "chukchi shelf"],
  "ross": ["ross sea", "ross ice shelf", "ross gyre"],
  "weddell": ["weddell sea", "weddell gyre"],
  "coral": ["coral sea", "great barrier reef"],
  "tasman": ["tasman sea", "tasman basin"],
  "benguela": ["benguela current", "benguela upwelling system"],
  "agulhas": ["agulhas current", "agulhas retroflection"],
  "kuroshio": ["kuroshio current", "kuroshio extension"],
  "gulf stream": ["gulf stream", "gulf stream extension", "north atlantic current"]
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
      
      // Check if AI response is the fallback message
      if (aiResponse.includes("AI is not configured")) {
        // Skip AI parsing and continue with existing expansions
        console.warn("AI expansion skipped: API not configured");
      } else {
        try {
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
        } catch (parseError) {
          console.warn("AI expansion failed: Invalid JSON response");
        }
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
