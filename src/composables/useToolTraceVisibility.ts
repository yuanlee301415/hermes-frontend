/*
* 工具追踪可见性
* */
const STORAGE_KEY = 'hermes_show_tool_calls'
const toolTraceVisible = ref(readInitialValue())

function readInitialValue(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

function setToolTraceVisible(value: boolean) {
  toolTraceVisible.value = value
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch {

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
