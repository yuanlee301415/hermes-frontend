/*
* 插件 Model
* */

// 配置状态 枚举
const CONFIG_STATUS = {
  Enabled: 'enabled',
  Auto: 'auto',
  NotEnabled: 'not-enabled',
  Disabled: 'disabled',
  ProviderManaged: 'provider-managed'
} as const

// 配置状态 Label 枚举
const CONFIG_STATUS_LABEL = {
  [CONFIG_STATUS.Enabled]: '已启用',
  [CONFIG_STATUS.Auto]: '自动',
  [CONFIG_STATUS.NotEnabled]: '未启用',
  [CONFIG_STATUS.Disabled]: '已禁用',
  [CONFIG_STATUS.ProviderManaged]: 'Provider 管理'
} as const

// 运行状态 枚举
const EFFECTIVE_STATUS = {
  Enabled: 'enabled',
  AutoActive: 'auto-active',
  Inactive: 'inactive',
  Disabled: 'disabled',
  ProviderManaged: 'provider-managed'
} as const

// 运行状态 Label 枚举
const EFFECTIVE_STATUS_LABEL = {
  [EFFECTIVE_STATUS.Enabled]: '配置启用',
  [EFFECTIVE_STATUS.AutoActive]: '自动启用',
  [EFFECTIVE_STATUS.Inactive]: '未启用',
  [EFFECTIVE_STATUS.Disabled]: '已禁用',
  [EFFECTIVE_STATUS.ProviderManaged]: 'Provider 管理'
} as const

/**
 * 插件详情 Model
 */
export class PluginInfo {
  key: string
  // 名称
  name: string
  // 类型
  kind: string
  // 来源
  source: string
  // 配置状态
  configStatus: typeof CONFIG_STATUS[keyof typeof CONFIG_STATUS]
  // 运行状态
  effectiveStatus: typeof EFFECTIVE_STATUS[keyof typeof EFFECTIVE_STATUS]
  // 版本
  version: string
  // 描述
  description: string
  // 作者
  author: string
  // 路径
  path: string
  // 提供工具列表
  providesTools: string[]
  // 提供 Hooks
  providesHooks: string[]
  // 需要的环境变量
  requiresEnv: Array<string | Record<string, unknown>>

  constructor(_: PluginInfo) {
    const {
      key, name, kind, source, configStatus, effectiveStatus, version, description,
      author, path, providesTools, providesHooks, requiresEnv
    } = { ..._ }
    this.key = key
    this.name = name
    this.kind = kind
    this.source = source
    this.configStatus = configStatus
    this.effectiveStatus = effectiveStatus
    this.version = version
    this.description = description
    this.author = author
    this.path = path
    this.providesTools = providesTools
    this.providesHooks = providesHooks
    this.requiresEnv = requiresEnv
  }

  // 配置状态 Label
  get configStatusLabel() {
    return CONFIG_STATUS_LABEL[this.configStatus] ?? this.configStatus
  }

  // 运行状态 Label
  get effectiveStatusLabel() {
    return EFFECTIVE_STATUS_LABEL[this.effectiveStatus] ?? this.effectiveStatus
  }

  static EFFECTIVE_STATUS = EFFECTIVE_STATUS
  static EFFECTIVE_STATUS_LABEL = EFFECTIVE_STATUS_LABEL

  static from(list?: PluginInfo[]) {
    if (!list) return []
    return list.map(_ => new this(_))
  }
}

/**
 * 插件元数据 Model
 */
export class PluginsMetadata {
  // Agent 目录
  hermesAgentRoot: string
  // Python可执行文件
  pythonExecutable: string
  // 扫描 cwd
  cwd: string
  // 项目插件
  projectPluginsEnabled: boolean

  constructor(_: PluginsMetadata) {
    const { hermesAgentRoot, pythonExecutable, cwd, projectPluginsEnabled } = { ..._ }
    this.hermesAgentRoot = hermesAgentRoot
    this.pythonExecutable = pythonExecutable
    this.cwd = cwd
    this.projectPluginsEnabled = projectPluginsEnabled
  }
}
