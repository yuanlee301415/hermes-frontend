import vue from '@vitejs/plugin-vue'
import { htmlPlugin } from './html'
import { releasePlugin } from './release'

export function setupVitePlugins(__APP_RELEASE__: string) {
  return [
    vue(),
    htmlPlugin(__APP_RELEASE__),
    releasePlugin(__APP_RELEASE__)
  ]
}
