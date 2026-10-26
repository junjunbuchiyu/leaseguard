<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { RiskItem } from '~~/server/utils/review'

interface Report {
  docId: string
  createdAt: string
  source: string
  chars: number
  masked: number
  contract: { title: string; rent: string | null; deposit: string | null; term: string | null; parties: string[] }
  review: {
    score: number
    stats: { high: number; medium: number; low: number; ok: number }
    summary: string
    overall: string | null
    risks: RiskItem[]
    tookMs: number
    calls: number
  }
  disclaimer: string
}

const route = useRoute()
const docId = String(route.query.doc ?? '')
const report = ref<Report | null>(null)
const errorMessage = ref('')

const LEVEL_LABEL: Record<string, string> = { high: '高风险', medium: '中风险', low: '低风险', ok: '正常' }
const ORDER = { high: 0, medium: 1, low: 2, ok: 3 } as const

const risks = computed(() =>
  [...(report.value?.review.risks ?? [])]
    .filter((risk) => risk.level !== 'ok')
    .sort((a, b) => ORDER[a.level] - ORDER[b.level]),
)

const date = computed(() => {
  if (!report.value) return ''
  return new Date(report.value.createdAt).toLocaleString('zh-CN', { hour12: false })
})

/** 整体总结：把逐条结论压成「问题集中在哪 + 先谈哪几条」 */
const totalClauses = computed(() => report.value?.review.risks.length ?? 0)
const highRisks = computed(() => risks.value.filter((risk) => risk.level === 'high'))

const tagRanking = computed(() => {
  const counter = new Map<string, number>()
  for (const risk of risks.value) {
    const tag = risk.tag || '其他'
    counter.set(tag, (counter.get(tag) ?? 0) + 1)
  }
  return [...counter.entries()].sort((a, b) => b[1] - a[1])
})

const focusText = computed(() => {
  const top = tagRanking.value.slice(0, 2).map(([tag]) => tag)
  if (!top.length) return '未发现需要重点关注的条款。'
  return `问题集中在${top.join('、')}${top.length > 1 ? '等方面' : ''}。`
})

const verdict = computed(() => {
  const stats = report.value?.review.stats
  if (!stats) return ''
  if (stats.high > 0) return '风险较高，建议先修改再签'
  if (stats.medium > 0) return '基本可用，但有几处需要确认'
  return '整体规范，核对原件即可签约'
})

const nextStep = computed(() => {
  const first = highRisks.value[0]
  if (first) {
    return `优先处理 ${first.clauseNo ?? '该条款'}「${first.title}」，拿着报告里的谈判话术去沟通；其余条款按风险从高到低逐条确认。`
  }
  if (risks.value.length) return '没有高风险条款，把中风险条款逐条确认后即可签约。'
  return '未发现明显风险，签约前再核对一遍原件即可。'
})

onMounted(async () => {
  try {
    report.value = await $fetch<Report>('/api/report', { query: { docId } })
  } catch (err: any) {
    errorMessage.value = err?.data?.message || '报告加载失败'
  }
})

function printPage() {
  window.print()
}

const copiedOverall = ref(false)
async function copyOverall() {
  if (!report.value?.review.overall) return
  await navigator.clipboard.writeText(report.value.review.overall)
  copiedOverall.value = true
  setTimeout(() => (copiedOverall.value = false), 1500)
}
</script>

<template>
  <main class="mx-auto max-w-3xl px-5 py-8">
    <div class="no-print mb-5 flex items-center gap-3">
      <NuxtLink :to="`/audit?doc=${docId}`" class="text-sm text-slate-400 hover:text-slate-600">
        ← 返回工作台
      </NuxtLink>
      <button
        class="ml-auto rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white"
        @click="printPage"
      >
        打印 / 导出 PDF
      </button>
    </div>

    <p v-if="errorMessage" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ errorMessage }}
    </p>

    <article v-if="report" class="sheet rounded-2xl border border-slate-200 bg-white px-8 py-10">
      <header class="border-b border-slate-100 pb-5">
        <p class="text-[11px] tracking-widest text-emerald-600">LEASEGUARD · 租约体检报告</p>
        <h1 class="mt-2 text-2xl font-bold text-slate-900">{{ report.contract.title }}</h1>
        <p class="mt-1 text-xs text-slate-400">生成时间 {{ date }}</p>
      </header>

      <section class="mt-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div class="rounded-lg bg-slate-50 px-3 py-2">
          <p class="text-[11px] text-slate-400">月租金</p>
          <p class="mt-0.5 font-medium text-slate-800">{{ report.contract.rent ?? '未识别' }}</p>
        </div>
        <div class="rounded-lg bg-slate-50 px-3 py-2">
          <p class="text-[11px] text-slate-400">押金</p>
          <p class="mt-0.5 font-medium text-slate-800">{{ report.contract.deposit ?? '未识别' }}</p>
        </div>
        <div class="rounded-lg bg-slate-50 px-3 py-2">
          <p class="text-[11px] text-slate-400">租期</p>
          <p class="mt-0.5 truncate font-medium text-slate-800">{{ report.contract.term ?? '未识别' }}</p>
        </div>
        <div class="rounded-lg bg-slate-50 px-3 py-2">
          <p class="text-[11px] text-slate-400">敏感信息遮盖</p>
          <p class="mt-0.5 font-medium text-slate-800">{{ report.masked }} 处</p>
        </div>
      </section>

      <section class="mt-6 flex items-center gap-5 rounded-xl border border-slate-100 px-4 py-4">
        <div class="text-center">
          <p class="text-3xl font-bold tabular-nums text-slate-900">{{ report.review.score }}</p>
          <p class="text-[11px] text-slate-400">体检分 / 100</p>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-slate-700">{{ report.review.summary }}</p>
          <div class="mt-2 flex gap-3 text-[11px] text-slate-500">
            <span>高风险 {{ report.review.stats.high }}</span>
            <span>中风险 {{ report.review.stats.medium }}</span>
            <span>低风险 {{ report.review.stats.low }}</span>
            <span>正常 {{ report.review.stats.ok }}</span>
          </div>
        </div>
      </section>

      <!-- 整体总结：先给结论，再给明细 -->
      <section class="mt-6 break-inside-avoid rounded-xl border border-slate-200 px-5 py-4">
        <h2 class="text-sm font-semibold text-slate-900">整体总结</h2>

        <p class="mt-2 text-xs leading-6 text-slate-700">
          共审查 {{ totalClauses }} 条条款：{{ report.review.stats.high }} 条高风险、{{
            report.review.stats.medium
          }}
          条中风险、{{ report.review.stats.low }} 条低风险。{{ focusText }}
        </p>

        <p class="mt-1.5 text-xs leading-6 text-slate-900">
          <span class="font-semibold">结论：</span>{{ verdict }}。
        </p>

        <div v-if="highRisks.length" class="mt-3 border-t border-slate-100 pt-3">
          <p class="text-[11px] font-medium text-slate-500">优先协商（按风险顺序，最多三条）</p>
          <ol class="mt-1.5 space-y-1">
            <li
              v-for="(risk, index) in highRisks.slice(0, 3)"
              :key="risk.id"
              class="text-xs leading-5 text-slate-600"
            >
              （{{ index + 1 }}）{{ risk.clauseNo ?? '该条款' }} · {{ risk.title }}
            </li>
          </ol>
        </div>

        <p class="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
          <span class="font-medium text-slate-800">下一步：</span>{{ nextStep }}
        </p>
      </section>

      <!-- 整体话术：一条条改是律师视角，用户真正需要的是「怎么开口」 -->
      <section v-if="report.review.overall" class="mt-6 break-inside-avoid rounded-xl border border-emerald-200 bg-emerald-50/50 px-5 py-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-emerald-900">整体沟通话术</h2>
          <button class="no-print text-[11px] text-emerald-700 hover:underline" @click="copyOverall">
            {{ copiedOverall ? '已复制' : '复制这段话' }}
          </button>
        </div>
        <p class="mt-2 text-xs leading-6 text-emerald-950">{{ report.review.overall }}</p>
        <p class="mt-2 text-[10px] leading-4 text-emerald-700/70">
          把这段话连同报告一起发给房东，比逐条念法条更容易谈成。
        </p>
      </section>

      <section v-if="risks.length" class="mt-6 space-y-4">
        <h2 class="text-sm font-semibold text-slate-900">风险明细</h2>
        <div
          v-for="risk in risks"
          :key="risk.id"
          class="break-inside-avoid rounded-xl border border-slate-200 px-4 py-3"
        >
          <div class="flex items-center gap-2">
            <span
              class="rounded px-1.5 py-0.5 text-[11px] font-medium"
              :class="
                risk.level === 'high'
                  ? 'bg-rose-50 text-rose-700'
                  : risk.level === 'medium'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-sky-50 text-sky-700'
              "
            >
              {{ LEVEL_LABEL[risk.level] }}
            </span>
            <span class="text-xs text-slate-500">{{ risk.clauseNo }}</span>
            <span class="text-sm font-medium text-slate-800">{{ risk.title }}</span>
          </div>

          <p class="mt-2 text-xs leading-5 text-slate-600">{{ risk.issue }}</p>

          <ul v-if="risk.basis.length" class="mt-2 space-y-1">
            <li v-for="basis in risk.basis" :key="basis.lawId" class="text-[11px] leading-5 text-slate-500">
              <span class="font-medium text-slate-700">{{ basis.law }} · {{ basis.article }}</span>「{{ basis.quote }}」
            </li>
          </ul>

          <p v-if="risk.suggestion" class="mt-2 text-[11px] leading-5 text-slate-600">
            <span class="font-medium text-slate-700">修改建议：</span>{{ risk.suggestion }}
          </p>
          <p v-if="risk.negotiation" class="mt-1.5 text-[11px] leading-5 text-emerald-800">
            <span class="font-medium">沟通话术：</span>{{ risk.negotiation }}
          </p>
        </div>
      </section>

      <p v-else class="mt-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        未发现明显风险条款。
      </p>

      <footer class="mt-8 border-t border-slate-100 pt-4">
        <p class="text-[11px] leading-5 text-slate-400">{{ report.disclaimer }}</p>
        <p class="mt-2 text-[11px] text-slate-300">
          审查 {{ report.review.calls }} 次模型调用 · 耗时 {{ (report.review.tookMs / 1000).toFixed(1) }}s ·
          共 {{ report.chars }} 字
        </p>
      </footer>
    </article>
  </main>
</template>

<style>
@media print {
  .no-print {
    display: none !important;
  }
  body {
    background: #fff;
  }
  .sheet {
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
  @page {
    margin: 14mm;
  }
}
</style>
