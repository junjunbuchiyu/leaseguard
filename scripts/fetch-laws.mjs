/**
 * 抓取法规原文并落盘到 data/raw/*.txt
 *
 * 用法：node scripts/fetch-laws.mjs
 * 说明：
 *  - 只在需要更新法条时运行，产物随仓库提交，评审无需联网复现
 *  - 抓取后只做「去标签 + 空白归一」，不做任何改写，保证逐字可溯源
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SOURCES } from './sources.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const RAW = resolve(ROOT, 'data/raw')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&mdash;': '—',
  '&hellip;': '…',
}

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
}

function htmlToText(html) {
  const s = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|table|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')

  return decodeEntities(s)
    .replace(/\r/g, '')
    .replace(/[ \t\u00a0\u3000]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

async function main() {
  await mkdir(RAW, { recursive: true })

  for (const src of SOURCES) {
    const res = await fetch(src.url, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`${src.law} 抓取失败：HTTP ${res.status}`)

    const html = await res.text()
    const text = htmlToText(html)

    // 整篇落盘，条文区间由 build-laws.mjs 负责挑选
    // 好处：同一部法律可以按需扩展收录范围，不必重新抓取
    const headings = text.match(/^第[一二三四五六七八九十百零]+条/gm) ?? []
    await writeFile(resolve(RAW, `${src.key}.txt`), text + '\n', 'utf8')

    console.log(
      `${src.law.padEnd(14, '　')} ${String(text.length).padStart(6)} 字  ` +
        `条文 ${String(headings.length).padStart(3)} 条  -> data/raw/${src.key}.txt`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
