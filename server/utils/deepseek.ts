import { createDeepSeek } from '@ai-sdk/deepseek'

/**
 * 统一创建 DeepSeek 客户端
 * 密钥只存在于服务端 runtimeConfig，不会进入客户端产物
 */
export function useDeepSeek() {
  const config = useRuntimeConfig()

  if (!config.deepseekApiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: '服务端未配置 NUXT_DEEPSEEK_API_KEY',
    })
  }

  const provider = createDeepSeek({
    apiKey: config.deepseekApiKey,
    baseURL: config.deepseekBaseUrl,
  })

  return {
    model: provider(config.deepseekModel),
    // 视觉能力目前只有 flash 提供，避免误用成 v4-pro
    visionModel: provider(config.deepseekVisionModel),
  }
}

/** 关闭思考模式：抽取类任务要的是确定性，不是推理 */
export const noThinking = { deepseek: { thinking: { type: 'disabled' as const } } }
