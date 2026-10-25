// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  runtimeConfig: {
    // 仅服务端可见，通过 .env 中的 NUXT_DEEPSEEK_* 覆盖
    deepseekApiKey: '',
    deepseekBaseUrl: 'https://api.deepseek.com',
    deepseekModel: 'deepseek-flash',
    // 视觉能力目前只有 flash 提供，单独拆一个变量，避免以后误配成不带视觉的模型
    deepseekVisionModel: 'deepseek-flash',
  },
})
