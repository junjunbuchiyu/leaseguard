/**
 * LeaseGuard MCP Server（stdio）
 *
 * 把应用里的三个能力暴露成标准 MCP 工具，任何支持 MCP 的客户端都能调用：
 *   - search_law    检索本地法规库（116 条），给结论提供可溯源依据
 *   - calc_penalty  按租金月数折算违约金/押金，并判断是否明显偏高
 *   - redact_pii    本地脱敏，返回遮盖后的文本与统计
 *
 * 运行：npm run mcp        （tsx 直接执行 TypeScript，复用 server/utils 的实现，不复制逻辑）
 * 调试：npx @modelcontextprotocol/inspector node node_modules/tsx/dist/cli.mjs mcp/server.ts
 *
 * 注意：stdio 传输下 stdout 属于协议通道，日志一律走 stderr。
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { listLaws, searchLaws } from '../server/utils/lawIndex'
import { redactPii } from '../server/utils/redact'

const server = new McpServer({ name: 'leaseguard', version: '1.0.0' })

server.registerTool(
  'search_law',
  {
    title: '检索住房租赁法规',
    description:
      '用自然语言检索本地法规库（民法典租赁合同章、住房租赁条例、商品房屋租赁管理办法），返回条号、原文与官方链接。用于给合同风险结论提供可溯源依据。',
    inputSchema: {
      query: z.string().describe('查询语句，例如「押金不退」「房东随时进门」'),
      topK: z.number().int().min(1).max(10).optional().describe('返回条数，默认 5'),
    },
  },
  async ({ query, topK }) => {
    const hits = searchLaws(query, { topK: topK ?? 5 })
    const payload = hits.map((hit) => ({
      id: hit.id,
      law: hit.short,
      article: hit.article,
      text: hit.text,
      tags: hit.tags,
      score: Number(hit.score.toFixed(3)),
      sourceUrl: hit.sourceUrl,
    }))

    return {
      content: [
        {
          type: 'text',
          text: payload.length
            ? JSON.stringify(payload, null, 2)
            : `未检索到与「${query}」相关的条文，请换一种说法。`,
        },
      ],
    }
  },
)

server.registerTool(
  'calc_penalty',
  {
    title: '折算违约金或押金',
    description:
      '把「几个月租金」折算成金额，并对照实际损失判断是否明显偏高（司法实践常以超过损失 30% 作为调整参考）。',
    inputSchema: {
      monthlyRent: z.number().positive().describe('月租金（元）'),
      months: z.number().positive().describe('相当于几个月租金'),
      actualLoss: z.number().nonnegative().optional().describe('实际损失（元），可选'),
    },
  },
  async ({ monthlyRent, months, actualLoss }) => {
    const amount = Math.round(monthlyRent * months)
    const lines = [
      `月租金：${monthlyRent} 元`,
      `折算：${months} 个月 = ${amount} 元（约占年租金的 ${((amount / (monthlyRent * 12)) * 100).toFixed(1)}%）`,
    ]

    if (actualLoss !== undefined) {
      const ratio = actualLoss > 0 ? amount / actualLoss : Infinity
      lines.push(`对比实际损失：${actualLoss} 元，为损失的 ${ratio === Infinity ? '∞' : ratio.toFixed(2)} 倍`)
      lines.push(
        ratio > 1.3
          ? '提示：明显高于实际损失，可能被认定为「过分高于造成的损失」，可请求适当减少（《民法典》第五百八十五条）。'
          : '提示：与实际损失大致相当，一般不会被调整。',
      )
    } else {
      lines.push('提示：未提供实际损失，无法判断是否过高；超过 2 个月租金的违约金在租赁纠纷中较易被主张调整。')
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] }
  },
)

server.registerTool(
  'redact_pii',
  {
    title: '本地脱敏',
    description:
      '在文本送往模型之前遮盖身份证号、银行卡号、手机号、邮箱与门牌号，返回脱敏文本与各类命中数量（不返回原文映射）。',
    inputSchema: {
      text: z.string().min(1).describe('待脱敏的合同文本'),
    },
  },
  async ({ text }) => {
    const result = redactPii(text)
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { text: result.text, counts: result.counts, total: result.total },
            null,
            2,
          ),
        },
      ],
    }
  },
)

server.registerTool(
  'law_stats',
  {
    title: '法规库概况',
    description: '返回本地法规库收录的法规清单与条数，用于确认检索范围。',
    inputSchema: {},
  },
  async () => {
    const meta = listLaws()
    return { content: [{ type: 'text', text: JSON.stringify(meta, null, 2) }] }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('[leaseguard-mcp] ready on stdio')
