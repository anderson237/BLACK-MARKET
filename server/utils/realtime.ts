import type { ChatThread } from '~~/server/utils/storage'

// ---------------------------------------------------------------------------
// In-process pub/sub used to push chat updates to connected SSE clients in
// real time ("tick to tack"). Each connected client subscribes to its own
// channel; the admin console subscribes to the shared `admin` channel.
//
// NOTE (serverless): this registry is per-instance. On Netlify Lambda the
// POST and the SSE connection can land on different instances; the client
// stores therefore combine this push with a fast polling fallback so a
// message is never delayed more than ~2s regardless of instance affinity.
// ---------------------------------------------------------------------------

type Handler = (payload: Record<string, unknown>) => void

const channels = new Map<string, Set<Handler>>()

export function subscribe(channel: string, handler: Handler): () => void {
  if (!channels.has(channel)) channels.set(channel, new Set())
  channels.get(channel)!.add(handler)
  return () => {
    channels.get(channel)?.delete(handler)
    if (channels.get(channel)?.size === 0) channels.delete(channel)
  }
}

export function publish(channel: string, payload: Record<string, unknown>): void {
  const set = channels.get(channel)
  if (!set || set.size === 0) return
  for (const handler of set) {
    try {
      handler(payload)
    } catch {
      /* a failing subscriber must never break the others */
    }
  }
}

/**
 * Broadcast that a thread changed (message added / read state moved).
 * Delivered to the thread owner's channel and to the admin console.
 */
export function publishChatUpdate(thread: { id: string; kind?: string; userId?: string }, action: 'message' | 'read' | 'migrated' = 'message'): void {
  const payload: Record<string, unknown> = {
    type: 'chat',
    action,
    threadId: thread.id,
    kind: thread.kind || 'unknown',
    userId: thread.userId || '',
    at: Date.now(),
  }
  if (thread.userId) publish(`user:${thread.userId}`, payload)
  publish('admin', payload)
}

// ---------------------------------------------------------------------------
// Site-wide events: broadcast that the catalog / orders / stats changed so
// every open page (public catalogue, product page, client space, admin
// console) can refresh instantly instead of waiting for its slow poll or a
// manual reload. Same per-instance caveat as chat: a public SSE fallback
// poll keeps the site fresh even across serverless instance splits.
// ---------------------------------------------------------------------------
export function publishSiteUpdate(kind: 'catalog' | 'orders' | 'stats'): void {
  publish('site', { type: 'site', kind, at: Date.now() })
}
