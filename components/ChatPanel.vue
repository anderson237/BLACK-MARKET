<script setup lang="ts">
// Reusable chat panel (client <-> admin). Displays the messages of one thread,
// lets the current side send a message and auto-marks the thread as read.
// - side="client": uses /api/chat/* (client must own the thread)
// - side="admin":  uses /api/admin/chat/* (admin role)
const props = withDefaults(defineProps<{
  threadId: string
  side: 'client' | 'admin'
  messages: any[]
  height?: string
  placeholder?: string
  locked?: boolean
}>(), {
  height: '220px',
  placeholder: 'Écrivez votre message…',
  locked: false,
})

const emit = defineEmits<{ (e: 'sent'): void; (e: 'read'): void }>()

const text = ref('')
const sending = ref(false)
const error = ref('')
const listEl = ref<HTMLElement | null>(null)

function scrollBottom() {
  nextTick(() => {
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  })
}

let lastLen = 0
onMounted(() => {
  scrollBottom()
  lastLen = props.messages?.length || 0
  if (lastLen) markRead()
})

// Real-time: when new messages arrive while the panel is open, mark them as
// read immediately (clears the badge on both sides) and scroll down.
watch(() => props.messages?.length, (n) => {
  scrollBottom()
  if (n && n !== lastLen) {
    lastLen = n
    markRead()
  }
})

async function send() {
  const body = text.value.trim()
  if (!body || sending.value || props.locked) return
  sending.value = true
  error.value = ''
  try {
    const url = props.side === 'admin' ? '/api/admin/chat/messages' : '/api/chat/messages'
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${useAuthStore().token}` },
      body: JSON.stringify({ threadId: props.threadId, text: body }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.statusMessage || json?.message || `Erreur ${res.status}`)
    text.value = ''
    emit('sent')
    scrollBottom()
  } catch (e: any) {
    error.value = e?.message || 'Envoi impossible.'
  } finally {
    sending.value = false
  }
}

function markRead() {
  const url = props.side === 'admin' ? '/api/admin/chat/read' : '/api/chat/read'
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${useAuthStore().token}` },
    body: JSON.stringify({ threadId: props.threadId }),
  }).catch(() => {})
  emit('read')
}

function fmt(ts: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="bg-black/20 border border-zinc-800 rounded-xl overflow-hidden">
    <div ref="listEl" class="overflow-y-auto p-3 space-y-2" :style="{ maxHeight: height }">
      <div v-if="!messages || !messages.length" class="text-center py-6 text-[10px] font-mono text-zinc-600">
        AUCUN MESSAGE — LANCEZ LA CONVERSATION.
      </div>
      <div
        v-for="m in messages"
        :key="m.id"
        class="flex"
        :class="m.from === 'admin' ? (side === 'admin' ? 'justify-end' : 'justify-start') : (side === 'admin' ? 'justify-start' : 'justify-end')"
      >
        <div
          class="max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed break-words"
          :class="(side === 'admin' && m.from === 'admin') || (side === 'client' && m.from === 'client')
            ? 'bg-[#ff2a2a]/90 text-white rounded-br-sm'
            : 'bg-[#1c1c26] text-slate-200 border border-zinc-800 rounded-bl-sm'"
        >
          <p class="whitespace-pre-wrap">{{ m.text }}</p>
          <p class="text-[8px] font-mono opacity-70 mt-1" :class="(side === 'admin' && m.from === 'admin') || (side === 'client' && m.from === 'client') ? 'text-white/80' : 'text-zinc-500'">
            {{ m.from === 'admin' ? 'DEEP ROOTS' : 'Vous' }} · {{ fmt(m.ts) }}
          </p>
        </div>
      </div>
    </div>

    <form v-if="!locked" @submit.prevent="send" class="flex items-center gap-2 border-t border-zinc-800 bg-black/30 px-2 py-2">
      <input
        v-model="text"
        :placeholder="placeholder"
        maxlength="2000"
        class="flex-1 min-w-0 bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors"
      />
      <button
        type="submit"
        :disabled="sending || !text.trim()"
        class="shrink-0 w-9 h-9 rounded-lg bg-[#ff2a2a] hover:bg-red-600 disabled:opacity-40 flex items-center justify-center text-white transition-all"
        :title="sending ? 'Envoi…' : 'Envoyer'"
      >
        <span v-if="sending" class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        <AppIcon v-else name="send" :size="15" />
      </button>
    </form>
    <div v-else class="border-t border-zinc-800 bg-black/30 px-3 py-2.5 text-center">
      <p class="text-[10px] font-mono text-zinc-500">
        <AppIcon name="lock" :size="11" class="inline mr-1" />
        COMMANDE LIVRÉE — DISCUSSION FERMÉE (lecture seule)
      </p>
    </div>
    <p v-if="error" class="text-[10px] font-mono text-[#ff2a2a] px-3 pb-2">{{ error }}</p>
  </div>
</template>
