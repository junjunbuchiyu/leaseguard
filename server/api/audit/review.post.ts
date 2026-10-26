/**
 * POST /api/audit/review
 *
 * 输入：{ docId }
 * 输出：体检分、风险统计、逐条风险（含法条引用、建议改法、谈判话术）
 *
 * D6 会把这个接口改成 SSE 流式，先把整条链路跑通。
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

  const result = await reviewClauses(doc.clauses)

  return {
    docId,
    ...result,
  }
})
