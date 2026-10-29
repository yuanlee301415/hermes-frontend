<!--
任务
- 列表
  - 选择任务
  - 暂停任务
  - 恢复任务
  - 立即运行
  - 编辑任务
  - 删除任务
- 运行历史
- 创建/编辑任务弹窗&表单
-->
<script lang="ts">
import { type JobDTO, Job } from '@/models/Job.ts'
import { getJobApi, createJobApi, updateJobApi } from '@/api/jobs.ts'
import { type JobFormModel } from '@/components/hermes/jobs/JobForm/index.ts'
</script>

<script setup lang="ts">
import { Plus } from '@vicons/tabler'
import { useJobsStore } from '@/store/modules/jobs.ts'
import { useProfilesStore } from '@/store/modules/profiles.ts'
import JobCard from '@/components/hermes/jobs/JobCard.vue'
import JobForm from '@/components/hermes/jobs/JobForm/index.vue'

const jobsStore = useJobsStore()
const profilesStore = useProfilesStore()

const selectedJobId = ref<Job['id']>()
const jobFormRef = useTemplateRef<InstanceType<typeof JobForm>>('jobFormRef')

const jobModal = reactive<{
  visible: boolean
  loading: boolean
  job: Job
  title: Readonly<string>
  positiveText: Readonly<string>
}>({
  visible: false,
  loading: false,
  job: new Job({} as Job),
  get title() {
    return this.job?.id ? '编辑任务' : '创建任务'
  },
  get positiveText() {
    return this.job?.id ? '更新' : '创建'
  }
})

onMounted(() => {
  void reloadJobsForProfile()
})

// 确认已加载 Profiles
async function ensureProfileSelection() {
  if (!profilesStore.activeProfileName || !profilesStore.profiles.length) {
    await profilesStore.fetchProfiles()
  }
}

// 重新加载 Profiles
async function reloadJobsForProfile() {
  // selectedJobId.value = undefined
  // jobsStore.jobs = []
  await ensureProfileSelection()
  await jobsStore.fetchJobs()
}

// 事件：选择任务
function onSelectJob(id: Job['id']) {
  console.warn(id)
  selectedJobId.value = id
}

// 提交创建/编辑表单
async function handleSubmit() {
  const formData = await jobFormRef.value?.validate()
  if (!formData) return false
  if (jobModal.job?.id) {
    return await updateJob(formData)
  }
  return await createJob(formData)
}

// 编辑任务
async function updateJob(formData: JobFormModel) {
  jobModal.loading = true
  try {
    const payload: JobDTO = {
      name: formData.name,
      schedule: formData.schedule,
      prompt: formData.prompt,
      deliver: formData.deliver,
      repeat: formData.repeat_times ?? null
    }
    await updateJobApi(jobModal.job!.id, payload)
    await jobsStore.fetchJobs()
    return true
  } catch (e) {
    console.error(e)
    return false
  } finally {
    jobModal.loading = false
  }
}

// 创建任务
async function createJob(formData: JobFormModel) {
  jobModal.loading = true
  try {
    const payload: JobDTO = {
      name: formData.name,
      schedule: formData.schedule,
      prompt: formData.prompt,
      deliver: formData.deliver,
      repeat: formData.repeat_times ?? null
    }
    await createJobApi(payload)
    await jobsStore.fetchJobs()
    return true
  } catch (e) {
    console.error(e)
    return false
  } finally {
    jobModal.loading = false
  }
}

// 打开创建任务弹窗
async function handleCreate() {
  jobModal.job = new Job({} as Job)
  jobModal.visible = true
}

// 事件：编辑任务
async function onEditJob(id: Job['id']) {
  try {
    const res = await getJobApi(id)
    jobModal.job = new Job(res)
    jobModal.visible = true
  } catch (e) {
    console.error(e)
  }
}

</script>

<template>
  <div class="jobs-view h-full">
    <n-page-header class="jobs-header">
      <template #title>定时任务</template>
      <template #extra>
        <n-button type="primary" size="small" @click="handleCreate">
          <template #icon>
            <n-icon>
              <Plus />
            </n-icon>
          </template>
          创建任务
        </n-button>
      </template>
    </n-page-header>
    <div class="jobs-split">
      <div class="jobs-top">
        <n-spin :show="jobsStore.loading">
          <div v-if="jobsStore.jobs.length" class="jobs-grid">
            <JobCard
              v-for="job of jobsStore.jobs"
              :key="job.id"
              :job="job"
              :selected="selectedJobId === job.id"
              @select="onSelectJob"
              @edit-job="onEditJob"
            />
          </div>
          <n-empty v-else />
        </n-spin>
      </div>
      <n-divider style="margin: 0;" />
      <div class="jobs-bottom"></div>
    </div>

    <!--创建/编辑 Job-->
    <n-modal
      v-model:show="jobModal.visible"
      :title="jobModal.title"
      :show-icon="false"
      :positive-text="jobModal.positiveText"
      :loading="jobModal.loading"
      negative-text="取消"
      preset="dialog"
      @positive-click="handleSubmit"
    >
      <JobForm :job="jobModal.job" ref="jobFormRef" />
    </n-modal>
    <!--创建/编辑 Job End-->
  </div>
</template>

<style scoped lang="less">
.jobs-view {
  display: flex;
  flex-direction: column;

  .jobs-header {
    flex-shrink: 0;
    padding: 20px;
    height: 70px;
    border-bottom: 1px solid var(--border-color);
  }

  .jobs-split {
    flex: 1;
    display: flex;
    flex-direction: column;

    .jobs-top {
      flex: 1;
      min-height: 120px;
      overflow-y: auto;
      padding: 20px;

      .jobs-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
        gap: 14px;
      }
    }

    .jobs-bottom {
      flex: 1;
      min-height: 120px;
      overflow: hidden;
    }
  }
}
</style>
