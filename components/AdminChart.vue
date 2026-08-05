<script lang="ts">
function fmtShort(v: number): string {
  const n = Number(v) || 0
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(Math.round(n))
}
</script>

<script setup lang="ts">
// Reusable SVG chart for the admin analytics (area / line / grouped bars).
// Usage: <AdminChart :data="monthly" :series="[{key:'revenueXof',label:'CA',color:'#34d399'}]" type="area" />
interface SeriesDef {
  key: string
  label: string
  color: string
  type?: 'area' | 'bars' | 'line'
}

const props = withDefaults(
  defineProps<{
    data: any[]
    series: SeriesDef[]
    type?: 'area' | 'bars' | 'line'
    height?: number
    xKey?: string
    valueFormat?: (v: number) => string
    formatTick?: (v: number) => string
  }>(),
  { type: 'area', height: 250, xKey: 'label', valueFormat: (v) => fmtShort(v), formatTick: (v) => fmtShort(v) },
)

const W = 640
const PAD_L = 58
const PAD_R = 14
const PAD_T = 16
const PAD_B = 30

const innerW = computed(() => W - PAD_L - PAD_R)
const innerH = computed(() => props.height - PAD_T - PAD_B)

const val = (d: any, s: SeriesDef) => Number(d[s.key]) || 0
const allVals = computed(() => props.data.flatMap((d) => props.series.map((s) => val(d, s))))
const minVal = computed(() => Math.min(0, ...allVals.value))
const maxVal = computed(() => Math.max(1, ...allVals.value))
const range = computed(() => Math.max(maxVal.value - minVal.value, 1))

const n = computed(() => Math.max(1, props.data.length))
const xAt = (i: number) => PAD_L + (i + 0.5) * (innerW.value / n.value)
const yAt = (v: number) => PAD_T + innerH.value - ((v - minVal.value) / range.value) * innerH.value

function pointsPath(s: SeriesDef): string {
  return props.data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(val(d, s)).toFixed(1)}`).join(' ')
}

function areaPath(s: SeriesDef): string {
  if (!props.data.length) return ''
  const base = yAt(0)
  const line = pointsPath(s)
  return `${line} L${xAt(props.data.length - 1).toFixed(1)},${base.toFixed(1)} L${xAt(0).toFixed(1)},${base.toFixed(1)} Z`
}

function seriesType(s: SeriesDef): string {
  return s.type || props.type
}

// ---- grid ----
const GRID_LINES = 4
const gridLines = computed(() => {
  const lines = []
  for (let i = 0; i <= GRID_LINES; i++) {
    const v = minVal.value + (range.value * i) / GRID_LINES
    lines.push({ y: yAt(v), v })
  }
  return lines
})

// ---- x labels ----
const labelStep = computed(() => Math.max(1, Math.ceil(n.value / 11)))
const xLabels = computed(() =>
  props.data.map((d, i) => ({ i, label: String(d[props.xKey] || ''), show: i % labelStep.value === 0 || i === n.value - 1 })),
)

// ---- grouped bars ----
function barRects(s: SeriesDef) {
  const group = innerW.value / n.value
  const bw = Math.min(18, (group / props.series.length) * 0.7)
  return props.data.map((d, i) => {
    const gi = props.series.indexOf(s)
    const bx = PAD_L + i * group + group / 2 + (gi - (props.series.length - 1) / 2) * bw
    const h = ((val(d, s) - minVal.value) / range.value) * innerH.value
    return { x: bx - bw / 2, y: yAt(val(d, s)), w: bw, h: Math.max(0, Math.abs(h)) }
  })
}
</script>

<template>
  <div>
    <div v-if="series.length" class="flex flex-wrap items-center gap-4 mb-3">
      <span v-for="s in series" :key="s.key" class="inline-flex items-center gap-1.5 text-[9px] font-mono text-zinc-400">
        <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: s.color }" />
        {{ s.label }}
        <span class="text-zinc-600">· {{ valueFormat(data.reduce((a: number, d: any) => a + (Number(d[s.key]) || 0), 0)) }}</span>
      </span>
    </div>
    <div v-if="!data.length" class="h-40 flex items-center justify-center border border-dashed border-zinc-800 rounded-xl text-xs font-mono text-zinc-600">
      Aucune donnée pour cette période
    </div>
    <svg v-else :viewBox="`0 0 ${W} ${height}`" class="w-full h-auto block" role="img">
      <g v-for="g in gridLines" :key="g.y">
        <line :x1="PAD_L" :x2="W - PAD_R" :y1="g.y" :y2="g.y" stroke="#27272a" stroke-width="1" stroke-dasharray="3 4" />
        <text :x="PAD_L - 6" :y="g.y + 3" text-anchor="end" font-size="9" fill="#71717a" font-family="ui-monospace, monospace">{{ formatTick(g.v) }}</text>
      </g>
      <g v-for="xl in xLabels" :key="xl.i">
        <text v-if="xl.show" :x="xAt(xl.i)" :y="height - 8" text-anchor="middle" font-size="9" fill="#71717a" font-family="ui-monospace, monospace">
          {{ xl.label }}
        </text>
      </g>
      <!-- grouped bars -->
      <template v-if="seriesType(series[0]) === 'bars'">
        <template v-for="s in series" :key="s.key">
          <rect v-for="r in barRects(s)" :key="`${s.key}-${r.x}`" :x="r.x" :y="r.y" :width="r.w" :height="r.h" rx="2" :fill="s.color" opacity="0.85" />
        </template>
      </template>
      <template v-else>
        <template v-for="s in series" :key="s.key">
          <path v-if="seriesType(s) === 'area'" :d="areaPath(s)" :fill="s.color" opacity="0.12" />
          <path :d="pointsPath(s)" :fill="'none'" :stroke="s.color" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          <circle
            v-for="(d, i) in data"
            :key="i"
            :cx="xAt(i)"
            :cy="yAt(val(d, s))"
            r="2.5"
            :fill="'#0d0d14'"
            :stroke="s.color"
            stroke-width="1.5"
          >
            <title>{{ valueFormat(val(d, s)) }}</title>
          </circle>
        </template>
      </template>
    </svg>
  </div>
</template>
