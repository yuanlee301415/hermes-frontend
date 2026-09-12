import { Message } from '@/models/Message.ts'
import { MESSAGE_ID_PREFIX, MARKDOWN_HEADING_ID_PREFIX } from '@/constants/hardcoded.ts'
import { Outline, Heading } from './Outline.ts'

/**
 * 根据 AI 消息内容，提取1~3级标题数据
 * @param msg AI 消息
 */
function getHeadings(msg: Message): Heading[] {
  const headings: Heading[] = []
  const matches = msg.content.matchAll(/(#{1,3})\s+(.+)/g)
  let idx = 1

  for (const [_, signs, text] of matches) {
    headings.push({
      id: `${MESSAGE_ID_PREFIX}-${msg.id}-${MARKDOWN_HEADING_ID_PREFIX}-${idx++}`,
      level: signs.length,
      text
    })
  }
  return headings
}

/**
 * 根据会话的消息列表，生成会话大纲列表数据
 * @param msgs 会话的消息列表
 */
export function getOutlines(msgs: Message[]): Outline[] {
  const outlines: Outline[] = []
  msgs.forEach(msg => {
    if (msg.role === Message.ROLE.User) {
      outlines.push({
        id: `${MESSAGE_ID_PREFIX}-${msg.id}`,
        question: msg.content,
        headings: null
      })
    } else if (msg.role === Message.ROLE.Assistant) {
      const last = outlines.at(-1)
      if (!last) return
      if (last.headings) return
      last.headings = getHeadings(msg)
    }
  })
  return outlines
}
