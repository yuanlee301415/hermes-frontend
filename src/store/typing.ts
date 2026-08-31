/*
* Chat store typings
* */

// 压缩状态接口 - 会话上下文压缩的状态追踪
import { Session } from '@/models/Session.ts'

export interface CompressionState {
  // 是否正在压缩中
  compressing: boolean
  // 参与压缩的消息数
  messageCount: number
  // 压缩前的 Token 数
  beforeTokens: number
  // 压缩后的 Token 数
  afterTokens: number
  // 是否成功压缩
  compressed: boolean
  // 压缩错误信息
  error?: string
}

// 中断状态
export type AbortState = {
  // 是否正在中断中
  aborting: boolean
  // 是否已同步到服务器
  synced?: boolean
  // 是否超时
  timedOut?: boolean
  // 消息
  message?: string
  // 错误信息
  error?: string
}

/*
 * 待审批请求接口 - 工具执行权限请求
 * - 当 AI 需要执行敏感操作（如写入内存）时，会向用户发送审批请求
 */
export interface PendingApproval {
  // 会话 ID
  sessionId: Session['id']
  // 审批 ID
  approvalId: string
  // 请求执行的命令
  command: string
  // 请求描述
  description: string
  // 用户可选的审批选项
  choices: Array<'once' | 'session' | 'always' | 'deny'>
  // 是否允许永久授权（always）
  allowPermanent: boolean
  // 是否为内存写入操作
  isMemoryWrite: boolean
  // 请求时间戳
  requestedAt: number
}

/**
 * 待澄清请求接口 - AI 的追问
 * - 当 AI 需要更多信息才能继续回答时，会发送澄清请求
 */
export interface PendingClarify {
  // 会话 ID
  sessionId: Session['id']
  // 澄清请求 ID
  clarifyId: string
  // 追问问题
  question: string
  // 可选答案列表（null 表示自由输入）
  choices: string[] | null
  // 超时时间（毫秒）
  timeoutMs: number
  // 请求时间戳
  requestedAt: number
}
