import { generateLLMAnswer } from "@/lib/ai/gemini";
import { expandScientificQuery } from "@/lib/ai/scientific-expansion";
import type { SearchQuery } from "@/lib/types";

// Intelligent query understanding with research intent detection
interface QueryUnderstanding {
  measurementType: "satellite" | "in-situ" | "model" | "mixed" | "unknown";
  researchIntent: "climatology" | "events" | "forecasts" | "validation" | "exploration" | "unknown";
  dataQualityPreference: "high" | "medium" | "any";
  suggestedAlternatives: string[];
}

function detectQueryIntent(query: string, expansion: { expandedTerms: string[]; suggestedVariables: string[]; locationVariants: string[] }): QueryUnderstanding {
  const lowerQuery = query.toLowerCase();

  // Detect measurement type
  let measurementType: QueryUnderstanding["measurementType"] = "unknown";
  if (/satellite|remote.?sensing|modis|viirs|sentinel|altimetry|ocean.?color/i.test(lowerQuery)) {
    measurementType = "satellite";
  } else if (/in.?situ|buoy|glider|argo|ctd|mooring|ship|cruise|profile/i.test(lowerQuery)) {
    measurementType = "in-situ";
  } else if (/model|forecast|simulation|reanalysis|hycom|roms|nemo/i.test(lowerQuery)) {
    measurementType = "model";
  } else if (expansion.expandedTerms.some((t: string) => /satellite|insitu|model/i.test(t))) {
    measurementType = "mixed";
  }

  // Detect research intent
  let researchIntent: QueryUnderstanding["researchIntent"] = "unknown";
  if (/climatology|climate|long.?term|trend|average|mean|seasonal|annual/i.test(lowerQuery)) {
    researchIntent = "climatology";
  } else if (/event|storm|hurricane|bloom|upwelling|el.?ni[nñ]o|anomaly/i.test(lowerQuery)) {
    researchIntent = "events";
  } else if (/forecast|prediction|nowcast|operational|real.?time/i.test(lowerQuery)) {
    researchIntent = "forecasts";
  } else if (/validation|comparison|calibration|accuracy|verification/i.test(lowerQuery)) {
    researchIntent = "validation";
  } else {
    researchIntent = "exploration";
  }

  // Detect data quality preference
  let dataQualityPreference: QueryUnderstanding["dataQualityPreference"] = "any";
  if (/high.?quality|validated|calibrated|qc|quality.?controlled/i.test(lowerQuery)) {
    dataQualityPreference = "high";
  } else if (/provisional|preliminary|near.?real.?time/i.test(lowerQuery)) {
    dataQualityPreference = "medium";
  }

  // Generate suggested alternative queries
  const suggestedAlternatives: string[] = [];

  if (measurementType === "unknown" && expansion.suggestedVariables.length > 0) {
    suggestedAlternatives.push(`${query} satellite data`);
    suggestedAlternatives.push(`${query} in-situ measurements`);
  }

  if (researchIntent === "climatology" && !/monthly|seasonal|annual/i.test(lowerQuery)) {
    suggestedAlternatives.push(`${query} monthly climatology`);
  }

  if (!/(time|temporal|when|date)/i.test(lowerQuery) && researchIntent !== "climatology") {
    suggestedAlternatives.push(`${query} since 2020`);
  }

  if (!/(location|where|region|area)/i.test(lowerQuery) && expansion.locationVariants.length === 0) {
    const commonRegions = ["global", "north atlantic", "pacific ocean", "southern ocean"];
    suggestedAlternatives.push(`${query} ${commonRegions[0]}`);
  }

  return {
    measurementType,
    researchIntent,
    dataQualityPreference,
    suggestedAlternatives: suggestedAlternatives.slice(0, 3)
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const q = typeof body.q === "string" ? body.q : "";
  if (!q) return Response.json({ error: "Missing q" }, { status: 400 });

  // First expand the query scientifically
  const expansion = await expandScientificQuery(q);

  // Detect query intent and measurement type
  const understanding = detectQueryIntent(q, expansion);

  // Enhanced AI prompt with scientific context and intent detection
  const schema = `Return a JSON object for ODFP oceanographic search with these keys:
  - q: enhanced search terms (use expanded scientific terms)
  - bbox: [minLon, minLat, maxLon, maxLat] if location mentioned
  - time_start/time_end: YYYY-MM-DD if temporal info
  - variables: array of likely variable names from oceanographic standards
  - format: NetCDF, CSV, JSON, etc. if specified
  - publisher: NOAA, PANGAEA, etc. if mentioned
  - service: HTTP, OPeNDAP, ERDDAP, THREDDS if specified
  - confidence: 0-1 score for interpretation quality

  Scientific context:
  - Expanded terms: ${expansion.expandedTerms.join(', ')}
  - Suggested variables: ${expansion.suggestedVariables.join(', ')}
  - Location variants: ${expansion.locationVariants.join(', ')}
  - Temporal hints: ${expansion.temporalHints.join(', ')}

  Query understanding:
  - Measurement type: ${understanding.measurementType}
  - Research intent: ${understanding.researchIntent}
  - Data quality preference: ${understanding.dataQualityPreference}

  Only output valid JSON, no explanation.`;

  const prompt = `${schema}\n\nUser query: ${q}`;
  const raw = await generateLLMAnswer(prompt);

  let parsed: Partial<SearchQuery & { confidence?: number }> = {};
  try {
    parsed = JSON.parse(raw.trim()) as Partial<SearchQuery & { confidence?: number }>;

    // Enhance the query with expanded terms if confidence is high
    if ((parsed.confidence || 0) > 0.7 && expansion.expandedTerms.length > 1) {
      const enhancedQ = [
        parsed.q || q,
        ...expansion.scientificSynonyms.slice(0, 3),
        ...expansion.locationVariants.slice(0, 2)
      ].join(' ');
      parsed.q = enhancedQ;
    }

    // Add suggested variables if not specified
    if (!parsed.variables && expansion.suggestedVariables.length > 0) {
      parsed.variables = expansion.suggestedVariables.slice(0, 5);
    }

    // Add measurement type filter if detected
    if (understanding.measurementType !== "unknown" && understanding.measurementType !== "mixed") {
      parsed.q = `${parsed.q || q} ${understanding.measurementType}`;
    }

  } catch {
    // Fallback with expansion
    parsed = {
      q: expansion.expandedTerms.length > 1
        ? `${q} ${expansion.scientificSynonyms.slice(0, 2).join(' ')}`
        : q,
      variables: expansion.suggestedVariables.slice(0, 3),
      confidence: expansion.confidenceScore
    };
  }

  return Response.json({
    query: parsed,
    expansion: {
      originalQuery: expansion.originalQuery,
      expandedTerms: expansion.expandedTerms,
      scientificSynonyms: expansion.scientificSynonyms,
      suggestedVariables: expansion.suggestedVariables,
      confidenceScore: expansion.confidenceScore
    },
    understanding: {
      measurementType: understanding.measurementType,
      researchIntent: understanding.researchIntent,
      dataQualityPreference: understanding.dataQualityPreference,
      suggestedAlternatives: understanding.suggestedAlternatives
    }
  });
}

