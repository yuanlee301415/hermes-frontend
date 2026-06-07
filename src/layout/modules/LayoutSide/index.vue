<template>
  <aside>
    <nav>
      <n-menu
        key-field="path"
        v-model:value="selectedKey"
        :options="routesStore.menus as unknown as  MenuOption[]"
        :default-expand-all="true"
        @update:value="handleRoute"
      />
    </nav>
    <teleport to="body">
      <n-modal
        v-model:show="showModal"
        :auto-focus="false"
        preset="dialog"
        title="搜索会话"
        @negative-click="cancelCallback"
      />
    </teleport>
  </aside>
</template>

<script setup lang="ts">
import type { MenuOption } from 'naive-ui'
import { useRoute } from 'vue-router'
import { useRoutesStore } from '@/store/modules/routes.ts'
import { router } from '@/router'
import { SEARCH_ROUTE_NAME } from '@/router/constant'

defineOptions({ name: 'LayoutSide' })

const route = useRoute()
const routesStore = useRoutesStore()
const showModal = ref(false)
const selectedKey = ref(route.path)

function handleRoute(key: string, menu: MenuOption) {
  if (menu.name === SEARCH_ROUTE_NAME) {
    showModal.value = true
    return
  }
  router.push(key)
}

function cancelCallback() {
  showModal.value = false
}
</script>

<style scoped lang="less">
nav {
  margin: 10px 0;
  overflow-y: auto;
  user-select: none;
}
</style>
