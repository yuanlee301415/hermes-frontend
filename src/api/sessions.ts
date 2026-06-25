import { request } from './request.ts'

export interface SessionSummary {
  id: string
  title: string
  started_at: number
  ended_at: number
  profile?: string
  agent?: string
  model?: string
  provider?: string
  last_active?: number
}

export async function getSessionsApi(): Promise<SessionSummary[]> {
  const res = await request<{sessions: SessionSummary[]}>('api/hermes/sessions', {
    method: 'get'
  })
  return res.sessions
}
