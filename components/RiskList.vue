<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RiskItem } from '~~/server/utils/review'

const props = defineProps<{ risks: RiskItem[] }>()

const showOk = ref(false)
const copiedId = ref('')

const LEVEL_STYLE: Record<string, { badge: string; border: string; label: string }> = {
  high: { badge: 'bg-rose-100 text-rose-700', border: 'border-rose-200', label: '高风险' },
  medium: { badge: 'bg-amber-100 text-amber-800', border: 'border-amber-200', label: '中风险' },
  low: { badge: 'bg-sky-100 text-sky-700', border: 'border-sky-200', label: '低风险' },
  ok: { badge: 'bg-slate-100 text-slate-500', border: 'border-slate-200', label: '正常' },
}

const ORDER = { high: 0, medium: 1, low: 2, ok: 3 } as const

const visible = computed(() => {
  const list = showOk.value ? props.risks : props.risks.filter((risk) => risk.level !== 'ok')
  return [...list].sort((a, b) => ORDER[a.level] - ORDER[b.level])
})

const okCount = computed(() => props.risks.filter((risk) => risk.level === 'ok').length)

async function copy(risk: RiskItem) {
  if (!risk.negotiation) return
  await navigator.clipboard.writeText(risk.negotiation)
  copiedId.value = risk.id
  setTimeout(() => (copiedId.value = ''), 1500)
}
</script>

<template>
  <div>
    <div class="flex items-baseline justify-between">
      <h2 class="text-sm font-semibold text-slate-900">风险清单</h2>
      <button v-if="okCount" class="text-xs text-slate-400 hover:text-slate-600" @click="showOk = !showOk">
        {{ showOk ? '只看风险' : `显示 ${okCount} 条正常条款` }}
      </button>
    </div>

    <p v-if="!visible.length" class="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
      没有发现问题条款。
    </p>

    <ul class="mt-3 space-y-3">
      <li
        v-for="risk in visible"
        :key="risk.id"
        class="rounded-xl border bg-white px-4 py-3"
        :class="LEVEL_STYLE[risk.level]!.border"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span class="rounded px-2 py-0.5 text-xs font-medium" :class="LEVEL_STYLE[risk.level]!.badge">
            {{ LEVEL_STYLE[risk.level]!.label }}
          </span>
          <span class="font-mono text-xs text-slate-400">{{ risk.clauseNo ?? risk.clauseId }}</span>
          <h3 class="text-sm font-medium text-slate-800">{{ risk.title }}</h3>
          <span class="ml-auto text-[11px] text-slate-300">{{ Math.round(risk.confidence * 100) }}%</span>
        </div>

        <p class="mt-2 text-sm leading-6 text-slate-600">{{ risk.issue }}</p>

        <ul v-if="risk.basis.length" class="mt-2 space-y-1.5">
          <li
            v-for="basis in risk.basis"
            :key="basis.lawId"
            class="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs leading-5"
          >
            <span class="font-medium text-slate-700">{{ basis.law }} · {{ basis.article }}</span>
            <span class="text-slate-500">「{{ basis.quote }}」</span>
            <span v-if="basis.reason" class="mt-0.5 block text-slate-400">{{ basis.reason }}</span>
          </li>
        </ul>
        <p v-else-if="risk.level !== 'ok'" class="mt-2 text-xs text-amber-600">
          未匹配到可引用的法条，建议人工核对
        </p>

        <div v-if="risk.suggestion" class="mt-2 text-xs leading-5 text-slate-600">
          <span class="font-medium text-slate-700">改法：</span>{{ risk.suggestion }}
        </div>

        <div v-if="risk.negotiation" class="mt-2 flex items-start gap-2">
          <p class="flex-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs leading-5 text-emerald-900">
            {{ risk.negotiation }}
          </p>
          <button class="shrink-0 text-xs text-emerald-700 hover:underline" @click="copy(risk)">
            {{ copiedId === risk.id ? '已复制' : '复制话术' }}
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
