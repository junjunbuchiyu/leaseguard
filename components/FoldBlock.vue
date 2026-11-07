<script setup lang="ts">
/**
 * 可折叠区块：默认收起，只留一行标题 + 摘要
 *
 * 详情栏一屏要放六块内容，全展开就是一大片文字。
 * 这里用原生 <details>，浏览器自己管展开状态，不需要父组件记一堆 ref；
 * 摘要行给出「里面是什么」，不点开也能判断要不要看。
 */
defineProps<{
  title: string
  summary?: string
  /** 默认是否展开 */
  open?: boolean
  /** 左侧色条，沿用详情栏的分区配色 */
  accent?: string
}>()
</script>

<template>
  <details class="fold group" :open="open">
    <summary
      class="-mx-1.5 flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1.5 py-1 select-none hover:bg-slate-50"
    >
      <span class="h-3 w-0.5 shrink-0 rounded" :class="accent ?? 'bg-slate-300'" />
      <span class="shrink-0 text-[12px] font-semibold text-slate-700">{{ title }}</span>
      <span v-if="summary" class="ml-1 min-w-0 truncate text-[11px] font-normal text-slate-400">
        {{ summary }}
      </span>
      <!-- 操作按钮放在摘要行，收起状态下也能直接复制 / 朗读 -->
      <span class="ml-auto flex shrink-0 items-center gap-2" @click.prevent.stop>
        <slot name="actions" />
      </span>
      <svg
        class="h-3 w-3 shrink-0 text-slate-300 transition-transform group-open:rotate-90"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      </svg>
    </summary>

    <div class="mt-1.5 pl-2.5">
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
