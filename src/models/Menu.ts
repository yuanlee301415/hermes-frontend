/*
 * 导航菜单
 * */

export class Menu {
  path: string

  name: string

  title: string

  icon?: string

  children?: Menu[]|void

  constructor(_: Menu) {
    const { path, name, title, icon, children } = { ..._ }
    this.path = path
    this.name = name
    this.title = title
    this.icon = icon
    this.children = children
  }
}
