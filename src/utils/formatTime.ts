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
