import type { AppRouteRecordRaw } from '@/router/types'

import { LAYOUT, CHAT_ROUTE_NAME } from '@/router/constant'

const CHAT_ROUTE: AppRouteRecordRaw = {
  path: '/chat',
  name: CHAT_ROUTE_NAME,
  component: LAYOUT,
  redirect: '/chat/chat',
  meta: {
    title: '对话',
    localIcon: 'menu-chat'

  },
  children: [
    {
      path: 'chat',
      name: CHAT_ROUTE_NAME + '.Chat',
      component: () => import('@/views/chat/ChatView.vue'),
      meta: {
        title: '对话',
        localIcon: 'menu-chat'
      }
    },
    {
      path: 'history',
      name: CHAT_ROUTE_NAME + '.History',
      component: () => import('@/views/chat/HistoryView.vue'),
      meta: {
        title: '历史',
        localIcon: 'menu-history'
      }
    },
    {
      path: 'group-chat',
      name: CHAT_ROUTE_NAME + '.GroupChat',
      component: () => import('@/views/chat/GroupView.vue'),
      meta: {
        title: '群聊(beta)',
        localIcon: 'menu-group-chat'
      }
    },
    {
      path: 'search',
      name: CHAT_ROUTE_NAME + '.Search',
      meta: {
        title: '搜索',
        localIcon: 'menu-search'
      }
    },
    {
      path: 'api-relay',
      name: CHAT_ROUTE_NAME + '.ApiRelay',
      meta: {
        title: '中转站',
        localIcon: 'menu-api-relay'
      }
    }
  ]
}

export default CHAT_ROUTE
