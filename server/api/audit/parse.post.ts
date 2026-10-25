/**
 * POST /api/audit/parse
 *
 * 输入：multipart（files: 图片/PDF，最多 5 个，单个 ≤10MB）或 JSON（{ text }）
 * 输出：脱敏后的合同文本 + 遮盖统计
 *
 * 顺序很重要：先解析，立刻脱敏，之后整条链路只使用脱敏文本。
 */
import { parseImages, parsePdf, type ParseSource, type UploadedFile } from '~~/server/utils/parse'
import { redactPii } from '~~/server/utils/redact'
import { putDoc } from '~~/server/utils/docStore'

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

  const redacted = redactPii(rawText)

  const doc = putDoc({
    text: redacted.text,
    vault: redacted.vault,
    source,
    pages,
    counts: redacted.counts,
    chars: rawText.length,
  })

  return {
    docId: doc.id,
    text: doc.text,
    source: doc.source,
    pages: doc.pages ?? null,
    counts: doc.counts,
    totalMasked: redacted.total,
    chars: doc.chars,
    warnings,
  }
})
