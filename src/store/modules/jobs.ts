/*
* 任务 Store
* */

import { defineStore } from 'pinia'
import { Job } from '@/models/Job.ts'
import { getJobsApi, getJobApi, pauseJobApi, resumeJobApi, deleteJobApi, runJobApi } from '@/api/jobs.ts'

export const useJobsStore = defineStore('jobsStore', () => {
  const jobs = ref<Job[]>([])
  const loading = ref(false)

  // 获取任务列表
  async function fetchJobs() {
    loading.value = true
    try {
      const res = await getJobsApi()
      jobs.value = Job.from(res)
    } catch (e) {
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  // 暂停任务
  async function pauseJob(id: Job['id']) {
    await pauseJobApi(id)
    await refreshJob(id)
  }

  // 恢复任务
  async function resumeJob(id: Job['id']) {
    await resumeJobApi(id)
    await refreshJob(id)
  }

  // 运行任务
  async function runJob(id: Job['id']) {
    await runJobApi(id)
    await refreshJob(id)
  }

  // 删除任务
  async function deleteJob(id: Job['id']) {
    await deleteJobApi(id)
    const idx = jobs.value.findIndex(_ => _.id === id)
    if (idx !== -1) {
      jobs.value.splice(idx, 1)
    }
  }

  // 刷新任务
  async function refreshJob(id: Job['id']) {
    const job = await getJobApi(id)
    const idx = jobs.value.findIndex(_ => _.id === id)
    if (idx !== -1) {
      jobs.value[idx] = new Job(job)
    }
  }

  return {
    jobs,
    loading,

    fetchJobs,
    pauseJob,
    resumeJob,
    runJob,
    deleteJob
  }
})
