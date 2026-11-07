<script setup lang="ts">
import { onMounted, ref } from 'vue'

interface ToolInfo {
  name: string
  title: string
  description: string
}

const tools = ref<ToolInfo[]>([])

const loop = [
  { step: '规划', text: '读条款概览，决定这次重点看哪几类问题、用快审还是深审。' },
  { step: '调工具', text: '逐条调用 search_law 取候选法条；金额条款再调 calc_penalty 算押金月数。' },
  { step: '判定', text: '模型只能在候选里选 lawId，quote 还要通过 check_citation 逐字核对。' },
  { step: '自省', text: '高风险却拿不出依据、或置信度偏低，就用模型自己给的检索词重查一遍。' },
  { step: '复核', text: '复核员只看有没有被低估的条款，只许上调不许下调，宁可多提示一条。' },
]

onMounted(async () => {
  try {
    const data = await $fetch<{ tools: ToolInfo[] }>('/api/agent/tools')
    tools.value = data.tools
  } catch {
    tools.value = []
  }
})
</script>

<template>
  <main class="app-shell min-h-screen px-5 py-12">
    <div class="mx-auto max-w-3xl">
      <p class="mono-label">About</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-100">关于租约体检</h1>

      <section class="mt-6 space-y-3 text-sm leading-7 text-slate-400">
        <p>
          租约体检是一个面向首次租房大学生的合同风险审查工具。上传或拍一张合同，它会标出可能对你不利的条款，给出
          《民法典》《住房租赁条例》中的对应依据，并附上一段可以直接发给房东的沟通话术。
        </p>
        <p>
          所有文本在送往模型之前都会在本地完成脱敏（身份证、手机号、银行卡、门牌号、邮箱），原始合同不写入数据库，
          服务重启即清空。
        </p>
      </section>

      <h2 class="mono-label mt-10">Agent 工作模式</h2>
      <ol class="mt-3 space-y-2">
        <li v-for="(item, index) in loop" :key="item.step" class="panel-flat flex gap-3 px-4 py-3">
          <span class="mono mt-0.5 text-[10px] text-emerald-400/80">0{{ index + 1 }}</span>
          <div>
            <p class="text-xs font-medium text-slate-200">{{ item.step }}</p>
            <p class="mt-0.5 text-xs leading-6 text-slate-500">{{ item.text }}</p>
          </div>
        </li>
      </ol>

      <h2 class="mono-label mt-10">可调用的工具</h2>
      <p class="mt-2 text-xs leading-6 text-slate-500">
        全部是确定性函数，同样的输入永远得到同样的输出，不额外花 token；同一批工具也通过 MCP 暴露给外部 Agent。
      </p>
      <ul class="panel mt-3 divide-y divide-white/[0.05]">
        <li v-for="tool in tools" :key="tool.name" class="flex flex-wrap items-baseline gap-2 px-4 py-2.5">
          <span class="mono text-[11px] text-emerald-300">{{ tool.name }}</span>
          <span class="text-xs text-slate-300">{{ tool.title }}</span>
          <span class="w-full text-[11px] leading-5 text-slate-600">{{ tool.description }}</span>
        </li>
        <li v-if="!tools.length" class="px-4 py-3 text-[11px] text-slate-600">工具清单加载失败（不影响审查）</li>
      </ul>

      <h2 class="mono-label mt-10">技术栈</h2>
      <ul class="mt-3 space-y-1 text-sm text-slate-400">
        <li>· Nuxt 3 + Vue 3 + Tailwind CSS</li>
        <li>· DeepSeek API（deepseek-flash 负责文本与图像理解，关闭思考模式保证确定性）</li>
        <li>· 本地法规库检索（BM25 + 字符向量 + 标签），每条结论可回溯到法条原文</li>
        <li>· SSE 流式推送审查过程，Agent 轨迹实时可见</li>
      </ul>

      <h2 class="mono-label mt-10">免责声明</h2>
      <p class="mt-3 text-sm leading-7 text-slate-400">
        本工具基于公开法规对合同文本做风险提示，不构成法律意见，也不替代执业律师。重大权益事项请咨询专业人士或当地住建部门。
      </p>
    </div>
  </main>
</template>
