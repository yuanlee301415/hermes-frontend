import { io, type Socket } from 'socket.io-client'
import type { HermesMessage } from '@/api/sessions.ts'
import { ACTIVE_PROFILE_NAME_KEY } from '@/constants/storage-keys.ts'
import { DEFAULT_PROFILE_NAME } from '@/constants/hardcoded.ts'
import { getApiKey, getBaseUrlValue } from '@/api/client.ts'


// Socket 接收的服务端事件
export interface ServerEvents {
  'message.delta': (event: RunEvent) => void
  'reasoning.delta': (event: RunEvent) => void
  'thinking.delta': (event: RunEvent) => void
  'reasoning.available': (event: RunEvent) => void
  'tool.started': (event: RunEvent) => void
  'tool.completed': (event: RunEvent) => void
  'subagent.start': (event: RunEvent) => void
  'subagent.tool': (event: RunEvent) => void
  'subagent.progress': (event: RunEvent) => void
  'subagent.complete': (event: RunEvent) => void
  'run.started': (event: RunEvent) => void
  'run.failed': (event: RunEvent) => void
  'run.completed': (event: RunEvent) => void
  'run.queued': (event: RunEvent) => void
  'approval.requested': (event: RunEvent) => void
  'approval.resolved': (event: RunEvent) => void
  'run.peer_user_message': (event: RunEvent) => void
  'clarify.requested': (event: RunEvent) => void
  'clarify.resolved': (event: RunEvent) => void
  'compression.started': (event: RunEvent) => void
  'compression.completed': (event: RunEvent) => void
  'abort.started': (event: RunEvent) => void
  'abort.timeout': (event: RunEvent) => void
  'abort.completed': (event: RunEvent) => void
  'usage.updated': (event: RunEvent) => void
  'agent.event': (event: RunEvent) => void
  'run.reattach_failed': (event: RunEvent) => void
  'session.command': (event: RunEvent) => void
  'session.title.updated': (event: RunEvent) => void
  'resumed': (event: ResumeSessionPayload) => void
}

// Socket 发送的客户端事件
export interface ClientEvents {
  'run': (data: any) => void
  'abort': (data: any) => void,
  'resume': (data: any) => void
  'connect_error': (data: any) => void
  'disconnect': () => void
  'connect': () => void
}

export type PeerMessage = {
  id?: string | number
  role?: string
  content?: string
  timestamp?: number
  queued?: boolean
}

/*
 * 用于实时接收运行过程中的各类事件
 */
export interface RunEvent {
  /** 事件类型名称 */
  event: keyof ServerEvents
  /** 运行 ID */
  run_id?: string
  /** 增量内容 */
  delta?: string
  /** `reasoning.delta` / `thinking.delta` / `reasoning.available` 事件的文本载荷 */
  text?: string
  /** 工具名称 */
  tool?: string
  /** 名称字段 */
  name?: string
  /** 预览内容 */
  preview?: string
  /** 时间戳 */
  timestamp?: number
  /** 错误信息 */
  error?: string
  /**
   * `run.completed` 事件的最终响应文本
   * 如果代理静默吞掉了上游错误，可能为空或 null，需查看聊天存储作为回退
   */
  output?: string | null
  /** Token 使用统计 */
  usage?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
  /** 服务器添加的 session_id 标签，用于客户端过滤 */
  session_id?: string
  /** 从 session.title.updated 事件生成的会话标题 */
  title?: string
  /** `run.queued` 事件中的队列长度 */
  queue_length?: number
  /** 刚刚移除的队列项（因为它正在启动） */
  dequeued_queue_id?: string
  /** 来自 run.queued/resume 载荷的排队用户消息 */
  queued_messages?: Array<{
    id?: string | number
    role?: string
    content?: string
    timestamp?: number
    queued?: boolean
  }>
  /** 广播给其他正在观看同一会话的窗口的用户消息 */
  message?: PeerMessage | string
  command: 'clear'
  action?: 'clear' | 'title' | 'usage' | 'destroy',
  started?: boolean
  terminal?: boolean
  clearHistory?: boolean
  ok?: boolean
  inputTokens?: number
  outputTokens?: number
  contextTokens?: number
  beforeTokens?: number
  afterTokens?: number
  message_count?: number
  token_count?: number
  parsed_content?: string
  queue_remaining?: number
  totalMessages?: number
  message_conunt?: number
  parsed_reasoning?: string
  compressed?: boolean
  synced?: boolean
  // 澄清请求ID
  clarify_id?: string
  // AI 追问问题
  question?: string
  // 澄清或审批时，用户可选的选项
  choices?: string[]
  // 超时时间（毫秒）
  timeout_ms?: number

  // 审批请求ID
  approval_id?: string
  // 审批描述
  description?: string
  // 允许永久生效
  allow_permanent?: boolean

  // 工具调用 ID
  tool_call_id?: string
  // 工具调用时长
  duration?: number
  // 工具参数
  arguments: unknown
}

/**
 * 恢复会话载荷接口
 * 包含恢复会话时需要的所有数据
 */
export interface ResumeSessionPayload {
  session_id: string
  messages: HermesMessage[]
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


/**
 * 启动运行请求接口
 * 用于向 Hermes 后端发起新的聊天运行
 */
export interface StartRunRequest {
  /** 用户输入内容，支持文本或内容块数组 */
  input: string | ContentBlock[]
  /** 可选的指令覆盖 */
  instructions?: string
  /** 会话 ID，用于关联同一会话的多次运行 */
  session_id?: string
  /** 使用的配置文件名称 */
  profile?: string
  /** 指定使用的模型 */
  model?: string
  /** 指定使用的服务提供商 */
  provider?: string
  /** 模型组配置，用于选择多个提供商的模型 */
  model_groups?: Array<{ provider: string; models: string[] }>
  /** 队列 ID，用于消息排队 */
  queue_id?: string
  /** 请求来源：API服务器、命令行或编码代理 */
  source?: 'api_server' | 'cli' | 'coding_agent'
  /** 编码代理 ID */
  coding_agent_id?: 'claude-code' | 'codex' | 'hermes' | 'claude'
  /** 代理 ID */
  agent_id?: 'claude-code' | 'codex'
  /** 运行模式：作用域模式或全局模式 */
  mode?: 'scoped' | 'global'
  /** 工作空间路径，可为空 */
  workspace?: string | null
  /** 基础 URL（驼峰命名） */
  baseUrl?: string
  /** 基础 URL（下划线命名） */
  base_url?: string
  /** API 密钥（驼峰命名） */
  apiKey?: string
  /** API 密钥（下划线命名） */
  api_key?: string
  /** API 模式：聊天补全、代码响应或 Anthropic 消息格式 */
  apiMode?: 'chat_completions' | 'codex_responses' | 'anthropic_messages'
  /** API 模式（下划线命名） */
  api_mode?: 'chat_completions' | 'codex_responses' | 'anthropic_messages'
  /**
   * 每会话推理努力级别覆盖
   * 为空或未定义时使用 config.yaml 中的默认值
   */
  reasoning_effort?: string
}


// ============================
// Socket.IO 聊天运行连接管理
// ============================
/**
 * 临时断开连接的原因集合
 * 这些原因导致的断开会自动重连，不会触发错误
 */
const TRANSIENT_DISCONNECT_REASONS = new Set<string>([
  'transport close',
  'transport error',
  'ping timeout',
])

/*
 * 会话事件处理器映射
 * - 将 session_id 映射到事件处理函数，用于隔离并发会话流
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

/** 全局会话命令处理器集合 */
const sessionCommandHandlers = new Set<(event: RunEvent) => void>()

/** 全局会话标题更新处理器集合 */
const sessionTitleUpdatedHandlers = new Set<(event: RunEvent) => void>()

/** 全局对等用户消息处理器集合 */
const peerUserMessageHandlers = new Set<(event: RunEvent) => void>()

// 当前的聊天运行 Socket 连接实例
let chatRunSocket: Socket | null = null

// 全局监听器是否已注册
let globalListenersRegistered = false

// 当前 Socket 连接使用的配置文件
let chatRunSocketProfile: string | void = void 0


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
  let profile = normalizedRequestedProfile || localStorage.getItem(ACTIVE_PROFILE_NAME_KEY) || DEFAULT_PROFILE_NAME
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
 * 获取当前的聊天运行 Socket 连接实例
 * @returns Socket 连接实例或 null
 */
export function getChatRunSocket(): Socket | null {
  return chatRunSocket
}

/**
 * 通过 Socket.IO 启动聊天运行并流式接收事件
 * 返回一个兼容 AbortController 的取消句柄
 * @param body 启动运行请求参数
 * @param onEvent 事件回调函数，接收运行过程中的所有事件
 * @param onDone 运行完成回调函数
 * @param onError 错误回调函数
 * @param onStarted 运行开始回调函数（可选）
 * @param options 可选配置，包含重连恢复回调
 * @returns 包含 abort 方法的对象，用于取消运行
 */
export function startRunViaSocket(
  body: StartRunRequest,
  onEvent: (event: RunEvent) => void,
  onDone: () => void,
  onError: (err: Error) => void,
  onStarted?: (runId: string) => void,
  options?: {
    onReconnectResume?: (data: ResumeSessionPayload) => void
  }
): { abort: () => void } {
  const sid = body.session_id
  if (!sid) throw new Error(`session_id is required for startRunViaSocket`)

  const socket = connectChatRun(body.profile)
  let closed = false

  // 如果该会话已有处理器（可能是恢复的会话），直接发送运行请求
  if (sessionEventHandlers.has(sid)) {
    socket.emit('run', body)
    return {
      abort: () => {
        if (!closed) {
          socket.emit('abort', { session_id: sid })
        }
      }
    }
  }

  // 跟踪临时断开状态
  let sawTransientDisconnect = false

  // 终端 Socket 监听器清理函数
  let removeTerminalSocketListeners: () => void = () => {}

  // 重连恢复处理器
  let reconnectResumeHandler: ((data: ResumeSessionPayload) => void) | null = null

  /** 清除重连恢复处理器 */
  const clearReconnectResumeHandler = () => {
    if (!reconnectResumeHandler) return
    removeSocketListener(socket, 'resumed', reconnectResumeHandler)
    reconnectResumeHandler = null
  }

  /** 触发重连恢复流程 */
  const emitReconnectResume = () => {
    clearReconnectResumeHandler()
    if (options?.onReconnectResume) {
      reconnectResumeHandler = (data: ResumeSessionPayload) => {
        clearReconnectResumeHandler()
        if (closed || data.session_id !== sid) return
        options.onReconnectResume?.(data)
      }
      socket.on('resumed', reconnectResumeHandler)
    }
    socket.emit('resume', { session_id: sid, ...(body.profile ? {profile: body.profile} : {})})
  }

  /** 处理 Socket 错误 */
  const handleSocketError = (err: Error) => {
    if (closed) return
    closed = true
    removeTerminalSocketListeners()
    sessionEventHandlers.delete(sid)
    onError(err)
  }

  /** 处理 Socket 连接错误 */
  const handleSocketConnectError = (err: Error) => {
    if (closed) return
    if (sawTransientDisconnect) return
    handleSocketError(err)
  }
  socket.on('connect_error', handleSocketConnectError)

  /** 处理 Socket 断开连接 */
  const handleSocketDisconnect = (reason: string) => {
    if (closed || reason === 'io client disconnect') return
    if (TRANSIENT_DISCONNECT_REASONS.has(reason)) {
      sawTransientDisconnect = true
      return
    }
    handleSocketError(new Error(`Socket disconnected: ${reason}`))
  }
  socket.on('disconnect', handleSocketDisconnect)

  /** 处理 Socket 重连 */
  const handleSocketReconnect = () => {
    if (closed || !sawTransientDisconnect) return
    sawTransientDisconnect = true
    emitReconnectResume()
  }
  socket.on('connect', handleSocketReconnect)

  /** 终端 Socket 监听器清理函数 */
  removeTerminalSocketListeners = () => {
    clearReconnectResumeHandler()
    removeSocketListener(socket, 'connect_error', handleSocketConnectError)
    removeSocketListener(socket, 'disconnect', handleSocketDisconnect)
    removeSocketListener(socket, 'connect', handleSocketReconnect)
  }

  // 定义本会话的事件处理器
  const handlers = {
    onMessageDelta(evt: RunEvent) {
      !closed && onEvent(evt)
    },
    onReasoningDelta(evt: RunEvent) {
      !closed && onEvent(evt)
    },
    onThinkingDelta(evt: RunEvent) {
      !closed && onEvent(evt)
    },
    onReasoningAvailable(evt: RunEvent) {
      !closed && onEvent(evt)
    },
    onToolStarted(evt: RunEvent) {
      !closed && onEvent(evt)
    },
    onToolCompleted(evt: RunEvent) {
      !closed && onEvent(evt)
    },
    onSubagentEvent(evt: RunEvent) {
      !closed && onEvent(evt)
    },
    onRunStarted(evt: RunEvent) {
      if (closed) return
      onEvent(evt)
      onStarted?.(evt.run_id || '')
    },
    onRunCompleted(evt: RunEvent) {
      if (closed) return
      onEvent(evt)
      if (evt.queue_remaining && evt.queue_remaining > 0) return
      closed = true
      removeTerminalSocketListeners()
      onDone()
    },
    onRunFailed(evt: RunEvent) {
      if (closed) return
      onEvent(evt)
      if (evt.queue_remaining && evt.queue_remaining > 0) return
      closed = true
      removeTerminalSocketListeners()
      onDone()
    },
    onCompressionStarted(evt: RunEvent) {
      !closed && onEvent(evt)
    },
    onCompressionCompleted(evt: RunEvent) {
      !closed && onEvent(evt)
    },
    onAbortStarted(evt: RunEvent) {
      !closed && onEvent(evt)
    },
    onAbortTimeout(evt: RunEvent) {
      !closed && onEvent(evt)
    },
    onAbortCompleted(evt: RunEvent) {
      if (closed) return
      onEvent(evt)
      if (evt.queue_remaining && evt.queue_remaining > 0) return
      closed = true
      removeTerminalSocketListeners()
      onDone()
    },
    onUsageUpdated(evt: RunEvent) {
      !closed && onEvent(evt)
    },
    onAgentEvent(evt: RunEvent) {
      !closed && onEvent(evt)
    },
    onSessionCommand(evt: RunEvent) {
      if (closed) return
      onEvent(evt)
      if (evt.terminal === false) return
      closed = true
      removeTerminalSocketListeners()
      sessionEventHandlers.delete(sid)
      onDone()
    },
    onSessionTitleUpdated(evt: RunEvent) {
      !closed && onEvent(evt)
    },
    onRunQueued(evt: RunEvent) {
      !closed && onEvent(evt)
    },
    onApprovalRequested(evt: RunEvent) {
      !closed && onEvent(evt)
    },
    onApprovalResolved(evt: RunEvent) {
      !closed && onEvent(evt)
    },
    onClarifyRequested(evt: RunEvent) {
      !closed && onEvent(evt)
    },
    onClarifyResolved(evt: RunEvent) {
      !closed && onEvent(evt)
    }
  }

  // 在全局会话映射中注册处理器
  sessionEventHandlers.set(sid, handlers)

  // 发送运行请求
  console.warn('发送运行请求:', { body })
  socket.emit('run', body)

  // 返回取消句柄
  return {
    abort: () => {
      !closed && socket.emit('abort', { session_id: sid })
    }
  }
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
  handlers?.onMessageDelta?.(event)
}

/**
 * 全局 reasoning.delta 事件处理器
 * 处理推理过程中的增量内容更新
 */
function globalReasoningDeltaHandler(event: RunEvent): void {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onReasoningDelta?.(event)
}
/**
 * 全局 thinking.delta 事件处理器（reasoning.delta 的别名）
 * 处理思考过程中的增量内容更新
 */
function globalThinkingDeltaHandler(event: RunEvent): void {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onThinkingDelta?.(event)
}

/**
 * 全局 reasoning.available 事件处理器
 * 处理推理内容可用事件
 */
function globalReasoningAvailableHandler(event: RunEvent): void {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onReasoningAvailable?.(event)
}

/**
 * 全局 tool.started 事件处理器
 * 处理工具开始执行事件
 */
function globalToolStartedHandler(event: RunEvent): void {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onToolStarted?.(event)
}

/**
 * 全局 tool.completed 事件处理器
 * 处理工具执行完成事件
 */
function globalToolCompletedHandler(event: RunEvent): void {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onToolCompleted?.(event)
}

/**
 * 全局 run.started 事件处理器
 * 处理运行开始事件
 */
function globalRunStartedHandler(event: RunEvent): void {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onRunStarted?.(event)
}

/**
 * 全局 run.completed 事件处理器
 * 处理运行完成事件，并在完成后自动清理会话处理器
 */
function globalRunCompletedHandler(event: RunEvent): void {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onRunCompleted?.(event)

  // 运行完成时自动清理会话处理器（如果还有排队的运行则跳过）
  if (event.queue_remaining ?? 0 > 0) return
  sessionEventHandlers.delete(sid)
}

/**
 * 全局 run.failed 事件处理器
 * 处理运行失败事件，并在失败后自动清理会话处理器（如果没有更多排队的运行）
 */
function globalRunFailedHandler(event: RunEvent): void {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onRunFailed?.(event)

  // 运行失败时自动清理会话处理器（如果还有排队的运行则跳过）
  if (event.queue_remaining ?? 0 > 0) return
  sessionEventHandlers.delete(sid)
}

/**
 * 全局 run.queued 事件处理器
 * 处理运行排队事件
 */
function globalRunQueuedHandler(event: RunEvent): void {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onRunQueued?.(event)
}

/**
 * 全局 run.reattach_failed 事件处理器
 * 处理运行重新连接失败事件
 */
function globalRunReattachFailedHandler(event: RunEvent): void {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onAgentEvent?.(event)
}

/**
 * 全局 compression.started 事件处理器
 * 处理上下文压缩开始事件
 */
function globalCompressionStartedHandler(event: RunEvent): void {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onCompressionStarted?.(event)
}

/**
 * 全局 compression.completed 事件处理器
 * 处理上下文压缩完成事件
 */
function globalCompressionCompletedHandler(event: RunEvent): void {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onCompressionCompleted?.(event)
}

/**
 * 全局 abort.started 事件处理器
 * 处理中止操作开始事件
 */
function globalAbortStartedHandler(event: RunEvent): void {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onAbortStarted?.(event)
}

/**
 * 全局 abort.timeout 事件处理器
 * 处理中止操作超时事件
 */
function globalAbortTimeoutHandler(event: RunEvent): void {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onAbortTimeout?.(event)
}

/**
 * 全局 abort.completed 事件处理器
 * 处理中止操作完成事件
 * 如果中止后还有排队的运行，保持处理器存活以便接收后续事件
 */
function globalAbortCompletedHandler(event: RunEvent): void {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onAbortCompleted?.(event)

  // 如果中止完成后还有排队的运行，保持处理器存活以便接收后续事件
  if (event.queue_length ?? 0 > 0) return
  sessionEventHandlers.delete(sid)
}

/**
 * 全局 session.title.updated 事件处理器
 * 处理会话标题更新事件，同时通知会话特定处理器和全局处理器
 */
function globalSessionTitleUpdatedHandler(event: RunEvent): void {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onSessionTitleUpdated?.(event)
  for (const handler of sessionTitleUpdatedHandlers) {
    handler(event)
  }
}

/**
 * 全局 usage.updated 事件处理器
 * 处理 Token 使用量更新事件
 */
function globalUsageUpdatedHandler(event: RunEvent): void {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onUsageUpdated?.(event)
}

/**
 * 全局 session.command 事件处理器
 * 处理会话命令事件，同时通知会话特定处理器和全局处理器
 */
function globalSessionCommandHandler(event: RunEvent) {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onSessionCommand?.(event)
  for (const handler of sessionCommandHandlers) {
    handler(event)
  }
}

/**
 * 全局 clarify.requested 事件处理器
 * 处理澄清请求事件
 */
function globalClarifyRequestedHandler(event: RunEvent) {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onClarifyRequested?.(event)
}

/**
 * 全局 clarify.resolved 事件处理器
 * 处理澄清请求解决事件
 */
function globalClarifyResolvedHandler(event: RunEvent) {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onClarifyResolved?.(event)
}

/**
 * 全局 approval.requested 事件处理器
 * - 处理工具执行审批请求事件
 */
function globalApprovalRequestedHandler(event: RunEvent) {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onApprovalRequested?.(event)
}

/**
 * 全局 approval.resolved 事件处理器
 * - 处理工具执行审批解决事件
 */
function globalApprovalResolvedHandler(event: RunEvent) {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onApprovalResolved?.(event)
}

/**
 * 全局 run.peer_user_message 事件处理器
 * - 处理来自其他用户的对等消息事件，同时通知会话特定处理器和全局处理器
 */
function globalPeerUserMessageHandler(event: RunEvent) {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onPeerUserMessage?.(event)

  for (const handler of peerUserMessageHandlers) {
    handler(event)
  }
}

function globalAgentEventHandler(event: RunEvent) {
  const sid = event.session_id
  if (!sid) return
  sessionEventHandlers.get(sid)?.onAgentEvent?.(event)
}

function globalSubagentEventHandler() {
  console.error('Todo:globalSubagentEventHandler')
}

/**
 * 订阅会话命令事件（全局）
 * @param handler 事件处理函数
 * @returns 取消订阅函数
 */
export function onSessionCommand(handler: (event: RunEvent) => void): () => void {
  sessionCommandHandlers.add(handler)
  return () => {
    sessionCommandHandlers.delete(handler)
  }
}

/**
 * 订阅对等用户消息事件（全局）
 * @param handler 事件处理函数
 * @returns 取消订阅函数
 */
export function onPeerUserMessage(handler: (event: RunEvent) => void): () => void {
  peerUserMessageHandlers.add(handler)
  return () => {
    peerUserMessageHandlers.delete(handler)
  }
}

/**
 * 响应澄清请求
 * @param sid 会话 ID
 * @param clarifyId 澄清请求 ID
 * @param response 用户的澄清回复内容
 */
export function respondClarify(sid: string, clarifyId: string, response: string) {
  const socket = connectChatRun()
  socket.emit('clarify.respond', {
    session_id: sid,
    clarify_id: clarifyId,
    response
  })
}

/**
 * 响应对工具执行的审批请求
 * @param sid 会话 ID
 * @param approvalId 审批请求 ID
 * @param choice 审批选择：once（仅此一次）、session（本次会话）、always（始终允许）、deny（拒绝）
 */
export function respondToolApproval(sid: string, approvalId: string, choice: 'once' | 'session' | 'always' | 'deny') {
  const socket = connectChatRun()
  socket.emit('approval.respond', {
    session_id: sid,
    approval_id: approvalId,
    choice
  })
}

/**
 * 注销会话事件处理器
 * @param sessionId 会话 ID
 */
export function unregisterSessionHandlers(sessionId: string): void {
  sessionEventHandlers.delete(sessionId)
}

/**
 * 注册会话事件处理器
 * @param sessionId 会话 ID
 * @param handlers 事件处理函数对象
 * @returns 清理函数，用于注销处理器
 */
export function registerSessionHandlers(
  sessionId: string,
  handlers: {
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
  }
): () => void {
  sessionEventHandlers.set(sessionId, handlers)

  // 返回清理函数
  return () => {
    sessionEventHandlers.delete(sessionId)
  }
}

/**
 * 订阅会话标题更新事件（全局）
 * @param handler 事件处理函数
 * @returns 取消订阅函数
 */
export function onSessionTitleUpdate(handler: (event: RunEvent) => void): () => void {
  sessionTitleUpdatedHandlers.add(handler)
  return () => {
    sessionTitleUpdatedHandlers.delete(handler)
  }
}
