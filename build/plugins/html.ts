/*
* HTML 插件
* - 注入 APP 构建版本
* */
import type { Plugin } from 'vite'

export function htmlPlugin(__APP_RELEASE__: string) {
  const plugin: Plugin = {
    name: 'html-plugin',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace("<%= __APP_RELEASE__ %>", __APP_RELEASE__)
    }
  }
  return plugin
}
