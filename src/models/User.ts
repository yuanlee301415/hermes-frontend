/*
 * 用户 Model
 * */

export default class User {
  id: string

  name: string

  roles: string[]

  /**
   * @param {User} _
   */
  constructor(_: User) {
    const { id, name, roles } = { ..._ }
    this.id = id
    this.name = name
    this.roles = roles
  }
}
