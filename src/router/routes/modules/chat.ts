import type { AppRouteRecordRaw } from '@/router/types'

import { LAYOUT } from '@/router/constant'

const CHAT_ROOT_NAME = 'Chat'

export const CHAT_ROUTE_NAME = CHAT_ROOT_NAME + '.Chat'
export const SESSION_ROUTE_NAME = CHAT_ROOT_NAME + '.Session'
export const CHAT_ROUTE_PATH = '/chat/chat'

const CHAT_ROUTE: AppRouteRecordRaw = {
  path: '/chat',
  name: 'Chat',
  component: LAYOUT,
  redirect: CHAT_ROUTE_PATH,
  meta: {
    title: '对话',
    localIcon: 'menu-chat',
  },
  children: [
    {
      path: 'chat',
      name: CHAT_ROUTE_NAME,
      component: () => import('@/views/chat/ChatView.vue'),
      meta: {
        title: '对话',
        localIcon: 'menu-chat',
      },
    },
    {
      path: 'session/:sessionId',
      name: SESSION_ROUTE_NAME,
      component: () => import('@/views/chat/ChatView.vue'),
      meta: {},
    },
    {
      path: 'history',
      name: CHAT_ROOT_NAME + '.History',
      component: () => import('@/views/chat/HistoryView.vue'),
      meta: {
        title: '历史',
        localIcon: 'menu-history',
      },
    },
    {
      path: 'group-chat',
      name: CHAT_ROOT_NAME + '.GroupChat',
      component: () => import('@/views/chat/GroupView.vue'),
      meta: {
        title: '群聊(beta)',
        localIcon: 'menu-group-chat',
      },
    },
    {
      path: 'search',
      name: CHAT_ROOT_NAME + '.Search',
      meta: {
        title: '搜索',
        localIcon: 'menu-search',
      },
    },
    {
      path: 'api-relay',
      name: CHAT_ROOT_NAME + '.ApiRelay',
      meta: {
        title: '中转站',
        localIcon: 'menu-api-relay',
      },
    },
  ],
}

export default CHAT_ROUTE
