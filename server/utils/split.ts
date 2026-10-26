/**
 * 条款切分：纯规则、可解释、零模型调用
 *
 * 三级策略，命中即停：
 *   1) 条款编号行（第X条）—— 租房合同最常见
 *   2) 阿拉伯数字 / 括号数字编号（1. 、（一））
 *   3) 空行分段
 * 都不成立时按 300 字左右切块，并给出警告（后续审查会标记「未能识别条款结构」）
 *
 * 所有偏移量都相对于 normalizeContractText() 之后的文本，
 * 前端可以直接用 start/end 做高亮，不用再算一遍。
 */
import type { ClauseDraft, SplitStrategy } from './types'

const ARTICLE_LINE = /^[ \t]*第[一二三四五六七八九十百零〇\d]+条/gm
const NUMBERED_LINE = /^[ \t]*(?:\d{1,2}[.、]|[（(]\d{1,2}[）)])/gm

export interface SplitResult {
  clauses: ClauseDraft[]
  /** 条款之前的抬头部分：合同标题、甲乙方信息 */
  preamble: string
  strategy: SplitStrategy
  warnings: string[]
}

/** 统一换行与空白，保证偏移量稳定、展示一致 */
export function normalizeContractText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0\u3000]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

interface Mark {
  index: number
  heading: string
}

function collectMarks(text: string, pattern: RegExp): Mark[] {
  const marks: Mark[] = []
  pattern.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    marks.push({ index: match.index, heading: match[0].trim() })
    if (match.index === pattern.lastIndex) pattern.lastIndex += 1
  }
  return marks
}

function buildFromMarks(text: string, marks: Mark[]): ClauseDraft[] {
  const clauses: ClauseDraft[] = []

  for (let i = 0; i < marks.length; i++) {
    const start = marks[i]!.index
    const end = i + 1 < marks.length ? marks[i + 1]!.index : text.length
    const raw = text.slice(start, end)
    const trimmedStart = raw.length - raw.trimStart().length
    const body = raw.trim()

    if (body.length < 4) continue

    // 只有以「第X条」开头时才记录编号，数字编号不当作条号
    const no = /^第[一二三四五六七八九十百零〇\d]+条/.exec(body)?.[0]

    clauses.push({
      no,
      text: body,
      start: start + trimmedStart,
      end: start + trimmedStart + body.length,
    })
  }

  return clauses
}

function splitByParagraph(text: string): ClauseDraft[] {
  const clauses: ClauseDraft[] = []
  const pattern = /\n{2,}/g
  let cursor = 0
  let match: RegExpExecArray | null

  const push = (from: number, to: number) => {
    const raw = text.slice(from, to)
    const trimmedStart = raw.length - raw.trimStart().length
    const body = raw.trim()
    if (body.length >= 4) {
      clauses.push({ text: body, start: from + trimmedStart, end: from + trimmedStart + body.length })
    }
  }

  while ((match = pattern.exec(text))) {
    push(cursor, match.index)
    cursor = match.index + match[0].length
  }
  push(cursor, text.length)

  return clauses
}

/** 兜底切块：尽量在换行或句号处断开，避免把一句话劈成两半 */
function splitByChunk(text: string, size = 300): ClauseDraft[] {
  const clauses: ClauseDraft[] = []
  let start = 0

  while (start < text.length) {
    let end = Math.min(start + size, text.length)
    if (end < text.length) {
      const slice = text.slice(start, end)
      const breakAt = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf('。'))
      if (breakAt > size * 0.5) end = start + breakAt + 1
    }
    const raw = text.slice(start, end)
    const trimmedStart = raw.length - raw.trimStart().length
    const body = raw.trim()
    if (body.length >= 4) {
      clauses.push({ text: body, start: start + trimmedStart, end: start + trimmedStart + body.length })
    }
    start = end
  }

  return clauses
}

export function splitClauses(text: string): SplitResult {
  const warnings: string[] = []

  const articleMarks = collectMarks(text, ARTICLE_LINE)
  if (articleMarks.length >= 3) {
    const clauses = buildFromMarks(text, articleMarks)
    return {
      clauses,
      preamble: text.slice(0, articleMarks[0]!.index).trim(),
      strategy: 'article',
      warnings,
    }
  }

  const numberedMarks = collectMarks(text, NUMBERED_LINE)
  if (numberedMarks.length >= 3) {
    const clauses = buildFromMarks(text, numberedMarks)
    return {
      clauses,
      preamble: text.slice(0, numberedMarks[0]!.index).trim(),
      strategy: 'numbered',
      warnings: ['未识别到「第X条」编号，已按数字编号切分，建议人工核对'],
    }
  }

  const paragraphs = splitByParagraph(text)
  if (paragraphs.length >= 2) {
    return { clauses: paragraphs, preamble: '', strategy: 'paragraph', warnings: [] }
  }

  if (text.length <= 400) {
    return {
      clauses: [{ text, start: 0, end: text.length }],
      preamble: '',
      strategy: 'paragraph',
      warnings: ['这段文本没有条款结构，已整体作为一条处理'],
    }
  }

  return {
    clauses: splitByChunk(text),
    preamble: '',
    strategy: 'chunk',
    warnings: ['未能识别条款结构，已按约 300 字分块，审查结果可能不够精确'],
  }
}
