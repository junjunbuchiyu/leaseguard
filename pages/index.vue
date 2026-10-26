<script setup lang="ts">
definePageMeta({ layout: 'landing' })

const stats = [
  { value: '116', label: '条法规入库' },
  { value: '15/15', label: '高风险召回' },
  { value: '0', label: '编造引用' },
  { value: '~12s', label: '单份合同耗时' },
]

const features = [
  {
    no: '（1）',
    title: '先在本地脱敏',
    text: '身份证、手机号、银行卡、门牌号在送往模型之前就已经替换成占位符，映射表只留内存。原始合同不落盘。',
  },
  {
    no: '（2）',
    title: '逐条判定，句句有依据',
    text: '每条条款先检索法规库拿到 5 条候选，再判定风险。引用只能从候选里选，还要能在法条原文中逐字找到。',
  },
  {
    no: '（3）',
    title: '给出能直接开口的话',
    text: '高风险条款配改法与谈判话术，最后再汇总成一段可以直接发给房东的话，而不是让用户自己组织语言。',
  },
]

const steps = ['上传或拍照', '本地脱敏与切分', '逐条检索与判定', '体检报告与话术']
</script>

<template>
  <div class="min-h-screen bg-white text-slate-900">
    <!-- 顶栏 -->
    <header class="sticky top-0 z-20 border-b border-slate-100 bg-white/85 backdrop-blur">
      <div class="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3.5">
        <NuxtLink to="/" class="flex items-baseline gap-2">
          <span class="text-[10px] font-semibold tracking-[0.25em] text-emerald-600">LEASEGUARD</span>
          <span class="text-base font-bold tracking-tight">租约体检</span>
        </NuxtLink>
        <nav class="ml-4 hidden items-center gap-5 text-xs text-slate-500 sm:flex">
          <a href="#features" class="hover:text-slate-900">能力</a>
          <a href="#flow" class="hover:text-slate-900">流程</a>
          <NuxtLink to="/laws" class="hover:text-slate-900">法规库</NuxtLink>
          <NuxtLink to="/about" class="hover:text-slate-900">关于</NuxtLink>
        </nav>
        <NuxtLink
          to="/start"
          class="ml-auto rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-800"
        >
          立即体验
        </NuxtLink>
      </div>
    </header>

    <!-- Hero -->
    <section class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-emerald-50/80 via-emerald-50/20 to-transparent" />

      <div class="relative mx-auto grid max-w-6xl gap-12 px-6 pt-16 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p class="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] text-emerald-700">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            对齐 2025 年 9 月施行的《住房租赁条例》
          </p>

          <h1 class="mt-5 text-4xl font-bold leading-[1.25] tracking-tight text-slate-900 sm:text-5xl">
            60 秒看懂<br />一份租房合同
          </h1>

          <p class="mt-5 max-w-xl text-sm leading-7 text-slate-600">
            上传或拍一张合同，它会告诉你哪几条会坑你、依据哪条法、以及怎么跟房东开口。
            每条结论都能点回到法条原文——不是让模型背法条，而是先检索、再引用、后判定。
          </p>

          <div class="mt-8 flex flex-wrap items-center gap-3">
            <NuxtLink
              to="/start"
              class="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
            >
              立即体验
            </NuxtLink>
            <NuxtLink
              to="/start?sample=c2-landlord"
              class="rounded-xl border border-slate-300 px-6 py-3 text-sm text-slate-700 transition hover:border-slate-400"
            >
              用坑版合同试试
            </NuxtLink>
            <span class="text-[11px] text-slate-400">无需注册 · 原文不落盘</span>
          </div>

          <dl class="mt-12 grid max-w-lg grid-cols-4 gap-4 border-t border-slate-100 pt-6">
            <div v-for="item in stats" :key="item.label">
              <dt class="text-lg font-bold tabular-nums text-slate-900">{{ item.value }}</dt>
              <dd class="mt-0.5 text-[11px] text-slate-400">{{ item.label }}</dd>
            </div>
          </dl>
        </div>

        <!-- 右侧：工作台缩略 -->
        <div class="relative">
          <div class="absolute -inset-4 rounded-[28px] bg-gradient-to-br from-emerald-100/60 to-slate-100/40 blur-2xl" />
          <div class="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_-25px_rgba(15,23,42,0.25)]">
            <div class="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
              <span class="h-2 w-2 rounded-full bg-rose-300" />
              <span class="h-2 w-2 rounded-full bg-amber-300" />
              <span class="h-2 w-2 rounded-full bg-emerald-300" />
              <span class="ml-2 text-[10px] text-slate-400">审查工作台</span>
            </div>

            <div class="space-y-3 p-4">
              <div class="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                <span class="text-2xl font-bold text-rose-600">10</span>
                <div>
                  <p class="text-[11px] font-medium text-slate-800">风险较高，建议先修改再签</p>
                  <p class="text-[10px] text-slate-400">10 条条款 · 6 条高风险 · 3 条中风险</p>
                </div>
              </div>

              <div class="space-y-1.5">
                <div v-for="(line, index) in ['第二条 · 押金不退', '第三条 · 甲方随时进入', '第五条 · 维修全转嫁']" :key="index" class="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2">
                  <span class="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  <span class="text-[11px] text-slate-700">{{ line }}</span>
                  <span class="ml-auto text-[10px] text-slate-300">条例</span>
                </div>
              </div>

              <div class="rounded-lg bg-emerald-50 px-2.5 py-2">
                <p class="text-[10px] font-medium text-emerald-800">谈判话术</p>
                <p class="mt-1 text-[10px] leading-4 text-emerald-900/80">
                  您好，关于押金条款，目前约定押金不退可能不够明确，建议明确返还时间与扣减情形…
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 能力 -->
    <section id="features" class="mx-auto max-w-6xl px-6 py-16">
      <div class="flex items-baseline justify-between">
        <h2 class="text-2xl font-bold tracking-tight">它到底做了什么</h2>
        <span class="text-[11px] text-slate-400">三件事，按顺序发生</span>
      </div>

      <div class="mt-8 grid gap-4 md:grid-cols-3">
        <article v-for="feature in features" :key="feature.no" class="rounded-2xl border border-slate-200 p-6 transition hover:border-emerald-300 hover:shadow-sm">
          <p class="text-[11px] text-emerald-600">{{ feature.no }}</p>
          <h3 class="mt-2 text-base font-semibold text-slate-900">{{ feature.title }}</h3>
          <p class="mt-2 text-xs leading-6 text-slate-500">{{ feature.text }}</p>
        </article>
      </div>
    </section>

    <!-- 流程 -->
    <section id="flow" class="border-y border-slate-100 bg-slate-50/60">
      <div class="mx-auto max-w-6xl px-6 py-14">
        <h2 class="text-2xl font-bold tracking-tight">四步走完</h2>
        <ol class="mt-8 grid gap-3 sm:grid-cols-4">
          <li v-for="(step, index) in steps" :key="step" class="relative rounded-xl border border-slate-200 bg-white px-4 py-4">
            <span class="text-[10px] font-mono text-slate-300">0{{ index + 1 }}</span>
            <p class="mt-1 text-sm text-slate-800">{{ step }}</p>
            <span v-if="index < steps.length - 1" class="absolute -right-3 top-1/2 hidden text-slate-300 sm:block">→</span>
          </li>
        </ol>
      </div>
    </section>

    <!-- 结尾 CTA -->
    <section class="mx-auto max-w-6xl px-6 py-20 text-center">
      <h2 class="text-2xl font-bold tracking-tight">把你的合同丢进来看看</h2>
      <p class="mt-3 text-sm text-slate-500">支持图片、PDF 与粘贴文本，拆完不会留下原文。</p>
      <NuxtLink
        to="/start"
        class="mt-8 inline-block rounded-xl bg-emerald-600 px-7 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
      >
        立即体验
      </NuxtLink>
    </section>

    <footer class="border-t border-slate-100">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-6 text-[11px] text-slate-400">
        <span>© 2026 LeaseGuard</span>
        <NuxtLink to="/laws" class="hover:text-slate-600">法规库</NuxtLink>
        <NuxtLink to="/about" class="hover:text-slate-600">关于</NuxtLink>
        <span class="ml-auto">2026 第九届传智杯 · AI WEB 赛道</span>
      </div>
    </footer>
  </div>
</template>
