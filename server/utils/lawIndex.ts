/**
 * 法规检索索引（内存构建，启动即可用）
 *
 * 为什么不用向量数据库：
 *  - 语料只有 116 条、平均 93 字，全量装进内存也才几十 KB；
 *  - 评审机器不需要装 Postgres/pgvector，`npm run dev` 就能跑；
 *  - 中文短文本上，字符二元组 BM25 + 同义词扩展的效果不比小模型差。
 *
 * 检索得分 = 0.65 * BM25 + 0.20 * 字符向量余弦 + 0.15 * 标签命中
 * 三个分量都能单独解释，调权重不用重新训练任何东西。
 */
import laws from '../../data/laws.json'
import { classifyByRules } from './clauseTags'

export interface LawArticle {
  id: string
  law: string
  short: string
  level: string
  chapter?: string
  article: string
  no: number
  text: string
  tags: string[]
  effectiveDate: string
  sourceUrl: string
}

export interface LawHit extends LawArticle {
  score: number
  bm25: number
  cosine: number
  tagHit: boolean
}

const DOCS = laws as LawArticle[]

/** 口语 -> 法条用词，解决「房东/出租人」「押金/保证金」这类不对称 */
const SYNONYMS: Record<string, string[]> = {
  房东: ['出租人', '甲方'],
  房主: ['出租人'],
  租客: ['承租人', '乙方'],
  房客: ['承租人'],
  二房东: ['转租', '次承租人', '资金监管'],
  中介: ['经纪机构'],
  押金: ['保证金'],
  定金: ['押金'],
  退租: ['解除合同', '提前终止'],
  赶人: ['腾退', '收回房屋'],
  进门: ['进入', '擅自进入'],
  进屋: ['进入房屋', '擅自进入'],
  隔断: ['非居住空间'],
  群租: ['居住人数', '非居住空间'],
  涨租: ['租金'],
  跑路: ['资金监管', '监管账户'],
  收钱: ['收取租金'],
  违约金: ['违约金', '赔偿'],
}

const K1 = 1.5
const B = 0.75
const VECTOR_DIM = 1024

function tokenize(text: string): string[] {
  const tokens: string[] = []
  const pattern = /[\u4e00-\u9fa5]+|[a-z0-9]+/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text.toLowerCase()))) {
    const chunk = match[0]
    if (/^[a-z0-9]+$/.test(chunk) || chunk.length === 1) {
      tokens.push(chunk)
      continue
    }
    // 中文按字符二元组切，避免引入分词词典
    for (let i = 0; i < chunk.length - 1; i++) tokens.push(chunk.slice(i, i + 2))
  }

  return tokens
}

function expandQuery(query: string): string[] {
  const extra: string[] = []
  for (const [word, syns] of Object.entries(SYNONYMS)) {
    if (query.includes(word)) extra.push(...syns)
  }
  return extra
}

interface IndexedDoc {
  doc: LawArticle
  tokens: string[]
  tf: Map<string, number>
  length: number
  vector: Float32Array
}

function hash(token: string): number {
  let h = 2166136261
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % VECTOR_DIM
}

function buildVector(tf: Map<string, number>, idf: Map<string, number>): Float32Array {
  const vec = new Float32Array(VECTOR_DIM)
  for (const [token, count] of tf) {
    vec[hash(token)] += (1 + Math.log(count)) * (idf.get(token) ?? 1)
  }
  let norm = 0
  for (let i = 0; i < VECTOR_DIM; i++) norm += vec[i]! * vec[i]!
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < VECTOR_DIM; i++) vec[i]! /= norm
  return vec
}

const indexed: IndexedDoc[] = []
const df = new Map<string, number>()

for (const doc of DOCS) {
  const tokens = tokenize(`${doc.text} ${doc.law} ${doc.tags.join(' ')}`)
  const tf = new Map<string, number>()
  for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1)
  for (const token of new Set(tokens)) df.set(token, (df.get(token) ?? 0) + 1)
  indexed.push({ doc, tokens, tf, length: tokens.length, vector: new Float32Array(VECTOR_DIM) })
}

const avgLength = indexed.reduce((sum, item) => sum + item.length, 0) / indexed.length || 1

const idf = new Map<string, number>()
for (const [token, count] of df) {
  idf.set(token, Math.log(1 + (DOCS.length - count + 0.5) / (count + 0.5)))
}

for (const item of indexed) item.vector = buildVector(item.tf, idf)

interface SearchOptions {
  topK?: number
  tags?: string[]
}

export function searchLaws(query: string, options: SearchOptions = {}): LawHit[] {
  const topK = options.topK ?? 5
  const trimmed = query.trim()
  if (!trimmed) return []

  const expanded = expandQuery(trimmed)
  const queryTokens = tokenize(trimmed)
  if (!queryTokens.length) return []

  const queryTf = new Map<string, number>()
  for (const token of queryTokens) queryTf.set(token, (queryTf.get(token) ?? 0) + 1)
  // 同义词扩展只给半票：补充召回，但不该盖过用户原话
  for (const word of expanded) {
    for (const token of tokenize(word)) {
      queryTf.set(token, (queryTf.get(token) ?? 0) + 0.5)
    }
  }
  const queryVector = buildVector(queryTf, idf)
  const queryTag = classifyByRules(trimmed).tag

  const hits: LawHit[] = indexed.map((item) => {
    let bm25 = 0
    for (const [token, count] of queryTf) {
      const freq = item.tf.get(token)
      if (!freq) continue
      const weight = idf.get(token) ?? 0
      bm25 += weight * ((freq * (K1 + 1)) / (freq + K1 * (1 - B + (B * item.length) / avgLength))) * count
    }

    let cosine = 0
    for (let i = 0; i < VECTOR_DIM; i++) cosine += queryVector[i]! * item.vector[i]!

    const tagHit =
      (queryTag !== '其他' && item.doc.tags.includes(queryTag)) ||
      (options.tags?.some((tag) => item.doc.tags.includes(tag)) ?? false)

    return { ...item.doc, bm25, cosine, tagHit, score: 0 }
  })

  const maxBm25 = Math.max(...hits.map((hit) => hit.bm25), 1)

  for (const hit of hits) {
    const normalizedBm25 = hit.bm25 / maxBm25
    hit.score = 0.65 * normalizedBm25 + 0.2 * Math.max(hit.cosine, 0) + (hit.tagHit ? 0.15 : 0)
  }

  return hits
    .filter((hit) => hit.score > 0.01)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

export function listLaws() {
  const byLaw = new Map<string, { short: string; law: string; level: string; effectiveDate: string; sourceUrl: string; count: number }>()

  for (const doc of DOCS) {
    const entry = byLaw.get(doc.law) ?? {
      short: doc.short,
      law: doc.law,
      level: doc.level,
      effectiveDate: doc.effectiveDate,
      sourceUrl: doc.sourceUrl,
      count: 0,
    }
    entry.count += 1
    byLaw.set(doc.law, entry)
  }

  return { total: DOCS.length, laws: [...byLaw.values()] }
}

export function getLawById(id: string): LawArticle | undefined {
  return DOCS.find((doc) => doc.id === id)
}
