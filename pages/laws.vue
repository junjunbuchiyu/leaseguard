<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

interface LawHit {
  id: string
  law: string
  short: string
  level: string
  article: string
  text: string
  tags: string[]
  sourceUrl: string
  score: number
  bm25: number
  cosine: number
  tagHit: boolean
}

interface LawListResponse {
  total: number
  laws: { short: string; law: string; level: string; effectiveDate: string; sourceUrl: string; count: number }[]
}

const EXAMPLES = ['押金不退', '房东随时进门', '阳台改卧室出租', '维修费用谁承担', '提前退租违约金', '二房东收钱跑路']

const query = ref('')
const items = ref<LawHit[]>([])
const loading = ref(false)
const tookMs = ref(0)
const meta = ref<LawListResponse | null>(null)

let timer: ReturnType<typeof setTimeout> | undefined

async function run() {
  const q = query.value.trim()
  if (!q) {
    items.value = []
    tookMs.value = 0
    return
  }

  loading.value = true
  try {
    const data = await $fetch<{ items: LawHit[]; tookMs: number }>('/api/law/search', {
      query: { q, topK: 5 },
    })
    items.value = data.items
    tookMs.value = data.tookMs
  } finally {
    loading.value = false
  }
}

watch(query, () => {
  clearTimeout(timer)
  timer = setTimeout(run, 250)
})

onMounted(async () => {
  meta.value = await $fetch<LawListResponse>('/api/law/list')

  // 支持 /laws?q=押金不退 直接带查询进来，方便分享与截图
  const initial = useRoute().query.q
  if (typeof initial === 'string' && initial.trim()) {
    query.value = initial.trim()
    await run()
  }
})

function pick(example: string) {
  query.value = example
}
</script>

<template>
  <main class="app-shell min-h-screen px-5 py-12">
    <div class="mx-auto max-w-3xl">
      <p class="mono-label">Retrieval</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-100">法规库</h1>
      <p v-if="meta" class="mt-2 text-sm leading-6 text-slate-400">
        {{ meta.total }} 条与住房租赁直接相关的条文，检索结果会作为合同审查的引用依据。
      </p>

      <!-- 检索配方：把权重摆出来，证明不是黑盒 -->
      <div class="mt-4 flex flex-wrap gap-2 text-[10px]">
        <span class="mono rounded-full border border-emerald-400/25 bg-emerald-500/[0.07] px-2 py-0.5 text-emerald-300">
          BM25 0.65
        </span>
        <span class="mono rounded-full border border-sky-400/25 bg-sky-500/[0.07] px-2 py-0.5 text-sky-300">
          字符向量 0.20
        </span>
        <span class="mono rounded-full border border-violet-400/25 bg-violet-500/[0.07] px-2 py-0.5 text-violet-300">
          标签命中 0.15
        </span>
        <span class="mono rounded-full border border-white/10 px-2 py-0.5 text-slate-500">
          同义词扩展 ×0.5
        </span>
      </div>

      <div class="mt-6">
        <input
          v-model="query"
          placeholder="用大白话搜，比如「押金不退」"
          class="w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-emerald-400/60"
        />
        <div class="mt-2 flex flex-wrap gap-2 text-xs">
          <button
            v-for="example in EXAMPLES"
            :key="example"
            class="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-slate-400 transition hover:border-emerald-400/40 hover:text-emerald-200"
            @click="pick(example)"
          >
            {{ example }}
          </button>
        </div>
      </div>

      <div v-if="query" class="mt-5 flex items-center justify-between text-xs text-slate-500">
        <span>{{ loading ? '检索中…' : `${items.length} 条结果` }}</span>
        <span v-if="!loading" class="mono text-[10px]">耗时 {{ tookMs }}ms</span>
      </div>

      <ul class="mt-3 space-y-3">
        <li v-for="item in items" :key="item.id" class="panel px-4 py-3">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="font-medium text-slate-200">{{ item.short }}</span>
            <span class="text-slate-500">{{ item.article }}</span>
            <span class="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">{{ item.level }}</span>
            <span
              v-for="tag in item.tags"
              :key="tag"
              class="rounded border border-emerald-400/25 bg-emerald-500/[0.07] px-1.5 py-0.5 text-[10px] text-emerald-300"
            >
              {{ tag }}
            </span>
            <span class="mono ml-auto text-[11px] text-slate-500">{{ item.score.toFixed(2) }}</span>
          </div>

          <p class="mt-2 text-sm leading-6 text-slate-300">{{ item.text }}</p>

          <div class="mono mt-2 flex items-center gap-3 text-[10px] text-slate-600">
            <span>BM25 {{ item.bm25.toFixed(2) }}</span>
            <span>向量 {{ item.cosine.toFixed(2) }}</span>
            <span v-if="item.tagHit" class="text-emerald-400">标签命中</span>
            <a :href="item.sourceUrl" target="_blank" class="ml-auto transition hover:text-slate-300">原文 ↗</a>
          </div>
        </li>
      </ul>

      <div v-if="meta" class="mt-10">
        <h2 class="mono-label">Corpus</h2>
        <ul class="panel mt-3 divide-y divide-white/[0.05] text-sm">
          <li v-for="law in meta.laws" :key="law.law" class="flex items-center gap-3 px-4 py-3">
            <span class="text-slate-300">{{ law.law }}</span>
            <span class="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">{{ law.level }}</span>
            <span class="mono ml-auto text-[10px] text-slate-500">{{ law.count }} 条</span>
          </li>
        </ul>
        <p class="mt-2 text-xs leading-5 text-slate-600">
          地方性条例暂未收录：部分条文已被 2025 年《住房租赁条例》覆盖，混入检索会引出冲突依据。
        </p>
      </div>
    </div>
  </main>
</template>
