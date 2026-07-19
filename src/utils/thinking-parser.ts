/**
 * 解析后的思考内容接口
 */
export interface ParsedThinking {
  /** 已完成的思考片段数组（已闭合的标签内容） */
  segments: string[]
  /** 未闭合的思考内容（流式传输时可能存在） */
  pending: string | null
  /** 去除思考标签后的正文内容 */
  body: string
  /** 是否包含思考内容 */
  hasThinking: boolean
}

/**
 * 解析选项配置
 */
export interface ParseOptions {
  /** 是否为流式传输模式 */
  streaming: boolean
}

// 匹配思考标签的正则表达式，支持 <think>、<thinking>、<reasoning> 三种标签
const TAG_RE = /<(think|thinking|reasoning)>([\s\S]*?)<\/\1>/gi

// 代码块占位符的前缀和后缀，用于临时替换代码块以避免误解析
const PLACEHOLDER_PREFIX = '\u0000THKCODE'
const PLACEHOLDER_SUFFIX = '\u0000'

// 匹配行内代码（`code`）的正则表达式
const FENCED_RE = /(^|\n)( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2\3[ \t]*(?=\n|$)/g

// 匹配 fenced 代码块（``` 或 ~~~）的正则表达式
const INLINE_CODE_RE = /`[^`\n]*`/g

/**
 * 保护代码块不被思考标签解析器误处理
 * 将代码块临时替换为占位符，解析完成后再恢复
 * @param input - 原始输入文本
 * @returns 包含掩码文本和代码块数组的对象
 */
function protectCodeBlocks(input: string): { masked: string; blocks: string[] } {
  const blocks: string[] = []
  // 首先替换 fenced 代码块（多行代码块）
  let masked = input.replace(FENCED_RE, (m) => {
    blocks.push(m)
    return `${PLACEHOLDER_PREFIX}${blocks.length - 1}${PLACEHOLDER_SUFFIX}`
  })
  // 然后替换行内代码块
  masked = masked.replace(INLINE_CODE_RE, (m) => {
    blocks.push(m)
    return `${PLACEHOLDER_PREFIX}${blocks.length - 1}${PLACEHOLDER_SUFFIX}`
  })
  return { masked, blocks }
}

/**
 * 恢复被保护的代码块
 * 将占位符替换回原始的代码块内容
 * @param text - 包含占位符的文本
 * @param blocks - 原始代码块数组
 * @returns 恢复后的文本
 */
function restoreCodeBlocks(text: string, blocks: string[]): string {
  if (blocks.length === 0) return text

  // 构建占位符正则表达式，匹配 THKCODE{index} 格式
  const placeholderRe = new RegExp(`${PLACEHOLDER_PREFIX}(\\d+)${PLACEHOLDER_SUFFIX}`, 'g')
  let restored = text

  // 循环替换所有占位符，直到没有更多可替换的内容
  for (let i = 0; i < blocks.length; i += 1) {
    const next = restored.replace(
      placeholderRe,
      (_, idx) => blocks[Number(idx)] ?? '',
    )
    if (next === restored) break
    restored = next
  }

  return restored
}

/**
 * 解析思考内容
 * 从文本中提取思考标签内的内容，并分离出正文部分
 * @param content - 待解析的文本内容
 * @param opts - 解析选项，包括是否为流式模式
 * @returns 解析结果对象
 */
export function parseThinking(content: string, opts: ParseOptions): ParsedThinking {
  // 第一步：保护代码块，避免思考标签在代码块中被误解析
  const { masked, blocks } = protectCodeBlocks(content)

  const segments: string[] = []
  let pending: string | null = null
  let body = ''
  let lastIndex = 0

  // 重置正则表达式的 lastIndex，确保从头开始匹配
  TAG_RE.lastIndex = 0
  let m: RegExpExecArray | null

  // 遍历所有已闭合的思考标签，提取内容和正文
  while ((m = TAG_RE.exec(masked)) !== null) {
    // 将上一个标签结束到当前标签开始之间的内容添加到正文
    body += masked.slice(lastIndex, m.index)
    // 提取标签内的思考内容（捕获组2）
    segments.push(m[2])
    // 更新最后索引位置到当前标签结束之后
    lastIndex = m.index + m[0].length
  }

  // 获取最后一个标签之后的剩余文本
  const rest = masked.slice(lastIndex)

  // 检查剩余文本中是否有未闭合的思考标签（流式传输场景）
  const openRe = /<(think|thinking|reasoning)>([\s\S]*)$/i
  const openMatch = rest.match(openRe)
  if (openMatch) {
    // 将未闭合标签之前的内容添加到正文
    body += rest.slice(0, openMatch.index)
    if (opts.streaming) {
      // 流式模式下，将未闭合标签的内容作为 pending 保存
      pending = openMatch[2]
    } else {
      // 非流式模式下，将整个未闭合标签视为普通正文
      body += rest.slice(openMatch.index!)
    }
  } else {
    // 没有未闭合标签，直接将剩余文本添加到正文
    body += rest
  }

  // 返回解析结果，恢复所有代码块
  return {
    segments: segments.map(s => restoreCodeBlocks(s, blocks)),
    pending: pending === null ? null : restoreCodeBlocks(pending, blocks),
    body: restoreCodeBlocks(body, blocks),
    hasThinking: segments.length > 0 || pending !== null,
  }
}

/**
 * 计算思考内容的字符数
 * 统计所有已完成片段和未完成片段的总字符数
 * @param parsed - 解析后的思考内容对象
 * @returns 思考内容的总字符数
 */
export function countThinkingChars(parsed: ParsedThinking): number {
  // 使用展开运算符正确计算 Unicode 字符数（包括 emoji 等）
  const len = (s: string) => [...s].length
  return parsed.segments.reduce((a, s) => a + len(s), 0) + len(parsed.pending || '')
}

/**
 * 思考边界检测接口
 */
export interface ThinkingBoundary {
  /** 是否在当前位置开始思考 */
  startedAtBoundary: boolean
  /** 是否在当前位置结束思考 */
  endedAtBoundary: boolean
}

// 匹配任意思考开启标签的正则表达式
const ANY_OPEN_RE = /<(think|thinking|reasoning)>/i
// 匹配任意思考关闭标签的正则表达式
const ANY_CLOSE_RE = /<\/(think|thinking|reasoning)>/i

/**
 * 检测思考边界的开始和结束
 * 通过比较前后两个文本状态，判断思考是否在当前位置开始或结束
 * @param prev - 前一个状态的文本
 * @param next - 当前状态的文本
 * @returns 边界检测结果
 */
export function detectThinkingBoundary(prev: string, next: string): ThinkingBoundary {
  // 先保护代码块，避免误判
  const prevMasked = protectCodeBlocks(prev).masked
  const nextMasked = protectCodeBlocks(next).masked
  return {
    // 如果前一个文本没有开启标签而当前文本有，说明思考在此处开始
    startedAtBoundary: !ANY_OPEN_RE.test(prevMasked) && ANY_OPEN_RE.test(nextMasked),
    // 如果前一个文本没有关闭标签而当前文本有，说明思考在此处结束
    endedAtBoundary: !ANY_CLOSE_RE.test(prevMasked) && ANY_CLOSE_RE.test(nextMasked),
  }
}
