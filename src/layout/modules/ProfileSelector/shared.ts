// 桥接状态映射
export function bridgeStatusText(running?: boolean) {
  if (running == null) return '检测中'
  return running ? '运行中' : '空闲'
}

// 运行状态映射
export function gatewayStatusText(running?: boolean) {
  if (running == null) return '检测中'
  return running ? '运行中' : '已停止'
}

// 随机生成用户头像种子
export function randomSeed() {
  return `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
