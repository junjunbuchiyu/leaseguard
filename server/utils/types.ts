import type { ClauseTag } from './clauseTags'

export interface ClauseDraft {
  /** 条款编号，如「第三条」；无编号时为空 */
  no?: string
  text: string
  /** 在规范化后正文中的字符偏移，供前端高亮定位 */
  start: number
  end: number
}

export type SplitStrategy = 'article' | 'numbered' | 'paragraph' | 'chunk'

export interface Clause {
  id: string
  index: number
  no?: string
  text: string
  start: number
  end: number
  tag: ClauseTag
  confidence: number
  tagSource: 'rule' | 'llm'
  chars: number
}
