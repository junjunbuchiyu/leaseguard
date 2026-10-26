<script setup lang="ts">
import { computed, ref } from 'vue'

const files = ref<File[]>([])
const dragging = ref(false)
const status = ref<'idle' | 'parsing'>('idle')
const errorMessage = ref('')

const isBusy = computed(() => status.value === 'parsing')
const canParse = computed(() => files.value.length > 0 && !isBusy.value)

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

async function parseNow() {
  if (!canParse.value) return
  status.value = 'parsing'
  errorMessage.value = ''

  const form = new FormData()
  for (const file of files.value) form.append('files', file)

  try {
    const data = await $fetch<{ docId: string }>('/api/audit/parse', { method: 'POST', body: form })
    await navigateTo(`/audit?doc=${data.docId}`)
  } catch (err: any) {
    status.value = 'idle'
    errorMessage.value = err?.data?.message || err?.statusMessage || '解析失败，请重试'
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

    <ul v-if="files.length" class="mt-4 space-y-2">
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

    <div class="mt-5 flex items-center gap-3">
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
      <p v-if="isBusy" class="text-xs text-slate-400">图片会先逐字转写，再本地遮盖敏感信息</p>
    </div>

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
