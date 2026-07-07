// Central CORS helper. We echo back specific allowed origins instead of "*"
// so cross-site pages can't ride an authenticated session against the API.
//
// Callers can either:
//   import { corsHeaders } from "../_shared/cors.ts";  // wildcard-free default
//   -> uses APP_URL only; safe for internal (non-browser) callers
// or, preferred for browser-facing endpoints:
//   import { getCorsHeaders } from "../_shared/cors.ts";
//   const headers = getCorsHeaders(req.headers.get("Origin"));

const STATIC_ALLOWED = new Set(
  [
    Deno.env.get("APP_URL"),
    "https://shortwork.lovable.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8080",
  ].filter(Boolean) as string[],
);

// Lovable preview/publish domains are dynamic; allow the hosted app family.
const HOST_PATTERNS: RegExp[] = [
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/i,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i,
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (STATIC_ALLOWED.has(origin)) return true;
  return HOST_PATTERNS.some((re) => re.test(origin));
}

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = isAllowedOrigin(origin)
    ? (origin as string)
    : (Deno.env.get("APP_URL") || "https://shortwork.lovable.app");
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

// Backwards-compatible export. Existing callers that spread `corsHeaders` into
// their responses now get an APP_URL-only response — safe default, but
// browser-facing endpoints should switch to getCorsHeaders(origin).
export const corsHeaders: Record<string, string> = getCorsHeaders(null);
