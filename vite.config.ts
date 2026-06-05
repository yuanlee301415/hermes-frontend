import type { UserConfig, ConfigEnv } from "vite";

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
    VITE_PERMISSION,
    VITE_BASE_API,
    VITE_PROXY,
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
    plugins: setupVitePlugins(__APP_RELEASE__),
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: Number(VITE_PORT),
      proxy:
        VITE_PERMISSION && JSON.parse(VITE_PERMISSION)
          ? {
              [VITE_BASE_API]: {
                target: VITE_PROXY,
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\//, "/api/v1/"),
              },
            }
          : undefined,
    },
    define: {
      __APP_VERSION__: JSON.stringify(__APP_VERSION__),
      __APP_BUILD_TIME__: JSON.stringify(__APP_BUILD_TIME__),
      __APP_INFO__: JSON.stringify(__APP_INFO__),
    },
  };
});
