<!--
频道（2026-11-06）
-->
<script setup lang="ts">
import { useSettingsStore } from '@/store/modules/settings.ts'
import { useProfilesStore } from '@/store/modules/profiles.ts'
import PlatformSettings from '@/components/hermes/settings/PlatformSettings.vue'

const settingsStore = useSettingsStore()
const profilesStore = useProfilesStore()

void loadSettingsForProfile()

async function loadSettingsForProfile() {
  if (!profilesStore.activeProfileName || !profilesStore.profiles.length) {
    await profilesStore.fetchProfiles()
  }
  await settingsStore.fetchSettings()
}
</script>

<template>
  <div class="channels-view h-full">
    <n-page-header class="page-header">
      <template #title>频道</template>
    </n-page-header>

    <div class="channels-body">
      <div v-if="settingsStore.loading || settingsStore.saving" class="channels-spin">
        <n-spin />
      </div>
      <PlatformSettings />
    </div>
  </div>
</template>


<style scoped lang="less">
.channels-view {
  display: flex;
  flex-direction: column;

  .channels-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    position: relative;

    .channels-spin {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
    }
  }
}
</style>
