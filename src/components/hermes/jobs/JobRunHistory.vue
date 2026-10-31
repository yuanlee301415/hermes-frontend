<!--
运行历史
- 历史列表
- 历史详情
-->
<script lang="ts">
import type { Job } from '@/models/Job.ts'
import { getCronRunsApi, getCronRunApi } from '@/api/cron-history.ts'
import { RunEntry } from '@/models/CronRun.ts'
import { formatSize } from '@/utils/format.ts'
</script>

<script setup lang="ts">
import MarkdownRender from '@/components/hermes/chat/MarkdownRender/index.vue'

const props = defineProps<{
  // 任务 `id` -> `name` 映射
  jobNameMap: Map<Job['id'], string>
  jobId?: Job['id']
}>()

// 运行历史列表
const runs = shallowRef<RunEntry[]>([])

// 列表加载中
const loading = ref(false)

// 详情加载中的 Keys
const loadingKeys = ref<Set<RunEntry['key']>>(new Set())

// 详情内容
const expandedContent = ref<Map<RunEntry['key'], string>>(new Map())

watchEffect(() => {
  getCronRuns(props.jobId)
})

// 获取运行历史列表
async function getCronRuns(jobId?: Job['id']) {
  loading.value = true
  try {
    const res = await getCronRunsApi(jobId)
    runs.value = RunEntry.from(res)
  } catch (e) {
    console.error(e)
    runs.value = []
  } finally {
    loading.value = false
  }
}

// 计算显示名称
function getJobName(jobId: Job['id']): string {
  return props.jobNameMap.get(jobId) ?? jobId
}

// 获取运行历史详情
async function handleExpand(keys: RunEntry['key'][]) {
  const run = runs.value.find(_ => _.key === keys[0])
  if (!run) return
  loadingKeys.value.add(run.key)
  try {
    const res = await getCronRunApi(run.jobId, run.fileName)
    const nextContent = new Map(expandedContent.value)
    nextContent.clear()
    nextContent.set(run.key, res.content)
    expandedContent.value = nextContent
  } catch (e) {
    console.error(e)
  } finally {
    loadingKeys.value.delete(run.key)
  }
}
</script>

<template>
  <div class="run-history">
    <n-flex class="history-header" justify="space-between" align="center">
      <n-h6 strong style="margin: 0;">运行历史</n-h6>
      <n-text>{{ runs.length }} 次运行</n-text>
    </n-flex>

    <div class="history-body">
      <n-spin v-if="loading" style="position: absolute;left: 0;right: 0;"></n-spin>

      <template v-else>
        <n-collapse v-if="runs.length" accordion @update:expanded-names="handleExpand">
          <n-collapse-item v-for="run of runs" :key="run.key" :name="run.key" :title="`${getJobName(run.jobId)} - ${run.runTime}`">
            <template #header-extra>
              <n-text>{{ formatSize(run.size) }}</n-text>
            </template>
            <n-spin v-if="loadingKeys.has(run.key)" size="small"></n-spin>
            <MarkdownRender v-else-if="expandedContent.has(run.key)" :content="expandedContent.get(run.key)!" />
          </n-collapse-item>
        </n-collapse>
        <n-empty v-else />
      </template>
    </div>
  </div>
</template>

<style scoped lang="less">
.run-history {
  height: 100%;
  display: flex;
  flex-direction: column;

  .history-header {
    height: 48px;
    padding: 0 20px;
    border-bottom: 1px solid var(--border-light);
  }

  .history-body {
    position: relative;
    flex: 1;
    overflow-y: auto;
    padding: 10px 20px 20px;
  }
}
</style>
