<!--
技能（@2026-11-15）
- 类型过滤
- 本地搜索
- 列表
  - 分类
  - 选择
  - 删除
- 详情
  - 推荐技能内容
  - 技能文件内容
  - 技能附件列表
  - 查看附件内容
-->
<script lang="ts">
import { SkillCategory, SkillInfo } from '@/models/Skill.ts'
import { getSkillsApi } from '@/api/skills.ts'
import { type SourceFilter, SourceFilters} from '@/views/agent/skills/index.ts'
</script>

<script setup lang="ts">
import { Pencil, Upload } from '@vicons/tabler'
import { FolderOutline } from '@vicons/ionicons5'
import { useProfilesStore } from '@/store/modules/profiles.ts'
import MarkdownRender from '@/components/hermes/chat/MarkdownRender/index.vue'
import SkillSourceDot from './modules/SkillSourceDot.vue'
import SkillList from './modules/SkillList.vue'
import SkillDetail from './modules/SkillDetail.vue'
import SkillImport from './modules/SkillImport.vue'
import SkillExternalDirs from './modules/SkillExternalDirs.vue'

defineOptions({ name: 'SkillsView' })

const profilesStore = useProfilesStore()

// 加载中
const loading = ref(false)
// 类别
const categories = shallowRef<SkillCategory[]>([])
// 归档
const archived = shallowRef<SkillInfo[]>([])
// 选择的类别
const selectedCategory = ref<SkillCategory['name']>('')
// 选择的 Skill
const selectedSkill = ref<SkillInfo['name']>('')
// 搜索关键词
const searchQuery = ref('')
// 来源过滤
const sourceFilter = ref<SourceFilter | null>(null)
// 推荐 Skill
const recommendations = ref('')

// 导入技能 Modal
const importModal = reactive<{
  // 是否显示
  visible: boolean
  // 提交中
  loading: boolean
}>({
  visible: false,
  loading: false
})

// 外部目录 Modal
const externalModal = reactive<{
  // 是否显示
  visible: boolean
  // 保存中
  saving: boolean
}>({
  visible: false,
  saving: false
})

const importRef = useTemplateRef<InstanceType<typeof SkillImport>>('importRef')
const externalRef = useTemplateRef<InstanceType<typeof SkillExternalDirs>>('externalRef')

// 推荐 Skill 前端地址
const recommendationsPath = computed(() => String(navigator.language).startsWith('zh') ? '/skill-recommendations.zh.md' : '/skill-recommendations.en.md')

// 推荐 Skill 请求代次
let recommendationsRequestSeq = 0

// 选择的 Skill 数据
const selectedSkillData = computed(() => {
  if (!selectedCategory.value || !selectedSkill.value) return null
  if (selectedCategory.value === '.archive') {
    return archived.value.find(_ => _.name === selectedSkill.value)
  }
  const cat = categories.value.find(_ => _.name === selectedCategory.value)
  return cat?.skills.find(_ => _.name === selectedSkill.value)
})

void loadSkills()

watch(recommendationsPath, loadRecommendations, { immediate: true })

// 获取 Skills 列表
async function loadSkills() {
  loading.value = true
  try {
    if (!profilesStore.activeProfileName || !profilesStore.profiles.length) {
      await profilesStore.fetchProfiles()
    }
    const res = await getSkillsApi()
    categories.value = SkillCategory.form(res.categories)
    archived.value = SkillInfo.form(res.archived)
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// 获取推荐 Skills
async function loadRecommendations() {
  const requestSeq = ++recommendationsRequestSeq
  try {
    const response = await fetch(recommendationsPath.value)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const text = await response.text()
    if (/^\s*<!doctype html/i.test(text) || /^\s*<html[\s>]/i.test(text)) {
      throw new Error('Skill recommendations file was not found')
    }
    if (requestSeq === recommendationsRequestSeq) {
      recommendations.value = text
    }
  } catch (err) {
    if (requestSeq === recommendationsRequestSeq) {
      recommendations.value = ''
    }
    console.error('Failed to load skill recommendations:', err)
  }
}

// 过滤 Skills
function toggleFilter(filter: SourceFilter) {
  sourceFilter.value = sourceFilter.value === filter ? null : filter
}

// 事件：选择 Skill
function onSelectSkill(category: SkillCategory['name'], skillName: SkillInfo['name']) {
  if (selectedCategory.value === category && selectedSkill.value === skillName) {
    selectedCategory.value = ''
    selectedSkill.value = ''
    return
  }
  selectedCategory.value = category
  selectedSkill.value = skillName
}

// 事件：删除 Skill
function onSkillDeleted(category: SkillCategory['name'], skillName: SkillInfo['name']) {
  if (selectedCategory.value === category && selectedSkill.value === skillName) {
    selectedCategory.value = ''
    selectedSkill.value = ''
  }
  loadSkills()
}

// 事件：切换置顶/取消置顶 Skill
function onPinToggle(skillName: SkillInfo['name'], pinned: boolean) {
  if (selectedCategory.value === '.archive') {
    const skill = archived.value.find(_ => _.name === skillName)
    if (!skill) return
    skill.pinned = pinned
    archived.value = SkillInfo.form(archived.value)
  } else {
    const cat = categories.value.find(_ => _.name === selectedCategory.value)
    const skill = cat?.skills.find(_ => _.name === skillName)
    if (!skill) return
    skill.pinned = pinned
    categories.value = SkillCategory.form(categories.value)
  }
}

// 事件：启用/禁用 Skill
function onToggleEnabled(category: SkillCategory['name'], skillName: SkillInfo['name'], newEnabled: boolean) {
  const cat = categories.value.find(_ => _.name === category)
  const skill = cat?.skills.find(_ => _.name === skillName)
  if (!skill) return
  skill.enabled = newEnabled
  categories.value = SkillCategory.form(categories.value)
}

// 导入技能
async function handleImport() {
  importModal.loading = true
  try {
    if (await importRef.value?.importSkill()) {
      void loadSkills()
      window.$message?.info('活跃会话请执行 /reload-skills；新会话会自动加载。')
    }
    return true
  } catch (_) {
    return false
  } finally {
    importModal.loading = false
  }
}

// 打开“导入技能”弹窗
function handleOpenImportModal() {
  importModal.loading = false
  importModal.visible = true
}

// 保存外部目录
async function handleSaveExternal() {
  externalModal.saving = true
  try {
    await externalRef.value?.save()
    void loadSkills()
    return true
  } catch (_) {
    return false
  } finally {
    externalModal.saving = false
  }
}
</script>

<template>
  <div class="skills-view">
    <n-page-header class="page-header">
      <template #title>
        <n-flex class="skills-header" :wrap="false" align="center">
          <b>技能</b>

          <!--类型&过滤-->
          <n-tag :checked="sourceFilter === SourceFilters.Builtin" checkable size="small" round @click="toggleFilter(SourceFilters.Builtin)">
            <template #avatar>
              <SkillSourceDot :source="SourceFilters.Builtin" />
            </template>
            内置
          </n-tag>
          <n-tag :checked="sourceFilter === SourceFilters.Hub" checkable size="small" round @click="toggleFilter(SourceFilters.Hub)">
            <template #avatar>
              <SkillSourceDot :source="SourceFilters.Hub" />
            </template>
            Hub 安装
          </n-tag>
          <n-tag :checked="sourceFilter === SourceFilters.Local" checkable round size="small" @click="toggleFilter(SourceFilters.Local)">
            <template #avatar>
              <SkillSourceDot :source="SourceFilters.Local" />
            </template>
            本地安装
          </n-tag>
          <n-tag :checked="sourceFilter === SourceFilters.External" checkable round size="small" @click="toggleFilter(SourceFilters.External)">
            <template #avatar>
              <SkillSourceDot :source="SourceFilters.External" />
            </template>
            外部目录
          </n-tag>
          <n-tag :checked="sourceFilter === SourceFilters.Modified" checkable round size="small" @click="toggleFilter(SourceFilters.Modified)">
            <template #avatar>
              <n-icon color="var(--warning)">
                <Pencil />
              </n-icon>
            </template>
            用户已修改
          </n-tag>
          <!--类型&过滤 End-->
        </n-flex>
      </template>

      <template #extra>
        <!--操作-->
        <n-flex :wrap="false">
          <n-button size="small" @click="handleOpenImportModal">
            <template #icon>
              <n-icon>
                <Upload />
              </n-icon>
            </template>
            导入
          </n-button>

          <n-button size="small" @click="externalModal.visible = true">
            <template #icon>
              <n-icon>
                <FolderOutline />
              </n-icon>
            </template>
            外部目录
          </n-button>

          <n-input v-model:value="searchQuery" size="small" placeholder="搜索技能" style="width: 180px;" />
        </n-flex>
        <!--操作 End-->
      </template>
    </n-page-header>

    <div class="skills-body">
      <div v-if="loading" class="skills-spin">
        <n-spin />
      </div>

      <n-empty v-if="!categories.length" style="padding: 20px;" />

      <template v-else>
        <div class="skills-split">

          <div class="skills-sidebar">
            <!--技能列表-->
            <SkillList
              :categories="categories"
              :archived="archived"
              :selected-skill="selectedCategory && selectedSkill ? `${selectedCategory}/${selectedSkill}` : null "
              :search-query="searchQuery"
              :source-filter="sourceFilter"
              @select="onSelectSkill"
              @deleted="onSkillDeleted"
              @toggle-enabled="onToggleEnabled"
            />
            <!--技能列表 End-->
          </div>

          <div class="skills-main">
            <!--技能详情-->
            <SkillDetail
              v-if="selectedCategory && selectedSkill"
              :category="selectedCategory"
              :skill="selectedSkill"
              :skill-name="selectedSkillData?.name || selectedSkill"
              :patch-count="selectedSkillData?.patchCount"
              :use-count="selectedSkillData?.useCount"
              :view-count="selectedSkillData?.viewCount"
              :pinned="selectedSkillData?.pinned"
              @pin-toggle="onPinToggle"
            />
            <!--技能详情 End-->

            <!--推荐技能-->
            <div v-else class="recommendations-panel">
              <MarkdownRender v-if="recommendations" :content="recommendations" />
              <n-empty v-else />
            </div>
            <!--推荐技能 End-->

          </div>

        </div>
      </template>

    </div>

    <!--导入技能-->
    <n-modal
      v-model:show="importModal.visible"
      :positive-button-props="{loading: importModal.loading}"
      title="导入技能"
      preset="dialog"
      style="width: min(450px, 50vw)"
      negative-text="取消"
      positive-text="确定"
      @positive-click="handleImport"
    >
      <SkillImport ref="importRef" />
    </n-modal>
    <!--导入技能 End-->

    <!--外部目录-->
    <n-modal
      v-model:show="externalModal.visible"
      :positive-button-props="{loading: externalModal.saving}"
      title="外部目录管理"
      preset="dialog"
      style="width: min(550px, 60vw)"
      negative-text="取消"
      positive-text="确定"
      @positive-click="handleSaveExternal"
    >
      <SkillExternalDirs ref="externalRef" />
    </n-modal>
    <!--外部目录 End-->
  </div>
</template>

<style scoped lang="less">
.skills-view {
  height: 100%;
  display: flex;
  flex-direction: column;

  .skills-body {
    flex: 1;
    overflow: hidden;
    position: relative;

    .skills-spin {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
    }

    .skills-split {
      display: flex;
      height: 100%;

      .skills-sidebar {
        width: 280px;
        border-right: 1px solid var(--border-color);
        flex-shrink: 0;
        flex-direction: column;
        overflow: hidden;
        //min-height: 0;
      }

      .skills-main {
        flex: 1;
        overflow-y: auto;
        padding: 16px 20px;
        //min-width: 0;
      }
    }

  }
}
</style>
