<template>
  <main class="mx-auto max-w-3xl px-5 py-12">
    <h1 class="text-3xl font-bold tracking-tight text-slate-900">关于租约体检</h1>

    <section class="mt-6 space-y-3 text-sm leading-7 text-slate-600">
      <p>
        租约体检是一个面向首次租房大学生的合同风险审查工具。上传或拍一张合同，它会标出可能对你不利的条款，给出
        《民法典》《住房租赁条例》中的对应依据，并附上一段可以直接发给房东的沟通话术。
      </p>
      <p>
        所有文本在送往模型之前都会在本地完成脱敏（身份证、手机号、银行卡、门牌号、邮箱），原始合同不写入数据库，
        服务重启即清空。
      </p>
    </section>

    <h2 class="mt-8 text-lg font-semibold text-slate-900">技术栈</h2>
    <ul class="mt-3 space-y-1 text-sm text-slate-600">
      <li>· Nuxt 3 + Vue 3 + Tailwind CSS</li>
      <li>· DeepSeek API（deepseek-flash 负责文本与图像理解）</li>
      <li>· 本地法规库检索（BM25 + 向量），每条结论可回溯到法条原文</li>
    </ul>

    <h2 class="mt-8 text-lg font-semibold text-slate-900">免责声明</h2>
    <p class="mt-3 text-sm leading-7 text-slate-600">
      本工具基于公开法规对合同文本做风险提示，不构成法律意见，也不替代执业律师。重大权益事项请咨询专业人士或当地住建部门。
    </p>
  </main>
</template>
