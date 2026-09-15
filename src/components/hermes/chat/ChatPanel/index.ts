import { Session } from '@/models/Session.ts'

/**
 * 将会话按更新时间降序排序（最新的在前）
 * @param items 会话数组
 * @returns 排序后的会话数组
 */
export function sortSessionsWithActiveFirst(items: Session[]): Session[] {
  return [...items].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}
