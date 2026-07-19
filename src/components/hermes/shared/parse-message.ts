/*
* 消息解析
* */
import type { ContentBlock } from '@/api/chat.ts'

/**
 * 解析消息内容为 ContentBlock 数组
 * 支持两种格式：
 * 1. 标准 JSON 格式：[{"type": "text", "text": "..."}]
 * 2. Hermes Agent 遗留的 Python 格式：[{'type': 'text'}, {'type': 'image_url', ...}]
 *
 * @param content 消息内容字符串
 * @returns ContentBlock 数组，解析失败返回 null
 */
export function parseContentBlocks(content: string): Array<ContentBlock | Record<string, unknown>> | null {
  const trimmed = content.trim()
  if (!trimmed) return null

  // 内部解析函数：验证是否为有效 ContentBlock 数组
  const parse = (value: string) => {
    const parsed = JSON.parse(value)
    // 必须是数组且第一个元素包含 type 字段（ContentBlock 的特征）
    return Array.isArray(parsed) && parsed.length && 'type' in parsed[0] ? parsed as Array<ContentBlock | Record<string, unknown>> : null
  }

  try {
    return parse(trimmed)
  } catch {
    // 标准 JSON 解析失败，尝试处理 Hermes Agent 遗留的 Python 格式
    // Python str(list) 格式特点：使用单引号，None/True/False 等 Python 关键字
    if (!trimmed.startsWith("[{'") && !trimmed.startsWith('[{"')) return null
    try {
      return parse(
        trimmed
          // 将 Python None 转换为 JSON null
          .replace(/\bNone\b/g, 'null')
          // 将 Python True 转换为 JSON true
          .replace(/\bTrue\b/g, 'true')
          // 将 Python False 转换为 JSON false
          .replace(/\bFalse\b/g, 'false')
          // 将单引号转换为双引号（JSON 标准）
          .replace(/\b'\b/g, '"')
      )
    } catch {
      return null
    }
  }
}


/**
 * 从内容块中提取文本内容
 * @param block 内容块对象
 * @returns 提取的文本字符串，若无法提取则返回空字符串
 */
export function getBlockText(block: any): string {
  if (!block || typeof block !== 'object') return ''
  if (block.type == 'text' || block.type === 'input_text') {
    return typeof block.text === 'string' ? block.text : ''
  }
  return ''
}

