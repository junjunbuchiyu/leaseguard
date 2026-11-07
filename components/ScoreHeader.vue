<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  score: number
  stats: { high: number; medium: number; low: number; ok: number }
  summary?: string
  tookMs?: number
  calls?: number
}>()

const tone = computed(() => {
  if (props.score >= 85) return { text: 'text-emerald-300', ring: 'stroke-emerald-400' }
  if (props.score >= 60) return { text: 'text-amber-300', ring: 'stroke-amber-400' }
  return { text: 'text-rose-300', ring: 'stroke-rose-400' }
})

const verdict = computed(() => {
  if (props.score >= 85) return '整体规范，签约前核对原件即可'
  if (props.score >= 60) return '存在需要协商的条款，建议逐条确认'
  return '风险较高，建议先修改再签'
})

const circumference = 2 * Math.PI * 26
const dash = computed(() => (props.score / 100) * circumference)
</script>

<template>
  <div class="flex items-center gap-5">
    <div class="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 64 64" class="h-20 w-20 -rotate-90">
        <circle cx="32" cy="32" r="26" fill="none" stroke-width="5" class="stroke-white/[0.07]" />
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          stroke-width="5"
          stroke-linecap="round"
          :class="tone.ring"
          :stroke-dasharray="`${dash} ${circumference}`"
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="text-2xl font-bold tabular-nums" :class="tone.text">{{ score }}</span>
        <span class="mono text-[9px] text-slate-600">/ 100</span>
      </div>
    </div>

    <div class="min-w-0">
      <p class="text-sm font-semibold text-slate-100">{{ verdict }}</p>
      <p v-if="summary" class="mt-1 text-xs leading-5 text-slate-400">{{ summary }}</p>
      <div class="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
        <span class="rounded border border-rose-400/25 bg-rose-500/10 px-2 py-0.5 text-rose-300">高 {{ stats.high }}</span>
        <span class="rounded border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-amber-300">中 {{ stats.medium }}</span>
        <span class="rounded border border-sky-400/25 bg-sky-500/10 px-2 py-0.5 text-sky-300">低 {{ stats.low }}</span>
        <span class="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-slate-400">正常 {{ stats.ok }}</span>
        <span class="mono text-slate-600">{{ calls }} 次调用 · {{ ((tookMs ?? 0) / 1000).toFixed(1) }}s</span>
      </div>
    </div>
  </div>
</template>
