import type { AppRouteRecordRaw } from '@/router/types'
import { Menu } from '@/models/Menu.ts'

/**
 * 生成菜单数据
 */
export function genMenus(routes: AppRouteRecordRaw[], path = '', result: Menu[] = []) {
  for (const route of routes) {
    // 没有 `title` 的路由，不添加到菜单中
    if (!route?.meta?.title) continue

    const menu = new Menu({
      path: path ? path + '/' + route.path : route.path,
      name: route.name!,
      localIcon: route.meta.localIcon,
      title: route.meta.title,
    })

    result.push(menu)

    if (!route.children?.length) continue

    const children = genMenus(route.children, menu.path)
    if (children?.length) {
      menu.children = children
    }
  }

  return result
}
