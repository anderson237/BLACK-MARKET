<script setup lang="ts">
import 'leaflet/dist/leaflet.css'

export interface GeoMapPoint {
  code?: string
  name: string
  lat?: number
  lng?: number
  value?: number
}

// Interactive mini map (Leaflet + OSM tiles) that places a glowing marker for
// every country present in the audience data, sized by its total activity.
const props = withDefaults(
  defineProps<{
    points?: GeoMapPoint[]
    height?: number
    center?: [number, number]
    zoom?: number
  }>(),
  {
    points: () => [],
    height: 380,
    center: () => [8, 16] as [number, number],
    zoom: 3,
  },
)

const el = ref<HTMLDivElement | null>(null)
let map: any = null
let L: any = null
let markers: any[] = []

function renderMarkers() {
  if (!map || !L) return
  for (const m of markers) m.remove()
  markers = []
  const pts = props.points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.value || 0) > 0)
  if (!pts.length) {
    map.setView(props.center, props.zoom)
    return
  }
  const max = Math.max(...pts.map((p) => p.value || 0), 1)
  const latLngs: [number, number][] = []
  for (const p of pts) {
    const lat = p.lat as number
    const lng = p.lng as number
    const radius = 4 + ((p.value || 0) / max) * 16
    const marker = L.circleMarker([lat, lng], {
      radius,
      color: '#ff2a2a',
      weight: 1,
      fillColor: '#ff2a2a',
      fillOpacity: 0.45,
    })
      .addTo(map)
      .bindTooltip(`<b>${p.name}</b> — ${p.value}`, { direction: 'top', offset: [0, -6] })
    markers.push(marker)
    latLngs.push([lat, lng])
  }
  if (latLngs.length === 1) {
    map.setView(latLngs[0], Math.max(map.getZoom(), 6))
  } else {
    map.fitBounds(L.latLngBounds(latLngs), { padding: [28, 28], maxZoom: 7 })
  }
}

onMounted(async () => {
  if (!el.value || typeof window === 'undefined') return
  const mod = await import('leaflet')
  L = mod.default || mod
  map = L.map(el.value, {
    center: props.center,
    zoom: props.zoom,
    scrollWheelZoom: false,
    attributionControl: true,
  })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)
  renderMarkers()
})

watch(
  () => props.points,
  () => renderMarkers(),
  { deep: true },
)

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<template>
  <div ref="el" class="w-full rounded-2xl overflow-hidden border border-zinc-800 bg-black" :style="{ height: `${height}px` }" />
</template>

<style scoped>
:global(.leaflet-container) {
  font-family: inherit;
  background: #0b0b12;
}
:global(.leaflet-tooltip) {
  background: #12121a;
  border: 1px solid #27272a;
  color: #e4e4e7;
  font-size: 11px;
  font-family: 'Share Tech Mono', monospace;
}
</style>
