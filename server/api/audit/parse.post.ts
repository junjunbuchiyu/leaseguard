/**
 * POST /api/audit/parse
 *
 * 一次性返回解析结果（脚本与测试用这个）。
 * 需要看到每个阶段的过程，用 /api/audit/parse/stream。
 */
import { collectInput, runIngest } from '~~/server/utils/ingest'

export default defineEventHandler(async (event) => {
  const input = await collectInput(event)
  return runIngest(input)
})
