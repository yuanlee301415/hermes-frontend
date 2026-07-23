/*
* 消息 Model
* */

// 消息角色
const ROLE = {
  // 用户
  User: 'user',
  // 助手
  Assistant: 'assistant',
  // 系统
  System: 'system',
  // 工具
  Tool: 'tool',
  // 命令
  Command: 'command',
} as const


// 系统消息类型
const SYSTEM_TYPE = {
  // 命令
  Command: 'command',
  // 错误
  Error: 'error'
} as const

// 工具执行状态
const TOOL_STATUS = {
  // 运行中
  Running: 'running',
  // 完成
  Done: 'done',
  // 错误
  Error: 'error'
} as const

export type MessageRole = typeof ROLE[keyof typeof ROLE]
export type MessageSystemType = typeof SYSTEM_TYPE[keyof typeof SYSTEM_TYPE]
export type MessageToolStatus = typeof TOOL_STATUS[keyof typeof TOOL_STATUS]

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
  role: MessageRole

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
  toolStatus?: MessageToolStatus

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
  systemType?: MessageSystemType

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

  constructor(_: Omit<Message, 'isCommandMessage' | 'isCommandError' | 'isStatusCommand' | 'isAgentError' | 'hasReasoningField' | 'hasAttachments'>) {
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

  static ROLE = ROLE
  static SYSTEM_TYPE = SYSTEM_TYPE
  static TOOL_STATUS = TOOL_STATUS

  // 是否为命令消息（role 为 command 或 systemType 为 command），用于执行系统命令
  get isCommandMessage() {
    return !!this.content && this.role === ROLE.Command && this.systemType === SYSTEM_TYPE.Command
  }

  // 是否为命令错误消息（command 角色且 systemType 为 error），用于展示命令执行失败
  get isCommandError() {
    return this.role === ROLE.Command && this.systemType === SYSTEM_TYPE.Error
  }

  // 是否为状态命令消息：命令消息且 commandAction 为 status，且不是 goal 类型
  // 状态命令用于展示 Hermes Agent 的运行状态信息
  get isStatusCommand() {
    return !!this.content && this.isCommandMessage && this.commandAction === 'status'  && this.commandData?.type !== 'glob'
  }

  // 是否为助手错误消息（assistant 角色且 systemType 为 error），用于特殊的错误样式展示
  get isAgentError() {
    return this.role === ROLE.Assistant && this.systemType === SYSTEM_TYPE.Error
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
