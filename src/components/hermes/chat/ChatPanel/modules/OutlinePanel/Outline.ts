/**
 * 会话大纲 标题
 */
export class Heading {
  id: string
  level: number
  text: string
  constructor(_: Heading) {
    const {id, level, text} = {..._}
    this.id = id
    this.level = level
    this.text = text
  }
}

/**
 * 会话大纲
 */
export class Outline {
  id: string
  question: string
  headings: Heading[] | null
  constructor(_: Outline) {
    const { id, question, headings } = { ..._ }
    this.id = id
    this.question = question
    this.headings = headings ?? null
  }
}
