import type { DropdownOption } from 'naive-ui'
import { Session } from '@/models/Session.ts'

// 右键菜单 Keys
export const CONTEXTMENU_KEYS = {
  Pin: 'pin',
  UnPin: 'un-pin',
  Rename: 'rename',
  Workspace: 'workspace',
  Model: 'model',
  Export: 'export',
  ExportFull: 'export-full',
  ExportFullJson: 'export-full-json',
  ExportFullTxt: 'export-full-txt',
  ExportCompressed: 'export-compressed',
  ExportCompressedJson: 'export-compressed-json',
  ExportCompressedTxt: 'export-compressed-txt',
  OpenLink: 'open-link',
  CopyLink: 'copy-link',
  CopyId: 'copy-id'
} as const;

/**
 * 生成右键菜单
 * @param showPin 是否显示“置顶/取消置顶”菜单
 * @param showModel 是否显示“设置模型”菜单
 * @return NDropdown 组件 `options` 列表
 */
export function generateContextmenuOptions(showPin: boolean, showModel: boolean) {
  const options: DropdownOption[] = [
    { label: '置顶', key: CONTEXTMENU_KEYS.Pin, show: showPin },
    { label: '取消置顶', key: CONTEXTMENU_KEYS.UnPin, show: !showPin },
    { label: '重命名', key: CONTEXTMENU_KEYS.Rename },
    { label: '设置工作区', key: CONTEXTMENU_KEYS.Workspace },
    { label: '设置模型', key: CONTEXTMENU_KEYS.Model, show: showModel },
    {
      label: '导出', key: CONTEXTMENU_KEYS.Export, children: [
        { label: '全量导出', key: CONTEXTMENU_KEYS.ExportFull, children: [
            { label: 'JSON', key: CONTEXTMENU_KEYS.ExportFullJson },
            { label: 'TXT', key: CONTEXTMENU_KEYS.ExportFullTxt },
          ]
        },
        { label: '压缩导出', key: CONTEXTMENU_KEYS.ExportCompressed, children: [
            { label: 'JSON', key: CONTEXTMENU_KEYS.ExportCompressedJson },
            { label: 'TXT', key: CONTEXTMENU_KEYS.ExportCompressedTxt },
          ]
        }
      ]
    },
    { label: '在新标签页打开', key: CONTEXTMENU_KEYS.OpenLink },
    { label: '复制会话链接', key: CONTEXTMENU_KEYS.CopyLink },
    { label: '复制会话ID', key: CONTEXTMENU_KEYS.CopyId },
  ]
  return options
}

/**
 * 将会话按更新时间降序排序（最新的在前）
 * @param items 会话数组
 * @returns 排序后的会话数组
 */
export function sortSessionsWithActiveFirst(items: Session[]): Session[] {
  return [...items].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}
