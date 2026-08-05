import { getStore } from '@netlify/blobs'
import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Shared Nitro backend persistence. Mirrors the proven Express blob layer so
// the production data (products, orders, users, uploads) keeps working with
// zero migration of existing data.
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), 'data')
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json')
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const EXPENSES_FILE = path.join(DATA_DIR, 'expenses.json')
const TREASURY_FILE = path.join(DATA_DIR, 'treasury.json')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')

export function isNetlifyRuntime(): boolean {
  return Boolean(process.env.NETLIFY) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME)
}

// ---- generic text/blob io ----
async function readJSON(file: string): Promise<any | null> {
  try {
    const raw = await fs.promises.readFile(file, 'utf-8')
    // Some editors/scripts save UTF-8 files with a BOM, which breaks JSON.parse.
    return JSON.parse(raw.replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
}

async function writeJSON(file: string, data: any): Promise<void> {
  await fs.promises.mkdir(path.dirname(file), { recursive: true })
  await fs.promises.writeFile(file, JSON.stringify(data, null, 2), 'utf-8')
}

// ---- in-process serialization for shared JSON stores ----
// Mutations do a read-modify-write on one file/blob. Without serialization two
// concurrent requests (page view/like/share events racing a comment POST) can
// overwrite each other's changes — a freshly posted comment silently disappears
// (then editing it fails with "commentaire introuvable"). This queue makes each
// mutation atomic within the process.
const mutexes = new Map<string, Promise<unknown>>()

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = mutexes.get(key) || Promise.resolve()
  const run = prev.then(() => fn())
  mutexes.set(key, run.then(() => undefined, () => undefined))
  return run
}

async function blobGet(store: string, key: string, type: 'text', consistency?: 'eventual' | 'strong'): Promise<string | null>
async function blobGet(store: string, key: string, type: 'arrayBuffer', consistency?: 'eventual' | 'strong'): Promise<ArrayBuffer | null>
async function blobGet(store: string, key: string, type: 'text' | 'arrayBuffer', consistency: 'eventual' | 'strong' = 'eventual'): Promise<any> {
  try {
    const s = getStore({ name: store })
    return await s.get(key, { type, consistency } as any)
  } catch (err) {
    console.error(`[BLOBS] get ${store}/${key} failed:`, err)
    return null
  }
}

async function blobSet(store: string, key: string, value: string | Buffer): Promise<void> {
  const s = getStore({ name: store })
  await s.set(key, value)
}

// ---- products ----
function normalizeProduct(p: any): any {
  if (!p || typeof p !== 'object') return p
  p.stockStatus = p.stockStatus === 'in_stock' ? 'in_stock' : 'preorder'
  p.stockQuantity = Number(p.stockQuantity) || 0
  p.moq = Math.max(0, Number(p.moq) || 0)
  p.featuredMedia = p.featuredMedia === 'image' ? 'image' : p.videoUrl ? 'video' : 'image'
  return p
}

export async function loadProducts(): Promise<any[]> {
  if (isNetlifyRuntime()) {
    const raw = await blobGet('bm-products', 'products.json', 'text')
    if (raw != null) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(normalizeProduct)
    }
    const { INITIAL_PRODUCTS } = await import('../../src/data')
    const seed = JSON.parse(JSON.stringify(INITIAL_PRODUCTS)).map(normalizeProduct)
    await blobSet('bm-products', 'products.json', JSON.stringify(seed, null, 2))
    return seed
  }
  const parsed = await readJSON(PRODUCTS_FILE)
  return Array.isArray(parsed) ? parsed.map(normalizeProduct) : []
}

export async function saveProducts(products: any[]): Promise<void> {
  if (isNetlifyRuntime()) {
    return blobSet('bm-products', 'products.json', JSON.stringify(products, null, 2))
  }
  return writeJSON(PRODUCTS_FILE, products)
}

// ---- orders ----
export async function loadOrders(): Promise<any[]> {
  if (isNetlifyRuntime()) {
    const raw = await blobGet('bm-orders', 'orders.json', 'text')
    if (raw != null) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
    return []
  }
  const parsed = await readJSON(ORDERS_FILE)
  return Array.isArray(parsed) ? parsed : []
}

export async function saveOrders(orders: any[]): Promise<void> {
  if (isNetlifyRuntime()) {
    return blobSet('bm-orders', 'orders.json', JSON.stringify(orders, null, 2))
  }
  return writeJSON(ORDERS_FILE, orders)
}

// ---- expenses (accounting) ----
export async function loadExpenses(): Promise<any[]> {
  if (isNetlifyRuntime()) {
    const raw = await blobGet('bm-expenses', 'expenses.json', 'text')
    if (raw != null) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
    return []
  }
  const parsed = await readJSON(EXPENSES_FILE)
  return Array.isArray(parsed) ? parsed : []
}

export async function saveExpenses(expenses: any[]): Promise<void> {
  if (isNetlifyRuntime()) {
    return blobSet('bm-expenses', 'expenses.json', JSON.stringify(expenses, null, 2))
  }
  return writeJSON(EXPENSES_FILE, expenses)
}

// ---- treasury (cash ledger: settings + manual in/out entries) ----
export interface TreasuryData {
  settings: { initialBalanceXof: number }
  entries: any[]
}

const SEED_TREASURY: TreasuryData = { settings: { initialBalanceXof: 0 }, entries: [] }

export async function loadTreasury(): Promise<TreasuryData> {
  if (isNetlifyRuntime()) {
    const raw = await blobGet('bm-treasury', 'treasury.json', 'text')
    if (raw != null) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return {
          settings: { initialBalanceXof: Number(parsed.settings?.initialBalanceXof) || 0 },
          entries: Array.isArray(parsed.entries) ? parsed.entries : [],
        }
      }
    }
    return JSON.parse(JSON.stringify(SEED_TREASURY))
  }
  const parsed = await readJSON(TREASURY_FILE)
  if (parsed && typeof parsed === 'object') {
    return {
      settings: { initialBalanceXof: Number(parsed.settings?.initialBalanceXof) || 0 },
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    }
  }
  return JSON.parse(JSON.stringify(SEED_TREASURY))
}

export async function saveTreasury(data: TreasuryData): Promise<void> {
  if (isNetlifyRuntime()) {
    return blobSet('bm-treasury', 'treasury.json', JSON.stringify(data, null, 2))
  }
  return writeJSON(TREASURY_FILE, data)
}

// ---- KPI assumptions (ad spend, fees, returns, fixed costs) ----
const KPI_SETTINGS_FILE = path.join(DATA_DIR, 'kpi-settings.json')

export async function loadKpiSettings(): Promise<any> {
  if (isNetlifyRuntime()) {
    const raw = await blobGet('bm-kpi-settings', 'settings.json', 'text')
    if (raw != null) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') return parsed
      } catch {
        /* corrupted -> seed */
      }
    }
    return {}
  }
  return (await readJSON(KPI_SETTINGS_FILE)) || {}
}

export async function saveKpiSettings(settings: any): Promise<void> {
  if (isNetlifyRuntime()) {
    return blobSet('bm-kpi-settings', 'settings.json', JSON.stringify(settings, null, 2))
  }
  return writeJSON(KPI_SETTINGS_FILE, settings)
}

// ---- users ----
export type BMUsers = { admins: string[]; logins: any[]; accounts: any[] }
export async function loadUsers(): Promise<BMUsers> {
  const seed = (): BMUsers => ({ admins: [], logins: [], accounts: [] })
  if (isNetlifyRuntime()) {
    const raw = await blobGet('bm-users', 'users.json', 'text')
    if (raw != null) {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.accounts)) return parsed
    }
    const initial = seed()
    await blobSet('bm-users', 'users.json', JSON.stringify(initial, null, 2))
    return initial
  }
  const parsed = await readJSON(USERS_FILE)
  return parsed && Array.isArray(parsed.accounts) ? parsed : seed()
}

export async function saveUsers(users: BMUsers): Promise<void> {
  if (isNetlifyRuntime()) {
    return blobSet('bm-users', 'users.json', JSON.stringify(users, null, 2))
  }
  return writeJSON(USERS_FILE, users)
}

// ---- public user accounts (customers) ----
export interface PublicAccount {
  id: string
  email?: string
  name?: string
  pseudo?: string
  picture?: string
  mood?: string
  phone?: string
  country?: string
  phonePrefix?: string
  provider: 'google' | 'password' | 'phone'
  passwordHash?: string
  salt?: string
  role: 'user' | 'editor' | 'publisher' | 'admin'
  status: 'active' | 'blocked'
  createdAt: string
  lastLoginAt?: string
}

const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json')

async function loadAccountsFile(): Promise<PublicAccount[]> {
  if (isNetlifyRuntime()) {
    const raw = await blobGet('bm-accounts', 'accounts.json', 'text')
    if (raw != null) {
      const p = JSON.parse(raw)
      if (Array.isArray(p)) return p
    }
    await blobSet('bm-accounts', 'accounts.json', JSON.stringify([], null, 2))
    return []
  }
  const p = await readJSON(ACCOUNTS_FILE)
  return Array.isArray(p) ? p : []
}

export async function loadAccounts(): Promise<PublicAccount[]> {
  return loadAccountsFile()
}

export async function saveAccounts(accounts: PublicAccount[]): Promise<void> {
  if (isNetlifyRuntime()) {
    return blobSet('bm-accounts', 'accounts.json', JSON.stringify(accounts, null, 2))
  }
  return writeJSON(ACCOUNTS_FILE, accounts)
}

export async function findAccount(match: Partial<PublicAccount>): Promise<PublicAccount | null> {
  const accounts = await loadAccounts()
  return accounts.find((a) =>
    Object.entries(match).every(([k, v]) => a[k as keyof PublicAccount] === v),
  ) || null
}

export async function upsertAccount(account: PublicAccount): Promise<PublicAccount> {
  const accounts = await loadAccounts()
  const idx = accounts.findIndex((a) => a.id === account.id || a.email === account.email)
  if (idx >= 0) accounts[idx] = { ...accounts[idx], ...account }
  else accounts.unshift(account)
  await saveAccounts(accounts)
  return idx >= 0 ? accounts[idx] : account
}

// ---- social data (comments, likes, events) ----
// Single source of truth for every interaction: comments, the like index and
// the event log live together so admin analytics and the client space always
// read the same numbers.
//  - `likes`       : net like count per product (productId -> count)
//  - `likedBy`     : users currently liking a product (productId -> userIds)
//  - `likedByUser` : products currently liked by a user (userId -> productIds)
type SocialShape = {
  comments: any[]
  likes: Record<string, number>
  likedBy: Record<string, string[]>
  likedByUser: Record<string, string[]>
  events: any[]
}
const SOCIAL_SEED: SocialShape = { comments: [], likes: {}, likedBy: {}, likedByUser: {}, events: [] }

/** Rebuild the like index from the event log (migration + cap-trim recovery). */
function rebuildLikeIndex(events: any[]) {
  const likedBy: Record<string, string[]> = {}
  const likedByUser: Record<string, string[]> = {}
  for (const e of events) {
    if (e.type !== 'like' && e.type !== 'unlike') continue
    const pid = String(e.productId || '')
    const uid = String(e.userId || '')
    if (!pid || !uid) continue
    const liked = e.type === 'like'
    likedBy[pid] = likedBy[pid] || []
    likedByUser[uid] = likedByUser[uid] || []
    likedBy[pid] = likedBy[pid].filter((x) => x !== uid)
    likedByUser[uid] = likedByUser[uid].filter((x) => x !== pid)
    if (liked) {
      likedBy[pid].push(uid)
      likedByUser[uid].push(pid)
    }
  }
  return { likedBy, likedByUser }
}

function normalizeSocial(raw: any): SocialShape {
  if (!raw || !Array.isArray(raw.comments)) return { ...SOCIAL_SEED }
  const base = {
    comments: raw.comments,
    likes: raw.likes && typeof raw.likes === 'object' ? raw.likes : {},
    likedBy: raw.likedBy && typeof raw.likedBy === 'object' ? raw.likedBy : {},
    likedByUser: raw.likedByUser && typeof raw.likedByUser === 'object' ? raw.likedByUser : {},
    events: Array.isArray(raw.events) ? raw.events : [],
  }
  if (!base.likedBy || !base.likedByUser || Object.keys(base.likedBy).length === 0 && Object.keys(base.likedByUser).length === 0) {
    const rebuilt = rebuildLikeIndex(base.events)
    base.likedBy = rebuilt.likedBy
    base.likedByUser = rebuilt.likedByUser
  }
  return base
}

async function loadSocial(): Promise<SocialShape> {
  if (isNetlifyRuntime()) {
    // Strong consistency so a comment POST is immediately visible on the very
    // next GET, even across different serverless instances.
    const raw = await blobGet('bm-social', 'social.json', 'text', 'strong')
    if (raw != null) {
      return normalizeSocial(JSON.parse(raw))
    }
    await blobSet('bm-social', 'social.json', JSON.stringify(SOCIAL_SEED, null, 2))
    return SOCIAL_SEED
  }
  const p = await readJSON(path.join(DATA_DIR, 'social.json'))
  return normalizeSocial(p)
}

async function saveSocial(data: any): Promise<void> {
  if (isNetlifyRuntime()) {
    return blobSet('bm-social', 'social.json', JSON.stringify(data, null, 2))
  }
  return writeJSON(path.join(DATA_DIR, 'social.json'), data)
}

// Atomic read-modify-write on the social store.
//  - Local dev: in-process mutex (`withLock`) serializes every mutation.
//  - Production (Netlify Blobs, multiple function instances): Netlify Blobs has
//    no atomic RMW, but `set` supports an ETag precondition. We read the
//    current ETag + data, compute the next state, and write with
//    `onlyIfMatch`. If another instance wrote in between, the write is refused
//    (`modified: false`) and we re-read + retry. This closes the lost-update
//    race where a page view event racing a comment POST silently dropped the
//    freshly posted comment.
async function mutateSocial<T>(
  mutate: (social: SocialShape) => { next: SocialShape | null; value: T },
): Promise<T> {
  if (isNetlifyRuntime()) {
    const s = getStore({ name: 'bm-social' })
    for (let attempt = 0; attempt < 10; attempt++) {
      let current: { etag?: string; data?: any } | null = null
      try {
        current = await s.getWithMetadata('social.json', { type: 'text', consistency: 'strong' } as any)
      } catch (err) {
        console.error('[BLOBS] social read failed:', err)
      }
      let data: SocialShape = { ...SOCIAL_SEED }
      if (current?.data != null) {
        try {
          const parsed = JSON.parse(String(current.data))
          if (parsed && Array.isArray(parsed.comments)) data = parsed
        } catch {
          // corrupted payload -> start from seed
        }
      }
      const { next, value } = mutate(JSON.parse(JSON.stringify(data)))
      if (next == null) return value
      const write = await s.set('social.json', JSON.stringify(next, null, 2), { onlyIfMatch: current?.etag } as any)
      if (write?.modified !== false) return value
      // CAS conflict: another instance committed a newer version -> retry.
    }
    throw new Error('[BLOBS] CAS conflict on bm-social/social.json')
  }
  return withLock('social', async () => {
    const social = await loadSocial()
    const { next, value } = mutate(social)
    if (next != null) await saveSocial(social)
    return value
  })
}

export async function resetSocial(): Promise<void> {
  await mutateSocial((social) => {
    social.comments = []
    social.likes = {}
    social.likedBy = {}
    social.likedByUser = {}
    social.events = []
    return { next: social, value: undefined }
  })
}

export interface MarketEvent {
  type: 'view' | 'click' | 'like' | 'unlike' | 'share' | 'copy' | 'comment'
  productId?: string
  productTitle?: string
  url?: string
  ts: number
  userId?: string
  ip?: string
}

export async function pushEvent(ev: MarketEvent): Promise<void> {
  await mutateSocial((social) => {
    social.events.push(ev)
    social.events = social.events.slice(-20000)
    if (ev.type === 'like' || ev.type === 'unlike') {
      const pid = ev.productId || 'global'
      const uid = ev.userId || ''
      const cur = social.likes[pid] || 0
      social.likes[pid] = Math.max(0, cur + (ev.type === 'like' ? 1 : -1))
      // Keep the per-product and per-user like index in sync so every screen
      // (product likes, "plus aimés", client space) derives from the SAME data.
      if (uid) {
        social.likedBy[pid] = social.likedBy[pid] || []
        social.likedByUser[uid] = social.likedByUser[uid] || []
        social.likedBy[pid] = social.likedBy[pid].filter((x) => x !== uid)
        social.likedByUser[uid] = social.likedByUser[uid].filter((x) => x !== pid)
        if (ev.type === 'like') {
          social.likedBy[pid].push(uid)
          social.likedByUser[uid].push(pid)
        }
      }
    }
    return { next: social, value: undefined }
  })
}

/** Product ids currently liked by a user (single source: the like index). */
export async function getLikedProductIds(userId: string): Promise<string[]> {
  return withLock('social', async () => {
    const social = await loadSocial()
    return social.likedByUser[String(userId)] || []
  })
}

/** Users currently liking a product + net count (single source: the like index). */
export async function getLikeIndex(): Promise<{ likedBy: Record<string, string[]>; likes: Record<string, number> }> {
  return withLock('social', async () => {
    const social = await loadSocial()
    return { likedBy: social.likedBy || {}, likes: social.likes || {} }
  })
}

export async function getSocial() {
  return withLock('social', () => loadSocial())
}

export interface Comment {
  id: string
  productId: string
  userId: string
  name: string
  picture?: string
  text: string
  createdAt: string
  editedAt?: string
  likes?: number
  dislikes?: number
  reports?: number
  likedBy?: string[]
  dislikedBy?: string[]
  reportedBy?: string[]
}

function withCommentDefaults(c: Comment): Comment {
  return {
    likes: 0,
    dislikes: 0,
    reports: 0,
    likedBy: [],
    dislikedBy: [],
    reportedBy: [],
    ...c,
  }
}

export async function getComments(productId?: string): Promise<Comment[]> {
  return withLock('social', async () => {
    const social = await loadSocial()
    let comments = social.comments || []
    if (productId) comments = comments.filter((c) => c.productId === productId)
    return comments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 200)
  })
}

export async function getCommentCount(productId?: string): Promise<number> {
  return withLock('social', async () => {
    const social = await loadSocial()
    const comments = social.comments || []
    if (!productId) return comments.length
    return comments.reduce((n, c) => n + (c.productId === productId ? 1 : 0), 0)
  })
}

export async function addComment(comment: Comment): Promise<Comment> {
  const full = withCommentDefaults(comment)
  return mutateSocial((social) => {
    social.comments.unshift(full)
    social.comments = social.comments.slice(0, 1000)
    return { next: social, value: full }
  })
}

export async function deleteComment(id: string): Promise<boolean> {
  return mutateSocial((social) => {
    const before = social.comments.length
    social.comments = social.comments.filter((c) => c.id !== id)
    return { next: before === social.comments.length ? null : social, value: before !== social.comments.length }
  })
}

// Client space: a user may delete only their own comment.
export async function deleteCommentIfOwner(id: string, userId: string): Promise<boolean> {
  return mutateSocial((social) => {
    const target = social.comments.find((c) => c.id === id)
    if (!target) return { next: null, value: false }
    if (String(target.userId || '') !== String(userId)) throw new Error('Ce commentaire ne vous appartient pas.')
    const before = social.comments.length
    social.comments = social.comments.filter((c) => c.id !== id)
    return { next: before === social.comments.length ? null : social, value: before !== social.comments.length }
  })
}

// Client space: a user may edit the text of their own comment.
export async function updateCommentIfOwner(id: string, userId: string, text: string): Promise<Comment | null> {
  return mutateSocial((social) => {
    const idx = social.comments.findIndex((c) => c.id === id)
    if (idx < 0) return { next: null, value: null }
    const target = social.comments[idx]
    if (String(target.userId || '') !== String(userId)) throw new Error('Ce commentaire ne vous appartient pas.')
    const updated = withCommentDefaults({ ...target, text, editedAt: new Date().toISOString() })
    social.comments[idx] = updated
    return { next: social, value: updated }
  })
}

// Any logged-in user may like/dislike any comment (toggle). Liking clears a
// previous dislike and vice-versa. Counts are derived from the userId arrays.
export async function toggleCommentReaction(id: string, userId: string, kind: 'like' | 'dislike'): Promise<Comment | null> {
  return mutateSocial((social) => {
    const idx = social.comments.findIndex((c) => c.id === id)
    if (idx < 0) return { next: null, value: null }
    const c = withCommentDefaults(social.comments[idx])
    const likedBy = Array.isArray(c.likedBy) ? [...c.likedBy] : []
    const dislikedBy = Array.isArray(c.dislikedBy) ? [...c.dislikedBy] : []
    if (kind === 'like') {
      const at = likedBy.indexOf(userId)
      if (at >= 0) likedBy.splice(at, 1)
      else {
        likedBy.push(userId)
        const di = dislikedBy.indexOf(userId)
        if (di >= 0) dislikedBy.splice(di, 1)
      }
    } else {
      const at = dislikedBy.indexOf(userId)
      if (at >= 0) dislikedBy.splice(at, 1)
      else {
        dislikedBy.push(userId)
        const li = likedBy.indexOf(userId)
        if (li >= 0) likedBy.splice(li, 1)
      }
    }
    const updated = { ...c, likedBy, dislikedBy, likes: likedBy.length, dislikes: dislikedBy.length }
    social.comments[idx] = updated
    return { next: social, value: updated }
  })
}

// Any logged-in user may report a comment once; reports surface in the admin
// analytics so a moderator can review them.
export async function reportComment(id: string, userId: string): Promise<{ comment: Comment | null; alreadyReported: boolean }> {
  return mutateSocial((social) => {
    const idx = social.comments.findIndex((c) => c.id === id)
    if (idx < 0) return { next: null, value: { comment: null, alreadyReported: false } }
    const c = withCommentDefaults(social.comments[idx])
    const reportedBy = Array.isArray(c.reportedBy) ? [...c.reportedBy] : []
    if (reportedBy.includes(userId)) return { next: null, value: { comment: c, alreadyReported: true } }
    reportedBy.push(userId)
    const updated = { ...c, reportedBy, reports: reportedBy.length }
    social.comments[idx] = updated
    return { next: social, value: { comment: updated, alreadyReported: false } }
  })
}

// Client space: a user may remove one of their own tracked events.
export async function deleteUserEvent(userId: string, ts: number): Promise<boolean> {
  return mutateSocial((social) => {
    const before = social.events.length
    social.events = social.events.filter((e) => !(String(e.userId || '') === String(userId) && Number(e.ts) === Number(ts)))
    return { next: before === social.events.length ? null : social, value: before !== social.events.length }
  })
}

export async function getLikeCount(productId: string): Promise<number> {
  return withLock('social', async () => {
    const social = await loadSocial()
    return Number(social.likes[productId]) || 0
  })
}

// ---- images / videos ----
export async function saveImage(id: string, buffer: Buffer): Promise<void> {
  if (isNetlifyRuntime()) return blobSet('bm-images', id + '.jpg', buffer)
  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true })
  await fs.promises.writeFile(path.join(UPLOADS_DIR, id + '.jpg'), buffer)
}

export async function loadImage(id: string): Promise<Buffer | null> {
  if (isNetlifyRuntime()) {
    const data = await blobGet('bm-images', id + '.jpg', 'arrayBuffer')
    return data ? Buffer.from(data) : null
  }
  try {
    return await fs.promises.readFile(path.join(UPLOADS_DIR, id + '.jpg'))
  } catch {
    return null
  }
}

export async function saveVideo(id: string, buffer: Buffer): Promise<void> {
  if (isNetlifyRuntime()) return blobSet('bm-videos', id + '.mp4', buffer)
  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true })
  await fs.promises.writeFile(path.join(UPLOADS_DIR, id + '.mp4'), buffer)
}

export async function loadVideo(id: string): Promise<Buffer | null> {
  if (isNetlifyRuntime()) {
    const data = await blobGet('bm-videos', id + '.mp4', 'arrayBuffer')
    return data ? Buffer.from(data) : null
  }
  try {
    return await fs.promises.readFile(path.join(UPLOADS_DIR, id + '.mp4'))
  } catch {
    return null
  }
}

// ---- images / video signature validation (security) ----
export function looksLikeImage(buffer: Buffer): boolean {
  const sigs: { magic: number[]; offset: number }[] = [
    { magic: [0xff, 0xd8, 0xff], offset: 0 },
    { magic: [0x89, 0x50, 0x4e, 0x47], offset: 0 },
    { magic: [0x47, 0x49, 0x46, 0x38], offset: 0 },
    { magic: [0x52, 0x49, 0x46, 0x46], offset: 0 },
    { magic: [0x42, 0x4d], offset: 0 },
  ]
  for (const { magic, offset } of sigs) {
    if (buffer.length >= offset + magic.length) {
      let ok = true
      for (let i = 0; i < magic.length; i++) {
        if (buffer[offset + i] !== magic[i]) { ok = false; break }
      }
      if (ok) return true
    }
  }
  return false
}

export function looksLikeVideo(buffer: Buffer): boolean {
  if (buffer.length < 12) return false
  const ascii = (from: number, len: number) => buffer.slice(from, from + len).toString('latin1')
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4).toLowerCase()
    return /^(isom|mp4|avc1|qt|heic|m4v|3gp)/.test(brand)
  }
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return buffer.toString('latin1').includes('webm') || buffer.toString('latin1').includes('matroska')
  }
  return false
}

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000