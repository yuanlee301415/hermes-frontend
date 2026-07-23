<!--
登录
-->
<script lang="ts">
const TITLE = import.meta.env.VITE_APP_TITLE
</script>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { setApiKey } from '@/api/client.ts'
import { loginWithPassword } from '@/api/auth.ts'
import { CHAT_ROUTE_NAME } from '@/router/routes/modules/chat.ts'

const router = useRouter()
const username = ref('admin')
const password = ref('123456')
const errorMsg = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!username.value.trim().length || !password.value.length) {
    errorMsg.value = '请输入用户名和密码'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await loginWithPassword(username.value, password.value)
    setApiKey(res.token)
    router.push({ name: CHAT_ROUTE_NAME })
  } catch (e: unknown) {
    errorMsg.value = (e as Error)?.message ?? '用户名或密码错误'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-view flex-center">
    <div class="login-card">

      <div class="logo">
        <img src="@/assets/logo.png" alt="Hermes" width="80" height="80">
      </div>

      <n-h1>{{ TITLE }}</n-h1>
      <n-p depth="3">输入用户名和密码以继续。</n-p>
      <n-p depth="2">默认登录名：admin，默认密码：123456</n-p>

      <div class="login-form">
        <n-input v-model:value="username" maxlength="20" placeholder="请输入用户名" />
        <n-input v-model:value="password" type="password" maxlength="20" placeholder="请输入密码" />
        <n-text v-show="errorMsg" type="error">{{ errorMsg }}</n-text>
        <n-button secondary class="w-full" :loading="loading" @click="handleLogin">登录</n-button>
      </div>

    </div>
  </div>
</template>

<style scoped lang="less">
.login-view {
  height: 100vh;
  background-color: var(--bg-primary);

  .login-card {
    width: 480px;
    max-width: calc(100% - 32px);
    padding: 50px;
    border: 1px solid var(--border-color);
    border-radius: 15px;
    background-color: var(--bg-card);
    text-align: center;

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 10px 0;
      padding-top: 10px;
      text-align: left;
    }
  }
}
</style>
