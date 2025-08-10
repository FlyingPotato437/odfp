import { generateLLMAnswer } from "@/lib/ai/gemini";
import { semanticSearch } from "@/lib/ai/indexer";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const messages: Array<{ role: "user" | "assistant"; content: string }> = Array.isArray(body.messages) ? body.messages : [];
  const last = messages[messages.length - 1];
  const query = last?.content || body.q || "";
  if (!query) return Response.json({ error: "Missing query" }, { status: 400 });

  const top = await semanticSearch(query, 5);
  const ids = top.map((t: { id: string }) => t.id);
  const rows = await prisma.dataset.findMany({ where: { id: { in: ids } }, include: { variables: true, distributions: true } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const context = ids
    .map((id: string) => {
      const d = byId.get(id);
      if (!d) return "";
      return `Title: ${d.title}\nPublisher: ${d.publisher || ""}\nVariables: ${d.variables.map((v) => v.name).join(", ")}\nDistributions: ${d.distributions.map((x) => `${x.format} ${x.accessService}`).join(", ")}`;
    })
    .filter(Boolean)
    .join("\n---\n");

  const systemPrompt = `You are ODFP, an ocean data search assistant. Answer concisely. If the user requests data, return relevant dataset ids and brief rationale. Use the provided context only.`;
  const prompt = `${systemPrompt}\n\nContext:\n${context}\n\nUser: ${query}\nAssistant:`;

  try {
    const answer = await generateLLMAnswer(prompt);
    return Response.json({ answer, context: top.map((t: { id: string }) => t.id) });
  } catch {
    const ids = top.map((t: { id: string }) => t.id);
    const fallback = `Top matches: ${ids.join(", ")}. (AI offline; showing lexical/embedding fallback results.)`;
    return Response.json({ answer: fallback, context: ids });
  }
}

