/**
 * GET /api/report?docId=xxx
 *
 * 报告页数据：合同摘要 + 审查结果。报告不落库，只存在于内存会话里。
 */
import { getDoc } from '~~/server/utils/docStore'

export default defineEventHandler((event) => {
  const docId = String(getQuery(event).docId ?? '')
  const doc = getDoc(docId)

  if (!doc) {
    throw createError({ statusCode: 404, data: { message: '会话已过期，请重新上传合同' } })
  }
  if (!doc.report) {
    throw createError({ statusCode: 409, data: { message: '这份合同还没有完成审查' } })
  }

  const hasMeta = (keyword: RegExp) => doc.text.match(keyword)?.[1]?.trim() ?? null

  return {
    docId: doc.id,
    createdAt: new Date(doc.report.createdAt).toISOString(),
    source: doc.source,
    chars: doc.chars,
    masked: Object.values(doc.counts).reduce((sum, n) => sum + n, 0),
    contract: {
      title: doc.preamble.split('\n')[0]?.trim() || '房屋租赁合同',
      rent: hasMeta(/(?:月租金|租金)[^\d]{0,6}(\d[\d,]{2,})/),
      deposit: hasMeta(/(?:押金|保证金)[^\d]{0,6}(\d[\d,]{2,})/),
      term: hasMeta(/(?:租期|租赁期限)[：:]?\s*([^。；\n]{2,30})/),
      parties: doc.preamble
        .split('\n')
        .filter((line) => /甲方|乙方|出租人|承租人/.test(line))
        .slice(0, 2),
    },
    review: {
      score: doc.report.score,
      stats: doc.report.stats,
      summary: doc.report.summary,
      overall: doc.report.overall ?? null,
      risks: doc.report.risks,
      tookMs: doc.report.tookMs,
      calls: doc.report.calls,
    },
    disclaimer:
      '本报告基于公开法规对合同文本做风险提示，不构成法律意见，也不替代执业律师。重大权益事项请咨询专业人士或当地住建部门。',
  }
})
