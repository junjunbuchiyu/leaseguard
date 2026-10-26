/**
 * 审查管线：条款 → 检索候选法条 → 模型判定 → 约束式引用 → 建议与话术
 *
 * 关键约束（防编造）：
 *  1. 模型只能从 candidates 里选 lawId，选别的直接丢弃
 *  2. quote 必须是该法条原文的连续片段，拼不出来就丢弃该引用
 *  3. 输出走 zod，schema 不合法整批重试一次，仍失败则标记待人工复核
 *
 * 性能设计：判定按 5 条一批并发发送，建议只对 high/medium 生成。
 * 一份 10 条条款的合同约 3 次调用，10–20 秒内完成。
 */
import { generateObject } from 'ai'
import { z } from 'zod'
import { noThinking, useDeepSeek } from './deepseek'
import { getLawById, searchLaws, type LawHit } from './lawIndex'
import type { Clause } from './types'

const JUDGE_BATCH = 5
const ADVISE_BATCH = 4
const CONCURRENCY = 2
const CANDIDATES_PER_CLAUSE = 5

const JudgeSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      level: z.enum(['high', 'medium', 'low', 'ok']),
      title: z.string(),
      issue: z.string(),
      confidence: z.number().min(0).max(1),
      basis: z
        .array(
          z.object({
            lawId: z.string(),
            quote: z.string(),
            reason: z.string(),
          }),
        )
        .max(3),
    }),
  ),
})

const AdviseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      suggestion: z.string(),
      revisedClause: z.string().optional(),
      negotiation: z.string(),
    }),
  ),
})

const JUDGE_SYSTEM = [
  '你是租房合同风险审查员，站在承租人一侧审阅条款，并只从给定候选法条中挑选依据。',
  '',
  '风险分级：',
  '- high：违反《民法典》《住房租赁条例》的强制性或禁止性规定，或显著加重承租人责任（押金无理由不退、可随时进入、维修全转嫁、放弃诉讼权利等）',
  '- medium：约定不明或明显不对等（押金扣减情形未列举、违约金过高、缺少时限）',
  '- low：表述模糊但影响有限',
  '- ok：无明显问题，正常条款也请返回 ok',
  '',
  '重要背景：',
  '1. 文本中的【身份证1】【手机号1】【门牌号1】【银行卡1】是脱敏占位符，代表原文有该信息、只是被替换，**不要据此判断"信息缺失"**；',
  '2. 条款概览只是上下文，帮你判断某项内容是否已在本条或其他条款约定，不要审查概览里未列出的条款；',
  '3. 只判断给定条款本身的问题，不要因为"合同缺少某类条款"而扣分。',
  '',
  '硬约束：',
  '1. basis 里的 lawId 必须来自该条款的候选列表，禁止自造条号；',
  '2. quote 必须是该法条原文中连续的一段，照抄，不要改写；',
  '3. 不要下"条款无效/违法"的结论，用"可能被认定为…，建议协商修改"；',
  '4. 每条条款都要返回一条结果，id 与输入一致，不得遗漏。',
].join('\n')

const ADVISE_SYSTEM = [
  '你是租房合同修改顾问。针对已判定为高风险或中风险的条款，给出可直接使用的修改建议与沟通话术。',
  '',
  '要求：',
  '1. suggestion：一句话说明怎么改，具体可执行；',
  '2. revisedClause：给出可直接替换的条款文本，保留原条号；',
  '3. negotiation：50–150 字，语气不对抗，先给依据再给台阶，可以直接发给房东；',
  '4. 不要重复问题描述，不要编造法条。',
].join('\n')

export interface LawRef {
  lawId: string
  law: string
  article: string
  quote: string
  reason: string
}

export type RiskLevel = 'high' | 'medium' | 'low' | 'ok'

export interface RiskItem {
  id: string
  clauseId: string
  clauseNo?: string
  level: RiskLevel
  title: string
  issue: string
  confidence: number
  basis: LawRef[]
  suggestion?: string
  negotiation?: string
  revisedClause?: string
}

export interface ReviewResult {
  score: number
  stats: Record<RiskLevel, number>
  summary: string
  risks: RiskItem[]
  tookMs: number
  calls: number
  degraded: number
}

const WEIGHT: Record<RiskLevel, number> = { high: 12, medium: 6, low: 2, ok: 0 }

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** 限制并发，避免一次性打满上游 */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index]!)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

function normalize(text: string): string {
  return text.replace(/\s+/g, '')
}

/** 丢弃不在候选内、或原文里找不到的引用 */
function sanitizeBasis(raw: z.infer<typeof JudgeSchema>['items'][number]['basis'], candidates: LawHit[]): LawRef[] {
  const refs: LawRef[] = []

  for (const item of raw) {
    const candidate = candidates.find((hit) => hit.id === item.lawId)
    if (!candidate) continue

    const doc = getLawById(item.lawId)
    if (!doc) continue

    const quote = item.quote.trim()
    if (quote.length < 6 || !normalize(doc.text).includes(normalize(quote))) continue

    refs.push({
      lawId: doc.id,
      law: doc.short,
      article: doc.article,
      quote,
      reason: item.reason.trim(),
    })
  }

  return refs.slice(0, 3)
}

function buildJudgePrompt(
  clauses: Clause[],
  candidates: Map<string, LawHit[]>,
  allClauses: Clause[],
): string {
  const overview = allClauses
    .map((clause) => `${clause.no ?? `#${clause.index}`} ${clause.text.replace(/\s+/g, ' ').slice(0, 24)}`)
    .join('；')

  const blocks = clauses.map((clause) => {
    const laws = (candidates.get(clause.id) ?? [])
      .map((hit) => `- ${hit.id}（${hit.article}）：${hit.text.replace(/\s+/g, ' ')}`)
      .join('\n')
    return `[${clause.id}] ${clause.text.replace(/\n/g, ' ')}\n候选法条：\n${laws || '- 无'}\n`
  })

  return [
    `合同条款概览：${overview}`,
    '',
    '待审查条款：',
    ...blocks,
    '按 JSON 返回：{ "items": [{ "id": "...", "level": "high|medium|low|ok", "title": "...", "issue": "...", "confidence": 0.x, "basis": [{ "lawId": "...", "quote": "...", "reason": "..." }] }] }',
  ].join('\n')
}

export async function reviewClauses(clauses: Clause[]): Promise<ReviewResult> {
  const started = Date.now()
  const { model } = useDeepSeek()

  // 1. 每条条款先检索候选法条（标签加权，保证同类对齐）
  const candidates = new Map<string, LawHit[]>()
  for (const clause of clauses) {
    candidates.set(clause.id, searchLaws(clause.text, { topK: CANDIDATES_PER_CLAUSE, tags: [clause.tag] }))
  }

  let calls = 0
  let degraded = 0

  // 2. 分批判定
  const judgeBatches = chunk(clauses, JUDGE_BATCH)
  const judged = await mapLimit(judgeBatches, CONCURRENCY, async (batch) => {
    calls += 1
    try {
      const { object } = await generateObject({
        model,
        schema: JudgeSchema,
        system: JUDGE_SYSTEM,
        prompt: buildJudgePrompt(batch, candidates, clauses),
        temperature: 0,
        maxRetries: 1,
        providerOptions: noThinking,
      })
      return object.items
    } catch (error) {
      console.warn('[review] 判定批次失败', error)
      degraded += batch.length
      return []
    }
  })

  const byId = new Map(judged.flat().map((item) => [item.id, item]))

  const risks: RiskItem[] = clauses.map((clause) => {
    const item = byId.get(clause.id)
    if (!item) {
      return {
        id: `r-${clause.id}`,
        clauseId: clause.id,
        clauseNo: clause.no,
        level: 'low' as RiskLevel,
        title: '待人工复核',
        issue: '模型未返回该条款的判定结果',
        confidence: 0,
        basis: [],
      }
    }

    return {
      id: `r-${clause.id}`,
      clauseId: clause.id,
      clauseNo: clause.no,
      level: item.level,
      title: item.title.trim(),
      issue: item.issue.trim(),
      confidence: item.confidence,
      basis: sanitizeBasis(item.basis, candidates.get(clause.id) ?? []),
    }
  })

  // 3. 只给高风险/中风险生成建议与话术
  const needAdvice = risks.filter((risk) => risk.level === 'high' || risk.level === 'medium')
  const clauseById = new Map(clauses.map((clause) => [clause.id, clause]))

  if (needAdvice.length) {
    const adviceBatches = chunk(needAdvice, ADVISE_BATCH)
    const advised = await mapLimit(adviceBatches, CONCURRENCY, async (batch) => {
      calls += 1
      const prompt = [
        '待修改条款：',
        ...batch.map((risk) => {
          const clause = clauseById.get(risk.clauseId)
          return `[${risk.clauseId}] ${clause?.text.replace(/\n/g, ' ') ?? ''}\n问题：${risk.issue}`
        }),
        '按 JSON 返回：{ "items": [{ "id": "...", "suggestion": "...", "revisedClause": "...", "negotiation": "..." }] }',
      ].join('\n')

      try {
        const { object } = await generateObject({
          model,
          schema: AdviseSchema,
          system: ADVISE_SYSTEM,
          prompt,
          temperature: 0.4,
          maxRetries: 1,
          providerOptions: noThinking,
        })
        return object.items
      } catch (error) {
        console.warn('[review] 建议批次失败', error)
        return []
      }
    })

    const adviceById = new Map(advised.flat().map((item) => [item.id, item]))
    for (const risk of risks) {
      const advice = adviceById.get(risk.clauseId)
      if (!advice) continue
      risk.suggestion = advice.suggestion.trim()
      risk.negotiation = advice.negotiation.trim()
      risk.revisedClause = advice.revisedClause?.trim()
    }
  }

  // 4. 汇总打分
  const stats: Record<RiskLevel, number> = { high: 0, medium: 0, low: 0, ok: 0 }
  for (const risk of risks) stats[risk.level] += 1

  const penalty = (['high', 'medium', 'low'] as const).reduce(
    (sum, level) => sum + stats[level] * WEIGHT[level],
    0,
  )
  const score = Math.max(0, Math.min(100, 100 - penalty))

  const summary =
    stats.high + stats.medium + stats.low === 0
      ? `共审查 ${risks.length} 条条款，未发现明显风险，建议签约前再核对一遍原件。`
      : `共审查 ${risks.length} 条条款：${stats.high} 条高风险、${stats.medium} 条中风险、${stats.low} 条低风险。` +
        (stats.high > 0 ? '高风险条款建议先协商修改再签。' : '建议对中风险条款逐条确认。')

  return {
    score,
    stats,
    summary,
    risks,
    tookMs: Date.now() - started,
    calls,
    degraded,
  }
}
