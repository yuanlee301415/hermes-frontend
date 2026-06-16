import { request } from './request.ts'

export async function loginWithPassword(username: string, password: string): Promise<{ token: string }> {
  return request('api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  })
}
