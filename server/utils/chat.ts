import { loadChat, saveChat, withLock, type ChatThread, type ChatMessage } from '~~/server/utils/storage'
import { publishChatUpdate } from '~~/server/utils/realtime'

export interface ChatUnread {
  threadId: string
  kind: 'preorder' | 'order' | 'general'
  count: number
}

export function preThreadId(userId: string): string {
  return `pre:${userId}`
}

/** Thread of one preorder ARTICLE (cart item): `pre:<userId>:<productId>`. */
export function preItemThreadId(userId: string, productId: string): string {
  return `pre:${userId}:${productId}`
}

export function generalThreadId(userId: string): string {
  return `general:${userId}`
}

export function ordThreadId(orderId: string): string {
  return `ord:${orderId}`
}

export function clientUnreadCount(t: ChatThread, ts: number): number {
  return (t.messages || []).filter((m) => m.from === 'admin' && m.ts > ts).length
}

export function adminUnreadCount(t: ChatThread, ts: number): number {
  return (t.messages || []).filter((m) => m.from === 'client' && m.ts > ts).length
}

/** Threads visible by one client (pre + order) + their unread counts. */
export async function getClientThreads(userId: string): Promise<ChatThread[]> {
  const threads = await loadChat()
  return threads
    .filter((t) => t.userId === userId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/** All threads (admin view) + joined customer info is handled by the route. */
export async function getAllThreads(): Promise<ChatThread[]> {
  const threads = await loadChat()
  return threads.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getThread(id: string): Promise<ChatThread | null> {
  const threads = await loadChat()
  return threads.find((t) => t.id === id) || null
}

/** Upsert a thread (creates it if missing) and append a message atomically. */
export async function addMessage(
  thread: { id: string; kind: 'preorder' | 'order' | 'general'; userId: string; orderId?: string; productId?: string; productTitle?: string; customerName?: string },
  from: 'client' | 'admin',
  text: string,
): Promise<ChatThread> {
  return withLock('chat', async () => {
    const threads = await loadChat()
    let t = threads.find((x) => x.id === thread.id)
    const now = Date.now()
    if (!t) {
      t = {
        id: thread.id,
        kind: thread.kind,
        userId: thread.userId,
        orderId: thread.orderId,
        productId: thread.productId,
        productTitle: thread.productTitle,
        customerName: thread.customerName,
        messages: [],
        clientReadTs: 0,
        adminReadTs: 0,
        createdAt: now,
        updatedAt: now,
      }
      threads.push(t)
    }
    const msg: ChatMessage = {
      id: `m_${now}_${Math.random().toString(36).slice(2, 8)}`,
      from,
      text: String(text).slice(0, 2000),
      ts: now,
    }
    t.messages = t.messages || []
    t.messages.push(msg)
    t.updatedAt = now
    // The author has obviously "read" up to now.
    if (from === 'client') t.clientReadTs = now
    else t.adminReadTs = now
    await saveChat(threads)
    // Real-time: push the update to the owner + the admin console.
    publishChatUpdate(t, 'message')
    return t
  })
}

export async function markClientRead(threadId: string, ts?: number): Promise<void> {
  await withLock('chat', async () => {
    const threads = await loadChat()
    const t = threads.find((x) => x.id === threadId)
    if (!t) return
    t.clientReadTs = ts || Date.now()
    await saveChat(threads)
    publishChatUpdate(t, 'read')
  })
}

export async function markAdminRead(threadId: string, ts?: number): Promise<void> {
  await withLock('chat', async () => {
    const threads = await loadChat()
    const t = threads.find((x) => x.id === threadId)
    if (!t) return
    t.adminReadTs = ts || Date.now()
    await saveChat(threads)
    publishChatUpdate(t, 'read')
  })
}

/**
 * When a preorder becomes a confirmed order, carry every conversation over so
 * nothing is lost: the legacy basket thread (`pre:<userId>`) AND every per-item
 * thread (`pre:<userId>:<productId>`) are merged into the order thread
 * (dedupe by message id). Returns the new order thread.
 */
export async function migratePreorderToOrder(orderId: string, userId: string, meta: { productTitle?: string; customerName?: string }): Promise<ChatThread | null> {
  const ordId = ordThreadId(orderId)
  const prefix = `pre:${userId}:`
  return withLock('chat', async () => {
    const threads = await loadChat()
    const preThreads = threads.filter((x) => x.id === preThreadId(userId) || x.id.startsWith(prefix))
    if (!preThreads.length) return null

    let ord = threads.find((x) => x.id === ordId)
    const now = Date.now()
    if (!ord) {
      ord = {
        id: ordId,
        kind: 'order',
        userId,
        orderId,
        productTitle: meta.productTitle || preThreads[0]?.productTitle,
        customerName: meta.customerName || preThreads[0]?.customerName,
        messages: [],
        clientReadTs: 0,
        adminReadTs: 0,
        createdAt: now,
        updatedAt: now,
      }
      threads.push(ord)
    }
    if (!ord.messages?.length) {
      const seen = new Set<string>()
      const merged: ChatMessage[] = []
      for (const pre of preThreads) {
        for (const m of pre.messages || []) {
          if (seen.has(m.id)) continue
          seen.add(m.id)
          merged.push({ ...m })
        }
      }
      merged.sort((a, b) => a.ts - b.ts)
      ord.messages = merged
      ord.clientReadTs = Math.max(...preThreads.map((p) => p.clientReadTs || 0), ord.clientReadTs || 0)
      ord.adminReadTs = Math.max(...preThreads.map((p) => p.adminReadTs || 0), ord.adminReadTs || 0)
    }
    ord.updatedAt = now
    await saveChat(threads)
    // Real-time: both sides should refresh to see the conversation carried over.
    for (const pre of preThreads) publishChatUpdate(pre, 'migrated')
    publishChatUpdate(ord, 'migrated')
    return ord
  })
}
