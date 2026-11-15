/*
* 技能 API
* */

import { request } from '@/api/client.ts'
import { SkillCategory, SkillInfo } from '@/models/Skill.ts'

// Skill 外部目录
export interface ExternalDirEntry {
  raw: string
  expanded: string
  exists: boolean
  isDir: boolean
}

// Skill 外部目录路径
export interface SkillPaths {
  local: string
  external: string[]
  /** Raw entries as written in `config.skills.external_dirs`, with existence
   *  flags so the UI can grey-out paths that don't currently resolve.
   *  Optional — older servers may not include it. */
  externalRaw?: ExternalDirEntry[]
}

// Skill 列表
export interface SkillListResponse {
  categories: SkillCategory[]
  archived: SkillInfo[]
  paths?: SkillPaths
}

// Skill 附件
export interface SkillFileEntry {
  path: string
  name: string
  isDir: boolean
}

// 获取 Skill 列表
export async function getSkillsApi(): Promise<SkillListResponse> {
  const res = await request<SkillListResponse>(`api/hermes/skills`)
  return { categories: res.categories, archived: res.archived ?? [], paths: res.paths }
}

// 获取 Skill 内容
export async function getSkillContentApi(skillPath: string): Promise<string> {
  const res = await request<{ content: string }>(`api/hermes/skills/${skillPath}`)
  return res.content
}

// 获取 Skill 附件列表
export async function getSkillFilesApi(category: SkillCategory['name'], skill: SkillInfo['name']): Promise<SkillFileEntry[]> {
  const res = await request<{ files: SkillFileEntry[] }>(`api/hermes/skills/${category}/${skill}/files`)
  return res.files
}

// 置顶/取消置顶 Skill
export async function pinSkillApi(name: SkillInfo['name'], pinned: boolean): Promise<void> {
  await request('api/hermes/skills/pin', {
    method: 'PUT',
    body: JSON.stringify({ name, pinned }),
  })
}

// 导入 Skill
export async function importSkillApi(files: File[], category?: SkillCategory['name']): Promise<{name: string}> {
  const formData = new FormData()
  for (const file of files) {
    const path = file.webkitRelativePath
    formData.append('file', file, path)
  }
  if (category) {
    formData.append('category', category)
  }
  return request(`api/hermes/skills/import`, {
    method: 'POST',
    body: formData
  })
}

// 获取外部目录
export async function getExternalDirsApi(): Promise<ExternalDirEntry[]> {
  const res = await request<{ dirs: ExternalDirEntry[] }>('api/hermes/skills/external-dirs')
  return res.dirs ?? []
}

// 保存外部目录
export async function saveExternalDirsApi(dirs: string[]): Promise<void> {
  await request('api/hermes/skills/external-dirs', {
    method: 'PUT',
    body: JSON.stringify({ dirs }),
  })
}

// 删除 Skill
export async function deleteSkillApi(category: SkillCategory['name'], name: SkillInfo['name']): Promise<void> {
  const c = encodeURIComponent(category)
  const n = encodeURIComponent(name)
  await request(`api/hermes/skills/${c}/${n}`,{
    method: 'DELETE'
  })
}

// 启用/禁用 Skill
export async function toggleSkillEnabledApi(skill: SkillInfo['name'], enabled: boolean): Promise<void> {
  await request('api/hermes/skills/toggle', {
    method: 'PUT',
    body: JSON.stringify({ skill, enabled }),
  })
}
