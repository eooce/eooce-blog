<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authApi } from '@/api'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const captchaCode = ref('')
const captchaId = ref('')
const captchaSvg = ref('')
const loading = ref(false)
const error = ref('')

async function loadCaptcha() {
  try {
    const data = await authApi.captcha()
    captchaId.value = data.id
    captchaSvg.value = data.svg
  } catch {
    captchaSvg.value = ''
  }
}

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const data = await authApi.login({
      username: username.value.trim(),
      password: password.value,
      captcha_id: captchaId.value,
      captcha_code: captchaCode.value.trim(),
    })
    auth.setSession(data.token, data.username)
    const redirect = (route.query.redirect as string) || '/home'
    router.push(redirect)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败，请重试'
    // 验证码一次性：任何失败后都换新码并清空输入
    captchaCode.value = ''
    await loadCaptcha()
  } finally {
    loading.value = false
  }
}

onMounted(loadCaptcha)
</script>

<template>
  <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
    <div class="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-600/25 blur-3xl" />
    <div class="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent-600/20 blur-3xl" />

    <div class="relative w-full max-w-md">
      <div class="mb-8 text-center">
        <img src="/favicon.ico" alt="logo" class="mx-auto h-14 w-14 rounded-2xl shadow-lift" />
        <h1 class="mt-4 text-2xl font-black text-white">后台管理</h1>
        <p class="mt-1 text-sm text-slate-400">登录以管理你的博客内容</p>
      </div>

      <form class="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-lift backdrop-blur" @submit.prevent="submit">
        <div class="space-y-4">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-300" for="username">用户名</label>
            <input
              id="username"
              v-model="username"
              type="text"
              autocomplete="username"
              required
              placeholder="请输入用户名"
              class="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-300" for="password">密码</label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
              placeholder="请输入密码"
              class="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-300" for="captcha">验证码</label>
            <div class="flex items-stretch gap-2.5">
              <input
                id="captcha"
                v-model="captchaCode"
                type="text"
                required
                maxlength="4"
                autocomplete="off"
                placeholder="不区分大小写"
                class="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
              <button
                type="button"
                class="shrink-0 overflow-hidden rounded-xl border border-slate-700 transition-opacity hover:opacity-80"
                title="看不清？点击刷新验证码"
                aria-label="刷新验证码"
                @click="loadCaptcha"
              >
                <span v-if="captchaSvg" class="block [&>svg]:block" v-html="captchaSvg" />
                <span v-else class="flex h-full w-[120px] items-center justify-center bg-slate-800 text-xs text-slate-500">
                  加载中...
                </span>
              </button>
            </div>
            <p class="mt-1 text-xs text-slate-500">不区分大小写，看不清点击图片刷新</p>
          </div>
        </div>

        <p v-if="error" class="mt-4 rounded-xl bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-400">{{ error }}</p>

        <button type="submit" class="btn-primary mt-6 w-full !py-2.5" :disabled="loading">
          {{ loading ? '登录中...' : '登 录' }}
        </button>

        <p class="mt-5 text-center text-xs text-slate-500">
          默认账号 admin / admin123，登录后请及时修改
        </p>
      </form>

      <p class="mt-6 text-center text-sm">
        <router-link to="/" class="text-slate-400 transition-colors hover:text-brand-400">← 返回博客首页</router-link>
      </p>
    </div>
  </div>
</template>
