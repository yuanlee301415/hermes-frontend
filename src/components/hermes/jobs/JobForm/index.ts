/*
* 任务 表单
* */
import { type JobDTO } from '@/models/Job.ts'
import type { PlatformKey } from '@/api/config.ts'
import { PlatformKeys } from '@/api/config.ts'

// 任务表单 Model
export type JobFormModel = Omit<JobDTO, 'repeat'> & {
  repeat_times: number | null
}

// 投递目标是否可用
export function isDeliverTargetConfigured(platforms: Record<string, any>, key: PlatformKey): boolean {
  const config = platforms[key] || {}
  switch (key) {
    case PlatformKeys.Telegram:
    case PlatformKeys.Discord:
    case PlatformKeys.Slack:
      return hasText(config.token)
    case PlatformKeys.WhatsApp:
      return config.enabled === true || config.enabled === 'true'
    case PlatformKeys.Matrix:
      return hasText(config.token) && hasText(config.extra?.homeserver)
    case PlatformKeys.Weixin:
      return hasText(config.token) && hasText(config.extra?.account_id)
    case PlatformKeys.WeCom:
      return hasText(config.extra?.bot_id) && hasText(config.extra?.secret)
    case PlatformKeys.Feishu:
      return hasText(config.extra?.app_id) && hasText(config.extra?.app_secret)
    case PlatformKeys.DingTalk:
      return (hasText(config.extra?.client_id) && hasText(config.extra?.client_secret))
        || (hasText(config.extra?.app_key) && hasText(config.extra?.client_secret))
    case PlatformKeys.QQBot:
      return hasText(config.extra?.app_id) && hasText(config.extra?.client_secret)
    default:
      return false
  }
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && !!value.trim().length
}
