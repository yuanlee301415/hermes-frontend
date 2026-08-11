/*
*  Slash 命令
* */

//  Slash 命令
export type BridgeCommand = {
  // 名称
  name: string
  // 参数
  args: string
  // 插入文本
  insertText?: string
  // 描述
  description?: string
}

// Slash 命令列表
export const BRIDGE_COMMANDS: BridgeCommand[] = [
  {
    "name": "usage",
    "args": "",
    "description": "计算当前会话用量"
  },
  {
    "name": "status",
    "args": "",
    "description": "查看会话状态和队列"
  },
  {
    "name": "abort",
    "args": "",
    "description": "停止当前 Bridge 运行"
  },
  {
    "name": "queue",
    "args": "<消息>",
    "description": "把消息加入当前运行后的队列"
  },
  {
    "name": "plan",
    "args": "<文本>",
    "description": "生成一份 Markdown 实施计划"
  },
  {
    "name": "goal",
    "args": "<文本>",
    "description": "设置一个跨轮次持续推进的目标"
  },
  {
    "name": "goal",
    "args": "status",
    "insertText": "goal status",
    "description": "查看当前目标状态"
  },
  {
    "name": "goal",
    "args": "pause",
    "insertText": "goal pause",
    "description": "暂停当前目标循环"
  },
  {
    "name": "goal",
    "args": "resume",
    "insertText": "goal resume",
    "description": "继续已暂停的目标循环"
  },
  {
    "name": "goal",
    "args": "done",
    "insertText": "goal done",
    "description": "完成并清除当前目标"
  },
  {
    "name": "goal",
    "args": "clear",
    "insertText": "goal clear",
    "description": "清除当前目标"
  },
  {
    "name": "subgoal",
    "args": "<文本>",
    "description": "为当前目标追加验收条件"
  },
  {
    "name": "clear",
    "args": "",
    "description": "清空当前显示内容"
  },
  {
    "name": "clear",
    "args": "--history",
    "insertText": "clear --history",
    "description": "删除当前会话已入库的消息历史"
  },
  {
    "name": "title",
    "args": "<标题>",
    "description": "重命名当前会话"
  },
  {
    "name": "compress",
    "args": "",
    "description": "空闲时触发上下文压缩"
  },
  {
    "name": "steer",
    "args": "<文本>",
    "description": "向当前 Bridge 运行发送引导文本"
  },
  {
    "name": "destroy",
    "args": "",
    "description": "释放当前会话的 Bridge Agent"
  },
  {
    "name": "reload-mcp",
    "args": "",
    "description": "重载 MCP 服务器"
  }
]
