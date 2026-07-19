import { type SessionSummary } from '@/api/sessions.ts'

// 消息角色 - 用户
const ROLE_USER = 'user' as const
// 消息角色 - AI
const ROLE_ASSISTANT = 'assistant' as const
// 消息角色 - 系统
const ROLE_SYSTEM = 'system' as const
// 消息角色 - 工具
const ROLE_TOOL = 'tool' as const
// 消息角色 - 命令
const ROLE_COMMAND = 'command' as const

// 系统消息类型 - 命令
const SYSTEM_TYPE_COMMAND = 'command' as const
// 系统消息类型 - 错误
const SYSTEM_TYPE_ERROR = 'error' as const


/** 消息附件接口 */
export class Attachment {
  // 附件唯一标识
  id: string

  // 文件名
  name: string

  // MIME 类型
  type: string

  // 文件大小（字节）
  size: number

  // 下载/预览 URL
  url: string

  // 本地 File 对象（仅上传时存在）
  file?: File

  constructor(_: Attachment) {
    this.id = _.id
    this.name = _.name
    this.type = _.type
    this.size = _.size
    this.url = _.url
    this.file = _.file
  }
}

/**
 * 消息接口 - 聊天界面展示的消息模型
 *
 * 消息角色说明：
 * - user: 用户消息
 * - assistant: AI 助手回复
 * - system: 系统消息/错误提示
 * - tool: 工具调用消息
 * - command: 命令消息（如 /clear, /compress）
 */
export class Message {
  // 唯一标识
  id: string

  // 角色
  role: typeof ROLE_USER | typeof ROLE_ASSISTANT | typeof ROLE_SYSTEM | typeof ROLE_TOOL | typeof ROLE_COMMAND

  // 内容
  content: string

  // 时间戳（毫秒）
  timestamp: number

  // 工具名称（工具消息专用）
  toolName?: string

  // 工具调用 ID（关联工具调用和结果）
  toolCallId?: string

  // 工具结果预览文本
  toolPreview?: string

  // 工具调用参数
  toolArgs?: unknown

  // 工具执行结果
  toolResult?: unknown

  // 工具执行状态
  toolStatus?: 'running' | 'done' | 'error'

  // 工具执行时长（秒）
  toolDuration?: number

  // 是否正在流式传输中
  isStreaming?: boolean

  // 附件列表
  attachments?: Attachment[]

  /**
   * 思考/推理文本 - AI 的内部思考过程
   * 来源：
   *   1) 历史消息：来自 HermesMessage.reasoning 字段
   *   2) 流式：由 reasoning.delta / thinking.delta / reasoning.available 事件累加
   * 不含 <think> 包裹标签；内容自身可以为多段纯文本。
   */
  reasoning?: string

  // 是否在排队中
  queued?: boolean

  // 系统消息类型
  systemType?: typeof SYSTEM_TYPE_COMMAND | typeof SYSTEM_TYPE_ERROR

  // 命令动作类型
  commandAction?: 'status' | string

  // 命令附带数据
  commandData?: {
    type: 'glob' | string
    [key: string]: unknown
  }

  // 消息结束原因
  finishReason?: string | null

  // 运行标记（用于恢复会话时追踪）
  runMarker?: string | null

  constructor(_: Message) {
    this.id = _.id
    this.role = _.role
    this.content = _.content
    this.timestamp = _.timestamp
    this.toolName = _.toolName
    this.toolCallId = _.toolCallId
    this.toolPreview = _.toolPreview
    this.toolArgs = _.toolArgs
    this.toolResult = _.toolResult
    this.toolStatus = _.toolStatus
    this.toolDuration = _.toolDuration
    this.isStreaming = _.isStreaming
    this.attachments = _.attachments
    this.reasoning = _.reasoning
    this.queued = _.queued
    this.systemType = _.systemType
    this.commandAction = _.commandAction
    this.commandData = _.commandData
    this.finishReason = _.finishReason
    this.runMarker = _.runMarker
  }

  static ROLE_USER = ROLE_USER
  static ROLE_ASSISTANT = ROLE_ASSISTANT
  static ROLE_SYSTEM = ROLE_SYSTEM
  static ROLE_TOOL = ROLE_TOOL
  static ROLE_COMMAND = ROLE_COMMAND

  // 是否为命令消息（role 为 command 或 systemType 为 command），用于执行系统命令
  get isCommandMessage() {
    return !!this.content && this.role === ROLE_COMMAND && this.systemType === SYSTEM_TYPE_COMMAND
  }

  // 是否为命令错误消息（command 角色且 systemType 为 error），用于展示命令执行失败
  get isCommandError() {
    return this.role === ROLE_COMMAND && this.systemType === SYSTEM_TYPE_ERROR
  }

  // 是否为状态命令消息：命令消息且 commandAction 为 status，且不是 goal 类型
  // 状态命令用于展示 Hermes Agent 的运行状态信息
  get isStatusCommand() {
    return !!this.content && this.isCommandMessage && this.commandAction === 'status'  && this.commandData?.type !== 'glob'
  }

  // 是否为助手错误消息（assistant 角色且 systemType 为 error），用于特殊的错误样式展示
  get isAgentError() {
    return this.role === ROLE_ASSISTANT && this.systemType === SYSTEM_TYPE_ERROR
  }

  // 是否包含 reasoning 字段（来自事件/API 的思考文本）
  get hasReasoningField() {
    return !!this.reasoning
  }

  // 是否包含附件
  get hasAttachments() {
    return !!(this.attachments && this.attachments.length > 0)
  }
}

export class Session {
  // 唯一标识
  id: string

  // 消息列表
  messages: Message[]

  // 创建时间（毫秒）
  createdAt: number

  // 更新时间（毫秒）
  updatedAt: number

  // 所属 Profile
  profile?: string

  // 会话标题（自动生成或用户设置）
  title: string

  // 会话来源（api_server/cli/coding_agent）
  source?: string

  // 使用的 Agent 类型
  agent?: string

  // Agent 层会话 ID
  agentSessionId?: string

  // 原生模型会话 ID
  agentNativeSessionId?: string

  // 编码 Agent ID
  codingAgentId?: 'claude-code' | 'codex'

  // 编码 Agent 模式
  codingAgentMode?: 'global' | 'scoped'

  // 使用的模型名称
  model?: string

  // 模型提供商
  provider?: string

  // 自定义 API 基础 URL
  baseUrl?: string

  // 自定义 API Key
  apiKey?: string

  // API 模式
  apiMode?: 'chat_completions' | 'codex_responses' | 'anthropic_messages'

  // 消息计数
  messageCount?: number

  // 消息总数
  messageTotal?: number

  // 已加载的消息数
  loadedMessageCount?: number

  // 是否还有更早的消息可加载
  hasMoreBefore?: boolean

  // 是否正在加载更早的消息
  isLoadingOlderMessages?: boolean

  // 输入 Token 数
  inputTokens?: number

  // 输出 Token 数
  outputTokens?: number

  // 上下文 Token 数
  contextTokens?: number

  // 会话结束时间
  endedAt?: number | null

  // 最后活跃时间
  lastActiveAt?: number

  // 工作空间路径
  workspace?: string | null

  /**
   * 会话级别的推理强度覆盖
   * 空字符串/undefined = 使用 config.yaml 默认值
   * 可选值: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
   */
  reasoningEffort?: string

  constructor(_: Session) {
    this.id = _.id
    this.messages = []
    this.createdAt = _.createdAt
    this.updatedAt = _.updatedAt
    this.profile = _.profile
    this.title = _.title
    this.source = _.source
    this.agent = _.agent
    this.agentSessionId = _.agentSessionId
    this.agentNativeSessionId = _.agentNativeSessionId
    this.codingAgentId = _.codingAgentId
    this.codingAgentMode = _.codingAgentMode
    this.model = _.model
    this.provider = _.provider
    this.baseUrl = _.baseUrl
    this.apiKey = _.apiKey
    this.apiMode = _.apiMode
    this.messageCount = _.messageCount
    this.messageTotal = _.messageTotal
    this.loadedMessageCount = _.loadedMessageCount
    this.hasMoreBefore = _.hasMoreBefore
    this.isLoadingOlderMessages = _.isLoadingOlderMessages
    this.inputTokens = _.inputTokens
    this.outputTokens = _.outputTokens
    this.contextTokens = _.contextTokens
    this.endedAt = _.endedAt
    this.lastActiveAt = _.lastActiveAt
    this.workspace = _.workspace
    this.reasoningEffort = _.reasoningEffort
  }

  static fromSummary(list: SessionSummary[]): Session[] {
    return list.map(_ => {
      // 判断编码 Agent 模式
      const codingAgentMode = _.source === 'coding_agent'
        ? (_.agent_mode === 'global' || _.agent_mode === 'scoped'
          ? _.agent_mode
          : _.provider === 'global' ? 'global' : 'scoped')
        : undefined

      return new this({
        id: _.id,
        title: _.title,
        profile: _.profile ??　'default',
        source: _.source,
        agent: _.agent,
        agentSessionId: _.agent_native_session_id,
        agentNativeSessionId: _.agent_native_session_id,
        codingAgentMode,
        messages: [],
        createdAt: Math.round(_.started_at * 1000),
        updatedAt: Math.round(((_.last_active || _.ended_at || _.started_at) ?? NaN) * 1000),
        model: _.model,
        provider: _.provider || _.billing_provider,
        messageCount: _.message_count,
        messageTotal: _.message_count,
        loadedMessageCount: 0,
        hasMoreBefore: false,
        inputTokens: _.input_tokens,
        outputTokens: _.output_tokens,
        endedAt: _.ended_at != null ? Math.round(_.ended_at * 1000) : null,
        lastActiveAt: _.last_active != null ? Math.round(_.last_active * 1000) : undefined,
        workspace: _.workspace || null
      })
    })
  }
}
