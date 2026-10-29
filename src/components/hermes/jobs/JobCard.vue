<!--
任务 卡片
-->

<script lang="ts">
import { Job } from '@/models/Job.ts'
import { scheduleToDisplayText } from '@/api/jobs.ts'

const ACTION = {
  Pause: 1,
  Resume: 2,
  Run: 3,
  Delete: 4
} as const

function formatTime(t?: string) {
  const date = new Date(t || '')
  if (!date.getTime()) return '-'
  return date.toLocaleString()
}
</script>

<script setup lang="ts">
import { useJobsStore } from '@/store/modules/jobs.ts'

const props = defineProps<{
  job: Job
  selected: boolean
}>()

const jobsStore = useJobsStore()

const action = ref<typeof ACTION[keyof typeof ACTION]>()

const emit = defineEmits<{
  // 选择任务
  (e: 'select', id: Job['id']): void
  // 编辑任务
  (e: 'edit-job', id: Job['id']): void
}>()

// 调度表达式展示文本
const scheduleExpr = computed(() => scheduleToDisplayText(props.job.schedule, props.job.schedule_display || '-'))

// 状态文本组件 `type`
const stateTextType = computed(() => {
  if (props.job.state === Job.State.Running) return 'info'
  if (props.job.state === Job.State.Paused) return 'warning'
  if (!props.job.enabled) return 'error'
  return 'success'
})

// 选择任务
function handleToggleSelect() {
  emit('select', props.selected ? '' : props.job.id)
}

// 暂停任务
async function handlePause() {
  action.value = ACTION.Pause
  try {
    await jobsStore.pauseJob(props.job.id)
    window.$message?.success('任务已暂停')
  } catch (e) {
    console.error(e)
    window.$message?.error((e as Error).message)
  } finally {
    action.value = undefined
  }
}

// 恢复任务
async function handleResume() {
  action.value = ACTION.Resume
  try {
    await jobsStore.resumeJob(props.job.id)
    window.$message?.success('任务已恢复')
  } catch (e) {
    console.error(e)
    window.$message?.error((e as Error).message)
  } finally {
    action.value = undefined
  }
}

// 运行运行
async function handleRun() {
  action.value = ACTION.Run
  try {
    await jobsStore.runJob(props.job.id)
    window.$message?.success('任务已触发')
  } catch (e) {
    console.error(e)
    window.$message?.error((e as Error).message)
  } finally {
    action.value = undefined
  }
}

// 删除任务
async function handleDelete() {
  action.value = ACTION.Delete
  try {
    await jobsStore.deleteJob(props.job.id)
    window.$message?.success('任务已删除')
  } catch (e) {
    console.error(e)
    window.$message?.error((e as Error).message)
  } finally {
    action.value = undefined
  }
}
</script>

<template>
  <n-card
    :class="{selected: selected}"
    hoverable
    class="job-card"
    style="--n-title-font-size: 15px; --n-padding-top: 16px; --n-padding-right: 16px; --n-padding-bottom: 12px; --n-padding-left: 16px;"
    @click="handleToggleSelect"
  >
    <template #header>
      <n-ellipsis :line-clamp="1">{{ job.name }}</n-ellipsis>
    </template>
    <template #header-extra>
      <n-tag :type="stateTextType" :bordered="false" size="small" round style="margin-left: 10px;">{{ job.stateLabel }}</n-tag>
    </template>

    <n-flex vertical :size="6">
      <n-flex justify="space-between">
        <n-text depth="2">Schedule</n-text>
        <n-text>{{ scheduleExpr }}</n-text>
      </n-flex>

      <n-flex justify="space-between">
        <n-text depth="2">Model</n-text>
        <n-text>{{ job.model || '-' }}</n-text>
      </n-flex>

      <n-flex justify="space-between">
        <n-text depth="2">上次运行</n-text>
        <n-text>
          {{ formatTime(job.last_run_at) }}
          <span v-if="job.last_status" style="margin-left: 10px;">
            <n-text v-if="job.last_status === 'ok'" type="success">确定</n-text>
            <n-text v-else>{{ job.last_status }}</n-text>
          </span>
        </n-text>
      </n-flex>

      <n-flex justify="space-between">
        <n-text depth="2">下次运行</n-text>
        <n-text>{{ formatTime(job.next_run_at) }}</n-text>
      </n-flex>

      <n-flex justify="space-between">
        <n-text depth="2">投递</n-text>
        <n-text>{{ job.deliver }}<span v-if="job.origin">{{ job.origin.platform }}</span></n-text>
      </n-flex>

      <n-flex justify="space-between">
        <n-text depth="2">重复</n-text>
        <n-text>
          <template v-if="typeof job.repeat === 'number'">{{ job.repeat }}</template>
          <template v-else-if="typeof job.repeat === 'object'">{{ job.repeat!.completed }} / {{ job.repeat!.times ?? '∞' }}</template>
        </n-text>
      </n-flex>
    </n-flex>

    <template #footer>
      <n-flex size="small" @click.stop>
        <n-button v-if="job.state === Job.State.Paused" :loading="action === ACTION.Resume" size="small" quaternary round @click="handleResume">恢复</n-button>
        <n-button v-else :loading="action === ACTION.Pause" size="small" quaternary round @click="handlePause">暂停</n-button>
        <n-button :loading="action === ACTION.Run" size="small" quaternary round @click="handleRun">立即运行</n-button>
        <n-button size="small" quaternary round @click="emit('edit-job', job.id)">编辑</n-button>
        <n-popconfirm @positive-click="handleDelete">
          <template #trigger>
            <n-button :loading="action === ACTION.Delete" size="small" type="error" quaternary round>删除</n-button>
          </template>
          确认删除？
        </n-popconfirm>
      </n-flex>
    </template>
  </n-card>
</template>

<style scoped lang="less">
.job-card {
  cursor: pointer;

  &.selected {
    border-color: rgba(var(--accent-primary-rgb), 0.6);
    background-color: rgba(var(--accent-primary-rgb), 0.05);
  }
}
</style>
