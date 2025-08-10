import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { pathname } = new URL(req.url);
  const id = decodeURIComponent(pathname.split("/").pop() || "");
  const job = await prisma.transformJob.findUnique({ where: { id } });
  if (!job) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({
    job_id: job.id,
    status: job.status,
    message: job.message,
    output_url: job.outputUrl || null,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  });
}

