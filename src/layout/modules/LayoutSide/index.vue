<!--
Sidebar
-->
<script setup lang="ts">
import type { MenuOption } from 'naive-ui'
import { useRoute } from 'vue-router'
import { ChevronBack, ChevronForward, ChevronDownSharp, ExitOutline, LogoGithub, GlobeOutline, SunnyOutline } from '@vicons/ionicons5'
import { useRoutesStore } from '@/store/modules/routes.ts'
import { router } from '@/router'
import { useAppStore } from '@/store/modules/app.ts'
import LanguageSwitch from '@/layout/modules/LanguageSwitch.vue'
import { useSvgIcon } from '@/hooks/svgIcon.ts'

defineOptions({ name: 'LayoutSide' })

const TITLE = import.meta.env.VITE_APP_TITLE
const route = useRoute()
const routesStore = useRoutesStore()
const appStore = useAppStore()
const { SvgIconVNode } = useSvgIcon()
const selectedKey = ref(route.path)

watch(
  route,
  (val) => {
    selectedKey.value = val.path
  },
  {
    immediate: true,
    deep: true,
  },
)

function handleRoute(key: string) {
  router.push(key)
}

function renderMenuIcon(menu: MenuOption) {
  return menu.localIcon ? SvgIconVNode({ icon: menu.localIcon as string }) : null
}
</script>

<template>
  <aside :class="{ collapsed: appStore.sidebarCollapsed }" class="sidebar">
    <route-link-item :to="{ name: 'Home' }" class="sidebar-logo">
      <img src="@/assets/logo.png" width="28" />
      <h1 v-show="!appStore.sidebarCollapsed" class="sidebar-title">{{ TITLE }}</h1>
    </route-link-item>

    <n-button :title="appStore.sidebarCollapsed ? '展开菜单' : '收起菜单'" quaternary size="small" class="sidebar-collapse-btn" @click="appStore.toggleSidebarCollapsed()">
      <template #icon>
        <n-icon>
          <ChevronForward v-if="appStore.sidebarCollapsed" />
          <ChevronBack v-else />
        </n-icon>
      </template>
    </n-button>

    <nav class="sidebar-nav">
      <n-menu
        v-model:value="selectedKey"
        :options="routesStore.menus as unknown as MenuOption[]"
        :default-expand-all="true"
        :root-indent="15"
        :indent="15"
        :collapsed="appStore.sidebarCollapsed"
        :collapsed-width="48"
        :collapsed-icon-size="14"
        :render-icon="renderMenuIcon"
        key-field="path"
        @update:value="handleRoute"
      />
    </nav>

    <div class="sidebar-profile-selector">
      <n-p v-show="!appStore.sidebarCollapsed">用户</n-p>
      <n-button :bordered="!appStore.sidebarCollapsed" ghost strong class="w-full" style="justify-content: start">
        <template #icon>
          <SvgIcon icon="Profile" :size="24" />
        </template>
        <n-text v-show="!appStore.sidebarCollapsed">default</n-text>
      </n-button>
    </div>

    <div v-show="!appStore.sidebarCollapsed" class="sidebar-model-selector">
      <n-p>模型</n-p>
      <n-button ghost strong icon-placement="right" class="w-full" style="justify-content: space-between">
        <n-text>deepseek-v4-flash</n-text>
        <template #icon>
          <n-icon :size="16">
            <ChevronDownSharp />
          </n-icon>
        </template>
      </n-button>
    </div>

    <div class="sidebar-footer">
      <n-button quaternary class="sidebar-logout">
        <template #icon>
          <ExitOutline />
        </template>
        <n-text v-show="!appStore.sidebarCollapsed">退出登录</n-text>
      </n-button>

      <n-flex :justify="appStore.sidebarCollapsed ? 'center' : 'space-between'" class="status-row">
        <n-flex class="status-indicator connected" align="center">
          <span class="status-dot"></span>
          <n-text v-show="!appStore.sidebarCollapsed" class="status-text">已连接</n-text>
        </n-flex>
        <LanguageSwitch v-show="!appStore.sidebarCollapsed" style="width: 90px" />
      </n-flex>

      <n-flex :vertical="appStore.sidebarCollapsed" :size="appStore.sidebarCollapsed ? 20 : 10" class="version" align="center" justify="space-between">
        <n-button v-show="!appStore.sidebarCollapsed" text size="small">
          <template #icon>
            <n-icon>
              <LogoGithub />
            </n-icon>
          </template>
        </n-button>

        <n-button v-show="!appStore.sidebarCollapsed" text size="small">
          <template #icon>
            <n-icon>
              <GlobeOutline />
            </n-icon>
          </template>
        </n-button>

        <n-text v-show="!appStore.sidebarCollapsed">Studio v0.6.10</n-text>

        <n-button text size="small">
          <template #icon>
            <n-icon title="Comic style">
              <SvgIcon icon="Comic" />
            </n-icon>
          </template>
        </n-button>

        <n-button text size="small">
          <template #icon>
            <n-icon title="Light mode">
              <SunnyOutline />
            </n-icon>
          </template>
        </n-button>
      </n-flex>
    </div>
  </aside>
</template>

<style scoped lang="less">
.sidebar {
  position: relative;
  width: var(--sidebar-width);
  height: 100vh;
  background-color: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  padding: 0 12px 20px;
  flex-shrink: 0;
  transition: width 0.25s ease;

  &:not(.collapsed) {
    .sidebar-collapse-btn {
      position: absolute;
      top: 17px;
      right: 12px;
      z-index: 5;
    }
  }

  // ─── Collapsed
  &.collapsed {
    width: var(--sidebar-collapsed-width);
    padding: 0 8px 12px;
    overflow: hidden;

    .sidebar-logo {
      justify-content: center;
      gap: 0;

      .sidebar-title {
        display: none;
      }
    }

    .sidebar-collapse-btn {
      margin: 8px auto;
    }
  }

  .sidebar-logo {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 60px;
    padding: 0 12px;
    margin: 0 -12px;
    color: var(--text-primary);
    cursor: pointer;
    background-color: var(--bg-card);
    box-shadow: 0 2px 8px rgb(0 0 0 / 8%);

    .sidebar-title {
      font-size: 16px;
      font-weight: 600;
      white-space: nowrap;
    }
  }

  .sidebar-collapse-btn {
    width: 28px;
    height: 28px;
    color: var(--text-muted);
    transition: all 0.15s ease;
  }

  .sidebar-nav {
    flex: 1;
    overflow: auto;
    padding-top: 10px;
    min-height: 0;
    scrollbar-width: none;
  }

  .sidebar-profile-selector {
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
  }

  .sidebar-model-selector {
    padding-top: 12px;
  }

  .sidebar-footer {
    padding-top: 8px;
    margin-top: 8px;
    border-top: 1px solid var(--border-color);

    .sidebar-logout {
      width: 100%;
      justify-content: start;

      &:hover {
        color: var(--error);
        background-color: rgba(var(--error-rgb, 239, 68, 68), 0.06);
      }
    }

    .status-row {
      padding: 8px 10px;

      .status-indicator {
        font-size: 12px;

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        &.connected {
          .status-dot {
            background-color: var(--success);
            box-shadow: 0 0 6px rgba(var(--success-rgb), 0.5);
          }
        }
      }
    }

    .version {
      padding: 8px 0;
    }
  }
}
</style>
