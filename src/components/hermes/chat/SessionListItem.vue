<!--
会话列表项（@2026-09-20）
- 会话》标题、Agent、模型、创建时间、Profile
- 选择（切换会话）
- 右键
- 复选框（批量选择）
- 删除按钮
-->
<script setup lang="ts">
import { Pinned } from '@vicons/tabler'
import { Session } from '@/models/Session.ts'
import { DEFAULT_PROFILE_NAME } from '@/constants/hardcoded.ts'
import { useProfilesStore } from '@/store/modules/profiles.ts'
import ProfileAvatar from '@/components/hermes/profiles/ProfileAvatar/index.vue'

const profilesStore = useProfilesStore()

const props = defineProps<{
  session: Session
  // 是否当前活跃会话
  active: boolean
  // 是否置顶
  pinned: boolean
  // 批量选择状态
  selectable?: boolean
  // 批量选择》是否勾选
  selected?: boolean
  // 是否处于活跃状态
  streaming?: boolean
}>()

const profileName = computed(() => props.session.profile || DEFAULT_PROFILE_NAME)
const profileAvatar = computed(() => profilesStore.profiles.find(_ => _.name === profileName.value)?.avatar)
const sessionAgentLogo = computed(() => {
  if (props.session.source === Session.SOURCE.CodingAgent) {
    if (props.session.codingAgentId === Session.CODING_AGENT_ID.Codex || props.session.agent === Session.AGENT_TYPE.Codex) {
      return { label: 'Codex', src: '/coding-agents/codex-openai.png' }
    }
    return { label: 'Claude Code', src: '/coding-agents/claude-code.svg' }
  }
  return { label: 'Hermes', src: '/coding-agents/hermes.png' }
})

const emit = defineEmits<{
  // 切换会话
  (e: 'switch-session'): void
  // 右键
  (e: 'contextmenu', evt: MouseEvent): void
  // 批量选择》选择单个会话
  (e: 'toggle-select'): void
}>()


</script>

<template>
  <a
    :class="{active}"
    class="session-item flex-row"
    @click="emit('switch-session')"
    @contextmenu="emit('contextmenu', $event)"
  >
    <div v-if="selectable" class="session-item-checkbox">
      <n-checkbox :checked="selected" v-show="!streaming" @click.stop="emit('toggle-select')"/>
    </div>
    <div class="session-item-content flex-1">
      <n-flex align="center" :size="4">
        <n-icon v-if="pinned"><Pinned/></n-icon>
        <n-text v-if="session.title" strong class="session-title">
          <n-ellipsis>{{ session.title }}</n-ellipsis>
        </n-text>
      </n-flex>

      <n-flex class="session-agent" align="center" :size="6">
        <img :src="sessionAgentLogo.src" :alt="sessionAgentLogo.label" />
        <n-text :title="session.agent" depth="3" class="flex-1 overflow-hidden">
          <n-ellipsis :tooltip="false">{{ session.agent }}</n-ellipsis>
        </n-text>
      </n-flex>

      <n-flex class="session-meta" align="center" :size="6">
        <n-text :title="session.model" depth="2" class="flex-1 overflow-hidden" style="max-width: 100px;">
          <n-ellipsis :tooltip="false">{{ session.model }}</n-ellipsis>
        </n-text>
        <n-text depth="3">{{ session.createdDate }}</n-text>
      </n-flex>

      <n-flex class="session-profile" align="center" :size="5">
        <ProfileAvatar :name="profileName" :avatar="profileAvatar" :size="16"/>
        <n-text :title="session.profile" depth="3" class="flex-1 overflow-hidden">
          <n-ellipsis :tooltip="false">{{ session.profile }}</n-ellipsis>
        </n-text>
      </n-flex>
    </div>
  </a>
</template>

<style scoped lang="less">
.session-item {
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  margin-bottom: 2px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover, &.active {
    .session-title {
      color: var(--text-primary);
    }
  }
  &:hover {
    background-color: rgba(var(--accent-primary-rgb), .06);
  }
  &.active {
    background-color: rgba(var(--accent-primary-rgb), .12);
  }

  .session-item-content {
    overflow: hidden;
    .session-title {
      flex: 1;
      overflow: hidden;
    }
    .session-agent, .session-meta, .session-profile {
      font-size: 12px;
    }

    .session-agent {
      margin-top: 4px;
      img {
        flex: 0 0 auto;
        width: 18px;
        height: 18px;
        padding: 2px;
        border-radius: 50%;
        object-fit: contain;
        background: #fff;
      }
    }

    .session-meta {
      margin-top: 2px;
    }

    .session-profile {
      margin-top: 4px;
    }
  }

}
</style>
