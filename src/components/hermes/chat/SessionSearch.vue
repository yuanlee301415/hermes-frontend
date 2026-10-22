<!--
搜索会话(@2026-10-22)
- 搜索会话
- 上下方向键导航
- 跳转到会话
-->
<script lang="ts">
import { type SessionSummary, type SessionSearchResult, getSessionsApi, searchSessionsApi } from '@/api/sessions.ts'

type SearchItem = SessionSearchResult | (SessionSummary & {
  snippet?: string
  matched_message_id: number | null
  rank: number
})

function formatTime(ts?: number): string {
  if (!ts) return ''
  const date = new Date(ts * 1000)
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatSource(source: string): string {
  const map: Record<string, string> = {
    api_server: 'API Server',
    cli: 'CLI',
    telegram: 'Telegram',
    discord: 'Discord',
    slack: 'Slack',
    matrix: 'Matrix',
    whatsapp: 'WhatsApp',
    signal: 'Signal',
    cron: 'Cron',
    weixin: 'WeChat'
  }
  return map[source] || source
}

</script>
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { NInput } from 'naive-ui'
import { useChatStore } from '@/store/modules/chat.ts'
import { CHAT_ROUTE_NAME, SESSION_ROUTE_NAME } from '@/router/routes/modules/chat.ts'

defineExpose({
  openModal,
  closeModal
})

const router = useRouter()
const chatStore = useChatStore()

const visible = ref(false)
const query = ref('')
const loading = ref(false)
const activeIndex = ref(0)

// 初始加载会话列表
const recentSessions = shallowRef<SessionSummary[]>([])
// 搜索会话结果列表
const searchResults = shallowRef<SessionSearchResult[]>([])

const inputRef = useTemplateRef<InstanceType<typeof NInput>>('inputRef')
const itemsRef = useTemplateRef<HTMLElement[]>('itemsRef')

const profileFilter = computed(() => chatStore.sessionProfileFilter)
const hasQuery = computed(() => query.value.trim().length > 0)

// 列表数据
const items = computed<SearchItem[]>(() => {
  if (hasQuery.value) return searchResults.value
  return recentSessions.value.map(_ => ({
    ..._,
    matched_message_id: null,
    snippet: _.preview,
    rank: 0
  }))
})

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let requestSeq = 0

watch(() => visible.value, async (open) => {
  query.value = ''
  activeIndex.value = 0
  recentSessions.value = []
  searchResults.value = []

  if (open) {
    await loadRecentSessions()
    await nextTick()
    inputRef.value?.focus()
    return
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
})

function openModal() {
  visible.value = true
}

function closeModal() {
  visible.value = false
}

async function loadRecentSessions() {
  const seq = ++requestSeq
  loading.value = true
  try {
    const sessions = await getSessionsApi(undefined, 8, profileFilter.value)
    if (seq !== requestSeq) return
    recentSessions.value = sessions
  } catch (e) {
    console.error(e)
    if (seq !== requestSeq) return
    window.$message?.error((e as Error).message || '搜索会话失败')
  } finally {
    if (seq !== requestSeq) return
    loading.value = false
  }
}

async function runSearch(query: string) {
  const seq = ++requestSeq
  loading.value = true
  try {
    const results = await searchSessionsApi(query.trim(), undefined, 10)
    if (seq !== requestSeq) return
    searchResults.value = results
    activeIndex.value = 0
  } catch (e) {
    console.error(e)
  } finally {
    if (seq === requestSeq) {
      loading.value = false
    }
  }
}

function handleSearch() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  debounceTimer = setTimeout(() => {
    if (!visible.value) return
    void runSearch(query.value)
  }, 160)
}

async function openItem(item: SearchItem) {
  visible.value = false

  if (!chatStore.sessions.find(_ => _.id === item.id)) {
    router.push({
      name: CHAT_ROUTE_NAME
    })
    return
  }

  await chatStore.switchSession(item.id, item.matched_message_id != undefined ? String(item.matched_message_id) : undefined)
  await router.push({
    name: SESSION_ROUTE_NAME,
    params: {
      sessionId: item.id
    }
  })
}

async function handleKeydown(evt: KeyboardEvent) {
  if (!visible.value) return
  switch (evt.key) {
    case 'ArrowDown': {
      evt.preventDefault()
      moveSelection(1)
      break
    }
    case 'ArrowUp': {
      evt.preventDefault()
      moveSelection(-1)
      break
    }
    case 'Enter': {
      evt.preventDefault()
      const item = items.value[activeIndex.value]
      if (item) {
        openItem(item)
      }
      break
    }
    case 'Escape': {
      evt.preventDefault()
      closeModal()
      break
    }
  }
}

function moveSelection(delta: 1 | -1) {
  activeIndex.value = (activeIndex.value + delta + items.value.length) % items.value.length
  itemsRef.value?.[activeIndex.value]?.scrollIntoView({ block: 'nearest' })
}

</script>

<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    title="搜索会话"
    style="width: min(760px, calc(100vw - 24px))"
  >
    <div class="session-search">
      <n-flex class="search-header" vertical>
        <n-h6 class="search-title">按标题或消息内容搜索</n-h6>
        <n-p class="search-scope" depth="2">搜索范围：仅 Web UI 本地会话库；不包含只读 Hermes 历史会话。</n-p>
        <n-input
          v-model:value="query"
          clearable
          ref="inputRef"
          placeholder="搜索会话"
          @input="handleSearch"
        />
      </n-flex>
      <div class="search-body">
        <n-spin :show="loading">
          <div v-if="items?.length" class="result-list">
            <button
              v-for="(item, idx) of items"
              :key="item.id"
              :class="{active: activeIndex === idx}"
              ref="itemsRef"
              class="result-item"
              @click="openItem(item)"
            >
              <div class="result-main">
                <div class="result-title-row ">
                  <p class="result-title">
                    <n-ellipsis>
                      {{ item.title }}
                    </n-ellipsis>
                  </p>
                  <span class="result-source">{{ formatSource(item.source) }}</span>
                </div>
                <div class="result-snippet">
                  <n-ellipsis line-clamp="2">
                    {{ hasQuery ? item.snippet || '没有可显示的摘要' : item.preview || '最近会话' }}
                  </n-ellipsis>
                </div>
              </div>

              <div class="result-meta">
                <span>{{ formatTime(item.last_active || item.started_at) }}</span>
                <span v-if="hasQuery && item.matched_message_id != null" class="result-match">#{{ item.matched_message_id }}</span>
              </div>
            </button>
          </div>

          <n-empty v-else />
        </n-spin>
      </div>
    </div>

    <template #action>
      <n-flex justify="space-between" align="center">
        <n-text>Enter 打开 · Esc 关闭</n-text>
        <n-button quaternary size="small" @click="closeModal">取消</n-button>
      </n-flex>
    </template>
  </n-modal>
</template>

<style scoped lang="less">
.session-search {
  gap: 14px;

  .search-header {
    .search-title {
      font-size: 14px;
      margin: 0;
    }

    .search-scope {
      margin: 10px 0;
    }
  }

  .search-body {
    margin-top: 10px;
    height: min(60vh, 540px);
    overflow: auto;

    .result-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      height: 100%;

      .result-item {
        width: 100%;
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 12px;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        background-color: var(--bg-card);
        color: var(--text-primary);
        text-align: left;
        cursor: pointer;

        &:hover, &.active {
          background-color: rgba(var(--accent-primary-rgb), 0.08);
          border-color: var(--accent-muted);
        }

        .result-main {
          flex: 1;
          min-width: 0;

          .result-title-row {
            display: flex;
            align-items: center;
            gap: 10px;

            .result-title {
              font-size: 13px;
              font-weight: 600;
              overflow: hidden;
            }

            .result-source {
              flex-shrink: 0;
              font-size: 11px;
              color: var(--text-muted);
            }
          }

          .result-snippet {
            padding-top: 10px;
            color: var(--text-secondary);
            line-height: 1.5;
            overflow: hidden;
          }
        }

        .result-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
          font-size: 11px;
          color: var(--text-muted);
          flex-shrink: 0;

          .result-match {
            font-family: var(--font-code);
          }
        }
      }
    }
  }
}
</style>
