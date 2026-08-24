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

/**
 * 格式化时间
 * @param timestamp 时间戳（毫秒）
 * @param opts 配置
 * @param opts.date 只返回日期部分
 * @param opts.time 只返回时间部分
 * @return 日期部分 | 时间部分 | 日期+时间
 */
export function formatTime(timestamp: number, opts?: {date?: boolean, time?: boolean}): string {
  const _ = new Date(timestamp)
  if (!_.getTime()) return ''
  if (opts?.date) return _.toLocaleDateString('default', {year: 'numeric', month: 'numeric', day: 'numeric'})
  else if (opts?.time) return _.toLocaleTimeString('default', {hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return _.toLocaleString('default')
}

/**
 * 格式化 token 数量显示
 * 大于 1M 显示为 x.xM，大于 1k 显示为 x.xk，否则显示原始数字
 */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}
