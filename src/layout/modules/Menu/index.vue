<template>
  <MenuItem v-for="item of basicRoutes" :key="item.name" :item="item" :depth="1" :fullPath="item.path" />
</template>

<script setup lang="ts">
import { basicRoutes } from '@/router/routes'
import MenuItem from '@/layout/modules/Menu/MenuItem.vue'

defineOptions({ name: 'SideMenu' })
</script>
