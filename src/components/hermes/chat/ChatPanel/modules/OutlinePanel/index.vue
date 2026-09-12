<!--
会话大纲
- 从当前会话中提取
  - 用户消息
  - AI 消息正文中的标题（代码块中标题除外）
- 大纲列表
  - 点击列表中的用户消息，跳转到对应的用户消息气泡
  - 点击列表中的标题，跳转到对应的 AI 正文中的标题
-->
<script lang="ts">
import { getOutlines } from './index.ts'
</script>

<script setup lang="ts">
import { useChatStore } from '@/store/modules/chat.ts'

defineOptions({ name: 'OutlinePanel' })
const emit = defineEmits<{
  (e:'navigate', targetId: string): void
}>()

const chatStore = useChatStore()

const outlines = computed(() => getOutlines(chatStore.messages))

function scrollTo(targetId: string) {
  emit('navigate', targetId)
}
</script>

<template>
  <div class="outline-panel" v-if="chatStore.activeSession">
    <h2 class="outline-header">会话大纲</h2>
    <div v-if="outlines.length" class="outline-content">
      <dl v-for="_ of outlines" :key="_.id">
        <dt class="user-item" @click="scrollTo(_.id)">
          <div class="user-question">
            <b>Q:</b>
            <strong>{{ _.question }}</strong>
          </div>
        </dt>
        <dd
          v-for="heading of _.headings"
          :key="heading.id"
          :id="heading.id"
          :class="`level-${heading.level}`"
          :style="`margin-left: ${(heading.level-1) * 10}px`"
          class="heading-item"
          @click="scrollTo(heading.id)"
        >
          <span>{{ heading.text }}</span>
        </dd>
      </dl>
    </div>
    <n-empty v-else :show-icon="false" style="margin-top: 10px;">暂无会话内容</n-empty>
  </div>
</template>

<style scoped lang="less">
.outline-panel {
  height: 100%;
  overflow: hidden;
  background-color: var(--bg-card);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  .outline-header {
    font-size: 14px;
    padding: 16px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border-color);
    font-weight: 600;
    color: var(--text-primary);
  }
  .outline-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;

    dl {
      font-size: 13px;
      line-height: 1.4;

      dt, dd {
        cursor: pointer;
        transition: opacity 0.2s ease;
        &:hover {
          opacity: 0.8;

        }
      }
      .user-item {
        margin-bottom: 6px;
        .user-question {
          background-color: var(--bg-input);
          color: var(--text-primary);
          padding: 8px 12px;
          border-radius: 8px;
          display: flex;
          align-items: flex-start;
          gap: 6px;
          b {
            flex-shrink: 0;
          }
          strong {
            word-break: break-all;
          }
        }
      }

      .heading-item {
        margin-bottom: 4px;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background-color .15s ease;
        &:hover {
          background-color: rgba(var(--accent-primary-rgb), 0.03);
        }
      }
    }
  }
}
</style>
