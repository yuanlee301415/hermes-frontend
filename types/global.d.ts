import type { ComponentPublicInstance, FunctionalComponent } from "vue";

declare global {
  const __APP_VERSION__: string;
  const __APP_BUILD_TIME__: string;
  const __APP_INFO__: {
    name: string;
    version: string;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };

  declare type Recordable<T = any> = Record<string, T>;

  declare type Nullable<T> = T | null;

  // window
  export interface Window {
    NProgress?: import('nprogress').NProgress
    $loadingBar?: import('naive-ui').LoadingBarProviderInst
    $dialog?: import('naive-ui').DialogProviderInst
    $message?: import('naive-ui').MessageProviderInst
    $notification?: import('naive-ui').NotificationProviderInst
  }
}

declare module "vue" {
  export type JSXComponent<Props = any> =
    | { new (): ComponentPublicInstance<Props> }
    | FunctionalComponent<Props>;
}
