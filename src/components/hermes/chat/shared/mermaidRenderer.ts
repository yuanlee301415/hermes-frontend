import {renderHighlightedCodeBlock} from '../shared/highlight.ts'

const MERMAID_LANGUAGE = 'mermaid'

export const MERMAID_MAX_DIAGRAMS_PER_MESSAGE = 4
export const MERMAID_MAX_SOURCE_LENGTH = 20_000
export const MERMAID_RENDER_TIMEOUT_MS = 5_000
export const SUPPORT_PREVIEW_FILE_TYPES = ['txt', 'md', 'json', 'csv', 'log', 'py', 'yaml', 'yml', 'toml', 'sh', 'xml', 'html', 'css', 'js', 'ts', 'rs', 'go', 'java', 'c', 'cpp', 'h']

// Mermaid 图表占位符的 DOM 属性
export const MERMAID_PLACEHOLDER_ATTR = {
  Pending: 'data-mermaid-pending',
  Source: 'data-mermaid-source'
} as const

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function getFenceLanguage(info: string | undefined): string {
  return info?.trim().split(/\s+/)[0]?.toLowerCase() || ''
}

export function isMermaidFence(info: string | undefined): boolean {
  return getFenceLanguage(info) === MERMAID_LANGUAGE
}

export function encodeMermaidSource(source: string): string {
  return encodeURIComponent(source)
}

export function decodeMermaidSource(encoded: string | null | undefined): string {
  if (!encoded) return ''

  try {
    return decodeURIComponent(encoded)
  } catch {
    return ''
  }
}

export function renderMermaidPlaceholder(source: string): string {
  return [
    '<div class="mermaid-diagram" data-mermaid-pending="true"',
    ` data-mermaid-source="${escapeHtml(encodeMermaidSource(source))}">`,
    '<div class="mermaid-loading">Rendering Mermaid diagram…</div>',
    '</div>',
  ].join('')
}


/**
 * Mermaid 渲染失败时的回退处理
 * 将图表替换为高亮的代码块显示
 * @param element 要替换的 DOM 元素
 * @param source Mermaid 源代码
 */
export function renderMermaidFallback(element: HTMLElement, source: string): void {
  element.outerHTML = renderHighlightedCodeBlock(source, MERMAID_LANGUAGE, '复制')
}


/**
 * 为 Promise 添加超时控制
 * @param promise 要包装的 Promise
 * @param timeoutMs 超时时间（毫秒）
 * @param label 标识名称（用于错误信息）
 * @returns 包装后的 Promise，超时时会拒绝
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs} ms.`))
    }, timeoutMs)
  })

  return Promise.race([
    promise,
    timeout
  ]).finally(() => {
    clearTimeout(timer)
  })
}

/**
 * 获取元素的滚动父容器
 * 向上遍历 DOM 树，找到第一个可滚动的父元素
 * @param el 目标元素
 * @returns 滚动父容器或 null
 */
export function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null
  let current: HTMLElement | null = el.parentElement
  while (current) {
    const { overflow, overflowY} = getComputedStyle(current)
    if (overflow === 'auto' || overflow === 'scroll' || overflowY === 'auto' || overflowY === 'scroll') {
      return current
    }
    current = current.parentElement
  }
  return null
}

/**
 * 判断滚动容器是否接近底部
 * @param el 滚动容器
 * @param threshold 阈值（像素）
 * @returns 是否接近底部
 */
export function isNearScrollBottom(el: HTMLElement, threshold = 200): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}

/**
 * 清理 Mermaid 渲染产生的临时 DOM 元素
 * Mermaid 会创建额外的 <svg> 和 <defs> 元素，需要手动清理
 * @param id 图表 ID
 */
export function cleanupMermaidRenderArtifacts(id: string): void {
  document.getElementById(id)?.remove()
  document.getElementById(`d${id}`)?.remove()
}
