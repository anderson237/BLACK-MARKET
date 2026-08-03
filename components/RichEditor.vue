<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{ modelValue: string }>(), { modelValue: '' })
const emit = defineEmits<{ 'update:modelValue': [v: string]; change: [] }>()

const editor = ref<HTMLDivElement | null>(null)
const showingHtml = ref(false)
const htmlDraft = ref('')
const linkUrl = ref('')
const showLinkPrompt = ref(false)
const showEmoji = ref(false)

const EMOJIS = [
  '🔥', '⚡', '🚀', '💥', '👑', '💎', '✨', '🎯', '🛍️', '📦', '🚚', '💰',
  '🇨🇳', '🇩🇪', '🇫🇷', '💶', '✅', '❌', '⚠️', '⭐', '🌟', '💯', '🖤', '❤️',
  '🔴', '⚫', '🎧', '👟', '🧢', '🕶️', '💻', '🎮', '📱', '🔋', '⚙️', '🧠',
  '👁️', '🤝', '💬', '📞', '📲', '🎁', '🏆', '🆕', '🎬', '📸', '🖼️', '🎨',
  '⏳', '📅', '📍', '🌍', '🛫', '✈️', '👍', '👌', '💪', '🙌', '👏', '😍',
  '🤩', '😎', '🤯', '🚨', '🔊', '🔒',
]

// Keep the selection alive inside the editor when clicking toolbar buttons.
function preventBlur(e: MouseEvent) {
  e.preventDefault()
}

function sanitize(raw: string): string {
  return String(raw || '')
    .replace(/<(script|style|iframe|object|embed|form)[^>]*>.*?<\/\1>/gis, '')
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .slice(0, 24000)
}

// Rebuild from props when external code (ex: IA refine) replaces the value.
watch(
  () => props.modelValue,
  (v) => {
    if (editor.value && document.activeElement !== editor.value) {
      editor.value.innerHTML = sanitize(v)
    }
  },
)

onMounted(() => {
  if (editor.value) editor.value.innerHTML = sanitize(props.modelValue)
})

function sync() {
  if (!editor.value) return
  const html = editor.value.innerHTML
  if (html !== props.modelValue) emit('update:modelValue', html)
  emit('change')
}

function syncSource() {
  emit('update:modelValue', htmlDraft.value)
  emit('change')
}

function exec(cmd: string, value?: string) {
  editor.value?.focus()
  document.execCommand(cmd, false, value)
  sync()
}

function formatBlock(tag: 'p' | 'h1' | 'h2' | 'h3' | 'blockquote' | 'pre') {
  exec('formatBlock', tag)
}

function setColor() {
  const c = window.prompt('Couleur du texte (hex, ex: #ff2a2a) :', '#ff2a2a')
  if (c) exec('foreColor', c)
}

function setHighlight() {
  const c = window.prompt('Couleur de surlignage (hex, ex: #ffff00) :', '#ffff00')
  if (c) exec('hiliteColor', c)
}

function setFontSize() {
  const s = window.prompt('Taille de police (1-7) :', '4')
  if (s) exec('fontSize', s)
}

function insertLink() {
  editor.value?.focus()
  linkUrl.value = ''
  showLinkPrompt.value = true
}

function applyLink() {
  const url = linkUrl.value.trim()
  showLinkPrompt.value = false
  if (!url) return
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
  editor.value?.focus()
  document.execCommand('createLink', false, href)
  sync()
}

function insertImage() {
  const url = window.prompt('URL de l\'image à insérer :')
  if (url) {
    exec('insertImage', url)
  }
}

function insertHR() {
  exec('insertHorizontalRule')
}

function insertEmoji(emoji: string) {
  editor.value?.focus()
  document.execCommand('insertText', false, emoji)
  sync()
  showEmoji.value = false
}

function clearFormat() {
  exec('removeFormat')
}

function toggleHtml() {
  if (editor.value) {
    if (!showingHtml.value) htmlDraft.value = editor.value.innerHTML
    else {
      editor.value.innerHTML = sanitize(htmlDraft.value)
      sync()
    }
  }
  showingHtml.value = !showingHtml.value
}

function isActive(cmd: string): boolean {
  if (typeof document === 'undefined') return false
  try { return document.queryCommandState(cmd) } catch { return false }
}

const toolbarBtn =
  'inline-flex items-center justify-center min-w-6 h-6 sm:min-w-7 sm:h-7 px-1 text-[10px] sm:text-[11px] font-mono text-slate-300 bg-zinc-900 border border-zinc-700/70 rounded-md hover:bg-zinc-700/60 hover:text-white transition-colors cursor-pointer'
</script>

<template>
  <div class="rounded-xl overflow-hidden border border-zinc-700/60 bg-black/40">
    <!-- Toolbar -->
    <div class="w-full overflow-x-auto flex items-center gap-1.5 p-1.5 bg-[#0d0d14] border-b border-zinc-700/60 select-none" style="scrollbar-width: thin">
      <div class="flex items-center gap-1 border-r border-zinc-700/60 pr-1.5 mr-1.5">
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="exec('bold')"
          :style="isActive('bold') ? 'background:#ff2a2a;color:#fff' : ''" title="Gras"><b>B</b></button>
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="exec('italic')"
          :style="isActive('italic') ? 'background:#ff2a2a;color:#fff' : ''" title="Italique"><i>I</i></button>
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="exec('underline')"
          :style="isActive('underline') ? 'background:#ff2a2a;color:#fff' : ''" title="Souligné"><u>U</u></button>
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="exec('strikeThrough')" title="Barré"><s>S</s></button>
      </div>

      <div class="flex items-center gap-1 border-r border-zinc-700/60 pr-1.5 mr-1.5">
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="setFontSize" title="Taille">A▾</button>
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="setColor" title="Couleur texte">🎨</button>
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="setHighlight" title="Surlignage">🖍</button>
      </div>

      <div class="flex items-center gap-1 border-r border-zinc-700/60 pr-1.5 mr-1.5">
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="formatBlock('p')" title="Paragraphe">¶</button>
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="formatBlock('h1')" title="Titre 1">H1</button>
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="formatBlock('h2')" title="Titre 2">H2</button>
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="formatBlock('h3')" title="Titre 3">H3</button>
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="formatBlock('blockquote')" title="Citation">❝</button>
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="formatBlock('pre')" title="Code">&lt;/&gt;</button>
      </div>

      <div class="flex items-center gap-1 border-r border-zinc-700/60 pr-1.5 mr-1.5">
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="exec('insertUnorderedList')" title="Liste à puces">•≡</button>
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="exec('insertOrderedList')" title="Liste numérotée">1≡</button>
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="exec('outdent')" title="Diminuer retrait">⇤</button>
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="exec('indent')" title="Augmenter retrait">⇥</button>
      </div>

      <div class="flex items-center gap-1 border-r border-zinc-700/60 pr-1.5 mr-1.5">
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="exec('justifyLeft')" title="Gauche">⯇</button>
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="exec('justifyCenter')" title="Centre">⇹</button>
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="exec('justifyRight')" title="Droite">⯈</button>
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="exec('justifyFull')" title="Justifié">≡</button>
      </div>

      <div class="flex items-center gap-1 border-r border-zinc-700/60 pr-1.5 mr-1.5">
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="insertLink" title="Insérer un lien">🔗</button>
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="insertImage" title="Insérer une image">🖼</button>
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="insertHR" title="Ligne horizontale">―</button>
        <div class="relative">
          <button type="button" :class="toolbarBtn" @click="showEmoji = !showEmoji" title="Insérer un emoji">😀</button>
          <div v-if="showEmoji" class="absolute z-30 right-0 top-full mt-1 w-64 max-h-52 overflow-y-auto bg-[#12121a] border border-zinc-700/70 rounded-xl shadow-2xl p-2 grid grid-cols-6 gap-0.5" style="scrollbar-width:thin">
            <button v-for="e in EMOJIS" :key="e" type="button" @click="insertEmoji(e)"
              class="w-8 h-8 flex items-center justify-center rounded-lg text-lg hover:bg-[#ff2a2a]/20 hover:scale-110 transition-transform cursor-pointer" :title="e">{{ e }}</button>
          </div>
        </div>
        <button type="button" :class="toolbarBtn" @mousedown="preventBlur" @click="clearFormat" title="Effacer la mise en forme">✕</button>
      </div>

      <div class="flex items-center gap-1 ml-auto">
        <button type="button" :class="toolbarBtn" @click="toggleHtml" :style="showingHtml ? 'background:#ff2a2a;color:#fff' : ''" title="Code source / Visuel">&lt;/&gt;</button>
      </div>
    </div>

    <!-- Link prompt -->
    <div v-if="showLinkPrompt" class="flex items-center gap-2 p-2 bg-zinc-900 border-b border-zinc-700/60">
      <input v-model="linkUrl" @keyup.enter="applyLink" placeholder="https://..." autofocus
        class="flex-1 bg-black border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:border-[#ff2a2a]/50 focus:outline-none" />
      <button type="button" @click="applyLink" class="text-[11px] font-mono bg-[#ff2a2a] hover:bg-red-600 text-white px-3 py-1.5 rounded-lg cursor-pointer">Insérer</button>
      <button type="button" @click="showLinkPrompt = false" class="text-[11px] font-mono text-zinc-400 border border-zinc-700 px-2.5 py-1.5 rounded-lg cursor-pointer">✕</button>
    </div>

    <!-- WYSIWYG area -->
    <div
      ref="editor"
      contenteditable="true"
      class="min-h-[130px] max-h-[360px] overflow-y-auto px-3 py-2.5 text-[13px] text-slate-200 focus:outline-none prose-invert"
      @input="sync"
      @blur="sync"
    />

    <!-- Source view -->
    <textarea
      v-if="showingHtml"
      v-model="htmlDraft"
      @input="syncSource"
      class="w-full h-40 bg-black/60 border-t border-zinc-700/60 px-3 py-2.5 font-mono text-[11px] text-emerald-400 focus:outline-none resize-y"
      spellcheck="false"
    ></textarea>
  </div>
</template>