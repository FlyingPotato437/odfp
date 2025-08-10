import { generateLLMAnswer } from "@/lib/ai/gemini";
import { expandScientificQuery } from "@/lib/ai/scientific-expansion";
import type { SearchQuery } from "@/lib/types";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const q = typeof body.q === "string" ? body.q : "";
  if (!q) return Response.json({ error: "Missing q" }, { status: 400 });

  // First expand the query scientifically
  const expansion = await expandScientificQuery(q);
  
  // Enhanced AI prompt with scientific context
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
    }
  });
}

