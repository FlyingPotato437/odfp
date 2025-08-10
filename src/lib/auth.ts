export function isAdmin(req: Request): boolean {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : header || "";
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return true; // no token configured → allow
  return token === adminToken;
}

