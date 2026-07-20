/*
* 渲染 多媒体 Markdown
* */

/**
 * 判断路径是否为本地文件路径
 * @param path 文件路径
 * @returns 是否为本地路径（绝对路径或以盘符开头）
 */
export function isLocalFilePath(path: string): boolean {
  return path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path)
}

/**
 * 规范化本地文件路径，统一使用正斜杠
 * @param path 原始路径
 * @returns 规范化后的路径
 */
export function normalizeLocalFilePath(path: string): string {
  return /^[a-zA-Z]:\\/.test(path) ? path.replace(/\\/g, '/') : path
}

/**
 * 判断文件路径是否具有指定的扩展名
 * @param path 文件路径
 * @param extensions 扩展名集合
 * @returns 是否匹配
 */
export function hasExtension(path: string, extensions: Set<string>): boolean {
  // 去除查询参数和哈希片段
  const clean = path.split('?')[0].split('#')[0]
  // 获取文件扩展名（小写）
  const ext = clean.split('.').pop()?.toLowerCase()
  return !!ext && extensions.has(ext)
}

export function getMarkdownVideo(downloadUrl: string, fileName: string) {
  return `<div class="markdown-video-container">
        <video class="markdown-video" controls preload="metadata" src="${downloadUrl}"></video>
        <div class="markdown-video-footer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span class="att-name">${fileName}</span>
        </div>
      </div>`
}

export function getMarkdownAudio(downloadUrl: string, fileName: string) {
  return `<div class="markdown-audio-container">
        <audio class="markdown-audio" controls preload="metadata" src="${downloadUrl}"></audio></audio>
        <div class="markdown-audio-footer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span class="att-name">${fileName}</span>
        </div>
      </div>`
}

export function getMarkdownFile(path: string, fileName: string) {
  return `<div class="markdown-file-card" data-path="${path}" data-filename="${fileName}" title="下载文件">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <span class="att-name">${fileName}</span>
      <button class="att-download-btn" type="button" title="下载文件" aria-label="下载文件">
        <svg class="att-download-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
    </div>`
}
