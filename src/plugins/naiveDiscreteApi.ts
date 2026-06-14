import { createDiscreteApi, darkTheme, useOsTheme } from 'naive-ui'
import { computed } from 'vue'

/**
 * 挂载 Naive-ui 脱离上下文的 API
 * 如果你想在 setup 外使用 useDialog、useMessage、useNotification、useLoadingBar，可以通过 createDiscreteApi 来构建对应的 API。
 * @see https://www.naiveui.com/zh-CN/dark/components/discrete
 */
export function setupNaiveDiscreteApi() {
  const osTheme = useOsTheme()
  const configProviderPropsRef = computed(() => ({
    theme: osTheme.value === 'dark' ? darkTheme : null,
  }))
  const { message, dialog, notification, loadingBar } = createDiscreteApi(['message', 'dialog', 'notification', 'loadingBar'], {
    configProviderProps: configProviderPropsRef,

    // 配置消息
    messageProviderProps: {
      closable: true,
      duration: 5000,
      placement: 'top-right',
      keepAliveOnHover: true,
    },
  })

  window['$message'] = message
  window['$dialog'] = dialog
  window['$notification'] = notification
  window['$loadingBar'] = loadingBar
}
