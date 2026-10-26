<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

interface RecentItem {
  id: string
  createdAt: number
  title: string
  clauses: number
  chars: number
  score: number | null
  high: number | null
}

const recent = ref<RecentItem[]>([])
const lawTotal = ref<number | null>(null)
const route = useRoute()

async function load() {
  try {
    const data = await $fetch<{ items: RecentItem[] }>('/api/audit/recent')
    recent.value = data.items
  } catch {
    recent.value = []
  }

  try {
    const laws = await $fetch<{ total: number }>('/api/law/list')
    lawTotal.value = laws.total
  } catch {
    lawTotal.value = null
  }
}

onMounted(load)
// 从工作台返回首页时刷新列表
watch(
  () => route.fullPath,
  (path) => {
    if (path === '/') void load()
  },
)

function timeAgo(timestamp: number) {
  const minutes = Math.floor((Date.now() - timestamp) / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours} 小时前` : `${Math.floor(hours / 24)} 天前`
}

function scoreTone(score: number | null) {
  if (score === null) return 'bg-slate-100 text-slate-500'
  if (score >= 85) return 'bg-emerald-50 text-emerald-700'
  if (score >= 60) return 'bg-amber-50 text-amber-700'
  return 'bg-rose-50 text-rose-700'
}
</script>

<template>
  <aside class="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
    <div class="px-5 pt-6 pb-4">
      <NuxtLink to="/" class="block">
        <p class="text-[10px] font-medium tracking-[0.2em] text-emerald-600">LEASEGUARD</p>
        <p class="mt-1 text-lg font-bold tracking-tight text-slate-900">租约体检</p>
      </NuxtLink>
      <p class="mt-1 text-[11px] leading-5 text-slate-400">AI 租房合同风险审查</p>
    </div>

    <div class="px-4">
      <NuxtLink
        to="/"
        class="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
      >
        ＋ 新建审查
      </NuxtLink>
    </div>

    <div class="mt-6 flex min-h-0 flex-1 flex-col px-4">
      <div class="flex items-baseline justify-between">
        <p class="text-[11px] font-medium text-slate-400">最近审查</p>
        <span class="text-[10px] text-slate-300">{{ recent.length }}</span>
      </div>

      <ul class="mt-2 min-h-0 flex-1 space-y-1 overflow-auto pb-2">
        <li v-for="item in recent" :key="item.id">
          <NuxtLink
            :to="`/audit?doc=${item.id}`"
            class="flex items-start gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
          >
            <span
              class="mt-0.5 w-7 shrink-0 rounded text-center text-[11px] font-semibold tabular-nums"
              :class="scoreTone(item.score)"
            >
              {{ item.score ?? '—' }}
            </span>
            <span class="min-w-0">
              <span class="block truncate text-xs text-slate-700">{{ item.title }}</span>
              <span class="mt-0.5 block text-[10px] text-slate-400">
                {{ item.clauses }} 条
                <span v-if="item.high"> · 高 {{ item.high }}</span>
                · {{ timeAgo(item.createdAt) }}
              </span>
            </span>
          </NuxtLink>
        </li>

        <li v-if="!recent.length" class="px-2 py-3 text-[11px] leading-5 text-slate-300">
          还没有审查记录。<br />上传一份合同试试。
        </li>
      </ul>
    </div>

    <nav class="border-t border-slate-100 px-3 py-3">
      <NuxtLink
        to="/laws"
        class="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100"
        active-class="border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600"
      >
        <span class="text-[13px] leading-none">▤</span>
        法规库
        <span
          class="ml-auto rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] text-emerald-700"
          :class="{ 'bg-white/20 text-white': route.path === '/laws' }"
        >
          {{ lawTotal ?? 116 }} 条
        </span>
      </NuxtLink>

      <NuxtLink
        to="/about"
        class="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        active-class="bg-slate-100 text-slate-800"
      >
        <span class="text-[13px] leading-none">◷</span>
        关于
      </NuxtLink>

      <p class="px-1 pt-2 text-[10px] leading-4 text-slate-300">
        记录仅存于本次服务运行期间，重启即清空。
      </p>
    </nav>
  </aside>
</template>
