<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { AgentEvent } from '~~/server/utils/agent/trace'

const props = defineProps<{ events: AgentEvent[]; running?: boolean; toolCalls?: number; reflections?: number }>()

const KIND: Record<string, { label: string; tone: string; dot: string }> = {
  plan: { label: '规划', tone: 'text-cyan-300', dot: 'bg-cyan-400' },
  tool: { label: '工具', tone: 'text-sky-300', dot: 'bg-sky-400' },
  observation: { label: '观察', tone: 'text-slate-400', dot: 'bg-slate-500' },
  verdict: { label: '判定', tone: 'text-rose-300', dot: 'bg-rose-400' },
  reflection: { label: '自省', tone: 'text-amber-300', dot: 'bg-amber-400' },
  final: { label: '收敛', tone: 'text-emerald-300', dot: 'bg-emerald-400' },
}

const ROLE: Record<string, string> = {
  planner: '规划者',
  retriever: '检索者',
  judge: '判定者',
  critic: '复核者',
  advisor: '顾问',
}

const LEVEL_DOT: Record<string, string> = {
  high: 'bg-rose-400',
  medium: 'bg-amber-400',
  low: 'bg-sky-400',
  ok: 'bg-slate-500',
}

const LEVEL_TEXT: Record<string, string> = {
  high: 'text-rose-300',
  medium: 'text-amber-300',
  low: 'text-sky-300',
  ok: 'text-slate-400',
}

function meta(event: AgentEvent) {
  const base = KIND[event.kind] ?? KIND.observation
  if (event.kind === 'verdict' && event.level) {
    return { ...base, dot: LEVEL_DOT[event.level] ?? base.dot, tone: LEVEL_TEXT[event.level] ?? base.tone }
  }
  return base
}

// 轨迹事件里只有「展示出来的」那几次工具调用，真实次数由后端统计后传进来
const toolCount = computed(
  () => props.toolCalls ?? props.events.filter((event) => event.kind === 'tool').length,
)
const reflectCount = computed(
  () => props.reflections ?? props.events.filter((event) => event.kind === 'reflection').length,
)
const elapsed = computed(() => {
  const last = props.events[props.events.length - 1]
  return last ? (last.at / 1000).toFixed(1) : '0.0'
})

const box = ref<HTMLElement | null>(null)
watch(
  () => props.events.length,
  async () => {
    await nextTick()
    if (box.value) box.value.scrollTop = box.value.scrollHeight
  },
)
</script>

<template>
  <section class="panel overflow-hidden">
    <header class="flex items-center gap-3 border-b border-white/[0.07] px-4 py-2.5">
      <span class="mono-label">Agent Trace</span>
      <span class="hidden text-[10px] text-slate-500 sm:inline">规划 → 调工具 → 观察 → 自省 → 复核</span>

      <span v-if="running" class="flex items-center gap-1 text-[10px] text-emerald-300">
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        运行中
      </span>

      <div class="ml-auto flex items-center gap-3 font-mono text-[10px] text-slate-500">
        <span>工具调用 <b class="text-sky-300">{{ toolCount }}</b></span>
        <span>自省 <b class="text-amber-300">{{ reflectCount }}</b></span>
        <span>{{ elapsed }}s</span>
      </div>
    </header>

    <div ref="box" class="max-h-[228px] overflow-auto px-4 py-3">
      <p v-if="!events.length" class="py-6 text-center text-[11px] text-slate-600">
        等待 Agent 启动…
      </p>

      <ol v-else class="relative space-y-2.5 border-l border-white/[0.08] pl-4">
        <li v-for="event in events" :key="event.seq" class="relative">
          <span
            class="absolute -left-[21px] top-1 h-1.5 w-1.5 rounded-full ring-2 ring-[#0a101c]"
            :class="meta(event).dot"
          />

          <div class="flex flex-wrap items-baseline gap-2">
            <span class="mono w-9 shrink-0 text-[10px] text-slate-600">{{ (event.at / 1000).toFixed(1) }}s</span>
            <span class="shrink-0 rounded border border-white/10 px-1 text-[9px] text-slate-400">
              {{ ROLE[event.role] ?? event.role }}
            </span>
            <span class="text-[11px] font-medium" :class="meta(event).tone">{{ event.title }}</span>
            <span v-if="event.detail" class="text-[10px] text-slate-500">{{ event.detail }}</span>
          </div>

          <p v-if="event.tool" class="mono mt-0.5 pl-11 text-[10px] leading-4 text-sky-300/70">
            {{ event.tool }}({{ event.args ?? '' }})
            <span class="text-slate-600">→</span>
            <span class="text-slate-400">{{ event.result }}</span>
          </p>
        </li>
      </ol>
    </div>
  </section>
</template>
