import type { AppRouteRecordRaw } from '@/router/types'

import { LAYOUT } from '@/router/constant'

const PROXY_ROUTE_NAME = 'Proxy'

const PROXY_ROUTE: AppRouteRecordRaw = {
  path: '/proxy',
  name: PROXY_ROUTE_NAME,
  component: LAYOUT,
  redirect: '/proxy/jobs',
  meta: {
    title: '代理',
    localIcon: 'menu-models'
  },
  children: [
    {
      path: 'jobs',
      name: PROXY_ROUTE_NAME + '.Jobs',
      component: () => import('@/views/proxy/JobsView.vue'),
      meta: {
        title: '任务',
        localIcon: 'menu-jobs'
      },
    },
    {
      path: 'kanban',
      name: PROXY_ROUTE_NAME + '.Kanban',
      component: () => import('@/views/proxy/KanbanView.vue'),
      meta: {
        title: '看板',
        localIcon: 'menu-kanban'
      },
    },
    {
      path: 'channels',
      name: PROXY_ROUTE_NAME + '.Channels',
      component: () => import('@/views/proxy/ChannelsView.vue'),
      meta: {
        title: '频道',
        localIcon: 'menu-channels'
      },
    },
    {
      path: 'skills',
      name: PROXY_ROUTE_NAME + '.Skills',
      component: () => import('@/views/proxy/SkillsView.vue'),
      meta: {
        title: '技能',
        localIcon: 'menu-skills'
      },
    },
    {
      path: 'plugins',
      name: PROXY_ROUTE_NAME + '.Plugins',
      component: () => import('@/views/proxy/PluginsView.vue'),
      meta: {
        title: '插件',
        localIcon: 'menu-plugins'
      },
    },
    {
      path: 'mcp',
      name: PROXY_ROUTE_NAME + '.MCP',
      component: () => import('@/views/proxy/McpView.vue'),
      meta: {
        title: 'MCP',
        localIcon: 'menu-mcp'
      },
    },
    {
      path: 'memory',
      name: PROXY_ROUTE_NAME + '.Memory',
      component: () => import('@/views/proxy/MemoryView.vue'),
      meta: {
        title: '记忆',
        localIcon: 'menu-memory'
      },
    },
    {
      path: 'models',
      name: PROXY_ROUTE_NAME + '.Models',
      component: () => import('@/views/proxy/ModelsView.vue'),
      meta: {
        title: '模型',
        localIcon: 'menu-models'
      },
    }
  ],
}

export default PROXY_ROUTE
