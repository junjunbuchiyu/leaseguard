/**
 * 用 LLM 复核规则分类拿不准的条款
 *
 * 只把低置信度的条款送去模型，一是省钱，二是避免模型把规则已经判对的结果改坏。
 * 模型只做「选择题」：类别必须是给定枚举，输出走 JSON schema 校验。
 */
import { generateObject } from 'ai'
import { z } from 'zod'
import { noThinking, useDeepSeek } from './deepseek'
import { CLAUSE_TAGS, LLM_REFINE_THRESHOLD, TAG_HINTS } from './clauseTags'
import type { Clause } from './types'

const BATCH_SIZE = 6

const schema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      tag: z.enum(CLAUSE_TAGS),
      confidence: z.number().min(0).max(1),
    }),
  ),
})

const SYSTEM = [
  '你是租房合同条款分类器。给定若干条款，把每条归入唯一类别。',
  '',
  '类别说明：',
  ...CLAUSE_TAGS.map((tag) => `- ${tag}：${TAG_HINTS[tag]}`),
  '',
  '规则：',
  '1. 只能使用上面列出的类别，不得自造；',
  '2. 分类看条款实际约束的事情，不看关键词出现次数；',
  '3. 信息不足时归入「其他」，置信度给 0.3 以下；',
  '4. id 必须与输入一一对应，不得遗漏或新增。',
].join('\n')

function batch<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export async function refineTagsWithLlm(clauses: Clause[]): Promise<Clause[]> {
  const candidates = clauses.filter((clause) => clause.confidence < LLM_REFINE_THRESHOLD)
  if (!candidates.length) return clauses

  const { model } = useDeepSeek()
  const updated = new Map<string, { tag: Clause['tag']; confidence: number }>()

  for (const group of batch(candidates, BATCH_SIZE)) {
    const prompt = [
      '待分类条款：',
      ...group.map((clause) => `[${clause.id}] ${clause.text.replace(/\n/g, ' ')}`),
      '',
      '按 JSON 返回：{ "items": [{ "id": "...", "tag": "...", "confidence": 0.x }] }',
    ].join('\n')

    try {
      const { object } = await generateObject({
        model,
        schema,
        system: SYSTEM,
        prompt,
        temperature: 0,
        maxRetries: 1,
        providerOptions: noThinking,
      })

      for (const item of object.items) {
        if (group.some((clause) => clause.id === item.id)) {
          updated.set(item.id, { tag: item.tag, confidence: item.confidence })
        }
      }
    } catch (error) {
      // 单批失败不影响整体：保留规则结果，并记录原因
      console.warn('[classify] LLM 复核失败，保留规则标签', error)
    }
  }

  return clauses.map((clause) => {
    const hit = updated.get(clause.id)
    if (!hit) return clause
    return { ...clause, tag: hit.tag, confidence: hit.confidence, tagSource: 'llm' as const }
  })
}
