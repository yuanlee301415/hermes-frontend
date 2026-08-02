/**
 * 格式化 token 数量显示
 * 大于 1M 显示为 x.xM，大于 1k 显示为 x.xk，否则显示原始数字
 */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}
