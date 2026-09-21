import { request } from '@/api/client.ts'

export interface ModelContext {
  id: number
  provider: string
  model: string
  context_limit: number
}

// 根据 provider 和 model 查询模型上下文配置
export async function setModelContext(provider: string, model: string, contextLimit: number) {
  const res = await request<{ success: boolean; data: ModelContext }>(
    `api/hermes/model-context/${encodeURIComponent(provider)}/${encodeURIComponent(model)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ provider, model, context_limit: contextLimit }),
    }
  )
  return res.data
}
