/**
 * 检索质量评估：用 10 条口语化查询检验 top-1 / top-5 命中率
 *
 * 用法：先 npm run dev，再 node scripts/eval-retrieval.mjs
 * 说明：期望值写在 data/retrieval-cases.json，命中所列任意一条即算对
 */
import { readFileSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://[::1]:3000'
const { cases } = JSON.parse(
  readFileSync(new URL('../data/retrieval-cases.json', import.meta.url), 'utf8'),
)

let top1 = 0
let top5 = 0
const lines = []

for (const item of cases) {
  const res = await fetch(
    `${BASE}/api/law/search?q=${encodeURIComponent(item.query)}&topK=5`,
  )
  const data = await res.json()
  const ids = data.items.map((hit) => hit.id)

  const at1 = item.expect.includes(ids[0])
  const at5 = ids.some((id) => item.expect.includes(id))
  if (at1) top1 += 1
  if (at5) top5 += 1

  lines.push(
    `${at1 ? '✓' : at5 ? '~' : '✗'} ${item.query.padEnd(10, '　')} ` +
      `→ ${ids.join(' ')}  (${data.tookMs}ms)`,
  )
}

lines.push('')
lines.push(`Top-1 命中 ${top1}/${cases.length} · Top-5 命中 ${top5}/${cases.length}`)

console.log(lines.join('\n'))
process.exit(top5 === cases.length ? 0 : 1)
