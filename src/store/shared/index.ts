import type { AppRouteRecordRaw } from '@/router/types'
import { Menu } from '@/models/Menu.ts'

/**
 * 生成菜单数据
 */
export function genMenus(routes: AppRouteRecordRaw[], path = '', result: Menu[] = []) {
  for (const route of routes) {
    // 没有 `title` 的路由，不添加到菜单中
    if (!route?.meta?.title) continue

    const menu = new Menu({
      path: path ? path + '/' + route.path : route.path,
      name: route.name!,
      localIcon: route.meta.localIcon,
      title: route.meta.title,
    })

    result.push(menu)

    if (!route.children?.length) continue

    const children = genMenus(route.children, menu.path)
    if (children?.length) {
      menu.children = children
    }
  }

  return result
}


/**
 * 尽力获取 localStorage 项（自动处理异常）
 * @param key 存储键名
 * @returns 存储值或 null
 */
export function getItemBestEffort(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * 删除 localStorage 项（自动处理异常）
 * @param key 存储键名
 */
export function removeItem(key: string) {
  try {
    localStorage.removeItem(key)
  } catch (e) {
    console.error('removeItem:', key, e)
  }
}

/** 判断错误是否为 localStorage 配额超限错误 */
export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return  false
  const e = (error as {name?: string, code?: number})
  return e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014
}


/** 判断工具负载是否有实际值（非空、非 undefined、非空字符串） */
export function hasRuntimeToolPayload(value: unknown): boolean {
  return !!(value ?? '')
}

/** 将工具负载转换为 undefined（如果为空）或原值 */
export function runtimeToolPayloadOrUndefined(value: unknown): unknown | undefined {
  return hasRuntimeToolPayload(value) ? value : undefined
}

/**
 * 将工具负载转换为字符串表示
 *
 * 处理逻辑：
 * 1. 空值 -> 空字符串
 * 2. 字符串 -> 直接返回
 * 3. 对象 -> JSON 序列化
 * 4. 其他 -> 转为字符串
 */
export function runtimePayloadText(value: unknown): string {
  if (!hasRuntimeToolPayload(value)) return  ''
  if (typeof value === 'string') return value
  try {
    const serialized = JSON.stringify(value)
    if (serialized !== undefined) return serialized
  } catch {}
  return String(value)
}

/**
 * 从对象中读取 finish_reason（支持 camelCase 和 snake_case 两种格式）
 * @returns finish_reason 值或 undefined
 */
export function readFinishReason(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  if (Object.hasOwn(record, 'finishReason')) {
    return (record as {finishReason?: string}).finishReason
  }
  if (Object.hasOwn(record, 'finish_reason')) {
    return (record as {finish_reason?: string}).finish_reason
  }
  return undefined
}

/**
 * 从对象中读取 run_marker（支持 camelCase 和 snake_case 两种格式）
 * @returns run_marker 值或 undefined
 */
export function readRunMarker(value: unknown): string | null | undefined {
  if (!value || typeof value !== 'object') return  undefined
  const record = value as Record<string, unknown>
  if (Object.hasOwn(record, 'runMarker')) {
    return (record as {runMarker?: string | null}).runMarker
  }
  if (Object.hasOwn(record, 'run_marker')) {
    return (record as {run_marker?: string | null}).run_marker
  }
  return undefined
}

