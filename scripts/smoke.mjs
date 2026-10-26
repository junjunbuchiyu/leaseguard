/**
 * 端到端冒烟测试：跑一遍 5 份样张，检查切分与分类的基本不变量
 *
 * 用法：
 *   1. 另开一个终端 npm run dev
 *   2. node scripts/smoke.mjs
 *
 * 检查项：
 *   - 每条条款的 start/end 能精确切出整段文本（偏移量可信）
 *   - 条款之间不重叠、不丢字
 *   - 标签必须落在 data/clause-tags.json 的枚举内
 *   - 样张里的预埋条款号都能被切出来
 */
import { readFileSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const taxonomy = JSON.parse(readFileSync(new URL('../data/clause-tags.json', import.meta.url), 'utf8'))
const manifest = JSON.parse(readFileSync(new URL('../data/samples/expected.json', import.meta.url), 'utf8'))
const VALID_TAGS = new Set(taxonomy.tags)

let failures = 0
const lines = []

function check(condition, message) {
  if (!condition) {
    failures += 1
    lines.push(`  ✗ ${message}`)
  }
}

for (const sample of manifest.samples) {
  const text = readFileSync(new URL(`../data/samples/${sample.file}`, import.meta.url), 'utf8')
  const res = await fetch(`${BASE}/api/audit/parse`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  if (!res.ok) {
    failures += 1
    lines.push(`[${sample.id}] HTTP ${res.status}`)
    continue
  }

  const data = await res.json()
  const clauses = data.clauses ?? []

  const tagCount = {}
  for (const clause of clauses) {
    tagCount[clause.tag] = (tagCount[clause.tag] ?? 0) + 1
    check(VALID_TAGS.has(clause.tag), `${sample.id} 非法标签 ${clause.tag}`)
    check(data.text.slice(clause.start, clause.end) === clause.text, `${sample.id} ${clause.id} 偏移量不匹配`)
    check(clause.chars === clause.text.length, `${sample.id} ${clause.id} chars 字段与正文长度不一致`)
  }

  for (let i = 1; i < clauses.length; i++) {
    check(clauses[i].start >= clauses[i - 1].end, `${sample.id} ${clauses[i].id} 与前一条重叠`)
  }

  const numbers = new Set(clauses.map((clause) => clause.no).filter(Boolean))
  const missed = sample.pitfalls.filter((pitfall) => !numbers.has(pitfall.no))

  lines.push(
    `[${sample.id}] ${sample.title.padEnd(8, '　')} 条款 ${String(clauses.length).padStart(2)} · ` +
      `切分 ${data.strategy} · 标签 ${Object.entries(tagCount).map(([k, v]) => `${k}${v}`).join(' ')}`,
  )
  if (missed.length) {
    lines.push(`  未切出预埋条款：${missed.map((p) => p.no).join('、')}`)
    failures += missed.length
  }
}

lines.push('')
lines.push(failures === 0 ? 'PASS 全部检查通过' : `FAIL ${failures} 项未通过`)

console.log(lines.join('\n'))
process.exit(failures === 0 ? 0 : 1)
