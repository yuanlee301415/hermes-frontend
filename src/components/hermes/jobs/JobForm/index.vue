<!--
创建/编辑-任务 表单
-->
<script lang="ts">
import type { FormRules, FormInst, SelectOption } from 'naive-ui'
import { type PlatformKey } from '@/api/config.ts'
import { scheduleToEditableInput, jobRepeatToEditValue } from '@/api/jobs.ts'
import { Job } from '@/models/Job.ts'
import { SCHEDULE_PRESETS, CHANNELS } from '../shared.ts'
import { type JobFormModel, isDeliverTargetConfigured } from './index.ts'

const rules: FormRules = {
  name: [
    { required: true, message: '请填写名称' }
  ],
  schedule: [
    { required: true, message: '请填写调度表达式' }
  ],
  prompt: [
    { required: true, message: '提示词' }
  ]
}
</script>

<script setup lang="ts">
import { useSettingsStore } from '@/store/modules/settings.ts'

defineExpose({
  validate
})

const settingsStore = useSettingsStore()

const props = defineProps<{
  job: Job
}>()

// 快速预设
const presetValue = ref<string | null>(null)

const formModel = reactive<JobFormModel>({
  name: props.job.name,
  schedule: scheduleToEditableInput(props.job.schedule, props.job.schedule_display ?? ''),
  prompt: props.job.prompt,
  deliver: props.job.deliver ?? 'origin',
  repeat_times: jobRepeatToEditValue(props.job.repeat)
})

const formRef = useTemplateRef<FormInst>('formRef')

// 投递目标
const targetOptions = computed(() => {
  const options: Array<SelectOption> = [
    { label: '来源', value: 'origin' },
    { label: '本地', value: 'local' }
  ]
  for (const ch of CHANNELS) {
    options.push({
      label: ch.label,
      value: ch.key,
      disabled: !isDeliverTargetConfigured(settingsStore.platforms, ch.key as PlatformKey)
    })
  }
  return options
})

onBeforeMount(() => {
  if (!Object.keys(settingsStore.platforms || {}).length) {
    settingsStore.fetchSettings()
  }
})

// 校验表单
async function validate() {
  try {
    await formRef.value?.validate()
    return formModel
  } catch (e) {
    console.error(e)
    return null
  }
}
</script>

<template>
  <n-form :model="formModel" :rules="rules" ref="formRef">
    <n-form-item label="名称" path="name">
      <n-input v-model:value="formModel.name" maxlength="200" placeholder="任务名称" />
    </n-form-item>

    <n-form-item label="调度表达式 (Cron)" path="schedule">
      <n-input v-model:value="formModel.schedule" placeholder="例如 0 9 * * *" />
    </n-form-item>

    <n-form-item label="快速预设">
      <n-select v-model:value="presetValue" :options="SCHEDULE_PRESETS" placeholder="选择预设" @update:value="(val) => formModel.schedule = val" />
    </n-form-item>

    <n-form-item label="提示词" path="prompt">
      <n-input type="textarea" v-model:value="formModel.prompt" :rows="4" maxlength="5000" show-count placeholder="要执行的内容" />
    </n-form-item>

    <n-form-item label="投递目标" path="deliver">
      <n-select v-model:value="formModel.deliver" :options="targetOptions" />
    </n-form-item>

    <n-form-item label="重复次数" path="repeat_times">
      <n-input-number v-model:value="formModel.repeat_times" min="1" clearable class="w-full" placeholder="留空表示无限重复" />
    </n-form-item>

  </n-form>
</template>

<style scoped lang="less">

</style>
