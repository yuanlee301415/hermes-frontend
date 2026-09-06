<!--
新建对话 表单
-->
<script lang="ts">
import { type AvailableModelGroup } from '@/api/system.ts'
import { DEFAULT_PROFILE_NAME } from '@/constants/hardcoded.ts'
import { Session } from '@/models/Session.ts'
import { NewChatModel } from './index.ts'

const AGENT_OPTIONS = [
  { label: 'Hermes', value: Session.AGENT_TYPE.Hermes  },
  { label: 'Claude code', value: Session.CODING_AGENT_ID.ClaudeCode },
  { label: 'Codex', value: Session.CODING_AGENT_ID.Codex },
]

const AGENT_MODE_OPTIONS = [
  { label: '全局默认配置', value: Session.CODING_AGENT_MODE.Global },
  { label: '选择提供商和模型', value: Session.CODING_AGENT_MODE.Scoped }
]

const API_MODE_OPTIONS = [
  { label: 'OpenAI Chat Completions (/v1/chat/completions)', value: Session.API_MODE.ChatCompletions },
  { label: 'OpenAI Responses (/v1/responses)', value: Session.API_MODE.CodexResponses },
  { label: 'Anthropic Messages (/v1/messages)', value: Session.API_MODE.AnthropicMessages }
]

// 需要特殊认证的编码代理提供商集合
const CODING_AGENT_AUTH_PROVIDER_KEYS = new Set(["openai-codex", "copilot", "xai-oauth", "nous"]);

</script>

<script setup lang="ts">
import { useProfilesStore } from '@/store/modules/profiles.ts'
import { useAppStore } from '@/store/modules/app.ts'
import FolderPicker from '@/components/hermes/chat/FolderPicker.vue'

const profileStore = useProfilesStore()
const appStore = useAppStore()
const {model = new NewChatModel({} as NewChatModel)} = defineProps<{model: NewChatModel}>()

// 表单数据
const formModel = computed({
  get() {
    return Object.assign<NewChatModel, Partial<NewChatModel>>(model, {
      agent: Session.AGENT_TYPE.Hermes,
      codingAgentMode: Session.CODING_AGENT_MODE.Scoped,
      apiMode: Session.API_MODE.CodexResponses,
      profile: DEFAULT_PROFILE_NAME
    })
  },
  set(val) {
    return val
  }
})

// `profile` 选项
const profileOptions = computed(() => (profileStore.profiles.length ? profileStore.profiles : [{name: DEFAULT_PROFILE_NAME}]).map(_ => ({ label: _.name, value: _.name })))

// 当前配置文件的可选择模型组列表
const modelGroups = computed(() => getSelectableModelGroupsForProfile(formModel.value.profile))

// 当前配置文件的提供商选项
const providerOptions = computed(() => modelGroups.value.map(group => ({
  label: group.label ?? group.provider,
  value: group.provider
})))

// 当前提供商的模型选项
const modelOptions = computed(() => {
  const group = modelGroups.value.find(_ => _.provider === formModel.value.provider)
  return (group?.models ?? []).map(model => ({
    label: appStore.displayModelName(model, group?.provider),
    value: model
  }))
})

// 是否为编码 Agent
const isCodingAgent = computed(() => formModel.value.agent !== Session.AGENT_TYPE.Hermes)
// 是否为全局编码 Agent

const isGlobalCodingAgent = computed(() => isCodingAgent.value && formModel.value.codingAgentMode === Session.CODING_AGENT_MODE.Global)

// 是否使用提供商模型
const usersProviderModel = computed(() => !isGlobalCodingAgent.value)

// 当前选中的提供商模型组
const selectedProviderGroup = computed(() => modelGroups.value.find(_ => _.provider === formModel.value.provider))

// 是否需要手动输入Base URL
const needsBaseUrl = computed(() => isCodingAgent.value && formModel.value.codingAgentMode === Session.CODING_AGENT_MODE.Scoped && !selectedProviderGroup.value?.base_url)

// 是否需要手动输入API Key
const needsApiKey = computed(() => isCodingAgent.value && formModel.value.codingAgentMode === Session.CODING_AGENT_MODE.Scoped && !selectedProviderGroup.value?.api_key)


defineExpose({
  usersProviderModel,
  isCodingAgent,
  selectedProviderGroup
})

syncModelSelection()


/**
 * 同步更新新建聊天的模型选择（重置为默认值）
 */
function syncModelSelection() {
  const defaults = getDefaultModelForProfile(formModel.value.profile)
  formModel.value.provider = defaults.provider
  formModel.value.model = defaults.model
  formModel.value.baseUrl = ''
  formModel.value.apiKey = ''
  syncApiMode()
}

/**
 * 同步更新新建聊天的API协议模式
 */
function syncApiMode() {
  formModel.value.apiMode = defaultApiMode(selectedProviderGroup.value)
}

/**
 * 根据提供商和Base URL推断默认的API协议模式
 * @param group 模型组
 * @returns API协议模式
 */
function defaultApiMode(group?: AvailableModelGroup) {
  // 如果模型组已指定API模式，直接使用
  if (group?.api_mode) return group.api_mode;
  const providerKey = String(group?.provider ?? formModel.value.provider ?? '').toLowerCase()
  const baseUrl = String(group?.base_url ?? formModel.value.baseUrl ?? '').toLowerCase()

  // Anthropic/Claude 使用 anthropic_messages 协议
  if (providerKey.includes("claude") || providerKey === "anthropic" || baseUrl.includes("anthropic") || baseUrl.includes("/anthropic")) return API_MODE_OPTIONS[2].value

  // DeepSeek、LM Studio、本地服务使用 chat_completions 协议
  if (providerKey === "deepseek" || providerKey === "lmstudio" || baseUrl.includes("deepseek") || baseUrl.includes("127.0.0.1") || baseUrl.includes("localhost")) return API_MODE_OPTIONS[0].value

  // 默认使用 codex_responses 协议
  return API_MODE_OPTIONS[1].value
}

/**
 * 获取指定配置文件的默认模型
 * @param profile 配置文件名称
 * @returns 默认提供商和模型
 */
function getDefaultModelForProfile(profile: string) {
  const groups = getSelectableModelGroupsForProfile(profile)
  const profileModels = appStore.profileModelGroups.find((entry) => entry.profile === profile)
  const defaultProvider = profileModels?.default_provider ?? ''
  const defaultModel = profileModels?.default ?? '';
  // 优先使用默认提供商的模型组
  const providerGroup = defaultProvider ? groups.find((group) => group.provider === defaultProvider) : undefined
  // 如果没有默认提供商或默认提供商不存在，则选择第一个有模型的组
  const fallbackGroup = providerGroup || groups.find((group) => group.models.length > 0)
  return {
    provider: fallbackGroup?.provider ?? '',
    model: fallbackGroup?.models.includes(defaultModel) ? defaultModel : fallbackGroup?.models[0] ?? ''
  }
}

/**
 * 获取指定配置文件的模型组列表
 * @param profile 配置文件名称
 * @returns 模型组列表
 */
function getModelGroupsForProfile(profile: string) {
  const models = appStore.profileModelGroups.find(_ => _.profile === profile)
  return models?.groups ?? []
}

/**
 * 判断提供商是否为编码代理认证提供商
 * @param provider 提供商名称
 * @returns 是否为编码代理认证提供商
 */
function isCodingAgentAuthProvider(provider?: string) {
  return CODING_AGENT_AUTH_PROVIDER_KEYS.has(String(provider ?? '').toLowerCase())
}

/**
 * 判断新建聊天时是否允许使用指定的模型组
 * @param group 模型组
 * @returns 是否允许
 */
function isProviderAllowed(group: AvailableModelGroup) {
  // 非编码代理或全局模式下，所有提供商都允许
  if (!(formModel.value.agent !== Session.AGENT_TYPE.Hermes && formModel.value.codingAgentMode !== Session.CODING_AGENT_MODE.Scoped)) return true
  return !isCodingAgentAuthProvider(group.provider)
}

/**
 * 获取指定配置文件中可选择的模型组列表
 * @param profile 配置文件名称
 * @returns 可选择的模型组列表
 */
function getSelectableModelGroupsForProfile(profile: string) {
  return getModelGroupsForProfile(profile).filter(isProviderAllowed)
}

/**
 * 提供商
 * @param val 提供商名称
 */
function handelProviderChange(val: string) {
  formModel.value.provider = val
  formModel.value.model = modelOptions.value[0]?.value
  formModel.value.baseUrl = ''
  formModel.value.apiKey = ''
}

</script>

<template>
  <div class="new-chat-container">
    <div class="new-chat-form">
      <dl>
        <dt>Agent</dt>
        <dd>
          <n-select v-model:value="formModel.agent" :options="AGENT_OPTIONS"/>
        </dd>
      </dl>

      <dl>
        <dt>启动方式</dt>
        <dd>
          <n-radio-group v-model:value="formModel.codingAgentMode">
            <n-radio-button v-for="mode of AGENT_MODE_OPTIONS" :key="mode.value" :value="mode.value">{{mode.label}}</n-radio-button>
          </n-radio-group>
        </dd>
      </dl>

      <dl>
        <dt>用户</dt>
        <dd>
          <n-select v-model:value="formModel.profile" :options="profileOptions" :loading="profileStore.loading"/>
        </dd>
      </dl>

      <dl v-if="usersProviderModel">
        <dt>Provider</dt>
        <dd>
          <n-select :value="formModel.provider" :options="providerOptions" @update:value="handelProviderChange"/>
        </dd>
      </dl>

      <dl v-if="usersProviderModel">
        <dt>模型</dt>
        <dd>
          <n-select v-model:value="formModel.model" :options="modelOptions" :disabled="!formModel.provider" filterable/>
        </dd>
      </dl>

      <dl v-if="isCodingAgent && formModel.codingAgentMode === Session.CODING_AGENT_MODE.Scoped">
        <dt>协议</dt>
        <dd>
          <n-select v-model:value="formModel.apiMode" :options="API_MODE_OPTIONS"/>
        </dd>
      </dl>

      <dl v-if="needsBaseUrl">
        <dt>BASE URL</dt>
        <dd>
          <n-input v-model:value="formModel.baseUrl" placeholder="请输入 Base URL"/>
        </dd>
      </dl>

      <dl v-if="needsApiKey">
        <dt>API Key</dt>
        <dd>
          <n-input v-model:value="formModel.apiKey" type="password" show-password-on="click" placeholder="请输入 API Key"/>
        </dd>
      </dl>

      <dl>
        <dt>工作区</dt>
        <dd class="workspace">
          <n-input v-model:value="formModel.workspace"/>
          <div class="folder">
            <FolderPicker v-model:path="formModel.workspace" />
          </div>
        </dd>
      </dl>

    </div>

  </div>
</template>

<style scoped lang="less">
.new-chat-container {
  .new-chat-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    dl {
      display: flex;
      flex-direction: column;
      gap: 6px;
      dt {
        color: var(--text-muted);
        font-weight: 500;
      }
      .workspace {
        border: 1px solid #ffffff1a;
        border-radius: 6px;
        padding: 8px;
        background-color: #00000033;
        .folder {
          margin-top: 10px;
          max-height: 360px;
          overflow-y: auto;
        }
      }
    }
  }
}
</style>
