/**
 * 把 data/raw/*.txt 解析成结构化法条库
 *
 * 输入：data/raw/{key}.txt（由 fetch-laws.mjs 生成，逐字原文）
 * 输出：data/laws.jsonl + data/laws.meta.json
 *
 * 用法：node scripts/build-laws.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SOURCES } from './sources.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const RAW = resolve(ROOT, 'data/raw')
const OUT_JSON = resolve(ROOT, 'data/laws.json')
const OUT_META = resolve(ROOT, 'data/laws.meta.json')

/** 条文之外的页面噪音：遇到这些行即视为正文结束 */
const STOP_LINE =
  /^(解读|相关稿件|链接：|登录|注册|退出|×|网站纠错|主办单位|版权所有|网站标识码|京ICP备|京公网安备|国务院客户端|中国政府网|电脑版|客户端|小程序|微博|微信|邮箱|\|)$/

/**
 * 条款标签规则：直接复用 data/clause-tags.json，
 * 保证法条标签与合同条款标签是同一套口径，检索时才能按标签对齐
 */
const taxonomy = JSON.parse(
  readFileSync(new URL('../data/clause-tags.json', import.meta.url), 'utf8'),
)

const TAG_RULES = taxonomy.rules.map((rule) => ({
  tag: rule.tag,
  re: new RegExp(rule.keywords.map((kw) => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g'),
}))

const CN_DIGIT = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }

/** 中文数字转阿拉伯数字，覆盖到 999（本法条库足够） */
function cnToNumber(cn) {
  let section = 0
  let num = 0
  for (const ch of cn) {
    if (ch === '百') {
      section += (num || 1) * 100
      num = 0
    } else if (ch === '十') {
      section += (num || 1) * 10
      num = 0
    } else if (ch === '零') {
      num = 0
    } else if (ch in CN_DIGIT) {
      num = CN_DIGIT[ch]
    }
  }
  return section + num
}

function assignTags(text) {
  const scored = TAG_RULES.map((rule) => ({
    tag: rule.tag,
    hits: (text.match(rule.re) ?? []).length,
  }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)

  if (!scored.length) return ['其他']
  return scored.slice(0, 3).map((x) => x.tag)
}

/** 把一条条文的多行正文拼成一段：中文换行直接相连，枚举项另起一行 */
function joinBody(lines) {
  let body = ''
  for (const line of lines) {
    if (/^[（(]/.test(line)) body += '\n' + line
    else body += line
  }
  // 个别页面把全角标点写成半角，统一回全角，避免法条原文显示不一致
  return body.trim().replace(/(?<=[\u4e00-\u9fa5）】])\s*;\s*(?=[\u4e00-\u9fa5（【])/g, '；')
}

function parseSource(src, raw) {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const headingAt = []
  lines.forEach((line, i) => {
    if (/^第[一二三四五六七八九十百零]+条/.test(line)) headingAt.push(i)
  })
  if (!headingAt.length) throw new Error(`${src.law}：未解析到任何条文`)

  const lastHeading = headingAt.at(-1)
  const stopAt = lines.findIndex((line, i) => i > lastHeading && STOP_LINE.test(line))
  const end = stopAt > 0 ? stopAt : lines.length

  const records = []
  for (let k = 0; k < headingAt.length; k++) {
    const start = headingAt[k]
    const next = k + 1 < headingAt.length ? headingAt[k + 1] : end
    const block = lines.slice(start, next)

    const m = block[0].match(/^第([一二三四五六七八九十百零]+)条\s*(.*)$/)
    if (!m) continue

    const no = cnToNumber(m[1])
    const firstLine = m[2].trim()
    const body = joinBody([firstLine, ...block.slice(1)]).trim()
    if (!body) continue

    records.push({
      id: `${src.short}#${no}`,
      law: src.law,
      short: src.short,
      level: src.level,
      chapter: src.chapter,
      article: `第${m[1]}条`,
      no,
      text: body,
      tags: assignTags(body),
      effectiveDate: src.effectiveDate,
      sourceUrl: src.url,
    })
  }

  return records
}

/** 按 range / picks 从整部法律中挑出需要的条文 */
function selectArticles(src, records) {
  if (!src.range) return records

  const keep = new Set()
  for (let n = src.range[0]; n <= src.range[1]; n++) keep.add(n)
  for (const n of src.picks ?? []) keep.add(n)

  return records.filter((r) => keep.has(r.no))
}

function validate(all) {
  const errors = []
  const seen = new Set()

  for (const r of all) {
    if (seen.has(r.id)) errors.push(`重复 id：${r.id}`)
    seen.add(r.id)

    if (!r.text || r.text.length < 10) errors.push(`${r.id} 正文过短`)
    if (r.text.length > 800) errors.push(`${r.id} 正文过长（${r.text.length} 字），可能混入页面噪音`)
    if (!r.tags.length || r.tags.length > 3) errors.push(`${r.id} 标签数量异常：${r.tags.length}`)
    if (!r.sourceUrl.startsWith('http')) errors.push(`${r.id} 缺少来源链接`)
    if (/主办单位|京ICP备|网站纠错/.test(r.text)) errors.push(`${r.id} 正文混入页面噪音`)
  }

  for (const src of SOURCES) {
    const list = all.filter((r) => r.law === src.law).sort((a, b) => a.no - b.no)
    if (!list.length) {
      errors.push(`${src.law} 无条文`)
      continue
    }

    if (src.range) {
      const expected = new Set()
      for (let n = src.range[0]; n <= src.range[1]; n++) expected.add(n)
      for (const n of src.picks ?? []) expected.add(n)

      if (list.length !== expected.size) {
        errors.push(`${src.law} 条数不符：期望 ${expected.size} 条，实际 ${list.length} 条`)
      }
      for (const n of expected) {
        if (!list.some((r) => r.no === n)) errors.push(`${src.law} 缺少第 ${n} 条`)
      }
    } else {
      const expectStart = list[0].no
      list.forEach((r, i) => {
        if (r.no !== expectStart + i) errors.push(`${src.law} 条号不连续：${r.article}`)
      })
    }
  }

  return errors
}

async function main() {
  const all = []
  for (const src of SOURCES) {
    const raw = await readFile(resolve(RAW, `${src.key}.txt`), 'utf8')
    const records = selectArticles(src, parseSource(src, raw))
    all.push(...records)
    console.log(`${src.law.padEnd(14, '　')} 解析 ${String(records.length).padStart(3)} 条`)
  }

  const errors = validate(all)
  if (errors.length) {
    console.error('\n校验失败：')
    errors.forEach((e) => console.error(' - ' + e))
    process.exit(1)
  }

  // 用 JSON 数组而不是 JSONL：Nitro 打包时无法处理 ?raw 文本导入，
  // 直接 import JSON 才能让服务端产物自包含，评审机器不依赖仓库外的文件路径
  await writeFile(OUT_JSON, JSON.stringify(all, null, 2) + '\n', 'utf8')

  const byTag = {}
  for (const r of all) for (const t of r.tags) byTag[t] = (byTag[t] ?? 0) + 1

  const meta = {
    generatedAt: new Date().toISOString(),
    total: all.length,
    byLaw: SOURCES.map((s) => ({
      law: s.law,
      short: s.short,
      level: s.level,
      effectiveDate: s.effectiveDate,
      count: all.filter((r) => r.law === s.law).length,
      sourceUrl: s.url,
    })),
    byTag,
  }
  await writeFile(OUT_META, JSON.stringify(meta, null, 2) + '\n', 'utf8')

  console.log(`\n总计 ${all.length} 条 -> data/laws.json`)
  console.log('标签分布：' + Object.entries(byTag).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
