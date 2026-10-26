<script setup lang="ts">
import type { Clause } from '~~/server/utils/types'

defineProps<{
  clauses: Clause[]
  preamble?: string
  strategy: string
}>()

const STRATEGY_LABEL: Record<string, string> = {
  article: '按「第X条」切分',
  numbered: '按数字编号切分',
  paragraph: '按段落切分',
  chunk: '按字数分块',
}

const TAG_STYLE: Record<string, string> = {
  押金: 'bg-amber-50 text-amber-700',
  租金费用: 'bg-sky-50 text-sky-700',
  维修: 'bg-violet-50 text-violet-700',
  提前解约: 'bg-rose-50 text-rose-700',
  转租续租: 'bg-teal-50 text-teal-700',
  房屋状况: 'bg-orange-50 text-orange-700',
  隐私入户: 'bg-fuchsia-50 text-fuchsia-700',
  备案证件: 'bg-slate-100 text-slate-600',
  违约责任: 'bg-red-50 text-red-700',
  期限与形式: 'bg-indigo-50 text-indigo-700',
  其他: 'bg-slate-100 text-slate-500',
}
</script>

<template>
  <div>
    <div class="flex items-baseline justify-between">
      <h2 class="text-sm font-semibold text-slate-900">条款结构</h2>
      <span class="text-xs text-slate-400">
        {{ clauses.length }} 条 · {{ STRATEGY_LABEL[strategy] ?? strategy }}
      </span>
    </div>

    <p
      v-if="preamble"
      class="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500"
    >
      {{ preamble }}
    </p>

    <ul class="mt-3 space-y-3">
      <li
        v-for="clause in clauses"
        :key="clause.id"
        class="rounded-xl border border-slate-200 bg-white px-4 py-3"
      >
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs text-slate-400">
            {{ clause.no ?? `#${clause.index}` }}
          </span>
          <span
            class="rounded px-2 py-0.5 text-xs font-medium"
            :class="TAG_STYLE[clause.tag] ?? TAG_STYLE['其他']"
          >
            {{ clause.tag }}
          </span>
          <span v-if="clause.tagSource === 'llm'" class="text-[10px] text-slate-400">AI 复核</span>
          <span class="ml-auto text-[11px] text-slate-300">{{ clause.chars }} 字</span>
        </div>
        <p class="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{{ clause.text }}</p>
      </li>
    </ul>
  </div>
</template>
