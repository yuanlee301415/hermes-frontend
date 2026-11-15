import { SkillSources } from '@/models/Skill.ts'


export type SourceFilter = typeof SourceFilters[keyof typeof SourceFilters]

// 来源过滤类型
export const SourceFilters = {
  ...SkillSources,
  Modified: 'modified'
} as const

// 外部目录 - 提示
const ExternalDirRowHint = {
  Missing: 'missing',
  NotDir: 'notdir'
} as const

// 外部目录
export class ExternalDirRow {
  // 原始路径
  raw: string
  // 提示
  hint: (typeof ExternalDirRowHint[keyof typeof ExternalDirRowHint]) | null

  constructor(_: ExternalDirRow) {
    const { raw, hint } = { ..._ }
    this.raw = raw
    this.hint = hint
  }

  static Hint = ExternalDirRowHint
}

