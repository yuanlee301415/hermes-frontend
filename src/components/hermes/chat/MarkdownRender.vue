<!--
Markdown 渲染
Todo:
- [ ] 初始运行逻辑
- [ ] 代码高亮器
- [ ] 复制代码块
- [ ] 文件预览
- [ ] Mermaid 图表
-->
<script lang="ts">
import MarkdownIt from 'markdown-it'
import MarkdownItConstructor from 'markdown-it'
import mk from '@vscode/markdown-it-katex'
import katex from 'katex'
import { isLatexFence, renderLatexFence } from '@/components/hermes/shared/render-latex.ts'
import { isMermaidFence, renderMermaidPlaceholder } from '@/components/hermes/shared/mermaidRenderer.ts'

// 支持的视频文件扩展名
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov'])

// 支持的音频文件扩展名
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'])

const md: MarkdownIt = new MarkdownItConstructor({
  html: false,
  breaks: true,
  linkify: true
}).use(mk.default, {
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
} from '../shared/render-media.ts'
import { repairNestedMarkdownFences } from '../shared/markdownFenceRepair.ts'

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
    const id = `${prefix}heading-${++headingCounter}`

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


async function handleMarkdownClick(): Promise<void> {
}
</script>

<template>
  <div class="markdown-body" ref="markdownBodyRef" v-html="renderedHtml" @click="handleMarkdownClick"></div>

</template>

<style lang="less">
.markdown-body {
  font-size: 14px;
  line-height: 1.65;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: auto;
  overflow-wrap: anywhere;
  word-break: break-word;

  p {
    margin: 0 0 8px;
    min-width: 0;
    max-width: 100%;
    overflow-wrap: anywhere;

    &:last-child {
      margin-bottom: 0;
    }
  }

  ul, ol {
    padding-left: 20px;
    margin: 4px 0 8px;
  }

  li {
    margin: 2px 0;
    min-width: 0;
    max-width: 100%;
    overflow-wrap: anywhere;
  }

  strong {
    color: var(--text-primary);
    font-weight: 600;
  }

  em {
    color: var(--text-secondary);
  }

  a {
    color: var(--accent-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
    overflow-wrap: anywhere;
    word-break: break-word;

    &:hover {
      color: var(--accent-hover);
    }
  }

  img {
    display: block;
    max-width: 200px;
    max-height: 160px;
    object-fit: contain;
    cursor: pointer;
    border-radius: 4px;
    margin: 8px 0;
  }

  .markdown-video-container {
    margin: 12px 0;
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: #000;
    border: 1px solid var(--border-color);
  }

  .markdown-video {
    display: block;
    width: 100%;
    max-width: 640px;
    max-height: 480px;
    object-fit: contain;
  }

  .markdown-video-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.85);
    color: #fff;
    font-size: 12px;

    .att-name {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .markdown-audio-container {
    margin: 12px 0;
    padding: 10px 12px;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    background-color: rgba(0, 0, 0, 0.04);
  }

  .markdown-audio {
    display: block;
    width: 100%;
    max-width: 420px;
  }

  .markdown-audio-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    color: var(--text-secondary);
    font-size: 12px;

    .att-name {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .markdown-file-card {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    font-size: 12px;
    color: var(--text-secondary);
    background-color: rgba(0, 0, 0, 0.04);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    margin: 8px 0;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;

    &:hover {
      background-color: rgba(0, 0, 0, 0.08);
      border-color: var(--border-color);
    }

    .att-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 160px;
    }

    .att-download-icon {
      flex-shrink: 0;
      opacity: 0.6;
      transition: opacity 0.15s ease;
    }

    .att-download-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      padding: 0;
      color: inherit;
      background: transparent;
      border: 0;
      cursor: pointer;
    }

    &:hover .att-download-icon,
    .att-download-btn:hover .att-download-icon {
      opacity: 1;
    }
  }

  blockquote {
    margin: 8px 0;
    padding: 4px 12px;
    border-left: 3px solid var(--border-color);
    color: var(--text-secondary);
  }

  code:not(.hljs) {
    background: var(--code-bg);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: var(--font-code);
    font-size: 13px;
    color: var(--accent-primary);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  table {
    width: 100%;
    max-width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
    display: block;
    overflow-x: auto;

    th, td {
      padding: 6px 12px;
      border: 1px solid var(--border-color);
      text-align: left;
      font-size: 13px;
    }

    th {
      background: rgba(var(--accent-primary-rgb), 0.08);
      color: var(--text-primary);
      font-weight: 600;
    }

    td {
      color: var(--text-secondary);
    }
  }

  hr {
    border: none;
    border-top: 1px solid var(--border-color);
    margin: 12px 0;
  }

  .mermaid-diagram {
    margin: 10px 0;
    padding: 14px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: rgba(var(--accent-primary-rgb), 0.04);
    overflow-x: auto;

    svg {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
    }
  }

  .mermaid-loading {
    color: var(--text-secondary);
    font-size: 13px;
    font-family: var(--font-code);
    min-height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
