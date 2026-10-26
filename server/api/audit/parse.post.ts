/**
 * POST /api/audit/parse
 *
 * 输入：multipart（files: 图片/PDF，最多 5 个，单个 ≤10MB）或 JSON（{ text }）
 * 输出：脱敏正文 + 条款切分与规则分类
 *
 * 顺序很重要：解析 → 规范化 → 脱敏 → 切分 → 规则分类，
 * 之后整条链路只使用脱敏文本，原文不再出现。
 */
import { parseImages, parsePdf, type ParseSource, type UploadedFile } from '~~/server/utils/parse'
import { redactPii } from '~~/server/utils/redact'
import { putDoc } from '~~/server/utils/docStore'
import { normalizeContractText, splitClauses } from '~~/server/utils/split'
import { classifyByRules } from '~~/server/utils/clauseTags'
import type { Clause } from '~~/server/utils/types'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_FILES = 5
const MIN_TEXT_LENGTH = 20

export default defineEventHandler(async (event) => {
  const contentType = getHeader(event, 'content-type') ?? ''

  let rawText = ''
  let source: ParseSource = 'paste'
  let pages: number | undefined
  const warnings: string[] = []

  if (contentType.includes('application/json')) {
    const body = await readBody<{ text?: string }>(event)
    rawText = (body?.text ?? '').trim()
    if (rawText.length < MIN_TEXT_LENGTH) {
      throw createError({ statusCode: 400, data: { message: '合同内容太短，至少 20 个字' } })
    }
  } else {
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
    const tooBig = files.find((f) => f.data.length > MAX_FILE_BYTES)
    if (tooBig) {
      throw createError({ statusCode: 413, data: { message: `${tooBig.filename} 超过 10MB，请压缩后再传` } })
    }

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

  const normalized = normalizeContractText(rawText)
  if (normalized.length < MIN_TEXT_LENGTH) {
    throw createError({ statusCode: 400, data: { message: '可识别的合同内容太少，请检查文件是否清晰' } })
  }

  const redacted = redactPii(normalized)
  const split = splitClauses(redacted.text)

  if (!split.clauses.length) {
    throw createError({ statusCode: 422, data: { message: '没能从文本中切出条款，请检查内容' } })
  }

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
})
