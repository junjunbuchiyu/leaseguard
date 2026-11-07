/**
 * Agent 轨迹
 *
 * 审查不是一次 prompt 调用，而是「规划 → 调工具 → 观察 → 判定 → 自省 → 复核」的循环。
 * 每一步都产出一条事件，SSE 原样推给前端，用户看到的是 AI 在干活，而不是一个转圈。
 *
 * 事件只描述「做了什么、依据是什么」，不含模型内部思维链（DeepSeek 的 reasoning 内容不对外）。
 */

export type AgentRole = 'planner' | 'retriever' | 'judge' | 'critic' | 'advisor'

export type AgentKind = 'plan' | 'tool' | 'observation' | 'verdict' | 'reflection' | 'final'

export interface AgentEvent {
  /** 全局递增序号，前端按序号排序渲染 */
  seq: number
  /** 相对本次审查开始的毫秒数 */
  at: number
  role: AgentRole
  kind: AgentKind
  title: string
  detail?: string
  tool?: string
  args?: string
  result?: string
  level?: string
  clauseId?: string
}

export interface Trace {
  emit: (event: Omit<AgentEvent, 'seq' | 'at'>) => AgentEvent
  events: AgentEvent[]
  /** 工具调用次数：每次 search_law / calc_penalty / check_citation 都算一次 */
  toolCalls: number
  /** 自省次数：判定后回头补证据的次数 */
  reflections: number
}

export function createTrace(startedAt = Date.now()): Trace {
  const events: AgentEvent[] = []

  const trace: Trace = {
    events,
    toolCalls: 0,
    reflections: 0,
    emit(partial) {
      const event: AgentEvent = {
        ...partial,
        seq: events.length + 1,
        at: Date.now() - startedAt,
      }
      events.push(event)
      return event
    },
  }

  return trace
}

/** 单行摘要，避免把整段法条塞进轨迹把面板撑爆 */
export function clip(text: string, length = 48): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > length ? `${flat.slice(0, length)}…` : flat
}
