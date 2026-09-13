import { defineStore } from 'pinia'
import { useProfilesStore } from '@/store/modules/profiles.ts'
import { DEFAULT_PROFILE_NAME } from '@/constants/hardcoded.ts'
import { PIN_KEY_PREFIX } from '@/constants/storage-keys.ts'
import { loadJson, saveJson} from '@/store/shared/storage.ts'
import type { Session } from '@/models/Session.ts'

function pinKeys(profileName: string) {
  return `${PIN_KEY_PREFIX}${profileName}`
}

export const useSessionPrefsStore = defineStore('sessionPrefsStore', () => {
  const profileStore = useProfilesStore()
  const profileName = ref(profileStore.activeProfileName ?? DEFAULT_PROFILE_NAME)
  const pinnedIds = ref<string[]>(loadJson<string[]>(pinKeys(profileName.value), []))

  /**
   * 是否已置顶
   * @param sid
   */
  function isPinned(sid: Session['id']): boolean {
    return pinnedIds.value.includes(sid)
  }

  /**
   * 本地存储已置顶的会话 ID
   */
  function persistPins() {
    saveJson(pinKeys(profileName.value), pinnedIds.value)
  }

  /**
   * 置顶/取消置顶
   * @param sid 会话 ID
   */
  function togglePinned(sid: Session['id']) {
    if (isPinned(sid)) {
      pinnedIds.value = pinnedIds.value.filter(id => id !== sid)
    } else {
      pinnedIds.value = [...pinnedIds.value, sid]
    }
    persistPins()
  }

  return {
    isPinned,
    togglePinned
  }
})
