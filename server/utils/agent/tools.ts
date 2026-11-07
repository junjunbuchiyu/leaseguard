/**
 * Agent 可调用的工具
 *
 * 全部是确定性函数：同一个输入永远得到同一个输出，不需要联网、不额外花 token。
 * 这样「AI 查了哪条法、算了什么数」都能在轨迹里复现，评审也可以逐条核对。
 *
 * 模型不直接执行函数，而是通过结构化输出里的 searchHint / lawId 指定参数，
 * 由运行时真正调用工具并把结果回灌给下一轮判定 —— 这就是这里的 tool use。
 */
import { CLAUSE_TAGS } from '../clauseTags'
import { getLawById, listLaws, searchLaws, type LawHit } from '../lawIndex'
import { clip } from './trace'

export interface ToolOutcome {
  /** 给轨迹面板看的一行摘要 */
  summary: string
  /** 回灌给模型 / 后续阶段的结构化结果 */
  data: unknown
}

export interface ToolSpec {
  name: string
  title: string
  description: string
  run: (args: Record<string, unknown>) => ToolOutcome
}

function normalize(text: string): string {
  return text.replace(/\s+/g, '')
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function hitSummary(hits: LawHit[], limit = 3): string {
  if (!hits.length) return '无命中'
  return hits
    .slice(0, limit)
    .map((hit) => `${hit.short}${hit.article}(${hit.score.toFixed(2)})`)
    .join('、')
}

/** 检索法规：返回候选条文，供判定阶段引用 */
const searchLaw: ToolSpec = {
  name: 'search_law',
  title: '检索法规',
  description: '在本地 116 条住房租赁法规中检索，返回带打分的候选条文',
  run(args) {
    const query = asString(args.query).trim()
    const topK = Math.min(Math.max(Number(args.topK) || 5, 1), 8)
    const tags = Array.isArray(args.tags) ? (args.tags as string[]) : undefined

    if (!query) return { summary: '空查询，已跳过', data: [] }

    const hits = searchLaws(query, { topK, tags })
    return {
      summary: `${hits.length} 条候选 · ${hitSummary(hits)}`,
      data: hits.map((hit) => ({
        id: hit.id,
        short: hit.short,
        article: hit.article,
        text: hit.text,
        score: Number(hit.score.toFixed(3)),
      })),
    }
  },
}

/** 取法条全文：核对引用时用 */
const getLaw: ToolSpec = {
  name: 'get_law',
  title: '读取法条',
  description: '按 lawId 取回法条原文，用于逐字核对引用',
  run(args) {
    const id = asString(args.lawId)
    const doc = getLawById(id)
    if (!doc) return { summary: `法条不存在：${id}`, data: null }
    return {
      summary: `${doc.short}${doc.article} · ${clip(doc.text, 36)}`,
      data: { id: doc.id, article: doc.article, text: doc.text },
    }
  },
}

/** 引用核对：quote 必须是法条原文的连续片段 */
const checkCitation: ToolSpec = {
  name: 'check_citation',
  title: '核对引用',
  description: '校验 quote 是否真在某条法条原文中（去空白后逐字匹配）',
  run(args) {
    const id = asString(args.lawId)
    const quote = asString(args.quote)
    const doc = getLawById(id)

    if (!doc) return { summary: '法条不存在，引用作废', data: { ok: false, reason: 'lawId 不在法规库' } }
    if (quote.trim().length < 6) return { summary: '引用过短，作废', data: { ok: false, reason: 'quote 少于 6 字' } }

    const ok = normalize(doc.text).includes(normalize(quote))
    return {
      summary: ok ? `逐字命中 ${doc.short}${doc.article}` : '与原文不符，丢弃该引用',
      data: { ok, reason: ok ? '逐字命中' : 'quote 不是原文片段' },
    }
  },
}

/**
 * 金额测算：把「押金相当于几个月租金」「违约金是否偏高」算成具体数字
 * 依据：民法典第 585 条（违约金过分高于损失可请求调减，司法实践常以 30% 为参照）
 */
const calcPenalty: ToolSpec = {
  name: 'calc_penalty',
  title: '测算押金与违约金',
  description: '根据租金、押金、违约月数算出押金月数与违约金占比，给出是否偏高的判断',
  run(args) {
    const rent = asNumber(args.rent)
    const deposit = asNumber(args.deposit)
    const penaltyMonths = asNumber(args.penaltyMonths)

    const depositMonths = rent && deposit ? Number((deposit / rent).toFixed(2)) : null
    const penaltyShare = penaltyMonths && depositMonths ? Number((penaltyMonths / depositMonths).toFixed(2)) : null

    const notes: string[] = []
    if (depositMonths !== null) {
      notes.push(depositMonths > 1 ? `押金 ${depositMonths} 个月租金，高于常见的 1 个月` : `押金 ${depositMonths} 个月租金`)
    }
    if (penaltyMonths !== null) notes.push(`违约金约 ${penaltyMonths} 个月租金`)
    if (!notes.length) notes.push('未识别到租金/押金数额，跳过测算')

    return {
      summary: notes.join('；'),
      data: {
        depositMonths,
        penaltyShare,
        note: depositMonths !== null && depositMonths > 2 ? '押金比例偏高，建议协商压到 1 个月' : '金额比例在常见区间',
      },
    }
  },
}

/** 法规库概览：确认检索范围，避免模型假设法条存在 */
const lawStats: ToolSpec = {
  name: 'law_stats',
  title: '法规库概览',
  description: '返回收录的法律名称、条数与标签覆盖情况',
  run() {
    const { total, laws } = listLaws()
    const byLaw = laws.map((law) => `${law.short} ${law.count} 条`).join('、')
    return {
      summary: `${total} 条 · ${byLaw}`,
      data: { total, laws: laws.map((law) => ({ short: law.short, count: law.count, effectiveDate: law.effectiveDate })), tags: CLAUSE_TAGS },
    }
  },
}

export const TOOLS: Record<string, ToolSpec> = {
  [searchLaw.name]: searchLaw,
  [getLaw.name]: getLaw,
  [checkCitation.name]: checkCitation,
  [calcPenalty.name]: calcPenalty,
  [lawStats.name]: lawStats,
}

/** 给文档 / MCP 用的工具清单 */
export function listTools() {
  return Object.values(TOOLS).map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
  }))
}

/** 统一出口：调用即记账，异常也记一笔，别让一次工具失败打断整轮审查 */
export function callTool(name: string, args: Record<string, unknown>): ToolOutcome {
  const tool = TOOLS[name]
  if (!tool) return { summary: `未知工具：${name}`, data: null }

  try {
    return tool.run(args)
  } catch (error) {
    console.warn('[agent] 工具执行失败', name, error)
    return { summary: '工具执行失败，已跳过', data: null }
  }
}
