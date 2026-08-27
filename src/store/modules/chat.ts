/*
* Todo:
*  - [ ] 初始运行的逻辑
* */

/**
 * Chat Store - 核心聊天状态管理模块
 *
 * 负责管理会话列表、消息流、流式响应、工具调用、审批请求、压缩状态等核心聊天功能。
 * 主要特性：
 * - 会话管理：创建、切换、删除、加载历史消息
 * - 流式消息：通过 Socket.IO 实时接收 AI 响应，支持中断和恢复
 * - 工具调用：完整的工具执行流程（启动/运行/完成/错误）
 * - 思考推理：支持 reasoning.delta/thinking.delta/reasoning.available 事件
 * - 审批系统：处理工具执行权限请求（如内存写入）
 * - 澄清请求：处理 AI 的追问
 * - 队列机制：支持消息排队，避免并发冲突
 * - 跨端同步：支持 CLI/Telegram/多设备创建的会话实时同步
 * - 语音播放：支持消息自动语音合成
 */
import { defineStore } from 'pinia'
import { getSessionsApi } from '@/api/sessions.ts'
import {
  type RunEvent, type ContentBlock, type StartRunRequest, type ResumeSessionPayload, type PeerMessage,
  resumeSession, startRunViaSocket, getChatRunSocket, onSessionCommand, respondClarify, respondToolApproval, onPeerUserMessage, unregisterSessionHandlers, registerSessionHandlers
} from '@/api/chat.ts'
import { Session } from '@/models/Session.ts'
import { Message, Attachment } from '@/models/Message.ts'
import { useProfilesStore } from '@/store/modules/profiles.ts'
import { useAppStore } from '@/store/modules/app.ts'
import { uuid } from '@/utils/uuid.ts'
import { detectThinkingBoundary } from '@/utils/thinking-parser.ts'
import { ACTIVE_SESSION_KEY_PREFIX } from '@/constants/storage-keys.ts'
import { hasRuntimeToolPayload, runtimeToolPayloadOrUndefined, mapHermesMessages, readRunMarker, getReplayRunMarker, resolveResumedAssistantState,
  errorMessageText, runtimeToolOutputHasError, normalizeQueuedUserMessages } from '../shared/chat.ts'
import { getItemBestEffort, removeItem, setItemBestEffort } from '../shared/storage.ts'

/**
 * 压缩状态接口 - 会话上下文压缩的状态追踪
 */
interface CompressionState {
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

/** 中断状态 */
type AbortState = {
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

/**
 * 待审批请求接口 - 工具执行权限请求
 *
 * 当 AI 需要执行敏感操作（如写入内存）时，会向用户发送审批请求
 */
export interface PendingApproval {
  sessionId: Session['id'] // 会话 ID
  approvalId: string // 审批 ID
  command: string // 请求执行的命令
  description: string // 请求描述
  choices: Array<'once' | 'session' | 'always' | 'deny'> // 用户可选的审批选项
  allowPermanent: boolean // 是否允许永久授权（always）
  isMemoryWrite: boolean // 是否为内存写入操作
  requestedAt: number // 请求时间戳
}

/**
 * 待澄清请求接口 - AI 的追问
 * - 当 AI 需要更多信息才能继续回答时，会发送澄清请求
 */
export interface PendingClarify {
  sessionId: Session['id'] // 会话 ID
  clarifyId: string // 澄清请求 ID
  question: string // 追问问题
  choices: string[] | null // 可选答案列表（null 表示自由输入）
  timeoutMs: number // 超时时间（毫秒）
  requestedAt: number // 请求时间戳
}

const DEFAULT_PROFILE_NAME = 'default'

export const useChatStore = defineStore('chatStore', () => {
  const profileStore = useProfilesStore()
  const appStore = useAppStore()

  /** 会话列表 */
  const sessions = ref<Session[]>([])
  /** 当前活跃会话 ID */
  const activeSessionId = ref<Session['id']>()
  /** 当前聚焦的消息 ID（用于滚动定位） */
  const focusSessionId = ref<Message['id']>()
  /** 当前会话列表的 Profile 过滤器 */
  const sessionProfileFilter = ref<string|undefined>()
  /** 是否正在加载会话列表 */
  const isLoadingSessions = ref(false)
  /** 是否正在加载消息 */
  const isLoadingMessages = ref(false)
  /** 会话列表是否已加载 */
  const sessionsLoaded = ref(false)
  /** 当前活跃会话对象 */
  const activeSession = ref<Session|null>(null)
  /** 当前活跃会话的消息列表 */
  const messages = computed<Message[]>(() => activeSession.value?.messages || [])


  /**
   * 会话 ID → 压缩状态映射
   * - 压缩状态按会话隔离，因为 socket 可以在后台会话保持连接的同时另一个聊天处于活跃状态
   */
  const compressionStates = ref<Map<Session['id'], CompressionState>>(new Map())

  /** 会话 ID → 服务器报告的 isWorking 状态 */
  const serverWorking = ref<Set<Session['id']>>(new Set())

  /** 会话 ID → 排队消息数量 */
  const queueLengths = ref<Map<Session['id'], number>>(new Map())

  /** 会话 ID → 已排队但尚未在对话中显示的用户消息 */
  const queueUserMessages = ref<Map<Session['id'], Message[]>>(new Map())

  /** 会话 ID → 流式状态映射（包含 abort 方法） */
  const streamStates = ref<Map<Session['id'], {abort: () => void}>>(new Map())

  /** 会话 ID → 已排队但尚未在对话中显示的用户消息 */
  const queuedUserMessages = ref<Map<Session['id'], Message[]>>(new Map())

  /** 会话 ID → 服务器报告已出队但对等消息尚未到达的队列 ID 集合 */
  const dequeueQueueIds = ref<Map<Session['id'], Set<Message['id']>>>(new Map())

  /** 会话 ID → 待审批请求 */
  const pendingApprovals = ref<Map<Session['id'], PendingApproval>>(new Map())

  /** 会话 ID → 待澄清请求 */
  const pendingClarifies = ref<Map<Session['id'], PendingClarify>>(new Map())

  /** 当前活跃会话的待澄清请求 */
  const activePendingClarify = computed(() => {
    const sid = activeSessionId.value
    return sid ? pendingClarifies.value.get(sid) : null
  })

  /** 当前活跃会话的待审批请求 */
  const activePendingApproval = computed(() => {
    const sid = activeSessionId.value
    return sid ? pendingApprovals.value.get(sid) : null
  })

  /** 是否正在流式传输（客户端或服务器有活跃运行） */
  const isStreaming = computed(() => {
    const sid = activeSessionId.value
    if (!sid) return false
    return streamStates.value.has(sid) || serverWorking.value.has(sid)
  })

  /** 是否有活跃运行（与 isStreaming 等价） */
  const isRunActive = computed(() => isStreaming.value)

  /** 中断状态 */
  const abortState = ref<AbortState | null>(null)

  /** 是否正在中断 */
  const isAborting = computed(() => abortState.value?.aborting === true)

  /** 当前活跃会话的压缩状态 */
  const compressionState = computed(() => {
    const sid = activeSessionId.value
    if (!sid) return
    return compressionStates.value.get(sid) ?? null
  })

  // ========== 内部状态 ==========

  /** 已处理过的会话命令事件集合（防止重复处理） */
  const seenSessionCommandEvents = new WeakSet<RunEvent>()

  // 活跃流式传输期间 <think> 边界的临时观察。
  // 不持久化；会话切换时清除。
  const thinkingObservation = new Map<string, {startedAt?: number, endedAt?: number}>

  /*
  * Todo: 初始运行的逻辑
  *  - [ ] 注册会话标题更新处理器
  *  - [ ] 标签页可见性
  *  - [ ] 轻度后台轮询用于会话列表实时同步
  *  - [ ] 当会话从服务器新获取时
  * */

  // 注册全局会话命令处理器
  onSessionCommand(handleGlobalSessionCommand)

  // 注册对等用户消息处理器
  onPeerUserMessage(handlePeerUserMessage)

  /**
   * 加载会话列表
   *
   * 从服务器获取会话列表，保留已加载的消息，然后根据优先级选择并切换到目标会话。
   *
   * 会话恢复优先级（从高到低）：
   * 1. preferredSessionId（路由指定的会话）
   * 2. currentId（当前内存中的会话）
   * 3. storedId（本地存储的会话）
   * 4. 最新会话
   *
   * @param profile 可选的 profile 过滤
   * @param preferredSessionId 首选会话 ID（路由指定）
   */
  async function loadSessions(profile?: string, preferredSessionId?: string) {
    isLoadingSessions.value = true
    try {
      const list = await getSessionsApi(undefined, undefined, profile)
      const fresh = Session.fromSummary(list)

      // 保留仍存在的会话的已加载消息，避免刷新时丢失活跃会话的消息
      const runtimeByIdBefore = new Map(sessions.value.map(s => [s.id, {
        messages: s.messages,
        contextTokens: s.contextTokens,
      }]))
      // console.log('loadSessions>runtimeByIdBefore:', runtimeByIdBefore)

      for (const s of fresh) {
        const prev = runtimeByIdBefore.get(s.id)
        if (prev?.messages?.length) {
          s.messages = prev.messages
        }
        if (prev?.contextTokens !== null) s.contextTokens = prev?.contextTokens
      }
      sessions.value = fresh
      // console.log('loadSessions>sessions:', sessions.value)

      // 按优先级选择目标会话
      const currentId = activeSessionId.value
      const storedId = getItemBestEffort(storageKey())
      const targetId = preferredSessionId && sessions.value.some(s => s.id === preferredSessionId)
        ? preferredSessionId
        : currentId && sessions.value.some(s => s.id === currentId)
          ? currentId
          : storedId && sessions.value.some(s => s.id === storedId)
            ? storedId
            : sessions.value[0]?.id

      if (targetId) {
        await switchSession(targetId)
      } else {
        clearActiveSession()
      }
    } catch (err) {
      console.error('Failed to load sessions:', err)
    } finally {
      isLoadingSessions.value = false
      sessionsLoaded.value = true
    }
  }

  /**
   * 切换到指定会话
   *
   * 切换会话的流程：
   * 1. 清除之前的思考观察
   * 2. 更新活跃会话 ID 和本地存储
   * 3. 通过 Socket.IO resume 加载消息
   * 4. 处理恢复的状态（工作状态、队列、压缩、中断、审批等）
   * 5. 处理重放事件（压缩、中断、工具调用等）
   * 6. 恢复正在进行中的运行事件监听
   *
   * @param sessionId 目标会话 ID
   * @param focusId 可选的聚焦消息 ID
   */
  async function switchSession(sessionId: Session['id'], focusId?: Message['id']) {
    // console.log('switchSession:', sessionId)

    clearThinkingObservationFor()
    activeSessionId.value = sessionId
    focusSessionId.value = focusId
    setItemBestEffort(storageKey(), sessionId)

    activeSession.value = getSession(sessionId) || null

    if (!activeSession.value) return

    isLoadingMessages.value = true

    try {
      // 通过 Socket.IO resume 加载消息（服务器从内存或数据库加载）
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Resume timeout'))
        }, 15_000)

        resumeSession(sessionId, data => {
          // console.log('resumeSession>res data:', data)
          clearTimeout(timeout)

          // 如果会话已切换，直接返回
          if (data.session_id !== sessionId || activeSessionId.value !== sessionId) {
            resolve()
            return
          }

          const target = getSession(sessionId)
          if (!target) {
            resolve()
            return
          }

          // 更新工作状态
          if (data.isWorking) {
            serverWorking.value.add(sessionId)
          } else {
            serverWorking.value.delete(sessionId)
          }

          // 更新队列长度
          if (data.queueLength && data.queueLength > 0) {
            queueLengths.value.set(sessionId, data.queueLength)
          } else {
            queueLengths.value.delete(sessionId)
          }

          // 更新排队消息
          if (Array.isArray(data.queueMessages)) {
            replaceQueuedUserMessages(sessionId, normalizeQueuedUserMessages(data.queueMessages))
          } else if (!data.queueLength) {
            replaceQueuedUserMessages(sessionId, [])
          }

          // 更新中断状态
          if (data.isAborting) {
            setAbortState({ aborting: true, synced: undefined })
          } else if (!data.isWorking) {
            setAbortState(null)
          }

          // 更新压缩状态
          if (!data.isWorking) {
            setCompressionState(sessionId, null)
          }

          // 更新 token 计数
          if (data.inputTokens != undefined) {
            target.inputTokens = data.inputTokens
          }
          if (data.outputTokens != undefined) {
            target.outputTokens = data.outputTokens
          }
          if (data.contextTokens != undefined) {
            target.contextTokens = data.contextTokens
          }

          // 更新消息列表
          if (data.messages?.length) {
            target.messages = mapHermesMessages(data.messages)
            target.loadedMessageCount = data.messageLoadedCount ?? data.messages.length
            target.messageTotal = data.messageTotal ?? target.messageCount ?? target.loadedMessageCount
            target.messageCount = target.messageTotal
            target.hasMoreBefore = data.hasMoreBefore ?? target.loadedMessageCount < target.messageTotal
          }

          // 如果没有标题，从第一条用户消息生成
          if (!target.title) {
            const firstUser = target.messages.find(msg => msg.role === Message.ROLE.Tool)
            if (firstUser) {
              const title = firstUser.content.slice(0, 30)
              target.title = title + (firstUser.content.length > 30 ? '...' : '')
            }
          }

          activeSession.value = target

          // 处理重放事件（压缩状态等）
          if (data.events?.length) {
            console.log('switchSession>data.events:', data.events)
            for (const evt of data.events) {
              const e = evt.data
              if (e.event === 'compression.started') {
                setCompressionState(sessionId, {
                  compressing: true,
                  messageCount: e.message_count || 0,
                  beforeTokens: e.token_count || 0,
                  afterTokens: 0,
                  compressed: false
                })
              } else if (e.event === 'compression.completed') {
                const afterTokens = e.contextTokens || e.afterTokens || 0
                setCompressionState(sessionId, {
                  compressing: false,
                  messageCount: e.totalMessages || 0,
                  beforeTokens: e.beforeTokens || 0,
                  afterTokens,
                  compressed: e.compressed ?? false,
                  error: e.error
                })
                if (e.contextTokens != null) {
                  target.contextTokens = e.contextTokens
                }
              } else if (e.event === 'abort.started') {
                setAbortState({ aborting: true, synced: false })
              } else if (e.event === 'abort.timeout') {
                setAbortState({ aborting: true, synced: false, timedOut: true, message: (e as any).message })
              } else if (e.event === 'abort.completed') {
                setAbortState({ aborting: false, synced: e.synced ?? false })
              } else if (e.event === 'approval.requested') {
                setPendingApproval({ ...e, session_id: sessionId })
              } else if (e.event === 'approval.resolved') {
                clearPendingApproval({ ...e, session_id: sessionId })
              } else if (e.event === 'clarify.requested') {
                setPendingClarify({ ...e, session_id: sessionId })
              } else if (e.event === 'clarify.resolved') {
                clearPendingClarify({ ...e, session_id: sessionId })
              } else if (e.event === 'run.failed') {
                addAgentErrorMessage(sessionId, e.error)
                serverWorking.value.delete(sessionId)
                queueLengths.value.delete(sessionId)
              } else if (e.event === 'agent.event' || e.event === 'run.reattach_failed') {
                handleAgentEvent(e)
              } else if (e.event === 'tool.started') {
                // 工具开始事件处理
                const msgs = getSessionMessages(sessionId)
                const toolCallId = e.tool_call_id
                const existingTool = toolCallId ? msgs.find(_ => _.toolCallId === toolCallId && _.role === Message.ROLE.Tool) : null
                if (existingTool) {
                  updateMessage(sessionId, existingTool.id, {
                    toolName: e.tool || e.name,
                    toolArgs: hasRuntimeToolPayload((e as any).arguments ? (e as any).arguments : existingTool.toolArgs),
                    toolPreview: e.preview || existingTool.toolPreview,
                    toolStatus: existingTool.toolStatus || Message.TOOL_STATUS.Running
                  })
                } else {
                  addMessage(sessionId, new Message({
                    id: uuid(),
                    role: Message.ROLE.Tool,
                    content: '',
                    timestamp: Date.now(),
                    toolName: e.tool || e.name,
                    toolCallId,
                    toolPreview: e.preview,
                    toolArgs: runtimeToolPayloadOrUndefined((e as any).arguments),
                    toolStatus: Message.TOOL_STATUS.Running
                  }))
                }
              } else if (e.event === 'tool.completed') {
                // 工具完成事件处理
                const msgs = getSessionMessages(sessionId)
                const toolCallId = e.tool_call_id
                const toolMsgs = toolCallId
                  ? msgs.filter(_ => _.role === Message.ROLE.Tool && _.toolCallId === toolCallId)
                  : msgs.filter(_ => _.role === Message.ROLE.Tool && _.toolStatus === Message.TOOL_STATUS.Running)
                if (toolMsgs.length) {
                  const output = runtimeToolPayloadOrUndefined(e.output)
                  updateMessage(sessionId, toolMsgs.at(-1)!.id, {
                    toolStatus: e.error || runtimeToolOutputHasError(output) ? Message.TOOL_STATUS.Error : Message.TOOL_STATUS.Done,
                    toolDuration: e.duration,
                    toolResult: output
                  })
                }
              } else if (String(e.event || '').startsWith('subagent.')) {
                console.error('Todo: 子 Agent 事件处理:\n', e)
              }
            }
          }
          // console.log('resumeSession>set activeSession:', activeSession.value)
          resolve()
        }, activeSession.value?.profile)
      })
    } catch (e) {
      console.error('[switchSession]::\n', e)
    } finally {
      isLoadingMessages.value = false
    }

    // 如果会话仍活跃，恢复正在进行中的运行事件监听
    if (activeSessionId.value === sessionId) {
      resumeServerWorkingRun(sessionId)
    }
  }

  /**
   * 清除当前活跃会话
   *
   * 重置所有相关状态，包括活跃会话、聚焦消息、中断状态、压缩状态，并清除本地存储
   */
  function clearActiveSession() {
    const sid = activeSessionId.value
    activeSessionId.value = void 0
    activeSession.value = null
    focusSessionId.value = void 0
    setAbortState(null)
    setCompressionState(sid, null)
    removeItem(storageKey())
  }

  /** 设置中断状态 */
  function setAbortState(state: AbortState | null) {
    abortState.value = state
  }

  /**
   * 设置会话的压缩状态
   * @param sessionId 会话 ID
   * @param state 压缩状态（null 表示清除）
   */
  function setCompressionState(sessionId: Session['id'] | void, state: CompressionState | null) {
    if (!sessionId) return
    const next = new Map(compressionStates.value)
    if (state) {
      next.set(sessionId, state)
    } else {
      next.delete(sessionId)
    }
    compressionStates.value = next
  }


  /**
   * 清除指定会话的思考观察数据
   *
   * messageId 与 sessionId 的关联未单独持有；方案是切换会话时一律清空。
   * 这符合 spec 定义：observation 是"当前会话范围内"的 transient 状态。
   **/
  function clearThinkingObservationFor() {
    thinkingObservation.clear()
  }

  /**
   * 获取当前 profile 名称，用于隔离缓存
   *
   * 从 profiles store 的 activeProfileName（同步 localStorage）读取，
   * 避免异步加载导致 chat store 初始化时拿到 null。
   * @returns profile 名称，默认为 'default'
   */
  function getProfileName(): string {
    return profileStore.activeProfileName ?? DEFAULT_PROFILE_NAME
  }

  /** 获取当前 profile 的活跃会话存储键名 */
  function storageKey(): string {
    return ACTIVE_SESSION_KEY_PREFIX + getProfileName()
  }

  /**
   * 替换队列中的用户消息
   *
   * 合并现有消息的附件（避免丢失本地文件引用），并更新队列长度。
   *
   * @param sid 会话 ID
   * @param messages 新的消息列表
   */
  function replaceQueuedUserMessages(sid: Session['id'], messages: Message[]) {
    const existingById = new Map((queueUserMessages.value.get(sid) ?? []).map(message => [message.id, message]))
    const merged = messages.map(message => ({
      ...existingById.get(message.id),
      ...message,
      attachments: existingById.get(message.id)?.attachments ?? message.attachments,
      queued: true
    }))
    const nextMap = new Map(queueUserMessages.value)
    if (merged.length) {
      nextMap.set(sid, merged as Message[])
    } else {
      nextMap.delete(sid)
    }
    queuedUserMessages.value = nextMap
  }

  /**
   * 创建新会话
   * - 创建一个本地会话对象并添加到会话列表头部
   * @param options 会话创建选项
   * @returns 新创建的会话对象
   */
  function createSession(options: Session = {} as Session): Session {
    const source = options.source ?? Session.SOURCE.Cli
    const codingAgentId = options.codingAgentId ?? (options.agent === Session.AGENT.Codex ? Session.AGENT.Codex : options.agent === Session.AGENT.Claude ? Session.CODING_AGENT_ID.ClaudeCode : undefined)
    const agent = options.agent ?? (source === Session.SOURCE.CodingAgent ? (codingAgentId === Session.CODING_AGENT_ID.Codex ? Session.AGENT.Codex : Session.AGENT.Claude) : Session.AGENT.Hermes)
    const codingAgentMode = source === Session.SOURCE.CodingAgent ? options.codingAgentMode || Session.CODING_AGENT_MODE.Scoped : undefined
    const session = new Session({
      id: uuid(),
      profile: options.profile ?? profileStore.activeProfileName,
      title: '',
      source,
      agent,
      codingAgentId,
      codingAgentMode,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: options.model,
      provider: options.provider,
      workspace: options.workspace,
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      apiMode: options.apiMode
    })
    sessions.value.unshift(session)
    console.log('createSession:', { options, session })
    return session
  }

  /**
   * 判断会话是否处于活跃状态（正在流式传输或服务器报告工作中）
   * @param sessionId 会话 ID
   * @returns 是否活跃
   */
  function isSessionLive(sessionId: Session['id']): boolean {
    return streamStates.value.has(sessionId) || serverWorking.value.has(sessionId)
  }

  /**
   * 将用户消息加入队列
   * - 当会话正在运行时，新消息会被加入队列等待处理
   * - 防止重复加入相同 ID 的消息
   * @param sid 会话 ID
   * @param message 用户消息
   */
  function enqueueUserMessage(sid: Session['id'], message: Message) {
    const queue = queuedUserMessages.value.get(sid) || []
    if (queue.some(_ => _.id === sid)) return
    const nextMap = new Map(queuedUserMessages.value)
    nextMap.set(sid, [...queue, new Message({ ...message, queued: true })])
    queuedUserMessages.value = nextMap
  }

  /**
   * 向指定会话添加消息
   * @param sid 会话 ID
   * @param msg 消息对象
   */
  function addMessage(sid: Session['id'], msg: Message) {
    const target = getSession(sid)
    if (target) {
      target.messages.push(msg)
    }
  }

  /**
   * 更新会话标题
   * - 如果会话没有标题，从第一条用户消息生成
   * @param sid 会话 ID
   */
  function updateSessionTitle(sid: Session['id']) {
    const target = getSession(sid)
    if (!target) return
    if (target.title) return
    const firstUser = target.messages.find(_ => _.role === Message.ROLE.User)
    if (!firstUser) return
    const TITLE_MAX_LENGTH = 40
    const title = firstUser.attachments?.length ? firstUser.attachments.map(_ => _.name).join('，') : firstUser.content
    target.title = title.slice(0, TITLE_MAX_LENGTH) + (title.length > TITLE_MAX_LENGTH ? '...' : '')
    target.updatedAt = Date.now()
  }

  /**
   * 第一次见到某条消息的 reasoning 文本时，标记 startedAt
   *
   * @param msgId 消息 ID
   */
  function noteReasoningStart(msgId: Message['id']) {
    const existing = thinkingObservation.get(msgId) || {}
    if (existing.startedAt === undefined) {
      existing.startedAt = Date.now()
      thinkingObservation.set(msgId, existing)
    }
  }

  /**
   * 内容首次到达（视为推理结束）或显式收到 reasoning.available 时，标记 endedAt
   *
   * @param msgId 消息 ID
   */
  function noteReasoningEnd(msgId: Message['id']) {
    const existing = thinkingObservation.get(msgId)
    if (!existing || existing.startedAt === undefined) return
    if (existing.endedAt === undefined) {
      existing.endedAt = Date.now()
      thinkingObservation.set(msgId, existing)
    }
  }

  /**
   * 添加 Agent 错误消息
   *
   * 如果最后一条消息正在流式传输，则更新它为错误状态；
   * 否则添加一条新的错误消息。
   *
   * @param sid 会话 ID
   * @param error 错误对象
   */
  function addAgentErrorMessage(sid: Session['id'], error?: unknown) {
    const message = errorMessageText(error)
    const content = message ? `Error: ${message}` : 'Run failed'
    const last = getSessionMessages(sid).at(-1)

    if (last?.isStreaming) {
      updateMessage(sid, last.id, {
        role: Message.ROLE.Assistant,
        content,
        isStreaming: false,
        systemType: Message.SYSTEM_TYPE.Error
      })
      return
    }

    // 防止重复添加相同的错误消息
    if (last?.role === Message.ROLE.Assistant && last.systemType === Message.SYSTEM_TYPE.Error && last.content === content) return

    // 添加新的错误消息
    addMessage(sid, new Message({
      id: uuid(),
      role: Message.ROLE.Assistant,
      content,
      timestamp: Date.now(),
      systemType: Message.SYSTEM_TYPE.Error
    }))
  }

  /**
   * 处理 Agent 事件
   *
   * 将 Agent 事件转换为系统消息显示，用于展示 Agent 的状态更新或通知。
   * 如果最后一条消息已经是 agent.event 类型，则更新它，否则添加新消息。
   *
   * @param evt 运行事件
   */
  function handleAgentEvent(evt: RunEvent) {
    const sid = evt.session_id
    if (!sid) return

    // 忽略编码 Agent 的状态事件
    if ((evt as any).source === Session.SOURCE.CodingAgent && (evt as any).kind === 'status') return

    const text = String(evt.text || evt.message as string || '').trim()
    if (!text) return

    const last = getSessionMessages(sid).at(-1)
    const commandData = { ...(evt as any) }

    // 如果最后一条消息已经是 agent.event，更新它
    if (last?.role === Message.ROLE.System && last.commandAction === 'agent.event') {
      if (last.content === text) return
      updateMessage(sid, last.id, new Message({
        id: uuid(),
        role: Message.ROLE.System,
        content: text,
        timestamp: Date.now(),
        commandData
      }))
    }
  }

  /**
   * 获取指定会话的消息列表
   * @param sid 会话 ID
   * @returns 消息列表（空数组如果会话不存在）
   */
  function getSessionMessages(sid: Session['id']): Message[] {
    const sess = getSession(sid)
    return sess?.messages || []
  }

  /**
   * 更新指定消息
   *
   * 使用浅合并更新消息属性
   * @param sid 会话 ID
   * @param msgId 消息 ID
   * @param update 要更新的属性
   */
  function updateMessage(sid: Session['id'], msgId: Message['id'], update: Partial<Message>) {
    const sess = getSession(sid)
    if (!sess) return
    const idx = sess.messages.findIndex(_ => _.id === msgId)
    if (idx === -1) return
    sess.messages[idx] = { ...sess.messages[idx], ...update }
  }

  /**
   * 清除会话中的 Agent 事件消息
   *
   * 过滤掉 commandAction 为 'agent.event' 的消息
   * @param sid 会话 ID
   */
  function clearAgentEventMessages(sid: Session['id']) {
    const sess = getSession(sid)
    if (!sess) return
    sess.messages = sess.messages.filter(_ => _.commandAction !== 'agent.event')
  }

  /**
   * 从队列中移除用户消息（仅本地）
   *
   * @param sid 会话 ID
   * @param msgId 消息 ID
   * @returns 是否成功移除
   */
  function dropQueuedUserMessage(sid: Session['id'], msgId: Message['id']) {
    const queue = queuedUserMessages.value.get(sid)
    if (!queue?.length) return false

    const next = queue.filter(_ => _.id !== msgId)
    if (next.length === queue.length) return false

    const nextMap = new Map(queuedUserMessages.value)
    if (next.length > 0) {
      nextMap.set(sid, next)
      queueLengths.value.set(sid, next.length)
    } else {
      nextMap.delete(sid)
      queueLengths.value.delete(sid)
    }
    queuedUserMessages.value = nextMap
    return true
  }

  /**
   * 记录思考边界变化
   *
   * 在流式传输期间检测 <think> 标签的开始和结束边界，用于计算思考时长。
   *
   * @param msgId 消息 ID
   * @param prevContent 变更前的内容
   * @param nextContent 变更后的内容
   */
  function noteThinkingDelta(msgId: Message['id'], prevContent: string, nextContent: string) {
    const { startedAtBoundary, endedAtBoundary } = detectThinkingBoundary(prevContent, nextContent)
    if (!startedAtBoundary && !endedAtBoundary) return

    const existing = thinkingObservation.get(msgId) || {}
    if (startedAtBoundary && existing.startedAt === undefined) {
      existing.startedAt = Date.now()
    }
    if (endedAtBoundary && existing.endedAt === undefined) {
      existing.endedAt = Date.now()
    }
    thinkingObservation.set(msgId, existing)
  }

  /**
   * 清理会话中所有运行中的工具消息
   *
   * 将所有状态为 'running' 的工具消息设置为指定状态
   * @param sid 会话 ID
   * @param status 目标状态（'done' 或 'error'）
   */
  function settleRunningTools(sid: Session['id'], status: 'done' | 'error') {
    const msgs = getSessionMessages(sid)
    msgs.forEach((_, idx) => {
      if (_.role === Message.ROLE.Tool && _.toolStatus === Message.TOOL_STATUS.Running) {
        msgs[idx] = new Message({ ..._, toolStatus: status })
      }
    })
  }

  /**
   * 设置待澄清请求
   * - 创建待澄清对象，包含问题、可选选项和超时时间
   * @param evt 运行事件
   */
  function setPendingClarify(evt: RunEvent) {
    const sid = evt.session_id
    const clarifyId = evt.clarify_id
    if (!sid || !clarifyId) return

    pendingClarifies.value.set(sid, {
      sessionId: sid,
      clarifyId,
      question: String(evt.question),
      choices: Array.isArray(evt.choices) ? evt.choices: null,
      timeoutMs: Number(evt.timeout_ms) || 300_000,
      requestedAt: Date.now()
    })
  }

  /**
   * 清除待澄清请求
   * @param evt 运行事件
   */
  function clearPendingClarify(evt: RunEvent) {
    const sid = evt.session_id
    if (!sid) return
    const current = pendingClarifies.value.get(sid)
    if (!current) return

    const clarifyId = evt.clarify_id
    if (clarifyId && current.clarifyId !== clarifyId) return

    pendingClarifies.value.delete(sid)
  }

  /**
   * 设置待审批请求
   * - 根据事件数据创建待审批对象，支持特殊处理内存写入请求（限制为 once/deny）
   * @param evt 运行事件
   */
  function setPendingApproval(evt: RunEvent) {
    const sid = evt.session_id
    const approvalId = evt.approval_id
    if (!sid || !approvalId) return

    const description = String(evt.description || '')
    const normalizedDescription = description.trim().toLowerCase().replace(/\s+/g, ' ')

    // 判断是否为内存写入请求
    const isMemoryWrite = !Boolean(evt.allow_permanent) && (
      normalizedDescription === 'save to memory' ||
      normalizedDescription.startsWith('save to memory:') ||
      normalizedDescription.startsWith('save to memory?')
    )

    const rawChoices = Array.isArray(evt.choices) ? evt.choices : ['once', 'session', 'deny']
    const choices = rawChoices.filter((choice: unknown): choice is PendingApproval['choices'][number] =>
        choice === 'once' || choice === 'session' || choice === 'always' || choice === 'deny'
    )

    pendingApprovals.value.set(sid, {
      sessionId: sid,
      approvalId,
      command: String(evt.command || ''),
      description,
      choices: isMemoryWrite ? ['once', 'deny'] : choices.length ? choices : ['once', 'session', 'deny'],
      allowPermanent: !!evt.allow_permanent,
      isMemoryWrite,
      requestedAt: Date.now()
    })
  }

  /**
   * 响应对待审批请求
   * - 发送审批选择到服务器并清除本地待审批状态
   * @param choice 审批选择（once/session/always/deny）
   */
  function respondApproval(choice: PendingApproval['choices'][number]) {
    const pending = activePendingApproval.value
    console.log('respondApproval:', { pending, pendingApprovals })
    if (!pending) return
    respondToolApproval(pending.sessionId, pending.approvalId, choice)
    pendingApprovals.value.delete(pending.sessionId)
  }

  /**
   * 清除待审批请求
   * - 根据会话 ID 和审批 ID 清除待审批请求
   * @param evt 运行事件
   */
  function clearPendingApproval(evt: RunEvent) {
    const sid = evt.session_id
    if (!sid) return
    const current = pendingApprovals.value.get(sid)
    if (!current) return
    const approvalId = evt.approval_id
    // 如果指定了审批 ID，确保匹配才清除
    if (approvalId && current.approvalId !== approvalId) return
    pendingApprovals.value.delete(sid)
    console.log('clearPendingApproval:', { pendingApprovals })
  }

  /**
   * 标记队列 ID 为已出队（服务器报告出队但对等消息尚未到达）
   * - 用于处理消息到达顺序问题：服务器报告消息出队，但实际消息可能还没到客户端。
   * @param sid 会话 ID
   * @param msgId 消息 ID
   */
  function markDequeuedQueueId(sid: Session['id'], msgId: Message['id']) {
    const ids = new Set(dequeueQueueIds.value.get(sid) ?? [])
    ids.add(msgId)
    dequeueQueueIds.value.set(sid, ids)
  }

  /**
   * 处理运行排队事件
   * - 处理服务器发送的队列状态更新，包括：
   * 1. 更新队列长度
   * 2. 处理消息出队（从队列移除并添加到消息列表）
   * 3. 更新队列消息列表
   * 4. 添加新的排队消息
   * @param sid 会话 ID
   * @param evt 运行事件
   */
  function handleRunQueuedEvent(sid: Session['id'], evt: RunEvent) {
    const queuedLength = Number(evt.queue_length ?? 0)
    if (queuedLength > 0) {
      queueLengths.value.set(sid, queuedLength)
    } else {
      queueLengths.value.delete(sid)
    }

    // 处理消息出队
    const dequeuedId = evt.dequeued_queue_id ? String(evt.dequeued_queue_id) : ''
    if (dequeuedId) {
      const existingQueue = queuedUserMessages.value.get(sid) ?? []
      const dequeued = existingQueue.find(_ => _.id === dequeuedId)

      // 更新队列消息列表
      if (Array.isArray(evt.queued_messages)) {
        const queued = normalizeQueuedUserMessages(evt.queued_messages)
        replaceQueuedUserMessages(sid, queued)
      } else {
        const nextQueue = existingQueue.filter(_ => _.id !== dequeuedId)
        replaceQueuedUserMessages(sid, nextQueue)
      }

      // 如果出队消息存在且不在消息列表中，添加到消息列表
      if (dequeued && !getSessionMessages(sid).some(_ => _.id === dequeued.id)) {
        addMessage(sid, new Message({ ...dequeued, queued: false }))
        updateSessionTitle(sid)
      } else if(!dequeued) {
        // 消息还没到，标记为已出队
        markDequeuedQueueId(sid, dequeuedId)
      }
      return
    }

    // 更新完整队列消息列表
    if (Array.isArray(evt.queued_messages)) {
      const queued = normalizeQueuedUserMessages(evt.queued_messages)
      replaceQueuedUserMessages(sid, queued)
      return
    }

    // 添加新的排队消息
    const peer = evt.message as PeerMessage
    const content = typeof peer?.content === 'string' ? peer.content : ''
    const msgId = peer?.id != null ? String(peer.id) : ''
    if (!msgId || !content.trim()) return

    // 防止重复添加
    if (queuedUserMessages.value.get(sid)?.some(_ => _.id === msgId)) return

    const timestamp = typeof peer?.timestamp === 'number' && Number.isFinite(peer.timestamp)
      ? Math.round(peer.timestamp * 1000)
      : Date.now()
    const msgs = getSessionMessages(sid)

    // 如果消息已在消息列表中，先移除它
    const existingIndex = msgs.findIndex(_ => _.id === msgId && _.role === Message.ROLE.User)
    const existing = msgs[existingIndex]
    if (existingIndex >= 0) {
      msgs.splice(existingIndex, 1)
    }

    // 添加到队列
    enqueueUserMessage(sid, new Message({
      ...existing,
      id: msgId,
      role: peer?.role === Message.ROLE.Command ? Message.ROLE.Command : Message.ROLE.User,
      content,
      timestamp: existing?.timestamp ?? timestamp,
      attachments: existing?.attachments,
      queued: true,
      systemType: peer?.role === Message.ROLE.Command ? Message.ROLE.Command : existing?.systemType
    }))
  }

  /**
   * 消费已出队的队列 ID
   * - 当消息到达时，检查是否已经标记为出队，如果是则消费该标记
   * @param sid 会话 ID
   * @param msgId 消息 ID
   * @returns 是否成功消费
   */
  function consumeDequeuedQueueId(sid: Session['id'], msgId: Message['id']) {
    const ids = dequeueQueueIds.value.get(sid)
    if (!ids?.has(msgId)) return false
    const nextIds = new Set(ids)
    nextIds.delete(msgId)
    const nextMap = new Map(dequeueQueueIds.value)
    if (nextIds.size > 0) {
      nextMap.set(sid, nextIds)
    } else {
      nextMap.delete(sid)
    }
    dequeueQueueIds.value = nextMap
    return true
  }

  /**
   * 处理对等用户消息（从其他设备/CLI/Telegram 发送的消息）
   * - 当服务器广播来自其他客户端的用户消息时，将其添加到本地会话中
   * @param evt 运行事件
   */
  function handlePeerUserMessage(evt: RunEvent) {
    const sid = evt.session_id
    if (!sid || activeSessionId.value !== sid || !activeSession.value) return

    const peer = evt.message as PeerMessage
    const content = typeof peer?.content === 'string' ? peer.content : ''
    if (!content.trim()) return

    const msgId = peer?.id ? String(peer.id) : ''
    const msgs = getSessionMessages(sid)

    // 如果消息已存在，恢复运行
    if (msgId && msgs.some(_ => _.id === msgId)) {
      serverWorking.value.add(sid)
      resumeServerWorkingRun(sid, true)
      return
    }

    // 如果消息在队列中，恢复运行
    if (msgId && queuedUserMessages.value.get(sid)?.some(_ => _.id === msgId)) {
      serverWorking.value.add(sid)
      resumeServerWorkingRun(sid, true)
      return
    }

    const timestamp = typeof peer?.timestamp === 'number' && Number.isFinite(peer.timestamp)
      ? Math.round(peer.timestamp * 1000)
      : Date.now()

    const msg = new Message({
      id: msgId ?? uuid(),
      role: peer?.role === Message.ROLE.Command ? Message.ROLE.Command : Message.ROLE.User,
      content,
      timestamp,
      queued: !!peer?.queued,
      systemType: peer?.role === Message.ROLE.Command ? Message.ROLE.Command : undefined
    })

    // 检查是否已标记为出队
    const wasDequeued = msgId ? consumeDequeuedQueueId(sid, msgId) : false

    // 如果消息在队列中或会话正在运行，添加到队列；否则直接添加到消息列表
    if (peer?.queued || (!wasDequeued && isSessionLive(sid))) {
      enqueueUserMessage(sid, msg)
    } else {
      addMessage(sid, msg)
      updateSessionTitle(sid)
    }

    // 恢复运行监听
    serverWorking.value.add(sid)
    resumeServerWorkingRun(sid, true)
  }

  /**
   * 发送消息
   *
   * 消息发送的核心流程：
   * 1. 验证内容（非空或有附件）
   * 2. 预加载完成提示音
   * 3. 如果没有活跃会话，创建新会话
   * 4. 构建用户消息对象（支持排队）
   * 5. 处理附件上传和内容块构建
   * 6. 构建运行请求 Payload
   * 7. 调用 startRun API 发起运行
   * 8. 注册运行事件回调
   *
   * @param content 消息内容
   * @param attachments 附件列表（可选）
   */
  async function sendMessage(content: string, attachments?: Attachment[]) {
    if (!content && !attachments?.length) return

    // 在发送时捕获会话 ID —— 所有回调都使用这个
    const sid = activeSessionId.value!

    // 判断是否需要发送初始会话配置（首次消息）
    const shouldSendInitialSessionConfig = activeSession.value
      ? activeSession.value.messageCount === undefined || activeSession.value.messageCount === 0
      : false

    // 判断会话类型
    const isCodingAgentSession = activeSession.value?.source === Session.SOURCE.CodingAgent
    const isBridgeSlashCommand = !isCodingAgentSession && content.trim().startsWith('/')
    const isBridgeCompressCommand = isBridgeSlashCommand && /^\/compress(?:\s|$)/i.test(content.trim())
    const isBridgePlanCommand = isBridgeSlashCommand && /^\/plan(?:\s|$)/i.test(content.trim())
    const isBridgeGoalCommand = isBridgeSlashCommand && /^\/goal(?:\s|$)/i.test(content.trim())

    // 判断是否需要排队（会话正在运行时，除了压缩命令外的消息都需要排队）
    const wasLiveBeforeSend = isSessionLive(sid)
    const shouldQueue = wasLiveBeforeSend && (!isBridgeSlashCommand || isBridgePlanCommand)

    // 创建用户消息对象
    const userMsg = new Message({
      id: uuid(),
      role: isBridgeSlashCommand ? Message.ROLE.Command : Message.ROLE.User,
      content: content.trim(),
      timestamp: Date.now(),
      attachments,
      queued: shouldQueue,
      systemType: isBridgeSlashCommand ? Message.SYSTEM_TYPE.Command : undefined
    })
    console.warn('userMsg:', userMsg)

    let runSubmitted = false

    // 如果没有活跃会话，创建新会话
    if (!activeSession.value) {
      const session = createSession()
      await switchSession(session.id)
    }

    // 如果需要排队，添加到队列；否则直接添加到消息列表
    if (shouldQueue) {
      enqueueUserMessage(sid, userMsg)
    } else {
      addMessage(sid, userMsg)
      updateSessionTitle(sid)
      if (!isCodingAgentSession) {
        serverWorking.value.add(sid)
      }
    }

    try {
      // 获取运行配置
      await appStore.waitForModelsForRun()

      // 如果是首次消息，更新消息计数
      if (shouldSendInitialSessionConfig && activeSession.value) {
        activeSession.value.messageCount = Math.max(activeSession.value.messageCount || 0, 1)
      }

      const sessionModel = activeSession.value?.model || appStore.selectedModel
      const sessionProvider = activeSession.value?.provider || appStore.selectedProvider
      const sessionProfile = activeSession.value?.profile || profileStore.activeProfileName
      const profileModelGroups = sessionProfile ? appStore.profileModelGroups.find(_ => _.profile === sessionProfile)?.groups : undefined
      const runModelGroups = profileModelGroups?.length ? profileModelGroups : appStore.modelGroups
      const providerGroup = runModelGroups.find(_ => _.provider === sessionProvider)
      const sessionSource: StartRunRequest['source'] = activeSession.value?.source === Session.SOURCE.CodingAgent ? Session.SOURCE.CodingAgent : Session.SOURCE.Cli
      const codingAgentId = activeSession.value?.codingAgentId || (activeSession.value?.agent === Session.CODING_AGENT_ID.Codex ? Session.CODING_AGENT_ID.Codex : Session.CODING_AGENT_ID.ClaudeCode)
      const codingAgentMode = activeSession.value?.codingAgentMode || Session.CODING_AGENT_MODE.Scoped

      // 清理会话的流状态
      const cleanup = () => {
        streamStates.value.delete(sid)
        serverWorking.value.delete(sid)
      }

      /**
       * 关闭所有流式助手消息（设置 isStreaming 为 false）
       */
      const closeStreamingAssistant = () => {
        const msgs = getSessionMessages(sid)
        msgs.forEach(_ => {
          if (_.role === Message.ROLE.Assistant && _.isStreaming) {
            updateMessage(sid, _.id, { isStreaming: false })
          }
        })
        activeAssistantMessageId = undefined
        reasoningAssistantMessageId = undefined
        activeRunMarker = undefined
      }

      /**
       * 每活跃运行的标志，用于在 run.completed 时检测静默吞没的错误。
       * hermes-agent 偶尔会在代理层捕获上游错误（如无效 API 密钥）时，
       * 发出带有空输出且无使用量的 run.completed。
       * 需要区分：(a) 产生了助手文本的运行，(b) 只有工具活动的运行，(c) 确实没有任何可见内容的运行。
       * 在每次 run.started 时重置，因为一个处理程序可能跨越多个排队的运行。
       */
      let runProducedAssistantText = false
      // let runProducedAssistantContent = false // 语音相关
      let runHadToolActivity = false
      let activeAssistantMessageId: string | undefined
      let reasoningAssistantMessageId: string | undefined
      let activeRunMarker: string | undefined

      let input: string | ContentBlock[] = ''

      // 构建 Anthropic 格式的输入
      if (attachments?.length) {
        // Todo: 构建 Anthropic 格式的输入
      } else {
        input = content.trim()
      }

      // 构建运行请求 Payload
      const runPayload: StartRunRequest = {
        input,
        session_id: sid,
        profile: sessionProfile,
        model: sessionSource === Session.SOURCE.CodingAgent
          ? (codingAgentMode === Session.CODING_AGENT_MODE.Global ? undefined : sessionModel)
          : shouldSendInitialSessionConfig ? sessionModel : undefined,
        provider: sessionSource === Session.SOURCE.CodingAgent
          ? (codingAgentMode === Session.CODING_AGENT_MODE.Global ? undefined : sessionProvider)
          : shouldSendInitialSessionConfig ? sessionProvider : undefined,
        model_groups: runModelGroups.map(_ => ({
          provider: _.provider,
          models: _.models
        })),
        queue_id: userMsg.id,
        workspace: activeSession.value?.workspace,
        source: sessionSource,
        // Coding Agent 特有配置
        ...(sessionSource === Session.SOURCE.CodingAgent
            ? {
              coding_agent_id: codingAgentId,
              mode: codingAgentMode,
              baseUrl: codingAgentMode === Session.CODING_AGENT_MODE.Global ? undefined : activeSession.value?.baseUrl || providerGroup?.base_url,
              apiKey: codingAgentMode === Session.CODING_AGENT_MODE.Global ? undefined : activeSession.value?.apiKey || providerGroup?.api_key,
              apiMode: codingAgentMode === Session.CODING_AGENT_MODE.Global ? undefined : activeSession.value?.apiMode || providerGroup?.api_mode
            }
            : {}
        ),
        // 每会话推理努力覆盖。Coding Agent runner 目前不使用此设置，保持 payload 显式。
        reasoning_effort: sessionSource === Session.SOURCE.CodingAgent ? undefined : activeSession.value?.reasoningEffort
      }

      /**
       * 应用重连恢复数据
       *
       * 当 Socket.IO 重连后，服务器会发送恢复数据，包括消息列表、运行状态、队列等。
       * 此函数负责将这些数据应用到本地状态。
       *
       * @param data 恢复会话的 payload
       */
      const applyReconnectResume = (data: ResumeSessionPayload) => {
        console.log('applyReconnectResume')
        if (data.session_id !== sid) return
        const target = getSession(sid)
        if (!target) return

        // 更新服务器工作状态
        if (data.isWorking) {
          serverWorking.value.add(sid)
        } else {
          serverWorking.value.delete(sid)
        }

        // 更新队列长度
        if (data.queueLength && data.queueLength > 0) {
          queueLengths.value.set(sid, data.queueLength)
        } else {
          queueLengths.value.delete(sid)
        }

        // 更新队列消息
        if (Array.isArray(data.queueMessages)) {
          replaceQueuedUserMessages(sid, normalizeQueuedUserMessages(data.queueMessages))
        } else if (!data.queueLength) {
          replaceQueuedUserMessages(sid, [])
        }

        // 更新中断状态
        if (data.isAborting) {
          setAbortState({ aborting: true, synced: undefined })
        } else if (!data.isWorking) {
          setAbortState(null)
        }

        // 设置会话的压缩状态
        if (!data.isWorking) {
          setCompressionState(sid, null)
        }

        // 更新 token 计数
        if (data.inputTokens != undefined) {
          target.inputTokens = data.inputTokens
        }
        if (data.outputTokens != undefined) {
          target.outputTokens = data.outputTokens
        }
        if (data.contextTokens != undefined) {
          target.contextTokens = data.contextTokens
        }

        // 更新消息列表
        if (Array.isArray(data.messages)) {
          const previousActiveAssistantMessageId = activeAssistantMessageId
          const previousReasoningAssistantMessageId = reasoningAssistantMessageId
          const replayRunMarker = getReplayRunMarker(data.events) ?? activeRunMarker

          target.messages = mapHermesMessages(data.messages)
          target.loadedMessageCount = data.messageLoadedCount ?? data.messages.length
          target.messageTotal = data.messageTotal
          target.hasMoreBefore = data.hasMoreBefore ?? target.loadedMessageCount < target.messageTotal!

          // 解析恢复的助手状态
          const resumedAssistantState: ReturnType<typeof resolveResumedAssistantState> = data.isWorking
            ? resolveResumedAssistantState(target.messages, {
              previousActiveAssistantMessageId,
              previousReasoningAssistantMessageId,
              activeRunMarker: replayRunMarker
            }) : {
              activeAssistant: null,
              reasoningAssistant: null,
              runMarker: undefined,
              hadVisibleText: false
            }


          const resumedActiveAssistant = resumedAssistantState.activeAssistant
          const resumedReasoningAssistant = resumedAssistantState.reasoningAssistant
          activeRunMarker = resumedAssistantState.runMarker

          // 更新活跃助手消息
          if (resumedActiveAssistant) {
            resumedActiveAssistant.isStreaming = true
            activeAssistantMessageId = resumedActiveAssistant.id
            if (resumedAssistantState.hadVisibleText) {
              runProducedAssistantText = true
            }
          } else {
            activeAssistantMessageId = undefined
          }

          // 更新推理消息
          if (resumedReasoningAssistant) {
            reasoningAssistantMessageId = resumedReasoningAssistant.id
            if (resumedReasoningAssistant.reasoning) noteReasoningStart(resumedReasoningAssistant.id)
          } else {
            reasoningAssistantMessageId = undefined
          }

          // 重放事件（压缩、中断、审批、澄清等）
          if (data.events?.length) {
            for (const evt of data.events) {
              const e = evt.data as RunEvent
              switch (e.event) {
                case 'compression.started':
                  setCompressionState(sid, {
                    compressing: true,
                    messageCount: e.message_conunt ?? 0,
                    beforeTokens: e.token_count ?? 0,
                    afterTokens: 0,
                    compressed: false
                  })
                  break

                case 'compression.completed':
                  const afterTokens = e.contextTokens ?? e.afterTokens ?? 0
                  setCompressionState(sid, {
                    compressing: false,
                    messageCount: e?.totalMessages ?? 0,
                    beforeTokens: e.beforeTokens ?? 0,
                    afterTokens,
                    compressed: e.compressed ?? false,
                    error: e.error
                  })
                  target.contextTokens = e.contextTokens ?? target.contextTokens
                  break

                case 'abort.started':
                  setAbortState({ aborting: true, synced: undefined })
                  break

                case 'abort.timeout':
                  setAbortState({ aborting: true, synced: false, timedOut: true, message: (e as any).message })
                  break

                case 'abort.completed':
                  setAbortState({ aborting: false, synced: (e as any).synced ?? false })
                  break

                //  Todo: approval.requested
                case 'approval.requested':
                  console.warn('Todo: approval.requested')
                  break

                // Todo: approval.resolved
                case 'approval.resolved':
                  console.warn('Todo: approval.resolved')
                  break

                // Todo: clarify.requested
                case 'clarify.requested':
                  console.warn('Todo: clarify.requested')
                  break

                case 'run.failed':
                  addAgentErrorMessage(sid, e.error)
                  break

                case 'agent.event':
                  handleAgentEvent(e)
                  break
              }
            }
          }

          // 更新活跃会话引用
          if (activeSessionId.value === sid) {
            activeSession.value = target
          }

          // 如果运行已完成且无队列消息，清理状态
          if (!data.isWorking && !(data.queueLength && data.queueLength > 0)) {
            clearAgentEventMessages(sid)
            cleanup()
            activeAssistantMessageId = undefined
            updateSessionTitle(sid)
          }

        }

      }

      // 通过 Socket.IO 发送运行请求并监听流式事件 —— 所有闭包都捕获 `sid`
      const ctrl = startRunViaSocket(
        runPayload,
        // onEvent 回调：处理运行事件
        (evt: RunEvent) => {
          const eventRunMarker = readRunMarker(evt)
          if (eventRunMarker) activeRunMarker = eventRunMarker
          // console.log('onEvent:', evt.event, evt)
          switch (evt.event) {
            case 'run.started': {
              // 运行开始：重置状态
              serverWorking.value.add(sid)
              clearAgentEventMessages(sid)
              setAbortState(null)
              setCompressionState(sid, null)
              runProducedAssistantText = false
              runHadToolActivity = false
              closeStreamingAssistant()
              activeRunMarker = readRunMarker(evt)
              // 更新队列长度
              if (evt.queue_length && evt.queue_length > 0) {
                queueLengths.value.set(sid, evt.queue_length)
              } else {
                queueLengths.value.delete(sid)
              }
              break
            }

            // 运行排队
            case 'run.queued':
              handleRunQueuedEvent(sid, evt)
              break

            case 'session.command':
              // 会话命令：处理命令事件（如重命名会话）
              handleSessionCommandEvent(evt)
              break

            // Todo: agent.event
            case 'agent.event':
              console.warn('Todo: agent.event')
              break

            case 'compression.started':
              setCompressionState(sid, {
                compressing: true,
                messageCount: evt.message_count ?? 0,
                beforeTokens: evt.token_count ?? 0,
                afterTokens: 0,
                compressed: false
              })
              break

            case 'compression.completed': {
              // 压缩完成：更新压缩状态和 token 计数
              const afterTokens = evt.contextTokens ?? evt.afterTokens ?? 0
              setCompressionState(sid, {
                compressing: false,
                messageCount: evt.totalMessages ?? 0,
                beforeTokens: evt.beforeTokens ?? 0,
                afterTokens,
                compressed: evt.compressed ?? false,
                error: evt.error
              })

              // 更新上下文 token 计数
              if (evt.contextTokens != undefined) {
                const  target = getSession(sid)
                if (target) {
                  target.contextTokens = evt.contextTokens
                }
              }

              // 5秒后自动清除压缩状态
              setTimeout(() => {
                const state = compressionStates.value.get(sid)
                if (state && !state.compressing) {
                  setCompressionState(sid, null)
                }
              }, 5000)

              break
            }

            case 'reasoning.delta':
            case 'thinking.delta': {
              // 推理增量：累积推理文本
              const text = evt.text || evt.delta || ''
              if (!text) break

              runProducedAssistantText = true
              const msgs = getSessionMessages(sid)
              const reasoningTargetId = reasoningAssistantMessageId || activeAssistantMessageId
              const last = reasoningTargetId ? msgs.find(_ => _.id === reasoningTargetId) : null
              if (last?.role === Message.ROLE.Assistant) {
                // 追加到现有消息的 reasoning 字段
                last.reasoning = (last.reasoning ?? '') + text
                reasoningAssistantMessageId = last.id
                noteReasoningStart(last.id)
              } else {
                // 创建新的助手消息（仅包含推理）
                const newId = uuid()
                addMessage(sid, new Message({
                  id: newId,
                  role: Message.ROLE.Assistant,
                  content: '',
                  timestamp: Date.now(),
                  isStreaming: true,
                  reasoning: text
                }))
                activeAssistantMessageId = newId
                reasoningAssistantMessageId = newId
                noteReasoningStart(newId)
              }
              break
            }

            case 'reasoning.available': {
              // 推理可用：标记推理结束（上游发送的是预览内容，不是真正的推理）
              // 只作为"思考结束"信号，停止时长计数器
              const last = getSessionMessages(sid).at(-1)
              if (last?.role === Message.ROLE.Assistant && last.isStreaming) {
                // 只有当 reasoning.delta 事件曾经启动过计时，才标记结束；
                // 否则（上游未转发 delta，只发这一次 available）不显示时长。
                noteReasoningEnd(last.id)
              }
              break
            }

            case 'message.delta': {
              // 消息增量：累积助手回复文本
              if (evt.delta) {
                runProducedAssistantText = true
              }
              const msgs = getSessionMessages(sid)
              const last = activeAssistantMessageId ? msgs.find(_ => _.id === activeAssistantMessageId) : null
              if (last?.role === Message.ROLE.Assistant && last.isStreaming) {
                // 追加到现有消息
                const prev = last.content
                const next = prev + (evt.delta || '')
                noteThinkingDelta(last.id, prev, next)

                // 若之前有 reasoning 累积，则 content 到达即视为推理结束
                if (last.reasoning) noteReasoningEnd(last.id)
                last.content = next
              } else {
                // 创建新的助手消息
                const newId = uuid()
                const nextContent = evt.delta || ''
                noteThinkingDelta(newId, '', nextContent)
                addMessage(sid, new Message({
                  id: newId,
                  role: Message.ROLE.Assistant,
                  content: nextContent,
                  timestamp: Date.now(),
                  isStreaming: true
                }))
                activeAssistantMessageId = newId
              }
              break
            }

            case 'tool.started': {
              // 工具调用开始：创建或更新工具消息
              runHadToolActivity = true
              const msgs = getSessionMessages(sid)
              const toolCallId = evt.tool_call_id
              // 找到相关的助手消息并结束流式
              const last = activeAssistantMessageId
                ? msgs.find(_ => _.id === activeAssistantMessageId)
                : msgs.at(-1)
              if (last?.isStreaming) {
                updateMessage(sid, last.id, { isStreaming: false })
              }
              activeAssistantMessageId = undefined
              // 查找是否已存在相同 toolCallId 的工具消息
              const existingTool = toolCallId
                ? msgs.find(_ => _.role === Message.ROLE.Tool && _.toolCallId === toolCallId)
                : null
              if (existingTool) {
                // 更新现有工具消息
                updateMessage(sid, existingTool.id, {
                  toolName: evt.tool || evt.name,
                  toolArgs: hasRuntimeToolPayload(evt.arguments) ? evt.arguments : existingTool.toolArgs,
                  toolPreview: evt.preview || existingTool.toolPreview,
                  toolStatus: existingTool.toolStatus || Message.TOOL_STATUS.Running,
                })
                break
              }
              // 创建新的工具消息
              addMessage(sid, new Message({
                id: uuid(),
                role: Message.ROLE.Tool,
                content: '',
                timestamp: Date.now(),
                toolName: evt.tool || evt.name,
                toolCallId,
                toolPreview: evt.preview,
                toolArgs: runtimeToolPayloadOrUndefined(evt.arguments),
                toolStatus: Message.TOOL_STATUS.Running,
              }))
              break
            }

            case 'tool.completed': {
              // 工具调用完成：更新工具消息状态和结果
              runHadToolActivity = true
              const msgs = getSessionMessages(sid)
              const toolCallId = evt.tool_call_id
              // 查找相关的工具消息（优先按 toolCallId，否则找运行中的工具）
              const toolMsgs = toolCallId
                ? msgs.filter(_ => _.role === Message.ROLE.Tool && _.toolCallId === toolCallId)
                : msgs.filter(_ => _.role === Message.ROLE.Tool && _.toolStatus === Message.TOOL_STATUS.Running)
              if (toolMsgs.length > 0) {
                const last = toolMsgs.at(-1)
                const output = runtimeToolPayloadOrUndefined(evt.output)
                const hasError = evt.error || runtimeToolOutputHasError(output)
                const duration = evt.duration
                last?.id && updateMessage(sid, last.id, {
                  toolStatus: hasError ? Message.TOOL_STATUS.Error : Message.TOOL_STATUS.Done,
                  toolDuration: duration,
                  toolResult: output,
                })
              }
              break
            }

            case 'run.completed': {
              // 运行完成：清理状态、更新消息、处理最终输出
              clearAgentEventMessages(sid)
              const msgs = getSessionMessages(sid)
              const lastMsg = activeAssistantMessageId ? msgs.find(_ => _.id === activeAssistantMessageId) : msgs.at(-1)
              const completedAssistantMessageId  = lastMsg?.role === Message.ROLE.Assistant && lastMsg.isStreaming ? lastMsg.id : undefined

              // 结束流式消息
              if (lastMsg?.isStreaming) {
                updateMessage(sid, lastMsg.id, { isStreaming: false })
              }

              // 完成所有运行中的工具
              settleRunningTools(sid, Message.TOOL_STATUS.Done)

              // 更新服务器计算的 token 使用量
              if (evt.inputTokens != null) {
                const target = getSession(sid)
                if (target) {
                  target.inputTokens = evt.inputTokens
                  target.outputTokens = evt.outputTokens
                  target.contextTokens = evt.contextTokens ?? target.contextTokens
                }
              }

              // 备用方案：某些提供商可能只通过 run.completed.output 发送最终助手文本（无 message.delta 流）。
              // 如果从未产生过助手文本但网关报告了非空输出，则回退到渲染为单个助手消息。
              let finalOutputTrimmed = ''

              // 检查后端是否提供了解析后的内容（从字符串化数组格式）
              if (evt.parsed_content != undefined) {
                // 后端有解析的字符串化数组格式，更新最后一条助手消息
                const msgs = getSessionMessages(sid)
                const lastAssistant = activeAssistantMessageId
                  ? msgs.find(_ => _.id === activeAssistantMessageId)
                  : completedAssistantMessageId
                    ? msgs.find(_ => _.id === completedAssistantMessageId)
                    : undefined
                const parsedContent = typeof evt.parsed_content === 'string' ? evt.parsed_content : ''
                const parsedContentTrimmed = parsedContent.trim()

                if (lastAssistant) {
                  const existingContentTrimmed = lastAssistant.content?.trim() ?? ''
                  // 如果解析内容非空或现有内容为空，则更新消息
                  if (parsedContentTrimmed || !existingContentTrimmed) {
                    updateMessage(sid, lastAssistant.id, {
                      content: parsedContent,
                    })
                    finalOutputTrimmed = parsedContentTrimmed
                    if (parsedContentTrimmed) {
                      runProducedAssistantText = true
                    }
                  } else {
                    finalOutputTrimmed = existingContentTrimmed
                    runProducedAssistantText = true
                  }
                  // 更新推理内容
                  if (evt.parsed_reasoning) {
                    updateMessage(sid, lastAssistant.id, {
                      reasoning: evt.parsed_reasoning,
                    })
                  }
                } else if (parsedContentTrimmed) {
                  // 创建新的助手消息
                  addMessage(sid, new Message({
                    id: uuid(),
                    role: Message.ROLE.Assistant,
                    content: parsedContent,
                    reasoning: typeof evt.parsed_reasoning === 'string' ? evt.parsed_reasoning : undefined,
                    timestamp: Date.now(),
                  }))
                  finalOutputTrimmed = parsedContentTrimmed
                  runProducedAssistantText = true
                }
              } else {
                // 回退到 output 字段（遗留行为）
                const finalOutput = typeof evt.output === 'string' ? evt.output : ''
                finalOutputTrimmed = finalOutput.trim()
                if (!runProducedAssistantText && finalOutputTrimmed !== '') {
                  addMessage(sid, new Message({
                    id: uuid(),
                    role: Message.ROLE.Assistant,
                    content: finalOutput,
                    timestamp: Date.now()
                  }))
                  runProducedAssistantText = true
                }
              }

              // 解决上游 hermes-agent bug：当代理层静默吞没错误（如无效 API 密钥、不支持的模型）时，
              // 网关仍会发出 run.completed 但输出为空。如果不在此显示错误，聊天 UI 看起来会像冻结/
              // "成功但无回复"。通过以下组合检测：无助手文本 AND 无工具活动 AND 空最终输出。
              const swallowedError = !runProducedAssistantText && !runHadToolActivity && finalOutputTrimmed === ''
              if (swallowedError) {
                // 添加错误消息
                addMessage(sid, new Message({
                  id: uuid(),
                  role: Message.ROLE.System,
                  content: 'Error: Agent returned no output. The model call may have failed (e.g. invalid API key, model not supported by provider, or context exceeded). Check the hermes-agent logs for details.',
                  timestamp: Date.now()
                }))
              } else {
                // 播放完成提示音并显示通知
                console.warn('播放完成提示音并显示通知')
              }

              // 如果还有队列消息，更新队列长度；否则清理状态
              if (evt.queue_remaining && evt.queue_remaining> 0) {
                queueLengths.value.set(sid, evt.queue_remaining)
              } else {
                cleanup()
              }

              activeAssistantMessageId = undefined
              reasoningAssistantMessageId = undefined
              activeRunMarker = undefined
              updateSessionTitle(sid)
              break
            }

            case 'run.failed': {
              // 运行失败：清理状态并添加错误消息
              clearAgentEventMessages(sid)

              // 更新 token 使用量
              if (evt.inputTokens != undefined) {
                const target = getSession(sid)
                if (target) {
                  target.inputTokens = evt.inputTokens
                  target.outputTokens = evt.outputTokens
                  if (evt.contextTokens != undefined) {
                    target.contextTokens = evt.contextTokens
                  }
                }
              }

              // 添加错误消息
              addAgentErrorMessage(sid, evt.error)

              // 将所有运行中的工具状态改为错误
              settleRunningTools(sid, 'error')

              // 如果还有队列消息，更新队列长度；否则清理状态
              if (evt.queue_remaining && evt.queue_remaining > 0) {
                queueLengths.value.set(sid, evt.queue_remaining)
              } else {
                cleanup()
              }

              activeAssistantMessageId = undefined
              reasoningAssistantMessageId = undefined
              activeRunMarker = undefined
              break
            }

            case 'usage.updated': {
              // 使用量更新：更新 token 计数
              const target = getSession(sid)
              if (target) {
                target.inputTokens = evt.inputTokens
                target.outputTokens = evt.outputTokens
                if (evt.contextTokens) {
                  target.contextTokens = evt.contextTokens
                }
              }
              break
            }

            // 子 Agent 事件
            case 'subagent.start':
            case 'subagent.tool':
            case 'subagent.progress':
            case 'subagent.complete':
              console.warn('Todo:子 Agent 事件')
              break

            // 审批请求
            case 'approval.requested':
              setPendingApproval(evt)
              break

            // 审批解决
            case 'approval.resolved':
              clearPendingApproval(evt)
              break

            // 澄清请求
            case 'clarify.requested':
              setPendingClarify(evt)
              break

            // 澄清解决
            case 'clarify.resolved':
              clearPendingClarify(evt)
              break
          }
        },
        // onDone 回调：流正常结束
        () => {
          const last = getSessionMessages(sid).at(-1)
          if (last?.isStreaming) {
            updateMessage(sid, last.id, { isStreaming: false })
          }
          cleanup()
          activeAssistantMessageId = undefined
          reasoningAssistantMessageId = undefined
          activeRunMarker = undefined
          updateSessionTitle(sid)
        },
        // onError 回调：流发生错误
        (err) => {
          console.error('Socket.IO run stream error:', err.message)
          addAgentErrorMessage(sid, err.message)
          const msgs = getSessionMessages(sid)
          // 将所有运行中的工具状态改为错误
          msgs.forEach((_, idx) => {
            if (_.role === Message.ROLE.Tool && _.toolStatus === Message.TOOL_STATUS.Running) {
              msgs[idx] = new Message({ ..._, toolStatus: Message.TOOL_STATUS.Error})
            }
          })
          cleanup()
          activeAssistantMessageId = undefined
          reasoningAssistantMessageId = undefined
          activeRunMarker = undefined
        },
        undefined,
        { onReconnectResume: applyReconnectResume }
      )

      runSubmitted = true

      // 根据会话类型和命令类型注册流控制器
      if (isCodingAgentSession) {
        serverWorking.value.add(sid)
        streamStates.value.set(sid, ctrl)
      } else if (!isBridgeSlashCommand || isBridgeCompressCommand || isBridgePlanCommand || isBridgeGoalCommand) {
        streamStates.value.set(sid, ctrl)
      }
    } catch (err: any) {
      console.error('ctrl:\n', err)
      // 发送失败处理
      if (shouldQueue && !runSubmitted) {
        dropQueuedUserMessage(sid, userMsg.id)
      }

      if (!shouldQueue && !runSubmitted) {
        // 如果消息已发送，移除工作状态
        serverWorking.value.delete(sid)
      }

      // 添加错误消息
      addMessage(sid, new Message({
        id: uuid(),
        role: Message.ROLE.System,
        content: `Error: ${err.message}`,
        timestamp: Date.now()
      }))
    }
  }

  /**
   * 清除会话的所有待处理交互（审批和澄清）
   * @param sid 会话 ID
   */
  function clearPendingInteractions(sid: Session['id']) {
    let changed = false
    if (pendingApprovals.value.has(sid)) {
      pendingApprovals.value.delete(sid)
      changed = true
    }
    if (pendingClarifies.value.has(sid)) {
      pendingClarifies.value.delete(sid)
      changed = true
    }
    if (changed) {
      pendingApprovals.value = new Map(pendingApprovals.value)
      pendingClarifies.value = new Map(pendingClarifies.value)
    }
  }

  /**
   * 停止流式传输（中断当前运行）
   */
  function stopStreaming() {
    const sid = activeSessionId.value
    if (!sid) return
    if (isAborting.value) return

    // 清除待处理交互
    clearPendingInteractions(sid)

    // 通过流控制器中断
    const ctrl = streamStates.value.get(sid)
    if (ctrl) {
      setAbortState({ aborting: true, synced: undefined })
      ctrl.abort()
      const last = getSessionMessages(sid).at(-1)
      if (last?.isStreaming) {
        updateMessage(sid, last.id, { isStreaming: false })
      }
      return
    }

    // 如果没有流控制器但服务器正在工作，直接发送中断事件
    if (serverWorking.value.has(sid)) {
      setAbortState({ aborting: true, synced: undefined })
      getChatRunSocket()?.emit('abort', { session_id: sid })
      const last = getSessionMessages(sid).at(-1)
      if (last?.isStreaming) {
        updateMessage(sid, last.id, { isStreaming: false })
      }
    }
  }

  /**
   * 获取消息的思考观察数据
   *
   * @param msgId 消息 ID
   * @returns 思考观察数据
   */
  function getThinkingObservation(msgId: Message['id']) {
    return thinkingObservation.get(msgId)
  }

  /**
   * 处理全局会话命令
   * @param evt 运行事件
   */
  function handleGlobalSessionCommand(evt: RunEvent) {
    const sid = evt.session_id
    if (!sid || activeSessionId.value !== sid || !activeSession.value) return
    const shouldAttachToStartedRun = evt.started === true && evt.terminal === false
    handleSessionCommandEvent(evt)
    // 如果是已启动的运行，恢复监听
    if (shouldAttachToStartedRun) {
      serverWorking.value.add(sid)
      resumeServerWorkingRun(sid, true)
    }
  }

  /**
   * 处理会话命令事件
   *
   * 支持的命令类型：
   * - clear: 清空消息历史
   * - title: 更新会话标题
   * - usage: 更新 token 使用情况
   * - destroy: 销毁会话
   *
   * @param evt 运行事件
   */
  function handleSessionCommandEvent(evt: RunEvent) {
    // 使用 WeakSet 防止重复处理相同事件
    if (seenSessionCommandEvents.has(evt)) return
    seenSessionCommandEvents.add(evt)

    const sid = evt.session_id
    if (!sid) return

    const target = getSession(sid)
    const action = evt.action
    const command = String(evt.command || '').toLowerCase()

    if (evt.started === true && evt.terminal === false) {
      serverWorking.value.add(sid)
    }

    // 清空命令处理
    if (action === 'clear' && command === 'clear') {
      if (target) {
        target.messages = []
      }
      queuedUserMessages.value.delete(sid)
      queueLengths.value.delete(sid)
      if (evt.clearHistory) {
        const content = String(evt.message as string || '')
        if (content) {
          addMessage(sid, new Message({
            id: uuid(),
            role: Message.ROLE.Command,
            content,
            timestamp: Date.now(),
            systemType: evt.ok ? Message.SYSTEM_TYPE.Command : Message.SYSTEM_TYPE.Error,
            commandAction: action,
            commandData: { ...evt }
          }))
        }
      }
      return
    }

    // 标题更新命令处理
    if (action === 'title' && target && typeof evt.title === 'string') {
      target.title = evt.title
      target.updatedAt = Date.now()
    }

    // 销毁命令处理
    if (action === 'destroy') {
      streamStates.value.delete(sid)
      serverWorking.value.delete(sid)
      queueLengths.value.delete(sid)
      queuedUserMessages.value.delete(sid)
      setAbortState(null)
      getSessionMessages(sid).forEach(_ => {
        if (_.isStreaming) {
          _.isStreaming = false
        }
        if (_.role === Message.ROLE.Tool && _.toolStatus === Message.TOOL_STATUS.Running) {
          _.toolStatus = Message.TOOL_STATUS.Error
        }
      })
    }

    // 使用量更新命令处理
    if (action === 'usage' && target) {
      target.inputTokens = evt.inputTokens
      target.outputTokens = evt.outputTokens
      target.contextTokens = evt.contextTokens ?? target.contextTokens
    }

    // 添加命令消息（如果有消息内容）
    const message = String(evt.message as string || '')
    // console.log('handleSessionCommandEvent:', { target, action, command, evt, message })
    if (message) {
      addMessage(sid, new Message({
        id: uuid(),
        role: Message.ROLE.Command,
        content: message,
        timestamp: Date.now(),
        systemType: evt.ok === true ? Message.SYSTEM_TYPE.Command : Message.SYSTEM_TYPE.Error,
        commandAction: action,
        commandData: { ...evt }
      }))
    }
  }

  /**
   * 获取指定会话
   * @param sid 会话 ID
   * @returns 会话对象
   */
  function getSession(sid: Session['id']) {
    return sessions.value.find(_ => _.id === sid)
  }

  /**
   * 页面刷新后恢复正在进行的运行
   * - 通过 Socket.IO 发送 'resume' 事件加入服务器的会话房间
   * - 然后设置事件监听器接收持续的事件
   * @param sid 会话 ID
   * @param force 是否强制恢复（即使服务器没有报告活跃运行）
   */
  function resumeServerWorkingRun(sid: Session['id'], force = false) {
    // 如果已经在流式传输，不注册重复监听器
    if (streamStates.value.has(sid)) return

    // 只有当服务器在恢复期间报告了活跃运行时才设置监听器
    if (!force && !serverWorking.value.has(sid)) return

    // 防止重复清理的幂等标志
    let closed = false

    /*
     * 记录恢复时的助手状态
     * - 每活跃运行的标志，用于在 run.completed 时检测静默吞没的错误。
     * - hermes-agent 偶尔会在代理层捕获上游错误（如无效 API 密钥）时，发出带有空输出且无使用量的 run.completed。
     * - 需要区分：(a) 产生了助手文本的运行，(b) 只有工具活动的运行，(c) 确实没有任何可见内容的运行。
     * - 在每次 run.started 时重置，因为一个处理程序可能跨越多个排队的运行。
     */

      // 是否产生过任何助手文本（包括 reasoning/thinking/message.delta）。用于 run.completed 时判断是否"吞掉错误"
    let runProducedAssistantText = false

    // 是否有工具活动（包括运行中的工具和已完成的工具）。用于 run.completed 时判断是否"吞掉错误"
    let runHadToolActivity = false

    // 当前助手消息 ID
    let activeAssistantMessageId: string | undefined

    // 当前正在流式写入的助手消息 ID。 message.delta 会向此消息追加内容； tool.started 时会先关闭它的 isStreaming 状态
    let reasoningAssistantMessageId: string | undefined

    // 当前 run 的标记符，用于跨事件追踪同一次 run。每次 run.started 或带 marker 的事件都会更新它
    let activeRunMarker: string | undefined

    // 清理恢复状态
    function cleanup() {
      if (closed) return
      closed = true
      streamStates.value.delete(sid)
      serverWorking.value.delete(sid)
      // 从全局会话处理器注销事件监听器
      unregisterSessionHandlers(sid)
    }

    // 关闭流式助手
    function closeStreamingAssistant() {
      const msgs = getSessionMessages(sid)
      msgs.forEach(_ => {
        if (_.role === Message.ROLE.Assistant && _.isStreaming) {
          updateMessage(sid, _.id, { isStreaming: false })
        }
      })
      activeAssistantMessageId = undefined
      reasoningAssistantMessageId = undefined
      activeRunMarker = undefined
    }

    /**
     * 初始化恢复的助手状态
     * - 从已存在的消息列表中识别"被恢复的助手消息"（可能是页面刷新前未完成的部分），重新挂上 isStreaming 标记并恢复指针，保证 UI 接续显示。
     */
    function initializeResumedAssistantState() {
      const resumedAssistantState = resolveResumedAssistantState(getSessionMessages(sid), { activeRunMarker })
      activeRunMarker = resumedAssistantState.runMarker
      if (resumedAssistantState.activeAssistant) {
        resumedAssistantState.activeAssistant.isStreaming = true
        activeAssistantMessageId = resumedAssistantState.activeAssistant.id
        if (resumedAssistantState.hadVisibleText) runProducedAssistantText = true
      }
      if (resumedAssistantState.reasoningAssistant) {
        reasoningAssistantMessageId = resumedAssistantState.reasoningAssistant.id
        if (resumedAssistantState.reasoningAssistant.reasoning) {
          noteReasoningStart(resumedAssistantState.reasoningAssistant.id)
        }
      }
    }

    // 共享事件处理器 —— 按 session_id 标签过滤
    function handleEvent(evt: RunEvent) {
      if (closed) return

      // 过滤此会话的事件（服务器用 session_id 标记所有事件）
      if (evt.session_id && evt.session_id !== sid) return

      const eventRunMarker = readRunMarker(evt)
      if (eventRunMarker) activeRunMarker = eventRunMarker

      switch (evt.event) {
        case 'run.started': {
          serverWorking.value.add(sid)

          // 重置状态
          clearAgentEventMessages(sid)
          setAbortState(null)
          setCompressionState(sid, null)
          runProducedAssistantText = false
          runHadToolActivity = false
          closeStreamingAssistant()
          activeRunMarker = readRunMarker(evt)

          // 更新队列长度
          if (evt.queue_length && evt.queue_length > 0) {
            queueLengths.value.set(sid, evt.queue_length)
          } else {
            queueLengths.value.delete(sid)
          }
          break
        }

        case 'run.queued': {
          handleRunQueuedEvent(sid, evt)
          break
        }

        case 'run.completed': {
          // 清理状态、更新消息、处理最终输出
          clearAgentEventMessages(sid)

          const hasQueue = evt.queue_remaining && evt.queue_remaining > 0

          if (hasQueue) {
            queueLengths.value.set(sid, evt.queue_remaining!)
          } else {
            queueLengths.value.delete(sid)
          }

          const msgs = getSessionMessages(sid)
          const lastMsg = activeAssistantMessageId ? msgs.find(m => m.id === activeAssistantMessageId) : msgs.at(-1)
          const completedAssistantMessageId = lastMsg?.role === Message.ROLE.Assistant && lastMsg.isStreaming ? lastMsg.id : null

          // 结束流式消息
          if (lastMsg?.isStreaming) {
            updateMessage(sid, lastMsg.id, { isStreaming: false })
          }

          // 完成所有运行中的工具
          settleRunningTools(sid, 'done')

          // 更新服务器计算的 token 使用量
          if (evt.inputTokens != null) {
            const target = sessions.value.find(s => s.id === sid)
            if (target) {
              target.inputTokens = evt.inputTokens
              target.outputTokens = evt.outputTokens
              if (evt.contextTokens != null) target.contextTokens = evt.contextTokens
            }
          }

          // 备用方案：某些提供商可能只通过 run.completed.output 发送最终助手文本（无 message.delta 流）。
          // 如果从未产生过助手文本但网关报告了非空输出，则回退到渲染为单个助手消息。
          let finalOutputTrimmed = ''

          // 检查后端是否提供了解析后的内容（从字符串化数组格式）
          if (evt.parsed_content !== undefined) {
            // 后端有解析的字符串化数组格式，更新最后一条助手消息
            const msgs = getSessionMessages(sid)

            const lastAssistant = activeAssistantMessageId
              ? msgs.find(m => m.id === activeAssistantMessageId)
              : completedAssistantMessageId
                ? msgs.find(m => m.id === completedAssistantMessageId)
                : undefined
            const parsedContent = typeof evt.parsed_content === 'string' ? evt.parsed_content : ''
            const parsedContentTrimmed = parsedContent.trim()

            if (lastAssistant) {
              const existingContentTrimmed = lastAssistant.content?.trim() ?? ''

              // 如果解析内容非空或现有内容为空，则更新消息
              if (parsedContentTrimmed || !existingContentTrimmed) {
                updateMessage(sid, lastAssistant.id, {
                  content: parsedContent,
                })
                finalOutputTrimmed = parsedContentTrimmed
                if (parsedContentTrimmed) {
                  runProducedAssistantText = true
                }
              } else {
                finalOutputTrimmed = existingContentTrimmed
                runProducedAssistantText = true
              }

              if (evt.parsed_reasoning) {
                // 更新推理内容
                updateMessage(sid, lastAssistant.id, {
                  reasoning: evt.parsed_reasoning,
                })
              }
            } else if (parsedContentTrimmed) {
              // 更新推理内容
              addMessage(sid, {
                id: uuid(),
                role: Message.ROLE.Assistant,
                content: parsedContent,
                reasoning: typeof evt.parsed_reasoning === 'string' ? evt.parsed_reasoning : undefined,
                timestamp: Date.now(),
              })
              finalOutputTrimmed = parsedContentTrimmed
              runProducedAssistantText = true
            }
          } else {
            // 更新推理内容
            const finalOutput = typeof evt.output === 'string' ? evt.output : ''

            finalOutputTrimmed = finalOutput.trim()
            if (!runProducedAssistantText && finalOutputTrimmed !== '') {
              addMessage(sid, {
                id: uuid(),
                role: Message.ROLE.Assistant,
                content: finalOutput,
                timestamp: Date.now(),
              })
              runProducedAssistantText = true
            }
          }

          // 解决上游 hermes-agent bug：当代理层静默吞没错误（如无效 API 密钥、不支持的模型）时，
          // 网关仍会发出 run.completed 但输出为空。如果不在此显示错误，聊天 UI 看起来会像冻结/
          // "成功但无回复"。通过以下组合检测：无助手文本 AND 无工具活动 AND 空最终输出。
          const swallowedError = !runProducedAssistantText && !runHadToolActivity && finalOutputTrimmed === ''

          if (swallowedError) {
            // 添加错误消息
            addMessage(sid, {
              id: uuid(),
              role: Message.ROLE.System,
              content: 'Error: Agent returned no output. The model call may have failed (e.g. invalid API key, model not supported by provider, or context exceeded). Check the hermes-agent logs for details.',
              timestamp: Date.now(),
            })
          } else {
            // 播放完成提示音并显示通知
            console.warn('resumeServerWorkingRun>播放完成提示音并显示通知')
          }

          // 清理状态
          if (!hasQueue) {
            cleanup()
          }

          activeAssistantMessageId = undefined
          reasoningAssistantMessageId = undefined
          activeRunMarker = undefined

          updateSessionTitle(sid)
          break
        }

        case 'run.failed': {
          clearAgentEventMessages(sid)

          // 更新 token 使用量
          if (evt.inputTokens != null) {
            const target = sessions.value.find(s => s.id === sid)
            if (target) {
              target.inputTokens = evt.inputTokens
              target.outputTokens = evt.outputTokens
              if (evt.contextTokens != null) target.contextTokens = evt.contextTokens
            }
          }

          // 如果还有队列消息，更新队列长度
          const hasQueue = evt.queue_remaining && evt.queue_remaining > 0
          if (hasQueue) {
            queueLengths.value.set(sid, evt.queue_remaining!)
          } else {
            queueLengths.value.delete(sid)
          }

          // 添加错误消息
          addAgentErrorMessage(sid, evt.error)

          // 将所有运行中的工具状态改为错误
          settleRunningTools(sid, 'error')

          // 清理状态
          if (!hasQueue) {
            cleanup()
          }
          activeAssistantMessageId = undefined
          reasoningAssistantMessageId = undefined
          activeRunMarker = undefined

          break
        }

        case 'run.reattach_failed': {
          // 设置压缩状态
          setCompressionState(sid, {
            compressing: true,
            messageCount: evt.message_count || 0,
            beforeTokens: evt.token_count || 0,
            afterTokens: 0,
            compressed: false
          })
          break
        }

        case 'compression.completed': {
          const afterTokens = evt.contextTokens || evt.afterTokens || 0

          setCompressionState(sid, {
            compressing: false,
            messageCount: evt.totalMessages || 0,
            beforeTokens: evt.beforeTokens || 0,
            afterTokens,
            compressed: evt.compressed ?? false,
            error: evt.error,
          })

          // 更新上下文 token 计数
          if (evt.contextTokens != null) {
            const target = sessions.value.find(s => s.id === sid)
            if (target) target.contextTokens = evt.contextTokens
          }

          // 5秒后自动清除压缩状态
          setTimeout(() => {
            const state = compressionStates.value.get(sid)
            if (state && !state.compressing) {
              setCompressionState(sid, null)
            }
          }, 5000)
          break
        }

        case 'reasoning.available': {
          const msgs = getSessionMessages(sid)
          const last = msgs.at(-1)
          if (last?.role === Message.ROLE.Assistant && last.isStreaming) {
            /*
            * 标记推理结束（上游发送的是预览内容，不是真正的推理）
            * 只作为"思考结束"信号，停止时长计数器
            * */
            noteReasoningEnd(last.id)
          }

          break
        }

        case 'reasoning.delta':
        case 'thinking.delta': {
          const text = evt.text || evt.delta || ''
          if (!text) break

          runProducedAssistantText = true

          const msgs = getSessionMessages(sid)
          const reasoningTargetId = reasoningAssistantMessageId || activeAssistantMessageId
          const last = reasoningTargetId ? msgs.find(m => m.id === reasoningTargetId) : null

          if (last?.role === Message.ROLE.Assistant) {
            // 追加到现有消息的 reasoning 字段
            last.reasoning = (last.reasoning || '') + text
            reasoningAssistantMessageId = last.id
            noteReasoningStart(last.id)
          } else {
            // 创建新的助手消息（仅包含推理）
            const newId = uuid()
            addMessage(sid, {
              id: newId,
              role: Message.ROLE.Assistant,
              content: '',
              timestamp: Date.now(),
              isStreaming: true,
              reasoning: text,
            })
            activeAssistantMessageId = newId
            reasoningAssistantMessageId = newId
            noteReasoningStart(newId)
          }

          break
        }

        case 'message.delta': {
          if (evt.delta) {
            runProducedAssistantText = true
          }

          const msgs = getSessionMessages(sid)
          const last = activeAssistantMessageId ? msgs.find(m => m.id === activeAssistantMessageId) : null

          if (last?.role === Message.ROLE.Assistant && last.isStreaming) {
            // 追加到现有消息
            const prev = last.content
            const next = prev + (evt.delta || '')
            noteThinkingDelta(last.id, prev, next)

            // 若之前有 reasoning 累积，则 content 到达即视为推理结束
            if (last.reasoning) noteReasoningEnd(last.id)

            last.content = next
          } else {
            // 创建新的助手消息
            const newId = uuid()
            const nextContent = evt.delta || ''
            noteThinkingDelta(newId, '', nextContent)
            addMessage(sid, {
              id: newId,
              role: Message.ROLE.Assistant,
              content: nextContent,
              timestamp: Date.now(),
              isStreaming: true,
            })
            activeAssistantMessageId = newId
          }

          break
        }

        case 'session.command': {
          handleSessionCommandEvent(evt)
          break
        }

        case 'session.title.updated': {
          applyGeneratedSessionTitle(evt)
          break
        }

        case 'tool.started': {
          runHadToolActivity = true

          const msgs = getSessionMessages(sid)
          const toolCallId = evt.tool_call_id as string | undefined

          // 找到相关的助手消息并结束流式
          const last = activeAssistantMessageId ? msgs.find(m => m.id === activeAssistantMessageId) : msgs.at(-1)
          if (last?.isStreaming) {
            updateMessage(sid, last.id, { isStreaming: false })
          }

          activeAssistantMessageId = undefined

          // 查找是否已存在相同 toolCallId 的工具消息
          const existingTool = toolCallId ? msgs.find(m => m.role === Message.ROLE.Tool && m.toolCallId === toolCallId) : null

          if (existingTool) {
            // 更新现有工具消息
            updateMessage(sid, existingTool.id, {
              toolName: evt.tool || evt.name,
              toolArgs: hasRuntimeToolPayload(evt.arguments) ? evt.arguments : existingTool.toolArgs,
              toolPreview: evt.preview || existingTool.toolPreview,
              toolStatus: existingTool.toolStatus || Message.TOOL_STATUS.Running,
            })
          } else {
            // 创建新的工具消息
            addMessage(sid, {
              id: uuid(),
              role: Message.ROLE.Tool,
              content: '',
              timestamp: Date.now(),
              toolName: evt.tool || evt.name,
              toolCallId,
              toolPreview: evt.preview,
              toolArgs: runtimeToolPayloadOrUndefined(evt.arguments),
              toolStatus: Message.TOOL_STATUS.Running,
            })
          }
          break
        }

        case 'tool.completed': {
          const msgs = getSessionMessages(sid)
          const toolCallId = evt.tool_call_id
          // 查找相关的工具消息（优先按 toolCallId，否则找运行中的工具）
          const toolMsgs = toolCallId ? msgs.filter(m => m.role === Message.ROLE.Tool && m.toolCallId === toolCallId) : msgs.filter(m => m.role === Message.ROLE.Tool && m.toolStatus === Message.TOOL_STATUS.Running)

          runHadToolActivity = true

          if (toolMsgs.length > 0) {
            const output = runtimeToolPayloadOrUndefined(evt.output)
            const hasError = evt.error || runtimeToolOutputHasError(output)

            // 更新工具消息状态和结果
            updateMessage(sid, toolMsgs.at(-1)!.id, {
              toolStatus: hasError ? Message.TOOL_STATUS.Error : Message.TOOL_STATUS.Done,
              toolDuration: evt.duration,
              toolResult: output,
            })
          }
          break
        }

        case 'usage.updated': {
          const target = sessions.value.find(s => s.id === sid)
          if (target) {
            target.inputTokens = evt.inputTokens
            target.outputTokens = evt.outputTokens
            if (evt.contextTokens != null) target.contextTokens = evt.contextTokens
          }
          break
        }

        case 'agent.event': {
          handleAgentEvent(evt)
          break
        }

        case 'subagent.start':
        case 'subagent.tool':
        case 'subagent.progress':
        case 'subagent.complete': {
          runHadToolActivity = true
          console.warn('Todo:子 Agent 事件')
          break
        }

        case 'approval.requested': {
          setPendingApproval(evt)
          break
        }

        case 'approval.resolved': {
          clearPendingApproval(evt)
          break
        }

        case 'clarify.requested': {
          setPendingClarify(evt)
          break
        }

        case 'clarify.resolved': {
          clearPendingClarify(evt)
          break
        }

        case 'abort.started': {
          setAbortState({ aborting: true, synced: false })
          break
        }

        case 'abort.timeout': {
          setAbortState({ aborting: true, synced: false, timedOut: true, message: (evt as any).message })
          break
        }

        case 'abort.completed': {
          setAbortState({ aborting: false, synced: evt.synced ?? false })
          clearPendingInteractions(sid)

          // 如果还有队列消息，更新队列长度并继续
          if (evt.queue_length && evt.queue_length > 0) {
            queueLengths.value.set(sid, evt.queue_length)
            setAbortState(null)
            break
          }

          const msgs = getSessionMessages(sid)
          const lastMsg = msgs.at(-1)

          // 结束流式消息
          if (lastMsg?.isStreaming) {
            updateMessage(sid, lastMsg.id, { isStreaming: false })
          }

          // 将所有运行中的工具状态改为完成
          msgs.forEach((m, i) => {
            if (m.role === Message.ROLE.Tool && m.toolStatus === Message.TOOL_STATUS.Running) {
              msgs[i] = { ...m, toolStatus: Message.TOOL_STATUS.Done }
            }
          })

          cleanup()
          setAbortState(null)
          break
        }
      }
    }

    initializeResumedAssistantState()

    // 在全局会话映射中注册处理器
    registerSessionHandlers(sid, {
      onMessageDelta: (evt) => handleEvent(evt),
      onReasoningDelta: (evt) => handleEvent(evt),
      onThinkingDelta: (evt) => handleEvent(evt),
      onReasoningAvailable: (evt) => handleEvent(evt),
      onToolStarted: (evt) => handleEvent(evt),
      onToolCompleted: (evt) => handleEvent(evt),
      onSubagentEvent: (evt) => handleEvent(evt),
      onRunStarted: (evt) => handleEvent(evt),
      onRunCompleted: (evt) => handleEvent(evt),
      onRunFailed: (evt) => handleEvent(evt),
      onCompressionStarted: (evt) => handleEvent(evt),
      onCompressionCompleted: (evt) => handleEvent(evt),
      onAbortStarted: (evt) => handleEvent(evt),
      onAbortTimeout: (evt) => handleEvent(evt),
      onAbortCompleted: (evt) => handleEvent(evt),
      onUsageUpdated: (evt) => handleEvent(evt),
      onAgentEvent: (evt) => handleEvent(evt),
      onSessionCommand: (evt) => handleEvent(evt),
      onRunQueued: (evt) => handleEvent(evt),
      onClarifyRequested: (evt) => handleEvent(evt),
      onClarifyResolved: (evt) => handleEvent(evt),
    })

    // 标记为流式传输，以便 UI 显示指示器，并且刷新后仍可以中断。
    streamStates.value.set(sid, {
      abort: () => {
        getChatRunSocket()?.emit('abort', { session_id: sid })
      }
    })
  }

  /**
   * 应用服务器生成的会话标题
   * - 当服务器返回生成的标题时更新会话标题。   *
   * @param evt 运行事件
   */
  function applyGeneratedSessionTitle(evt: RunEvent) {
    const sid = evt.session_id
    const title = typeof evt.title === 'string' ? evt.title.trim() : ''
    if (!sid || !title) return
    const target = sessions.value.find(s => s.id === sid)
    if (target) {
      target.title = title
      target.updatedAt = Date.now()
    }
    // 同时更新活跃会话的标题引用
    if (activeSession.value?.id === sid) {
      activeSession.value.title = title
    }
  }

  /**
   * 响应对待澄清请求
   * - 发送响应到服务器并清除本地待澄清状态
   * @param response 用户的响应文本
   */
  function respondToClarify(response: string) {
    const pending = activePendingClarify.value
    if (!pending) return
    respondClarify(pending.sessionId, pending.clarifyId, response)
    pendingClarifies.value.delete(pending.sessionId)
  }

  /**
   * 移除队列中的消息（本地 + 通知服务器）
   * - 从本地队列移除后，还会通过 Socket.IO 通知服务器取消排队的运行
   * @param sid 会话 ID
   * @param msgId 消息 ID
   */
  function removeQueuedMessage(sid: Session['id'], msgId: Message['id']) {
    if (!dropQueuedUserMessage(sid, msgId)) return
    getChatRunSocket()?.emit('cancel_queued_run', {
      session_id: sid,
      queue_id: msgId
    })
  }

  return {
    sessions,
    sessionsLoaded,
    activeSessionId,
    activeSession,
    messages,
    focusSessionId,
    isRunActive,
    sessionProfileFilter,
    activePendingClarify,
    activePendingApproval,
    queuedUserMessages,
    compressionState,
    abortState,

    loadSessions,
    switchSession,
    sendMessage,
    isStreaming,
    isAborting,
    stopStreaming,
    getThinkingObservation,
    respondToClarify,
    respondApproval,
    removeQueuedMessage
  }
})
