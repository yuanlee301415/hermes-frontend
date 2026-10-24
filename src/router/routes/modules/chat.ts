import type { AppRouteRecordRaw } from '@/router/types'

import { LAYOUT } from '@/router/constant'

export const CHAT_ROOT_NAME = 'Chat'
export const CHAT_ROUTE_NAME = CHAT_ROOT_NAME + '.Chat'
export const SESSION_ROUTE_NAME = CHAT_ROOT_NAME + '.Session'

const CHAT_ROUTE: AppRouteRecordRaw = {
  path: '/chat',
  name: CHAT_ROOT_NAME,
  component: LAYOUT,
  redirect: '/chat/chat',
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
    }
  ],
}

export default CHAT_ROUTE
