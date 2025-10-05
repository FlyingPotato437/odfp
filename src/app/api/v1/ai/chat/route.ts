import { generateLLMAnswer } from "@/lib/ai/gemini";
import { semanticSearch } from "@/lib/ai/indexer";
import { expandScientificQuery } from "@/lib/ai/scientific-expansion";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const messages: Array<{ role: "user" | "assistant"; content: string }> = Array.isArray(body.messages) ? body.messages : [];
  const last = messages[messages.length - 1];
  const query = last?.content || body.q || "";
  if (!query) return Response.json({ error: "Missing query" }, { status: 400 });

  // Expand query scientifically for better search
  const expansion = await expandScientificQuery(query);
  const enrichedQuery = [
    query,
    ...expansion.scientificSynonyms.slice(0, 3),
    ...expansion.suggestedVariables.slice(0, 3)
  ].join(" ");

  // Use hybrid search with more context (15 datasets instead of 5)
  const top = await semanticSearch(enrichedQuery, 15);
  const ids = top.map((t: { id: string }) => t.id);
  const rows = await prisma.dataset.findMany({
    where: { id: { in: ids } },
    include: { variables: true, distributions: true }
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  // Format context with rich dataset information
  const context = ids
    .map((id: string, idx: number) => {
      const d = byId.get(id);
      if (!d) return "";

      // Format temporal coverage
      const temporal = d.timeStart && d.timeEnd
        ? `${d.timeStart.getFullYear()}-${d.timeEnd.getFullYear()}`
        : "Unknown";

      // Format spatial coverage
      const spatial = d.bboxMinX !== null && d.bboxMinY !== null && d.bboxMaxX !== null && d.bboxMaxY !== null
        ? `[${d.bboxMinX.toFixed(1)}, ${d.bboxMinY.toFixed(1)}, ${d.bboxMaxX.toFixed(1)}, ${d.bboxMaxY.toFixed(1)}]`
        : "Unknown";

      // Format variables with units if available
      const vars = d.variables.slice(0, 8).map(v => {
        const unit = v.units ? ` (${v.units})` : "";
        return `${v.name}${unit}`;
      }).join(", ");

      // Format access services
      const services = Array.from(new Set(d.distributions.map(x => x.accessService).filter(Boolean))).join(", ");

      // Format DOI if available
      const doi = d.doi ? `\nDOI: ${d.doi}` : "";

      return `[Dataset ${idx + 1}]
ID: ${d.id}
Title: ${d.title}
Publisher: ${d.publisher || "Unknown"}
Temporal: ${temporal}
Spatial: ${spatial}
Variables: ${vars || "Not specified"}
Access: ${services || "Unknown"}
Relevance: ${(top[idx].score * 100).toFixed(0)}%${doi}`;
    })
    .filter(Boolean)
    .join("\n\n");

  // Enhanced system prompt with oceanographic expertise
  const systemPrompt = `You are ODFP AI, an expert oceanographic data discovery assistant with deep knowledge of marine science, climate research, and ocean data systems.

Your role is to help researchers find and understand ocean datasets by:
1. Recommending the most relevant datasets based on scientific requirements
2. Explaining dataset characteristics (temporal/spatial coverage, variables, data quality)
3. Suggesting how datasets can be combined for comprehensive analysis
4. Clarifying oceanographic terminology and measurement standards
5. Providing guidance on data access methods (ERDDAP, OPeNDAP, direct download)

Guidelines:
- Be precise and scientific in your language
- Reference specific dataset IDs when recommending data
- Mention key variables, temporal coverage, and spatial extent
- Note data quality indicators (publisher reputation, DOI availability, access services)
- Suggest complementary datasets when appropriate
- If the query is ambiguous, ask clarifying questions about research goals
- Always cite dataset IDs in your recommendations

Current query context:
- Scientific expansion detected: ${expansion.expandedTerms.slice(0, 3).join(", ")}
- Suggested variables: ${expansion.suggestedVariables.slice(0, 5).join(", ")}
- Confidence: ${(expansion.confidenceScore * 100).toFixed(0)}%`;

  // Build conversation history for context
  const conversationHistory = messages.slice(-4).map(m =>
    `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
  ).join("\n");

  const prompt = `${systemPrompt}\n\nConversation History:\n${conversationHistory}\n\nRelevant Datasets:\n${context}\n\nUser: ${query}\n\nAssistant (provide a helpful, scientifically accurate response):`;

  try {
    const answer = await generateLLMAnswer(prompt);
    return Response.json({
      answer,
      context: top.slice(0, 10).map((t: { id: string; score: number }) => ({
        id: t.id,
        score: t.score
      })),
      expansion: {
        expandedTerms: expansion.expandedTerms.slice(0, 5),
        suggestedVariables: expansion.suggestedVariables.slice(0, 5),
        confidenceScore: expansion.confidenceScore
      }
    });
  } catch (error) {
    console.error("AI chat error:", error);
    const ids = top.slice(0, 5).map((t: { id: string }) => t.id);
    const fallback = `I found ${top.length} relevant datasets for your query. Top recommendations:\n\n${ids.map((id, i) => `${i + 1}. ${id} (${(top[i].score * 100).toFixed(0)}% relevance)`).join("\n")}\n\n(AI response generation temporarily unavailable - showing dataset matches based on hybrid search)`;
    return Response.json({ answer: fallback, context: top.slice(0, 5).map(t => ({ id: t.id, score: t.score })) });
  }
}

