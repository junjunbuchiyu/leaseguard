/**
 * 本地 PII 脱敏
 *
 * 原则：
 *  - 在文本送往任何模型之前完成，映射表只留内存，不落库、不返回客户端
 *  - 规则顺序固定：身份证 -> 银行卡 -> 手机号 -> 邮箱 -> 门牌号
 *    （身份证是 18 位数字，必须先于 16–19 位的银行卡规则，否则会被抢走）
 *  - 宁可漏掉姓名，也不误伤合同正文：姓名识别需要 NER，正则做不准
 */

export interface PiiRule {
  name: string
  pattern: RegExp
}

export const PII_RULES: PiiRule[] = [
  { name: '身份证', pattern: /(?<!\d)(?:\d{17}[\dXx]|\d{15})(?!\d)/g },
  { name: '银行卡', pattern: /(?<!\d)\d{16,19}(?!\d)/g },
  { name: '手机号', pattern: /(?<!\d)1[3-9]\d{9}(?!\d)/g },
  { name: '邮箱', pattern: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
  {
    name: '门牌号',
    // 至少命中两个「楼/栋/单元/层/室/户」片段才算地址，避免把「3室2厅」当门牌
    pattern: /(?:[\u4e00-\u9fa5A-Za-z0-9]{1,12}(?:路|街|道|巷|弄|大道))?(?:\d{1,4}(?:号楼|栋|单元|层|室|户)){2,}/g,
  },
]

export interface RedactResult {
  /** 脱敏后的文本，可安全展示与发送 */
  text: string
  /** 各类型命中数量，用于 UI 展示「已遮盖 N 处」 */
  counts: Record<string, number>
  total: number
  /** 占位符 -> 原文，仅保存在服务端内存 */
  vault: Record<string, string>
}

export function redactPii(input: string): RedactResult {
  let text = input
  const counts: Record<string, number> = {}
  const vault: Record<string, string> = {}

  for (const rule of PII_RULES) {
    let index = 0
    text = text.replace(rule.pattern, (match) => {
      index += 1
      const token = `【${rule.name}${index}】`
      vault[token] = match
      counts[rule.name] = (counts[rule.name] ?? 0) + 1
      return token
    })
  }

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
  return { text, counts, total, vault }
}

/** 报告导出时按需还原（默认不还原，避免把 PII 写进 PDF） */
export function restorePii(text: string, vault: Record<string, string>): string {
  return text.replace(/【(身份证|银行卡|手机号|邮箱|门牌号)(\d+)】/g, (token) => vault[token] ?? token)
}
