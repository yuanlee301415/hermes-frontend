<!--
对话消息(@2026年8月8日)

- 工具调用
- 用户消息
- AI 消息
- 系统消息
- 命令消息
- 思考内容
- 附件（暂缓）
- 语音播放（暂缓）
-->
<script setup lang="ts">
import { CopyOutline, BuildOutline } from '@vicons/ionicons5'
import { ChevronRight, ChevronDown } from '@vicons/tabler'
import { Message } from '@/models/Message.ts'
import ProfileAvatar from '@/components/hermes/profiles/ProfileAvatar.vue'
import { formatTime } from '@/utils/formatTime.ts'
import { parseThinking, countThinkingChars } from '@/utils/thinking-parser.ts'
import { useChatStore } from '@/store/modules/chat.ts'
import { formatDurationMs } from '@/utils/format.ts'
import { copyToClipboard } from '@/utils/clipboard.ts'
import MarkdownRender from '../MarkdownRender/index.vue'
import { parseContentBlocks, getBlockText } from '../../shared/parse-message.ts'
import { formatToolPayload, renderToolPayload } from '../../shared/parse-tool.ts'
import { copyTextToClipboard, handleCodeBlockCopyClick, COPY_CODE_ATTR_NAME } from '../../shared/highlight.ts'

defineOptions({ name: 'MessageItem' })

const TOOL_ARGS_PROPERTY_NAME: keyof Message = 'toolArgs'
const TOOL_RESULT_PROPERTY_NAME: keyof Message = 'toolResult'

const props = defineProps<{message: Message, highlight?: boolean, headingIdPrefix?: string}>()

const chatStore = useChatStore()

// ==================== 内容块解析计算属性 ====================

// 从消息内容字符串中解析 ContentBlock[] 数组
const contentBlocks = computed(() => parseContentBlocks(props.message.content ?? ''))

// 判断消息内容是否为 ContentBlock[] 格式（多模态格式）
// 用于区分普通文本消息和多模态消息（包含图片、文件等）
const isContentBlockArray = computed(() => contentBlocks.value !== null)

// 从 ContentBlock[] 中提取纯文本内容用于显示
const displayText = computed(() => {
  // 如果不是 ContentBlock[] 格式（普通文本消息），直接返回原始内容
  if (!isContentBlockArray.value) return props.message.content ?? ''

  // 遍历所有内容块，提取文本并拼接
  return contentBlocks.value!.map(block => getBlockText(block)).filter(Boolean).join('\n')
})

// ==================== 思考内容（Reasoning）====================

const thinkingExpanded = ref(false)
const nowTick = ref(Date.now())

// 解析消息内容中的思考文本（<think> 标签）
const parsedThinking = computed(() => parseThinking(props.message.content ?? '', { streaming: !!props.message.isStreaming }))

// 是否包含 reasoning 字段（来自事件/API 的思考文本）
const hasReasoningField = computed(() => !!props.message.reasoning)

// 判断消息是否包含思考内容（reasoning 字段或 <think> 标签任一存在即可）
const hasThinking = computed(() => hasReasoningField.value || parsedThinking.value.hasThinking)

// 判断是否处于流式思考状态：
const thinkingStreamingNow = computed(() => {
  if (!props.message.isStreaming) return false // 非流式消息直接返回 false
  if (parsedThinking.value.pending !== null) return true // 存在未闭合的 <think> 标签（流式传输中）
  if (hasReasoningField.value && !props.message.content) return true // reasoning 有内容但正文为空（表示正在思考，尚未生成回复正文）
  return false
})

// 思考持续时间（毫秒）：从思考开始时间到结束时间（或当前时间，如果仍在流式传输）
const thinkingDurationMs = computed(() => {
  const ob = chatStore.getThinkingObservation(props.message.id)
  if (!ob?.startedAt) return null
  const startedAt = ob.startedAt
  const end = ob?.endedAt ?? (props.message.isStreaming ? nowTick.value: startedAt)
  return Math.max(0, end - startedAt)
})

// 思考内容的字符数统计：包含 reasoning 字段和解析出的 <think> 标签内容
const thinkingCharCount = computed(() => {
  let count = countThinkingChars(parsedThinking.value)
  if (props.message.reasoning) count += props.message.reasoning.length
  return count
})

// 完整的思考文本：合并 reasoning 字段和解析出的 <think> 标签内容
// 拼接顺序：reasoning 字段 → 解析出的思考片段 → 未闭合的思考内容（流式传输中）
const thinkingFullText = computed(() => {
  const parts: string[] = []
  if (props.message.reasoning) {
    parts.push(props.message.reasoning)
  }
  parts.push(...parsedThinking.value.segments)
  return parts.join('\n\n')
})

// ==================== 复制功能 ====================

// 可复制的消息内容：
// - 工具调用消息（role 为 tool）不支持复制
// - 空内容不支持复制
// - 其他消息类型返回原始内容
const copyableContent = computed(() => {
  if (props.message.role === Message.ROLE.Tool) return null
  const content = props.message.content ?? ''
  if (!content.trim()) return null
  return content
})

// ==================== 工具调用(Tool) ====================
// 工具调用详情展开状态（用于控制工具调用参数和结果的显示/隐藏切换）
const toolExpanded = ref(false)

// 工具调用参数的格式化负载：将 toolArgs 格式化为 ToolPayload 对象
const toolArgsPayload = computed(() => formatToolPayload(props.message.toolArgs))

// 工具调用结果的格式化负载：将 toolResult 格式化为 ToolPayload 对象（开启 diff 提取）
const toolResultPayload = computed(() => formatToolPayload(props.message.toolResult, true))

// 判断是否有工具调用详情（参数或结果任一非空）
// 用于控制工具调用详情的展开/收起按钮显示
const hasToolDetails = computed(() => !!(toolArgsPayload.value.full || toolResultPayload.value.full))

// 格式化后的工具参数（用于 UI 显示，可能被截断）
const formattedToolArgs = computed(() => toolArgsPayload.value.display);

// 格式化后的工具结果（用于 UI 显示，可能被截断）
const formattedToolResult = computed(() => toolResultPayload.value.display);

// 渲染后的工具参数（带语法高亮的代码块 HTML）
const renderedToolArgs = computed(() => formattedToolArgs.value ? renderToolPayload(formattedToolArgs.value, toolArgsPayload.value.language) : '')

// 渲染后的工具结果（带语法高亮的代码块 HTML）
const renderedToolResult = computed(() => formattedToolResult.value ? renderToolPayload(formattedToolResult.value, toolResultPayload.value.language) : '')

// 有效标题 ID 前缀：优先使用传入的 headingIdPrefix，否则使用消息 ID 作为前缀
// 用于 Markdown 渲染时为标题生成唯一 ID，支持锚点跳转
const effectiveHeadingIdPrefix = computed(() => props.headingIdPrefix ?? `msg-${props.message.id}`)


// ==================== 消息类型判断计算属性 ====================

// 是否为命令消息（role 为 command 或 systemType 为 command），用于执行系统命令
const isCommandMessage = computed(() => props.message.role === Message.ROLE.Command || props.message.systemType === Message.SYSTEM_TYPE.Command)

// 是否为命令错误消息（command 角色且 systemType 为 error），用于展示命令执行失败
const isCommandError = computed(() => props.message.role === Message.ROLE.Command && props.message.systemType === Message.SYSTEM_TYPE.Error)

// 是否为状态命令消息：命令消息且 commandAction 为 status，且不是 goal 类型
// 状态命令用于展示 Hermes Agent 的运行状态信息
const isStatusCommand = computed(() => !!props.message.content && isCommandMessage.value && props.message.commandAction === 'status'  && props.message.commandData?.type !== 'glob')

// 是否为助手错误消息（assistant 角色且 systemType 为 error），用于特殊的错误样式展示
const isAgentError = computed(() => props.message.role === Message.ROLE.Assistant && props.message.systemType === Message.SYSTEM_TYPE.Error)

// 状态命令消息的显示项列表：从 commandData 中提取运行状态信息
// 包含：运行状态、消息来源、配置文件、模型名称、队列长度、运行 ID
const statusItems = computed(() => {
  const data: Message['commandData'] = props.message.commandData || ({})
  return [
    { key: 'status', value: data.isWorking ? 'running' : 'idle' },
    { key: 'source', value: data.source },
    { key: 'profile', value: data.profile },
    { key: 'model', value: data.model ?? '-'},
    { key: 'queueLength', value: data.queueLength ?? 0 },
    { key: 'runId', value: data.runId ?? '-'},
  ]
})

/**
 * 处理工具详情区域的点击事件
 * 支持复制工具参数和工具结果，以及代码块的复制
 *
 * @param event 鼠标事件
 */
async function handleToolDetailClick(event: MouseEvent) {
  const target = event.target
  // 非 HTMLElement 直接返回（如 SVG 元素）
  if (!(target instanceof HTMLElement)) return

  // 查找带有 data-copy-code 属性的复制按钮
  const button = target.closest(`[data-${COPY_CODE_ATTR_NAME}]`)
  if (!button) return

  event.preventDefault()

  // 获取复制源类型（tool-args 表示工具参数，tool-result 表示工具结果）
  const source = button.closest<HTMLElement>('[data-copy-source]')?.dataset.copySource

  // 复制工具参数（点击参数区域的复制按钮）
  if (source === TOOL_ARGS_PROPERTY_NAME && toolArgsPayload.value.full) {
    const ok = await copyTextToClipboard(toolArgsPayload.value.full)
    if (ok) window.$message?.success('已复制')
    else window.$message?.error('复制失败')
    return
  }

  // 复制工具结果（点击结果区域的复制按钮）
  if (source === TOOL_RESULT_PROPERTY_NAME && toolResultPayload.value) {
    const ok = await copyTextToClipboard(toolResultPayload.value.full);
    if (ok) window.$message?.success('已复制')
    else window.$message?.error('复制失败')
    return;
  }

  // 默认处理：代码块内的单行复制（由 highlight 模块处理）
  const copyResult = await handleCodeBlockCopyClick(event)
  if (copyResult) window.$message?.success('已复制')
  else if (copyResult === false) window.$message?.error('复制失败')
}

/**
 * 复制整个消息气泡内容到剪贴板
 * 复制成功显示成功提示，失败显示错误提示
 */
async function handleCopyMessage() {
  const text = copyableContent.value
  if (!text) return
  const ok = await copyToClipboard(text)
  if (ok) {
    window.$message?.success('已复制')
  } else {
    window.$message?.error('复制失败')
  }
}
</script>

<template>
  <div class="message" :class="[message.role, {highlight}]" :id="`message-${message.id}`">

    <!-- ================================ >>>[工具调用] ================================ -->
    <div v-if="message.role === Message.ROLE.Tool" class="msg-tool">

      <!-- 工具调用摘要行：显示工具名称、预览和状态，可点击展开详情 -->
      <div class="tool-line" :class="{expandable: hasToolDetails}" @click="toolExpanded = !toolExpanded">

        <!-- 展开/收起箭头图标（有详情时显示） -->
        <n-icon v-if="hasToolDetails">
          <transition name="fade">
            <ChevronDown v-if="toolExpanded"/>
            <ChevronRight v-else/>
          </transition>
        </n-icon>
        <n-icon v-else><BuildOutline/></n-icon>

        <!-- 工具名称 -->
        <span class="tool-name">{{ message.toolName }}</span>

        <!-- 工具调用预览（收起时显示） -->
        <div v-if="message.toolPreview && !toolExpanded" class="tool-preview">{{ message.toolPreview }}</div>

        <!-- 运行状态指示器（running 时显示旋转动画） -->
        <div v-if="message.toolStatus === Message.TOOL_STATUS.Running" class="tool-spinner">
          <n-spin size="small" :scale="0.5"></n-spin>
        </div>

        <!-- 错误状态标签（error 时显示红色错误标识） -->
        <div v-if="message.toolStatus === Message.TOOL_STATUS.Error" class="tool-error-badge">错误</div>
      </div>

      <!-- 工具调用详情（展开时显示） -->
      <div v-if="toolExpanded && hasToolDetails" class="tool-details" @click="handleToolDetailClick">
        <!-- 工具参数部分 -->
        <div v-if="formattedToolArgs" class="tool-detail-section" :data-copy-source="TOOL_ARGS_PROPERTY_NAME">
          <div class="tool-detail-label">参数</div>
          <div class="tool-detail-code-block" v-html="renderedToolArgs"></div>
        </div>

        <!-- 工具参数部分 -->
        <div v-if="formattedToolResult" class="tool-detail-section" :data-copy-source="TOOL_RESULT_PROPERTY_NAME">
          <div class="tool-detail-label">结果</div>
          <div class="tool-detail-code-block" v-html="renderedToolResult"></div>
        </div>
      </div>
    </div>
    <!-- ================================ [工具]<<< ================================ -->


    <!-- ================================ >>>[消息（用户/助手/系统/命令）] ================================ -->
    <template v-else>
      <div class="msg-body">
        <ProfileAvatar v-if="message.role === Message.ROLE.Assistant" class="msg-avatar"/>

        <div class="msg-content" :class="message.role">
          <!-- ============================ >>>[消息气泡] ============================ -->
          <div
            class="msg-bubble"
            :class="{
            system: message.role === Message.ROLE.System,
            'agent-error': isAgentError,
            command: isCommandMessage,
            'command-error': isCommandError
          }"
          >
            <!-- ======================== Todo:[附件] ======================== -->

            <!-- ======================== >>>[思考内容] ======================== -->
            <!-- 显示助手的思考过程（</think> 标签内的内容） -->
            <div v-if="hasThinking" class="thinking-block">
              <div class="thinking-header" @click="thinkingExpanded = !thinkingExpanded">
                <!-- 思考内容标题栏：点击可展开/收起 -->
                <n-icon>
                  <transition name="fade">
                    <ChevronDown v-if="thinkingExpanded"/>
                    <ChevronRight v-else/>
                  </transition>
                </n-icon>

                <span class="thinking-icon">💭</span>

                <span class="thinking-label">
                    {{ thinkingStreamingNow ? '思考中…' : '思考过程' }}
                  </span>

                <!-- 思考时长 -->
                <span v-if="thinkingDurationMs != null && thinkingDurationMs > 0" class="thinking-meta">
                    · 已观察 {{formatDurationMs(thinkingDurationMs)}}
                  </span>

                <!-- 思考内容字符数 -->
                <span class="thinking-meta">
                    · {{thinkingCharCount}} 字
                  </span>
              </div>


              <!-- 思考内容正文（展开时显示） -->
              <div v-if="thinkingExpanded" class="thinking-body">
                <MarkdownRender :content="thinkingFullText"/>
              </div>
            </div>


            <!-- ========== 解析后的思考内容（直接显示） ========== -->
            <!-- 当思考内容在助手消息中且不需要单独展开时，直接渲染 -->
            <MarkdownRender
              v-if="parsedThinking.body && message.role === Message.ROLE.Assistant"
              :content="parsedThinking.body"
              :heading-id-prefix="effectiveHeadingIdPrefix"
            />
            <!-- ======================== [思考内容]<<< ======================== -->


            <!-- ======================== >>>[用户消息] ======================== -->
            <template v-if="message.role === Message.ROLE.User">
              <template v-if="isContentBlockArray">
                <!-- Todo: 用户消息中的文件附件（图片或普通文件） -->

                <!-- 用户消息文本内容 -->
                <MarkdownRender v-if="displayText" :content="displayText"/>
              </template>

              <!-- 纯文本格式（普通用户消息） -->
              <MarkdownRender v-else-if="message.content" :content="message.content"/>
            </template>
            <!-- ======================== [用户消息]<<< ======================== -->


            <!-- ======================== >>>[AI 消息] ======================== -->
            <!-- 当没有解析的思考内容时，直接渲染助手回复内容 -->
            <MarkdownRender
              v-if="message.role === Message.ROLE.Assistant && message.content && !parsedThinking.body"
              :content="message.content"
              :heading-id-prefix="effectiveHeadingIdPrefix"
              style="border: 1px dashed red"
            />
            <!-- ======================== [AI 消息]<<< ======================== -->


            <!-- ======================== >>>[系统消息] ======================== -->
            <MarkdownRender v-if="message.role === Message.ROLE.System && isCommandMessage" :content="message.content"/>
            <!-- ======================== [系统消息]<<< ======================== -->


            <!-- ======================== >>>[命令消息] ======================== -->
            <!-- 状态命令：显示键值对 -->
            <div v-if="isStatusCommand" class="command-result command-status">
              <div class="command-result-icon">/</div>
              <div class="command-result-grid">
                <span v-for="item of statusItems" :key="item.key" class="command-status-item">
                  <span class="command-status-key">{{ item.key }}</span>
                  <span class="command-status-value">{{ item.value }}</span>
                </span>
              </div>
            </div>

            <!-- 普通命令：显示命令执行结果 -->
            <div v-else-if="isCommandMessage && message.content" class="command-result">
              <span class="command-result-icon">/</span>
              <MarkdownRender :content="message.content" />
            </div>
            <!-- ======================== [命令消息]<<< ======================== -->


            <!-- ======================== >>>[流式传输指示器] ======================== -->
            <span v-if="message.isStreaming && !message.content" class="streaming-dots">
              <span></span><span></span><span></span>
            </span>
            <!-- ======================== [流式传输指示器]<<< ======================== -->

          </div>
          <!-- ============================ [消息气泡]<<< ============================ -->


          <!-- ============================ >>>[消息操作栏（复制/时间）] ============================ -->
          <div class="msg-meta">
            <n-button v-if="copyableContent" quaternary size="tiny" title="复制消息" @click="handleCopyMessage">
              <template #icon>
                <n-icon><CopyOutline/></n-icon>
              </template>
            </n-button>
            <time class="msg-time" :title="formatTime(message.timestamp)">{{ formatTime(message.timestamp, {time: true}) }}</time>
          </div>
          <!-- ============================ [消息操作栏（复制/时间）]<<< ============================ -->

        </div>
      </div>
    </template>
    <!-- ================================ [消息（用户/助手/系统/命令）]<<< ================================ -->
  </div>

  <!-- ================================ Todo: [图片预览弹窗] ================================ -->
</template>

<style scoped lang="less">
@import "style";
</style>
