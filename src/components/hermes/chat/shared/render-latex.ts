/*
* 渲染 LaTeX 数学公式 Markdown
* */

import katex from 'katex'

// 支持的 LaTeX 代码块语言标识集合
const LATEX_FENCE_LANGS = new Set(['latex', 'tex', 'math', 'katex'])

/**
 * 从代码块信息字符串中提取语言标识
 * @param info 代码块的信息字符串（如 "python" 或 "python filename.py"）
 * @returns 语言标识（小写）
 */
function getFenceLanguage(info: string): string {
  return info.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
}

/**
 * 判断代码块是否为 LaTeX 数学公式
 * @param info 代码块的信息字符串
 * @returns 是否为 LaTeX 代码块
 */
export function isLatexFence(info: string): boolean {
  return LATEX_FENCE_LANGS.has(getFenceLanguage(info))
}

/**
 * 规范化 LaTeX 代码块内容，去除包裹符号
 * 支持三种包裹格式：\[...\]、$$...$$、\(...\)
 * @param content 原始 LaTeX 内容
 * @returns 去除包裹符后的纯 LaTeX 公式
 */
function normalizeLatexFenceContent(content: string): string {
  const trimmed = content.trim()

  // 块级公式：\[ ... \]
  if (trimmed.startsWith('\\[') && trimmed.endsWith('\\]')) {
    return trimmed.slice(2, -2).trim()
  }

  // 块级公式：$$ ... $$
  if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) {
    return trimmed.slice(2, -2).trim()
  }

  // 行内公式：\( ... \)
  if (trimmed.startsWith('\\(') && trimmed.endsWith('\\)')) {
    return trimmed.slice(2, -2).trim()
  }

  return trimmed
}

/**
 * 使用 KaTeX 渲染 LaTeX 数学公式为 HTML
 * @param content LaTeX 公式内容
 * @returns 渲染后的 HTML 字符串
 */
export function renderLatexFence(content: string): string {
  const latex = normalizeLatexFenceContent(content)
  return `<div class="latex-block">${katex.renderToString(latex, {
    displayMode: true,        // 块级显示模式
    output: 'htmlAndMathml',  // 输出 HTML 和 MathML
    throwOnError: false,      // 错误时不抛出异常
    strict: 'ignore',         // 忽略严格模式
  })}</div>`
}
