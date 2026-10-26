/**
 * GET /api/audit/doc?docId=xxx
 *
 * 工作台用自己的路由刷新时要能拿回条款，所以单独开一个只读接口。
 * 只返回脱敏文本与条款，不返回 vault。
 */
import { getDoc } from '~~/server/utils/docStore'

export default defineEventHandler((event) => {
  const docId = String(getQuery(event).docId ?? '')
  const doc = getDoc(docId)

  if (!doc) {
    throw createError({ statusCode: 404, data: { message: '会话已过期，请重新上传合同' } })
  }

  return {
    docId: doc.id,
    text: doc.text,
    preamble: doc.preamble,
    clauses: doc.clauses,
    strategy: doc.strategy,
    source: doc.source,
    pages: doc.pages ?? null,
    counts: doc.counts,
    chars: doc.chars,
    hasReport: Boolean(doc.report),
  }
})
