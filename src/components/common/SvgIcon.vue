<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({ name: 'SvgIcon', inheritAttrs: false })

const props = defineProps<{
  icon: string
  size?: number
}>()

const bindAttrs = useAttrs()

const symbolId = computed(() => {
  const { VITE_ICON_LOCAL_PREFIX: prefix } = import.meta.env
  const icon = props.icon ?? 'no-icon'
  return `#${prefix}-${icon}`
})
</script>

<template>
  <svg aria-hidden="true" :width="size ? size + 'px' : '1em'" :height="size ? size + 'px' : '1em'" v-bind="bindAttrs">
    <use :xlink:href="symbolId" fill="currentColor" />
  </svg>
</template>
