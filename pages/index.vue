<script setup lang="ts">
definePageMeta({ layout: 'landing' })

const stats = [
  { value: '116', label: '条法规入库' },
  { value: '15/15', label: '高风险召回' },
  { value: '0', label: '编造引用' },
  { value: '~18s', label: '单份合同耗时' },
]

const features = [
  {
    no: '01',
    title: '先在本地脱敏',
    text: '身份证、手机号、银行卡、门牌号在送往模型之前就已经替换成占位符，映射表只留内存。原始合同不落盘，重启即清空。',
  },
  {
    no: '02',
    title: '逐条判定，句句有依据',
    text: '每条条款先检索法规库拿到候选，再判定风险。引用只能从候选里选，还要能在法条原文中逐字找到，找不到就丢弃重查。',
  },
  {
    no: '03',
    title: '给出能直接开口的话',
    text: '高风险条款配改法与谈判话术，最后汇总成一段可以直接发给房东的话，而不是让用户自己组织语言。',
  },
]

const steps = [
  { no: '01', title: '上传或拍照', text: '图片走视觉转写，PDF 取文本层' },
  { no: '02', title: '脱敏与切分', text: '本地遮盖 PII，按「第X条」切分' },
  { no: '03', title: 'Agent 审查', text: '规划 → 检索 → 判定 → 自省' },
  { no: '04', title: '报告与话术', text: '体检分、改法、整体沟通话术' },
]

const trace = [
  { role: 'plan', tone: 'text-cyan-300', text: '聚焦 押金 · 维修 · 隐私入户' },
  { role: 'tool', tone: 'text-sky-300', text: 'search_law("押金 退还 扣减") → 5 条' },
  { role: 'obs', tone: 'text-slate-400', text: '《住房租赁条例》第十条 · 0.82' },
  { role: 'judge', tone: 'text-rose-300', text: '第二条 押金不退 → HIGH' },
  { role: 'reflect', tone: 'text-amber-300', text: '第三条 证据不足 → 补检索 → 2 条依据' },
  { role: 'final', tone: 'text-emerald-300', text: '6 高 / 2 中 · 18.1s · 23 次工具调用' },
]
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <div class="pointer-events-none absolute inset-x-0 top-0 h-[560px] tech-grid opacity-70" />

    <!-- 顶栏 -->
    <header class="sticky top-0 z-20 border-b border-white/[0.06] bg-[#05070d]/80 backdrop-blur">
      <div class="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3.5">
        <NuxtLink to="/" class="flex items-baseline gap-2">
          <span class="mono-label">LeaseGuard</span>
          <span class="text-base font-bold tracking-tight text-slate-100">租约体检</span>
        </NuxtLink>

        <nav class="ml-4 hidden items-center gap-5 text-xs text-slate-500 sm:flex">
          <a href="#features" class="transition hover:text-slate-200">能力</a>
          <a href="#flow" class="transition hover:text-slate-200">流程</a>
          <NuxtLink to="/laws" class="transition hover:text-slate-200">法规库</NuxtLink>
          <NuxtLink to="/about" class="transition hover:text-slate-200">关于</NuxtLink>
        </nav>

        <NuxtLink to="/start" class="btn-primary ml-auto px-4 py-2 text-xs">立即体验</NuxtLink>
      </div>
    </header>

    <!-- Hero -->
    <section class="relative mx-auto grid max-w-6xl gap-12 px-6 pt-16 pb-20 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
      <div>
        <p class="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/[0.07] px-3 py-1 text-[11px] text-emerald-300">
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          对齐 2025 年 9 月施行的《住房租赁条例》
        </p>

        <h1 class="mt-6 text-4xl font-bold leading-[1.18] tracking-tight text-slate-50 sm:text-6xl">
          60 秒看懂<br />
          <span class="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
            一份租房合同
          </span>
        </h1>

        <p class="mt-6 max-w-xl text-sm leading-7 text-slate-400">
          上传或拍一张合同，一个会自己检索、会回头补证据的 Agent 会告诉你哪几条会坑你、依据哪条法、以及怎么跟房东开口。
          每条结论都能点回法条原文——不是让模型背法条，而是先检索、再引用、后判定。
        </p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <NuxtLink to="/start" class="btn-primary px-6 py-3 text-sm">立即体验</NuxtLink>
          <NuxtLink to="/start?sample=c2-landlord" class="btn-ghost px-6 py-3 text-sm">
            用坑版合同试试
          </NuxtLink>
          <span class="mono text-[10px] text-slate-600">无需注册 · 原文不落盘</span>
        </div>

        <dl class="mt-12 grid max-w-lg grid-cols-4 gap-4 border-t border-white/[0.07] pt-6">
          <div v-for="item in stats" :key="item.label">
            <dt class="mono text-lg font-bold text-slate-100">{{ item.value }}</dt>
            <dd class="mt-1 text-[10px] leading-4 text-slate-500">{{ item.label }}</dd>
          </div>
        </dl>
      </div>

      <!-- 右侧：Agent 终端 -->
      <div class="relative">
        <div class="absolute -inset-6 rounded-[32px] bg-gradient-to-br from-emerald-500/15 via-cyan-500/10 to-transparent blur-2xl" />

        <div class="panel relative overflow-hidden glow-ring">
          <div class="flex items-center gap-2 border-b border-white/[0.07] px-4 py-2.5">
            <span class="h-2 w-2 rounded-full bg-rose-400/70" />
            <span class="h-2 w-2 rounded-full bg-amber-400/70" />
            <span class="h-2 w-2 rounded-full bg-emerald-400/70" />
            <span class="mono ml-2 text-[10px] tracking-[0.16em] text-slate-500">agent.trace</span>
            <span class="mono ml-auto text-[10px] text-emerald-400/80">running</span>
          </div>

          <div class="space-y-2 px-4 py-4">
            <p v-for="line in trace" :key="line.role" class="mono flex gap-2 text-[11px] leading-5">
              <span class="w-14 shrink-0 text-slate-600">{{ line.role }}</span>
              <span :class="line.tone">{{ line.text }}</span>
            </p>

            <p class="mono flex gap-2 text-[11px] leading-5">
              <span class="w-14 shrink-0 text-slate-600">budget</span>
              <span class="text-slate-500">9 次模型调用 · 23 次工具调用</span>
            </p>
          </div>

          <div class="grid grid-cols-3 gap-px border-t border-white/[0.07] bg-white/[0.04]">
            <div class="bg-[#0a101c] px-4 py-3">
              <p class="mono text-lg font-bold text-rose-300">6</p>
              <p class="mt-0.5 text-[10px] text-slate-500">高风险条款</p>
            </div>
            <div class="bg-[#0a101c] px-4 py-3">
              <p class="mono text-lg font-bold text-amber-300">2</p>
              <p class="mt-0.5 text-[10px] text-slate-500">中风险条款</p>
            </div>
            <div class="bg-[#0a101c] px-4 py-3">
              <p class="mono text-lg font-bold text-emerald-300">16</p>
              <p class="mt-0.5 text-[10px] text-slate-500">体检分</p>
            </div>
          </div>
        </div>

        <p class="mono mt-3 text-center text-[10px] text-slate-600">
          每一次工具调用都会出现在界面上，可逐条核对
        </p>
      </div>
    </section>

    <!-- 能力 -->
    <section id="features" class="mx-auto max-w-6xl px-6 py-16">
      <div class="flex items-baseline justify-between">
        <h2 class="text-2xl font-bold tracking-tight text-slate-100">它到底做了什么</h2>
        <span class="mono text-[10px] text-slate-600">3 THINGS, IN ORDER</span>
      </div>

      <div class="mt-8 grid gap-4 md:grid-cols-3">
        <article
          v-for="feature in features"
          :key="feature.no"
          class="panel group p-6 transition hover:border-emerald-400/30"
        >
          <p class="mono text-[11px] text-emerald-400/80">{{ feature.no }}</p>
          <h3 class="mt-3 text-base font-semibold text-slate-100">{{ feature.title }}</h3>
          <p class="mt-2 text-xs leading-6 text-slate-400">{{ feature.text }}</p>
        </article>
      </div>
    </section>

    <!-- 流程 -->
    <section id="flow" class="border-y border-white/[0.06] bg-white/[0.015]">
      <div class="mx-auto max-w-6xl px-6 py-14">
        <div class="flex items-baseline justify-between">
          <h2 class="text-2xl font-bold tracking-tight text-slate-100">四步走完</h2>
          <span class="mono text-[10px] text-slate-600">UPLOAD → REPORT</span>
        </div>

        <ol class="relative mt-8 grid gap-3 sm:grid-cols-4">
          <li
            v-for="(step, index) in steps"
            :key="step.no"
            class="panel relative px-4 py-4"
          >
            <span class="mono text-[10px] text-emerald-400/70">{{ step.no }}</span>
            <p class="mt-1.5 text-sm text-slate-200">{{ step.title }}</p>
            <p class="mt-1 text-[10px] leading-4 text-slate-500">{{ step.text }}</p>

            <span
              v-if="index < steps.length - 1"
              class="absolute -right-2.5 top-1/2 hidden h-px w-4 bg-gradient-to-r from-emerald-400/50 to-transparent sm:block"
            />
          </li>
        </ol>
      </div>
    </section>

    <!-- 结尾 CTA -->
    <section class="mx-auto max-w-6xl px-6 py-20 text-center">
      <p class="mono text-[10px] tracking-[0.2em] text-emerald-400/70">TRY IT NOW</p>
      <h2 class="mt-3 text-2xl font-bold tracking-tight text-slate-100">把你的合同丢进来看看</h2>
      <p class="mt-3 text-sm text-slate-400">支持图片、PDF 与粘贴文本，拆完不会留下原文。</p>
      <NuxtLink to="/start" class="btn-primary mt-8 inline-block px-7 py-3 text-sm">立即体验</NuxtLink>
    </section>

    <footer class="border-t border-white/[0.06]">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-6 text-[11px] text-slate-600">
        <span>© 2026 LeaseGuard</span>
        <NuxtLink to="/laws" class="hover:text-slate-300">法规库</NuxtLink>
        <NuxtLink to="/about" class="hover:text-slate-300">关于</NuxtLink>
        <span class="ml-auto">2026 第九届传智杯 · AI WEB 赛道</span>
      </div>
    </footer>
  </div>
</template>
