/*
 * App store
 * */
import { defineStore } from 'pinia'
import { hasApiKey } from '@/api/client.ts'
import { ACTIVE_PROFILE_NAME_KEY, SIDEBAR_COLLAPSED_KEY } from '@/constants/storage-keys.ts'
import { fetchAvailableModels, type AvailableModelsResponse, type AvailableModelGroup, type ProfileAvailableModels, type ModelVisibility } from '@/api/system.ts'

const MODELS_CACHE_TTL_MS = 30000

let modelsLoadPromise: Promise<void> | null = null
let modelsLastRequestedAt = 0

export const useAppStore = defineStore('appStore', () => {
  const sidebarCollapsed = ref(!!Number(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)))
  const modelGroups = ref<AvailableModelGroup[]>([])
  const profileModelGroups = ref<ProfileAvailableModels[]>([])
  const modelAliases = ref<Record<string, Record<string, string>>>({})
  const modelVisibility = ref<ModelVisibility>({})
  const customModels = ref<Record<string, string[]>>({})
  const selectedModel = ref('')
  const selectedProvider = ref('')

  function toggleSidebarCollapsed() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed.value ? '1' : '0')
  }

  function applyAvailableModelsResponse(res: AvailableModelsResponse) {
    modelGroups.value = res.groups
    profileModelGroups.value = res.profiles || []
    modelAliases.value = res.model_aliases || {}
    modelVisibility.value = res.model_visibility || {}
    customModels.value = res.custom_models || {}

    const activeProfileName = localStorage.getItem(ACTIVE_PROFILE_NAME_KEY) || ''
    const activeProfileModels = activeProfileName
      ? profileModelGroups.value.find(entry => entry.profile === activeProfileName)
      : undefined
    const defaultSource = activeProfileModels || res
    const defaultGroups = defaultSource.groups || []
    const defaultModel = defaultSource.default || ''
    const defaultProvider = defaultSource.default_provider || ''
    const explicitGroup = defaultGroups.find(g => g.provider === defaultProvider && g.models.includes(defaultModel))
    const inferredGroup = defaultGroups.find(g => g.models.includes(defaultModel))
    const fallbackGroup = defaultGroups.find(g => g.models.length > 0)

    const providerGroup = defaultProvider ? defaultGroups.find(g => g.provider === defaultProvider) : undefined
    const allProvider = defaultProvider ? res.allProviders.find(g => g.provider === defaultProvider) : undefined
    const providerCatalog = providerGroup?.available_models?.length
      ? providerGroup.available_models
      : allProvider?.available_models?.length
        ? allProvider.available_models
        : allProvider?.models || []
    const visibilityRule = defaultProvider ? modelVisibility.value[defaultProvider] : undefined
    const hiddenByVisibility = !!(
      defaultModel &&
      visibilityRule?.mode === 'include' &&
      !visibilityRule.models.includes(defaultModel) &&
      (providerCatalog.length === 0 || providerCatalog.includes(defaultModel))
    )
    const unlistedDefault = !!(
      defaultModel &&
      defaultProvider &&
      providerGroup &&
      !providerGroup.models.includes(defaultModel) &&
      !hiddenByVisibility
    )

    if (explicitGroup || inferredGroup) {
      const selectedGroup = explicitGroup || inferredGroup!
      selectedModel.value = defaultModel
      selectedProvider.value = selectedGroup.provider
    } else if (unlistedDefault) {
      selectedModel.value = defaultModel
      selectedProvider.value = defaultProvider
      customModels.value = {
        ...customModels.value,
        [defaultProvider]: Array.from(new Set([...(customModels.value[defaultProvider] || []), defaultModel])),
      }
    } else if (fallbackGroup) {
      selectedModel.value = fallbackGroup.models[0]
      selectedProvider.value = fallbackGroup.provider
    } else {
      selectedModel.value = ''
      selectedProvider.value = ''
    }
  }

  async function loadModels(force = false) {
    if (!hasApiKey()) return
    if (!force && modelsLoadPromise) return modelsLoadPromise
    if (!force && modelsLastRequestedAt > 0 && Date.now() - modelsLastRequestedAt < MODELS_CACHE_TTL_MS) return
    modelsLastRequestedAt = Date.now()
    modelsLoadPromise = (async () => {
      try {
        const res = await fetchAvailableModels()
        applyAvailableModelsResponse(res)
      } finally {
        modelsLoadPromise = null
      }
    })()
    return modelsLoadPromise
  }

  async function waitForModelsForRun(timeoutMs = 15000) {
    if (!hasApiKey()) return
    const pending = modelsLoadPromise || (modelsLastRequestedAt === 0 ? loadModels() : null)
    if (!pending) return
    await Promise.race([
      pending,
      new Promise(resolve => setTimeout(resolve, timeoutMs))
    ])
  }

  function getModelAlias(modelId: string, provider?: string): string {
    if (provider) return modelAliases.value[provider]?.[modelId] ?? ''
    for (const aliases of Object.values(modelAliases.value)) {
      if (aliases[modelId]) return aliases[modelId]
    }
    return ''
  }

  function displayModelName(modelId: string, provider?: string): string {
    return getModelAlias(modelId, provider) || modelId
  }

  return {
    sidebarCollapsed,
    modelGroups,
    profileModelGroups,
    customModels,
    modelAliases,
    selectedModel,
    selectedProvider,
    toggleSidebarCollapsed,
    waitForModelsForRun,
    displayModelName,
    loadModels
  }
})
