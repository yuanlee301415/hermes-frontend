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
import { getSessionsApi, type HermesMessage } from '@/api/sessions.ts'
import { resumeSession, type RunEvent } from '@/api/chat.ts'
import { Session } from '@/models/Session.ts'
import { Message } from '@/models/Message.ts'
import { useProfilesStore } from '@/store/modules/profiles.ts'
import { getItemBestEffort, removeItem, isQuotaExceededError, hasRuntimeToolPayload, runtimeToolPayloadOrUndefined, runtimePayloadText, readFinishReason, readRunMarker } from '../shared'

interface CompressionState {
  compressing: boolean
  messageCount: number
  beforeTokens: number
  afterTokens: number
  compressed?: boolean
  error?: string
}

const DEFAULT_PROFILE_NAME = 'default'

// localStorage 键名常量
// 当前 profile 的活跃会话键名前缀
const STORAGE_KEY_PREFIX = 'hermes_active_session_'
// 旧版（无 profile 隔离）的活跃会话键名
const LEGACY_STORAGE_KEY = 'hermes_active_session'

export const useChatStore = defineStore('chatStore', () => {
  const profileStore = useProfilesStore()
  /** 会话列表 */
  const sessions = ref<Session[]>([])
  /** 当前活跃会话 ID */
  const activeSessionId = ref<Session['id'] | undefined>()
  /** 当前聚焦的消息 ID（用于滚动定位） */
  const focusSessionId = ref<Session['id'] | undefined>()
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
  /** 中断状态 */
  const abortState = ref<{
    // 是否正在中断中
    aborting: boolean
    // 是否已同步到服务器
    synced?: boolean
    // 是否超时
    timeOut?: boolean
    // 消息
    message?: string
    // 错误信息
    error?: string
  } | null>(null)

  /**
   * 会话 ID → 压缩状态映射
   *
   * 压缩状态按会话隔离，因为 socket 可以在后台会话保持连接的同时另一个聊天处于活跃状态
   */
  const compressStates = ref<Map<Session['id'], CompressionState>>(new Map())

  /** 会话 ID → 服务器报告的 isWorking 状态 */
  const serverWorking = ref<Set<Session['id']>>(new Set())

  /** 会话 ID → 排队消息数量 */
  const queueLengths = ref<Map<Session['id'], number>>(new Map())

  /** 会话 ID → 已排队但尚未在对话中显示的用户消息 */
  const queueUserMessages = ref<Map<Session['id'], Message[]>>(new Map())

  /** 会话 ID → 流式状态映射（包含 abort 方法） */
  const streamStates = ref<Map<Session['id'], {abort: () => void}>>(new Map())

  /** 是否正在流式传输（客户端或服务器有活跃运行） */
  const isStreaming = computed(() => {
    const sid = activeSessionId.value
    if (!sid) return false
    return streamStates.value.has(sid) || serverWorking.value.has(sid)
  })

  /** 是否有活跃运行（与 isStreaming 等价） */
  const isRunActive = computed(() => isStreaming.value)


  /*--------------------常量--------------------*/
  // 活跃流式传输期间 <think> 边界的临时观察。
  // 不持久化；会话切换时清除。
  const thinkingObservation = new Map<string, {startedAt?: number, endedAt?: number}>

  /*
  * Todo: 初始运行的逻辑
  *  - [ ] 注册全局会话命令处理器
  *  - [ ] 注册会话标题更新处理器
  *  - [ ] 标签页可见性
  *  - [ ] 轻度后台轮询用于会话列表实时同步
  *  - [ ] 当会话从服务器新获取时
  * */

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
      console.log('loadSessions>runtimeByIdBefore:', runtimeByIdBefore)

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
      const legacyActiveKey = legacyStorageKey()
      const storedId = getItemBestEffort(storageKey()) || (legacyActiveKey ? getItemBestEffort(LEGACY_STORAGE_KEY) : null)
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
  async function switchSession(sessionId: Session['id'], focusId?: Session['id']) {
    console.log('switchSession:', sessionId)

    clearThinkingObservationFor()
    activeSessionId.value = sessionId
    focusSessionId.value = focusId
    setItemBestEffort(storageKey(), sessionId)

    const legacyActiveKey = legacyStorageKey()
    if (legacyActiveKey) {
      removeItem(legacyActiveKey)
    }

    activeSession.value = sessions.value.find(_ => _.id === sessionId) || null

    if (!activeSession.value) return

    isLoadingMessages.value = true

    try {
      // 通过 Socket.IO resume 加载消息（服务器从内存或数据库加载）
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Resume timeout'))
        }, 15_000)

        resumeSession(sessionId, data => {
          console.log('resumeSession>res data:', data)
          clearTimeout(timeout)

          // 如果会话已切换，直接返回
          if (data.session_id !== sessionId || activeSessionId.value !== sessionId) {
            resolve()
            return
          }

          const target = sessions.value.find(s => s.id === sessionId)
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
          } else if (!data.queueLength){
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
          if (data.inputTokens != null) { target.inputTokens = data.inputTokens }
          if (data.outputTokens != null) { target.outputTokens = data.outputTokens }
          if (data.contextTokens != null) { target.contextTokens = data.contextTokens }

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

          // 处理重放事件（压缩状态等）
          if (data.events?.length) {
            console.error('Todo: data.events')
          }

          activeSession.value = target
          console.log('resumeSession>set activeSession:', activeSession.value)
          resolve()
        }, activeSession.value?.profile)
      })
    } catch (e) {
      console.error('[switchSession]::\n', e)
    } finally {
      isLoadingMessages.value = false
    }
  }

  /**
   * 将 Hermes 后端消息格式转换为客户端消息格式
   *
   * 主要处理：
   * 1. 过滤掉没有显示内容的 assistant 消息（除非包含 tool_calls 元数据）
   * 2. 构建工具调用名称和参数的映射表
   * 3. 将 assistant 消息中的 tool_calls 转换为独立的 tool 消息
   * 4. 将 tool 消息与对应的工具调用关联
   * 5. 普通消息直接转换
   *
   * @param msgs Hermes 后端消息列表
   * @returns 客户端消息列表
   */
  function mapHermesMessages(msgs: HermesMessage[]): Message[] {
    // 过滤掉没有显示内容的 assistant 消息（除非包含 tool_calls 元数据，用于恢复历史时命名工具结果行）
    const filteredMsgs = msgs.filter(msg => {
      if (msg.role === Message.ROLE.Assistant) {
        return ( msg.tool_calls?.length ?? 0) > 0 || !!runtimePayloadText(msg.content).trim()
      }
      return true
    })

    // 从包含 tool_calls 的 assistant 消息中构建工具名称和参数的映射表
    const toolNameMap = new Map<string, string>()
    const toolArgsMap = new Map<string, unknown>()

    for (const msg of filteredMsgs) {
      if (msg.role === Message.ROLE.Assistant && msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          if (tc.id) {
            if (tc.function?.name) toolNameMap.set(tc.id, tc.function.name)
            if (hasRuntimeToolPayload(tc.function?.arguments)) toolArgsMap.set(tc.id, tc.function?.arguments)
          }
        }
      }
    }

    const result: Message[] = []

    for (const msg of filteredMsgs) {
      // 跳过只包含 tool_calls 的 assistant 消息（无实际内容），为每个工具调用生成 tool.started 消息
      if (msg.role === Message.ROLE.Assistant && msg.tool_calls?.length && !runtimePayloadText(msg.content).trim()) {
        for (const tc of msg.tool_calls) {
          result.push(new Message({
            id: String(msg.id) + '_' + tc.id,
            role: Message.ROLE.Tool,
            content: '',
            timestamp: Math.round(msg.timestamp * 1000),
            toolName: tc.function?.name,
            toolCallId: tc.id,
            toolArgs: runtimeToolPayloadOrUndefined(tc.function?.arguments),
            toolStatus: Message.TOOL_STATUS.Done,
            finishReason: readFinishReason(msg),
            runMarker: readRunMarker(msg)
          }))
        }
        continue
      }

      // 工具结果消息处理
      if (msg.role === Message.ROLE.Tool) {
        const tcId = msg.tool_call_id ?? ''
        const toolName = msg.tool_name || toolNameMap.get(tcId)
        const toolArgs = toolArgsMap.get(tcId)

        // 从内容中提取简短预览
        let preview = ''
        const contentText = runtimePayloadText(msg.content)
        if (contentText) {
          try {
            const parsed = typeof msg.content === 'string' ? JSON.parse(contentText) : msg.content
            preview = parsed?.url || parsed?.title || parsed?.preview || parsed?.summary || ''
          } catch {
            preview = contentText.slice(0, 80)
          }
        }

        // 查找并移除上面生成的占位符工具消息
        const placeholderIdx = result.findIndex(msg =>
          msg.role === Message.ROLE.Tool
          && msg.toolName === toolName
          && !msg.toolResult
          && msg.id.includes('_' + tcId)
        )
        if (placeholderIdx !== -1) {
          result.splice(placeholderIdx, 1)
        }

        result.push(new Message({
          id: String(msg.id),
          role: Message.ROLE.Tool,
          content: '',
          timestamp: Math.round(msg.timestamp * 1000),
          toolName,
          toolArgs,
          toolCallId: tcId,
          toolPreview: preview,
          toolResult: runtimeToolPayloadOrUndefined(msg.content),
          toolStatus: Message.TOOL_STATUS.Done,
          finishReason: readFinishReason(msg),
          runMarker: readRunMarker(msg)
        }))
        continue
      }

      // 普通 user/assistant/command 消息处理
      result.push(new Message({
        id: String(msg.id),
        role: msg.role,
        content: msg.content,
        timestamp: Math.round(msg.timestamp * 1000),
        reasoning: msg.reasoning ?? undefined,
        systemType: msg.role === Message.ROLE.Command ? Message.ROLE.Command : undefined,
        finishReason: readFinishReason(msg),
        runMarker: readRunMarker(msg)
      }))
    }

    return result
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
  function setAbortState(state: typeof abortState.value) {
    abortState.value = state
  }

  /**
   * 设置会话的压缩状态
   * @param sessionId 会话 ID
   * @param state 压缩状态（null 表示清除）
   */
  function setCompressionState(sessionId: Session['id'] | void, state: CompressionState | null) {
    if (!sessionId) return
    const next = new Map(compressStates.value)
    if (state) {
      next.set(sessionId, state)
    } else {
      next.delete(sessionId)
    }
    compressStates.value = next
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
    return STORAGE_KEY_PREFIX + getProfileName()
  }

  /** 获取旧版活跃会话存储键名（仅 default profile 有） */
  function legacyStorageKey(): string | null {
    return  getProfileName() === DEFAULT_PROFILE_NAME ? LEGACY_STORAGE_KEY : null
  }

  /**
   * 替换队列中的用户消息
   *
   * 合并现有消息的附件（避免丢失本地文件引用），并更新队列长度。
   *
   * @param sessionId 会话 ID
   * @param messages 新的消息列表
   */
  function replaceQueuedUserMessages(sessionId: Session['id'], messages: Message[]) {
    const existingById = new Map((queueUserMessages.value.get(sessionId) ?? []).map(message => [message.id, message]))
    const merged = messages.map(message => ({
      ...(existingById.get(message.id) ?? {}),
      ...message,
      attachments: existingById.get(message.id)?.attachments ?? message.attachments,
      queued: true
    }))
    const nextMap = new Map(queueUserMessages.value)
    if (merged.length) {
      nextMap.set(sessionId, merged as Message[])
    } else {
      nextMap.delete(sessionId)
    }
    queueUserMessages.value =  nextMap
  }

  /**
   * 规范化队列中的用户消息
   *
   * 将服务器返回的原始消息格式转换为客户端 Message 格式，
   * 过滤掉无效消息（没有 ID 或内容为空）。
   *
   * @param rawMessages 原始消息数组
   * @returns 规范化后的消息列表
   */
  function normalizeQueuedUserMessages(rawMessages: unknown): Message[] {
    if (!Array.isArray(rawMessages)) return []

    return rawMessages.flatMap(raw => {
      const peer = raw as NonNullable<RunEvent['queued_messages']>[number]
      const content = typeof peer.content === 'string' ? peer.content : ''
      const mesageId = peer?.id ? String(peer.id) : ''
      if (!mesageId || !content.trim()) return  []

      const timestamp = typeof peer?.timestamp  === 'number'  && Number.isFinite(peer.timestamp) ? Math.round(peer.timestamp * 1000) : Date.now()
      const role = peer?.role === Message.ROLE.Command ? Message.ROLE.Command : Message.ROLE.User

      return [new Message({
        id: mesageId,
        role,
        content,
        timestamp,
        queued: true,
        systemType: role === Message.ROLE.Command ? Message.ROLE.Command : undefined
      })]
    })
  }

  /**
   * 尽力设置 localStorage 项（自动处理配额超限）
   *
   * 如果设置失败且是配额超限，会尝试清理旧缓存后重试
   * @param key 存储键名
   * @param value 存储值
   */
  function setItemBestEffort(key: string, value: string) {
    try {
      localStorage.setItem(key, value)
      return
    } catch (e) {
      if (!isQuotaExceededError(e)) return
    }

    // 配额超限，尝试清理旧缓存
    recoverStorageQuota()

    try {
      localStorage.setItem(key, value)
    } catch {}
  }

  /**
   * 恢复 localStorage 配额
   *
   * 清理所有已废弃的旧缓存键，释放存储空间
   */
  function recoverStorageQuota(){
    // 已完全废弃的缓存键前缀列表
    const prefixes = [
      'hermes_sessions_cache_v1_',
      'hermes_session_msgs_v1_',
      'hermes_session_pins_v1_',
      'hermes_human_only_v1_',
    ]
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        // 保留当前使用的键
        if (key === storageKey() || key === LEGACY_STORAGE_KEY) continue
        // 删除废弃的键
        if (prefixes.some(prefix => key.startsWith(prefix))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => removeItem(key))
      if (keysToRemove.length > 0) {
        console.log(`Recovered storage: cleared ${keysToRemove.length} old session cache entries`)
      }
    } catch {
      // 忽略错误
    }
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
    loadSessions,
    switchSession
  }
})
