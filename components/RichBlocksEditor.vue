<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

// --------------------------------------------------------------------------
// Block-based rich editor with drag & drop reordering.
// Serializes blocks into clean HTML (h1-h3/p/ul/blockquote/img/video).
// --------------------------------------------------------------------------
interface Block {
  id: string
  type: 'heading' | 'paragraph' | 'list' | 'quote' | 'image' | 'video'
  level: 1 | 2 | 3
  text: string
  items: string[]
  src: string
  align: 'left' | 'center' | 'right'
}

const props = withDefaults(defineProps<{ modelValue: string }>(), { modelValue: '' })
const emit = defineEmits<{ 'update:modelValue': [v: string]; change: [] }>()

const blocks = ref<Block[]>([])
const draggingId = ref<string | null>(null)
const overId = ref<string | null>(null)
const showingHtml = ref(false)
const htmlDraft = ref('')
const showEmoji = ref(false)
const focusEl = ref<HTMLTextAreaElement | HTMLInputElement | null>(null)
let uid = 0
const nid = () => `b${Date.now()}_${uid++}`

// Rich emoji palette for sales copy / descriptions.
const EMOJIS = [
  '🔥', '⚡', '🚀', '💥', '👑', '💎', '✨', '🎯', '🛍️', '📦', '🚚', '📦📦',
  '🇨🇳', '🇩🇪', '🇫🇷', '💶', '💰', '🤑', '✅', '❌', '⚠️', '⭐', '🌟', '💯',
  '🖤', '❤️', '🔴', '⚫', '🎧', '👟', '🧢', '🕶️', '💻', '🎮', '⌨️', '🖱️',
  '📱', '🔋', '⚙️', '🔧', '🧠', '👁️', '🤝', '💬', '📞', '📲', '🎁', '🏆',
  '🆕', '🎬', '📸', '🖼️', '🎨', '⏳', '📅', '🕐', '📍', '🌍', '🛫', '✈️',
  '👍', '👌', '💪', '🙌', '👏', '😍', '🤩', '😎', '🤯', '🚨', '🔊', '🔒',
]

function sanitize(raw: string): string {
  return String(raw || '')
    .slice(0, 60000)
    .replace(/<(script|style|iframe|object|embed|form)[^>]*>.*?<\/\1>/gis, '')
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
}

function emptyParagraph(): Block {
  return { id: nid(), type: 'paragraph', text: '', align: 'left', items: [], src: '', level: 2 }
}

function parseHtml(html: string): Block[] {
  const doc = new DOMParser().parseFromString(sanitize(html), 'text/html')
  const out: Block[] = []
  const children = Array.from(doc.body.children || [])
  for (const el of children) {
    const tag = (el.tagName || '').toLowerCase()
    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      out.push({ id: nid(), type: 'heading', level: (Number(tag.slice(1)) || 2) as any, text: el.textContent || '', align: 'left', items: [], src: '' })
    } else if (tag === 'img') {
      out.push({ id: nid(), type: 'image', src: el.getAttribute('src') || '', align: 'left', text: '', items: [], level: 2 })
    } else if (tag === 'video') {
      out.push({ id: nid(), type: 'video', src: el.getAttribute('src') || '', align: 'left', text: '', items: [], level: 2 })
    } else if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(el.querySelectorAll('li')).map((li) => li.textContent || '')
      out.push({ id: nid(), type: 'list', items, align: 'left', text: '', src: '', level: 2 })
    } else if (tag === 'blockquote') {
      out.push({ id: nid(), type: 'quote', text: el.textContent || '', align: 'left', items: [], src: '', level: 2 })
    } else if (tag === 'p' || tag === 'div' || el.textContent?.trim()) {
      out.push({ id: nid(), type: 'paragraph', text: el.textContent?.trim() || '', align: 'left', items: [], src: '', level: 2 })
    }
  }
  if (!out.length) out.push(emptyParagraph())
  return out
}

function esc(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function serialize(): string {
  const parts: string[] = []
  for (const b of blocks.value) {
    const al = b.align && b.align !== 'left' ? ` style="text-align:${b.align}"` : ''
    if (b.type === 'heading') parts.push(`<h${b.level}${al}>${esc(b.text) || '&nbsp;'}</h${b.level}>`)
    else if (b.type === 'paragraph') parts.push(`<p${al}>${esc(b.text) || '&nbsp;'}</p>`)
    else if (b.type === 'quote') parts.push(`<blockquote${al}>${esc(b.text)}</blockquote>`)
    else if (b.type === 'list') parts.push(`<ul${al}>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`)
    else if (b.type === 'image') parts.push(`<img src="${esc(b.src)}" alt="" style="max-width:100%;${b.align === 'center' ? 'margin:0 auto;display:block;' : ''}" />`)
    else if (b.type === 'video') parts.push(`<video src="${esc(b.src)}" controls style="max-width:100%" />`)
  }
  return parts.join('\n')
}

function emitHtml() {
  emit('update:modelValue', serialize())
  emit('change')
}

onMounted(() => {
  blocks.value = props.modelValue ? parseHtml(props.modelValue) : [emptyParagraph()]
})

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return
    const a = serialize().replace(/\s+/g, '')
    const b = sanitize(v).replace(/\s+/g, '')
    if (a !== b) blocks.value = parseHtml(v)
  },
)

// ---- ops ----
function add(type: Block['type']) {
  const base = { id: nid(), align: 'left' as const, items: [] as string[], src: '', level: 2 as const, text: '' }
  if (type === 'heading') blocks.value.push({ ...base, type })
  else if (type === 'paragraph') blocks.value.push({ ...base, type })
  else if (type === 'list') blocks.value.push({ ...base, type, items: [''] })
  else if (type === 'quote') blocks.value.push({ ...base, type })
  else if (type === 'image') { const s = window.prompt('URL de l\'image :'); if (s) blocks.value.push({ ...base, type, src: s }) }
  else if (type === 'video') { const s = window.prompt('URL de la vidéo (.mp4/.webm) :'); if (s) blocks.value.push({ ...base, type, src: s }) }
  emitHtml()
}

function moveBlock(id: string, dir: -1 | 1) {
  const i = blocks.value.findIndex((b) => b.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= blocks.value.length) return
  const arr = [...blocks.value]
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  blocks.value = arr
  emitHtml()
}

function removeBlock(id: string) {
  blocks.value = blocks.value.filter((b) => b.id !== id)
  emitHtml()
}

function dragStart(id: string, e: DragEvent) {
  draggingId.value = id
  ;(e.dataTransfer as any)?.setData('text/plain', id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function dragOver(id: string, e: DragEvent) {
  e.preventDefault()
  overId.value = id
}
function dropOn(id: string, e: DragEvent) {
  e.preventDefault()
  const from = draggingId.value || ((e.dataTransfer as any)?.getData('text/plain') as string)
  const i = blocks.value.findIndex((b) => b.id === from)
  const j = blocks.value.findIndex((b) => b.id === id)
  if (i >= 0 && j >= 0 && i !== j) {
    const arr = [...blocks.value]
    const [moved] = arr.splice(i, 1)
    arr.splice(j, 0, moved)
    blocks.value = arr
    emitHtml()
  }
  draggingId.value = null
  overId.value = null
}
function dragEnd() {
  draggingId.value = null
  overId.value = null
}

function toggleHtml() {
  showingHtml.value = !showingHtml.value
  if (showingHtml.value) htmlDraft.value = serialize()
  else {
    blocks.value = parseHtml(htmlDraft.value)
    emitHtml()
  }
}

function rememberFocus(el: Event) {
  focusEl.value = (el.target as HTMLTextAreaElement | HTMLInputElement) || null
}

function insertEmoji(emoji: string) {
  const el = focusEl.value
  if (!el) return
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  const next = el.value.slice(0, start) + emoji + el.value.slice(end)
  el.value = next
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.focus()
  el.selectionStart = el.selectionEnd = start + emoji.length
  showEmoji.value = false
}

const addBtn =
  'inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer bg-black/50 text-zinc-400 border border-zinc-700/50 hover:bg-[#ff2a2a]/15 hover:text-[#ff2a2a] hover:border-[#ff2a2a]/40'
const blockHandle = 'cursor-grab active:cursor-grabbing text-zinc-600 hover:text-[#ff2a2a] select-none text-sm px-1 shrink-0'
</script>

<template>
  <div class="rounded-xl overflow-hidden border border-zinc-700/60 bg-black/40">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-1 p-1.5 bg-[#0d0d14] border-b border-zinc-700/60 select-none">
      <span class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest hidden sm:inline">Blocs :</span>
      <button type="button" :class="addBtn" title="Titre H2" @click="add('heading')">H2 +</button>
      <button type="button" :class="addBtn" title="Paragraphe" @click="add('paragraph')">Txt +</button>
      <button type="button" :class="addBtn" title="Liste" @click="add('list')">☰ +</button>
      <button type="button" :class="addBtn" title="Citation" @click="add('quote')">❝ +</button>
      <button type="button" :class="addBtn" title="Image" @click="add('image')">🖼 +</button>
      <button type="button" :class="addBtn" title="Vidéo" @click="add('video')">▶ +</button>
      <div class="relative">
        <button type="button" :class="addBtn" title="Insérer un emoji" @click="showEmoji = !showEmoji">😀</button>
        <!-- Emoji palette -->
        <div v-if="showEmoji" class="absolute z-30 left-0 top-full mt-1 w-64 max-h-52 overflow-y-auto bg-[#12121a] border border-zinc-700/70 rounded-xl shadow-2xl p-2 grid grid-cols-6 gap-0.5" style="scrollbar-width:thin">
          <button v-for="e in EMOJIS" :key="e" type="button" @click="insertEmoji(e)"
            class="w-8 h-8 flex items-center justify-center rounded-lg text-lg hover:bg-[#ff2a2a]/20 hover:scale-110 transition-transform cursor-pointer" :title="e">{{ e }}</button>
        </div>
      </div>
      <div class="ml-auto flex items-center gap-1">
        <button type="button" @click="toggleHtml"
          class="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
          :class="showingHtml ? 'bg-[#ff2a2a]/15 text-[#ff2a2a] border border-[#ff2a2a]/40' : 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white'"
          title="Code source / Visuel">&lt;/&gt;</button>
      </div>
    </div>

    <!-- Source mode -->
    <div v-if="showingHtml">
      <textarea v-model="htmlDraft" spellcheck="false"
        class="w-full h-44 bg-black/60 px-3 py-2.5 font-mono text-[11px] text-emerald-400 focus:outline-none resize-y"
        placeholder="Collez ou éditez le HTML..."></textarea>
    </div>

    <!-- Blocks -->
    <div v-else class="divide-y divide-zinc-800/70">
      <div
        v-for="(b, idx) in blocks"
        :key="b.id"
        :class="['group relative flex items-stretch gap-1 px-1.5 py-1.5 transition-colors', overId === b.id ? 'bg-[#ff2a2a]/10 ring-1 ring-[#ff2a2a]/30' : 'hover:bg-zinc-900/40']"
        draggable="true"
        @dragstart="dragStart(b.id, $event)"
        @dragover="dragOver(b.id, $event)"
        @drop="dropOn(b.id, $event)"
        @dragend="dragEnd"
      >
        <span :class="blockHandle" title="Déplacer (drag & drop)">⠿</span>

        <div class="flex-1 min-w-0">
          <template v-if="b.type === 'heading'">
            <textarea :value="b.text" @input="b.text = ($event.target as HTMLTextAreaElement).value; emitHtml()" @focus="rememberFocus"
              class="w-full bg-transparent font-extrabold text-slate-100 focus:outline-none resize-none"
              :class="[b.level === 1 ? 'text-lg' : b.level === 2 ? 'text-base' : 'text-sm']"
              rows="1" :placeholder="`Titre H${b.level}`"></textarea>
          </template>

          <template v-else-if="b.type === 'paragraph'">
            <textarea :value="b.text" @input="b.text = ($event.target as HTMLTextAreaElement).value; emitHtml()" @focus="rememberFocus"
              class="w-full bg-transparent text-[13px] text-slate-200 focus:outline-none resize-none leading-relaxed"
              rows="2" placeholder="Écrivez votre paragraphe..."></textarea>
          </template>

          <template v-else-if="b.type === 'quote'">
            <textarea :value="b.text" @input="b.text = ($event.target as HTMLTextAreaElement).value; emitHtml()" @focus="rememberFocus"
              class="w-full bg-transparent text-[13px] text-slate-200 italic border-l-2 border-[#ff2a2a]/60 pl-2 focus:outline-none resize-none"
              rows="2" placeholder="Citation..."></textarea>
          </template>

          <template v-else-if="b.type === 'list'">
            <div class="space-y-1">
              <div v-for="(it, ii) in b.items" :key="ii" class="flex items-center gap-1.5">
                <span class="text-[#ff2a2a]">•</span>
                <input :value="it" @input="b.items[ii] = ($event.target as HTMLInputElement).value; emitHtml()" @focus="rememberFocus"
                  class="flex-1 bg-transparent text-[13px] text-slate-200 focus:outline-none" placeholder="Élément de liste" />
                <button type="button" @click="b.items.splice(ii, 1); emitHtml()" class="text-red-400 hover:text-red-300 text-[11px]">✕</button>
              </div>
              <button type="button" @click="b.items.push(''); emitHtml()" class="text-[10px] font-mono text-[#ff2a2a] hover:underline">+ Ajouter un point</button>
            </div>
          </template>

          <template v-else-if="b.type === 'image'">
            <div class="flex flex-wrap items-center gap-2">
              <img v-if="b.src" :src="b.src" alt="" class="h-16 max-w-full rounded-lg object-cover border border-zinc-700" @error="($event.target as HTMLImageElement).style.display='none'" />
              <input :value="b.src" @input="b.src = ($event.target as HTMLInputElement).value; emitHtml()" placeholder="URL de l'image"
                class="flex-1 min-w-0 bg-black/40 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50" />
            </div>
          </template>

          <template v-else-if="b.type === 'video'">
            <div class="flex flex-wrap items-center gap-2">
              <video v-if="b.src" :src="b.src" controls class="max-h-20 max-w-full rounded-lg border border-zinc-700"></video>
              <input :value="b.src" @input="b.src = ($event.target as HTMLInputElement).value; emitHtml()" placeholder="URL de la vidéo"
                class="flex-1 min-w-0 bg-black/40 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50" />
            </div>
          </template>

          <!-- Controls -->
          <div class="flex items-center gap-1.5 mt-1 flex-wrap">
            <template v-if="b.type === 'heading'">
              <button type="button" v-for="l in [1, 2, 3]" :key="l" @click="b.level = l as any; emitHtml()"
                class="text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors"
                :class="b.level === l ? 'bg-[#ff2a2a]/20 text-[#ff2a2a] border-[#ff2a2a]/40' : 'border-zinc-700 text-zinc-400 hover:text-white'">H{{ l }}</button>
            </template>
            <button type="button" v-for="al in ['left', 'center', 'right']" :key="al" @click="b.align = al as any; emitHtml()"
              class="text-[9px] px-1.5 py-0.5 rounded border transition-colors"
              :class="b.align === al ? 'bg-[#ff2a2a]/20 text-[#ff2a2a] border-[#ff2a2a]/40' : 'border-zinc-700 text-zinc-400 hover:text-white'">{{ { left: '⇤', center: '⇹', right: '⯾' }[al as any] }}</button>
            <span class="flex-1" />
            <button type="button" @click="moveBlock(b.id, -1)" :disabled="idx === 0" class="text-[11px] text-zinc-400 hover:text-white disabled:opacity-30" title="Monter">↑</button>
            <button type="button" @click="moveBlock(b.id, 1)" :disabled="idx === blocks.length - 1" class="text-[11px] text-zinc-400 hover:text-white disabled:opacity-30" title="Descendre">↓</button>
            <button type="button" @click="removeBlock(b.id)" class="text-[11px] text-red-400 hover:text-red-300" title="Supprimer">🗑</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom add row -->
    <div class="flex flex-wrap items-center justify-center gap-1.5 py-2 border-t border-zinc-800 bg-[#0a0a10]">
      <button type="button" :class="addBtn" @click="add('heading')">＋ Titre</button>
      <button type="button" :class="addBtn" @click="add('paragraph')">＋ Texte</button>
      <button type="button" :class="addBtn" @click="add('list')">＋ Liste</button>
      <button type="button" :class="addBtn" @click="add('quote')">＋ Citation</button>
      <button type="button" :class="addBtn" @click="add('image')">＋ Image</button>
      <button type="button" :class="addBtn" @click="add('video')">＋ Vidéo</button>
    </div>
  </div>
</template>
