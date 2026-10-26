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
  <main class="mx-auto max-w-3xl px-5 py-12">
    <h1 class="text-3xl font-bold tracking-tight text-slate-900">法规库</h1>
    <p v-if="meta" class="mt-2 text-sm text-slate-500">
      {{ meta.total }} 条与住房租赁直接相关的条文，检索结果会作为合同审查的引用依据。
    </p>

    <div class="mt-6">
      <input
        v-model="query"
        placeholder="用大白话搜，比如「押金不退」"
        class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />
      <div class="mt-2 flex flex-wrap gap-2 text-xs">
        <button
          v-for="example in EXAMPLES"
          :key="example"
          class="rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-slate-200"
          @click="pick(example)"
        >
          {{ example }}
        </button>
      </div>
    </div>

    <div v-if="query" class="mt-5 flex items-center justify-between text-xs text-slate-400">
      <span>{{ loading ? '检索中…' : `${items.length} 条结果` }}</span>
      <span v-if="!loading">耗时 {{ tookMs }}ms</span>
    </div>

    <ul class="mt-3 space-y-3">
      <li
        v-for="item in items"
        :key="item.id"
        class="rounded-xl border border-slate-200 bg-white px-4 py-3"
      >
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span class="font-medium text-slate-700">{{ item.short }}</span>
          <span class="text-slate-400">{{ item.article }}</span>
          <span class="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">{{ item.level }}</span>
          <span
            v-for="tag in item.tags"
            :key="tag"
            class="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700"
          >
            {{ tag }}
          </span>
          <span class="ml-auto font-mono text-[11px] text-slate-400">
            {{ item.score.toFixed(2) }}
          </span>
        </div>

        <p class="mt-2 text-sm leading-6 text-slate-700">{{ item.text }}</p>

        <div class="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
          <span>BM25 {{ item.bm25.toFixed(2) }}</span>
          <span>向量 {{ item.cosine.toFixed(2) }}</span>
          <span v-if="item.tagHit" class="text-emerald-600">标签命中</span>
          <a :href="item.sourceUrl" target="_blank" class="ml-auto hover:text-slate-600">原文 ↗</a>
        </div>
      </li>
    </ul>

    <div v-if="meta" class="mt-10">
      <h2 class="text-sm font-semibold text-slate-900">收录范围</h2>
      <ul class="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
        <li v-for="law in meta.laws" :key="law.law" class="flex items-center gap-3 px-4 py-3">
          <span class="text-slate-700">{{ law.law }}</span>
          <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{{ law.level }}</span>
          <span class="ml-auto text-xs text-slate-400">{{ law.count }} 条</span>
        </li>
      </ul>
      <p class="mt-2 text-xs text-slate-400">
        地方性条例暂未收录：部分条文已被 2025 年《住房租赁条例》覆盖，混入检索会引出冲突依据。
      </p>
    </div>
  </main>
</template>
