# @flomisma/core-open

MIT-licensed infrastructure primitives extracted from production Flomisma services. No proprietary business logic, no settlement or fund-movement code — just the plumbing every backend needs and shouldn't have to write twice.

Built on the standard Web Fetch API (`Request`/`Response`), so it works in Next.js route handlers, Hono, Remix, Bun, Deno, and Cloudflare Workers without adaptation.

## What's in here

| Module | Exports | Purpose |
|---|---|---|
| `rate-limit` | `checkRateLimit`, `withRateLimit`, `getClientIp` | In-memory sliding-window rate limiter with a route-handler wrapper |
| `validate` | `validate`, `withValidation` | Zod-backed request validation HOF — bring your own schemas |
| `security-headers` | `SECURITY_HEADERS`, `EMBED_SECURITY_HEADERS`, `applySecurityHeaders` | Baseline CSP/HSTS/clickjacking header sets, with an opt-in relaxed policy for embeddable routes |
| `helpers` | `formatCurrency`, `formatDate`, `timeAgo`, `truncate`, `cn`, `generateId` | Small dependency-free formatting utilities |
| `events` | `subscribe`, `publish`, `emitEvent`, `pollEvents`, `configureEventStore` | In-memory pub/sub with an optional pluggable persistence adapter for SSE-style polling |

## Install

```bash
npm install @flomisma/core-open zod
```

`zod` is a peer dependency, required only if you use `validate`/`withValidation`.

## Usage

```ts
import { withRateLimit, withValidation, applySecurityHeaders } from '@flomisma/core-open';
import { z } from 'zod';

const schema = z.object({ email: z.string().email() });

export const POST = withRateLimit({ maxRequests: 10, windowMs: 60_000 })(
  withValidation(schema, async (body, req) => {
    return Response.json({ ok: true, email: body.email });
  }),
);
```

```ts
// middleware.ts
import { applySecurityHeaders } from '@flomisma/core-open';

export function middleware(req: Request) {
  const res = NextResponse.next();
  return applySecurityHeaders(res, new URL(req.url).pathname);
}
```

```ts
// Durable events with your own store (Prisma example)
import { configureEventStore, emitEvent, pollEvents } from '@flomisma/core-open';
import { prisma } from './db';

configureEventStore({
  create: (userId, type, data) => prisma.sseEvent.create({ data: { userId, type, data } }),
  listSince: async (userId, sinceId, limit = 50) => {
    const where: Record<string, unknown> = { userId };
    if (sinceId) {
      const last = await prisma.sseEvent.findUnique({ where: { id: sinceId } });
      if (last) where.createdAt = { gt: last.createdAt };
    }
    return prisma.sseEvent.findMany({ where, orderBy: { createdAt: 'asc' }, take: limit });
  },
  markRead: (userId, eventIds) =>
    prisma.sseEvent.updateMany({ where: { id: { in: eventIds }, userId }, data: { read: true } }).then(() => {}),
});
```

## What's intentionally not here

This package stays on the utility side of the line. It does not include:

- Domain-specific Zod schemas (those are application concerns)
- Database clients or ORM models
- Anything touching settlement, escrow, fund movement, or ledger state — that logic lives in Flomisma's licensed packages (`@flomisma/escrow-fsm`, `@flomisma/escrow-state-machine`), which carry separate regulatory and licensing considerations

## License

MIT — see `LICENSE`.
