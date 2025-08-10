import { embedTexts } from "@/lib/ai/gemini";
import { prisma } from "@/lib/db";

export async function updateDatasetEmbedding(datasetId: string, text: string): Promise<boolean> {
  try {
    const [vec] = await embedTexts([text]);
    const vecLiteral = `[${vec.join(",")}]`;
    await prisma.$executeRawUnsafe(`update "Dataset" set embedding = $1::vector where id = $2`, vecLiteral, datasetId);
    return true;
  } catch {
    return false;
  }
}
