/// <reference types="vite/client" />

// 版本号
declare const __APP_VERSION__: string

// 构建时间
declare const __APP_BUILD_TIME__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  // APP Name
  readonly VITE_APP_NAME: string;

  // APP Title
  readonly VITE_APP_TITLE: string;
}
