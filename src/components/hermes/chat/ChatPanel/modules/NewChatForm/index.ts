import { type SessionAgentType, type SessionCodingAgentId, type SessionCodingAgentMode, type SessionApiMode } from '@/models/Session.ts'

/**
 * 新建对话 表单数据 Model
 */
export class NewChatModel {
  agent: SessionAgentType | SessionCodingAgentId
  codingAgentMode: SessionCodingAgentMode
  apiKey: string
  apiMode: SessionApiMode
  baseUrl: string
  profile: string
  provider: string
  model: string
  workspace: string
  constructor(_: NewChatModel) {
    const {agent, codingAgentMode, apiMode, apiKey, baseUrl, profile, provider, model, workspace} = {..._}
    this.agent = agent
    this.codingAgentMode = codingAgentMode
    this.apiKey = apiKey
    this.apiMode = apiMode
    this.baseUrl = baseUrl
    this.profile = profile
    this.provider = provider
    this.model = model
    this.workspace = workspace
  }
}
