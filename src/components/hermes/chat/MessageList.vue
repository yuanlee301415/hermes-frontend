<!--
消息列表
- 澄清面板
- 审批面板

Todo:
- [ ] 消息队列面板
- [ ] 虚拟列表
-->
<script setup lang="ts">
import type { Session } from '@/models/Session.ts'
import { Help } from '@vicons/tabler'
import { ShieldCheckmarkOutline } from '@vicons/ionicons5'
import { useChatStore } from '@/store/modules/chat.ts'
import { Message } from '@/models/Message.ts'
import { useToolTraceVisibility } from '@/composables/useToolTraceVisibility.ts'
import MessageItem from './MessageItem.vue'
import VirtualMessageList from './VirtualMessageList.vue'

defineOptions({ name: 'MessageList' })

const chatStore = useChatStore()
const { toolTraceVisible } = useToolTraceVisibility()
const listRef = ref<InstanceType<typeof VirtualMessageList>| null>(null)

const currentToolCalls = computed(() => {
  const msgs = chatStore.messages
  let lastIndex = -1
  for (let i = msgs.length - 1; i >=0; i--) {
    if (msgs[i].role === Message.ROLE.User) {
      lastIndex = i
      break
    }
  }
  const tools = msgs.filter((msg, idx) => msg.role === Message.ROLE.Tool && idx > lastIndex)
  return [...tools].reverse()
})

const displayMessages = computed(() => {
  const currentToolIds = new Set(currentToolCalls.value.map(_ => _.id))
  return chatStore.messages.filter(msg => {
    if (msg.role === Message.ROLE.Tool) return toolTraceVisible.value && !!msg.toolName && !(chatStore.isRunActive && currentToolIds.has(msg.id))
    return !(msg.role === Message.ROLE.Assistant && msg.isStreaming && !msg.content?.trim() && !!msg.reasoning?.trim() && currentToolCalls.value.length === 0)
  })
})

// ==================== 浮动面板 ====================

// 当前可见的审批请求：AI 需要用户确认才能执行的操作
const visibleApproval = computed(() => chatStore.activePendingApproval)

// 用户对澄清请求的响应内容
const clarifyResponse = ref('');

// 当前可见的澄清请求：AI 需要用户进一步说明的问题
const visibleClarify = computed(() => chatStore.activePendingClarify)


// ==================== Watch ====================

/*
* 监听会话切换：滚动到新会话的位置
* */
watch(() => chatStore.activeSessionId, async (id) => {
  await nextTick()
  applyInitialSessionScroll(id!)
}, { immediate: true })

/*
 * 监听运行状态开始：当用户发送消息后，强制滚动到底部一次
 */
watch(() => chatStore.isRunActive, () => {
  scrollToBottom()
})

/*
 * 监听消息数量变化：在消息加载完成后确保滚动位置正确
 * - 使用 flush: "post" 确保 DOM 更新后再执行滚动
 */
watch(() => [chatStore.activeSessionId, chatStore.messages.length] as const, ([id, length]) => {
  // 如果没有会话、滚动尚未完成或没有消息，跳过
  if (!id || length === 0) return
  applyInitialSessionScroll(id)
}, { flush: 'post'})

/*
* 监听最后一条消息内容变化（流式传输）
*/
watch(() => chatStore.messages.at(-1)?.content, () => {
  scrollToBottom()
})

// 滚动到底部
function scrollToBottom() {
  listRef.value?.scrollToBottom();
}

/**
 * 应用初始会话滚动：在切换到新会话后恢复滚动位置
 * @param sessionId - 目标会话 ID
 */
function applyInitialSessionScroll(sessionId: Session['id']) {
  if (chatStore.activeSessionId !== sessionId) return
  scrollToBottom()
}

/**
 * 处理澄清请求：用户回答 AI 的问题
 * @param response - 用户的响应（可选，未提供时使用输入框中的内容）
 */
function handleClarify(response?: string) {
  const finalResponse = response ?? clarifyResponse.value.trim()
  chatStore.respondToClarify(finalResponse)
  clarifyResponse.value = ''
}

/**
 * 处理审批请求：用户选择允许/拒绝 AI 的操作
 * @param choice - 审批选择：once（一次）、session（当前会话）、always（始终允许）、deny（拒绝）
 */
function handleApproval(choice: "once" | "session" | "always" | "deny") {
  chatStore.respondApproval(choice)
}
</script>

<template>
  <div class="message-list-shell">
    <VirtualMessageList
      :key="chatStore.activeSessionId || 'chat-empty'"
      :messages="displayMessages" v-slot="{item}"
      ref="listRef"
    >
      <MessageItem :message="item" :highlight="chatStore.focusSessionId === item.id" />
    </VirtualMessageList>

    <!-- ================================ >>>[浮动面板堆栈] ================================ -->
    <div v-if="visibleApproval || visibleClarify" class="message-float-stack">

      <!-- ============================ >>>[审批面板：AI 需要用户确认才能执行的操作] ============================ -->
      <transition name="queue-float">
        <div v-if="visibleApproval" class="approval-float-panel">
          <div class="float-panel-header">
            <div class="float-icon">
              <n-icon :size="18"><ShieldCheckmarkOutline/></n-icon>
            </div>
            <span>终端授权</span>
          </div>

          <div class="approval-float-title">运行前请确认命令</div>
          <div class="approval-float-desc">{{ visibleApproval.description }}</div>
          <div class="approval-float-command">{{ visibleApproval.command }}</div>

          <div class="approval-float-actions">
            <!-- 内存写入确认 -->
            <n-button v-if="visibleApproval.isMemoryWrite" size="small" type="primary" @click="handleApproval('once')">同意</n-button>

            <!-- 仅本次允许 -->
            <n-button v-if="!visibleApproval.isMemoryWrite && visibleApproval.choices.includes('once')" size="small" type="primary" @click="handleApproval('once')">仅本次允许</n-button>

            <!-- 本会话允许 -->
            <n-button v-if="!visibleApproval.isMemoryWrite && visibleApproval.choices.includes('session')" size="small" secondary @click="handleApproval('session')">本会话允许</n-button>

             <!-- 始终允许 -->
            <n-button v-if="!visibleApproval.isMemoryWrite && visibleApproval.choices.includes('always')" size="small" secondary @click="handleApproval('always')">始终允许</n-button>

            <!-- 拒绝 -->
            <n-button v-if="visibleApproval.isMemoryWrite || visibleApproval.choices.includes('deny')" size="small" type="error" secondary @click="handleApproval('deny')">拒绝</n-button>
          </div>

        </div>
      </transition>
      <!-- ============================ [审批面板]<<< ============================ -->

      <!-- ============================ >>>[澄清面板：AI 需要用户进一步说明的问题] ============================ -->
      <transition name="queue-float">
        <div v-if="!visibleApproval && visibleClarify" class="approval-float-panel">
          <div class="float-panel-header">
            <div class="float-icon">
              <n-icon :size="18"><Help/></n-icon>
            </div>
            <span>AGENT 需要确认</span>
          </div>
          <div class="approval-float-title">Agent 有一个问题需要您回答</div>
          <div class="approval-float-desc">{{ visibleClarify.question }}</div>

          <!-- 选择模式 -->
          <div v-if="visibleClarify.choices?.length" class="approval-float-actions">
            <n-button
              v-for="choice of visibleClarify.choices"
              :key="choice"
              size="small"
              type="primary"
              @click="handleClarify(choice)"
            >{{ choice }}</n-button>
            <n-button size="small" type="error" secondary @click="handleClarify('')">忽略</n-button>
          </div>

          <!-- 自由输入模式 -->
          <div v-else class="clarify-float-input-row">
            <n-input v-model:value="clarifyResponse" size="small" placeholder="输入你的回答..."/>
            <n-button size="small" type="primary" @click="handleClarify()">回复</n-button>
          </div>
        </div>
      </transition>
      <!-- ============================ [澄清面板]<<< ============================ -->

      <!-- ============================ >>>Todo:[消息队列面板：显示已发送但尚未处理的消息] ============================ -->
      <!-- ============================ [消息队列面板]<<< ============================ -->

    </div>
    <!-- ================================ [浮动面板堆栈]<<< ================================ -->


  </div>
</template>

<style scoped lang="less">
.message-list-shell {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;

  .message-float-stack {
    position: absolute;
    right: 16px;
    bottom: 16px;
    z-index: 8;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(720px, calc(100% - 32px));
    pointer-events: none;

    .approval-float-panel,
    .queue-float-panel {
      pointer-events: auto;
      width: 100%;
      padding: 10px;
      border: 1px solid rgba(var(--accent-info-rgb), 0.22);
      border-radius: 16px;
      background: var(--bg-secondary);
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.14);
      backdrop-filter: blur(14px);
    }

    .float-panel-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 2px 4px 8px;
      color: var(--accent-primary);
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .approval-float-panel {
      border-color: rgba(var(--accent-primary-rgb), 0.24);
      .approval-float-title {
        padding: 0 4px;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.3;
        color: var(--text-primary);
      }
      .approval-float-desc {
        padding: 0 4px;
        margin-top: 5px;
        font-size: 12px;
        line-height: 1.45;
        color: var(--text-secondary);
      }
      .approval-float-command {
        display: block;
        margin: 8px 4px 0;
        max-height: 96px;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: "SFMono-Regular", "Cascadia Code", "Roboto Mono", Consolas, monospace;
        font-size: 12px;
        line-height: 1.45;
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: 11px;
        padding: 8px 10px;
        background: rgba(var(--accent-primary-rgb), 0.24);
      }
      .approval-float-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 10px;
        padding: 10px 4px 0;
        border-top: 1px solid var(--border-color);
      }
    }

    .clarify-float-input-row {
      display: flex;
      gap: 8px;
      margin-top: 10px;
      padding: 10px 4px 0;
      border-top: 1px solid var(--border-color);

      // 输入框占满剩余空间
      :deep(.n-input) {
        flex: 1 1 auto;
        min-width: 0;
      }

      // 按钮固定宽度
      :deep(.n-button) {
        flex: 0 0 auto;
      }
    }
  }


  /**
   * 队列面板进入/离开过渡动画
   */
  .queue-float-enter-active,
  .queue-float-leave-active {
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .queue-float-enter-from,
  .queue-float-leave-to {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }

}
</style>
