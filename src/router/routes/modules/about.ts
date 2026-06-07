import type { AppRouteRecordRaw } from '@/router/types'

import { LAYOUT } from '@/router/constant'

const ABOUT_ROUTE: AppRouteRecordRaw = {
  path: '/about',
  name: 'About',
  redirect: '/about',
  component: LAYOUT,
  meta: {
    title: '关于'
  },
  children: [
    {
      path: '',
      name: 'AboutPage',
      component: () => import('@/views/About.vue')
    },
  ],
}

export default ABOUT_ROUTE
