/*
* Todo:
*  拆分此文件：分为：menus \ storage \ chat
* */
import type { AppRouteRecordRaw } from '@/router/types'
import type { RunEvent } from '@/api/chat.ts'
import { Menu } from '@/models/Menu.ts'
import { Message } from '@/models/Message.ts'

/**
 * 生成菜单数据
 */
export function genMenus(routes: AppRouteRecordRaw[], path = '', result: Menu[] = []) {
  for (const route of routes) {
    // 没有 `title` 的路由，不添加到菜单中
    if (!route?.meta?.title) continue

    const menu = new Menu({
      path: path ? path + '/' + route.path : route.path,
      name: route.name!,
      localIcon: route.meta.localIcon,
      title: route.meta.title,
    })

    result.push(menu)

    if (!route.children?.length) continue

    const children = genMenus(route.children, menu.path)
    if (children?.length) {
      menu.children = children
    }
  }

  return result
}


/**
 * 尽力获取 localStorage 项（自动处理异常）
 * @param key 存储键名
 * @returns 存储值或 null
 */
export function getItemBestEffort(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * 删除 localStorage 项（自动处理异常）
 * @param key 存储键名
 */
export function removeItem(key: string) {
  try {
    localStorage.removeItem(key)
  } catch (e) {
    console.error('removeItem:', key, e)
  }
}

/** 判断错误是否为 localStorage 配额超限错误 */
export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return  false
  const e = (error as {name?: string, code?: number})
  return e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014
}


/** 判断工具负载是否有实际值（非空、非 undefined、非空字符串） */
export function hasRuntimeToolPayload(value: unknown): boolean {
  return !!(value ?? '')
}

/** 将工具负载转换为 undefined（如果为空）或原值 */
export function runtimeToolPayloadOrUndefined(value: unknown): unknown | undefined {
  return hasRuntimeToolPayload(value) ? value : undefined
}

/**
 * 将工具负载转换为字符串表示
 *
 * 处理逻辑：
 * 1. 空值 -> 空字符串
 * 2. 字符串 -> 直接返回
 * 3. 对象 -> JSON 序列化
 * 4. 其他 -> 转为字符串
 */
export function runtimePayloadText(value: unknown): string {
  if (!hasRuntimeToolPayload(value)) return  ''
  if (typeof value === 'string') return value
  try {
    const serialized = JSON.stringify(value)
    if (serialized !== undefined) return serialized
  } catch {}
  return String(value)
}

/**
 * 从对象中读取 finish_reason（支持 camelCase 和 snake_case 两种格式）
 * @returns finish_reason 值或 undefined
 */
export function readFinishReason(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  if (Object.hasOwn(record, 'finishReason')) {
    return (record as {finishReason?: string}).finishReason
  }
  if (Object.hasOwn(record, 'finish_reason')) {
    return (record as {finish_reason?: string}).finish_reason
  }
  return undefined
}

/**
 * 从对象中读取 run_marker（支持 camelCase 和 snake_case 两种格式）
 * @returns run_marker 值或 undefined
 */
export function readRunMarker(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return  undefined
  const record = value as Record<string, unknown>
  if (Object.hasOwn(record, 'runMarker')) {
    return (record as {runMarker?: string }).runMarker
  }
  if (Object.hasOwn(record, 'run_marker')) {
    return (record as {run_marker?: string }).run_marker
  }
  return undefined
}

/**
 * 从事件列表中提取回放的 run_marker
 *
 * 从后往前遍历事件，找到第一个有效的 run_marker
 * @param events 事件列表
 * @returns run_marker 值或 null
 */
export function getReplayRunMarker(events?: Array<{ event: string; data: RunEvent }>): string | null {
  if (!Array.isArray(events)) return null
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const runMarker = readRunMarker(events[i]?.data)
    if (typeof runMarker === 'string' && runMarker.trim() !== '') return runMarker
  }
  return null
}

/**
 * 从消息列表中选择恢复会话时正在进行中的助手消息
 *
 * 判断逻辑：
 * 1. 必须是最后一条消息
 * 2. 角色必须是 assistant
 * 3. finish_reason 为 null（表示未完成）或 run_marker 匹配当前运行
 *
 * @param messages 消息列表
 * @param activeRunMarker 当前活跃的运行标记
 * @returns 正在进行中的助手消息或 null
 */
function selectResumedInFlightAssistant(messages: Message[], activeRunMarker?: string | null): Message | null {
  if (messages.length === 0) return null
  const lastMessage = messages[messages.length - 1]
  if (lastMessage?.role !== Message.ROLE.Assistant) return null
  const finishReason = readFinishReason(lastMessage)
  const runMarker = readRunMarker(lastMessage)
  const hasMatchingRunMarker = !!activeRunMarker && !!runMarker && runMarker === activeRunMarker
  return finishReason === null || hasMatchingRunMarker ? lastMessage : null
}

/** 判断助手消息是否有可见文本内容（content 或 reasoning） */
function hasAssistantVisibleText(message: Message | null | undefined): boolean {
  if (!message) return false
  return message.content.trim() !== '' || (message.reasoning?.trim() ?? '') !== ''
}

/**
 * 解析恢复会话时的助手消息状态
 *
 * 在页面刷新或重新连接后，确定当前正在进行中的助手消息和推理消息
 *
 * @param messages 消息列表
 * @param options 恢复选项
 * @param options.previousActiveAssistantMessageId 之前活跃的助手消息 ID
 * @param options.previousReasoningAssistantMessageId 之前活跃的推理消息 ID
 * @param options.activeRunMarker 当前活跃的运行标记
 * @returns 助手消息状态对象
 */
export function resolveResumedAssistantState(
  messages: Message[],
  options: {
    previousActiveAssistantMessageId?: string
    previousReasoningAssistantMessageId?: string
    activeRunMarker?: string
  },
): {
  activeAssistant: Message | null // 正在进行中的助手消息
  reasoningAssistant: Message | null // 正在进行中的推理消息
  runMarker?: string // 当前运行标记
  hadVisibleText: boolean // 是否有可见文本内容
} {
  // 优先使用之前保存的 activeAssistantMessageId 查找
  const activeAssistant = options.previousActiveAssistantMessageId
    ? messages.find(m => m.role === Message.ROLE.Assistant && m.id === options.previousActiveAssistantMessageId) || null
    : null
  // 如果没找到，尝试从消息列表中选择正在进行中的助手消息
  const selectedActiveAssistant = activeAssistant || selectResumedInFlightAssistant(messages, options.activeRunMarker)

  // 优先使用之前保存的 reasoningAssistantMessageId 查找
  const reasoningAssistant = options.previousReasoningAssistantMessageId
    ? messages.find(m => m.role === Message.ROLE.Assistant && m.id === options.previousReasoningAssistantMessageId) || null
    : null
  // 如果没找到，使用 activeAssistant（如果它有 reasoning 内容）
  const selectedReasoningAssistant = reasoningAssistant || (selectedActiveAssistant?.reasoning ? selectedActiveAssistant : null)

  // 提取 run_marker
  const selectedRunMarker = readRunMarker(selectedActiveAssistant) ?? options.activeRunMarker

  return {
    activeAssistant: selectedActiveAssistant,
    reasoningAssistant: selectedReasoningAssistant,
    runMarker: selectedRunMarker,
    hadVisibleText: hasAssistantVisibleText(selectedActiveAssistant),
  }
}

/**
 * 从错误对象中提取可读的错误消息文本
 *
 * 支持多种错误格式：
 * - 字符串：直接返回
 * - 数组：递归提取并拼接
 * - 对象：按优先级查找 message/error/detail/description/code 字段
 * - 其他：尝试 JSON 序列化或转为字符串
 */
export function errorMessageText(error: unknown): string {
  if (typeof error === 'string') return error.trim()
  if (error == null) return ''
  if (typeof error !== 'object') return String(error).trim()

  if (Array.isArray(error)) {
    return error.map(errorMessageText).filter(Boolean).join('\n')
  }

  const record = error as Record<string, unknown>
  for (const key of ['message', 'error', 'detail', 'description', 'code']) {
    const text = errorMessageText(record[key])
    if (text) return text
  }

  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}


/**
 * 判断工具输出是否包含错误
 *
 * 检测逻辑：
 * 1. 输出必须是字符串且非空
 * 2. 尝试解析为 JSON 对象
 * 3. 如果对象包含 success: false 或非空的 error 字段，则视为错误
 */
function isToolOutputError(output: unknown): boolean {
  if (typeof output !== 'string' || !output.trim()) return false
  try {
    const parsed = JSON.parse(output)
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>
      if (record.success === false) return true
      if (record.error != null && String(record.error).trim() !== '') return true
    }
  } catch {
    return false
  }
  return false
}

/** 判断工具输出是否包含错误（简化版，仅检查字符串格式） */
export function runtimeToolOutputHasError(value: unknown): boolean {
  return typeof value === 'string' && isToolOutputError(value)
}

