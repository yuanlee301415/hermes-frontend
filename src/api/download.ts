/*
* 文件下载
* */

import { getActiveProfileName } from '@/utils/storage.ts'
import { getBaseUrlValue, getApiKey } from './client.ts'

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Construct a download URL with auth token as query parameter.
 * Token is passed via query param because <a> tags cannot set headers.
 */
export function getDownloadUrl(filePath: string, fileName?: string): string {
  const base = getBaseUrlValue()

  // Guard: if filePath is already a full download URL, extract the real path
  // to prevent double-wrapping (/api/hermes/download?path=/api/hermes/download?path=...)
  if (filePath.startsWith('/api/hermes/download?')) {
    try {
      const parsed = new URL(filePath, 'http://localhost')
      const realPath = parsed.searchParams.get('path')
      if (realPath) filePath = realPath
    } catch {
      // fall through with original filePath
    }
  }

  // Decode the path first in case it's already encoded (e.g., from AI responses)
  // URLSearchParams will encode it again, so we need to start with decoded text
  const decodedPath = safeDecodeURIComponent(filePath)
  const params = new URLSearchParams({ path: decodedPath })
  if (fileName) {
    const decodedName = safeDecodeURIComponent(fileName)
    params.set('name', decodedName)
  }
  const profileName = getActiveProfileName()
  if (profileName) params.set('profile', profileName)
  const token = getApiKey()
  if (token) params.set('token', token)
  return `${base}/api/hermes/download?${params.toString()}`
}
