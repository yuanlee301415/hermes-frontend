/*
* 配置 API
* */
import { request } from '@/api/client.ts'

export type PlatformsKey = 'telegram' | 'discord' | 'slack' | 'whatsapp' | 'matrix' | 'weixin' | 'wecom' | 'feishu' | 'dingtalk' | 'qqbot'

export interface AppConfig {
  platforms?: Record<PlatformsKey, unknown>
}

// 获取配置
export async function getConfigApi(sections?: string[]): Promise<AppConfig> {
  const query = sections ? `?sections=${sections.join(',')}` : ''
  return request<AppConfig>(`api/hermes/config${query}`)
}
