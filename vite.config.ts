import type { UserConfig, ConfigEnv, ProxyOptions } from "vite";

import { fileURLToPath, URL } from "node:url";
import { cwd } from 'node:process'
import { defineConfig, loadEnv } from "vite";
import { setupVitePlugins } from './build/plugins'

// @ts-ignore
import pkg from "./package.json";

// https://vitejs.dev/config/
export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
  const env = loadEnv(mode, cwd()) as unknown as ImportMetaEnv
  const {
    VITE_PORT,
    VITE_INTERNAL_VERSION,
    VITE_PROXY,
    VITE_ICON_LOCAL_PREFIX
  } = env;
  const __APP_VERSION__ = [pkg.version, VITE_INTERNAL_VERSION].join(".");
  const __APP_BUILD_TIME__ = new Date().toLocaleString('default', {hourCycle: 'h24'});
  const __APP_RELEASE__ = [__APP_VERSION__, __APP_BUILD_TIME__, mode].join('@')
  const __APP_INFO__ = {
    dependencies: pkg.dependencies,
    devDependencies: pkg.devDependencies,
    name: pkg.name,
    version: pkg.version,
  };
  console.log("env:\n", env);

  return {
    plugins: setupVitePlugins(__APP_RELEASE__, VITE_ICON_LOCAL_PREFIX),
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: Number(VITE_PORT),
      strictPort: true,
      proxy: {
        '/api': createProxyConfig(VITE_PROXY),
        '/v1': createProxyConfig(VITE_PROXY),
        '/health': createProxyConfig(VITE_PROXY),
        '/upload': createProxyConfig(VITE_PROXY),
        '/webhook': createProxyConfig(VITE_PROXY),
        '/socket.io': {
          target: VITE_PROXY,
          ws: true
        }
      }
    },
    define: {
      __APP_VERSION__: JSON.stringify(__APP_VERSION__),
      __APP_BUILD_TIME__: JSON.stringify(__APP_BUILD_TIME__),
      __APP_INFO__: JSON.stringify(__APP_INFO__),
    },
    build: {
      rolldownOptions: {
        output: {
          chunkFileNames: 'assets/js/[name].[hash].js',
          entryFileNames: 'assets/js/[name].[hash].js',
          assetFileNames: 'assets/[ext]/[name].[hash].[ext]',
          manualChunks(id) {
            if (id.includes('node_modules')) {
              const [name] = id.split('/node_modules/')[1].split('/')
              if (['vue', 'pinia', 'vue-router'].includes(name)) return `vendor-vue`
              if (name === 'naive-ui') return `vendor-ui`
              return `vendor-${name}`
            }
          }
        }
      }
    }
  }
})

function createProxyConfig(target: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    ws: true,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.removeHeader('origin')
        proxyReq.removeHeader('referer')
      })
      proxy.on('proxyReqWs', (proxyReq) => {
        proxyReq.removeHeader('origin')
        proxyReq.removeHeader('referer')
      })
      proxy.on('proxyRes', (proxyRes) => {
        proxyRes.headers['cache-control'] = 'no-cache'
        proxyRes.headers['x-accel-buffering'] = 'no'
      })
    }
  }
}
