import { io, type Socket } from 'socket.io-client'
import { getApiKey, getBaseUrlValue } from '@/api/client.ts'

/**
 * 运行事件接口（来自 /v1/runs/{id}/events 的 SSE 事件类型）
 * 用于实时接收运行过程中的各类事件
 */
export interface RunEvent {
  event: string
  run_id?: string
  delta?: string
  text?: string
  tool?: string
  name?: string
  preview?: string
  timestamp?: null
  error?: string
  output?: string | null
  usage?: {
    input_tokens: number
    output_tokens: number
    tool_tokens: number
  }
  session_id?: string
  title?: string
  queue_length?: number
  dequeued_length?: number
  queued_messages?: Array<{
    id?: string | number
    role?: 'command' | 'user'
    content?: string
    timestamp?: number
    queued?: boolean
  }>
  message?: {
    id?: string | number
    role?: string
    content?: string
    timestamp?: number
    queued?: boolean
  }
}

/**
 * 恢复会话载荷接口
 * 包含恢复会话时需要的所有数据
 */
export interface ResumeSessionPayload {
  session_id: string
  messages: any[]
  messageTotal?: number
  messageLoadedCount?: number
  messagePageLimit?: number
  hasMoreBefore?: boolean
  isWorking: boolean
  isAborting?: boolean
  events: Array<{ event: string; data: RunEvent }>
  inputTokens?: number
  outputTokens?: number
  contextTokens?: number
  queueLength?: number
  queueMessages?: RunEvent['queued_messages']
}

/**
 * 内容块类型联合，支持文本、图片和文件三种类型
 */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; name: string; path: string; media_type: string }
  | { type: 'file'; name: string; path: string; media_type: string }

const DEFAULT_PROFILE_NAME = 'default'

/** 当前的聊天运行 Socket 连接实例 */
let chatRunSocket: Socket | null = null
/** 全局监听器是否已注册 */
let globalListenersRegistered = false
/** 当前 Socket 连接使用的配置文件 */
let chatRunSocketProfile: string | void = void 0

/**
 * 会话事件处理器映射
 * 将 session_id 映射到事件处理函数，用于隔离并发会话流
 */
const sessionEventHandlers = new Map<string, {
  onMessageDelta: (event: RunEvent) => void
  onReasoningDelta: (event: RunEvent) => void
  onThinkingDelta: (event: RunEvent) => void
  onReasoningAvailable: (event: RunEvent) => void
  onToolStarted: (event: RunEvent) => void
  onToolCompleted: (event: RunEvent) => void
  onSubagentEvent?: (event: RunEvent) => void
  onRunStarted: (event: RunEvent) => void
  onRunCompleted: (event: RunEvent) => void
  onRunFailed: (event: RunEvent) => void
  onCompressionStarted: (event: RunEvent) => void
  onCompressionCompleted: (event: RunEvent) => void
  onAbortStarted: (event: RunEvent) => void
  onAbortTimeout?: (event: RunEvent) => void
  onAbortCompleted: (event: RunEvent) => void
  onUsageUpdated: (event: RunEvent) => void
  onAgentEvent?: (event: RunEvent) => void
  onSessionCommand?: (event: RunEvent) => void
  onSessionTitleUpdated?: (event: RunEvent) => void
  onRunQueued?: (event: RunEvent) => void
  onApprovalRequested?: (event: RunEvent) => void
  onApprovalResolved?: (event: RunEvent) => void
  onPeerUserMessage?: (event: RunEvent) => void
  onClarifyRequested?: (event: RunEvent) => void
  onClarifyResolved?: (event: RunEvent) => void
}>()

/**
 * 通过 Socket.IO 恢复会话
 * 获取会话的消息历史、工作状态和事件列表
 * @param sessionId 要恢复的会话 ID
 * @param onResumed 恢复成功后的回调函数
 * @param profile 配置文件名称（可选）
 * @returns Socket 连接实例
 */
export function resumeSession(sessionId: string, onResumed: (data: ResumeSessionPayload) => void, profile?: string): Socket {
  const socket = connectChatRun(profile)

  const handleResumed = (data: ResumeSessionPayload) => {
    if (data?.session_id !== sessionId) return
    removeSocketListener(socket, 'resumed', handleResumed)
    onResumed(data)
  }

  socket.on('resumed', handleResumed)
  socket.emit('resume', { session_id: sessionId, ...(profile ? { profile } : {}) })
  return socket
}

/**
 * 连接到聊天运行的 Socket.IO 服务器
 * 如果已存在有效连接且配置文件匹配，则复用现有连接
 * @param requestedProfile 请求的配置文件名称（可选）
 * @returns Socket 连接实例
 */
export function connectChatRun(requestedProfile?: string): Socket {
  const normalizedRequestedProfile = requestedProfile?.trim()

  if (chatRunSocket?.connected && (!normalizedRequestedProfile || chatRunSocketProfile === normalizedRequestedProfile)) {
    return chatRunSocket
  }

  if (chatRunSocket) {
    chatRunSocket.removeAllListeners()
    chatRunSocket.disconnect()
    globalListenersRegistered = false
    chatRunSocketProfile = void 0
  }

  const url = new URL(getBaseUrlValue(), location.origin + location.pathname)
  const token = getApiKey()

  // Get active profile form store
  let profile = normalizedRequestedProfile || localStorage.getItem('hermes_active_profile_name') || DEFAULT_PROFILE_NAME
  chatRunSocketProfile = profile

  chatRunSocket = io(url + 'chat-run', {
    auth: { token },
    query: { profile },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 1000 * 30,
    randomizationFactor: 0.5,
    timeout: 1000 * 30
  })

  if (!globalListenersRegistered) {
    globalListenersRegistered = true

    // Message events
    chatRunSocket.on('message.delta', globalMessageDeltaHandler)
    chatRunSocket.on('reasoning.delta', globalReasoningDeltaHandler)
    chatRunSocket.on('thinking.delta', globalThinkingDeltaHandler)
    chatRunSocket.on('reasoning.available', globalReasoningAvailableHandler)

    // Tool events
    chatRunSocket.on('tool.started', globalToolStartedHandler)
    chatRunSocket.on('tool.completed', globalToolCompletedHandler)
    chatRunSocket.on('subagent.start', globalSubagentEventHandler)
    chatRunSocket.on('subagent.tool', globalSubagentEventHandler)
    chatRunSocket.on('subagent.progress', globalSubagentEventHandler)
    chatRunSocket.on('subagent.complete', globalSubagentEventHandler)

    // Run lifecycle events
    chatRunSocket.on('run.started', globalRunStartedHandler)
    chatRunSocket.on('run.failed', globalRunFailedHandler)
    chatRunSocket.on('run.completed', globalRunCompletedHandler)
    chatRunSocket.on('run.queued', globalRunQueuedHandler)
    chatRunSocket.on('approval.requested', globalApprovalRequestedHandler)
    chatRunSocket.on('approval.resolved', globalApprovalResolvedHandler)
    chatRunSocket.on('run.peer_user_message', globalPeerUserMessageHandler)
    chatRunSocket.on('clarify.requested', globalClarifyRequestedHandler)
    chatRunSocket.on('clarify.resolved', globalClarifyResolvedHandler)

    // Compression events
    chatRunSocket.on('compression.started', globalCompressionStartedHandler)
    chatRunSocket.on('compression.completed', globalCompressionCompletedHandler)
    chatRunSocket.on('abort.started', globalAbortStartedHandler)
    chatRunSocket.on('abort.timeout', globalAbortTimeoutHandler)
    chatRunSocket.on('abort.completed', globalAbortCompletedHandler)

    // Usage events
    chatRunSocket.on('usage.updated', globalUsageUpdatedHandler)
    chatRunSocket.on('agent.event', globalAgentEventHandler)
    chatRunSocket.on('run.reattach_failed', globalRunReattachFailedHandler)
    chatRunSocket.on('session.command', globalSessionCommandHandler)
    chatRunSocket.on('session.title.updated', globalSessionTitleUpdatedHandler)
  }

  return chatRunSocket
}

/**
 * 通用的 Socket 监听器移除函数
 * 兼容不同版本的 Socket.IO API（off 或 removeListener）
 * @param socket Socket 实例
 * @param event 事件名称
 * @param handler 事件处理函数
 */
function removeSocketListener(socket: Socket, event: string, handler: (...args: any[]) => void): void {
  const candidate = socket as Socket & {
    off?: (event: string, handler: (...args: any[]) => void) => Socket
    removeListener?: (event: string, handler: (...args: any[]) => void) => Socket
  }
  if (typeof candidate.off === 'function') {
    candidate.off(event, handler)
    return
  }

  candidate.removeListener?.(event, handler)
}


/**
 * 全局 message.delta 事件处理器
 * 根据 session_id 将事件分发到相应的会话处理器
 */
function globalMessageDeltaHandler(event: RunEvent): void {
  const sid = event.session_id
  if (!sid) return
  const handlers = sessionEventHandlers.get(sid)
  console.log('globalMessageDeltaHandler:', {sid, handlers})
  handlers?.onMessageDelta?.(event)
}

function globalReasoningDeltaHandler() {
  console.error('Todo:globalReasoningDeltaHandler')
}

function globalThinkingDeltaHandler() {
  console.error('Todo:globalThinkingDeltaHandler')
}

function globalReasoningAvailableHandler() {
  console.error('Todo:globalReasoningAvailableHandler')
}

function globalToolStartedHandler() {
  console.error('Todo:globalToolStartedHandler')
}

function globalToolCompletedHandler() {
  console.error('Todo:globalToolCompletedHandler')
}

function globalSubagentEventHandler() {
  console.error('Todo:globalSubagentEventHandler')
}

function globalRunStartedHandler() {
  console.error('Todo:globalRunStartedHandler')
}

function globalRunFailedHandler() {
  console.error('Todo:globalRunFailedHandler')
}

function globalRunCompletedHandler() {
  console.error('Todo:globalRunCompletedHandler')
}

function globalRunQueuedHandler() {
  console.error('Todo:globalRunQueuedHandler')
}

function globalApprovalRequestedHandler() {
  console.error('Todo:globalApprovalRequestedHandler')
}

function globalApprovalResolvedHandler() {
  console.error('Todo:globalApprovalResolvedHandler')
}

function globalPeerUserMessageHandler() {
  console.error('Todo:globalPeerUserMessageHandler')
}

function globalClarifyRequestedHandler() {
  console.error('Todo:globalClarifyRequestedHandler')
}

function globalClarifyResolvedHandler() {
  console.error('Todo:globalClarifyResolvedHandler')
}

function globalCompressionStartedHandler() {
  console.error('Todo:globalCompressionStartedHandler')
}

function globalCompressionCompletedHandler() {
  console.error('Todo:globalCompressionCompletedHandler')
}

function globalAbortStartedHandler() {
  console.error('Todo:globalAbortStartedHandler')
}

function globalAbortTimeoutHandler() {
  console.error('Todo:globalAbortTimeoutHandler')
}

function globalAbortCompletedHandler() {
  console.error('Todo:globalAbortCompletedHandler')
}

function globalUsageUpdatedHandler() {
  console.error('Todo:globalUsageUpdatedHandler')
}

function globalAgentEventHandler() {
  console.error('Todo:globalAgentEventHandler')
}

function globalRunReattachFailedHandler() {
  console.error('Todo:globalRunReattachFailedHandler')
}

function globalSessionCommandHandler() {
  console.error('Todo:globalSessionCommandHandler')
}

function globalSessionTitleUpdatedHandler() {
  console.error('Todo:globalSessionTitleUpdatedHandler')
}
