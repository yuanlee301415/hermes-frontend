import { type SessionSummary } from '@/api/sessions.ts'

export class Session {
  id: string
  title: string
  profile?: string
  agent?: string
  model?: string
  provider?: string
  startedAt: number
  updatedAt: number
  lastActiveAt: number

  constructor(_: Omit<Session, 'createdAt'>) {
    this.id = _.id
    this.profile = _.profile
    this.title = _.title
    this.agent = _.agent
    this.model = _.model
    this.provider = _.provider
    this.startedAt = _.startedAt
    this.updatedAt = _.updatedAt
    this.lastActiveAt = _.lastActiveAt
  }

  get createdAt() {
    const date = new Date(Math.round(this.startedAt * 1000))
    if (!date.getTime()) return ''
    return date.toLocaleString([], { month: 'short', day: 'numeric' })
  }

  static fromSummary(list: SessionSummary[]) {
    return list.map(_ => new this({
      id: _.id,
      title: _.title,
      profile: _.profile ??　'default',
      agent: _.agent,
      model: _.model,
      provider: _.provider,
      startedAt: _.started_at,
      updatedAt: Math.round(((_.last_active || _.ended_at || _.started_at) ?? NaN) * 1000),
      lastActiveAt: Math.round((_.last_active ?? NaN) * 1000)
    }))
  }
}
