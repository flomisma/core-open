/**
 * In-memory sliding-window rate limiter.
 *
 * Per-instance state — on serverless/multi-instance deployments, pair this
 * with an edge/WAF-level guard for anything security-sensitive (auth,
 * webhooks). This module is for request-shaping inside a single process,
 * not a substitute for a distributed limiter under adversarial load.
 */

const rateMap = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60_000,
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT,
): RateLimitResult {
  const now = Date.now();
  let entry = rateMap.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + config.windowMs };
    rateMap.set(key, entry);
  }

  entry.count++;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const allowed = entry.count <= config.maxRequests;

  return { allowed, remaining, resetAt: entry.resetAt };
}

/** Extract a best-effort client IP from standard proxy headers. */
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

/**
 * Web Fetch API (Request/Response) middleware wrapper. Works with any
 * framework built on the standard Request/Response objects (Next.js route
 * handlers, Remix, Hono, Bun, Deno, Cloudflare Workers).
 */
export function withRateLimit(config: RateLimitConfig = DEFAULT_RATE_LIMIT) {
  return <Args extends unknown[]>(
    handler: (req: Request, ...args: Args) => Promise<Response>,
  ) => {
    return async (req: Request, ...args: Args): Promise<Response> => {
      const ip = getClientIp(req);
      const url = new URL(req.url);
      const result = checkRateLimit(`${ip}:${url.pathname}`, config);

      const headers = {
        'X-RateLimit-Limit': String(config.maxRequests),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetAt),
      };

      if (!result.allowed) {
        return new Response(
          JSON.stringify({ success: false, error: 'Too many requests. Please try again later.' }),
          { status: 429, headers: { 'Content-Type': 'application/json', ...headers } },
        );
      }

      const response = await handler(req, ...args);
      for (const [key, value] of Object.entries(headers)) {
        response.headers.set(key, value);
      }
      return response;
    };
  };
}
