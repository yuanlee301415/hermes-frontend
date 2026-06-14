import type { AppRouteRecordRaw } from '@/router/types'

import { LAYOUT } from '@/router/constant'

const TEST_ROUTE_NAME = 'Test'

const TEST_ROUTE: AppRouteRecordRaw = {
  path: '/test',
  name: TEST_ROUTE_NAME,
  component: LAYOUT,
  redirect: '/test/a',
  children: [
    {
      path: 'a',
      name: TEST_ROUTE_NAME + '.A',
      component: () => import('@/views/test/A.vue'),
      meta: {
        title: 'TestA',
      },
    },
    {
      path: 'b',
      name: TEST_ROUTE_NAME + '.B',
      component: () => import('@/views/test/B.vue'),
      meta: {
        title: 'TestB',
      },
    },
  ],
}

export default TEST_ROUTE
