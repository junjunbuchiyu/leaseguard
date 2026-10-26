/**
 * GET /api/audit/recent
 *
 * 首页「最近审查」列表。只存在于进程内存，服务重启即清空——
 * 这与「原始合同不落盘」的隐私承诺一致。
 */
import { listDocs } from '~~/server/utils/docStore'

export default defineEventHandler(() => {
  const items = listDocs(5)
  return { items }
})
