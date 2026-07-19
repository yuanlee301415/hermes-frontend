<script setup lang="ts">

</script>

<template>
  <n-avatar class="profile-avatar" :size="40" round>
    <n-icon>
      <SvgIcon icon="Profile" />
    </n-icon>
  </n-avatar>
</template>

<style scoped lang="less">
.profile-avatar {
  display: inline-flex;
  flex: 0 0 auto;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--bg-secondary);
}
</style>
