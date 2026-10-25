import { generateText } from 'ai'
import { extractText, getDocumentProxy } from 'unpdf'
import { noThinking, useDeepSeek } from './deepseek'

export type ParseSource = 'pdf-text' | 'vision' | 'paste'

export interface UploadedFile {
  data: Buffer
  type: string
  filename: string
}

export interface ParseOutcome {
  text: string
  source: ParseSource
  pages?: number
  warnings: string[]
}

/** 转录任务只要求「照抄」，不要理解、不要润色 */
const TRANSCRIBE_SYSTEM = [
  '你是合同文本转录器，唯一任务是把图片里的文字逐字转成纯文本。',
  '规则：',
  '1. 不总结、不改写、不纠错、不补全，标点与数字照原样保留；',
  '2. 保留条款编号（第X条、1.、（一））与原始分段，一行一条；',
  '3. 个别字看不清用【?】代替，整段模糊写【原件此处模糊】，禁止猜测内容；',
  '4. 只输出转写结果，不要加解释、不要用 Markdown 代码块包裹。',
].join('\n')

const IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
}

function normalizeMime(type: string, filename: string): string {
  if (type && Object.values(IMAGE_MIME).includes(type)) return type
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_MIME[ext] ?? 'image/jpeg'
}

function stripCodeFence(text: string): string {
  return text
    .replace(/^\s*```[a-z]*\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
}

/** 扫描版 PDF 没有文本层时，让用户改用图片，比悄悄返回空文本好 */
export async function parsePdf(buf: Buffer): Promise<ParseOutcome> {
  const pdf = await getDocumentProxy(new Uint8Array(buf))
  const { text, totalPages } = await extractText(pdf, { mergePages: true })
  const merged = (Array.isArray(text) ? text.join('\n') : text).trim()

  if (merged.length < 80) {
    throw createError({
      statusCode: 422,
      data: {
        message: '这份 PDF 没有文本层（多半是扫描件）。请把合同拍照或截图后按图片上传。',
      },
    })
  }

  return { text: merged, source: 'pdf-text', pages: totalPages, warnings: [] }
}

/** 多张图片一次提交，模型按顺序连续转写，避免每页一次调用导致上下文断裂 */
export async function parseImages(files: UploadedFile[]): Promise<ParseOutcome> {
  const { visionModel } = useDeepSeek()
  const warnings: string[] = []

  const content = [
    { type: 'text' as const, text: `请逐字转写这 ${files.length} 张合同图片中的全部文字，按图片顺序连续输出。` },
    // AI SDK 7 起图片走 file part（旧的 image part 已废弃）
    ...files.map((file) => ({
      type: 'file' as const,
      mediaType: normalizeMime(file.type, file.filename),
      data: new Uint8Array(file.data),
    })),
  ]

  const { text } = await generateText({
    model: visionModel,
    system: TRANSCRIBE_SYSTEM,
    messages: [{ role: 'user', content }],
    temperature: 0,
    maxOutputTokens: 8192,
    maxRetries: 1,
    providerOptions: noThinking,
  })

  const cleaned = stripCodeFence(text)
  if (cleaned.length < 50) {
    warnings.push('识别结果偏短，可能是图片模糊或不是合同内容，建议人工核对')
  }
  if (cleaned.includes('【原件此处模糊】') || cleaned.includes('【?】')) {
    warnings.push('部分内容无法辨认，已用【?】标记，请对照原件手动补全')
  }

  return { text: cleaned, source: 'vision', pages: files.length, warnings }
}
