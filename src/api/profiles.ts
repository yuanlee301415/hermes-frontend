import { request } from './client.ts'
import { Profile, ProfileAvatar } from '@/models/Profile.ts'

// 用户配置运行状态
export interface ProfileRuntimeStatus {
  profile: Profile['name']
  bridge: {
    running: boolean
    profile: string
    mode?: string
    reachable?: boolean
    error?: string
  }
  gateway: {
    profile: string
    running: boolean
    pid?: number
    port?: number
    host?: string
    url?: string
    error?: string
    diagnostics?: {
      health_url?: string
      reason?: string
      health_ok?: boolean
    }
  }
}

// 用户配置详情
export interface HermesProfileDetail {
  name: string
  path: string
  model: string
  provider: string
  skills: number
  hasEnv: boolean
  hasSoulMd: boolean
  avatar?: ProfileAvatar | null
}

export interface ProfileRuntimeStatusesResponse {
  profiles: ProfileRuntimeStatus[]
  refreshing?: boolean
}

// 获取用户配置列表
export async function getProfilesApi(): Promise<Profile[]> {
  const res = await request<{profiles: Profile[]}>('api/hermes/profiles', {
    method: 'get'
  })
  return res.profiles
}

// 获取用户配置运行状态
export async function fetchProfileRuntimeStatusesWithMeta(options: { refresh?: boolean } = {}): Promise<ProfileRuntimeStatusesResponse> {
  const query = options.refresh === false ? '?refresh=0' : ''
  return request<ProfileRuntimeStatusesResponse>(`api/hermes/profiles/runtime-statuses${query}`)
}

// 上传用户头像
export async function updateProfileAvatarApi(name: Profile['name'], avatar: ProfileAvatar): Promise<ProfileAvatar> {
  const res = await request<{ avatar: ProfileAvatar }>(`api/hermes/profiles/${encodeURIComponent(name)}/avatar`, {
    method: 'PUT',
    body: JSON.stringify(avatar),
  })
  return res.avatar
}

// 删除用户头像
export async function deleteProfileAvatar(name: Profile['name']): Promise<void> {
  await request(`api/hermes/profiles/${encodeURIComponent(name)}/avatar`, { method: 'DELETE' })
}

// 重启网关
export async function restartProfileGateway(name: Profile['name']): Promise<ProfileRuntimeStatus['gateway']> {
  const res = await request<{ success: boolean; gateway: ProfileRuntimeStatus['gateway'] }>(
    `api/hermes/profiles/${encodeURIComponent(name)}/gateway/restart`,
    { method: 'POST' },
  )
  return res.gateway
}

// 重启配置
export async function restartProfileRuntime(name: Profile['name']): Promise<ProfileRuntimeStatus> {
  const res = await request<{ success: boolean; status: ProfileRuntimeStatus }>(
    `api/hermes/profiles/${encodeURIComponent(name)}/restart`,
    { method: 'POST' },
  )
  return res.status
}

// 切换前端配置
export async function switchHermesProfile(name: Profile['name']): Promise<boolean> {
  try {
    await request('api/hermes/profiles/active', {
      method: 'PUT',
      body: JSON.stringify({ name }),
    })
    return true
  } catch {
    return false
  }
}
