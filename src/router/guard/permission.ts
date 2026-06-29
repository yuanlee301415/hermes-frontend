import type { Router } from 'vue-router'
import { hasApiKey } from '@/api/request.ts'
import { LOGIN_ROUTE_NAME } from '../constant.ts'
import { CHAT_ROUTE_NAME } from '@/router/routes/modules/chat.ts'

export function createPermissionGuard(router: Router) {
  router.beforeEach(async (to) => {
    if (to.meta.public) {
      if (to.name === LOGIN_ROUTE_NAME && hasApiKey()) {
        return { name: CHAT_ROUTE_NAME}
      }
      return true
    }

    if (!hasApiKey()) {
      return { name: LOGIN_ROUTE_NAME }
    }

    return true
  })
}
