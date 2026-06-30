/**
 * Real-time event infrastructure: in-memory pub/sub plus an optional
 * pluggable persistence hook for SSE-style polling across requests/instances.
 *
 * No database dependency by default — `subscribe`/`publish` work standalone
 * for same-process real-time events. Call `configureEventStore` with an
 * adapter (Prisma, Redis, anything) only if you need durable, cross-instance
 * event history.
 */

export interface StoredEvent {
  id: string;
  userId: string;
  type: string;
  data: unknown;
  createdAt: Date;
}

export interface EventStore {
  create(userId: string, type: string, data: unknown): Promise<StoredEvent>;
  listSince(userId: string, sinceId?: string, limit?: number): Promise<StoredEvent[]>;
  markRead(userId: string, eventIds: string[]): Promise<void>;
}

type EventCallback = (event: { type: string; data: unknown }) => void;
const listeners = new Map<string, Set<EventCallback>>();

let store: EventStore | undefined;

/** Register a persistence adapter. Optional — omit for in-memory-only pub/sub. */
export function configureEventStore(adapter: EventStore): void {
  store = adapter;
}

export function subscribe(userId: string, callback: EventCallback): () => void {
  if (!listeners.has(userId)) listeners.set(userId, new Set());
  listeners.get(userId)!.add(callback);
  return () => listeners.get(userId)?.delete(callback);
}

export function publish(userId: string, type: string, data?: unknown): void {
  listeners.get(userId)?.forEach((cb) => cb({ type, data }));
}

/** Persists (if a store is configured) and publishes to live subscribers. */
export async function emitEvent(userId: string, type: string, data?: unknown): Promise<void> {
  if (store) {
    await store.create(userId, type, data ?? {});
  }
  publish(userId, type, data);
}

/** Poll for events newer than `sinceId`. Returns `[]` if no store is configured. */
export async function pollEvents(userId: string, sinceId?: string): Promise<StoredEvent[]> {
  if (!store) return [];
  return store.listSince(userId, sinceId, 50);
}

export async function markEventsRead(userId: string, eventIds: string[]): Promise<void> {
  if (!store) return;
  await store.markRead(userId, eventIds);
}
