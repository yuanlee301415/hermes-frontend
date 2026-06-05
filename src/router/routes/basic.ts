import type { AppRouteRecordRaw } from '@/router/types'

import { PAGE_NOT_FOUND_NAME, LAYOUT, EXCEPTION_404 } from '@/router/constant'

export const ROOT_ROUTE: AppRouteRecordRaw = {
  path: '/',
  name: 'Root',
  redirect: '/home',
  meta: {
    title: 'Root',
    hiddenMenu: true,
  },
}

export const HOME_ROUTE: AppRouteRecordRaw = {
  path: '/home',
  name: 'Home',
  redirect: '/home',
  component: LAYOUT,
  meta: {
    title: '首页',
    hiddenChildrenInMenu: true,
  },
  children: [
    {
      path: '',
      name: 'HomePage',
      component: () => import('@/views/Home.vue'),
      meta: {},
    },
  ],
}

export const PAGE_NOT_FOUND_ROUTE: AppRouteRecordRaw = {
  path: '/:path(.*)*',
  name: PAGE_NOT_FOUND_NAME,
  component: LAYOUT,
  meta: {
    title: PAGE_NOT_FOUND_NAME,
    hiddenMenu: true,
    hiddenChildrenInMenu: true,
  },
  children: [
    {
      path: '',
      name: PAGE_NOT_FOUND_NAME + 'Page',
      component: EXCEPTION_404,
      meta: {},
    },
  ],
}
