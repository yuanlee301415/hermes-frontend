import type { AppRouteRecordRaw } from '@/router/types'

import { LAYOUT, HOME_ROUTE_NAME, PAGE_NOT_FOUND_NAME, EXCEPTION_404 } from '@/router/constant'

export const HOME_ROUTE: AppRouteRecordRaw = {
  path: '/',
  name: HOME_ROUTE_NAME,
  redirect: '/chat',
}

export const PAGE_NOT_FOUND_ROUTE: AppRouteRecordRaw = {
  path: '/:path(.*)*',
  name: PAGE_NOT_FOUND_NAME,
  component: LAYOUT,
  children: [
    {
      path: '',
      name: PAGE_NOT_FOUND_NAME + 'Page',
      component: EXCEPTION_404,
    },
  ],
}
