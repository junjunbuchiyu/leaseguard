import { searchLaws } from '~~/server/utils/lawIndex'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const q = String(query.q ?? '').slice(0, 200)

  const topK = Math.min(Math.max(Number(query.topK ?? 5) || 5, 1), 20)
  const tags = query.tags ? String(query.tags).split(',').filter(Boolean) : undefined

  const started = performance.now()
  const items = searchLaws(q, { topK, tags })

  return {
    query: q,
    tookMs: Math.round(performance.now() - started),
    items,
  }
})
