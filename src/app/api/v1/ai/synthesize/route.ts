import { synthesizeDataInsights } from "@/lib/ai/synthesis-engine";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const query = typeof body.query === "string" ? body.query.trim() : "";
  
  if (!query) {
    return Response.json({ error: "Missing query parameter" }, { status: 400 });
  }

  if (query.length < 3) {
    return Response.json({ error: "Query too short" }, { status: 400 });
  }

  try {
    const synthesis = await synthesizeDataInsights(query);
    return Response.json(synthesis);
  } catch (error) {
    console.error("Synthesis API error:", error);
    return Response.json(
      { error: "Failed to synthesize data insights" }, 
      { status: 500 }
    );
  }
}