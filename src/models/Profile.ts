export class ProfileAvatar {
  type: 'generated' | 'image'
  seed?: string
  dataUrl?: string
  updateAt?: number

  constructor(_?: ProfileAvatar) {
    const { type, seed, dataUrl, updateAt } = { ..._ }
    this.type = type ?? 'generated'
    this.seed = seed
    this.dataUrl = dataUrl
    this.updateAt = updateAt
  }
}

export class Profile {
  name: string
  active: boolean
  model: string
  alias: string
  gatewayStatus?: string
  avatar?: ProfileAvatar

  constructor(_: Profile) {
    this.name = _.name
    this.active = _.active
    this.model = _.model
    this.alias = _.alias
    this.gatewayStatus = _.gatewayStatus
    this.avatar = new ProfileAvatar(_.avatar)
  }
}
