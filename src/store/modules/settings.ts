/*
* 配置 Store
* - Platform 配置
* */

import { defineStore } from 'pinia'
import { type PlatformConfig, type PlatformKey, getConfigApi, updateConfigApi, PlatformKeys } from '@/api/config.ts'

export const useSettingsStore = defineStore('SettingsStore', () => {
  const loading = ref(false)
  const saving = ref(false)

  const platforms = ref<PlatformConfig>({})
  const telegram = ref<PlatformConfig>({})
  const discord = ref<PlatformConfig>({})
  const slack = ref<PlatformConfig>({})
  const whatsapp = ref<PlatformConfig>({})
  const matrix = ref<PlatformConfig>({})
  const feishu = ref<PlatformConfig>({})
  const dingtalk = ref<PlatformConfig>({})
  const qqbot = ref<PlatformConfig>({})
  const weixin = ref<PlatformConfig>({})
  const wecom = ref<PlatformConfig>({})

  // 获取配置
  async function fetchSettings() {
    loading.value = true
    try {
      const data = await getConfigApi()
      platforms.value = data.platforms ?? {}
      telegram.value = data.telegram ?? {}
      discord.value = data.discord ?? {}
      slack.value = data.slack ?? {}
      whatsapp.value = data.whatsapp ?? {}
      matrix.value = data.matrix ?? {}
      feishu.value = data.feishu ?? {}
      dingtalk.value = data.dingtalk ?? {}
      qqbot.value = data.qqbot ?? {}
      weixin.value = data.weixin ?? {}
      wecom.value = data.wecom ?? {}
    } catch (e) {
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  // 保存配置
  async function saveSection(section: PlatformKey, values: Record<string, any>, options?: { restart: boolean }) {
    saving.value = true
    try {
      await updateConfigApi(section, values, options)
      switch (section) {
        case PlatformKeys.Telegram:
          telegram.value = { ...telegram.value, ...values }
          break
        case PlatformKeys.Discord:
          discord.value = { ...discord.value, ...values }
          break
        case PlatformKeys.Slack:
          slack.value = { ...slack.value, ...values }
          break
        case PlatformKeys.WhatsApp:
          whatsapp.value = { ...whatsapp.value, ...values }
          break
        case PlatformKeys.Matrix:
          matrix.value = { ...matrix.value, ...values }
          break
        case PlatformKeys.WeCom:
          wecom.value = { ...wecom.value, ...values }
          break
        case PlatformKeys.Feishu:
          feishu.value = { ...feishu.value, ...values }
          break
        case PlatformKeys.DingTalk:
          dingtalk.value = { ...dingtalk.value, ...values }
          break
        case PlatformKeys.QQBot:
          qqbot.value = { ...qqbot.value, ...values }
          break
        case PlatformKeys.Weixin:
          weixin.value = { ...weixin.value, ...values }
          break
      }
    } catch (e) {
      console.error(e)
    } finally {
      saving.value = false
    }
  }

  return {
    loading,
    saving,

    platforms,
    telegram,
    discord,
    slack,
    whatsapp,
    matrix,
    feishu,
    dingtalk,
    qqbot,
    weixin,
    wecom,

    fetchSettings,
    saveSection
  }
})
