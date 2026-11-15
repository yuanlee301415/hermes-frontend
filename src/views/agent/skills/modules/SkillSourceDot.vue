<!--
圆点 Icon
-->
<script setup lang="ts">
import { type SourceFilter, SourceFilters } from '../index.ts'

defineProps<{
  source: SourceFilter | undefined
}>()

const DotColor = {
  [SourceFilters.Builtin]: '#888',
  [SourceFilters.Hub]: '#4a90d9',
  [SourceFilters.Local]: '#66bb6a',
  [SourceFilters.External]: '#f59e0b',
  modified: 'var(--warning)'
}
</script>

<template>
  <n-icon v-if="source && DotColor[source]" :color="DotColor[source]">
    <SvgIcon icon="dot" />
  </n-icon>
</template>
