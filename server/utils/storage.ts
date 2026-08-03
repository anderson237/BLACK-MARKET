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
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')

export function isNetlifyRuntime(): boolean {
  return Boolean(process.env.NETLIFY) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME)
}

// ---- generic text/blob io ----
async function readJSON(file: string): Promise<any | null> {
  try {
    const raw = await fs.promises.readFile(file, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function writeJSON(file: string, data: any): Promise<void> {
  await fs.promises.mkdir(path.dirname(file), { recursive: true })
  await fs.promises.writeFile(file, JSON.stringify(data, null, 2), 'utf-8')
}

async function blobGet(store: string, key: string, type: 'text'): Promise<string | null>
async function blobGet(store: string, key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>
async function blobGet(store: string, key: string, type: 'text' | 'arrayBuffer'): Promise<any> {
  try {
    const s = getStore({ name: store })
    return await s.get(key, { type } as any)
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
export async function loadProducts(): Promise<any[]> {
  if (isNetlifyRuntime()) {
    const raw = await blobGet('bm-products', 'products.json', 'text')
    if (raw != null) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
    const { INITIAL_PRODUCTS } = await import('../../src/data')
    const seed = JSON.parse(JSON.stringify(INITIAL_PRODUCTS))
    await blobSet('bm-products', 'products.json', JSON.stringify(seed, null, 2))
    return seed
  }
  const parsed = await readJSON(PRODUCTS_FILE)
  return Array.isArray(parsed) ? parsed : []
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
  picture?: string
  phone?: string
  country?: string
  phonePrefix?: string
  provider: 'google' | 'password' | 'phone'
  passwordHash?: string
  salt?: string
  role: 'user' | 'admin'
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
async function loadSocial(): Promise<{ comments: any[]; likes: Record<string, number>; events: any[] }> {
  const seed = { comments: [], likes: {}, events: [] }
  if (isNetlifyRuntime()) {
    const raw = await blobGet('bm-social', 'social.json', 'text')
    if (raw != null) {
      const p = JSON.parse(raw)
      if (p && Array.isArray(p.comments)) return p
    }
    await blobSet('bm-social', 'social.json', JSON.stringify(seed, null, 2))
    return seed
  }
  const p = await readJSON(path.join(DATA_DIR, 'social.json'))
  return p && Array.isArray(p.comments) ? p : seed
}

async function saveSocial(data: any): Promise<void> {
  if (isNetlifyRuntime()) {
    return blobSet('bm-social', 'social.json', JSON.stringify(data, null, 2))
  }
  return writeJSON(path.join(DATA_DIR, 'social.json'), data)
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
  const social = await loadSocial()
  social.events.push(ev)
  social.events = social.events.slice(-20000)
  if (ev.type === 'like' || ev.type === 'unlike') {
    const id = ev.productId || 'global'
    const cur = social.likes[id] || 0
    social.likes[id] = Math.max(0, cur + (ev.type === 'like' ? 1 : -1))
  }
  await saveSocial(social)
}

export async function getSocial() {
  return loadSocial()
}

export interface Comment {
  id: string
  productId: string
  userId: string
  name: string
  picture?: string
  text: string
  createdAt: string
}

export async function getComments(productId?: string): Promise<Comment[]> {
  const social = await loadSocial()
  let comments = social.comments || []
  if (productId) comments = comments.filter((c) => c.productId === productId)
  return comments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 200)
}

export async function addComment(comment: Comment): Promise<Comment> {
  const social = await loadSocial()
  social.comments.unshift(comment)
  social.comments = social.comments.slice(0, 1000)
  await saveSocial(social)
  return comment
}

export async function deleteComment(id: string): Promise<boolean> {
  const social = await loadSocial()
  const before = social.comments.length
  social.comments = social.comments.filter((c) => c.id !== id)
  if (social.comments.length === before) return false
  await saveSocial(social)
  return true
}

export async function getLikeCount(productId: string): Promise<number> {
  const social = await loadSocial()
  return Number(social.likes[productId]) || 0
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