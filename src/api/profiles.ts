import { request } from './request.ts'
import { Profile } from '@/models/Profile.ts'


export async function getProfilesApi(): Promise<Profile[]> {
  const res = await request<{profiles: Profile[]}>('api/hermes/profiles', {
    method: 'get'
  })
  return res.profiles
}
