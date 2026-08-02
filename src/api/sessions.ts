/*
* 会话 API
* - 会话列表
* - 会话上下文长度
* */
import { request } from './client.ts'

export interface SessionSummary {
  id: string
  profile?: string | null
  source: string
  agent?: string
  agent_mode?: 'global' | 'scoped' | string
  agent_session_id?: string
  agent_native_session_id?: string
  model: string
  provider?: string
  title: string
  preview?: string
  started_at: number
  ended_at: number | null
  last_active?: number
  message_count: number
  tool_call_count: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  reasoning_tokens: number
  billing_provider?: string
  estimated_cost_usd: number
  actual_cost_usd?: number
  cost_status: string
  workspace?: string
  webui_imported?: boolean
}

export interface HermesMessage {
  id: number
  session_id: string
  role: 'user' | 'assistant' | 'system' | 'tool' | 'command'
  content: string
  tool_call_id: string | null
  tool_calls: any[] | null
  tool_name: string | null
  timestamp: number
  token_count: number | null
  finish_reason: string | null
  reasoning: string | null
}

// 获取：会话列表
export async function getSessionsApi(source?: string, limit?: number, profile?: string): Promise<SessionSummary[]> {
  const params = new URLSearchParams()
  if (source) params.set('source', source)
  if (limit) params.set('limit', String(limit))
  if (profile) params.set('profile', profile)
  const query = params.size ? '?' + params.toString() : ''
  const res = await request<{sessions: SessionSummary[]}>(`api/hermes/sessions${query}`, {
    method: 'get'
  })
  return res.sessions
}

// 获取：会话上下文长度
export async function getContextLengthApi(profile?: string, provider?: string, model?: string): Promise<number> {
  const params = new URLSearchParams()
  if (profile) params.set('profile', profile)
  if (provider) params.set('provider', provider)
  if (model) params.set('model', model)
  const query = params.toString()
  const res = await request<{ context_length: number }>(`api/hermes/sessions/context-length${query ? `?${query}` : ''}`)
  return res.context_length
}
