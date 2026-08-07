<script setup lang="ts">
import { formatPriceXof } from '~/composables/useCatalog'
import { useCurrency } from '~/composables/useCurrency'

definePageMeta({ layout: 'admin' })

const store = useAdminStore()
const adminChat = useAdminChatStore()
const config = useRuntimeConfig()
const { format } = useCurrency()

const loading = ref(false)
const error = ref('')
const carts = ref<any[]>([])
const search = ref('')
const expanded = ref<Record<string, boolean>>({})
const chatOpen = ref<Record<string, boolean>>({})

// Reminder pass
const reminderLoading = ref(false)
const reminderResult = ref<any>(null)

// Email test (RESEND config validation) — sends ONE email to the given address.
const testEmail = ref('')
const testSending = ref(false)
const testResult = ref<any>(null)
async function sendTestEmail() {
  testSending.value = true
  testResult.value = null
  try {
    const res = await fetch('/api/admin/email-test', {
      method: 'POST',
      headers: store.headers(),
      body: JSON.stringify({ to: testEmail.value.trim() || undefined }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok && json.success === undefined) throw new Error(json?.statusMessage || `Erreur ${res.status}`)
    testResult.value = json
  } catch (e: any) {
    testResult.value = { success: false, reason: e?.message || 'Erreur réseau.' }
  } finally {
    testSending.value = false
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/admin/carts', { headers: store.headers() })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.statusMessage || json?.message || `Erreur ${res.status}`)
    carts.value = Array.isArray(json?.carts) ? json.carts : []
  } catch (e: any) {
    error.value = e?.message || 'Impossible de charger les paniers.'
  } finally {
    loading.value = false
  }
}

/** Run the automated reminder pass (dry-run: never sends without RESEND_API_KEY). */
async function runReminder() {
  reminderLoading.value = true
  reminderResult.value = null
  try {
    const res = await fetch('/api/admin/reminders/run', {
      method: 'POST',
      headers: store.headers(),
      body: JSON.stringify({ dryRun: true, abandonedHours: 24 }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.statusMessage || json?.message || `Erreur ${res.status}`)
    reminderResult.value = json
    // Refresh the list (lastReminder info will appear once exposed by the API).
    await load()
  } catch (e: any) {
    error.value = e?.message || 'Impossible de lancer le rappel.'
  } finally {
    reminderLoading.value = false
  }
}

onMounted(() => {
  load()
  adminChat.load()
})

// Chat helpers (ST-012) — preorder threads (basket + per article) unread per
// basket + toggle panels (basket, per article).
const preChatUnreadFor = (userId: string) =>
  adminChat.threads.reduce((s, t) => s + (t.kind === 'preorder' && t.userId === userId ? t.unread || 0 : 0), 0)
function toggleChat(userId: string) {
  chatOpen.value[userId] = !chatOpen.value[userId]
  if (chatOpen.value[userId]) adminChat.load(true)
}
function onAdminChatSent() {
  adminChat.refresh()
}
const itemChatOpen = ref<Record<string, boolean>>({})
const itemChatKey = (userId: string, productId: string) => `${userId}::${productId}`
function itemThreadFor(userId: string, productId: string) {
  return adminChat.threadFor(`pre:${userId}:${productId}`)
}
function itemThreadUnreadFor(userId: string, productId: string) {
  const t = itemThreadFor(userId, productId)
  return t ? t.unread || 0 : 0
}
function toggleItemChat(userId: string, productId: string) {
  const k = itemChatKey(userId, productId)
  itemChatOpen.value[k] = !itemChatOpen.value[k]
  if (itemChatOpen.value[k]) adminChat.load(true)
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return carts.value
  return carts.value.filter((c) =>
    String(c.customer?.name || '').toLowerCase().includes(q) ||
    String(c.customer?.email || '').toLowerCase().includes(q) ||
    String(c.customer?.phone || '').toLowerCase().includes(q) ||
    String(c.customer?.country || '').toLowerCase().includes(q) ||
    String(c.items?.map((i: any) => i.title).join(' ') || '').toLowerCase().includes(q),
  )
})

const totalAbandoned = computed(() => carts.value.length)
const totalArticles = computed(() => carts.value.reduce((s, c) => s + Number(c.itemsCount || 0), 0))
const totalValue = computed(() => carts.value.reduce((s, c) => s + Number(c.totalXof || 0), 0))

function toggle(id: string) {
  expanded.value[id] = !expanded.value[id]
}

function timeAgo(iso: string): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'à l\'instant'
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `il y a ${days} j`
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** Remove a non-confirmed basket entirely (admin cleanup). */
async function removeCart(c: any) {
  if (!c?.userId) return
  const name = String(c.customer?.name || c.userId).slice(0, 40)
  if (!confirm(`Supprimer définitivement le panier non confirmé de « ${name} » ?\n\nCette action retire la précommande et son fil de discussion.`)) return
  try {
    const res = await fetch(`/api/admin/carts/${encodeURIComponent(c.userId)}`, { method: 'DELETE', headers: store.headers() })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.statusMessage || json?.message || `Erreur ${res.status}`)
    await load()
  } catch (e: any) {
    error.value = e?.message || 'Impossible de supprimer ce panier.'
  }
}

/** CSV export of the current (filtered) baskets — Excel FR friendly. */
function exportCsv() {
  const rows = filtered.value.map((c) => {
    const detail = (c.items || [])
      .map((i: any) => `${String(i.title || '').replace(/"/g, '""')} x${i.quantity} (${formatPriceXof(i.priceXof)})`)
      .join(' | ')
    return {
      'Client': String(c.customer?.name || ''),
      'Email': String(c.customer?.email || ''),
      'Téléphone': String(c.customer?.phone || ''),
      'Pays': String(c.customer?.country || ''),
      'Articles': String(c.itemsCount ?? 0),
      'Total (F CFA)': String(c.totalXof ?? 0),
      'Dernière activité': c.addedAt ? new Date(c.addedAt).toLocaleString('fr-FR') : '',
      'Détail': detail,
      'Lien WhatsApp': relanceUrl(c),
    }
  })
  const cols = Object.keys(rows[0] || {})
  const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = '\uFEFF' + cols.join(';') + '\n' + rows.map((r) => cols.map((k) => esc(r[k as keyof typeof r])).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `paniers-non-confirmes-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** WhatsApp follow-up message targeting one basket. */
function relanceUrl(c: any): string {
  const lines = (c.items || []).map((i: any) => `• ${String(i.title || '').toUpperCase()} — ${i.quantity} × ${formatPriceXof(i.priceXof)}`)
  const num = String(c.customer?.phone || config.public.phoneNumber || '').replace(/[^0-9]/g, '')
  const msg = `Bonjour ${String(c.customer?.name || '')},\n\nNous avons remarqué que vous n'avez pas encore confirmé vos précommandes chez DEEP ROOTS :\n\n${lines.join('\n')}\n\n💰 TOTAL : ${formatPriceXof(c.totalXof)}\n\nConfirmez-les simplement en répondant à ce message ! Merci 🙏`
  return 'https://wa.me/' + num + '?text=' + encodeURIComponent(msg)
}
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-lg font-extrabold text-white font-mono uppercase tracking-widest">Paniers non confirmés</h1>
        <p class="text-[11px] text-zinc-500 font-mono mt-1">Précommandes ajoutées au panier sans confirmation — à relancer.</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button @click="exportCsv" :disabled="filtered.length === 0"
          class="shrink-0 inline-flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white text-xs font-mono font-bold px-4 py-2 rounded-xl transition-all">
          ⬇ EXPORTER CSV
        </button>
        <button @click="load" :disabled="loading"
          class="shrink-0 inline-flex items-center justify-center gap-2 bg-[#ff2a2a] hover:bg-red-600 disabled:opacity-40 text-white text-xs font-mono font-bold px-4 py-2 rounded-xl transition-all">
          <span v-if="loading" class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          <template v-else>⟳ ACTUALISER</template>
        </button>
      </div>
    </div>

    <p v-if="error" class="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 font-mono">{{ error }}</p>

    <!-- KPI -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
      <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Paniers en attente</p>
        <p class="text-2xl font-black font-mono text-white">{{ totalAbandoned }}</p>
      </div>
      <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Articles non confirmés</p>
        <p class="text-2xl font-black font-mono text-white">{{ totalArticles }}</p>
      </div>
      <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Valeur potentielle</p>
        <p class="text-2xl font-black font-mono text-[#ff2a2a]">{{ format(totalValue) }}</p>
      </div>
    </div>

    <!-- Reminder pass -->
    <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800 mb-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p class="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Rappel automatique des paniers abandonnés</p>
          <p class="text-[10px] font-mono text-zinc-600 mt-1">
            Tâche planifiée (toutes les heures) : envoie de vrais emails si <span class="text-zinc-300">RESEND_API_KEY</span> est configurée. Le bouton ci-dessous lance un <span class="text-emerald-400">test à blanc (dry-run)</span> — aucun email réel envoyé.
          </p>
        </div>
        <button @click="runReminder" :disabled="reminderLoading"
          class="shrink-0 inline-flex items-center justify-center gap-2 bg-[#ff2a2a] hover:bg-red-600 disabled:opacity-40 text-white text-xs font-mono font-bold px-4 py-2 rounded-xl transition-all">
          <span v-if="reminderLoading" class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          <template v-else>⟳ LANCER LE RAPPEL</template>
        </button>
      </div>

      <!-- Email config test (RESEND) -->
      <div class="mt-3 border-t border-zinc-900 pt-3">
        <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">
          📧 Tester l'envoi d'email (Resend) — <span class="text-zinc-300">envoie UN email de test</span>
        </p>
        <div class="flex flex-col sm:flex-row gap-2">
          <input v-model="testEmail" placeholder="Adresse de destination (vide = votre adresse admin)"
            class="flex-1 bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
          <button @click="sendTestEmail" :disabled="testSending"
            class="shrink-0 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-mono font-bold px-4 py-2 rounded-xl transition-all">
            <span v-if="testSending" class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            <template v-else>ENVOYER LE TEST</template>
          </button>
        </div>
        <p v-if="testResult" class="mt-2 text-[11px] font-mono rounded-lg p-2 border"
          :class="testResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'">
          {{ testResult.success ? `✅ Email envoyé vers ${testResult.to} (expéditeur : ${testResult.from}) — vérifiez votre boîte mail.` : `❌ Échec : ${testResult.reason || testResult.status || 'erreur inconnue'}` }}
        </p>
        <p class="mt-1 text-[9px] font-mono text-zinc-600">
          Mode test (onboarding@resend.dev) : seul votre adresse Resend peut recevoir. Mode production : domaine vérifié requis pour envoyer aux clients.
        </p>
      </div>
      <div v-if="reminderResult" class="mt-3 border-t border-zinc-900 pt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
        <div class="bg-black/40 border border-zinc-900 rounded-lg p-2">
          <p class="text-lg font-black font-mono text-white">{{ reminderResult.candidates?.length ?? 0 }}</p>
          <p class="text-[8px] font-mono text-zinc-500 uppercase">Paniers à relancer</p>
        </div>
        <div class="bg-black/40 border border-zinc-900 rounded-lg p-2">
          <p class="text-lg font-black font-mono text-[#ff2a2a]">{{ reminderResult.dryRun ? '—' : reminderResult.sent }}</p>
          <p class="text-[8px] font-mono text-zinc-500 uppercase">Emails envoyés</p>
        </div>
        <div class="bg-black/40 border border-zinc-900 rounded-lg p-2">
          <p class="text-lg font-black font-mono text-white">{{ reminderResult.skippedNoContact }}</p>
          <p class="text-[8px] font-mono text-zinc-500 uppercase">Sans contact</p>
        </div>
        <div class="bg-black/40 border border-zinc-900 rounded-lg p-2">
          <p class="text-lg font-black font-mono text-white">{{ reminderResult.skippedCooldown }}</p>
          <p class="text-[8px] font-mono text-zinc-500 uppercase">Cooldown</p>
        </div>
        <div class="bg-black/40 border border-zinc-900 rounded-lg p-2">
          <p class="text-lg font-black font-mono" :class="reminderResult.dryRun ? 'text-amber-400' : 'text-emerald-400'">{{ reminderResult.dryRun ? 'DRY-RUN' : 'ACTIF' }}</p>
          <p class="text-[8px] font-mono text-zinc-500 uppercase">Mode</p>
        </div>
      </div>
    </div>

    <!-- Search -->
    <div class="mb-4">
      <input v-model="search" placeholder="Rechercher par client, email, téléphone, pays, produit…"
        class="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
    </div>

    <!-- List -->
    <div v-if="loading" class="space-y-3">
      <div v-for="n in 4" :key="n" class="skeleton h-20 rounded-xl" />
    </div>

    <div v-else-if="filtered.length === 0" class="text-center py-14 text-zinc-600 font-mono text-[11px]">
      {{ carts.length === 0 ? 'AUCUN PANIER EN ATTENTE — BIEN JOUÉ !' : 'AUCUN RÉSULTAT POUR CETTE RECHERCHE.' }}
    </div>

    <div v-else class="space-y-3">
      <div v-for="c in filtered" :key="c.userId" class="bg-[#12121a] border border-zinc-800 rounded-2xl overflow-hidden">
        <!-- Header row -->
        <div class="flex items-center gap-3 p-4 flex-wrap">
          <img v-if="c.customer?.picture" :src="c.customer.picture" alt="" class="w-10 h-10 rounded-full object-cover border border-zinc-700 shrink-0" />
          <div v-else class="w-10 h-10 rounded-full bg-[#ff2a2a]/15 border border-[#ff2a2a]/40 flex items-center justify-center text-[#ff2a2a] font-black shrink-0">
            {{ String(c.customer?.name || '?').slice(0, 2).toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-bold text-slate-100 truncate">{{ c.customer?.name }}</p>
            <p class="text-[10px] font-mono text-zinc-500 truncate">
              <template v-if="c.customer?.phone">{{ c.customer.phone }} · </template>
              <template v-if="c.customer?.email">{{ c.customer.email }} · </template>
              {{ c.customer?.country || '—' }}
            </p>
          </div>
          <div class="text-right shrink-0">
            <div class="flex items-center justify-end gap-2">
              <p class="text-[10px] font-mono text-zinc-400">{{ c.itemsCount }} article{{ c.itemsCount > 1 ? 's' : '' }}</p>
              <span v-if="preChatUnreadFor(c.userId)" class="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-white px-2 py-0.5 rounded-lg border border-[#ff2a2a]/50 bg-[#ff2a2a]/20" title="Messages non lus du client">
                <AppIcon name="message" :size="11" />{{ preChatUnreadFor(c.userId) }}
              </span>
            </div>
            <p class="text-sm font-black font-mono text-[#ff2a2a]">{{ format(c.totalXof) }}</p>
            <p class="text-[9px] font-mono text-zinc-600">{{ timeAgo(c.addedAt) }}</p>
          </div>
        </div>

        <!-- Items (collapsible) -->
        <div v-if="expanded[c.userId]" class="px-4 pb-3 space-y-1.5 border-t border-zinc-900 pt-3">
          <div v-for="item in c.items" :key="item.productId" class="bg-black/30 border border-zinc-900 rounded-lg overflow-hidden">
            <div class="flex items-center gap-3 p-2">
              <img v-if="item.imageUrl" :src="item.imageUrl" alt="" class="w-9 h-9 rounded-md object-cover border border-zinc-800 shrink-0" />
              <div v-else class="w-9 h-9 rounded-md bg-[#16161d] border border-zinc-800 flex items-center justify-center text-[#ff2a2a] shrink-0"><AppIcon name="cart" :size="12" /></div>
              <div class="flex-1 min-w-0">
                <p class="text-[11px] font-bold text-slate-200 truncate">{{ item.title }}</p>
                <p class="text-[9px] font-mono text-zinc-500">x{{ item.quantity }} · {{ formatPriceXof(item.priceXof) }} · {{ timeAgo(item.addedAt) }}</p>
              </div>
              <div class="flex flex-col items-end gap-1.5 shrink-0">
                <button @click="toggleItemChat(c.userId, item.productId)"
                  class="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-1.5 rounded-lg border transition-all cursor-pointer"
                  :class="itemChatOpen[itemChatKey(c.userId, item.productId)] ? 'bg-[#ff2a2a]/15 border-[#ff2a2a]/60 text-[#ff2a2a]' : 'border-zinc-700 text-zinc-300 hover:border-[#ff2a2a]/60 hover:text-white'">
                  <AppIcon name="message" :size="11" />
                  <span>{{ itemChatOpen[itemChatKey(c.userId, item.productId)] ? 'Fermer' : 'Message' }}</span>
                  <span v-if="itemThreadUnreadFor(c.userId, item.productId)" class="px-1 rounded-full bg-[#ff2a2a] text-white text-[9px] leading-4 min-w-[15px] text-center">{{ itemThreadUnreadFor(c.userId, item.productId) }}</span>
                </button>
                <NuxtLink :to="`/p/${item.productId}.html`" target="_blank" class="text-[9px] font-mono text-[#ff2a2a] hover:underline shrink-0">VOIR →</NuxtLink>
              </div>
            </div>
            <!-- Chat par article (accordéon) -->
            <div v-if="itemChatOpen[itemChatKey(c.userId, item.productId)]" class="border-t border-zinc-800 bg-[#0d0d14]">
              <ChatPanel
                :key="'pre:' + c.userId + ':' + item.productId"
                :thread-id="'pre:' + c.userId + ':' + item.productId"
                side="admin"
                :messages="itemThreadFor(c.userId, item.productId)?.messages || []"
                :locked="itemThreadFor(c.userId, item.productId)?.locked || false"
                height="180px"
                placeholder="Répondre au client…"
                @sent="onAdminChatSent"
                @read="onAdminChatSent"
              />
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2 px-4 pb-4 pt-1 flex-wrap">
          <button @click="toggle(c.userId)"
            class="inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-300 hover:text-white border border-zinc-800 px-3 py-2 rounded-xl transition-all">
            <AppIcon name="chevronDown" :size="12" :class="expanded[c.userId] ? 'rotate-180' : ''" /> {{ expanded[c.userId] ? 'MASQUER' : 'DÉTAILS' }}
          </button>
          <button @click="toggleChat(c.userId)"
            class="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#ff2a2a] hover:text-white border border-[#ff2a2a]/40 hover:border-[#ff2a2a]/80 px-3 py-2 rounded-xl transition-all">
            <AppIcon name="message" :size="12" /> {{ chatOpen[c.userId] ? 'FERMER LE CHAT' : 'DISCUTER AVEC LE CLIENT' }}
            <span v-if="preChatUnreadFor(c.userId)" class="px-1 rounded-full bg-[#ff2a2a] text-white text-[9px] leading-4 min-w-[16px] text-center">{{ preChatUnreadFor(c.userId) }}</span>
          </button>
          <a :href="relanceUrl(c)" target="_blank" rel="noopener"
            class="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-mono font-bold px-3 py-2 rounded-xl transition-all">
            <AppIcon name="whatsapp" :size="12" /> RELANCER SUR WHATSAPP
          </a>
          <button @click="removeCart(c)"
            class="inline-flex items-center gap-1.5 text-[10px] font-mono text-red-400 hover:text-white border border-red-500/40 hover:border-red-500 px-3 py-2 rounded-xl transition-all">
            <AppIcon name="trash2" :size="12" /> SUPPRIMER
          </button>
        </div>

        <!-- Chat client <-> admin (ST-012) -->
        <div v-if="chatOpen[c.userId]" class="px-4 pb-4 border-t border-zinc-900 pt-3">
          <ChatPanel
            :key="'pre:' + c.userId"
            :thread-id="'pre:' + c.userId"
            side="admin"
            :messages="adminChat.threadFor('pre:' + c.userId)?.messages || []"
            placeholder="Répondre au client…"
            @sent="onAdminChatSent"
            @read="onAdminChatSent"
          />
        </div>
      </div>
    </div>
  </div>
</template>
