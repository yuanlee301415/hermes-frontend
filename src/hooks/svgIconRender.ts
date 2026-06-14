/*
 * SvgIcon render hook
 * */
import type { Component, VNode } from 'vue'
import { h } from 'vue'

type Config = {
  icon?: string
  localIcon?: string
  color?: string
  size?: number
}

export function useSvgIconRender(SvgIcon: Component) {
  function SvgIconVNode(config: Config = {}): VNode {
    const { icon, localIcon, color, size } = config
    const style = {
      color,
      fontSize: size ? `${size}px` : void 0,
    }
    return h(SvgIcon, { icon, localIcon, style })
  }

  return {
    SvgIconVNode,
  }
}
