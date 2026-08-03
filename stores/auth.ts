import { defineStore } from 'pinia'

export interface AuthUser {
  id?: string
  email?: string
  name?: string
  picture?: string
  phone?: string
  phonePrefix?: string
  country?: string
  role?: 'admin' | 'user'
  status?: string
}

interface PendingAction {
  run: () => void
  label: string
}

/**
 * Client auth store.
 * - Session (JWT) + user persisted in localStorage.
 * - `requireAuth()` gates any action: if logged in it runs immediately,
 *   otherwise it opens the auth modal and replays the action on success.
 * - Phone/WhatsApp flow auto-registers on first sign-in (frictionless).
 * - Google flow sends the credential to /api/auth/google.
 */
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>('')
  const user = ref<AuthUser | null>(null)
  const initialized = ref(false)

  const modalOpen = ref(false)
  const pendingAction = ref<PendingAction | null>(null)

  const isAuthed = computed(() => !!token.value && !!user.value)
  const role = computed(() => user.value?.role || 'user')

  function load() {
    try {
      const raw = localStorage.getItem('bm_auth_v1')
      if (raw) {
        const parsed = JSON.parse(raw)
        token.value = parsed.token || ''
        user.value = parsed.user || null
      }
    } catch {}
    initialized.value = true
  }

  function persist() {
    try {
      localStorage.setItem(
        'bm_auth_v1',
        JSON.stringify({ token: token.value, user: user.value }),
      )
    } catch {}
  }

  function setSession(t: string, u: AuthUser) {
    token.value = t
    user.value = u
    persist()
  }

  function logout() {
    token.value = ''
    user.value = null
    try {
      localStorage.removeItem('bm_auth_v1')
    } catch {}
  }

  // ---- modal ----
  function openModal(label = 'Connectez-vous pour continuer') {
    load()
    modalOpen.value = true
  }

  function closeModal() {
    modalOpen.value = false
    pendingAction.value = null
  }

  /** Gate an action behind login. */
  function requireAuth(action: () => void, label = 'Cette action nécessite un compte') {
    load()
    if (isAuthed.value) {
      action()
      return true
    }
    pendingAction.value = { run: action, label }
    modalOpen.value = true
    return false
  }

  function replayPending() {
    const p = pendingAction.value
    pendingAction.value = null
    modalOpen.value = false
    if (p) p.run()
  }

  // ---- API helpers ----
  async function api(path: string, opts: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(opts.headers as Record<string, string>),
    }
    if (token.value) headers.Authorization = `Bearer ${token.value}`
    const res = await fetch(path, { ...opts, headers })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.statusMessage || json?.error || `Erreur ${res.status}`)
    return json
  }

  // ---- auth actions ----
  /** Email + password login (existing account). */
  async function loginEmail(email: string, password: string) {
    const data = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ mode: 'email', email, password }),
    })
    setSession(data.token, data.user)
    return data.user
  }

  /** Phone + country code login; auto-registers when no account exists. */
  async function loginPhone(phone: string, phonePrefix: string, country?: string) {
    try {
      const data = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ mode: 'phone', phone, phonePrefix }),
      })
      setSession(data.token, data.user)
      return data.user
    } catch (e: any) {
      if (String(e?.message || '').toLowerCase().includes('inscrivez')) {
        const reg = await api('/api/register', {
          method: 'POST',
          body: JSON.stringify({ mode: 'phone', phone, phonePrefix, country, name: '' }),
        })
        setSession(reg.token, reg.user)
        return reg.user
      }
      throw e
    }
  }

  /** Register with email + WhatsApp phone + name + password (all required). */
  async function register(name: string, email: string, password: string, phone: string, phonePrefix: string, country?: string) {
    const data = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({ mode: 'email', name, email, password, phone, phonePrefix, country }),
    })
    setSession(data.token, data.user)
    return data.user
  }

  /** Google OAuth: exchange the id_token credential with the backend. */
  async function loginGoogle(credential: string) {
    const data = await api('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    })
    setSession(data.token, data.user)
    return data.user
  }

  /** Admin console login (email + admin access key). */
  async function loginAdmin(email: string, key: string) {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: key }),
    })
    setSession(data.token, { ...data.user, role: 'admin' })
    return data.user
  }

  /** Restore session validity on app start (best-effort). */
  async function hydrate() {
    load()
    if (!token.value) return
    try {
      const data = await api('/api/me')
      if (data?.user) {
        user.value = { ...user.value, ...data.user }
        persist()
      }
    } catch {
      // Token expired/invalid -> keep local state, gate will re-ask on next action.
    }
  }

  return {
    token,
    user,
    initialized,
    isAuthed,
    role,
    modalOpen,
    load,
    hydrate,
    logout,
    openModal,
    closeModal,
    requireAuth,
    replayPending,
    loginEmail,
    loginPhone,
    register,
    loginGoogle,
    loginAdmin,
  }
})
