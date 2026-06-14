import type { AppRouteRecordRaw } from '@/router/types'

import { LAYOUT } from '@/router/constant'

const MONITOR_ROUTE_NAME = 'Monitor'

const MONITOR_ROUTE: AppRouteRecordRaw = {
  path: '/monitor',
  name: MONITOR_ROUTE_NAME,
  component: LAYOUT,
  redirect: '/monitor/logs',
  meta: {
    title: '监控',
    localIcon: 'menu-performance',
  },
  children: [
    {
      path: 'logs',
      name: MONITOR_ROUTE_NAME + '.Logs',
      component: () => import('@/views/monitor/LogsView.vue'),
      meta: {
        title: '日志',
        localIcon: 'menu-logs',
      },
    },
    {
      path: 'usage',
      name: MONITOR_ROUTE_NAME + '.Usage',
      component: () => import('@/views/monitor/UsageView.vue'),
      meta: {
        title: '用量',
        localIcon: 'menu-usage',
      },
    },
    {
      path: 'performance',
      name: MONITOR_ROUTE_NAME + '.Performance',
      component: () => import('@/views/monitor/PerformanceView.vue'),
      meta: {
        title: '性能监控',
        localIcon: 'menu-performance',
      },
    },
    {
      path: 'skills-usage',
      name: MONITOR_ROUTE_NAME + '.SkillsUsage',
      component: () => import('@/views/monitor/SkillsUsageView.vue'),
      meta: {
        title: '技能用量',
        localIcon: 'menu-skills-usage',
      },
    },
  ],
}

export default MONITOR_ROUTE
