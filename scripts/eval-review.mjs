/**
 * 审查质量评估：用 5 份样张的预埋问题算召回率与误报率
 *
 * 用法：先 npm run dev，再 node scripts/eval-review.mjs
 *
 * 口径：
 *  - 召回：预埋为 high/medium 的条款，被标为 high/medium 即算命中
 *  - 误报：预埋清单之外的条款被判成 high（low 不追究，避免把"保守"当错误）
 */
import { readFileSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://[::1]:3000'
const manifest = JSON.parse(
  readFileSync(new URL('../data/samples/expected.json', import.meta.url), 'utf8'),
)

const lines = []
let totalExpected = 0
let totalHit = 0
let totalFalse = 0

for (const sample of manifest.samples) {
  const text = readFileSync(new URL(`../data/samples/${sample.file}`, import.meta.url), 'utf8')

  const parsed = await fetch(`${BASE}/api/audit/parse`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  }).then((res) => res.json())

  const reviewed = await fetch(`${BASE}/api/audit/review`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ docId: parsed.docId }),
  }).then((res) => res.json())

  const riskByNo = new Map(reviewed.risks.filter((r) => r.clauseNo).map((r) => [r.clauseNo, r]))
  const expected = sample.pitfalls.filter((p) => p.level !== 'low')
  const expectedNos = new Set(expected.map((p) => p.no))

  const hits = expected.filter((p) => {
    const risk = riskByNo.get(p.no)
    return risk && (risk.level === 'high' || risk.level === 'medium')
  })

  const falsePositives = reviewed.risks.filter(
    (r) => r.level === 'high' && r.clauseNo && !expectedNos.has(r.clauseNo),
  )

  totalExpected += expected.length
  totalHit += hits.length
  totalFalse += falsePositives.length

  lines.push(
    `[${sample.id}] 得分 ${reviewed.score} · ` +
      `高${reviewed.stats.high} 中${reviewed.stats.medium} 低${reviewed.stats.low} 正常${reviewed.stats.ok} · ` +
      `召回 ${hits.length}/${expected.length} · 误报 ${falsePositives.length} · ` +
      `${(reviewed.tookMs / 1000).toFixed(1)}s/${reviewed.calls}次调用`,
  )

  const missed = expected.filter((p) => !hits.some((h) => h.no === p.no))
  if (missed.length) lines.push(`   漏判：${missed.map((p) => `${p.no}(${p.level})`).join('、')}`)
  if (falsePositives.length) {
    lines.push(`   误报：${falsePositives.map((r) => `${r.clauseNo}「${r.title}」`).join('、')}`)
  }

  // 引用必须能溯源：每条 basis 都要能在原文里找到 quote
  const badRefs = reviewed.risks
    .flatMap((r) => r.basis.map((b) => ({ risk: r, basis: b })))
    .filter((item) => item.basis.quote.length < 6)
  if (badRefs.length) lines.push(`   引用异常 ${badRefs.length} 条（quote 过短）`)
}

const recall = ((totalHit / Math.max(totalExpected, 1)) * 100).toFixed(0)
lines.push('')
lines.push(`合计：召回 ${totalHit}/${totalExpected}（${recall}%）· 高风险误报 ${totalFalse} 条`)

console.log(lines.join('\n'))
process.exit(Number(recall) >= 70 && totalFalse <= 5 ? 0 : 1)
