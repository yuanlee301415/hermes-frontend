<script setup lang="ts">
import { Message } from '@/models/Session.ts'
import ProfileAvatar from '@/components/hermes/profiles/ProfileAvatar.vue'
import MarkdownRender from './MarkdownRender.vue'

const props = defineProps<{message: Message, highlight?: boolean}>()

onMounted(() => {
  console.log(props.message)
})
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
          <div class="msg-bubble">

            <!-- ======================== >>>[附件] ======================== -->
            <div class="msg-attachments"></div>
            <!-- ======================== [附件]<<< ======================== -->

            <!-- ======================== >>>[思考内容] ======================== -->
            <div class="thinking-block"></div>

            <!-- 解析后的思考内容（直接显示） -->
            <!-- 当思考内容在助手消息中且不需要单独展开时，直接渲染 -->
            <MarkdownRender/>
            <!-- ======================== [思考内容]<<< ======================== -->

            <!-- ======================== >>>[用户消息] ======================== -->
            <template v-if="message.role === Message.ROLE_USER">
              <MarkdownRender :content="message.content"/>
            </template>
            <!-- ======================== [用户消息]<<< ======================== -->

            <!-- ======================== >>>[AI 消息] ======================== -->
            <template v-if="message.role === Message.ROLE_ASSISTANT">
              <MarkdownRender :content="message.content"/>
            </template>
            <!-- ======================== [AI 消息]<<< ======================== -->


            <!-- ======================== >>>[系统消息] ======================== -->
            <MarkdownRender v-if="message.role === Message.ROLE_SYSTEM"></MarkdownRender>
            <!-- ======================== [系统消息]<<< ======================== -->

            <!-- ======================== >>>[命令消息] ======================== -->
            <!-- 状态命令：显示键值对 -->
            <div class="command-result command-status"></div>

            <!-- 普通命令：显示命令执行结果 -->
            <div class="command-result"></div>
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
