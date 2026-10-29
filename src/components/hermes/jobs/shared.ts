// 快速预设 - 下拉选择
export const SCHEDULE_PRESETS = [
  {
    'label': '每分钟',
    'value': '* * * * *'
  },
  {
    'label': '每 5 分钟',
    'value': '*/5 * * * *'
  },
  {
    'label': '每小时',
    'value': '0 * * * *'
  },
  {
    'label': '每天 00:00',
    'value': '0 0 * * *'
  },
  {
    'label': '每天 09:00',
    'value': '0 9 * * *'
  },
  {
    'label': '每周一 09:00',
    'value': '0 9 * * 1'
  },
  {
    'label': '每月 1 日 09:00',
    'value': '0 9 1 * *'
  }
]

// 频道
export const CHANNELS = [
  { key: 'telegram', label: 'Telegram' },
  { key: 'discord', label: 'Discord' },
  { key: 'slack', label: 'Slack' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'matrix', label: 'Matrix' },
  { key: 'weixin', label: 'WeChat' },
  { key: 'wecom', label: 'WeCom' },
  { key: 'feishu', label: 'Feishu' },
  { key: 'dingtalk', label: 'DingTalk' },
  { key: 'qqbot', label: 'QQBot' }
]
