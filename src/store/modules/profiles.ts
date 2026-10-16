import { defineStore } from 'pinia'
import { Profile, ProfileAvatar } from '@/models/Profile.ts'
import { ACTIVE_PROFILE_NAME_KEY } from '@/constants/storage-keys.ts'
import { type HermesProfileDetail, getProfilesApi, updateProfileAvatarApi, deleteProfileAvatar, switchHermesProfile } from '@/api/profiles.ts'
import { setItemBestEffort } from '@/utils/storage.ts'

export const useProfilesStore = defineStore('profilesStore', () => {
  const profiles = ref<Profile[]>([])
  const activeProfileName = ref<string | undefined>(localStorage.getItem(ACTIVE_PROFILE_NAME_KEY) ?? undefined)
  const activeProfile = ref<Profile | null>(null)
  const loading = ref(false)
  const detailMap = ref<Record<string, HermesProfileDetail>>({})

  // 获取用户配置列表
  async function fetchProfiles() {
    loading.value = true
    try {
      const storedName = activeProfileName.value || localStorage.getItem(ACTIVE_PROFILE_NAME_KEY)
      let selected: Profile | null = null

      profiles.value = await getProfilesApi()
      selected = profiles.value.find(_ => _.name === storedName) ?? null

      if (!selected && profiles.value.length > 0) {
        selected = profiles.value[0]
        activeProfileName.value = selected.name
        localStorage.setItem(ACTIVE_PROFILE_NAME_KEY, selected.name)
      }

      activeProfile.value = selected
      profiles.value = profiles.value.map(_ => ({
        ..._,
        active: !!selected && _.name === selected.name
      }))

      if (!selected) {
        activeProfileName.value = undefined
        localStorage.removeItem(ACTIVE_PROFILE_NAME_KEY)
      }
    } catch (e) {
      console.error('[fetchProfiles]::\n', e)
    } finally {
      loading.value = false
    }
  }

  // 更新用户头像
  async function updateAvatar(name: Profile['name'], avatar: ProfileAvatar) {
    const res = await updateProfileAvatarApi(name, avatar)
    profiles.value = profiles.value.map(profile => profile.name === name ? {...profile, avatar: res} : profile)
    if (detailMap.value[name]) {
      detailMap.value[name] = { ...detailMap.value[name], avatar: res }
    }
    if (activeProfile.value?.name === name) {
      activeProfile.value = { ...activeProfile.value, avatar: res }
    }
    return res
  }

  // 删除用户头像
  async function deleteAvatar(name: Profile['name']) {
    await deleteProfileAvatar(name)
    profiles.value = profiles.value.map(profile => profile.name === name ? {...profile, avatar: undefined} : profile)
    if (detailMap.value[name]) {
      detailMap.value[name] = { ...detailMap.value[name], avatar: undefined }
    }
    if (activeProfile.value?.name === name) {
      activeProfile.value = { ...activeProfile.value, avatar: undefined }
    }
  }

  // 切换前端配置
  async function switchProfile(name: Profile['name']) {
    try {
      const ok = await switchHermesProfile(name)
      setItemBestEffort(ACTIVE_PROFILE_NAME_KEY, name)
      return ok
    } catch (e) {
      console.error(e)
    }
  }

  return {
    profiles,
    activeProfile,
    activeProfileName,
    loading,

    fetchProfiles,
    updateAvatar,
    deleteAvatar,
    switchProfile
  }
})
