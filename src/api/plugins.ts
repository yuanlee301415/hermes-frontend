/*
* 插件 API
* */

import { request } from '@/api/client.ts'
import { PluginInfo, PluginsMetadata } from '@/models/PluginInfo.ts'

export interface HermesPluginsResponse {
  plugins: PluginInfo[]
  warnings: string[]
  metadata: PluginsMetadata
}

// 获取插件列表
export async function getPluginsApi(): Promise<HermesPluginsResponse> {
  return request<HermesPluginsResponse>('api/hermes/plugins')
}
