export type BmTheme = 'dark' | 'light'

export function useTheme() {
  // Shared reactive state (Nuxt useState): every component that calls useTheme()
  // observes the SAME theme, so toggling in the header updates the avatars and
  // the rest of the UI immediately.
  const theme = useState<BmTheme>('bm-theme', () => 'dark')
  const isLight = computed(() => theme.value === 'light')

  function apply(next: BmTheme) {
    theme.value = next
    if (import.meta.client) {
      const root = document.documentElement
      root.classList.toggle('light', next === 'light')
      root.classList.add('theme-anim')
      window.setTimeout(() => root.classList.remove('theme-anim'), 400)
      try {
        localStorage.setItem('bm_theme', next)
      } catch {}
    }
  }

  function toggle() {
    apply(isLight.value ? 'dark' : 'light')
  }

  function init() {
    if (!import.meta.client) return
    let stored: string | null = null
    try {
      stored = localStorage.getItem('bm_theme')
    } catch {}
    apply(stored === 'light' ? 'light' : 'dark')
  }

  return { theme, isLight, apply, toggle, init }
}
