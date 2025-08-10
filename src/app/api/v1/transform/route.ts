import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body || typeof body !== "object") return Response.json({ error: "invalid spec" }, { status: 400 });
  const job = await prisma.transformJob.create({ data: { spec: body as unknown as object, status: "queued" } });
  // For v1, we don't execute transforms. In v2, this would enqueue to a worker (e.g., SQS/ECS/Lambda)
  return Response.json({ job_id: job.id });
}

