/**
 * 会话级合同暂存
 *
 * 为什么用内存 Map 而不是数据库：
 *  - 原始合同属于高度敏感数据，MVP 阶段不应该落盘；
 *  - 单人维护成本最低，重启即清空，天然满足"不持久化"的隐私要求；
 *  - 后续要接持久化时，只需替换这层实现。
 */

export interface DocRecord {
  id: string
  createdAt: number
  /** 脱敏后的正文，客户端可见 */
  text: string
  /** 占位符 -> 原文，仅服务端可见 */
  vault: Record<string, string>
  source: 'pdf-text' | 'vision' | 'paste'
  pages?: number
  counts: Record<string, number>
  chars: number
}

const TTL = 2 * 60 * 60 * 1000
const MAX_DOCS = 20

const docs = new Map<string, DocRecord>()

function prune() {
  const now = Date.now()
  for (const [id, doc] of docs) {
    if (now - doc.createdAt > TTL) docs.delete(id)
  }
  // 超出容量时删最旧的
  while (docs.size > MAX_DOCS) {
    const oldest = [...docs.values()].sort((a, b) => a.createdAt - b.createdAt)[0]
    if (!oldest) break
    docs.delete(oldest.id)
  }
}

export function putDoc(record: Omit<DocRecord, 'id' | 'createdAt'>): DocRecord {
  prune()
  const doc: DocRecord = {
    ...record,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  }
  docs.set(doc.id, doc)
  return doc
}

export function getDoc(id: string): DocRecord | undefined {
  prune()
  return docs.get(id)
}
