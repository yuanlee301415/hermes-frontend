const DEFAULT_BASE_URL = './'
const API_KEY = 'hermes-api-key'

function getBaseUrl() {
  return DEFAULT_BASE_URL
}

export function getBaseUrlValue(): string {
  return getBaseUrl()
}


export function setApiKey(key: string) {
  localStorage.setItem(API_KEY, key)
}

export function getApiKey(): string {
  return localStorage.getItem(API_KEY) ?? ''
}

export function hasApiKey() {
  return !!getApiKey()
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${DEFAULT_BASE_URL}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  const apiKey = getApiKey()
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }
  const res = await fetch(url, { ...options, headers })
  if (!res.ok) {
    console.error(res)
    const text = await res.text().catch(() => '')
    throw new Error(`API Error ${res.status}:${text} (${res.statusText})`)
  }
  return res.json()
}
