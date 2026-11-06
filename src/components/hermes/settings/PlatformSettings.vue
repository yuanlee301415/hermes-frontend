<!--
Platform 配置列表
- Platform 配置表单
- 更新配置
-->
<script lang="ts">
import { type PlatformKey, type PlatformConfig, PlatformKeys, updateCredentialsApi, fetchWeixinQrCodeApi, pollWeixinQrStatusApi } from '@/api/config.ts'
import { PLATFORMS, cloneValue, sameJson, mergeDeep, boolValue } from './shared.ts'
</script>

<script setup lang="ts">
import { useSettingsStore } from '@/store/modules/settings.ts'
import PlatformCard from './PlatformCard.vue'
import SettingRow from './SettingRow.vue'
import { saveWeixinCredentialsApi } from '@/api/config.ts'

defineOptions({ name: 'PlatformSettings' })

const settingsStore = useSettingsStore()
const credentialDrafts = reactive<Record<string, Record<string, any>>>({})
const configDrafts = reactive<Record<string, Record<string, any>>>({})
const touchedConfig = reactive<Record<string, boolean>>({})
const touchedCredentials = reactive<Record<string, boolean>>({})
const saving = reactive<Record<PlatformKey, boolean>>({} as Record<PlatformKey, boolean>)

const wxQrUrl = ref('')
const wxQrId = ref('')
const wxQrStatus = ref<'idle' | 'loading' | 'waiting' | 'scaned' | 'confirmed' | 'error' | 'expired'>('idle')

let wxPollTimer: ReturnType<typeof setTimeout> | null = null

watch(() => PLATFORMS.map(_ => ({
  key: _.key,
  config: settingsStore[_.key],
  credentials: getCreds(_.key)
})), (items) => {
  for (const item of items) {
    if (!touchedConfig[item.key]) {
      configDrafts[item.key] = cloneValue(item.config)
    }
    if (!touchedCredentials[item.key]) {
      credentialDrafts[item.key] = cloneValue(item.credentials)
    }
  }
}, { deep: true, immediate: true })

onBeforeMount(() => {
  stopWeixinPoll()
})

// 配置是否已改动
function hasConfigChanges(platform: PlatformKey) {
  return !!touchedConfig[platform] && !!configDrafts[platform] && !sameJson(configDrafts[platform], settingsStore[platform])
}

// 凭证是否已改动
function hasCredentialChanges(platform: PlatformKey) {
  return !!touchedCredentials[platform] && !!credentialDrafts[platform] && !sameJson(credentialDrafts[platform], getCreds(platform))
}

// 保存配置
async function handleSave(platform: PlatformKey) {
  saving[platform] = true
  try {
    const configChanged = hasConfigChanges(platform)
    const credentialsChanged = hasCredentialChanges(platform)
    if (configChanged) {
      await settingsStore.saveSection(platform, configDraft(platform), { restart: !credentialsChanged })
    }
    if (credentialsChanged) {
      await updateCredentialsApi(platform, credentialDraft(platform))
      await settingsStore.fetchSettings()
    }
    configDrafts[platform] = cloneValue(settingsStore[platform])
    credentialDrafts[platform] = cloneValue(getCreds(platform))
    touchedConfig[platform] = false
    touchedCredentials[platform] = false
    window.$message?.success('已保存')
  } catch (e) {
    console.error(e)
    window.$message?.error('保存失败')
  } finally {
    saving[platform] = false
  }
}

// 获取凭证
function getCreds(platform: PlatformKey) {
  return (settingsStore.platforms[platform] ?? {}) as PlatformConfig
}

// 读取凭证修改内容
function credentialDraft(platform: PlatformKey) {
  if (!credentialDrafts[platform]) {
    credentialDrafts[platform] = cloneValue(getCreds(platform))
  }
  return credentialDrafts[platform]
}

// 读取配置修改内容
function configDraft(platform: PlatformKey) {
  if (!configDrafts[platform]) {
    configDrafts[platform] = cloneValue(settingsStore[platform])
  }
  return configDrafts[platform]
}

// 设置凭证修改内容
function setCredentialDraft(platform: PlatformKey, values: Record<string, any>) {
  credentialDrafts[platform] = mergeDeep({ ...credentialDraft(platform) }, values)
  touchedCredentials[platform] = true
}

// 设置配置修改内容
function setConfigDraft(platform: PlatformKey, values: Record<string, any>) {
  configDrafts[platform] = mergeDeep({ ...configDrafts[platform] }, values)
  touchedConfig[platform] = true
}

// 开始轮询微信二维码扫码状态
async function startWeixinQrLogin() {
  wxQrStatus.value = 'loading'
  wxQrUrl.value = ''
  wxQrId.value = ''
  stopWeixinPoll()

  try {
    const data = await fetchWeixinQrCodeApi()
    wxQrId.value = data.qrcode
    wxQrUrl.value = data.qrcode_url
    window.open(data.qrcode_url, '_blank')
    wxQrStatus.value = 'waiting'
    pollWeixinStatus()
  } catch (err: any) {
    wxQrStatus.value = 'error'
    window.$message?.error(err.message || '正在获取二维码...')
  }
}

// 停止轮询微信二维码扫码状态
function stopWeixinPoll() {
  if (wxPollTimer) {
    clearTimeout(wxPollTimer)
    wxPollTimer = null
  }
}

// 轮询微信二维码扫码状态
function pollWeixinStatus() {
  if (!wxQrId.value) return
  wxPollTimer = setTimeout(async () => {
    try {
      const data = await pollWeixinQrStatusApi(wxQrId.value)
      if (data.status === 'wait') {
        pollWeixinStatus()
      } else if (data.status === 'scaned') {
        wxQrStatus.value = 'scaned'
        pollWeixinStatus()
      } else if (data.status === 'expired') {
        wxQrStatus.value = 'expired'
      } else if (data.status === 'confirmed') {
        wxQrStatus.value = 'confirmed'
        await saveWeixinCredentialsApi({
          account_id: data.account_id!,
          token: data.token!,
          base_url: data.base_url
        })
        await settingsStore.fetchSettings()
        window.$message?.success('已保存')
      }
    } catch {
      pollWeixinStatus()
    }
  }, 3000)
}

</script>

<template>
  <section class="settings-section">
    <PlatformCard
      v-for="p of PLATFORMS"
      :key="p.key"
      :name="p.name"
      :icon="p.icon"
      :exclusive="p.exclusive"
      :config="settingsStore[p.key as keyof typeof settingsStore] as PlatformConfig"
      :credentials="getCreds(p.key)"
    >
      <!--Telegram-->
      <template v-if="p.key === PlatformKeys.Telegram">
        <SettingRow label="Bot Token" hit="开发者门户获取的 Bot Token">
          <div class="input-lg">
            <n-input
              :value="credentialDraft(PlatformKeys.Telegram).token || ''"
              size="medium"
              placeholder="Bot token..."
              clearable
              @update:value="val => setCredentialDraft(PlatformKeys.Telegram, {token: val})"
            />
          </div>
        </SettingRow>

        <SettingRow label="需要 @提及" hit="群组中需要 @机器人 才会响应">
          <n-switch
            :value="configDraft(PlatformKeys.Telegram).require_mention"
            @update:value="val => setConfigDraft(PlatformKeys.Telegram, {require_mention: val})"
          ></n-switch>
        </SettingRow>

        <SettingRow label="表情回应" hit="对消息添加表情回应">
          <n-switch
            :value="configDraft(PlatformKeys.Telegram).reactions"
            @update:value="val => setConfigDraft(PlatformKeys.Telegram, {reactions: val})"
          ></n-switch>
        </SettingRow>

        <SettingRow label="自由响应聊天" hit="不需要 @提及即响应的聊天 ID（逗号分隔）">
          <div class="input-lg">
            <n-input
              :value="configDraft(PlatformKeys.Telegram).free_response_chats || ''"
              size="medium"
              placeholder="chat_id1,chat_id2"
              clearable
              @update:value="val => setConfigDraft(PlatformKeys.Telegram, {free_response_chats: val})"
            />
          </div>
        </SettingRow>

        <SettingRow label="自定义提及模式" hit="额外的触发模式列表">
          <div class="input-lg">
            <n-input
              :value="(configDraft(PlatformKeys.Telegram).mention_patterns || []).join(', ')"
              size="medium"
              placeholder="pattern1, pattern2"
              clearable
              @update:value="val => setConfigDraft(PlatformKeys.Telegram, {mention_patterns: val ? val.split(',').map(s => s.trim()) : []})"
            />
          </div>
        </SettingRow>
      </template>
      <!--Telegram End-->

      <!--Discord-->
      <template v-if="p.key === PlatformKeys.Discord">
        <SettingRow label="Bot Token" hit="开发者门户获取的 Bot Token">
          <div class="input-lg">
            <n-input
              :value="credentialDraft(PlatformKeys.Discord).token || ''"
              size="medium"
              placeholder="Bot token..."
              clearable
              @update:value="val => setCredentialDraft(PlatformKeys.Discord, {token: val})"
            />
          </div>
        </SettingRow>

        <SettingRow label="需要 @提及" hit="频道中需要 @机器人 才会响应">
          <n-switch
            :value="configDraft(PlatformKeys.Discord).require_mention"
            @update:value="val => setConfigDraft(PlatformKeys.Discord, {require_mention: val})"
          ></n-switch>
        </SettingRow>

        <SettingRow label="自动创建线程" hit="@提及 后自动创建回复线程">
          <n-switch
            :value="configDraft(PlatformKeys.Discord).auto_thread"
            @update:value="val => setConfigDraft(PlatformKeys.Discord, {auto_thread: val})"
          ></n-switch>
        </SettingRow>

        <SettingRow label="表情回应" hit="对消息添加表情回应">
          <n-switch
            :value="configDraft(PlatformKeys.Discord).reactions"
            @update:value="val => setConfigDraft(PlatformKeys.Discord, {reactions: val})"
          ></n-switch>
        </SettingRow>

        <SettingRow label="自由响应频道" hit="不需要 @提及即响应的频道 ID（逗号分隔）">
          <div class="input-lg">
            <n-input
              :value="configDraft(PlatformKeys.Discord).free_response_channels || ''"
              size="medium"
              placeholder="channel_id1,channel_id2"
              clearable
              @update:value="val => setConfigDraft(PlatformKeys.Discord, {free_response_channels: val})"
            />
          </div>
        </SettingRow>

        <SettingRow label="允许的频道" hit="白名单频道 ID（逗号分隔）">
          <div class="input-lg">
            <n-input
              :value="configDraft(PlatformKeys.Discord).allowed_channels || ''"
              size="medium"
              placeholder="channel_id1,channel_id2"
              clearable
              @update:value="val => setConfigDraft(PlatformKeys.Discord, {allowed_channels: val})"
            />
          </div>
        </SettingRow>

        <SettingRow label="忽略的频道" hit="不响应的频道 ID（逗号分隔）">
          <div class="input-lg">
            <n-input
              :value="configDraft(PlatformKeys.Discord).ignored_channels || ''"
              size="medium"
              placeholder="channel_id1,channel_id2"
              clearable
              @update:value="val => setConfigDraft(PlatformKeys.Discord, {ignored_channels: val})"
            />
          </div>
        </SettingRow>

        <SettingRow label="无线程频道" hit="不创建线程的频道 ID（逗号分隔）">
          <div class="input-lg">
            <n-input
              :value="configDraft(PlatformKeys.Discord).no_thread_channels || ''"
              size="medium"
              placeholder="channel_id1,channel_id2"
              clearable
              @update:value="val => setConfigDraft(PlatformKeys.Discord, {no_thread_channels: val})"
            />
          </div>
        </SettingRow>
      </template>
      <!--Discord End-->

      <!--Slack-->
      <template v-if="p.key === PlatformKeys.Slack">
        <SettingRow label="Bot Token" hit="开发者门户获取的 Bot Token">
          <div class="input-lg">
            <n-input
              :value="credentialDraft(PlatformKeys.Slack).token || ''"
              size="medium"
              placeholder="Bot token..."
              clearable
              @update:value="val => setCredentialDraft(PlatformKeys.Slack, {token: val})"
            />
          </div>
        </SettingRow>

        <SettingRow label="需要 @提及" hit="频道中需要 @机器人 才会响应">
          <n-switch
            :value="configDraft(PlatformKeys.Slack).require_mention"
            @update:value="val => setConfigDraft(PlatformKeys.Slack, {require_mention: val})"
          ></n-switch>
        </SettingRow>

        <SettingRow label="允许机器人消息" hit="响应其他机器人发送的消息">
          <n-switch
            :value="configDraft(PlatformKeys.Slack).allow_bots"
            @update:value="val => setConfigDraft(PlatformKeys.Slack, {allow_bots: val})"
          ></n-switch>
        </SettingRow>

        <SettingRow label="自由响应频道" hit="不需要 @提及即响应的频道 ID（逗号分隔）">
          <div class="input-lg">
            <n-input
              :value="(configDraft(PlatformKeys.Slack).mention_patterns || []).join(', ')"
              size="medium"
              placeholder="pattern1, pattern2"
              clearable
              @update:value="val => setConfigDraft(PlatformKeys.Slack, {mention_patterns: val ? val.split(',').map(s => s.trim()) : []})"
            />
          </div>
        </SettingRow>
      </template>
      <!--Slack End-->

      <!--WhatsApp End-->
      <template v-if="p.key === PlatformKeys.WhatsApp">
        <SettingRow label="启用 WhatsApp" hit="通过二维码配对启用 WhatsApp">
          <n-switch
            :value="configDraft(PlatformKeys.WhatsApp).enabled"
            @update:value="val => setConfigDraft(PlatformKeys.WhatsApp, {enabled: val})"
          ></n-switch>
        </SettingRow>

        <SettingRow label="需要 @提及" hit="频道中需要 @机器人 才会响应">
          <n-switch
            :value="configDraft(PlatformKeys.WhatsApp).require_mention"
            @update:value="val => setConfigDraft(PlatformKeys.WhatsApp, {require_mention: val})"
          ></n-switch>
        </SettingRow>

        <SettingRow label="自定义提及模式" hit="额外的触发模式列表">
          <div class="input-lg">
            <n-input
              :value="(configDraft(PlatformKeys.WhatsApp).mention_patterns || []).join(', ')"
              size="medium"
              placeholder="pattern1, pattern2"
              clearable
              @update:value="val => setConfigDraft(PlatformKeys.WhatsApp, {mention_patterns: val ? val.split(',').map(s => s.trim()) : []})"
            />
          </div>
        </SettingRow>

      </template>
      <!--WhatsApp End-->

      <!--Matrix-->
      <template v-if="p.key === PlatformKeys.Matrix">
        <SettingRow label="Access Token" hit="Matrix Access Token">
          <div class="input-lg">
            <n-input
              :value="credentialDraft(PlatformKeys.Matrix).token || ''"
              size="medium"
              placeholder="syt_..."
              clearable
              @update:value="val => setCredentialDraft(PlatformKeys.Matrix, {token: val})"
            />
          </div>
        </SettingRow>

        <SettingRow label="Homeserver URL" hit="Matrix 服务器地址">
          <div class="input-lg">
            <n-input
              :value="credentialDraft(PlatformKeys.Matrix).extra?.homeserver || ''"
              size="medium"
              placeholder="https://matrix.org"
              clearable
              @update:value="val => setCredentialDraft(PlatformKeys.Matrix, {extra: { ...credentialDraft(PlatformKeys.Matrix).extra, homeserver: val}})"
            />
          </div>
        </SettingRow>

        <SettingRow label="需要 @提及" hit="房间中需要 @机器人 才会响应">
          <n-switch
            :value="configDraft(PlatformKeys.Matrix).require_mention"
            @update:value="val => setConfigDraft(PlatformKeys.Matrix, {require_mention: val})"
          ></n-switch>
        </SettingRow>

        <SettingRow label="自动创建线程" hit="在房间中自动创建回复线程">
          <n-switch
            :value="configDraft(PlatformKeys.Matrix).auto_thread"
            @update:value="val => setConfigDraft(PlatformKeys.Matrix, {auto_thread: val})"
          ></n-switch>
        </SettingRow>

        <SettingRow label="DM 提及线程" hit="在私聊中也使用线程回复提及">
          <n-switch
            :value="configDraft(PlatformKeys.Matrix).dm_mention_threads"
            @update:value="val => setConfigDraft(PlatformKeys.Matrix, {dm_mention_threads: val})"
          ></n-switch>
        </SettingRow>

        <SettingRow label="自由响应房间" hit="不需要 @提及即响应的房间 ID（逗号分隔）">
          <div class="input-lg">
            <n-input
              :value="configDraft(PlatformKeys.Matrix).free_response_rooms || ''"
              size="medium"
              placeholder="room_id1,room_id2"
              clearable
              @update:value="val => setConfigDraft(PlatformKeys.Matrix, {free_response_rooms: val})"
            />
          </div>
        </SettingRow>
      </template>
      <!--Matrix End-->

      <!--Feishu-->
      <template v-if="p.key === PlatformKeys.Feishu">
        <SettingRow label="App ID" hit="飞书 App ID">
          <div class="input-lg">
            <n-input
              :value="credentialDraft(PlatformKeys.Feishu).extra?.app_id || ''"
              size="medium"
              placeholder="cli_..."
              clearable
              @update:value="val => setCredentialDraft(PlatformKeys.Feishu, {extra: { ...credentialDraft(PlatformKeys.Feishu).extra, app_id: val}})"
            />
          </div>
        </SettingRow>

        <SettingRow label="App Secret" hit="飞书 App Secret">
          <div class="input-lg">
            <n-input
              :value="credentialDraft(PlatformKeys.Feishu).extra?.app_secret || ''"
              size="medium"
              placeholder="App Secret"
              clearable
              @update:value="val => setCredentialDraft(PlatformKeys.Feishu, {extra: { ...credentialDraft(PlatformKeys.Feishu).extra, app_secret: val}})"
            />
          </div>
        </SettingRow>

        <SettingRow label="需要 @提及" hit="群组中需要 @机器人 才会响应">
          <n-switch
            :value="configDraft(PlatformKeys.Feishu).require_mention"
            @update:value="val => setConfigDraft(PlatformKeys.Feishu, {require_mention: val})"
          ></n-switch>
        </SettingRow>

        <SettingRow label="自由响应聊天" hit="不需要 @提及即响应的聊天 ID（逗号分隔）">
          <div class="input-lg">
            <n-input
              :value="configDraft(PlatformKeys.Feishu).free_response_chats || ''"
              size="medium"
              placeholder="chat_id1,chat_id2"
              clearable
              @update:value="val => setConfigDraft(PlatformKeys.Feishu, {free_response_chats: val})"
            />
          </div>
        </SettingRow>
      </template>
      <!--Feishu End-->

      <!--DingTalk-->
      <template v-if="p.key === PlatformKeys.DingTalk">
        <SettingRow label="Client ID" hit="钉钉 Client ID">
          <div class="input-lg">
            <n-input
              :value="credentialDraft(PlatformKeys.DingTalk).extra?.client_id || ''"
              size="medium"
              placeholder="Client Id"
              clearable
              @update:value="val => setCredentialDraft(PlatformKeys.DingTalk, {extra: { ...credentialDraft(PlatformKeys.DingTalk).extra, client_id: val}})"
            />
          </div>
        </SettingRow>

        <SettingRow label="Client Secret" hit="钉钉 Client Secret">
          <div class="input-lg">
            <n-input
              :value="credentialDraft(PlatformKeys.DingTalk).extra?.client_secret || ''"
              size="medium"
              placeholder="Client Secret"
              clearable
              @update:value="val => setCredentialDraft(PlatformKeys.DingTalk, {extra: { ...credentialDraft(PlatformKeys.DingTalk).extra, client_secret: val}})"
            />
          </div>
        </SettingRow>

        <SettingRow label="AI 卡片模板 ID" hit="钉钉 AI 卡片模板 ID；留空则不启用 AI 卡片">
          <div class="input-lg">
            <n-input
              :value="credentialDraft(PlatformKeys.DingTalk).extra?.card_template_id || ''"
              size="medium"
              placeholder="Card Template Id"
              clearable
              @update:value="val => setCredentialDraft(PlatformKeys.DingTalk, {extra: { ...credentialDraft(PlatformKeys.DingTalk).extra, card_template_id: val}})"
            />
          </div>
        </SettingRow>

        <SettingRow label="允许所有用户" hit="允许任意用户发起消息；关闭后使用白名单">
          <n-switch
            :value="boolValue(credentialDraft(PlatformKeys.DingTalk).allow_all_users)"
            @update:value="val => setCredentialDraft(PlatformKeys.DingTalk, {allow_all_users: val})"
          />
        </SettingRow>

        <SettingRow label="允许用户" hit="允许任意用户发起消息；关闭后使用白名单">
          <div class="input-lg">
            <n-input
              :value="configDraft(PlatformKeys.DingTalk).allowed_users || ''"
              size="medium"
              placeholder="user_id1,user_id2"
              clearable
              @update:value="val => setConfigDraft(PlatformKeys.DingTalk, {allowed_users: val})"
            />
          </div>
        </SettingRow>

        <SettingRow label="需要 @提及" hit="群组中需要 @机器人 才会响应">
          <n-switch
            :value="configDraft(PlatformKeys.DingTalk).require_mention"
            @update:value="val => setConfigDraft(PlatformKeys.DingTalk, {require_mention: val})"
          ></n-switch>
        </SettingRow>

        <SettingRow label="自由响应聊天" hit="不需要 @提及即响应的聊天 ID（逗号分隔）">
          <div class="input-lg">
            <n-input
              :value="configDraft(PlatformKeys.DingTalk).free_response_chats || ''"
              size="medium"
              placeholder="chat_id1,chat_id2"
              clearable
              @update:value="val => setConfigDraft(PlatformKeys.DingTalk, {free_response_chats: val})"
            />
          </div>
        </SettingRow>
      </template>
      <!--DingTalk End-->

      <!-- QQBot -->
      <template v-if="p.key === PlatformKeys.QQBot">
        <SettingRow label="App ID" hit="QQ 开放平台机器人 App ID">
          <div class="input-lg">
            <NInput
              :value="credentialDraft(PlatformKeys.QQBot).extra?.app_id || ''"
              clearable
              size="medium"
              placeholder="App ID"
              @update:value="v => setCredentialDraft(PlatformKeys.QQBot, { extra: { ...credentialDraft(PlatformKeys.QQBot).extra, app_id: v } })"
            />
          </div>
        </SettingRow>

        <SettingRow label="App Secret" hint="QQ 开放平台机器人 App Secret">
          <div class="input-lg">
            <NInput
              :value="credentialDraft(PlatformKeys.QQBot).extra?.client_secret || ''"
              clearable
              size="medium"
              placeholder="App Secret"
              @update:value="v => setCredentialDraft(PlatformKeys.QQBot, { extra: { ...credentialDraft(PlatformKeys.QQBot).extra, client_secret: v } })"
            />
          </div>
        </SettingRow>

        <SettingRow label="允许用户" hint="用户 ID 或 OpenID 白名单，多个用英文逗号分隔">
          <div class="input-lg">
            <NInput
              :value="credentialDraft(PlatformKeys.QQBot).allowed_users || ''"
              clearable
              size="medium"
              placeholder="openid1,openid2"
              @update:value="v => setCredentialDraft(PlatformKeys.QQBot, { allowed_users: v })"
            />
          </div>
        </SettingRow>

        <SettingRow label="允许所有用户" hint="允许任意用户发起消息；关闭后使用白名单">
          <NSwitch
            :value="boolValue(credentialDraft(PlatformKeys.QQBot).allow_all_users)"
            @update:value="v => setCredentialDraft(PlatformKeys.QQBot, { allow_all_users: v })"
          />
        </SettingRow>

        <SettingRow label="Markdown 支持" hint="启用 Markdown 格式消息（部分客户端可能不支持）">
          <NSwitch
            :value="configDraft(PlatformKeys.QQBot).extra?.markdown_support ?? true"
            @update:value="v => setConfigDraft(PlatformKeys.QQBot, { extra: { ...configDraft(PlatformKeys.QQBot).extra, markdown_support: v } })"
          />
        </SettingRow>
      </template>
      <!-- QQBot End  -->

      <!-- Weixin -->
      <template v-if="p.key === PlatformKeys.Weixin">
        <div class="weixin-qr-section">
          <NButton
            v-if="wxQrStatus === 'idle' || wxQrStatus === 'error' || wxQrStatus === 'expired' || wxQrStatus === 'confirmed'"
            type="primary"
            size="medium"
            @click="startWeixinQrLogin"
          >
            {{ wxQrStatus === 'confirmed' ? '重新登录' : '扫码登录' }}
          </NButton>
          <div v-if="wxQrStatus === 'loading'" class="weixin-qr-loading">
            <NSpin size="small" />
            <span>正在获取二维码...</span>
          </div>
          <div v-if="wxQrStatus === 'waiting' || wxQrStatus === 'scaned'" class="weixin-qr-hint">
            {{ wxQrStatus === 'scaned' ? '已扫描，请在手机上确认...' : '使用 QQ 扫描上方二维码，或在手机上打开链接完成绑定' }}
          </div>
        </div>
        <SettingRow label="微信 Token" hint="通过 weixin CLI 扫码登录获取 (hermes weixin)">
          <div class="input-lg">
            <NInput
              :value="credentialDraft(PlatformKeys.Weixin).token || ''"
              clearable
              size="medium"
              placeholder="Token"
              @update:value="v => setCredentialDraft(PlatformKeys.Weixin, { token: v })"
            />
          </div>
        </SettingRow>

        <SettingRow label="Account ID" hint="微信 Account ID">
          <div class="input-lg">
            <NInput
              :value="credentialDraft(PlatformKeys.Weixin).extra?.account_id || ''"
              clearable
              size="medium"
              placeholder="Account ID"
              @update:value="v => setCredentialDraft(PlatformKeys.Weixin, { extra: { ...credentialDraft(PlatformKeys.Weixin).extra, account_id: v } })"
            />
          </div>
        </SettingRow>
      </template>
      <!-- Weixin End -->

      <!-- WeCom -->
      <template v-if="p.key === PlatformKeys.WeCom">
        <SettingRow label="Bot ID" hint="企业微信 Bot ID">
          <div class="input-lg">
            <NInput
              :value="credentialDraft(PlatformKeys.WeCom).extra?.bot_id || ''"
              clearable
              size="medium"
              placeholder="Bot ID"
              @update:value="v => setCredentialDraft(PlatformKeys.WeCom, { extra: { ...credentialDraft(PlatformKeys.WeCom).extra, bot_id: v } })"
            />
          </div>
        </SettingRow>

        <SettingRow label="App Secret" hint="企业微信 Bot Secret">
          <div class="input-lg">
            <NInput
              :value="credentialDraft(PlatformKeys.WeCom).extra?.secret || ''"
              clearable
              size="small"
              placeholder="Secret"
              @update:value="v => setCredentialDraft(PlatformKeys.WeCom, { extra: { ...credentialDraft(PlatformKeys.WeCom).extra, secret: v } })"
            />
          </div>
        </SettingRow>
      </template>
      <!-- WeCom End -->

      <n-flex justify="end">
        <n-button type="primary" size="small" :loading="saving[p.key]" @click="handleSave(p.key)">保存</n-button>
      </n-flex>

    </PlatformCard>
  </section>
</template>

<style scoped lang="less">
.settings-section {
  margin-top: 16px;

  .weixin-qr-section {
    margin-top: 12px;
    margin-bottom: 12px;

    .weixin-qr-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-muted);
      font-size: 13px;
    }

    .weixin-qr-hint {
      font-size: 13px;
      color: var(--text-muted);
    }
  }

}
</style>
