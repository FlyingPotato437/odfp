import { prisma } from "@/lib/db";
import { updateDatasetEmbedding } from "@/lib/embeddings";

function buildText(d: { title: string; abstract: string | null; publisher: string | null; variables: Array<{ name: string; longName: string | null; standardName: string | null }> }) {
  const vars = d.variables.map(v => [v.standardName || "", v.name || "", v.longName || ""].filter(Boolean).join(" ")).filter(Boolean).join("; ");
  return `${d.title}\n${d.abstract || ""}\n${d.publisher || ""}\n${vars}`.trim();
}

export async function POST() {
  const rows = await prisma.dataset.findMany({ include: { variables: true }, take: 1000 });
  let ok = 0, fail = 0;
  for (const d of rows) {
    const text = buildText({ title: d.title, abstract: d.abstract || null, publisher: d.publisher || null, variables: d.variables });
    const done = await updateDatasetEmbedding(d.id, text);
    if (done) ok++; else fail++;
  }
  return Response.json({ ok, fail });
}
