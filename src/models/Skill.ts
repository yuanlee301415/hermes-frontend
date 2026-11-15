/*
* Skill Model
* */

export type SkillSource = typeof SkillSources[keyof typeof SkillSources]

// Skill 来源
export const SkillSources = {
  // 内置
  Builtin: 'builtin',
  // Hub 安装
  Hub: 'hub',
  // 本地安装
  Local: 'local',
  // 外部目录
  External: 'external'
} as const

// Skill 详情
export class SkillInfo {
  // 名称
  name: string
  // 描述
  description: string
  // 是否已启用
  enabled?: boolean
  // 来源
  source?: SkillSource
  // 是否已修改
  modified?: boolean

  patchCount?: number
  useCount?: number
  viewCount?: number
  pinned?: boolean

  // 外部目录地址
  sourcePath?: string

  constructor(_: SkillInfo) {
    const {
      name, description, enabled, source, modified, patchCount,
      useCount, viewCount, pinned, sourcePath
    } = { ..._ }
    this.name = name
    this.description = description
    this.enabled = enabled
    this.source = source
    this.modified = modified
    this.patchCount = patchCount
    this.useCount = useCount
    this.viewCount = viewCount
    this.pinned = pinned
    this.sourcePath = sourcePath
  }

  static form(list?: SkillInfo[]) {
    if (!list) return []
    return list.map(_ => new this(_))
  }
}

// Skill 类别
export class SkillCategory {
  // 名称
  name: string
  // 描述
  description: string
  // 列表
  skills: SkillInfo[]

  constructor(_: SkillCategory) {
    const { name, description, skills } = { ..._ }
    this.name = name
    this.description = description
    this.skills = SkillInfo.form(skills)
  }

  static form(list?: SkillCategory[]) {
    if (!list) return []
    return list.map(_ => new this(_))
  }
}

