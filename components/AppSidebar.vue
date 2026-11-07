<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

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
let timer: ReturnType<typeof setInterval> | undefined

async function loadRecent() {
  try {
    const data = await $fetch<{ items: RecentItem[] }>('/api/audit/recent')
    recent.value = data.items
  } catch {
    recent.value = []
  }
}

async function loadLawStats() {
  try {
    const laws = await $fetch<{ total: number }>('/api/law/list')
    lawTotal.value = laws.total
  } catch {
    lawTotal.value = null
  }
}

onMounted(() => {
  void loadRecent()
  void loadLawStats()
  // 审查在另一个页面跑，侧栏只能靠轮询感知「新任务」和「审查完成」
  timer = setInterval(loadRecent, 4000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

watch(
  () => route.fullPath,
  () => {
    void loadRecent()
  },
)

/** 刚创建、还没出分的任务视为「审查中」；超过 3 分钟仍无分说明没跑或失败 */
function isReviewing(item: RecentItem) {
  return item.score === null && Date.now() - item.createdAt < 180000
}

function timeAgo(timestamp: number) {
  const minutes = Math.floor((Date.now() - timestamp) / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours} 小时前` : `${Math.floor(hours / 24)} 天前`
}

function scoreTone(score: number | null) {
  if (score === null) return 'border-white/10 bg-white/[0.04] text-slate-500'
  if (score >= 85) return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
  if (score >= 60) return 'border-amber-400/30 bg-amber-500/10 text-amber-300'
  return 'border-rose-400/30 bg-rose-500/10 text-rose-300'
}
</script>

<template>
  <aside class="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#070b14]">
    <div class="px-5 pt-6 pb-4">
      <NuxtLink to="/" class="block">
        <p class="mono-label">LeaseGuard</p>
        <p class="mt-1.5 text-lg font-bold tracking-tight text-slate-100">租约体检</p>
      </NuxtLink>
      <p class="mt-1 text-[11px] leading-5 text-slate-500">AI 租房合同风险审查</p>
    </div>

    <div class="px-4">
      <NuxtLink to="/start" class="btn-primary flex items-center justify-center gap-1.5 px-3 py-2 text-xs">
        ＋ 新建审查
      </NuxtLink>
    </div>

    <div class="mt-6 flex min-h-0 flex-1 flex-col px-4">
      <div class="flex items-baseline justify-between">
        <p class="mono text-[10px] tracking-[0.16em] text-slate-600">最近审查</p>
        <span class="mono text-[10px] text-slate-700">{{ recent.length }}</span>
      </div>

      <ul class="mt-2 min-h-0 flex-1 space-y-1 overflow-auto pb-2">
        <li v-for="item in recent" :key="item.id">
          <NuxtLink
            :to="`/audit?doc=${item.id}`"
            class="flex items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.04]"
          >
            <span v-if="isReviewing(item)" class="mt-0.5 flex w-7 shrink-0 justify-center" title="审查中">
              <span class="h-3 w-3 animate-spin rounded-full border-2 border-emerald-400/25 border-t-emerald-400" />
            </span>
            <span
              v-else
              class="mono mt-0.5 w-7 shrink-0 rounded border text-center text-[11px] font-semibold"
              :class="scoreTone(item.score)"
            >
              {{ item.score ?? '—' }}
            </span>
            <span class="min-w-0">
              <span class="block truncate text-xs text-slate-300">{{ item.title }}</span>
              <span v-if="isReviewing(item)" class="mono mt-0.5 block text-[10px] text-emerald-400">
                正在审查 · {{ item.clauses }} 条
              </span>
              <span v-else class="mono mt-0.5 block text-[10px] text-slate-600">
                {{ item.clauses }} 条
                <span v-if="item.high"> · 高 {{ item.high }}</span>
                · {{ timeAgo(item.createdAt) }}
              </span>
            </span>
          </NuxtLink>
        </li>

        <li v-if="!recent.length" class="px-2 py-3 text-[11px] leading-5 text-slate-600">
          还没有审查记录。<br />上传一份合同试试。
        </li>
      </ul>
    </div>

    <nav class="border-t border-white/[0.06] px-3 py-3">
      <NuxtLink
        to="/laws"
        class="flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/[0.07] px-3 py-2.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/[0.12]"
        active-class="border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
      >
        <span class="text-[13px] leading-none">▤</span>
        法规库
        <span
          class="mono ml-auto rounded-full border border-emerald-400/25 px-1.5 py-0.5 text-[10px] text-emerald-300"
          :class="{ 'border-emerald-300/40 bg-emerald-400/20 text-emerald-50': route.path === '/laws' }"
        >
          {{ lawTotal ?? 116 }}
        </span>
      </NuxtLink>

      <NuxtLink
        to="/about"
        class="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-200"
        active-class="bg-white/[0.06] text-slate-200"
      >
        <span class="text-[13px] leading-none">◷</span>
        关于
      </NuxtLink>

      <p class="mt-2 px-1 text-[10px] leading-4 text-slate-700">
        记录仅存于本次服务运行期间，重启即清空。
      </p>
    </nav>
  </aside>
</template>
