/*
 * SvgIcon VNode hook
 * */

import { useSvgIconRender } from './svgIconRender'
import SvgIcon from '@/components/SvgIcon.vue'

export function useSvgIcon() {
  const { SvgIconVNode } = useSvgIconRender(SvgIcon)
  return {
    SvgIconVNode,
  }
}
