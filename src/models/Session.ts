/*
* 会话 Model
* */
import { type SessionSummary } from '@/api/sessions.ts'
import { Message } from './Message.ts'

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
