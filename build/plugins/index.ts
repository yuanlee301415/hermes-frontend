import vue from '@vitejs/plugin-vue'
import { htmlPlugin } from './html'
import { releasePlugin } from './release'
import { setupUnplugins } from './unplugins'

export function setupVitePlugins(__APP_RELEASE__: string) {
  return [
    vue(),
    htmlPlugin(__APP_RELEASE__),
    ...setupUnplugins(),
    releasePlugin(__APP_RELEASE__)
  ]
}
