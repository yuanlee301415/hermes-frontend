<!--
用户头像
- 显示上传后的图片
- 或根据种子随机生成 SVG
-->
<script setup lang="ts">
import { DEFAULT_PROFILE_NAME } from '@/constants/hardcoded.ts'
import { ProfileAvatar } from '@/models/Profile.ts'
import multiavatar from '@multiavatar/multiavatar'

defineOptions({ name: 'ProfileAvatar' })

const props = withDefaults(defineProps<{
  name: string
  avatar?: ProfileAvatar | null
  size?: number
}>(), {
  size: 24
})

const fallbackSeed = computed(() => props.name || DEFAULT_PROFILE_NAME)
const generatedSvg = computed(() => multiavatar(props.avatar?.seed || fallbackSeed.value))
</script>

<template>
  <div class="profile-avatar" :style="`--width: ${size}px;--height: ${size}px;`">
    <img v-if="avatar?.type === 'image' && avatar.dataUrl" :src="avatar.dataUrl" class="profile-avatar-image" alt="">
    <span v-else class="profile-avatar-svg" v-html="generatedSvg"></span>
  </div>
</template>

<style scoped lang="less">
.profile-avatar {
  width: var(--width);
  height: var(--height);
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--bg-secondary);
  .profile-avatar-image, .profile-avatar-svg, .profile-avatar-svg :deep(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }
  .profile-avatar-image {
    object-fit: cover;
  }
}
</style>
