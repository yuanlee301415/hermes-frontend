/*
* 任务 API
* */

import { request } from '@/api/client.ts'
import type { Job, JobDTO } from '@/models/Job.ts'

export interface JobScheduleInterval {
  kind: 'interval'
  minutes: number
  display: string
}

export interface JobScheduleCron {
  kind: 'cron'
  expr: string
  display: string
}

export interface JobScheduleOnce {
  kind: 'once',
  run_at: string
  display: string
}

export type UnknownJobSchedule = {
  kind: string
  display?: string
  expr?: string
  minutes?: number
  run_at?: string
}

export type JobSchedule = string | JobScheduleInterval | JobScheduleCron | JobScheduleOnce | UnknownJobSchedule


function isScheduleObject(schedule: JobSchedule | null | undefined): schedule is Exclude<JobSchedule, string> {
  return typeof schedule === 'object' && schedule !== null
}

export function scheduleToEditableInput(schedule: JobSchedule | null | undefined, fallback = '-'): string {
  if (typeof schedule === 'string') return schedule
  if (!isScheduleObject(schedule)) return fallback

  if (schedule.kind === 'cron') return schedule.expr || schedule.display || fallback
  if (schedule.kind === 'once') return schedule.run_at || schedule.display || fallback
  if (schedule.kind === 'interval') return schedule.display || (typeof schedule.minutes === 'number' ? `every ${schedule.minutes}m` : fallback)

  const unknownSchedule = schedule as UnknownJobSchedule
  return unknownSchedule.expr || unknownSchedule.run_at || unknownSchedule.display || fallback
}

export function jobRepeatToEditValue(repeat: Job['repeat']): number | null {
  if (repeat && typeof repeat === 'object') return repeat.times ?? null
  return null
}

// 调度表达式 - 展示文本
export function scheduleToDisplayText(schedule: JobSchedule | null | undefined, fallback = '-'): string {
  if (typeof schedule === 'string') return schedule
  if (!isScheduleObject(schedule)) return fallback

  if (schedule.kind === 'cron') return schedule.expr || schedule.display || fallback
  if (schedule.kind === 'interval') return schedule.display || scheduleToEditableInput(schedule, fallback)

  const unknownSchedule = schedule as UnknownJobSchedule
  return unknownSchedule.display || unknownSchedule.expr || unknownSchedule.run_at || fallback
}

// 获取任务列表
export async function getJobsApi(): Promise<Job[]> {
  const res = await request<{ jobs: Job[] }>('api/hermes/jobs?include_disabled=true')
  return res.jobs
}

// 获取任务
export async function getJobApi(jobId: Job['id']): Promise<Job> {
  const res = await request<{ job: Job }>(`api/hermes/jobs/${jobId}`)
  return res.job
}

// 创建任务
export async function createJobApi(data: JobDTO): Promise<Job> {
  const res = await request<{ job: Job }>('api/hermes/jobs', {
    method: 'POST',
    body: JSON.stringify(data)
  })
  return res.job
}

// 更新任务
export async function updateJobApi(jobId: Job['id'], data: JobDTO): Promise<Job> {
  const res = await request<{ job: Job }>(`api/hermes/jobs/${jobId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  })
  return res.job
}

// 删除任务
export async function deleteJobApi(jobId: Job['id']): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`api/hermes/jobs/${jobId}`, {
    method: 'DELETE'
  })
}

// 暂停任务
export async function pauseJobApi(jobId: Job['id']): Promise<Job> {
  const res = await request<{ job: Job }>(`api/hermes/jobs/${jobId}/pause`, { method: 'POST' })
  return res.job
}

// 恢复任务
export async function resumeJobApi(jobId: Job['id']): Promise<Job> {
  const res = await request<{ job: Job }>(`api/hermes/jobs/${jobId}/resume`, { method: 'POST' })
  return res.job
}

// 立即运行任务
export async function runJobApi(jobId: Job['id']): Promise<Job> {
  const res = await request<{ job: Job }>(`api/hermes/jobs/${jobId}/run`, { method: 'POST' })
  return res.job
}
