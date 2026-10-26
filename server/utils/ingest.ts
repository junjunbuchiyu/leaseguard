/**
 * 合同接入：读请求 → 解析 → 脱敏 → 切分 → 分类 → 入会话
 *
 * 抽出来是为了让两个接口共用同一段逻辑：
 *   POST /api/audit/parse          一次性返回结果
 *   POST /api/audit/parse/stream   SSE 推送每个阶段，前端能看到 AI 一步步在干什么
 */
import { parseImages, parsePdf, type ParseSource, type UploadedFile } from './parse'
import { redactPii } from './redact'
import { putDoc } from './docStore'
import { normalizeContractText, splitClauses } from './split'
import { classifyByRules, LLM_REFINE_THRESHOLD } from './clauseTags'
import type { Clause } from './types'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_FILES = 5
const MIN_TEXT_LENGTH = 20

export interface StageEvent {
  key: 'extract' | 'redact' | 'split' | 'classify'
  label: string
  status: 'running' | 'done'
  detail?: string
  ms?: number
}

export interface IngestHooks {
  onStage?: (stage: StageEvent) => void
}

export interface IngestInput {
  text?: string
  files?: UploadedFile[]
}

export interface IngestResult {
  docId: string
  text: string
  preamble: string
  clauses: Clause[]
  strategy: string
  source: ParseSource
  pages: number | null
  counts: Record<string, number>
  totalMasked: number
  chars: number
  warnings: string[]
}

/** 从请求里取出上传文件或文本 */
export async function collectInput(event: any): Promise<IngestInput> {
  const contentType = getHeader(event, 'content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = await readBody<{ text?: unknown }>(event)
    const raw = body?.text
    const text = typeof raw === 'string' ? raw.trim() : ''
    if (text.length < MIN_TEXT_LENGTH) {
      throw createError({ statusCode: 400, data: { message: '合同内容太短，至少 20 个字' } })
    }
    return { text }
  }

  const parts = (await readMultipartFormData(event)) ?? []
  const files: UploadedFile[] = parts
    .filter((part) => part.filename && part.data?.length)
    .map((part) => ({
      data: part.data,
      type: part.type ?? '',
      filename: part.filename ?? '',
    }))

  if (!files.length) {
    throw createError({ statusCode: 400, data: { message: '没有收到文件，请上传合同图片或 PDF' } })
  }
  if (files.length > MAX_FILES) {
    throw createError({ statusCode: 413, data: { message: `最多一次上传 ${MAX_FILES} 个文件` } })
  }
  const tooBig = files.find((file) => file.data.length > MAX_FILE_BYTES)
  if (tooBig) {
    throw createError({ statusCode: 413, data: { message: `${tooBig.filename} 超过 10MB，请压缩后再传` } })
  }

  return { files }
}

export async function runIngest(input: IngestInput, hooks: IngestHooks = {}): Promise<IngestResult> {
  const stage = (value: StageEvent) => hooks.onStage?.(value)
  const warnings: string[] = []

  let rawText = input.text ?? ''
  let source: ParseSource = 'paste'
  let pages: number | undefined

  // 1. 解析
  const extractStarted = Date.now()
  stage({ key: 'extract', label: '识别合同文字', status: 'running' })

  if (!rawText) {
    const files = input.files ?? []
    const isPdf = files.every((f) => f.type === 'application/pdf' || f.filename.toLowerCase().endsWith('.pdf'))
    const isImage = files.every((f) => f.type.startsWith('image/') || /\.(jpe?g|png|gif|webp)$/i.test(f.filename))

    if (isPdf && files.length === 1) {
      const parsed = await parsePdf(files[0]!.data)
      rawText = parsed.text
      source = parsed.source
      pages = parsed.pages
    } else if (isImage) {
      const parsed = await parseImages(files)
      rawText = parsed.text
      source = parsed.source
      pages = parsed.pages
      warnings.push(...parsed.warnings)
    } else {
      throw createError({
        statusCode: 415,
        data: { message: '只支持图片（JPG/PNG/WebP）或 PDF，且一次不要混着传' },
      })
    }
  }

  const sourceLabel =
    source === 'vision' ? `视觉转写 · ${pages ?? 1} 张图片` : source === 'pdf-text' ? `PDF 文本层 · ${pages ?? 1} 页` : '粘贴文本'

  stage({
    key: 'extract',
    label: '识别合同文字',
    status: 'done',
    detail: `${sourceLabel} · ${rawText.length} 字`,
    ms: Date.now() - extractStarted,
  })

  // 2. 脱敏
  const redactStarted = Date.now()
  stage({ key: 'redact', label: '本地遮盖敏感信息', status: 'running' })

  const normalized = normalizeContractText(rawText)
  if (normalized.length < MIN_TEXT_LENGTH) {
    throw createError({ statusCode: 400, data: { message: '可识别的合同内容太少，请检查文件是否清晰' } })
  }

  const redacted = redactPii(normalized)
  stage({
    key: 'redact',
    label: '本地遮盖敏感信息',
    status: 'done',
    detail: redacted.total ? `${redacted.total} 处 · ${Object.keys(redacted.counts).join(' / ')}` : '未发现敏感信息',
    ms: Date.now() - redactStarted,
  })

  // 3. 切分
  const splitStarted = Date.now()
  stage({ key: 'split', label: '切分条款', status: 'running' })
  const split = splitClauses(redacted.text)
  if (!split.clauses.length) {
    throw createError({ statusCode: 422, data: { message: '没能从文本中切出条款，请检查内容' } })
  }
  stage({
    key: 'split',
    label: '切分条款',
    status: 'done',
    detail: `${split.clauses.length} 条 · ${split.strategy === 'article' ? '按「第X条」' : '按段落'}`,
    ms: Date.now() - splitStarted,
  })

  // 4. 分类（规则打底，低置信留给后续复核）
  const classifyStarted = Date.now()
  stage({ key: 'classify', label: '条款分类打标', status: 'running' })

  const clauses: Clause[] = split.clauses.map((draft, index) => {
    const classification = classifyByRules(draft.text)
    return {
      id: `c${index + 1}`,
      index: index + 1,
      no: draft.no,
      text: draft.text,
      start: draft.start,
      end: draft.end,
      tag: classification.tag,
      confidence: classification.confidence,
      tagSource: 'rule',
      chars: draft.text.length,
    }
  })

  const uncertain = clauses.filter((clause) => clause.confidence < LLM_REFINE_THRESHOLD).length
  stage({
    key: 'classify',
    label: '条款分类打标',
    status: 'done',
    detail: uncertain ? `${clauses.length} 条 · ${uncertain} 条待复核` : `${clauses.length} 条全部命中规则`,
    ms: Date.now() - classifyStarted,
  })

  const doc = putDoc({
    text: redacted.text,
    preamble: split.preamble,
    clauses,
    strategy: split.strategy,
    vault: redacted.vault,
    source,
    pages,
    counts: redacted.counts,
    chars: normalized.length,
  })

  return {
    docId: doc.id,
    text: doc.text,
    preamble: doc.preamble,
    clauses: doc.clauses,
    strategy: doc.strategy,
    source: doc.source,
    pages: doc.pages ?? null,
    counts: doc.counts,
    totalMasked: redacted.total,
    chars: doc.chars,
    warnings: [...warnings, ...split.warnings],
  }
}
