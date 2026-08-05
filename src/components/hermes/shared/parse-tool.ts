/*
* 工具调用解析
* */
import { extractUnifiedDiffPayload, inferStructuredLanguage, renderHighlightedCodeBlock } from './highlight.ts'

/**
 * 工具调用负载
 */
type ToolPayload = {
  full: string // 完整的原始内容（用于复制功能，不截断）
  display: string // 格式化后的显示内容（可能被截断，用于 UI 展示）
  language?: string // 内容语言类型（如 json、diff，用于代码高亮）
}

const TOOL_PAYLOAD_DISPLAY_LIMIT = 1000 // 工具调用负载的最大显示长度（防止过长内容影响渲染性能）
const JSON_STRING_DISPLAY_LIMIT = 200 // JSON 字符串的最大显示长度（超过此长度的字符串会被截断并添加标记）
const JSON_MAX_DEPTH = 6 // JSON 解析的最大嵌套深度（防止解析深层嵌套 JSON 时的无限递归和性能问题）
const JSON_MAX_NODES = 1000 // JSON 解析的最大节点数（防止解析超大 JSON 时的性能问题）
const JSON_MAX_KEYS_PER_OBJECT = 50 // 单个 JSON 对象的最大键数量（超过此数量会截断）
const JSON_MAX_ITEMS_PER_ARRAY = 50 // 单个 JSON 数组的最大元素数量（超过此数量会截断）
const JSON_TRUNCATED_KEY = '__truncated__' // JSON 截断标记键名（用于在截断的 JSON 对象中标记被截断的内容）

/**
 * 截断过长的字符串
 * 超过 JSON_STRING_DISPLAY_LIMIT 长度的字符串会被截断并添加标记
 * @param value 原始字符串
 * @param marker 截断标记文本（如 "[截断]"）
 * @returns 截断后的字符串
 */
function truncateLongString(value: string, marker: string): string {
  return value.length > JSON_STRING_DISPLAY_LIMIT ? value.slice(0, JSON_STRING_DISPLAY_LIMIT) + '\n' + marker : value
}

/**
 * 递归截断 JSON 值，防止过大的 JSON 影响渲染性能
 * 支持多种限制策略：
 * - 节点数量限制（JSON_MAX_NODES）
 * - 嵌套深度限制（JSON_MAX_DEPTH）
 * - 数组元素数量限制（JSON_MAX_ITEMS_PER_ARRAY）
 * - 对象键数量限制（JSON_MAX_KEYS_PER_OBJECT）
 * - 字符串长度限制（JSON_STRING_DISPLAY_LIMIT）
 * - 总显示长度限制（TOOL_PAYLOAD_DISPLAY_LIMIT）
 * @param value 原始 JSON 值（可以是任意类型）
 * @param marker 截断标记文本（如 "[截断]"）
 * @returns 截断后的 JSON 值
 */
function truncateJsonValue(value: unknown, marker: string): unknown {
  const seen = new WeakSet<object>() // 用于检测循环引用（防止无限递归）
  let nodeCount = 0 // 节点计数器（用于限制总节点数）

  // 辅助函数：计算对象序列化后的字符长度
  function stringifyLength(candidate: unknown): number {
    return JSON.stringify(candidate, null, 2).length
  }

  // 递归访问函数：遍历 JSON 结构并应用截断规则
  function visit(current: unknown, depth: number): unknown {
    nodeCount += 1

    if (nodeCount > JSON_MAX_NODES) return marker // 超过最大节点数，返回截断标记

    if (typeof current === 'string') return truncateLongString(current, marker) // 字符串类型：应用字符串长度限制

    if (current === null || typeof current !== 'object') return current // 原始类型（number、boolean、null）：直接返回，无需处理

    if (seen.has(current)) return `[Circular ${marker}]` // 检测循环引用：如果已访问过该对象，返回循环引用标记

    if (depth >= JSON_MAX_DEPTH) return Array.isArray(current) ? `[Array ${marker}]` : `[Object ${marker}]` // 超过最大嵌套深度限制

    seen.add(current) // 标记当前对象已访问

    if (Array.isArray(current)) { // 处理数组类型
      const result: unknown[] = []
      const maxItems = Math.min(current.length, JSON_MAX_ITEMS_PER_ARRAY) // 限制数组最大元素数量

      for (let i = 0; i < maxItems; i += 1) {
        const remaining = current.length - i
        result.push(visit(current[i], depth + 1))

        if (stringifyLength(result) > TOOL_PAYLOAD_DISPLAY_LIMIT) {   // 实时检查序列化后的长度，超过限制则截断
          result.pop()
          result.push(`${marker}: ${remaining} more items`)
          seen.delete(current)
          return result
        }
      }

      if (current.length > maxItems) { // 数组元素超过最大限制，添加提示
        result.push(`${marker}: ${current.length - maxItems} more items`)
      }
      seen.delete(current)
      return result
    }

    // 处理对象类型
    const entries = Object.entries(current as Record<string, unknown>)
    const result: Record<string, unknown> = {}
    const maxKeys = Math.min(entries.length, JSON_MAX_KEYS_PER_OBJECT) // 限制对象最大键数量

    for (let i = 0; i < maxKeys; i += 1) {
      const [key, val] = entries[i]
      const remaining = entries.length - i
      result[key] = visit(val, depth + 1)
      if (stringifyLength(result) > TOOL_PAYLOAD_DISPLAY_LIMIT) { // 实时检查序列化后的长度，超过限制则截断
        delete result[key]
        result[JSON_TRUNCATED_KEY] = `${marker}: ${remaining} more keys`
        seen.delete(current)
        return result
      }
    }

    if (entries.length > maxKeys) { // 对象键超过最大限制，添加提示
      result[JSON_TRUNCATED_KEY] = `${marker}: ${entries.length - maxKeys} more keys`
    }
    seen.delete(current)
    return result
  }

  const truncated = visit(value, 0) // 执行递归截断

  if (stringifyLength(truncated) <= TOOL_PAYLOAD_DISPLAY_LIMIT) return truncated // 最终检查：如果整个结果仍超过限制，返回简单标记

  return { [JSON_TRUNCATED_KEY]: marker }
}

/**
 * 将工具调用负载标准化为字符串
 * 处理各种类型的原始负载值，统一转换为字符串格式
 *
 * @param raw 原始负载值（可以是任意类型：string、object、null、undefined 等）
 * @returns 标准化后的字符串，空值返回空字符串
 */
function normalizeToolPayload(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return ''
  if (typeof raw === 'string') return raw
  try {
    const serialized = JSON.stringify(raw)
    if (serialized !== undefined) return serialized
  } catch {
  }
  return String(raw)
}

/**
 * 格式化工具调用负载，处理 JSON、diff 和普通文本
 * 根据负载内容自动推断格式，并应用适当的格式化和截断策略
 *
 * @param raw 原始负载值（工具调用的参数或结果）
 * @param extractDiff 是否提取 diff 格式内容（用于工具结果展示）
 * @returns 格式化后的 ToolPayload 对象（包含完整内容、显示内容和语言类型）
 */
export function formatToolPayload(raw?: unknown, extractDiff = false): ToolPayload {
  const text = normalizeToolPayload(raw)

  if (!text) return { full: '', display: '' }

  // 判断是否应该解析为 JSON：
  // - 原始值不是字符串类型（说明已经是对象）
  // - 字符串以 [ 或 { 开头（符合 JSON 格式特征）
  const shouldParseJson = typeof raw !== 'string' || /^[\[{]/.test(text.trim())

  if (shouldParseJson) {
    try {
      const parsed = JSON.parse(text)
      const full = JSON.stringify(parsed, null, 2)
      const extractedDiff = extractDiff ? extractUnifiedDiffPayload(parsed) : null // 如果需要提取 diff（工具结果），尝试从 JSON 中提取统一差异格式

      if (extractedDiff) return {
        full, // 完整的原始 JSON（用于复制）
        display: extractedDiff,  // 提取的 diff 内容（用于显示）
        language: 'diff' // 语言类型标记为 diff
      }

      // 如果内容过长，应用截断处理；否则直接使用完整内容
      const display = full.length > TOOL_PAYLOAD_DISPLAY_LIMIT ? JSON.stringify(truncateJsonValue(parsed, '... (已截断)'), null, 2) : full
      return {
        full,
        display,
        language: 'json'  // 语言类型标记为 json
      }
    } catch {
      // JSON 解析失败，回退到普通文本渲染
    }
  }

  // 推断结构化语言类型（如 diff、json 等）
  const language = inferStructuredLanguage(text)

  return {
    full: text, // 完整原始文本（用于复制）
    // diff 格式或长度不超过限制时直接显示，否则截断
    display: language === 'diff' || text.length <= TOOL_PAYLOAD_DISPLAY_LIMIT
      ? text : text.slice(0, TOOL_PAYLOAD_DISPLAY_LIMIT) + '\n' + '... (已截断)',
    language
  }
}

/**
 * 渲染工具调用负载为高亮代码块 HTML
 * 调用代码高亮工具生成带语法高亮的代码块
 *
 * @param content 负载内容（格式化后的文本）
 * @param language 语言类型（用于语法高亮）
 * @returns HTML 字符串（带语法高亮的代码块）
 */
export function renderToolPayload(content: string, language?: string): string {
  return renderHighlightedCodeBlock(content, language, '复制', {
    maxHighlightLength: TOOL_PAYLOAD_DISPLAY_LIMIT,  // 高亮处理的最大长度
    formatDiffFoldLabel: (hiddenCount) => `${hiddenCount} 行未修改`  // diff 折叠标签格式化
  })
}
