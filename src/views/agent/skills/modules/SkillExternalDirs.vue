<!--
外部目录
-->
<script lang="ts">
import { type ExternalDirEntry, getExternalDirsApi, saveExternalDirsApi } from '@/api/skills.ts'
import { ExternalDirRow } from '../index.ts'

function entryToRow(entry: ExternalDirEntry) {
  if (!entry.exists) return new ExternalDirRow({ raw: entry.raw, hint: ExternalDirRow.Hint.Missing })
  if (!entry.isDir) return new ExternalDirRow({ raw: entry.raw, hint: ExternalDirRow.Hint.NotDir })
  return new ExternalDirRow({ raw: entry.raw, hint: null })
}
</script>

<script setup lang="ts">
// 外部目录列表
const rows = ref<ExternalDirRow[]>([])
const loading = ref(false)

defineExpose({
  save
})

loadRows()

// 获取外部目录列表
async function loadRows() {
  loading.value = true
  try {
    const entries = await getExternalDirsApi()
    rows.value = entries.map(entryToRow)
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// 添加外部目录输入框
function handleAddRow() {
  rows.value.push(new ExternalDirRow({ raw: '', hint: null }))
}

// 删除外部目录输入框
function handleRemoveRow(idx: number) {
  rows.value.splice(idx, 1)
}

// 保存外部目录
async function save() {
  try {
    const cleaned: ExternalDirRow['raw'][] = []
    for (const row of rows.value) {
      const v = row.raw.trim()
      if (!v) continue
      if (cleaned.includes(v)) continue
      cleaned.push(v)
    }
    await saveExternalDirsApi(cleaned)
    window.$message?.success('外部目录已保存')
  } catch (e) {
    console.error(e)
    window.$message?.error('保存失败')
    throw e
  }
}

// 清除提示
function handleInput(idx: number) {
  rows.value[idx].hint = null
}
</script>

<template>
  <div class="external-dirs">
    <n-p>在此管理 config.skills.external_dirs。支持 ~ 和 $VAR；不存在的路径会被标灰。</n-p>

    <n-spin v-if="loading" class="w-full" />

    <template v-else>
      <n-empty v-if="!rows.length">暂无外部目录</n-empty>

      <n-form v-else size="small">
        <n-form-item v-for="(row, idx) of rows" :key="idx" :show-label="false">
          <n-flex :wrap="false" size="small" class="w-full">
            <n-input v-model:value="row.raw" placeholder="/path/to/skills 或 ~/my-skills" @input="handleInput(idx)" />
            <n-tag type="error" v-if="row.hint === ExternalDirRow.Hint.Missing">目录不存在</n-tag>
            <n-tag type="error" v-else-if="row.hint === ExternalDirRow.Hint.NotDir">不是目录</n-tag>
            <n-button quaternary @click="handleRemoveRow(idx)">&times;</n-button>
          </n-flex>
        </n-form-item>
      </n-form>

      <n-button @click="handleAddRow">添加外部目录</n-button>
    </template>

  </div>
</template>
