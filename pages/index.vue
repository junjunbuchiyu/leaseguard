<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Clause } from '~~/server/utils/types'

interface ParseResponse {
  docId: string
  text: string
  preamble: string
  clauses: Clause[]
  strategy: 'article' | 'numbered' | 'paragraph' | 'chunk'
  source: 'pdf-text' | 'vision' | 'paste'
  pages: number | null
  counts: Record<string, number>
  totalMasked: number
  chars: number
  warnings: string[]
}

const SOURCE_LABEL: Record<string, string> = {
  'pdf-text': 'PDF 文本层',
  vision: 'AI 视觉转写',
  paste: '手动粘贴',
}

const files = ref<File[]>([])
const dragging = ref(false)
const status = ref<'idle' | 'parsing' | 'done' | 'error'>('idle')
const errorMessage = ref('')
const result = ref<ParseResponse | null>(null)
const editableText = ref('')
const copied = ref(false)
const refining = ref(false)

const isBusy = computed(() => status.value === 'parsing')
const canParse = computed(() => files.value.length > 0 && !isBusy.value)
const lowConfidence = computed(
  () => result.value?.clauses.filter((c) => c.confidence < 0.5).length ?? 0,
)

function accept(list: FileList | null) {
  if (!list?.length) return
  const incoming = [...list].filter((f) => /^(image\/(jpeg|png|gif|webp)|application\/pdf)$/.test(f.type))
  if (!incoming.length) {
    errorMessage.value = '只支持 JPG / PNG / WebP 图片或 PDF'
    status.value = 'error'
    return
  }
  files.value = [...files.value, ...incoming].slice(0, 5)
  status.value = 'idle'
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

async function parseNow() {
  if (!canParse.value) return
  status.value = 'parsing'
  errorMessage.value = ''

  const form = new FormData()
  for (const file of files.value) form.append('files', file)

  try {
    const data = await $fetch<ParseResponse>('/api/audit/parse', {
      method: 'POST',
      body: form,
    })
    result.value = data
    editableText.value = data.text
    status.value = 'done'
  } catch (err: any) {
    status.value = 'error'
    errorMessage.value = err?.data?.message || err?.statusMessage || '解析失败，请重试'
  }
}

async function refineTags() {
  if (!result.value || refining.value) return
  refining.value = true
  try {
    const data = await $fetch<{ clauses: Clause[] }>('/api/audit/classify', {
      method: 'POST',
      body: { docId: result.value.docId },
    })
    result.value.clauses = data.clauses
  } catch (err: any) {
    errorMessage.value = err?.data?.message || '分类复核失败'
  } finally {
    refining.value = false
  }
}

async function copyText() {
  await navigator.clipboard.writeText(editableText.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

function reset() {
  files.value = []
  result.value = null
  editableText.value = ''
  errorMessage.value = ''
  status.value = 'idle'
}
</script>

<template>
  <main class="mx-auto max-w-3xl px-5 py-12">
    <header class="mb-8">
      <p class="text-xs font-medium tracking-widest text-emerald-600">LEASEGUARD</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-900">租约体检</h1>
      <p class="mt-2 text-sm text-slate-500">
        上传或拍一张租房合同，先看看哪几条会坑你。文件只在本机服务端处理，原文不落盘。
      </p>
    </header>

    <!-- 上传区 -->
    <section
      v-if="status !== 'done'"
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
    </section>

    <!-- 已选文件 -->
    <ul v-if="files.length && status !== 'done'" class="mt-4 space-y-2">
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

    <div v-if="status !== 'done'" class="mt-5 flex items-center gap-3">
      <button
        :disabled="!canParse"
        class="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        @click="parseNow"
      >
        <span
          v-if="isBusy"
          class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
        {{ isBusy ? '正在识别，约 10–30 秒' : '开始解析' }}
      </button>
      <p v-if="isBusy" class="text-xs text-slate-400">图片会先做一次逐字转写，再本地遮盖敏感信息</p>
    </div>

    <!-- 错误 -->
    <p v-if="status === 'error'" class="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ errorMessage }}
    </p>

    <!-- 结果 -->
    <section v-if="status === 'done' && result" class="mt-2 space-y-4">
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span class="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
          {{ SOURCE_LABEL[result.source] }}
        </span>
        <span v-if="result.pages" class="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
          {{ result.pages }} {{ result.source === 'vision' ? '张图片' : '页' }}
        </span>
        <span class="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{{ editableText.length }} 字</span>
        <span
          v-if="result.totalMasked"
          class="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700"
        >
          已本地遮盖 {{ result.totalMasked }} 处敏感信息
        </span>
      </div>

      <div v-if="result.totalMasked" class="flex flex-wrap gap-2 text-xs text-amber-700">
        <span v-for="(count, name) in result.counts" :key="name" class="rounded bg-amber-50 px-2 py-0.5">
          {{ name }} × {{ count }}
        </span>
      </div>

      <ul v-if="result.warnings.length" class="space-y-1 text-xs text-amber-600">
        <li v-for="(warning, index) in result.warnings" :key="index">· {{ warning }}</li>
      </ul>

      <!-- 条款结构 -->
      <div class="pt-2">
        <ClauseList :clauses="result.clauses" :preamble="result.preamble" :strategy="result.strategy" />

        <button
          v-if="lowConfidence"
          :disabled="refining"
          class="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-slate-400 disabled:opacity-50"
          @click="refineTags"
        >
          <span
            v-if="refining"
            class="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
          />
          {{ refining ? '复核中…' : `AI 复核分类（${lowConfidence} 条不确定）` }}
        </button>
      </div>

      <!-- 原文 -->
      <details class="rounded-2xl border border-slate-200 bg-white">
        <summary class="cursor-pointer px-4 py-2.5 text-xs font-medium text-slate-500">
          查看 / 校正原文
        </summary>
        <div class="border-t border-slate-100">
          <div class="flex justify-end px-4 py-1.5">
            <button class="text-xs text-emerald-600 hover:underline" @click="copyText">
              {{ copied ? '已复制' : '复制全文' }}
            </button>
          </div>
          <textarea
            v-model="editableText"
            rows="12"
            class="w-full resize-y rounded-b-2xl px-4 py-2 text-sm leading-6 text-slate-800 outline-none"
            spellcheck="false"
          />
        </div>
      </details>

      <div class="flex gap-3">
        <button class="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white" @click="reset">
          换一份合同
        </button>
        <span class="self-center text-xs text-slate-400">下一步：逐条风险审查与法条引用（开发中）</span>
      </div>
    </section>
  </main>
</template>
