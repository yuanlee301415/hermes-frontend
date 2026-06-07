<script lang="ts" setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { darkTheme, useOsTheme, zhCN, dateZhCN } from 'naive-ui'
import { getThemeOverrides } from '@/styles/theme.ts'

const osTheme = useOsTheme()
const naiveTheme = computed(() => (osTheme.value === 'dark' ? darkTheme : null))
const themeOverrides = computed(() => getThemeOverrides(osTheme.value === 'dark'))

onMounted(() => {
  const leftStyle = 'background-color:#2f353a;color:#fff;padding:0 5px;line-height:1.2rem;border-radius:0.2rem 0 0 0.2rem;'
  const rightStyle = 'background-color:#17a2b8;color:#fff;padding:0 5px;line-height:1.2rem;border-radius:0 0.2rem 0.2rem 0;'
  console.log(`%c MODE %c ${import.meta.env.MODE}`, leftStyle, rightStyle)
  console.log(`%c VERSION %c ${__APP_VERSION__}`, leftStyle, rightStyle)
  console.log(`%c BUILD_TIME %c ${__APP_BUILD_TIME__}`, leftStyle, rightStyle)
})
</script>

<template>
  <n-config-provider :theme="naiveTheme" :theme-overrides="themeOverrides" :locale="zhCN" :date-locale="dateZhCN" class="h-full">
    <n-notification-provider>
      <RouterView />
    </n-notification-provider>
  </n-config-provider>
</template>

<style scoped></style>
