/*
* 配置 API
* */
import { request } from '@/api/client.ts'

export const PlatformKeys = {
  Telegram: 'telegram',
  Discord: 'discord',
  Slack: 'slack',
  WhatsApp: 'whatsapp',
  Matrix: 'matrix',
  Feishu: 'feishu',
  DingTalk: 'dingtalk',
  QQBot: 'qqbot',
  Weixin: 'weixin',
  WeCom: 'wecom'
} as const

export type PlatformKey = typeof PlatformKeys[keyof typeof PlatformKeys]
export type PlatformConfig = Record<string, unknown>

export interface AppConfig {
  [PlatformKeys.Telegram]: PlatformConfig
  [PlatformKeys.Discord]: PlatformConfig
  [PlatformKeys.Slack]: PlatformConfig
  [PlatformKeys.WhatsApp]: PlatformConfig
  [PlatformKeys.Matrix]: PlatformConfig
  [PlatformKeys.Feishu]: PlatformConfig
  [PlatformKeys.DingTalk]: PlatformConfig
  [PlatformKeys.QQBot]: PlatformConfig
  [PlatformKeys.Weixin]: PlatformConfig
  [PlatformKeys.WeCom]: PlatformConfig
  platforms?: PlatformConfig
}

export interface WeixinQrCode {
  qrcode: string
  qrcode_url: string
}

export interface WeixinQrStatus {
  status: 'wait' | 'scaned' | 'scaned_but_redirect' | 'expired' | 'confirmed'
  account_id?: string
  token?: string
  base_url?: string
}


// 获取配置
export async function getConfigApi(sections?: string[]): Promise<AppConfig> {
  const query = sections ? `?sections=${sections.join(',')}` : ''
  return request<AppConfig>(`api/hermes/config${query}`)
}

// 更新配置
export async function updateConfigApi(section: PlatformKey, values: Record<string, any>, options?: { restart?: boolean }): Promise<void> {
  await request(`api/hermes/config`, {
    method: 'PUT',
    body: JSON.stringify({ section, values, ...options })
  })
}

// 更新凭证
export async function updateCredentialsApi(platform: PlatformKey, values: Record<string, any>): Promise<void> {
  console.log('updateCredentialsApi:', { platform, values })
  await request('api/hermes/config/credentials', {
    method: 'PUT',
    body: JSON.stringify({ platform, values }),
  })
}

// 获取微信二维码
export async function fetchWeixinQrCodeApi(): Promise<WeixinQrCode> {
  return request<WeixinQrCode>('api/hermes/weixin/qrcode')
}

// 轮询微信二维码扫码状态
export async function pollWeixinQrStatusApi(qrcode: string): Promise<WeixinQrStatus> {
  return request<WeixinQrStatus>(`api/hermes/weixin/qrcode/status?qrcode=${encodeURIComponent(qrcode)}`)
}

// 保存微信凭证
export async function saveWeixinCredentialsApi(data: {
  account_id: string
  token: string
  base_url?: string
}): Promise<void> {
  await request('api/hermes/weixin/save', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
