import { prisma } from "@/lib/db";

export async function GET() {
  const cols = await prisma.collection.findMany({ orderBy: { createdAt: "desc" } });
  return Response.json({ total: cols.length, results: cols });
}

