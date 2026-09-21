/*
* 工具追踪可见性
* */

import { ref } from 'vue'
import { TOOL_VISIBLE_KEY } from '@/constants/storage-keys.ts'

const toolTraceVisible = ref(readInitialValue())

function readInitialValue() {
  try {
    return localStorage.getItem(TOOL_VISIBLE_KEY) !== 'false'
  } catch (e) {
    console.error(e)
    return true
  }
}

function setToolTraceVisible(value: boolean) {
  toolTraceVisible.value = value
  try {
    localStorage.setItem(TOOL_VISIBLE_KEY, String(value))
  } catch (e) {
    console.error(e)
  }
}

function toggleToolTraceVisible() {
  setToolTraceVisible(!toolTraceVisible.value)
}

export function useToolTraceVisibility() {
  return {
    toolTraceVisible,
    setToolTraceVisible,
    toggleToolTraceVisible
  }
}
