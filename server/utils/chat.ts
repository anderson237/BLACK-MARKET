import { loadChat, saveChat, withLock, type ChatThread, type ChatMessage } from '~~/server/utils/storage'

export interface ChatUnread {
  threadId: string
  kind: 'preorder' | 'order'
  count: number
}

export function preThreadId(userId: string): string {
  return `pre:${userId}`
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
  thread: { id: string; kind: 'preorder' | 'order'; userId: string; orderId?: string; productTitle?: string; customerName?: string },
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
  })
}

export async function markAdminRead(threadId: string, ts?: number): Promise<void> {
  await withLock('chat', async () => {
    const threads = await loadChat()
    const t = threads.find((x) => x.id === threadId)
    if (!t) return
    t.adminReadTs = ts || Date.now()
    await saveChat(threads)
  })
}

/**
 * When a preorder becomes a confirmed order, carry every message over so the
 * conversation is preserved. Returns the new order thread.
 */
export async function migratePreorderToOrder(orderId: string, userId: string, meta: { productTitle?: string; customerName?: string }): Promise<ChatThread | null> {
  const preId = preThreadId(userId)
  const ordId = ordThreadId(orderId)
  return withLock('chat', async () => {
    const threads = await loadChat()
    const pre = threads.find((x) => x.id === preId)
    if (!pre || !pre.messages?.length) return null
    let ord = threads.find((x) => x.id === ordId)
    const now = Date.now()
    if (!ord) {
      ord = {
        id: ordId,
        kind: 'order',
        userId,
        orderId,
        productTitle: meta.productTitle || pre.productTitle,
        customerName: meta.customerName || pre.customerName,
        messages: [],
        clientReadTs: pre.clientReadTs || 0,
        adminReadTs: pre.adminReadTs || 0,
        createdAt: now,
        updatedAt: now,
      }
      threads.push(ord)
    }
    // Copy messages only if the order thread has none yet (dedupe on re-confirm).
    if (!ord.messages?.length) {
      ord.messages = (pre.messages || []).map((m) => ({ ...m }))
    }
    ord.updatedAt = now
    await saveChat(threads)
    return ord
  })
}
