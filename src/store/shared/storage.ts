/*
* 本地存储
* */

import { PIN_KEY_PREFIX } from '@/constants/storage-keys.ts'

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
 * 尽力设置 localStorage 项（自动处理配额超限）
 *
 * 如果设置失败且是配额超限，会尝试清理旧缓存后重试
 * @param key 存储键名
 * @param value 存储值
 */
export function setItemBestEffort(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
    return
  } catch (e) {
    console.error('setItemBestEffort:\n', e)
    if (!isQuotaExceededError(e)) return
  }

  // 配额超限，尝试清理旧缓存
  recoverStorageQuota(key)

  try {
    localStorage.setItem(key, value)
  } catch {}
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

/**
 * 恢复 localStorage 配额
 * - 清理所有已废弃的旧缓存键，释放存储空间
 * @param storageKey 当前使用的键
 */
export function recoverStorageQuota(storageKey: string){
  // 已完全废弃的缓存键前缀列表
  const prefixes = [
    'hermes_sessions_cache_v1_',
    'hermes_session_msgs_v1_',
    PIN_KEY_PREFIX,
    'hermes_human_only_v1_',
  ]
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      // 保留当前使用的键
      if (key === storageKey) continue
      // 删除废弃的键
      if (prefixes.some(prefix => key.startsWith(prefix))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => removeItem(key))
    if (keysToRemove.length > 0) {
      console.log(`Recovered storage: cleared ${keysToRemove.length} old session cache entries`)
    }
  } catch {
    // 忽略错误
  }
}

/**
 * 获取存储的推理强度
 */
export function getStoredReasoningEffort(key: string) {
  try {
    return localStorage.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}

/**
 * 获取本地存储数据
 * @param key 存储 Key
 * @param fallback 缺省数据
 */
export function loadJson<T>(key: string, fallback: T): T {
  const raw = getStoredReasoningEffort(key)
  try {
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

/**
 * 获取本地存储数据
 * @param key 存储 Key
 * @param value 存储 Value
 */
export function saveJson(key: string, value: unknown) {
  try {
    setItemBestEffort(key, JSON.stringify(value))
  } catch (e) {
    console.error('saveJson:\n', e)
  }
}
