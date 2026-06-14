import type { AppRouteRecordRaw } from '@/router/types'

import { LAYOUT } from '@/router/constant'

const SYSTEM_ROUTE_NAME = 'System'

const SYSTEM_ROUTE: AppRouteRecordRaw = {
  path: '/system',
  name: SYSTEM_ROUTE_NAME,
  component: LAYOUT,
  redirect: '/system/profiles',
  meta: {
    title: '系统',
    localIcon: 'menu-settings'
  },
  children: [
    {
      path: 'profiles',
      name: SYSTEM_ROUTE_NAME + '.Profiles',
      component: () => import('@/views/system/ProfilesView.vue'),
      meta: {
        title: '用户',
        localIcon: 'menu-profiles'
      }
    },
    {
      path: 'settings',
      name: SYSTEM_ROUTE_NAME + '.Settings',
      component: () => import('@/views/system/SettingsView.vue'),
      meta: {
        title: '设置',
        localIcon: 'menu-settings'
      }
    }
  ]
}

export default SYSTEM_ROUTE
