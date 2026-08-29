/*
* 会话 Model
* */
import { type SessionSummary } from '@/api/sessions.ts'
import { Message } from './Message.ts'

// 会话来源
const SOURCE = {
  ApiServer: 'api_server',
  Cli: 'cli',
  CodingAgent: 'coding_agent'
} as const

// Agent 类型
const AGENT = {
  Hermes: 'hermes',
  Claude: 'claude',
  Codex: 'codex'
} as const

// 编码 Agent ID
const CODING_AGENT_ID= {
  ClaudeCode: 'claude-code',
  Codex: 'codex'
} as const

// 编码 Agent 模式
const CODING_AGENT_MODE = {
  Global: 'global',
  Scoped: 'scoped'
} as const

// 模型提供商
const PROVIDER = {
  Global: 'global',
  Scoped: 'scoped'
} as const

// API 模式
const API_MODE = {
  ChatCompletions: 'chat_completions',
  CodexResponses: 'codex_responses',
  AnthropicMessages: 'anthropic_messages'
} as const

export type SessionSource = typeof SOURCE[keyof typeof SOURCE]
export type SessionAgent = typeof AGENT[keyof typeof AGENT]
export type SessionCodingAgentId = typeof CODING_AGENT_ID[keyof typeof CODING_AGENT_ID]
export type SessionProvider = typeof PROVIDER[keyof typeof PROVIDER]
export type SessionApiMode = typeof API_MODE[keyof typeof API_MODE]
export type SessionCodingAgentMode = typeof CODING_AGENT_MODE[keyof typeof CODING_AGENT_MODE]

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
  profile?: string = 'default'

  // 会话标题（自动生成或用户设置）
  title: string

  // 会话来源
  source?: SessionSource

  // 使用的 Agent 类型
  agent?: SessionAgent

  // Agent 层会话 ID
  agentSessionId?: string

  // 原生模型会话 ID
  agentNativeSessionId?: string

  // 编码 Agent ID
  codingAgentId?: SessionCodingAgentId

  // 编码 Agent 模式
  codingAgentMode?: SessionCodingAgentMode

  // 使用的模型名称
  model?: string

  // 模型提供商
  provider?: SessionProvider

  // 自定义 API 基础 URL
  baseUrl?: string

  // 自定义 API Key
  apiKey?: string

  // API 模式
  apiMode?: SessionApiMode

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

  constructor(_: Omit<Session, 'createdDate'>) {
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

  // 创建日期（xx月/xx日）
  get createdDate() {
    return new Date(this.createdAt).toLocaleDateString('default', {month: 'short', day: 'numeric'})
  }

  static SOURCE = SOURCE
  static AGENT = AGENT
  static CODING_AGENT_ID = CODING_AGENT_ID
  static CODING_AGENT_MODE = CODING_AGENT_MODE
  static PROVIDER = PROVIDER
  static API_MODE = API_MODE

  /**
   * 将 Hermes 后端会话摘要转换为客户端会话格式
   * - 主要处理：
   * 1. 时间戳转换（秒 -> 毫秒）
   * 2. 字段名映射（snake_case -> camelCase）
   * 3. 编码 Agent 模式判断
   * 4. 默认值设置
   * @param list Hermes 后端会话摘要列表
   * @returns 客户端会话对象
   */
  static fromSummary(list: SessionSummary[]): Session[] {
    return list.map(_ => {
      // 判断编码 Agent 模式
      const codingAgentMode = _.source === SOURCE.CodingAgent
        ? (_.agent_mode === CODING_AGENT_MODE.Global || _.agent_mode === CODING_AGENT_MODE.Scoped
          ? _.agent_mode
          : _.provider === PROVIDER.Global ? PROVIDER.Global : PROVIDER.Scoped)
        : undefined

      return new this({
        id: _.id,
        title: _.title,
        profile: _.profile ??　'default',
        source: _.source as SessionSource,
        agent: _.agent as SessionAgent,
        agentSessionId: _.agent_native_session_id,
        agentNativeSessionId: _.agent_native_session_id,
        codingAgentMode,
        messages: [],
        createdAt: Math.round(_.started_at * 1000),
        updatedAt: Math.round(((_.last_active || _.ended_at || _.started_at) ?? NaN) * 1000),
        model: _.model,
        provider: (_.provider || _.billing_provider) as SessionProvider,
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

