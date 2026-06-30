/**
 * Baseline security header sets for HTTP responses. Framework-agnostic —
 * works with any object exposing `headers.set(key, value)` (Next.js
 * NextResponse, Web Fetch API Response, Express via a small adapter).
 */

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

const EMBED_CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-ancestors *",
  "base-uri 'self'",
];

const BASE_SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
};

/** Default headers for app pages — includes CSP and clickjacking protection. */
export const SECURITY_HEADERS: Record<string, string> = {
  ...BASE_SECURITY_HEADERS,
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': CSP_DIRECTIVES.join('; '),
};

/** Relaxed CSP for routes that are deliberately embeddable in third-party iframes. */
export const EMBED_SECURITY_HEADERS: Record<string, string> = {
  ...BASE_SECURITY_HEADERS,
  'Content-Security-Policy': EMBED_CSP_DIRECTIVES.join('; '),
};

export interface SecurityHeaderOptions {
  /** Path prefixes (or exact paths) that should receive the embeddable header set instead of the default. */
  embedPaths?: string[];
}

export function isEmbedPath(pathname: string, options?: SecurityHeaderOptions): boolean {
  const prefixes = options?.embedPaths ?? ['/embed/', '/api/embed/'];
  return prefixes.some((p) => (p.endsWith('/') ? pathname.startsWith(p) : pathname === p));
}

export function headersForPath(pathname: string, options?: SecurityHeaderOptions): Record<string, string> {
  return isEmbedPath(pathname, options) ? EMBED_SECURITY_HEADERS : SECURITY_HEADERS;
}

interface HeaderSettable {
  headers: { set(name: string, value: string): void };
}

/** Apply the appropriate header set to any response-like object exposing `headers.set`. */
export function applySecurityHeaders<T extends HeaderSettable>(
  response: T,
  pathname: string,
  options?: SecurityHeaderOptions,
): T {
  const headers = headersForPath(pathname, options);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}
