/**
 * POST /api/audit/parse/stream
 *
 * 与 /api/audit/parse 同样的输入，但用 SSE 推送四个阶段：
 *   extract → redact → split → classify → done
 *
 * 前端据此把「AI 正在识别 / 遮盖 / 切分 / 分类」真实地展示出来，
 * 而不是一个转圈等 10 秒。
 */
import { collectInput, runIngest } from '~~/server/utils/ingest'

export default defineEventHandler(async (event) => {
  // 请求体必须在返回响应前读完，否则流式响应开始后就读不到了
  const input = await collectInput(event)

  const stream = createEventStream(event)
  const send = (eventName: string, payload: unknown) =>
    stream.push({ event: eventName, data: JSON.stringify(payload) })

  void (async () => {
    try {
      const result = await runIngest(input, {
        onStage: (stage) => void send('stage', stage),
      })
      await send('done', { docId: result.docId, clauses: result.clauses.length, masked: result.totalMasked })
    } catch (error: any) {
      console.error('[audit/parse/stream] 解析失败', error)
      await send('error', {
        message: error?.data?.message ?? error?.statusMessage ?? '解析失败，请重试',
      })
    } finally {
      await stream.close()
    }
  })()

  return stream.send()
})
