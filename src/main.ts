import { createApp } from 'vue'
import App from './App.vue'
import { setupRouter } from './router'
import { setupStore } from './store'
import { setupNaiveDiscreteApi } from './plugins'
import './assets/main.less'

function bootstrap() {
  setupNaiveDiscreteApi()
  const app = createApp(App)
  setupRouter(app)
  setupStore(app)
  app.mount('#app')
}

bootstrap()
