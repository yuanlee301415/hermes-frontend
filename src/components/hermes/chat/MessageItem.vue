<script setup lang="ts">
import { Message } from '@/models/Session.ts'
import ProfileAvatar from '@/components/hermes/profiles/ProfileAvatar.vue'
import MarkdownRender from './MarkdownRender.vue'
import { parseThinking } from '@/utils/thinking-parser.ts'
import { parseContentBlocks, getBlockText } from './shared.ts'

const props = defineProps<{message: Message, highlight?: boolean, headingIdPrefix?: string}>()

// ========== 内容块解析计算属性 ==========
// 从消息内容字符串中解析 ContentBlock[] 数组
// 如果消息内容是标准 JSON 或遗留 Python 格式，返回解析后的数组；否则返回 null
const contentBlocks = computed(() => parseContentBlocks(props.message.content ?? ''))

// 判断消息内容是否为 ContentBlock[] 格式（多模态格式）
// 用于区分普通文本消息和多模态消息（包含图片、文件等）
const isContentBlockArray = computed(() => contentBlocks.value !== null)

// 从 ContentBlock[] 中提取纯文本内容用于显示
// 对于普通文本消息，直接返回原始内容；对于多模态消息，提取所有文本块并拼接
const displayText = computed(() => {
  // 如果不是 ContentBlock[] 格式（普通文本消息），直接返回原始内容
  if (!isContentBlockArray.value) {
    return props.message.content ?? ''
  }

  // 遍历所有内容块，提取文本并拼接
  return contentBlocks.value!.map(block => getBlockText(block)).filter(Boolean).join('\n')
})

// ========== 消息类型判断计算属性 ==========
// 有效标题 ID 前缀：优先使用传入的 headingIdPrefix，否则使用消息 ID 作为前缀
// 用于 Markdown 渲染时为标题生成唯一 ID，支持锚点跳转
const effectiveHeadingIdPrefix = computed(() => props.headingIdPrefix ?? `msg-${props.message.id}`)


// ========== 思考内容（Reasoning）相关 ==========
// 解析消息内容中的思考文本（<think> 标签）
// 支持流式传输模式：当 isStreaming 为 true 时，允许未闭合的 <think> 标签
const parsedThinking = computed(() => parseThinking(props.message.content ?? '', { streaming: !!props.message.isStreaming }))

// 判断消息是否包含思考内容（reasoning 字段或 <think> 标签任一存在即可）
const hasThinking = computed(() => props.message.hasReasoningField || parsedThinking.value.hasThinking)

</script>

<template>
  <div class="message" :class="[message.role, {highlight}]" :id="`message-${message.id}`">
    <!-- ================================ >>>[工具] ================================ -->
    <div v-if="message.role === Message.ROLE_TOOL" class="msg-tool">
      <div class="tool-line"></div>
      <div class="tool-details"></div>
    </div>
    <!-- ================================ [工具]<<< ================================ -->

    <!-- ================================ >>>[消息] ================================ -->
    <template v-else>
      <div class="msg-body">
        <ProfileAvatar v-if="message.role === Message.ROLE_ASSISTANT" class="msg-avatar"/>

        <div class="msg-content" :class="message.role">
          <!-- ============================ >>>[消息气泡] ============================ -->
          <div
            class="msg-bubble"
            :class="{
            system: message.role === Message.ROLE_SYSTEM,
            'agent-error': message.isAgentError,
            command: message.isCommandMessage,
            'command-error': message.isCommandError
          }"
          >

            <!-- ======================== >>>[附件] ======================== -->
            <div v-if="message.hasAttachments" class="msg-attachments">
              <pre>msg-attachments</pre>
            </div>
            <!-- ======================== [附件]<<< ======================== -->

            <!-- ======================== >>>[思考内容] ======================== -->
            <div v-if="hasThinking" class="thinking-block">
              <pre>thinking-block</pre>
            </div>

            <MarkdownRender
              v-if="parsedThinking.body && message.role === Message.ROLE_ASSISTANT"
              :content="message.content"
              :heading-id-prefix="headingIdPrefix"
            />
            <!-- ======================== [思考内容]<<< ======================== -->

            <!-- ======================== >>>[用户消息] ======================== -->
            <template v-if="message.role === Message.ROLE_USER">
              <template v-if="isContentBlockArray">
                <!-- 用户消息中的文件附件（图片或普通文件） -->
                <div class="msg-attachments"></div>

                <!-- 用户消息文本内容 -->
                <MarkdownRender v-if="displayText" :content="displayText"/>
              </template>

              <!-- 纯文本格式（普通用户消息） -->
              <MarkdownRender v-else-if="message.content" :content="message.content"/>

            </template>
            <!-- ======================== [用户消息]<<< ======================== -->


            <!-- ======================== >>>[AI 消息] ======================== -->
            <template v-if="message.role === Message.ROLE_ASSISTANT">
              <MarkdownRender
                v-if="message.content && !parsedThinking.body"
                :content="message.content"
                :heading-id-prefix="effectiveHeadingIdPrefix"
              />
            </template>
            <!-- ======================== [AI 消息]<<< ======================== -->


            <!-- ======================== >>>[系统消息] ======================== -->
            <template v-if="message.role === Message.ROLE_SYSTEM">
              <MarkdownRender v-if="message.isCommandMessage" :content="message.content"/>
            </template>
            <!-- ======================== [系统消息]<<< ======================== -->


            <!-- ======================== >>>[命令消息] ======================== -->
            <!-- 状态命令：显示键值对 -->
            <div v-if="message.isStatusCommand" class="command-result command-status">
              <pre>command-status</pre>
            </div>

            <!-- 普通命令：显示命令执行结果 -->
            <div v-if="message.isCommandMessage" class="command-result">
              <pre>command-result</pre>
            </div>
            <!-- ======================== [命令消息]<<< ======================== -->

            <!-- ======================== >>>[流式传输指示器] ======================== -->
            <span v-if="message.isStreaming && !message.content" class="streaming-dots"></span>
            <!-- ======================== [流式传输指示器]<<< ======================== -->

          </div>
          <!-- ============================ [消息气泡]<<< ============================ -->

          <!-- ============================ >>>[消息操作栏（语音播放/复制/时间）] ============================ -->
          <div class="msg-meta"></div>
          <!-- ============================ [消息操作栏（语音播放/复制/时间）]<<< ============================ -->

        </div>
      </div>
    </template>
    <!-- ================================ [消息]<<< ================================ -->
  </div>


  <!-- ================================ >>>[图片预览弹窗] ================================ -->
  <teleport to="body">
    <div class="image-preview-overlay"></div>
  </teleport>
  <!-- ================================ [图片预览弹窗]<<< ================================ -->
</template>

<style scoped lang="less">
@import "message-item";
</style>
