<template>
  <header class="header">
    <div class="header-left">
      <div class="logo" @click="$router.push('/')">
        <img src="../../../assets/logo.svg" alt="Logo" width="32" height="32" />
        <h2>{{ VITE_APP_TITLE }}</h2>
      </div>
    </div>
    <div v-if="info" class="header-right">
      <span>{{ info.name }}</span>
      <span v-if="info.roles">[{{ info.roles[0] }}]</span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUserStore } from '@/store/modules/user'

defineOptions({ name: 'LayoutHeader' })

const VITE_APP_TITLE = import.meta.env.VITE_APP_TITLE
const userStore = useUserStore()
const info = computed(() => userStore.info)
</script>

<style scoped lang="less">
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  line-height: 48px;
  padding: 0 10px;
  .header-left {
    .logo {
      display: flex;
      align-items: center;
      height: 48px;
      padding: 10px 0 10px 10px;
      cursor: pointer;
      h2 {
        font-weight: 700;
        color: var(--color-heading);
        font-size: 16px;
        line-height: normal;
        margin-left: 0.5rem;
      }
    }
  }
}
</style>
