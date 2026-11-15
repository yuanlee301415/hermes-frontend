<!--
Skill 详情
-->
<script lang="ts">
import { type SkillCategory, SkillInfo } from '@/models/Skill.ts'
import { getSkillContentApi, getSkillFilesApi, type SkillFileEntry, pinSkillApi } from '@/api/skills.ts'
</script>

<script setup lang="ts">
import { Pinned, Pencil, File } from '@vicons/tabler'
import { EyeOutline, FlashOutline, ChevronBackOutline } from '@vicons/ionicons5'
import MarkdownRender from '@/components/hermes/chat/MarkdownRender/index.vue'

const props = defineProps<{
  // 类别
  category: SkillCategory['name']
  // 选择的 Skill
  skill: SkillInfo['name']
  // 选择的 Skill name
  skillName: SkillInfo['name']
  // 修改次数
  patchCount?: number
  // 使用次数
  useCount?: number
  viewCount?: number
  // 是否置顶
  pinned?: boolean
}>()

const emit = defineEmits<{
  // 切换置顶
  (e: 'pin-toggle', name: string, pinned: boolean): void
}>()

// Skill 内容
const content = ref('')
// 附件列表
const files = ref<SkillFileEntry[]>([])
// 附件内容
const fileContent = ref('')
// 查看的附件
const viewingFile = ref<string | null>(null)
// 初始加载中
const loading = ref(false)
// 获取文件内容中
const fileLoading = ref(false)
// 切换置顶中
const pinLoading = ref(false)

watch(() => `${props.category}/${props.skill}`, () => {
  loadSkill()
}, {
  immediate: true
})

// 获取 Skill 文件内容 & 附件列表
async function loadSkill() {
  loading.value = true
  content.value = ''
  files.value = []
  fileContent.value = ''
  viewingFile.value = null

  try {
    const skillPath = `${props.category}/${props.skill}/SKILL.md`
    const [skillContent, skillFiles] = await Promise.all([
      getSkillContentApi(skillPath),
      getSkillFilesApi(props.category, props.skill)
    ])
    content.value = skillContent
    files.value = skillFiles.filter(_ => !_.isDir && _.path !== 'SKILL.md')
  } catch (e) {
    console.error(e)
    content.value = `加载技能失败: ${(e as Error).message}`
  } finally {
    loading.value = false
  }
}

// 查看附件
async function handleViewFile(filePath: SkillFileEntry['path']) {
  fileLoading.value = true
  viewingFile.value = filePath

  try {
    const base = `${props.category}/${props.skill}/`
    let relPath = filePath
    if (filePath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(filePath)) {
      // Strip absolute prefix to get relative path
      const normalizedPath = filePath.replace(/\\/g, '/')
      const segments = normalizedPath.split(/(?:^|\/)(?:\.hermes|hermes)\/skills\//)[1]
      if (segments) {
        const afterSkillDir = segments.split('/').slice(2).join('/')
        relPath = afterSkillDir
      }
    }
    fileContent.value = await getSkillContentApi(`${base}/${relPath}`)
  } catch (e) {
    console.error(e)
    fileContent.value = `加载文件失败: ${(e as Error).message}`
  } finally {
    fileLoading.value = false
  }
}

// 返回
function handleBack() {
  viewingFile.value = null
  fileContent.value = ''
}

// 切换置顶 Skill
async function handlePinToggle() {
  pinLoading.value = true
  try {
    const newPinned = !props.pinned
    await pinSkillApi(props.skillName, newPinned)
    emit('pin-toggle', props.skillName, newPinned)
  } catch (e) {
    console.error(e)
    window.$message?.error(`更改置顶状态失败: ${(e as Error).message}`)
  } finally {
    pinLoading.value = false
  }
}
</script>

<template>
  <div class="skill-detail">
    <n-flex class="detail-title" align="center" :size="5">
      <span class="detail-category">{{ category }}</span>
      <span class="detail-sep">/</span>
      <b class="detail-name">{{ skill }}</b>
      <n-flex class="usage-stats" align="center" :size="3">
        <n-button
          quaternary
          size="small"
          :loading="pinLoading"
          :title="pinned ? '取消置顶' : '置顶技能'"
          :style="{opacity: pinned ? 1: 0.5}"
          @click="handlePinToggle"
        >
          <template #icon>
            <Pinned />
          </template>
        </n-button>
        <n-tag v-if="viewCount" :bordered="false" :color="{color: 'transparent'}">
          <template #icon>
            <n-icon>
              <EyeOutline />
            </n-icon>
          </template>
          {{ viewCount }}
        </n-tag>
        <n-tag v-if="useCount" :bordered="false" :color="{color: 'transparent'}">
          <template #icon>
            <n-icon>
              <FlashOutline />
            </n-icon>
          </template>
          {{ useCount }}
        </n-tag>
        <n-tag v-if="patchCount" :bordered="false" :color="{color: 'transparent'}">
          <template #icon>
            <n-icon>
              <Pencil />
            </n-icon>
          </template>
          {{ patchCount }}
        </n-tag>
      </n-flex>
    </n-flex>

    <n-spin v-if="loading || fileLoading" class="detail-loading" />

    <template v-else>
      <!-- 返回 -->
      <n-flex v-if="viewingFile" class="detail-back" align="center">
        <n-button quaternary size="small" @click="handleBack">
          <template #icon>
            <ChevronBackOutline />
          </template>
          返回 {{ skill }}
        </n-button>
        <n-text strong>{{ viewingFile }}</n-text>
      </n-flex>
      <!-- 返回 End -->

      <!-- Skill 内容 -->
      <div class="detail-content">
        <MarkdownRender v-if="viewingFile" :content="fileContent" />
        <MarkdownRender v-else :content="content" />
      </div>
      <!-- Skill 内容 End  -->

      <!-- Skill 附件  -->
      <div v-if="!viewingFile && files.length" class="detail-files">
        <n-p class="files-header" strong>文件附件</n-p>
        <n-flex>
          <n-button v-for="file of files" :key="file.path" size="small" @click="handleViewFile(file.path)">
            <template #icon>
              <File />
            </template>
            {{ file.path }}
          </n-button>
        </n-flex>
      </div>
      <!-- Skill 附件 End -->
    </template>
  </div>
</template>

<style scoped lang="less">
.skill-detail {
  display: flex;
  flex-direction: column;
  height: 100%;

  .detail-title {
    flex-shrink: 0;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 12px;
    font-size: 15px;

    .detail-category {
      color: var(--text-muted);
      font-size: 13px;
    }

    .detail-sep {
      color: var(--text-muted);
      margin: 0 6px;
    }

    .detail-name {
      color: var(--text-primary);
      font-weight: 600;
    }

    .usage-stats {
      margin-left: auto;
      padding-left: 12px;
    }
  }

  .detail-loading {
    flex: 1;
  }

  .detail-back {
    padding: 8px 0;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 10px;
    flex-shrink: 0;
  }

  .detail-content {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 12px;

    :deep(hr) {
      border: none;
      margin: 10px 0;
    }
  }

  .detail-files {
    flex-shrink: 0;
    border-top: 1px solid var(--border-color);
    padding-top: 5px;
    margin-top: 10px;

    .files-header {
      margin-bottom: 6px;
    }
  }
}
</style>
