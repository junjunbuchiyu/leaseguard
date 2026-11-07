<script setup lang="ts">
/**
 * 可折叠区块：默认收起，只留一行「标题 + 摘要 + 展开」
 *
 * 详情栏一屏要放六七块内容，全展开就是一大片文字。
 * 用原生 <details>，展开状态交给浏览器，父组件不用记一堆 ref。
 *
 * 可点击这件事必须一眼看出来，所以：
 *  - 整行是一个带边框的按钮，不是一行灰字
 *  - 左侧 chevron 会转，右侧「展开 / 收起」是明写的
 *  - 悬停变色，键盘可聚焦（原生 summary 自带）
 */
defineProps<{
  title: string
  summary?: string
  /** 右上角小计数，比如「2 条」 */
  badge?: string
  /** 默认是否展开 */
  open?: boolean
  /** 左侧色条（完整 Tailwind 类名，如 border-l-rose-300） */
  accent?: string
}>()
</script>

<template>
  <details class="fold group" :open="open">
    <summary
      class="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-l-2 border-slate-200 bg-white px-2.5 py-2 transition-colors select-none hover:border-emerald-300 hover:bg-emerald-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-400"
      :class="accent ?? 'border-l-slate-300'"
    >
      <svg
        class="h-3 w-3 shrink-0 text-slate-400 transition-transform group-open:rotate-90"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>

      <span class="shrink-0 text-[12.5px] font-semibold text-slate-800">{{ title }}</span>
      <span v-if="badge" class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal text-slate-500">
        {{ badge }}
      </span>
      <span v-if="summary" class="min-w-0 truncate text-[11px] font-normal text-slate-400">{{ summary }}</span>

      <span class="ml-auto flex shrink-0 items-center gap-2">
        <slot name="actions" />
        <span class="text-[11px] font-medium text-slate-500 group-open:hidden">展开</span>
        <span class="hidden text-[11px] font-medium text-slate-500 group-open:inline">收起</span>
      </span>
    </summary>

    <div class="px-2.5 pt-2 pb-1">
      <slot />
    </div>
  </details>
</template>

<style scoped>
/* 去掉浏览器默认的小三角，用自己的 chevron */
.fold > summary::-webkit-details-marker {
  display: none;
}
</style>
