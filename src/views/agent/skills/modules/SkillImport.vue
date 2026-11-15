<!--
导入技能
- 文件夹
- Zip 包
-->
<script lang="ts">
import { NUpload, type UploadFileInfo } from 'naive-ui'
import { importSkillApi } from '@/api/skills.ts'
</script>

<script setup lang="ts">
// 模型
const mode = ref<'zip' | 'folder'>('folder')
// 文件上层目录
const folderName = ref('')
// 目标类别
const category = ref('')
// 选择的文件
const files = ref<UploadFileInfo[]>([])

const folderRef = useTemplateRef<InstanceType<typeof NUpload>>('folderRef')

defineExpose({
  importSkill
})

// 校验扩展名
function beforeUpload({ file }: { file: UploadFileInfo }) {
  const name = file.name?.toLowerCase() || ''
  if (!name.endsWith('.zip')) {
    window.$message?.warning('仅支持 .zip 包')
    return false
  }
  return true
}

// 计算文件上层目录
function onUpdateFileList(fileList: UploadFileInfo[]) {
  for (const file of fileList) {
    if (file.file?.webkitRelativePath) {
      folderName.value = file.file.webkitRelativePath.split('/')[0]
      break
    }
  }
}

// 清除已选择文件
function clearFiles() {
  folderName.value = ''
  folderRef.value?.clear()
  files.value = []
}

// 导入 Skill
async function importSkill() {
  if (!files.value.length) return false

  const _files: File[] = []
  for (const item of files.value) {
    _files.push(item.file!)
  }

  try {
    const res = await importSkillApi(_files, category.value)
    window.$message?.success(`已导入技能 ${res.name ?? ''}`)
    return true
  } catch (e) {
    console.error(e)
    window.$message?.error(`导入配置失败: ${(e as Error).message}`)
    throw e
  }
}
</script>

<template>
  <div class="skill-import">
    <n-form-item :show-label="false">
      <n-radio-group v-model:value="mode">
        <n-radio value="folder">文件夹</n-radio>
        <n-radio value="zip">Zip 包</n-radio>
      </n-radio-group>
    </n-form-item>

    <n-form-item label="目标分类（可选）">
      <n-input v-model:value="category" placeholder="留空则平铺到 misc" />
    </n-form-item>

    <n-form-item :show-label="false">
      <n-upload
        v-if="mode === 'folder'"
        v-model:file-list="files"
        :show-file-list="false"
        :default-upload="false"
        abstract
        ref="folderRef"
        directory
        @update:file-list="onUpdateFileList"
      >
        <n-upload-trigger #="{ handleClick }" abstract>
          <n-button size="small" @click="() => {clearFiles(); handleClick();}">选择文件夹</n-button>
        </n-upload-trigger>
        <span v-show="folderName" style="padding-left: 10px;">{{ folderName }}({{ files.length }} 个文件)</span>
      </n-upload>

      <n-upload
        v-else
        v-model:file-list="files"
        :show-file-list="false"
        :default-upload="false"
        :max="1"
        accept=".zip"
        @update:file-list="onUpdateFileList"
        @before-upload="beforeUpload"
      >
        <n-button size="small">选择 .zip 文件</n-button>
      </n-upload>
    </n-form-item>
  </div>
</template>
