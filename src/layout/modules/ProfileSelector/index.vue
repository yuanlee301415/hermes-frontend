<!--
Todo:
- [ ] 会话列表用户图像更新
- [ ] 消息列表用户图像更新
-->
<script lang="ts">
import {formatSize} from '@/utils/format.ts'
import { bridgeStatusText, gatewayStatusText, randomSeed } from './shared.ts'
const ACCEPTS = ['image/png', 'image/jpeg', 'image/webp']
const LIMIT_SIZE = 1024 ** 2 // 1MB
</script>

<script setup lang="ts">
import { useProfilesStore } from '@/store/modules/profiles.ts'
import { useAppStore } from '@/store/modules/app.ts'
import { type ProfileRuntimeStatus, fetchProfileRuntimeStatusesWithMeta } from '@/api/profiles.ts'
import ProfileAvatarView from '../ProfileAvatar/index.vue'
import type { Profile, ProfileAvatar } from '@/models/Profile.ts'
import type {UploadCustomRequestOptions } from 'naive-ui'

defineOptions({name: 'ProfileSelector'})

const appStore = useAppStore()
const profilesStore = useProfilesStore()

// 用户配置弹窗
const profileModal = reactive<{
  visible: boolean
  runtimeLoading: boolean
  runtimeStatuses: ProfileRuntimeStatus[]
}>({
    visible: false,
    runtimeLoading: false,
    runtimeStatuses: []
  }
)

// 用户头像弹窗
const avatarModal = reactive<{
  visible: boolean
  profile: Profile | null
  saving: boolean
}>({
  visible: false,
  profile: null,
  saving: false
})

let runtimeRefreshToken = 0

const displayName = computed(() => profilesStore.activeProfileName ?? '')
const activeProfile = computed(() => profilesStore.profiles.find(_ => _.name === displayName.value))
const statusByProfile = computed(() => new Map(profileModal.runtimeStatuses.map(status => [status.profile, status])))

onMounted(() => {
  !profilesStore.profiles.length && profilesStore.fetchProfiles()
})

// 获取运行状态
async function loadRuntimeStatuses(options: {background?: boolean} = {}): Promise<boolean> {
  const token = ++runtimeRefreshToken
  if (!options.background) {
    profileModal.runtimeLoading = profileModal.runtimeStatuses.length === 0
  }

  try {
    const res = await fetchProfileRuntimeStatusesWithMeta({refresh: !options.background})
    if (token !== runtimeRefreshToken) return false
    profileModal.runtimeStatuses = res.profiles
    return !!res.refreshing
  } catch (e) {
    console.error(e)
    profileModal.runtimeStatuses = []
    return false
  } finally {
    if (token === runtimeRefreshToken) {
      profileModal.runtimeLoading = false
    }
  }
}

// 轮询用户配置列表
function scheduleRuntimeStatusPoll(attempt = 0) {
  if (attempt >= 12) return
  setTimeout(() => {
    if (!profileModal.visible) return
    void loadRuntimeStatuses({background: true}).then(refreshing => {
      if (refreshing) {
        scheduleRuntimeStatusPoll(attempt + 1)
      }
    })
  }, attempt === 0 ? 700 : 1200)
}

// 打开用户配置弹窗
function handleOpenProfileModal() {
  profileModal.visible = true
  void loadRuntimeStatuses().then(refreshing => {
    if (refreshing) {
      scheduleRuntimeStatusPoll()
    }
  })
}

// 打开用户头像设置弹窗
function handleOpenAvatarModal(profile: Profile) {
  avatarModal.visible = true
  avatarModal.profile = profile
}

// 上传用户头像
async function handleUploadAvatar({ file, onError, onFinish }: UploadCustomRequestOptions) {
  if (!(file && file.file)) return
  if (!ACCEPTS.includes(file.file.type)) {
    onError()
    window.$dialog?.warning({ title: '图片格式不支持', content: `请选择 PNG、JPEG 或 WebP 图片` })
    return
  }
  if (file.file!.size > LIMIT_SIZE) {
    onError()
    window.$dialog?.warning({ title: '图片过大', content: `头像图片不能超过 ${formatSize(LIMIT_SIZE)}` })
    return
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'))
    reader.readAsDataURL(file.file!)
  })

  const ok = await saveAvatar({ type: 'image', dataUrl })
  ok ? onFinish() : onError()
}

// 保存用户头像
async function saveAvatar(avatar: ProfileAvatar) {
  if (!avatarModal.profile) return
  avatarModal.saving = true
  try {
    await profilesStore.updateAvatar(avatarModal.profile.name, avatar)
    window.$message?.success('头像已保存')
    avatarModal.visible = false
    avatarModal.profile = null
    return true
  } catch (e) {
    console.error(e)
    window.$message?.error((e as Error).message || '保存头像失败')
    return false
  } finally {
    avatarModal.saving = false
  }
}

// 随机生成头像
async function handleRandomAvatar() {
  await saveAvatar({ type: 'generated', seed: randomSeed() })
}

// 恢复默认头像
async function handleResetAvatar() {
  if (!avatarModal.profile) return
  avatarModal.saving = true
  try {
    await profilesStore.deleteAvatar(avatarModal.profile.name)
    window.$message?.success('已恢复默认头像')
    avatarModal.visible = false
  } catch (e) {
    console.error(e)
    window.$message?.error((e as Error).message || '恢复默认头像失败')
  } finally {
    avatarModal.saving = false
  }
}
</script>

<template>
  <div class="profile-selector">
    <n-p v-show="!appStore.sidebarCollapsed">用户</n-p>

    <n-button :bordered="!appStore.sidebarCollapsed" ghost strong class="w-full" style="justify-content: start;" @click="handleOpenProfileModal">
      <template #icon>
        <n-icon :size="24">
          <ProfileAvatarView :name="displayName" :avatar="activeProfile?.avatar" :size="24" />
        </n-icon>
      </template>
      <n-text v-show="!appStore.sidebarCollapsed" style="text-indent: 8px;">{{ displayName }}</n-text>
    </n-button>

    <n-modal
      v-model:show="profileModal.visible"
      :bordered="false"
      :style="{width: '720px', maxWidth: 'calc(100vw - 32px)'}"
      preset="card"
    >
      <template #header>
        <n-h5 style="margin: 0">用户</n-h5>
        <n-p depth="3" style="margin: 0">当前：{{ displayName }}</n-p>
      </template>
      <n-spin :show="profileModal.runtimeLoading">
        <n-flex class="profile-runtime-list" :size="8" vertical>
          <n-thing
            v-for="profile of profilesStore.profiles"
            :key="profile.name"
            :class="{active: profile.name === displayName}"
            content-indented
            class="profile-runtime-item w-full"
          >
            <template #avatar>
              <ProfileAvatarView :name="profile.name" :avatar="profile.avatar" :size="34"/>
            </template>
            <n-p style="margin-bottom: 5px;">
              <n-text strong>{{ profile.name }}</n-text>
              <n-text v-if="profile.name === displayName" type="success" style="padding-left: 10px">当前</n-text>
            </n-p>
            <n-flex justify="space-between">
              <n-text depth="2">桥接状态</n-text>
              <n-flex align="center">
                <span :class="{running: statusByProfile.get(profile.name)?.bridge.running}" class="runtime-dot"></span>
                <n-text>{{ bridgeStatusText(statusByProfile.get(profile.name)?.bridge.running) }}</n-text></n-flex>
            </n-flex>
            <n-flex justify="space-between">
              <n-text depth="2">网关</n-text>
              <n-flex align="center">
                <span :class="{active: statusByProfile.get(profile.name)?.gateway.running}" class="runtime-dot running"></span>
                <n-text type="success">{{ gatewayStatusText(statusByProfile.get(profile.name)?.gateway.running) }}</n-text>
              </n-flex>
            </n-flex>
            <template #action>
              <n-flex justify="end" :size="10">
                <n-button type="primary" size="small" @click="handleOpenAvatarModal(profile)">头像</n-button>
                <n-button type="primary" size="small">重启网关</n-button>
                <n-button type="primary" size="small">重启配置</n-button>
                <n-button type="primary" size="small" v-if="profile.name !== displayName">切换前端配置</n-button>
              </n-flex>
            </template>
          </n-thing>
        </n-flex>
      </n-spin>
    </n-modal>

    <!--自定义用户头像-->
    <n-modal v-model:show="avatarModal.visible" title="自定义用户头像" preset="card" style="width:420px;max-width: calc(100vw - 32px);">
      <n-flex v-if="avatarModal.profile" vertical size="medium" align="center">
        <ProfileAvatarView :name="avatarModal.profile.name" :avatar="avatarModal.profile.avatar" :size="72"/>
        <n-text>{{ avatarModal.profile.name }}</n-text>
        <n-text depth="2">支持 PNG、JPEG、WebP，最大 1MB</n-text>
        <n-flex size="small">
          <n-upload abstract :accept="ACCEPTS.join(',')" :custom-request="handleUploadAvatar">
            <n-upload-trigger  abstract #="{ handleClick }">
              <n-button type="primary" size="small" @click="handleClick">上传图片</n-button>
            </n-upload-trigger>
          </n-upload>
          <n-button type="primary" size="small" @click="handleRandomAvatar">随机生成</n-button>
          <n-button type="primary" size="small" @click="handleResetAvatar">恢复默认</n-button>
        </n-flex>
      </n-flex>
    </n-modal>
    <!--自定义用户头像 End-->
  </div>
</template>

<style scoped lang="less">
.profile-runtime-list {
  max-height: 420px;
  min-height: 96px;
  overflow-y: auto;

  .profile-runtime-item {
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background-color: var(--bg-card);
    padding: 10px;

    &.active {
      border-color: var(--accent-muted);
      background-color: var(--bg-card-hover);
    }

    .runtime-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--text-muted);
      &.running {
        background: var(--success);
      }
    }
  }
}

</style>
