/**
 * Generic Zod request-validation helpers for Web Fetch API route handlers.
 *
 * No bundled schemas — bring your own. (The opencode-toolkit internal
 * version ships domain-specific schemas; those are application concerns,
 * not infrastructure, and are intentionally left out of this package.)
 */

import type { z } from 'zod';

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export function validate<T extends z.ZodType>(schema: T, data: unknown): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const error = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { success: false, error };
  }
  return { success: true, data: result.data };
}

/**
 * Wraps a JSON body handler with schema validation. Returns a 400 Response
 * on validation failure or malformed JSON; otherwise calls `handler` with
 * the parsed, typed body.
 */
export function withValidation<T extends z.ZodType, Args extends unknown[]>(
  schema: T,
  handler: (data: z.infer<T>, req: Request, ...args: Args) => Promise<Response>,
) {
  return async (req: Request, ...args: Args): Promise<Response> => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError('Invalid request body');
    }

    const result = validate(schema, body);
    if (!result.success) {
      return jsonError(result.error);
    }

    return handler(result.data, req, ...args);
  };
}

function jsonError(error: string): Response {
  return new Response(JSON.stringify({ success: false, error }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}
