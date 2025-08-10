import { GoogleGenerativeAI } from "@google/generative-ai";

let _client: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Provide a clear error to callers and allow them to handle fallback
    throw new Error("Missing GEMINI_API_KEY env var");
  }
  _client = new GoogleGenerativeAI(apiKey);
  return _client;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: "text-embedding-004" });
    if (texts.length === 1) {
      const res = await model.embedContent({ content: { role: "user", parts: [{ text: texts[0] }] } });
      return [res.embedding.values];
    }
    const res = await model.batchEmbedContents({
      requests: texts.map((t) => ({ content: { role: "user", parts: [{ text: t }] } })),
    });
    return res.embeddings.map((e) => e.values);
  } catch {
    // Provide deterministic tiny random vectors for offline fallback
    return texts.map((t, i) => {
      const seed = Array.from(t).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) + i;
      const vec = new Array(16).fill(0).map((_, k) => Math.sin(seed * (k + 1)));
      return vec;
    });
  }
}

export async function generateLLMAnswer(prompt: string): Promise<string> {
  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
    const text = result.response.text();
    return text;
  } catch {
    return "AI is not configured on this environment. Showing best-effort results from lexical/semantic fallback.";
  }
}

