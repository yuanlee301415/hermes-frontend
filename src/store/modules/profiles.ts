import { defineStore } from 'pinia'
import { Profile } from '@/models/Profile.ts'

import { getProfilesApi } from '@/api/profiles.ts'

const ACTIVE_PROFILE_STORAGE_KEY = 'hermes_active_profile_name'

export const useProfilesStore = defineStore('profilesStore', () => {
  const profiles = ref<Profile[]>([])
  const activeProfileName = ref<string | null>(localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY))
  const activeProfile = ref<Profile | null>(null)
  const loading = ref(false)

  async function fetchProfiles() {
    loading.value = true
    try {
      const storedName = activeProfileName.value || localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY)
      let selected: Profile | null = null

      profiles.value = await getProfilesApi()
      selected = profiles.value.find(_ => _.name === storedName) ?? null

      if (!selected && profiles.value.length > 0) {
        selected = profiles.value[0]
        activeProfileName.value = selected.name
        localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, selected.name)
      }

      activeProfile.value = selected
      profiles.value = profiles.value.map(_ => ({
        ..._,
        active: !!selected && _.name === selected.name
      }))

      if (!selected) {
        activeProfileName.value = null
        localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY)
      }
    } catch (e) {
      console.error('[fetchProfiles]::\n', e)
    } finally {
      console.log('fetchProfiles:', {
        profiles,
        activeProfile,
        activeProfileName,
      })
      loading.value = false
    }
  }

  return {
    fetchProfiles,
    profiles,
    activeProfile,
    activeProfileName,
  }
})
