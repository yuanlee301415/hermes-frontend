import type { AppRouteRecordRaw } from '@/router/types'

import { LAYOUT } from '@/router/constant'

const TOOL_ROUTE_NAME = 'Tool'

const TOOL_ROUTE: AppRouteRecordRaw = {
  path: '/tool',
  name: TOOL_ROUTE_NAME,
  component: LAYOUT,
  redirect: '/tool/coding-agents',
  meta: {
    title: '工具',
    localIcon: 'menu-coding-agents',
  },
  children: [
    {
      path: 'coding-agents',
      name: TOOL_ROUTE_NAME + '.CodingAgents',
      component: () => import('@/views/tool/CodingAgentsView.vue'),
      meta: {
        title: '编程工具',
        localIcon: 'menu-coding-agents',
      },
    },
    {
      path: 'version-preview',
      name: TOOL_ROUTE_NAME + '.VersionPreview',
      component: () => import('@/views/tool/VersionPreviewView.vue'),
      meta: {
        title: '版本预览',
        localIcon: 'menu-version-preview',
      },
    },
  ],
}

export default TOOL_ROUTE
