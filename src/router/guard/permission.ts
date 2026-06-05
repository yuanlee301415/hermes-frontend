import type { Router } from 'vue-router'

import { useUserStoreWithOut } from '@/store/modules/user'

export function createPermissionGuard(router: Router) {
  const userStore = useUserStoreWithOut()
  router.beforeEach(async () => {
    if (!userStore.info) {
      await userStore.getUserInfo()
    }
    return true
  })
}
