<script setup lang="ts">
export interface TimelineStep {
  key: string
  label: string
  status: 'pending' | 'running' | 'done'
  detail?: string
  ms?: number
}

defineProps<{ steps: TimelineStep[] }>()
</script>

<template>
  <ol class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
    <li
      v-for="(step, index) in steps"
      :key="step.key"
      class="flex items-center gap-2 text-xs"
      :class="step.status === 'pending' ? 'text-slate-300' : 'text-slate-600'"
    >
      <span
        v-if="step.status === 'done'"
        class="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px] text-emerald-700"
      >
        ✓
      </span>
      <span
        v-else-if="step.status === 'running'"
        class="h-4 w-4 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600"
      />
      <span v-else class="h-4 w-4 rounded-full border border-slate-200" />

      <span class="font-medium">{{ step.label }}</span>
      <span v-if="step.detail" class="text-slate-400">{{ step.detail }}</span>
      <span v-if="step.ms !== undefined" class="font-mono text-[10px] text-slate-300">{{ step.ms }}ms</span>

      <span v-if="index < steps.length - 1" class="hidden text-slate-200 sm:inline">→</span>
    </li>
  </ol>
</template>
