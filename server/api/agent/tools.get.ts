/**
 * GET /api/agent/tools
 *
 * Agent 可调用的工具清单。放在接口上而不是写死在页面里，
 * 是为了让「文档 / 页面 / MCP」三处永远说的是同一批工具。
 */
import { listTools } from '~~/server/utils/agent/tools'

export default defineEventHandler(() => {
  const tools = listTools().map((tool) => ({
    ...tool,
    /** 与 MCP server 暴露的同名工具一一对应 */
    mcp: true,
  }))

  return { total: tools.length, tools }
})
