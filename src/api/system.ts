import { type SessionApiMode } from '@/models/Session.ts'
import { request } from './client.ts'

export interface AvailableModelGroup {
  provider: string   // credential pool key (e.g. "zai", "custom:subrouter.ai")
  label: string      // display name (e.g. "zai", "subrouter.ai")
  base_url: string
  models: string[]
  /** Full unfiltered model catalog for this provider, used to restore hidden WUI models. */
  available_models?: string[]
  api_key: string
  api_mode?: SessionApiMode
  builtin?: boolean
  /** Env var used by Hermes to override this provider's base URL. If present, the preset URL is editable. */
  base_url_env?: string
  /** 可选：模型 ID -> 元数据（preview/disabled/alias）。alias 仅用于 Web UI 展示。 */
  model_meta?: Record<string, { preview?: boolean; disabled?: boolean; alias?: string }>
}

export interface ProfileAvailableModels {
  profile: string
  default: string
  default_provider: string
  groups: AvailableModelGroup[]
}

export interface ModelVisibilityRule {
  mode: 'all' | 'include'
  models: string[]
}

export type ModelVisibility = Record<string, ModelVisibilityRule>

export type CustomModels = Record<string, string[]>

export interface AvailableModelsResponse {
  default: string
  default_provider: string
  groups: AvailableModelGroup[]
  allProviders: AvailableModelGroup[]
  profiles?: ProfileAvailableModels[]
  /** Web UI-only display aliases keyed by provider -> canonical model ID. */
  model_aliases?: Record<string, Record<string, string>>
  model_visibility?: ModelVisibility
  custom_models?: CustomModels
}

export async function fetchAvailableModels(): Promise<AvailableModelsResponse> {
  return request<AvailableModelsResponse>(`api/hermes/available-models`)
}
