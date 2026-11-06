<!--
Platform 卡片
- Platform 名称
- Platform 是否已配置
- Platform 独占 token 锁提示
-->
<script setup lang="ts">
import { type PlatformConfig } from '@/api/config.ts'
import { type Platform } from './shared.ts'

const CONFIGURED_KEYS = ['token', 'api_key', 'app_id', 'client_id', 'secret', 'app_secret', 'client_secret', 'access_token', 'bot_id', 'account_id', 'enabled']

const props = defineProps<Omit<Platform, 'key'> & {
  credentials: Record<string, any>
  config: PlatformConfig
}>()

const expanded = ref(true)

const configured = computed(() => {
  const creds = props.credentials
  if (!creds) return false
  const targets = [creds, creds.extra].filter(Boolean)
  return targets.some(obj => CONFIGURED_KEYS.some(key => {
    const val = (obj as Record<string, any>)[key]
    return val !== undefined && val !== null && val !== '' && val !== false
  }))
})
</script>

<template>
  <div class="platform-card" :class="{configured}">
    <div class="platform-card-header" @click="expanded = !expanded">
      <div class="platform-info">
        <span class="platform-icon" v-html="icon"></span>
        <span class="platform-name">{{ name }}</span>
        <n-tag :type="configured ? 'success' : 'default'" size="small" round>
          {{ configured ? '已配置' : '未配置' }}
        </n-tag>
      </div>

      <span class="expand-icon" :class="{expanded}">&#9662;</span>
    </div>

    <div v-if="expanded" class="platform-card-body">
      <n-alert v-if="exclusive" type="warning" class="exclusive-alert">
        此平台使用独占 token 锁。每个 profile 必须使用不同的身份 token，否则会与其他 profile 冲突导致 gateway 启动失败。
      </n-alert>
      <slot />
    </div>
  </div>
</template>

<style scoped lang="less">
.platform-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
  overflow: hidden;

  &.configured {
    border-color: rgba(var(--success-rgb), 0.3);
  }

  .platform-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    cursor: pointer;
    user-select: none;

    &:hover {
      background-color: rgba(var(--text-primary-rgb), 0.03);
    }

    .platform-info {
      display: flex;
      align-items: center;
      gap: 10px;

      .platform-icon {
        width: 18px;
        height: 18px;
        color: var(--text-secondary);
        flex-shrink: 0;
      }

      .platform-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
      }
    }

    .expand-icon {
      font-size: 20px;
      line-height: 1;
      color: var(--text-muted);
      transition: transform 0.2s;

      &.expanded {
        transform: rotate(0deg);
      }

      &:not(.expanded) {
        transform: rotate(-90deg);
      }
    }
  }

  .platform-card-body {
    padding: 0 16px 12px;
    border-top: 1px solid var(--border-light);

    .exclusive-alert {
      margin: 12px 0 4px;
      font-size: 12px;
    }
  }
}
</style>
