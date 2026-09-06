import { request } from './client.ts'

interface FolderEntry {
  name: string
  path: string
  fullPath: string
}

interface FolderListResponse {
  base: string
  current: string
  folders: FolderEntry[]
}

/**
 * 获取工作目录
 * - `path` 为空时，获取工作目录根目录
 * - `path` 不为空时为：子目录路径（相对于上一层目录的路径）
 */
export async function getFoldersApi(path?: string): Promise<FolderListResponse> {
  const params = new URLSearchParams()
  if (path) params.set('path', path)
  const query = params.size ? '?' + params.toString() : ''
  return await request<FolderListResponse>(`api/hermes/workspace/folders${query}`, {
    method: 'get'
  })
}
