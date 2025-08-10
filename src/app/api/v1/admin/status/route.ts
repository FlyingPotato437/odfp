import { prisma } from "@/lib/db";

export async function GET() {
  const jobs = await prisma.ingestionJob.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  const datasetCount = await prisma.dataset.count();
  return Response.json({ datasetCount, jobs });
}

