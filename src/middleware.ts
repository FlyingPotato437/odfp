import { NextResponse } from "next/server";

// Lightweight in-memory rate limiter compatible with Edge runtime
const bucket = new Map<string, { tokens: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_TOKENS = 60;

export async function middleware(req: Request) {
  const url = new URL(req.url);
  // Basic CORS for GET endpoints
  if (req.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res;
  }

  if (url.pathname.startsWith("/api/")) {
    const key = req.headers.get("x-forwarded-for") || "global";
    const now = Date.now();
    const state = bucket.get(key) || { tokens: MAX_TOKENS, resetAt: now + WINDOW_MS };
    if (now > state.resetAt) {
      state.tokens = MAX_TOKENS;
      state.resetAt = now + WINDOW_MS;
    }
    if (state.tokens <= 0) {
      const res = NextResponse.json({ error: "rate_limited" }, { status: 429 });
      res.headers.set("Retry-After", String(Math.ceil((state.resetAt - now) / 1000)));
      return res;
    }
    state.tokens -= 1;
    bucket.set(key, state);
  }

  const res = NextResponse.next();
  res.headers.set("Access-Control-Allow-Origin", "*");
  return res;
}

export const config = {
  matcher: "/api/:path*",
};

