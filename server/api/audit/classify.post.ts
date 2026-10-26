/**
 * POST /api/audit/classify
 *
 * 对规则分类不确定的条款做一次 LLM 复核。
 * 单独成一个接口而不是塞进 parse：解析要快，复核可以慢，前端能先把条款渲染出来。
 */
import { getDoc } from '~~/server/utils/docStore'
import { LLM_REFINE_THRESHOLD } from '~~/server/utils/clauseTags'
import { refineTagsWithLlm } from '~~/server/utils/classify'

export default defineEventHandler(async (event) => {
  const { docId } = await readBody<{ docId?: string }>(event)

  if (!docId) {
    throw createError({ statusCode: 400, data: { message: '缺少 docId' } })
  }

  const doc = getDoc(docId)
  if (!doc) {
    throw createError({ statusCode: 404, data: { message: '会话已过期，请重新上传合同' } })
  }

  const pending = doc.clauses.filter((clause) => clause.confidence < LLM_REFINE_THRESHOLD).length

  if (!pending) {
    return { clauses: doc.clauses, refined: 0, llmUsed: false }
  }

  doc.clauses = await refineTagsWithLlm(doc.clauses)

  return { clauses: doc.clauses, refined: pending, llmUsed: true }
})
