<script setup lang="ts">
import { useChat } from '@ai-sdk/vue'
import { ref } from 'vue'

// M0 临时调试页：验证 DeepSeek 流式接入，后续替换为首页
const input = ref('')
const { messages, sendMessage, status } = useChat()

const isBusy = computed(() => status.value === 'submitted' || status.value === 'streaming')

function handleSubmit(event: Event) {
  event.preventDefault()
  const text = input.value.trim()
  if (!text || isBusy.value) return
  sendMessage({ text })
  input.value = ''
}
</script>

<template>
  <section class="mx-auto max-w-3xl space-y-4 p-6">
    <h1 class="text-2xl font-bold tracking-tight">LeaseGuard · 接入自检</h1>
    <p class="text-sm text-gray-500">Model: deepseek-flash</p>

    <div class="space-y-3">
      <div
        v-for="(message, index) in messages"
        :key="message.id ?? index"
        class="rounded-lg border p-3"
        :class="
          message.role === 'user'
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-gray-200 bg-white'
        "
      >
        <p class="mb-1 text-xs font-semibold uppercase text-gray-500">{{ message.role }}</p>
        <div v-for="(part, partIndex) in message.parts" :key="`${message.id}-${partIndex}`">
          <p v-if="part.type === 'text'" class="whitespace-pre-wrap">{{ part.text }}</p>
        </div>
      </div>
    </div>

    <form class="flex gap-2" @submit="handleSubmit">
      <input
        v-model="input"
        :disabled="isBusy"
        placeholder="随便问一句，验证接口是否连通"
        class="flex-1 rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-emerald-500"
      />
      <button
        type="submit"
        :disabled="isBusy"
        class="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        Send
      </button>
    </form>
  </section>
</template>
