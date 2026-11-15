<!--
Skill 列表
- 分类列表
- 选择技能
- 删除技能
- 启用/禁用技能

Todo:
- [ ] 外部目录(`externalGroups`)（暂缓）
-->
<script lang="ts">
import { type SkillCategory, type SkillInfo } from '@/models/Skill.ts'
import { deleteSkillApi, toggleSkillEnabledApi } from '@/api/skills.ts'
import { type SourceFilter, SourceFilters } from '../index.ts'

function skillKey(catName: string, skill: { name: string }) {
  return `${catName}/${skill.name}`
}
</script>

<script setup lang="ts">
import { TrashBinOutline } from '@vicons/ionicons5'
import SkillSourceDot from './SkillSourceDot.vue'

const props = defineProps<{
  categories: SkillCategory[]
  searchQuery: string
  selectedSkill: SkillInfo['name'] | null
  sourceFilter: SourceFilter | null
}>()

const emit = defineEmits<{
  // 选择技能
  (e: 'select', category: SkillCategory['name'], skillName: SkillInfo['name']): void
  // 删除技能
  (e: 'deleted', category: SkillCategory['name'], skillName: SkillInfo['name']): void
  // 启用/禁用
  (e: 'toggle-enabled', category: SkillCategory['name'], skillName: SkillInfo['name'], newEnabled: boolean): void
}>()

// 删除中的 Skills
const deletingSkills = ref<Set<SkillInfo['name']>>(new Set())

// 切换：启用/禁用
const togglingSkills = ref<Set<SkillInfo['name']>>(new Set())

// 过滤类别
const filteredCategories = computed(() => {
  let result = props.categories

  // Filter by source
  if (props.sourceFilter) {
    result = result.map(cat => ({
      ...cat,
      skills: cat.skills.filter(_ => props.sourceFilter === SourceFilters.Modified ? _.modified : (_.source || SourceFilters.Local) === props.sourceFilter)
    })).filter(cat => cat.skills.length > 0)
  }

  // Filter by search query
  if (props.searchQuery) {
    const q = props.searchQuery.toLowerCase()
    result = result.map(cat => ({
      ...cat,
      skills: cat.skills.filter(_ => _.name.toLowerCase().includes(q) || _.description.toLowerCase().includes(q))
    })).filter(cat => cat.skills.length > 0)
  }

  return result
})

const expandedNames = computed(() => filteredCategories.value.map(cat => cat.name))

// 选择 Skill
function handleSelect(category: SkillCategory['name'], skillName: SkillInfo['name']) {
  emit('select', category, skillName)
}

// 删除 Skill
function handleDelete(category: SkillCategory['name'], skillName: SkillInfo['name']) {
  if (deletingSkills.value.has(skillName)) return
  window.$dialog?.warning({
    title: '删除',
    content: `确定要删除技能 "${skillName}" ？`,
    negativeText: '取消',
    positiveText: '确定',
    onPositiveClick: async () => {
      try {
        await deleteSkillApi(category, skillName)
        window.$message?.success('已删除技能')
        window.$message?.info('活跃会话请执行 /reload-skills；新会话会自动加载。')
        emit('deleted', category, skillName)
      } catch (e) {
        console.error(e)
        window.$message?.error(`删除失败：${(e as Error).message}`)
      } finally {
        deletingSkills.value.delete(skillName)
      }
    }
  })
}

// 启用/禁用 Skill
async function handleToggleEnabled(category: SkillCategory['name'], skillName: SkillInfo['name'], newEnabled: boolean) {
  if (togglingSkills.value.has(skillName)) return
  togglingSkills.value.add(skillName)

  try {
    await toggleSkillEnabledApi(skillName, newEnabled)
    emit('toggle-enabled', category, skillName, newEnabled)
  } catch (e) {
    console.error(e)
  } finally {
    togglingSkills.value.delete(skillName)
  }
}
</script>

<template>
  <div class="skill-list">
    <n-empty v-if="!filteredCategories.length" />

    <!--
        <template v-if="externalGroups">
        </template>
    -->

    <template v-else>
      <n-collapse v-for="cat of filteredCategories" :key="cat.name" :default-expanded-names="expandedNames" class="skill-category">
        <n-collapse-item :title="cat.name" :name="cat.name">
          <template #header-extra>
            <n-tag size="small" round :bordered="false">{{ cat.skills.length }}</n-tag>
          </template>

          <div class="category-skills">
            <button
              v-for="skill of cat.skills"
              :key="skillKey(cat.name, skill)"
              :class="{active: selectedSkill === skillKey(cat.name, skill)}"
              class="skill-item"
              @click="handleSelect(cat.name, skill.name)"
            >
              <div class="skill-info">
              <span class="skill-name">
                <SkillSourceDot :source="skill.source" />
                <span>{{ skill.name }}</span>
              </span>
                <span class="skill-desc">{{ skill.description }}</span>
              </div>

              <n-button
                v-if="(skill.source ?? SourceFilters.Local) === SourceFilters.Local"
                size="small"
                type="error"
                quaternary
                title="删除"
                :disabled="deletingSkills.has(skill.name)"
                @click.stop="handleDelete(cat.name, skill.name)"
              >
                <n-icon>
                  <TrashBinOutline />
                </n-icon>
              </n-button>

              <n-switch
                :value="skill.enabled"
                :loading="togglingSkills.has(skill.name)"
                size="small"
                @click.stop
                @update:value="handleToggleEnabled(cat.name, skill.name, $event)"
              />
            </button>
          </div>

        </n-collapse-item>

      </n-collapse>
    </template>
  </div>
</template>

<style scoped lang="less">
.skill-list {
  height: 100%;
  overflow-y: auto;
  padding: 8px;

  :deep(.n-collapse) {
    .n-collapse-item {
      border-top: none;
      margin: 0;

      .n-collapse-item__header {
        padding-top: 10px;
      }

      .n-collapse-item__content-wrapper {
        .n-collapse-item__content-inner {
          padding-top: 10px;
        }
      }
    }
  }

  .skill-category {

    .category-skills {
      overflow: hidden;

      .skill-item {
        width: 100%;
        overflow: hidden;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border: none;
        background: none;
        color: var(--text-secondary);
        font-size: 13px;
        text-align: left;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.15s ease;
        margin-bottom: 2px;

        &.active {
          background-color: rgba(var(--accent-primary-rgb), 0.1);
          color: var(--text-primary);
        }

        &:hover {
          background-color: rgba(var(--accent-primary-rgb), 0.05);
          color: var(--text-primary);
        }

        .skill-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;

          .skill-name {
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-transform: uppercase;
          }

          .skill-desc {
            font-size: 11px;
            color: var(--text-muted);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-top: 1px;
          }
        }
      }
    }
  }
}
</style>
