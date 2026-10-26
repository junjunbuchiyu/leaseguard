<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TimelineStep } from '~/components/AgentTimeline.vue'

const STEPS: TimelineStep[] = [
  { key: 'extract', label: '识别合同文字', status: 'pending' },
  { key: 'redact', label: '本地遮盖敏感信息', status: 'pending' },
  { key: 'split', label: '切分条款', status: 'pending' },
  { key: 'classify', label: '条款分类打标', status: 'pending' },
]

const files = ref<File[]>([])
const dragging = ref(false)
const status = ref<'idle' | 'parsing' | 'error'>('idle')
const errorMessage = ref('')
const steps = ref<TimelineStep[]>(STEPS.map((step) => ({ ...step })))

const isBusy = computed(() => status.value === 'parsing')
const canParse = computed(() => files.value.length > 0 && !isBusy.value)
const started = computed(() => steps.value.some((step) => step.status !== 'pending'))

function accept(list: FileList | null) {
  if (!list?.length) return
  const incoming = [...list].filter((f) => /^(image\/(jpeg|png|gif|webp)|application\/pdf)$/.test(f.type))
  if (!incoming.length) {
    errorMessage.value = '只支持 JPG / PNG / WebP 图片或 PDF'
    return
  }
  files.value = [...files.value, ...incoming].slice(0, 5)
  errorMessage.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  accept(event.dataTransfer?.files ?? null)
}

function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  accept(input.files)
  input.value = ''
}

function removeFile(index: number) {
  files.value = files.value.filter((_, i) => i !== index)
}

function readableSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

function applyStage(stage: TimelineStep) {
  const index = steps.value.findIndex((step) => step.key === stage.key)
  if (index >= 0) steps.value[index] = { ...steps.value[index]!, ...stage }
}

async function consume(response: Response) {
  if (!response.ok || !response.body) throw new Error('stream failed')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let docId = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''

    for (const chunk of chunks.filter(Boolean)) {
      let event = 'message'
      const data: string[] = []
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data.push(line.slice(5).trim())
      }
      if (!data.length) continue
      const payload = JSON.parse(data.join('\n'))

      if (event === 'stage') applyStage(payload as TimelineStep)
      else if (event === 'error') throw new Error(payload.message)
      else if (event === 'done') docId = payload.docId
    }
  }

  return docId
}

async function upload() {
  status.value = 'parsing'
  errorMessage.value = ''
  steps.value = STEPS.map((step) => ({ ...step }))

  const form = new FormData()
  for (const file of files.value) form.append('files', file)

  try {
    const docId = await consume(await fetch('/api/audit/parse/stream', { method: 'POST', body: form }))
    if (docId) await navigateTo(`/audit?doc=${docId}`)
  } catch (err: any) {
    status.value = 'error'
    errorMessage.value = err?.message || '解析失败，请重试'
  }
}

async function trySample(name: string) {
  status.value = 'parsing'
  errorMessage.value = ''
  steps.value = STEPS.map((step) => ({ ...step }))

  try {
    const text = await $fetch<string>(`/samples/${name}.txt`, { responseType: 'text' })
    const docId = await consume(
      await fetch('/api/audit/parse/stream', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      }),
    )
    if (docId) await navigateTo(`/audit?doc=${docId}`)
  } catch (err: any) {
    status.value = 'error'
    errorMessage.value = err?.message || '样例加载失败'
  }
}
</script>

<template>
  <main class="mx-auto max-w-3xl px-5 py-12">
    <header class="mb-8">
      <p class="text-xs font-medium tracking-widest text-emerald-600">LEASEGUARD</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-900">租约体检</h1>
      <p class="mt-2 text-sm text-slate-500">
        上传或拍一张租房合同，60 秒告诉你哪几条会坑你。文件只在本机服务端处理，原文不落盘。
      </p>
    </header>

    <section
      v-if="!started"
      class="rounded-2xl border-2 border-dashed p-8 text-center transition"
      :class="dragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-white'"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <p class="text-sm text-slate-600">把合同图片或 PDF 拖进来</p>
      <p class="mt-1 text-xs text-slate-400">最多 5 个文件，单个不超过 10MB</p>

      <label
        class="mt-5 inline-flex cursor-pointer items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        选择文件
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
          class="hidden"
          @change="onPick"
        />
      </label>

      <div class="mt-6 border-t border-slate-100 pt-4">
        <p class="text-[11px] text-slate-400">没有现成合同？用样张体验完整流程</p>
        <div class="mt-2 flex justify-center gap-2">
          <button
            class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200"
            @click="trySample('c2-landlord')"
          >
            坑版合同（房东自拟）
          </button>
          <button
            class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200"
            @click="trySample('c5-clean')"
          >
            规范版合同
          </button>
        </div>
      </div>
    </section>

    <ul v-if="files.length && !started" class="mt-4 space-y-2">
      <li
        v-for="(file, index) in files"
        :key="file.name + index"
        class="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
      >
        <span class="truncate text-slate-700">{{ file.name }}</span>
        <span class="ml-3 shrink-0 text-xs text-slate-400">{{ readableSize(file.size) }}</span>
        <button class="ml-3 text-xs text-slate-400 hover:text-rose-600" @click="removeFile(index)">移除</button>
      </li>
    </ul>

    <div v-if="!started" class="mt-5 flex items-center gap-3">
      <button
        :disabled="!canParse"
        class="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        @click="upload"
      >
        开始解析
      </button>
      <p class="text-xs text-slate-400">解析过程会逐步展示，约 10–30 秒</p>
    </div>

    <!-- 解析过程 -->
    <section v-if="started" class="rounded-2xl border border-slate-200 bg-white p-6">
      <p class="text-sm font-medium text-slate-800">正在处理合同</p>
      <p class="mt-1 text-xs text-slate-400">
        文字识别在本地完成，敏感信息在送往模型前就已遮盖。
      </p>
      <div class="mt-4">
        <AgentTimeline :steps="steps" />
      </div>
    </section>

    <p v-if="errorMessage" class="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ errorMessage }}
    </p>

    <footer class="mt-16 flex gap-5 border-t border-slate-200 pt-4 text-xs text-slate-400">
      <NuxtLink to="/laws" class="hover:text-slate-600">法规库</NuxtLink>
      <NuxtLink to="/about" class="hover:text-slate-600">关于</NuxtLink>
      <span class="ml-auto">2026 第九届传智杯 · AI WEB 赛道</span>
    </footer>
  </main>
</template>
