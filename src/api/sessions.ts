/*
* 会话 API
* - 会话列表
* - 会话上下文长度
* */
import { request, getBaseUrlValue, getApiKey } from './client.ts'
import type { Session } from '@/models/Session.ts'

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

export interface BatchDeleteSessionTarget {
  id: string
  profile?: string | null
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

/**
 * 重命名会话
 * @param sid 会话 ID
 * @param title 会话标题
 */
export async function renameSessionApi(sid: Session['id'], title: string) {
  try {
    await request(`api/hermes/sessions/${sid}/rename`, {
      method: 'post',
      body: JSON.stringify({ title })
    })
    return true
  } catch {
    return false
  }
}

/**
 * 设置工作区
 * @param sid 会话 ID
 * @param workspace 工作区
 */
export async function setSessionWorkspaceApi (sid: Session['id'], workspace: string): Promise<boolean> {
  try {
    await request(`api/hermes/sessions/${sid}/workspace`, {
      method: 'post',
      body: JSON.stringify({ workspace: workspace }),
    })
    return true
  } catch {
    return false
  }
}

/**
 * 导出会话
 * @param id 会话 ID
 * @param mode 模式（全量/压缩）
 * @param ext 导出文件格式（.json/.txt）
 */
export async function exportSessionApi (id: string, mode: 'full' | 'compressed' = 'full', ext: 'json' | 'txt' = 'json'): Promise<void> {
  const baseUrl = getBaseUrlValue()
  const token = getApiKey()
  const url = `${baseUrl}/api/hermes/sessions/${id}/export?mode=${mode}&ext=${ext}&token=${encodeURIComponent(token)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Export failed')
  const blob = await res.blob()
  const contentDisposition = res.headers.get('Content-Disposition') || ''
  let filename = `session_${id}.${ext}`
  const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?([^;\n]+)/i)
  if (match) filename = decodeURIComponent(match[1].replace(/"/g, ''))
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

/**
 * 批量删除会话
 * @param targets
 */
export async function batchDeleteSessions(targets: Array<string | BatchDeleteSessionTarget>): Promise<{ deleted: number; failed: number; errors: Array<{ id: string; error: string }> }> {
  try {
    const sessions = targets.map(target =>
      typeof target === 'string'
        ? { id: target }
        : { id: target.id, profile: target.profile || undefined },
    )
    return await request<{ deleted: number; failed: number; errors: Array<{ id: string; error: string }> }>(
      'api/hermes/sessions/batch-delete',
      {
        method: 'POST',
        body: JSON.stringify({
          ids: sessions.map(session => session.id),
          sessions,
        }),
      }
    )
  } catch (err: any) {
    throw err
  }
}

/**
 * 删除会话
 * @param id 会话 Id
 * @param profile
 */
export async function deleteSessionApi(id: Session['id'], profile?: string | null): Promise<boolean> {
  try {
    const params = new URLSearchParams()
    if (profile) params.set('profile', profile)
    const query = params.toString()
    await request(`api/hermes/sessions/${id}${query ? `?${query}` : ''}`, { method: 'DELETE' })
    return true
  } catch {
    return false
  }
}
