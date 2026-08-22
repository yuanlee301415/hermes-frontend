/**
 * 将用毫秒表示时长，格式化为多少分钟、秒
 * @param ms 毫秒数
 * @returns 格式化后的时间字符串
 */
export function formatDurationMs(ms: number): string {
  if (ms == undefined) return ''
  const s = Math.floor(ms / 1000);
  // 小于 60 秒，直接显示秒数
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  // 大于等于 60 秒，显示分钟数，若有余数则同时显示秒数
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}

/**
 * 将用秒表示的时长，格式化为多少分钟、秒、毫秒
 * @param seconds - 执行时长（秒）
 * @returns 格式化后的时间字符串
 */
export function formatToolDurationSeconds(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`
  if (seconds < 60) return `${Math.round(seconds * 10) / 10}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}m ${secs}s`
}
