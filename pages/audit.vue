<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { Clause } from '~~/server/utils/types'
import type { RiskItem } from '~~/server/utils/review'
import type { TimelineStep } from '~/components/AgentTimeline.vue'
import type { TraceEntry } from '~/components/TraceLog.vue'

interface LawCandidate {
  id: string
  short: string
  article: string
  text: string
  score: number
}

interface DocResponse {
  docId: string
  text: string
  preamble: string
  clauses: Clause[]
  strategy: string
  source: 'pdf-text' | 'vision' | 'paste'
  pages: number | null
  counts: Record<string, number>
  chars: number
  hasReport: boolean
}

interface ScorePayload {
  score: number
  stats: { high: number; medium: number; low: number; ok: number }
  summary: string
  tookMs: number
  calls: number
}

const route = useRoute()
const docId = String(route.query.doc ?? '')

const doc = ref<DocResponse | null>(null)
const risks = ref<Record<string, RiskItem>>({})
const score = ref<ScorePayload | null>(null)
const streaming = ref(false)
const errorMessage = ref('')
const selectedId = ref('')
const tab = ref<'clauses' | 'risks' | 'detail'>('risks')
const copied = ref(false)

const steps = ref<TimelineStep[]>([
  { key: 'retrieve', label: '检索候选法条', status: 'pending' },
  { key: 'judge', label: '逐条判定风险', status: 'pending' },
  { key: 'advise', label: '生成改法与话术', status: 'pending' },
  { key: 'score', label: '汇总体检分', status: 'pending' },
])

const LEVEL_ORDER = { high: 0, medium: 1, low: 2, ok: 3 } as const
const LEVEL_DOT: Record<string, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-sky-500',
  ok: 'bg-slate-300',
}
const LEVEL_BAR: Record<string, string> = {
  high: 'bg-rose-400',
  medium: 'bg-amber-400',
  low: 'bg-sky-400',
  ok: 'bg-slate-200',
}

const clauseById = computed(() => new Map((doc.value?.clauses ?? []).map((clause) => [clause.id, clause])))
const riskList = computed(() => Object.values(risks.value))
const sortedRisks = computed(() =>
  [...riskList.value].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]),
)
const selectedClause = computed(() => clauseById.value.get(selectedId.value))
const selectedRisk = computed(() => risks.value[selectedId.value])
const pendingCount = computed(() => (doc.value?.clauses.length ?? 0) - riskList.value.length)

// 调用轨迹：把 SSE 事件按时间顺序记录下来，让「AI 做了什么」可见
// 初值取页面加载时间，刷新查看历史结果时时间戳同样是相对值
const trace = ref<TraceEntry[]>([])
let traceStart = Date.now()

function pushTrace(kind: TraceEntry['kind'], text: string) {
  trace.value.push({ t: Date.now() - traceStart, kind, text })
}

function applyStep(step: TimelineStep) {
  const index = steps.value.findIndex((item) => item.key === step.key)
  if (index >= 0) steps.value[index] = { ...steps.value[index]!, ...step }
  if (step.status === 'done') {
    pushTrace('step', `${step.label}${step.detail ? ' · ' + step.detail : ''}${step.ms ? ` · ${step.ms}ms` : ''}`)
  }
}

function mergeRisk(risk: RiskItem) {
  const previous = risks.value[risk.clauseId]
  risks.value[risk.clauseId] = { ...previous, ...risk }
  if (!selectedId.value) selectedId.value = risk.clauseId

  if (!previous) {
    pushTrace('risk', `${risk.clauseNo ?? risk.clauseId} 判定为 ${risk.level} · ${risk.title}`)
  } else if (!previous.suggestion && risk.suggestion) {
    pushTrace('info', `${risk.clauseNo ?? risk.clauseId} 已生成改法与话术`)
  }
}

// 某条条款检索到的候选法条（证明 RAG 真的在检索，而不是模型背法条）
const candidates = ref<Record<string, LawCandidate[]>>({})
const candidatesLoading = ref(false)

async function loadCandidates(clause: Clause) {
  if (candidates.value[clause.id]) return
  candidatesLoading.value = true
  try {
    const data = await $fetch<{ items: LawCandidate[] }>('/api/law/search', {
      query: { q: clause.text, topK: 5 },
    })
    candidates.value[clause.id] = data.items
  } catch {
    candidates.value[clause.id] = []
  } finally {
    candidatesLoading.value = false
  }
}

function isCited(lawId: string) {
  return selectedRisk.value?.basis.some((basis) => basis.lawId === lawId) ?? false
}

/** 未判定的条款显示呼吸点，像「AI 正在看这一条」 */
function barClass(clauseId: string) {
  const risk = risks.value[clauseId]
  if (risk) return LEVEL_BAR[risk.level] ?? 'bg-slate-200'
  return streaming.value ? 'bg-slate-200 animate-pulse' : 'bg-slate-200'
}

function handleEvent(raw: string) {
  const lines = raw.split('\n')
  let event = 'message'
  const data: string[] = []

  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data.push(line.slice(5).trim())
  }
  if (!data.length) return

  const payload = JSON.parse(data.join('\n'))

  if (event === 'step') applyStep(payload as TimelineStep)
  else if (event === 'risk') mergeRisk(payload as RiskItem)
  else if (event === 'score') {
    score.value = payload as ScorePayload
    applyStep({ key: 'score', label: '汇总体检分', status: 'done' })
  } else if (event === 'error') errorMessage.value = (payload as { message: string }).message
}

async function startStream() {
  streaming.value = true
  traceStart = Date.now()
  try {
    const response = await fetch('/api/audit/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ docId }),
    })
    if (!response.ok || !response.body) throw new Error('stream failed')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const chunks = buffer.split('\n\n')
      buffer = chunks.pop() ?? ''
      chunks.filter(Boolean).forEach(handleEvent)
    }
  } catch (error) {
    console.error(error)
    errorMessage.value = '审查中断，请刷新重试'
  } finally {
    streaming.value = false
  }
}

onMounted(async () => {
  if (!docId) {
    errorMessage.value = '链接缺少合同标识，请重新上传'
    return
  }

  try {
    doc.value = await $fetch<DocResponse>('/api/audit/doc', { query: { docId } })
    pushTrace('info', `载入合同 · ${doc.value.clauses.length} 条条款`)

    // 刷新页面时直接把上次结果读回来，不重复花模型调用
    if (doc.value.hasReport) {
      const report = await $fetch<any>('/api/report', { query: { docId } })
      score.value = { ...report.review, tookMs: report.review.tookMs, calls: report.review.calls }
      for (const risk of report.review.risks as RiskItem[]) mergeRisk(risk)
      steps.value.forEach((step) => (step.status = 'done'))
      pushTrace('info', '已载入上次审查结果，未重复调用模型')
      return
    }

    await startStream()
  } catch (err: any) {
    errorMessage.value = err?.data?.message || '加载失败，请重新上传'
  }
})

function select(clauseId: string) {
  selectedId.value = clauseId
  tab.value = 'detail'
}

// 选中哪条就检索哪条，默认选中第一条风险
watch(selectedId, (clauseId) => {
  const clause = clauseById.value.get(clauseId)
  if (clause) void loadCandidates(clause)
})

async function copyNegotiation() {
  if (!selectedRisk.value?.negotiation) return
  await navigator.clipboard.writeText(selectedRisk.value.negotiation)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

/** 语音播报：浏览器原生 speechSynthesis，不需要额外服务 */
const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
const speaking = ref(false)

function speak(text?: string, fallback?: string) {
  if (!speechSupported) return
  const content = (text ?? score.value?.summary ?? fallback ?? '').trim()
  if (!content) return

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(content)
  utterance.lang = 'zh-CN'
  utterance.rate = 1.05
  utterance.onstart = () => (speaking.value = true)
  utterance.onend = () => (speaking.value = false)
  utterance.onerror = () => (speaking.value = false)
  window.speechSynthesis.speak(utterance)
}

function stopSpeaking() {
  if (!speechSupported) return
  window.speechSynthesis.cancel()
  speaking.value = false
}
</script>

<template>
  <main class="px-4 py-5">
    <header class="flex items-center gap-4">
      <span class="text-sm font-semibold text-slate-800">审查工作台</span>

      <button
        v-if="speechSupported && score"
        class="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:border-slate-400"
        @click="speaking ? stopSpeaking() : speak()"
      >
        {{ speaking ? '停止朗读' : '朗读摘要' }}
      </button>

      <NuxtLink
        v-if="score"
        :to="`/report?doc=${docId}`"
        class="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white"
        :class="speechSupported ? '' : 'ml-auto'"
      >
        生成体检报告
      </NuxtLink>
    </header>

    <p v-if="errorMessage" class="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ errorMessage }}
    </p>

    <section class="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
      <ScoreHeader
        v-if="score"
        :score="score.score"
        :stats="score.stats"
        :summary="score.summary"
        :took-ms="score.tookMs"
        :calls="score.calls"
      />
      <div v-else class="flex items-center gap-3">
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
        <p class="text-sm text-slate-600">
          正在审查，已判定 {{ riskList.length }} / {{ doc?.clauses.length ?? 0 }} 条
        </p>
      </div>

      <div class="mt-4 border-t border-slate-100 pt-3">
        <AgentTimeline :steps="steps" />
      </div>

      <div class="mt-3">
        <TraceLog :entries="trace" :running="streaming" />
      </div>
    </section>

    <!-- 移动端切换 -->
    <div class="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-xs lg:hidden">
      <button
        v-for="item in [
          { key: 'clauses', label: '原文' },
          { key: 'risks', label: `风险 ${riskList.length}` },
          { key: 'detail', label: '详情' },
        ]"
        :key="item.key"
        class="flex-1 rounded-md px-3 py-1.5"
        :class="tab === item.key ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500'"
        @click="tab = item.key as any"
      >
        {{ item.label }}
      </button>
    </div>

    <div class="mt-3 grid gap-3 lg:grid-cols-[1.05fr_0.9fr_1.15fr]">
      <!-- 原文 -->
      <section
        class="min-w-0 rounded-2xl border border-slate-200 bg-white"
        :class="tab === 'clauses' ? '' : 'hidden lg:block'"
      >
        <div class="flex items-baseline justify-between border-b border-slate-100 px-4 py-2.5">
          <h2 class="text-xs font-medium text-slate-500">合同原文</h2>
          <span class="text-[11px] text-slate-300">{{ doc?.clauses.length ?? 0 }} 条</span>
        </div>
        <ul class="max-h-[62vh] divide-y divide-slate-50 overflow-auto">
          <li
            v-for="clause in doc?.clauses ?? []"
            :key="clause.id"
            class="flex cursor-pointer gap-2 px-3 py-2.5 hover:bg-slate-50"
            :class="selectedId === clause.id ? 'bg-emerald-50/60' : ''"
            @click="select(clause.id)"
          >
            <span
              class="mt-1 h-3 w-1 shrink-0 rounded-full"
              :class="barClass(clause.id)"
            />
            <div class="min-w-0">
              <p class="text-[11px] text-slate-400">{{ clause.no ?? `#${clause.index}` }}</p>
              <p class="mt-0.5 line-clamp-3 text-xs leading-5 text-slate-700">{{ clause.text }}</p>
            </div>
          </li>
        </ul>
      </section>

      <!-- 风险清单 -->
      <section
        class="min-w-0 rounded-2xl border border-slate-200 bg-white"
        :class="tab === 'risks' ? '' : 'hidden lg:block'"
      >
        <div class="flex items-baseline justify-between border-b border-slate-100 px-4 py-2.5">
          <h2 class="text-xs font-medium text-slate-500">风险清单</h2>
          <span class="text-[11px] text-slate-300">
            {{ riskList.filter((risk) => risk.level !== 'ok').length }} 条风险
          </span>
        </div>
        <ul class="max-h-[62vh] divide-y divide-slate-50 overflow-auto">
          <li
            v-for="risk in sortedRisks"
            :key="risk.id"
            class="flex cursor-pointer items-start gap-2 px-4 py-2.5 hover:bg-slate-50"
            :class="selectedId === risk.clauseId ? 'bg-emerald-50/60' : ''"
            @click="select(risk.clauseId)"
          >
            <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" :class="LEVEL_DOT[risk.level]" />
            <div class="min-w-0">
              <p class="truncate text-xs font-medium text-slate-800">{{ risk.title }}</p>
              <p class="mt-0.5 text-[11px] text-slate-400">
                {{ risk.clauseNo ?? risk.clauseId }}
                <span v-if="risk.basis.length"> · {{ risk.basis[0]!.law }}{{ risk.basis[0]!.article }}</span>
              </p>
            </div>
          </li>
          <li v-if="pendingCount > 0" class="px-4 py-3 text-[11px] text-slate-300">
            还有 {{ pendingCount }} 条正在判定…
          </li>
        </ul>
      </section>

      <!-- 详情 -->
      <section
        class="min-w-0 rounded-2xl border border-slate-200 bg-white"
        :class="tab === 'detail' ? '' : 'hidden lg:block'"
      >
        <div class="border-b border-slate-100 px-4 py-2.5">
          <h2 class="text-xs font-medium text-slate-500">条款详情</h2>
        </div>

        <div v-if="!selectedClause" class="px-4 py-10 text-center text-xs text-slate-300">
          点击左侧条款或风险查看详情
        </div>

        <div v-else class="max-h-[62vh] min-w-0 space-y-4 overflow-auto px-4 py-4">
          <div>
            <p class="text-[11px] text-slate-400">{{ selectedClause.no ?? `#${selectedClause.index}` }}</p>
            <p class="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{{ selectedClause.text }}</p>
          </div>

          <div v-if="selectedRisk && selectedRisk.level !== 'ok'" class="space-y-3 border-t border-slate-100 pt-3">
            <div>
              <p class="text-xs font-semibold text-slate-800">{{ selectedRisk.title }}</p>
              <p class="mt-1 text-xs leading-5 text-slate-600">{{ selectedRisk.issue }}</p>
            </div>

            <ul v-if="selectedRisk.basis.length" class="space-y-1.5">
              <li
                v-for="basis in selectedRisk.basis"
                :key="basis.lawId"
                class="rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] leading-5"
              >
                <span class="font-medium text-slate-700">{{ basis.law }} · {{ basis.article }}</span>
                <span class="block text-slate-500">「{{ basis.quote }}」</span>
              </li>
            </ul>

            <div v-if="selectedRisk.suggestion" class="text-xs leading-5 text-slate-600">
              <span class="font-medium text-slate-700">改法：</span>{{ selectedRisk.suggestion }}
            </div>

            <div v-if="selectedRisk.revisedClause" class="rounded-lg border border-dashed border-slate-200 px-2.5 py-2">
              <p class="text-[11px] font-medium text-slate-500">建议条款</p>
              <p class="mt-1 text-xs leading-5 text-slate-700">{{ selectedRisk.revisedClause }}</p>
            </div>

            <div v-if="selectedRisk.negotiation" class="rounded-lg bg-emerald-50 px-2.5 py-2">
              <div class="flex items-center justify-between">
                <p class="text-[11px] font-medium text-emerald-800">谈判话术</p>
                <div class="flex items-center gap-2">
                  <button
                    v-if="speechSupported"
                    class="text-[11px] text-emerald-700 hover:underline"
                    @click="speak(selectedRisk.negotiation)"
                  >
                    朗读
                  </button>
                  <button class="text-[11px] text-emerald-700 hover:underline" @click="copyNegotiation">
                    {{ copied ? '已复制' : '复制' }}
                  </button>
                </div>
              </div>
              <p class="mt-1 text-xs leading-5 text-emerald-900">{{ selectedRisk.negotiation }}</p>
            </div>
          </div>

          <p v-else-if="selectedRisk" class="text-xs text-emerald-700">这条没有明显问题。</p>

          <!-- 检索候选：证明结论不是模型凭空生成 -->
          <div class="border-t border-slate-100 pt-3">
            <div class="flex items-center justify-between">
              <p class="text-[11px] font-medium text-slate-500">这条检索到的候选法条</p>
              <span class="font-mono text-[10px] text-slate-300">
                {{ candidates[selectedClause.id]?.length ?? 0 }} 条
              </span>
            </div>

            <p v-if="candidatesLoading && !candidates[selectedClause.id]" class="mt-2 text-[11px] text-slate-400">
              检索中…
            </p>
            <ul v-else-if="candidates[selectedClause.id]?.length" class="mt-2 space-y-1">
              <li
                v-for="candidate in candidates[selectedClause.id]"
                :key="candidate.id"
                class="rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] leading-5"
              >
                <div class="flex items-center gap-1.5">
                  <span class="font-medium text-slate-700">{{ candidate.short }} · {{ candidate.article }}</span>
                  <span
                    v-if="isCited(candidate.id)"
                    class="rounded bg-emerald-100 px-1 text-[10px] text-emerald-700"
                  >
                    已引用
                  </span>
                  <span class="ml-auto font-mono text-[10px] text-slate-400">{{ candidate.score.toFixed(2) }}</span>
                </div>
                <p class="truncate text-slate-500">{{ candidate.text }}</p>
              </li>
            </ul>
            <p v-else class="mt-2 text-[11px] text-slate-300">点击条款后自动检索</p>
          </div>
        </div>
      </section>
    </div>

    <p class="mt-6 text-[11px] leading-5 text-slate-400">
      本工具基于公开法规做风险提示，不构成法律意见。所有引用均可回溯到法条原文。
    </p>
  </main>
</template>
