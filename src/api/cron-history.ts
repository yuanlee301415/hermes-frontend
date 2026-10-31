/*
* 任务-运行历史 API
* */

import type { Job } from '@/models/Job.ts'
import { request } from '@/api/client.ts'
import { RunEntry, RunDetail } from '@/models/CronRun.ts'

/**
 * 获取运行历史列表
 * @param jobId 任务 ID
 */
export async function getCronRunsApi(jobId?: Job['id']) {
  const params = new URLSearchParams()
  if (jobId) params.set('jobId', jobId)
  const qs = params.toString()
  const res = await request<{ runs: RunEntry[] }>(`api/cron-history` + (qs ? `?${qs}` : ''))
  return res.runs
}

/**
 * 获取运行记录详情
 * @param jobId 任务 ID
 * @param fileName 任务文件名
 */
export async function getCronRunApi(jobId: Job['id'], fileName: RunEntry['fileName']): Promise<RunDetail> {
  return request<RunDetail>(`api/cron-history/${encodeURIComponent(jobId)}/${encodeURIComponent(fileName)}`)
}
