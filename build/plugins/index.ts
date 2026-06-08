import vue from '@vitejs/plugin-vue'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import { cwd } from 'node:process'
import { resolve } from 'node:path'

import { htmlPlugin } from './html'
import { releasePlugin } from './release'
import { setupUnplugins } from './unplugins'

export function setupVitePlugins(__APP_RELEASE__: string, VITE_ICON_LOCAL_PREFIX: string) {
  return [
    vue(),
    htmlPlugin(__APP_RELEASE__),
    ...setupUnplugins(),

    createSvgIconsPlugin({
      iconDirs: [resolve(cwd(), 'src/assets/svg-icons')],
      symbolId: `${VITE_ICON_LOCAL_PREFIX}-[dir]-[name]`,
      inject: 'body-last',
      customDomId: '__SVG_ICON_LOCAL__',
    }),

    releasePlugin(__APP_RELEASE__)
  ]
}
