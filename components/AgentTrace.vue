<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { AgentEvent } from '~~/server/utils/agent/trace'

const props = defineProps<{ events: AgentEvent[]; running?: boolean; toolCalls?: number; reflections?: number }>()

const KIND: Record<string, { tone: string; dot: string }> = {
  plan: { tone: 'text-cyan-700', dot: 'bg-cyan-500' },
  tool: { tone: 'text-sky-700', dot: 'bg-sky-500' },
  observation: { tone: 'text-slate-500', dot: 'bg-slate-400' },
  verdict: { tone: 'text-rose-700', dot: 'bg-rose-500' },
  reflection: { tone: 'text-amber-700', dot: 'bg-amber-500' },
  final: { tone: 'text-emerald-700', dot: 'bg-emerald-500' },
}

const ROLE: Record<string, string> = {
  planner: '规划者',
  retriever: '检索者',
  judge: '判定者',
  critic: '复核者',
  advisor: '顾问',
}

const LEVEL_DOT: Record<string, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-sky-500',
  ok: 'bg-slate-300',
}

const LEVEL_TEXT: Record<string, string> = {
  high: 'text-rose-700',
  medium: 'text-amber-700',
  low: 'text-sky-700',
  ok: 'text-slate-500',
}

function meta(event: AgentEvent) {
  const base = KIND[event.kind] ?? KIND.observation!
  if (event.kind === 'verdict' && event.level) {
    return { ...base, dot: LEVEL_DOT[event.level] ?? base.dot, tone: LEVEL_TEXT[event.level] ?? base.tone }
  }
  return base
}

// 轨迹事件里只有「展示出来的」那几次工具调用，真实次数由后端统计后传进来
const toolCount = computed(() => props.toolCalls ?? props.events.filter((event) => event.kind === 'tool').length)
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
  <section class="rounded-xl border border-slate-200 bg-slate-50/70">
    <header class="flex items-center gap-3 border-b border-slate-200 px-3 py-2">
      <span class="text-[11px] font-medium text-slate-500">Agent 执行轨迹</span>
      <span class="hidden text-[10px] text-slate-400 sm:inline">规划 → 调工具 → 观察 → 自省 → 复核</span>

      <span v-if="running" class="flex items-center gap-1 text-[10px] text-emerald-600">
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        运行中
      </span>

      <div class="ml-auto flex items-center gap-3 font-mono text-[10px] text-slate-400">
        <span>工具调用 <b class="text-sky-600">{{ toolCount }}</b></span>
        <span>自省 <b class="text-amber-600">{{ reflectCount }}</b></span>
        <span>{{ elapsed }}s</span>
      </div>
    </header>

    <div ref="box" class="max-h-[208px] overflow-auto px-3 py-2.5">
      <p v-if="!events.length" class="py-6 text-center text-[11px] text-slate-400">等待 Agent 启动…</p>

      <ol v-else class="relative space-y-2 border-l border-slate-200 pl-4">
        <li v-for="event in events" :key="event.seq" class="relative">
          <span
            class="absolute -left-[21px] top-1 h-1.5 w-1.5 rounded-full ring-2 ring-white"
            :class="meta(event).dot"
          />

          <div class="flex flex-wrap items-baseline gap-2">
            <span class="w-9 shrink-0 font-mono text-[10px] text-slate-300">{{ (event.at / 1000).toFixed(1) }}s</span>
            <span class="shrink-0 rounded border border-slate-200 bg-white px-1 text-[9px] text-slate-500">
              {{ ROLE[event.role] ?? event.role }}
            </span>
            <span class="text-[11px] font-medium" :class="meta(event).tone">{{ event.title }}</span>
            <span v-if="event.detail" class="text-[10px] text-slate-400">{{ event.detail }}</span>
          </div>

          <p v-if="event.tool" class="mt-0.5 pl-11 font-mono text-[10px] leading-4 text-sky-600/80">
            {{ event.tool }}({{ event.args ?? '' }})
            <span class="text-slate-300">→</span>
            <span class="text-slate-500">{{ event.result }}</span>
          </p>
        </li>
      </ol>
    </div>
  </section>
</template>
