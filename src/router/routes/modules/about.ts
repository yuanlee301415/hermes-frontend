import type { AppRouteRecordRaw } from '@/router/types'

import { LAYOUT } from '@/router/constant'

const ABOUT_ROUTE_NAME = 'About'
const ABOUT_ROUTE: AppRouteRecordRaw = {
  path: '/about',
  name: ABOUT_ROUTE_NAME,
  redirect: '/about',
  component: LAYOUT,
  meta: {
    title: '关于',
  },
  children: [
    {
      path: '',
      name: ABOUT_ROUTE_NAME + '.About',
      component: () => import('@/views/About.vue'),
    },
  ],
}

export default ABOUT_ROUTE
