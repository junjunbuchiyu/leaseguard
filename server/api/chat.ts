import { createDeepSeek } from '@ai-sdk/deepseek'
import { convertToModelMessages, streamText, type UIMessage } from 'ai'

// M0 连通性验证：最小流式对话，后续由审查管线替换
export default defineLazyEventHandler(() => {
  const config = useRuntimeConfig()
  if (!config.deepseekApiKey) {
    throw new Error('Missing NUXT_DEEPSEEK_API_KEY, 请在 .env 中配置')
  }

  const deepseek = createDeepSeek({
    apiKey: config.deepseekApiKey,
    baseURL: config.deepseekBaseUrl,
  })

  return defineEventHandler(async (event) => {
    const { messages }: { messages: UIMessage[] } = await readBody(event)

    const result = streamText({
      model: deepseek(config.deepseekModel),
      system: '你是「租约体检」的助手，负责用中文简洁回答用户问题。',
      messages: await convertToModelMessages(messages),
    })

    return result.toUIMessageStreamResponse()
  })
})
