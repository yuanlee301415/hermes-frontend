<!--
插件（@2026-11-18）
- 提示
- 统计
- 过滤
- 列表
- 元数据
-->
<script lang="ts">
import { type SelectOption } from 'naive-ui'
import { PluginInfo, PluginsMetadata } from '@/models/PluginInfo.ts'
import { getPluginsApi } from '@/api/plugins.ts'
import { copyToClipboard } from '@/utils/clipboard.ts'

// 运行状态-下拉选项
const STATUS_OPTIONS: SelectOption[] = [
  { label: PluginInfo.EFFECTIVE_STATUS_LABEL[PluginInfo.EFFECTIVE_STATUS.Enabled], value: PluginInfo.EFFECTIVE_STATUS.Enabled },
  { label: PluginInfo.EFFECTIVE_STATUS_LABEL[PluginInfo.EFFECTIVE_STATUS.AutoActive], value: PluginInfo.EFFECTIVE_STATUS.AutoActive },
  { label: PluginInfo.EFFECTIVE_STATUS_LABEL[PluginInfo.EFFECTIVE_STATUS.Inactive], value: PluginInfo.EFFECTIVE_STATUS.Inactive },
  { label: PluginInfo.EFFECTIVE_STATUS_LABEL[PluginInfo.EFFECTIVE_STATUS.Disabled], value: PluginInfo.EFFECTIVE_STATUS.Disabled },
  { label: PluginInfo.EFFECTIVE_STATUS_LABEL[PluginInfo.EFFECTIVE_STATUS.ProviderManaged], value: PluginInfo.EFFECTIVE_STATUS.ProviderManaged }
]

// 运行状态 -> NTag `type` 映射
function statusTagType(status: PluginInfo['effectiveStatus']): 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error' {
  switch (status) {
    case PluginInfo.EFFECTIVE_STATUS.Enabled:
    case PluginInfo.EFFECTIVE_STATUS.AutoActive:
      return 'success'
    case PluginInfo.EFFECTIVE_STATUS.Disabled:
      return 'error'
    case PluginInfo.EFFECTIVE_STATUS.ProviderManaged:
      return 'info'
    default:
      return 'warning'
  }
}

// 拼接插件命令
function pluginCommand(plugin: PluginInfo) {
  const escapedKey = plugin.key.replace(/'/g, `'\\''`)
  if (plugin.effectiveStatus === PluginInfo.EFFECTIVE_STATUS.Disabled || plugin.effectiveStatus === PluginInfo.EFFECTIVE_STATUS.Inactive) {
    return `hermes plugins enable '${escapedKey}'`
  }
  if (plugin.effectiveStatus === PluginInfo.EFFECTIVE_STATUS.Enabled) {
    return `hermes plugins disable '${escapedKey}'`
  }
  return ''
}

// 将值列表转换为下拉选项列表
function toOptions(values: string[]): SelectOption[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b)).map(value => ({
    label: value,
    value
  }))
}
</script>

<script setup lang="ts">
import { Refresh } from '@vicons/ionicons5'
import { useProfilesStore } from '@/store/modules/profiles.ts'

const profilesStore = useProfilesStore()
const plugins = shallowRef<PluginInfo[]>([])
const metadata = shallowRef<PluginsMetadata>()
const warnings = shallowRef<string[]>()
const loading = ref(false)
const query = reactive<{
  keyword: string
  source: PluginInfo['source'] | undefined
  kind: PluginInfo['kind'] | undefined
  status: PluginInfo['configStatus'] | undefined
}>({
  keyword: '',
  source: undefined,
  kind: undefined,
  status: undefined
})

const summary = computed(() => ({
  total: plugins.value.length,
  active: plugins.value.filter(_ => _.effectiveStatus === PluginInfo.EFFECTIVE_STATUS.Enabled || _.effectiveStatus === PluginInfo.EFFECTIVE_STATUS.AutoActive).length,
  inactive: plugins.value.filter(_ => _.effectiveStatus === PluginInfo.EFFECTIVE_STATUS.Inactive).length,
  disabled: plugins.value.filter(_ => _.effectiveStatus === PluginInfo.EFFECTIVE_STATUS.Disabled).length,
  providerManaged: plugins.value.filter(_ => _.effectiveStatus === PluginInfo.EFFECTIVE_STATUS.ProviderManaged).length
}))

const sourceOptions = computed(() => toOptions(plugins.value.map(_ => _.source)))
const kindOptions = computed(() => toOptions(plugins.value.map(_ => _.kind)))

const filteredPlugins = computed(() => {
  const keyword = query.keyword.trim().toLowerCase()
  return plugins.value.filter(_ => {
    if (query.source && _.source !== query.source) return false
    if (query.kind && _.kind !== query.kind) return false
    if (query.status && _.effectiveStatus !== query.status) return false
    if (!query.keyword) return true
    return [_.name, _.key, _.kind, _.description, _.path, _.source].some(value => String(value || '').toLowerCase().includes(keyword))
  })
})

getPlugins()

// 获取插件列表
async function getPlugins() {
  loading.value = true
  try {
    if (!profilesStore.activeProfileName || !profilesStore.profiles.length) {
      await profilesStore.fetchProfiles()
    }
    const res = await getPluginsApi()
    plugins.value = PluginInfo.from(res.plugins)
    metadata.value = new PluginsMetadata(res.metadata)
    warnings.value = res.warnings
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// 复制命令
async function handleCopyCommand(plugin: PluginInfo) {
  const command = pluginCommand(plugin)
  if (!command) return
  const copied = await copyToClipboard(command)
  if (copied) {
    window.$message?.success('命令已复制')
  } else {
    window.$message?.error('复制失败')
  }
}
</script>

<template>
  <div class="plugins-view h-full">
    <n-page-header class="page-header">
      <template #title>插件</template>
      <template #extra>
        <n-button tertiary size="small" :loading="loading" @click="getPlugins">
          <template #icon>
            <n-icon>
              <Refresh />
            </n-icon>
          </template>
          刷新
        </n-button>
      </template>
    </n-page-header>

    <div class="plugins-split">
      <div v-if="loading" class="plugins-loading">
        <n-spin style="padding: 15px;" />
      </div>

      <n-empty v-if="!plugins.length" />

      <template v-else>
        <div class="plugins-top">

          <!--提示-->
          <n-alert type="info" :bordered="false">
            只读展示可发现的 Hermes 插件 manifest。发现元数据读取不会加载插件代码。v1 管理动作仍保留在 CLI，新 Hermes 会话生效。
          </n-alert>

          <n-alert v-for="_ of warnings" :key="_" type="warning">{{ _ }}</n-alert>
          <!--提示 End-->

          <!--统计-卡片-->
          <n-grid :x-gap="12" :cols="5">
            <n-gi>
              <n-card title="总数" style="--n-padding-top: 10px; --n-padding-right: 10px; --n-padding-bottom: 10px; --n-padding-left: 10px;--n-title-font-size: 13px;">
                <n-h3 style="margin: 0;">
                  <n-text>{{ summary.total }}</n-text>
                </n-h3>
              </n-card>
            </n-gi>
            <n-gi>
              <n-card title="已启用/自动" style="--n-padding-top: 10px; --n-padding-right: 10px; --n-padding-bottom: 10px; --n-padding-left: 10px;--n-title-font-size: 13px;">
                <n-h3 style="margin: 0;">
                  <n-text type="success">{{ summary.active }}</n-text>
                </n-h3>
              </n-card>
            </n-gi>
            <n-gi>
              <n-card title="未启用" style="--n-padding-top: 10px; --n-padding-right: 10px; --n-padding-bottom: 10px; --n-padding-left: 10px;--n-title-font-size: 13px;">
                <n-h3 style="margin: 0;">
                  <n-text type="warning">{{ summary.inactive }}</n-text>
                </n-h3>
              </n-card>
            </n-gi>
            <n-gi>
              <n-card title="已禁用" style="--n-padding-top: 10px; --n-padding-right: 10px; --n-padding-bottom: 10px; --n-padding-left: 10px;--n-title-font-size: 13px;">
                <n-h3 style="margin: 0;">
                  <n-text type="error">{{ summary.disabled }}</n-text>
                </n-h3>
              </n-card>
            </n-gi>
            <n-gi>
              <n-card title="PROVIDER 管理" style="--n-padding-top: 10px; --n-padding-right: 10px; --n-padding-bottom: 10px; --n-padding-left: 10px;--n-title-font-size: 13px;">
                <n-h3 style="margin: 0;">
                  <n-text>{{ summary.providerManaged }}</n-text>
                </n-h3>
              </n-card>
            </n-gi>
          </n-grid>
          <!--统计-卡片 End-->

          <!--过滤-->
          <n-form :model="query" inline size="medium" :show-label="false" :show-feedback="false">
            <n-grid :cols="24" :x-gap="10">
              <n-form-item-gi :span="12">
                <n-input v-model:value="query.keyword" placeholder="搜索 key、名称、描述、路径..." clearable />
              </n-form-item-gi>

              <n-form-item-gi :span="4">
                <n-select v-model:value="query.source" :options="sourceOptions" placeholder="来源" clearable />
              </n-form-item-gi>

              <n-form-item-gi :span="4">
                <n-select v-model:value="query.kind" :options="kindOptions" placeholder="类型" clearable />
              </n-form-item-gi>

              <n-form-item-gi :span="4">
                <n-select v-model:value="query.status" :options="STATUS_OPTIONS" placeholder="状态" clearable />
              </n-form-item-gi>
            </n-grid>
          </n-form>
          <!--过滤 End-->
        </div>

        <div class="plugins-main">
          <!--列表-->
          <div class="plugins-table">
            <n-table class="plugins-table-head">
              <colgroup>
                <col>
                <col width="150">
                <col width="85">
                <col width="120">
                <col width="120">
                <col width="325">
                <col width="130">
              </colgroup>
              <n-thead>
                <n-tr>
                  <n-th>插件</n-th>
                  <n-th>状态</n-th>
                  <n-th>来源</n-th>
                  <n-th>类型</n-th>
                  <n-th>能力</n-th>
                  <n-th>路径/入口</n-th>
                  <n-th>CLI</n-th>
                </n-tr>
              </n-thead>
            </n-table>
            <n-scrollbar class="plugins-table-body">
              <n-table>
                <colgroup>
                  <col>
                  <col width="150">
                  <col width="85">
                  <col width="120">
                  <col width="120">
                  <col width="325">
                  <col width="130">
                </colgroup>
                <n-tbody v-if="filteredPlugins.length">
                  <n-tr v-for="_ of filteredPlugins" :key="_.key">
                    <n-td>
                      <div class="plugin-name">
                        <b>{{ _.key }}</b>
                        <p v-if="_.key !== _.name">{{ _.name }}</p>
                      </div>
                      <div v-if="_.description" class="plugin-desc">{{ _.description }}</div>
                      <div v-if="_.version || _.author" class="plugin-meta">
                        <span v-if="_.version">{{ _.version }}</span>
                        <span v-if="_.author">{{ _.author }}</span>
                      </div>
                    </n-td>

                    <n-td>
                      <n-tag size="small" :type="statusTagType(_.effectiveStatus)">{{ _.effectiveStatusLabel }}</n-tag>
                      <div class="config-status">配置：{{ _.configStatusLabel }}</div>
                    </n-td>

                    <n-td>
                      <n-tag size="small" round>{{ _.source }}</n-tag>
                    </n-td>

                    <n-td>
                      <n-tag size="small" round>{{ _.kind }}</n-tag>
                    </n-td>

                    <n-td>
                      <n-flex vertical :size="4" class="ability">
                        <p>{{ _.providesTools.length }} 个工具</p>
                        <p>{{ _.providesHooks.length }} 个Hook</p>
                        <p>{{ _.requiresEnv.length }} 个环境变量</p>
                      </n-flex>
                    </n-td>

                    <n-td class="path-cell"><code>{{ _.path ?? '无' }}</code></n-td>

                    <n-td>
                      <n-button v-if="pluginCommand(_)" size="tiny" secondary @click="handleCopyCommand(_)">复制命令</n-button>
                      <span v-else>由其他位置管理</span>
                    </n-td>
                  </n-tr>
                </n-tbody>

                <n-tbody v-else>
                  <n-tr>
                    <n-td colspan="100">
                      <n-empty />
                    </n-td>
                  </n-tr>
                </n-tbody>
              </n-table>

            </n-scrollbar>
          </div>
          <!--列表 End-->

        </div>

        <!--元数据-->
        <n-flex v-if="metadata" :size="[10, 16]" class="plugins-metadata">
          <span>Agent 根目录: <code>{{ metadata.hermesAgentRoot }}</code></span>
          <span>Python: <code>{{ metadata.pythonExecutable }}</code></span>
          <span>扫描 cwd: <code>{{ metadata.cwd }}</code></span>
          <span>项目插件: <code>{{ metadata.projectPluginsEnabled ? '已启用' : '已禁用' }}</code></span>
        </n-flex>
        <!--元数据 End-->
      </template>
    </div>
  </div>
</template>

<style scoped lang="less">
.plugins-view {
  display: flex;
  flex-direction: column;

  .plugins-loading {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
  }

  .plugins-split {
    padding: 20px;
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 15px;
    position: relative;

    .plugins-top {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .plugins-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;

      .plugins-table {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;

        table {
          table-layout: fixed;
        }

        .plugins-table-head {
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }

        .plugins-table-body {
          table {
            border-top-left-radius: 0;
            border-top-right-radius: 0;
          }
        }
      }

      td {
        color: var(--text-primary);
      }

      .plugin-name {
        p {
          color: var(--text-muted);
          margin-top: 2px;
        }
      }

      .plugin-desc {
        margin-top: 5px;
        color: var(--text-secondary);
      }

      .plugin-meta {
        color: var(--text-muted);

        span {
          padding-right: 8px;
        }
      }

      .config-status {
        margin-top: 6px;
        color: var(--text-muted);
        font-size: 11px;
      }

      .ability {
        color: var(--text-secondary);
      }

      .path-cell {
        code {
          display: block;
          width: 300px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: var(--text-muted);
          background-color: rgba(var(--accent-primary-rgb), 0.06);
          padding: 2px 5px;
          border-radius: 6px;
        }
      }
    }

    .plugins-metadata {
      color: var(--text-muted);
      font-size: 11px;

      code {
        color: var(--text-secondary);
      }
    }
  }
}
</style>
