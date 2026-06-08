/// <reference types="vite/client" />

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

// 声明 vite-plugin-svg-icons 虚拟模块
declare module 'virtual:svg-icons-register';
