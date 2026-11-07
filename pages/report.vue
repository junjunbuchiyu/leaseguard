<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { RiskItem } from '~~/server/utils/review'
import type { AgentSummary } from '~~/server/utils/review'

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
    agent: AgentSummary | null
  }
  disclaimer: string
}

const route = useRoute()
// 同工作台：切换 doc 只是 query 变化，组件不会重建
const docId = computed(() => String(route.query.doc ?? ''))
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

const agent = computed(() => report.value?.review.agent ?? null)

async function load(id: string) {
  report.value = null
  errorMessage.value = ''
  if (!id) {
    errorMessage.value = '链接缺少合同标识'
    return
  }

  try {
    report.value = await $fetch<Report>('/api/report', { query: { docId: id } })
  } catch (err: any) {
    errorMessage.value = err?.data?.message || '报告加载失败'
  }
}

onMounted(() => void load(docId.value))

watch(
  () => route.query.doc,
  (value) => {
    const next = String(value ?? '')
    if (next) void load(next)
  },
)

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
  <main class="app-shell min-h-screen px-5 py-8">
    <div class="mx-auto max-w-3xl">
      <div class="no-print mb-5 flex items-center gap-3">
        <NuxtLink :to="`/audit?doc=${docId}`" class="text-sm text-slate-500 transition hover:text-slate-300">
          ← 返回工作台
        </NuxtLink>
        <button class="btn-ghost ml-auto px-4 py-2 text-xs" @click="printPage">打印 / 导出 PDF</button>
      </div>

      <p v-if="errorMessage" class="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        {{ errorMessage }}
      </p>

      <article v-if="report" class="sheet panel px-8 py-10">
        <header class="border-b border-white/[0.07] pb-5">
          <p class="mono-label">LeaseGuard · Report</p>
          <h1 class="mt-2 text-2xl font-bold text-slate-100">{{ report.contract.title }}</h1>
          <p class="mono mt-1 text-[10px] text-slate-500">生成时间 {{ date }}</p>
        </header>

        <section class="mt-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div class="panel-flat px-3 py-2">
            <p class="text-[10px] text-slate-500">月租金</p>
            <p class="mt-0.5 font-medium text-slate-200">{{ report.contract.rent ?? '未识别' }}</p>
          </div>
          <div class="panel-flat px-3 py-2">
            <p class="text-[10px] text-slate-500">押金</p>
            <p class="mt-0.5 font-medium text-slate-200">{{ report.contract.deposit ?? '未识别' }}</p>
          </div>
          <div class="panel-flat px-3 py-2">
            <p class="text-[10px] text-slate-500">租期</p>
            <p class="mt-0.5 truncate font-medium text-slate-200">{{ report.contract.term ?? '未识别' }}</p>
          </div>
          <div class="panel-flat px-3 py-2">
            <p class="text-[10px] text-slate-500">敏感信息遮盖</p>
            <p class="mt-0.5 font-medium text-slate-200">{{ report.masked }} 处</p>
          </div>
        </section>

        <section class="panel-flat mt-6 flex items-center gap-5 px-4 py-4">
          <div class="text-center">
            <p class="mono text-3xl font-bold text-slate-100">{{ report.review.score }}</p>
            <p class="text-[10px] text-slate-500">体检分 / 100</p>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm text-slate-300">{{ report.review.summary }}</p>
            <div class="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
              <span>高风险 {{ report.review.stats.high }}</span>
              <span>中风险 {{ report.review.stats.medium }}</span>
              <span>低风险 {{ report.review.stats.low }}</span>
              <span>正常 {{ report.review.stats.ok }}</span>
            </div>
          </div>
        </section>

        <!-- 整体总结：先给结论，再给明细 -->
        <section class="panel-flat mt-6 break-inside-avoid px-5 py-4">
          <h2 class="text-sm font-semibold text-slate-100">整体总结</h2>

          <p class="mt-2 text-xs leading-6 text-slate-300">
            共审查 {{ totalClauses }} 条条款：{{ report.review.stats.high }} 条高风险、{{ report.review.stats.medium }}
            条中风险、{{ report.review.stats.low }} 条低风险。{{ focusText }}
          </p>

          <p class="mt-1.5 text-xs leading-6 text-slate-200">
            <span class="font-semibold">结论：</span>{{ verdict }}。
          </p>

          <div v-if="highRisks.length" class="mt-3 border-t border-white/[0.06] pt-3">
            <p class="mono text-[10px] text-slate-500">优先协商（按风险顺序，最多三条）</p>
            <ol class="mt-1.5 space-y-1">
              <li v-for="(risk, index) in highRisks.slice(0, 3)" :key="risk.id" class="text-xs leading-5 text-slate-400">
                （{{ index + 1 }}）{{ risk.clauseNo ?? '该条款' }} · {{ risk.title }}
              </li>
            </ol>
          </div>

          <p class="mt-3 rounded-lg bg-white/[0.04] px-3 py-2 text-xs leading-5 text-slate-400">
            <span class="font-medium text-slate-200">下一步：</span>{{ nextStep }}
          </p>
        </section>

        <!-- 整体话术：一条条改是律师视角，用户真正需要的是「怎么开口」 -->
        <section
          v-if="report.review.overall"
          class="mt-6 break-inside-avoid rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] px-5 py-4"
        >
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-emerald-200">整体沟通话术</h2>
            <button class="no-print text-[11px] text-emerald-300 hover:underline" @click="copyOverall">
              {{ copiedOverall ? '已复制' : '复制这段话' }}
            </button>
          </div>
          <p class="mt-2 text-xs leading-6 text-emerald-50">{{ report.review.overall }}</p>
          <p class="mt-2 text-[10px] leading-4 text-emerald-300/60">
            把这段话连同报告一起发给房东，比逐条念法条更容易谈成。
          </p>
        </section>

        <!-- Agent 运行摘要：让评审看到这份报告是怎么出来的 -->
        <section v-if="agent" class="panel-flat mt-6 break-inside-avoid px-5 py-4">
          <h2 class="text-sm font-semibold text-slate-100">审查过程</h2>
          <div class="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
            <div>
              <p class="text-slate-500">工具调用</p>
              <p class="mono text-slate-200">{{ agent.toolCalls }} 次</p>
            </div>
            <div>
              <p class="text-slate-500">自省补证</p>
              <p class="mono text-slate-200">{{ agent.reflections }} 次</p>
            </div>
            <div>
              <p class="text-slate-500">结论修正</p>
              <p class="mono text-slate-200">{{ agent.corrections }} 条</p>
            </div>
            <div>
              <p class="text-slate-500">模型调用</p>
              <p class="mono text-slate-200">{{ report.review.calls }} 次</p>
            </div>
          </div>
          <p class="mt-2 text-[11px] leading-5 text-slate-500">
            策略：{{ agent.plan.strategy === 'deep' ? '深审' : '快审' }} · 聚焦 {{ agent.plan.focus.join('、') }}。{{ agent.plan.note }}
          </p>
        </section>

        <section v-if="risks.length" class="mt-6 space-y-4">
          <h2 class="text-sm font-semibold text-slate-100">风险明细</h2>
          <div
            v-for="risk in risks"
            :key="risk.id"
            class="break-inside-avoid rounded-xl border border-white/[0.08] px-4 py-3"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="rounded border px-1.5 py-0.5 text-[10px] font-medium"
                :class="
                  risk.level === 'high'
                    ? 'border-rose-400/30 bg-rose-500/10 text-rose-300'
                    : risk.level === 'medium'
                      ? 'border-amber-400/30 bg-amber-500/10 text-amber-300'
                      : 'border-sky-400/30 bg-sky-500/10 text-sky-300'
                "
              >
                {{ LEVEL_LABEL[risk.level] }}
              </span>
              <span class="text-xs text-slate-500">{{ risk.clauseNo }}</span>
              <span class="text-sm font-medium text-slate-200">{{ risk.title }}</span>
            </div>

            <p class="mt-2 text-xs leading-5 text-slate-400">{{ risk.issue }}</p>

            <ul v-if="risk.basis.length" class="mt-2 space-y-1">
              <li v-for="basis in risk.basis" :key="basis.lawId" class="text-[11px] leading-5 text-slate-500">
                <span class="font-medium text-slate-300">{{ basis.law }} · {{ basis.article }}</span>「{{ basis.quote }}」
              </li>
            </ul>

            <p v-if="risk.suggestion" class="mt-2 text-[11px] leading-5 text-slate-400">
              <span class="font-medium text-slate-200">修改建议：</span>{{ risk.suggestion }}
            </p>
            <p v-if="risk.negotiation" class="mt-1.5 text-[11px] leading-5 text-emerald-300">
              <span class="font-medium">沟通话术：</span>{{ risk.negotiation }}
            </p>
          </div>
        </section>

        <p v-else class="mt-6 rounded-lg border border-emerald-400/20 bg-emerald-500/[0.07] px-4 py-3 text-sm text-emerald-200">
          未发现明显风险条款。
        </p>

        <footer class="mt-8 border-t border-white/[0.07] pt-4">
          <p class="text-[11px] leading-5 text-slate-500">{{ report.disclaimer }}</p>
          <p class="mono mt-2 text-[10px] text-slate-600">
            审查 {{ report.review.calls }} 次模型调用 · 耗时 {{ (report.review.tookMs / 1000).toFixed(1) }}s ·
            共 {{ report.chars }} 字
          </p>
        </footer>
      </article>
    </div>
  </main>
</template>

<style>
/* 打印：报告页转白底黑字，别把深色主题一起打出来 */
@media print {
  .no-print {
    display: none !important;
  }
  body {
    background: #fff !important;
  }
  .app-shell {
    background: #fff !important;
  }
  .sheet {
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    background: #fff !important;
  }
  .sheet *,
  .sheet p,
  .sheet span,
  .sheet h1,
  .sheet h2,
  .sheet li,
  .sheet div {
    color: #0f172a !important;
    border-color: #cbd5e1 !important;
    background: transparent !important;
  }
  .sheet .mono-label {
    color: #047857 !important;
  }
  @page {
    margin: 14mm;
  }
}
</style>
