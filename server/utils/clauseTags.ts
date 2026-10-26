/**
 * 条款分类：关键词规则打底，LLM 只负责兜底
 *
 * 顺序即优先级（同分时靠前者胜出），所以「押金」放在最前面：
 * 「押金不退」这类条款同时命中押金和解约，押金更贴近争议焦点。
 */
import taxonomy from '../../data/clause-tags.json'

export const CLAUSE_TAGS = [
  '押金',
  '租金费用',
  '维修',
  '提前解约',
  '转租续租',
  '房屋状况',
  '隐私入户',
  '备案证件',
  '违约责任',
  '期限与形式',
  '其他',
] as const

export type ClauseTag = (typeof CLAUSE_TAGS)[number]

interface TagRule {
  tag: ClauseTag
  keywords: string[]
}

const RULES = taxonomy.rules as TagRule[]

/** 启动即校验，防止 taxonomy 与代码里的类型悄悄漂移 */
function assertTaxonomy() {
  for (const rule of RULES) {
    if (!CLAUSE_TAGS.includes(rule.tag)) {
      throw new Error(`clause-tags.json 出现未定义标签：${rule.tag}`)
    }
  }
}
assertTaxonomy()

export const TAG_HINTS = taxonomy.hints as Record<ClauseTag, string>

function countOccurrences(text: string, keyword: string): number {
  if (!keyword) return 0
  return text.split(keyword).length - 1
}

export interface RuleClassification {
  tag: ClauseTag
  confidence: number
  hits: number
}

export function classifyByRules(text: string): RuleClassification {
  const scored = RULES.map((rule) => ({
    tag: rule.tag,
    hits: rule.keywords.reduce((sum, keyword) => sum + countOccurrences(text, keyword), 0),
  }))

  // Array.prototype.sort 在 V8 中稳定，同分时保留 RULES 的优先级
  scored.sort((a, b) => b.hits - a.hits)
  const best = scored[0]

  if (!best || best.hits === 0) {
    return { tag: '其他', confidence: 0.2, hits: 0 }
  }

  return {
    tag: best.tag,
    confidence: Math.min(0.9, 0.6 + 0.1 * (best.hits - 1)),
    hits: best.hits,
  }
}

/** 低于该置信度的条款交给 LLM 复核 */
export const LLM_REFINE_THRESHOLD = 0.5
