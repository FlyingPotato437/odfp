import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { pathname } = new URL(req.url);
  const id = decodeURIComponent(pathname.split("/").pop() || "");
  const col = await prisma.collection.findUnique({ where: { id } });
  if (!col) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(col);
}

