<!--
Markdown 渲染
Todo:
- [ ] 初始运行逻辑
- [ ] 文件预览
- [ ] 文件下载
- [ ] Mermaid 图表
- [ ] Bug: 数字公式横向滚动条
-->
<script lang="ts">
import MarkdownIt from 'markdown-it'
import MarkdownItConstructor from 'markdown-it'
import mk from '@vscode/markdown-it-katex'
import katex from 'katex'
import { isLatexFence, renderLatexFence } from '@/components/hermes/shared/render-latex.ts'
import { isMermaidFence, renderMermaidPlaceholder } from '@/components/hermes/shared/mermaidRenderer.ts'
import { MARKDOWN_HEADING_ID_PREFIX } from '@/constants/hardcoded.ts'
import { renderHighlightedCodeBlock, handleCodeBlockCopyClick } from '../../shared/highlight.ts'

// 支持的视频文件扩展名
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov'])

// 支持的音频文件扩展名
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'])

const md: MarkdownIt = new MarkdownItConstructor({
  html: false, // 禁用 HTML 标签解析，防止 XSS
  breaks: true, // 自动将换行转换为 <br>
  linkify: true, // 自动识别链接并转换为 <a>
  typographer: true, // 启用排版优化（如引号转换）
  // 自定义代码高亮器
  highlight(str: string, lang: string): string {
    return renderHighlightedCodeBlock(str, lang, '复制', {
      formatDiffFoldLabel: diffFoldLabel,
    })
  },
}).use((mk as any).default, {
  katex,
  throwOnError: false, // 渲染错误时不抛出异常
  strict: 'ignore' // 忽略严格模式检查
})

// 保存默认的代码块渲染器，用于回退处理
const defaultFenceRenderer = md.renderer.rules.fence?.bind(md.renderer.rules)

/**
 * 自定义代码块渲染规则
 * 支持三种类型：LaTeX 公式、Mermaid 图表、普通代码块
 */
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]

  // 优先渲染 LaTeX 数学公式
  if (isLatexFence(token.info)) {
    return renderLatexFence(token.content)
  }

  // 渲染 Mermaid 图表占位符（实际渲染在 mounted 后异步执行）
  if (isMermaidFence(token.info)) {
    return renderMermaidPlaceholder(token.content)
  }

  // 使用默认渲染器处理普通代码块
  if (defaultFenceRenderer) {
    return defaultFenceRenderer(tokens, idx, options, env, self)
  }

  return self.renderToken(tokens, idx, options)
}

/**
 * 生成 diff 折叠标签文本
 * @param hiddenCount 隐藏的行数
 * @returns 本地化的标签文本
 */
function diffFoldLabel(hiddenCount: number): string {
  return `${hiddenCount} 行未修改`
}
</script>

<script setup lang="ts">
import { getDownloadUrl } from '@/api/download.ts'
import {
  isLocalFilePath,
  normalizeLocalFilePath,
  hasExtension,
  getMarkdownAudio,
  getMarkdownVideo,
  getMarkdownFile
} from '../../shared/render-media.ts'
import { repairNestedMarkdownFences } from '../../shared/markdownFenceRepair.ts'

const props = withDefaults(defineProps<{
    content: string
    // 标题 ID 前缀，用于区分不同消息的锚点
    headingIdPrefix?: string
    mentionNames?: string[]
  }>(),
  {
    headingIdPrefix: '',
    mentionNames: () => []
  }
)

/**
 * 核心计算属性：将 Markdown 内容渲染为 HTML
 * 处理流程：
 * 1. 修复嵌套代码块问题
 * 2. 使用 markdown-it 渲染为 HTML
 * 3. 为标题添加 ID（用于锚点链接）
 * 4. 替换本地图片路径为下载 URL
 * 5. 将本地文件链接转换为文件卡片/音视频播放器
 * 6. 高亮 @提及用户名
 */
const renderedHtml = computed(() => {
  // 先修复嵌套代码块问题，再进行渲染
  let html = md.render(repairNestedMarkdownFences(props.content))
  let headingCounter = 0

  // 为所有标题添加 ID，支持锚点跳转
  const prefix = props.headingIdPrefix ? `${props.headingIdPrefix}-` : ''

  // 匹配 h1-h6 标签（可能带属性）
  html = html.replace(/<(h[1-6])([^>]*)>/g, (match, tag, attrs) => {
    const id = `${prefix}${MARKDOWN_HEADING_ID_PREFIX}-${++headingCounter}`

    // 如果已存在 id 属性，替换为新的
    if (attrs.includes('id=')) {
      return match.replace(/id="[^"]*"/, `id="${id}"`).replace(/id='[^']*'/, `id="${id}"`)
    }

    // 添加新的 id 属性
    if (attrs.trim() === '') {
      return `<${tag} id="${id}">`
    }
    return `<${tag} ${attrs.trim()} id="${id}">`
  })

  // 将本地图片路径替换为下载 URL
  html = html.replace(/\bsrc=(["'])([^"']+)\1/g, (match, quote, path) => {
    if (!isLocalFilePath(path)) return match
    const downloadUrl = getDownloadUrl(normalizeLocalFilePath(path))
    return `src=${quote}${downloadUrl}${quote}`
  })

  // 将本地文件链接转换为文件卡片或音视频播放器
  // 匹配 <a href="/tmp/file.pdf">filename</a> 或 <a href="C:/tmp/file.pdf">filename</a>
  html = html.replace(/<a href="([^"]+)">([^<]+)<\/a>/g, (match, rawPath, filename) => {
    if (!isLocalFilePath(rawPath)) return match

    const path = normalizeLocalFilePath(rawPath)
    const fileName = filename.trim()

    // 视频文件：渲染为视频播放器
    if (hasExtension(path, VIDEO_EXTENSIONS)) {
      return getMarkdownVideo(getDownloadUrl(path), fileName)
    }

    // 音频文件：渲染为内联音频播放器
    if (hasExtension(path, AUDIO_EXTENSIONS)) {
      return getMarkdownAudio(getDownloadUrl(path), fileName)
    }

    // 其他文件：渲染为文件卡片（支持下载）
    return getMarkdownFile(path, fileName)
  })

  // 高亮 @提及用户名
  if (props.mentionNames && props.mentionNames.length > 0) {
    // 按长度降序排列，确保长用户名优先匹配
    const escaped = [...props.mentionNames]
      .sort((a, b) => b.length - a.length)
      .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    // 正则匹配：用户名前后必须是空白、标点或边界
    const re = new RegExp(`(?<=[\\s>({\\[<]|^)@(${escaped.join('|')})(?=[\\s.,!?;:，。！？；：)\\]}>]|<|$)`, 'gi')
    html = html.replace(re, '<span class="mention-highlight">@$1</span>')
  }

  return html
})

/**
 * 处理 Markdown 内容的点击事件
 * 支持的交互：
 * - 代码块复制按钮
 */
async function handleMarkdownClick(event: MouseEvent): Promise<void> {
  // 优先处理代码块复制操作
  const copyResult = await handleCodeBlockCopyClick(event)
  if (copyResult !== null) {
    if (copyResult) {
      window.$message?.success('复制成功')
    } else {
      window.$message?.error('复制失败')
    }
    return
  }
}
</script>

<template>
  <div class="markdown-body" ref="markdownBodyRef" v-html="renderedHtml" @click="handleMarkdownClick"></div>

</template>

<style lang="less">
@import 'markdown-body';
@import 'code-block';
</style>
