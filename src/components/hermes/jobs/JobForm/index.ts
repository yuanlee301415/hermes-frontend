/*
* 任务 表单
* */
import { type JobDTO } from '@/models/Job.ts'
import type { PlatformsKey } from '@/api/config.ts'

function hasText(value: unknown): boolean {
  return typeof value === 'string' && !!value.trim().length
}

// 任务表单 Model
export type JobFormModel = Omit<JobDTO, 'repeat'> & {
  repeat_times: number | null
}

// 投递目标是否可用
export function isDeliverTargetConfigured(platforms: Record<string, any>, key: PlatformsKey): boolean {
  const config = platforms[key] || {}
  switch (key) {
    case 'telegram':
    case 'discord':
    case 'slack':
      return hasText(config.token)
    case 'whatsapp':
      return config.enabled === true || config.enabled === 'true'
    case 'matrix':
      return hasText(config.token) && hasText(config.extra?.homeserver)
    case 'weixin':
      return hasText(config.token) && hasText(config.extra?.account_id)
    case 'wecom':
      return hasText(config.extra?.bot_id) && hasText(config.extra?.secret)
    case 'feishu':
      return hasText(config.extra?.app_id) && hasText(config.extra?.app_secret)
    case 'dingtalk':
      return (hasText(config.extra?.client_id) && hasText(config.extra?.client_secret))
        || (hasText(config.extra?.app_key) && hasText(config.extra?.client_secret))
    case 'qqbot':
      return hasText(config.extra?.app_id) && hasText(config.extra?.client_secret)
    default:
      return false
  }
}
