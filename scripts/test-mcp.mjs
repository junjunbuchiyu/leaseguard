/**
 * MCP Server 冒烟测试：用官方客户端连上去，列出工具并逐个调用
 *
 * 用法：node scripts/test-mcp.mjs
 * 相当于把 `npx @modelcontextprotocol/inspector` 的验证自动化了一遍
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(root, 'node_modules/tsx/dist/cli.mjs'), path.join(root, 'mcp/server.ts')],
  cwd: root,
})

const client = new Client({ name: 'leaseguard-smoke', version: '1.0.0' })
await client.connect(transport)

const { tools } = await client.listTools()
const lines = [`工具 ${tools.length} 个：${tools.map((tool) => tool.name).join(', ')}`, '']

const calls = [
  { name: 'search_law', arguments: { query: '押金不退', topK: 2 } },
  { name: 'calc_penalty', arguments: { monthlyRent: 4800, months: 2, actualLoss: 3000 } },
  { name: 'redact_pii', arguments: { text: '甲方张三，身份证 110101199001011234，电话 13800138000' } },
  { name: 'law_stats', arguments: {} },
]

for (const call of calls) {
  const result = await client.callTool(call)
  const text = result.content?.[0]?.text ?? ''
  lines.push(`=== ${call.name} ===`)
  lines.push(text.length > 700 ? `${text.slice(0, 700)}\n…（截断）` : text)
  lines.push('')
}

await client.close()

writeFileSync(path.join(root, '../_research/d7-mcp.txt'), lines.join('\n'), 'utf8')
console.log(`ok tools=${tools.length}`)
