<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

export interface TraceEntry {
  t: number
  kind: 'step' | 'risk' | 'info'
  text: string
}

const props = defineProps<{ entries: TraceEntry[]; running?: boolean }>()

const box = ref<HTMLElement | null>(null)

watch(
  () => props.entries.length,
  async () => {
    await nextTick()
    if (box.value) box.value.scrollTop = box.value.scrollHeight
  },
)
</script>

<template>
  <div
    v-if="entries.length"
    class="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2"
  >
    <div class="mb-1 flex items-center gap-2">
      <span class="text-[11px] font-medium text-slate-500">AI 调用轨迹</span>
      <span v-if="running" class="flex items-center gap-1 text-[10px] text-emerald-600">
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        进行中
      </span>
      <span class="ml-auto text-[10px] text-slate-400">{{ entries.length }} 条事件</span>
    </div>

    <div ref="box" class="max-h-28 space-y-0.5 overflow-auto font-mono text-[11px] leading-5">
      <p v-for="(entry, index) in entries" :key="index" class="flex gap-2">
        <span class="shrink-0 text-slate-300">{{ (entry.t / 1000).toFixed(1) }}s</span>
        <span
          class="shrink-0"
          :class="
            entry.kind === 'risk' ? 'text-rose-500' : entry.kind === 'step' ? 'text-emerald-600' : 'text-slate-400'
          "
        >
          {{ entry.kind === 'risk' ? '判定' : entry.kind === 'step' ? '步骤' : '信息' }}
        </span>
        <span class="truncate text-slate-600">{{ entry.text }}</span>
      </p>
    </div>
  </div>
</template>
