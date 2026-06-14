<!--
语言切换
-->
<script setup lang="ts">
const locale = ref('zh')

const options = [
  { label: '简体中文', value: 'zh' },
  { label: '繁體中文', value: 'zh-TW' },
  { label: 'English', value: 'en' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' },
  { label: 'Français', value: 'fr' },
  { label: 'Español', value: 'es' },
  { label: 'Deutsch', value: 'de' },
  { label: 'Português', value: 'pt' },
  { label: 'Русский', value: 'ru' },
]
</script>

<template>
  <NSelect :value="locale" :options="options" :consistent-menu-width="false" size="tiny" />
</template>
