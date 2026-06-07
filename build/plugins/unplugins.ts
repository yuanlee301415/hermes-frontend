import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'

export function setupUnplugins() {
  return [
    AutoImport({
      dts: 'types/auto-imports.d.ts',
      imports: [
        'vue',
        {
          'naive-ui': [
            'useDialog',
            'useMessage',
            'useNotification',
            'useLoadingBar'
          ]
        }
      ]
    }),

    Components({
      dts: 'types/components.d.ts',
      resolvers: [NaiveUiResolver()]
    })
  ]
}
