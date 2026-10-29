/*
* 任务 Model
* */

import { type JobSchedule } from '@/api/jobs.ts'

// 状态
const State = {
  // 运行中
  Running: 'running',
  // 已暂停
  Paused: 'paused'
} as const

export class Job {
  id: string
  job_id: string
  // 名称（标题）
  name: string
  // 提示词
  prompt: string
  prompt_preview?: string
  skills: string[]
  // 调度表达式
  schedule: JobSchedule
  schedule_display: string
  // 重复
  repeat: null | number | { times?: number | null; completed: number }
  // 是否启用
  enabled: boolean
  // 状态
  state: typeof State[keyof typeof State]
  // 投递
  deliver: string
  // 创建时间
  created_at: string
  // 上次运行状态
  last_status: 'ok' | null
  skill?: string
  // 模型
  model?: string
  provider?: string
  base_url?: string
  script?: string
  paused_at?: string
  paused_reason?: string
  // 上次运行时间
  last_run_at?: string
  // 上次运行错误
  last_error?: string
  // 上次投递错误
  last_delivery_error?: string
  // 下次运行时间
  next_run_at?: string
  // 来源
  origin?: {
    platform: string
    chat_id: string
    chat_name: string
    thread_id?: string
  }

  constructor(_: Omit<Job, 'stateLabel'>) {
    const {
      id, job_id, name, prompt, prompt_preview, skills, schedule,
      schedule_display, repeat, enabled, state, deliver, created_at,
      skill, model, provider, base_url, script,
      paused_at, paused_reason, next_run_at, last_run_at, last_status,
      last_error, last_delivery_error, origin
    } = { ..._ }

    this.id = id
    this.job_id = job_id
    this.name = name
    this.prompt = prompt
    this.prompt_preview = prompt_preview
    this.skills = skills
    this.schedule = schedule
    this.schedule_display = schedule_display
    this.repeat = repeat
    this.enabled = enabled
    this.state = state
    this.deliver = deliver
    this.created_at = created_at

    this.skill = skill
    this.model = model
    this.provider = provider
    this.base_url = base_url
    this.script = script
    this.paused_at = paused_at
    this.paused_reason = paused_reason
    this.last_run_at = last_run_at
    this.last_status = last_status
    this.last_error = last_error
    this.last_delivery_error = last_delivery_error
    this.next_run_at = next_run_at
    this.origin = origin
  }

  get stateLabel() {
    if (this.state === State.Running) return '运行中'
    if (this.state === State.Paused) return '已暂停'
    if (!this.enabled) return '已禁用'
    return '已调度'
  }

  static State = State

  /**
   * 批量实例化
   * @param list
   */
  static from(list?: Job[]) {
    if (!list) return []
    return list.map(_ => new this(_))
  }
}

/**
 * 创建/编辑 DTO
 * - 表单 Model
 * - 接口 Payload
 */
export interface JobDTO {
  name: Job['name']
  schedule: string
  prompt: Job['prompt']
  deliver: Job['deliver']
  repeat: Job['repeat']
}

