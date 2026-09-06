import { request } from './client.ts'
import type { SessionCodingAgentId } from '@/models/Session.ts'

export interface CodingAgentToolStatus {
  id: SessionCodingAgentId
  name: string
  provider: string
  command: string
  packageName: string
  installed: boolean
  version: string
  rawVersion: string
  error?: string
}

export interface CodingAgentsStatus {
  tools: CodingAgentToolStatus[]
}

// 获取编码 Agents 状态
export async function getCodingAgentsStatusApi(): Promise<CodingAgentsStatus> {
  return request<CodingAgentsStatus>('api/coding-agents', {
    method: 'get'
  })
}
