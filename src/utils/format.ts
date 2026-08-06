/**
 * 将毫秒数格式化为人类可读的时间字符串
 * 支持格式：
 * - 小于 60 秒：Xs（如 5s）
 * - 大于等于 60 秒：Xm（如 2m）或 Xm Ys（如 2m 30s）
 * @param ms 毫秒数
 * @returns 格式化后的时间字符串
 */
export function formatDuration(ms: number): string {
  if (ms == undefined) return ''
  const s = Math.floor(ms / 1000);
  // 小于 60 秒，直接显示秒数
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  // 大于等于 60 秒，显示分钟数，若有余数则同时显示秒数
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}
