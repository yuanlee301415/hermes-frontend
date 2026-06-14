/*
 * 导航菜单
 * */

export class Menu {
  path: string

  name: string

  title: string

  localIcon?: string

  children?: Menu[] | void

  constructor(_: Menu) {
    const { path, name, title, localIcon, children } = { ..._ }
    this.path = path
    this.name = name
    this.title = title
    this.localIcon = localIcon
    this.children = children
  }
}
