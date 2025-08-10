import { generateLLMAnswer } from "@/lib/ai/gemini";
import type { SearchQuery } from "@/lib/types";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const q = typeof body.q === "string" ? body.q : "";
  if (!q) return Response.json({ error: "Missing q" }, { status: 400 });
  const schema = `Return a minimal JSON object of filters for ODFP search with keys from: q, bbox([-180, -90, 180, 90]), time_start(YYYY-MM-DD), time_end(YYYY-MM-DD), variables([names]), format, publisher, service. Only output JSON, no explanation.`;
  const prompt = `${schema}\n\nUser query: ${q}`;
  const raw = await generateLLMAnswer(prompt);
  let parsed: Partial<SearchQuery> = {};
  try {
    parsed = JSON.parse(raw.trim()) as Partial<SearchQuery>;
  } catch {
    parsed = { q };
  }
  return Response.json({ query: parsed });
}

