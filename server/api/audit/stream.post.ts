/**
 * POST /api/audit/stream
 *
 * 用 SSE 把审查过程推给前端：步骤状态、逐批风险、最终评分。
 * 前端不依赖 EventSource（它只支持 GET），而是 fetch + ReadableStream 手写解析。
 */
import { getDoc } from '~~/server/utils/docStore'
import { reviewClauses } from '~~/server/utils/review'

export default defineEventHandler(async (event) => {
  const { docId } = await readBody<{ docId?: string }>(event)

  if (!docId) {
    throw createError({ statusCode: 400, data: { message: '缺少 docId' } })
  }

  const doc = getDoc(docId)
  if (!doc) {
    throw createError({ statusCode: 404, data: { message: '会话已过期，请重新上传合同' } })
  }

  const stream = createEventStream(event)
  const send = (eventName: string, payload: unknown) =>
    stream.push({ event: eventName, data: JSON.stringify(payload) })

  // 审查在后台跑，SSE 只负责把事件送出去
  void (async () => {
    try {
      const result = await reviewClauses(doc.clauses, {
        onStep: (step) => void send('step', step),
        onRisk: (risk) => void send('risk', risk),
      })

      doc.report = { ...result, createdAt: Date.now() }
      await send('score', {
        score: result.score,
        stats: result.stats,
        summary: result.summary,
        overall: result.overall,
        tookMs: result.tookMs,
        calls: result.calls,
        degraded: result.degraded,
      })
      await send('done', { docId })
    } catch (error) {
      console.error('[audit/stream] 审查失败', error)
      await send('error', { message: '审查失败，请稍后重试' })
    } finally {
      await stream.close()
    }
  })()

  return stream.send()
})
