<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useSiteStore } from '@/stores/site'

const auth = useAuthStore()
const theme = useThemeStore()
const site = useSiteStore()
const router = useRouter()

const navs = [
  { label: '仪表盘', to: '/home', icon: 'M3 12l9-8 9 8M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10' },
  { label: '菜单管理', to: '/home/menus', icon: 'M4 6h16M4 12h10M17 12h3M14 18h6M4 18h6' },
  { label: '文章管理', to: '/home/posts', icon: 'M4 6h16M4 12h16M4 18h10' },
  { label: '分类管理', to: '/home/categories', icon: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z' },
  { label: '标签管理', to: '/home/tags', icon: 'M7 7h.01M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6Z' },
  { label: '评论管理', to: '/home/comments', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z' },
  { label: '友情链接', to: '/home/links', icon: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7' },
  { label: '站点设置', to: '/home/settings', icon: 'M10.3 4.3a1.7 1.7 0 0 1 3.4 0 1.7 1.7 0 0 0 2.6 1.5 1.7 1.7 0 0 1 2.4 2.4 1.7 1.7 0 0 0 1.5 2.6 1.7 1.7 0 0 1 0 3.4 1.7 1.7 0 0 0-1.5 2.6 1.7 1.7 0 0 1-2.4 2.4 1.7 1.7 0 0 0-2.6 1.5 1.7 1.7 0 0 1-3.4 0 1.7 1.7 0 0 0-2.6-1.5 1.7 1.7 0 0 1-2.4-2.4 1.7 1.7 0 0 0-1.5-2.6 1.7 1.7 0 0 1 0-3.4 1.7 1.7 0 0 0 1.5-2.6 1.7 1.7 0 0 1 2.4-2.4 1.7 1.7 0 0 0 2.6-1.5ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' },
]

onMounted(() => {
  site.fetch()
})

function logout() {
  auth.logout()
  router.push('/home/login')
}

/** 新标签页打开博客首页（基于当前访问域名） */
function openPreview() {
  window.open(`${window.location.origin}/`, '_blank', 'noopener')
}
</script>

<template>
  <div class="flex min-h-screen bg-slate-50 dark:bg-slate-950">
    <aside class="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex dark:border-slate-800 dark:bg-slate-900">
      <div class="flex h-16 items-center gap-2.5 border-b border-slate-100 px-6 dark:border-slate-800">
        <img :src="site.info.site_logo || '/favicon.ico'" alt="logo" class="h-8 w-8 rounded-lg object-contain" />
        <span class="font-bold text-slate-900 dark:text-white">博客后台</span>
      </div>
      <nav class="flex-1 space-y-1 p-4">
        <router-link
          v-for="nav in navs"
          :key="nav.to"
          :to="nav.to"
          class="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-brand-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-brand-400"
          exact-active-class="!bg-brand-600 !text-white hover:!text-white dark:!bg-brand-600"
        >
          <svg class="h-4.5 w-4.5 h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path :d="nav.icon" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ nav.label }}
        </router-link>
      </nav>
      <div class="border-t border-slate-100 p-4 dark:border-slate-800">
        <div class="flex items-center gap-3 rounded-xl px-2 py-2">
          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-bold text-white">
            {{ auth.username.slice(0, 1).toUpperCase() }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{{ auth.username }}</p>
            <p class="text-xs text-slate-400">管理员</p>
          </div>
        </div>
        <div class="mt-2 flex gap-2">
          <router-link to="/" class="btn-ghost flex-1 text-xs">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M10 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5m7 9 4-4-4-4m4 4H9" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            前台
          </router-link>
          <button class="btn-ghost flex-1 text-xs text-rose-500 hover:!bg-rose-50 dark:hover:!bg-rose-500/10" @click="logout">退出</button>
        </div>
      </div>
    </aside>

    <div class="flex min-h-screen w-full flex-col lg:pl-60">
      <header class="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-xl sm:px-8 dark:border-slate-800 dark:bg-slate-900/80">
        <div class="flex items-center gap-2 lg:hidden">
          <img :src="site.info.site_logo || '/favicon.ico'" alt="logo" class="h-7 w-7 rounded-lg object-contain" />
          <span class="font-bold text-slate-900 dark:text-white">博客后台</span>
        </div>
        <div class="hidden text-sm text-slate-400 lg:block">
          <router-link to="/home" class="hover:text-brand-500">后台</router-link>
          <span class="mx-2">/</span>
          <span class="text-slate-600 dark:text-slate-300">{{ $route.meta.title ?? $route.name }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-ghost h-9 w-9 rounded-xl p-0" title="预览博客首页" @click="openPreview">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <rect x="2.5" y="4" width="19" height="13" rx="2" />
              <path d="M8 21h8m-4-4v4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button class="btn-ghost h-9 w-9 rounded-xl p-0" @click="theme.toggle()" title="切换主题">
            <svg v-if="theme.theme === 'dark'" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" stroke-linecap="round" />
            </svg>
            <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button class="btn-ghost h-9 w-9 rounded-xl p-0 lg:hidden" title="退出登录" @click="logout">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M10 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5m7 9 4-4-4-4m4 4H9" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
      </header>

      <main class="flex-1 p-4 sm:p-8">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>

      <nav class="sticky bottom-0 z-20 flex border-t border-slate-200 bg-white/90 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
        <router-link
          v-for="nav in navs"
          :key="nav.to"
          :to="nav.to"
          class="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] text-slate-500 dark:text-slate-400"
          exact-active-class="!text-brand-600 dark:!text-brand-400"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path :d="nav.icon" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ nav.label }}
        </router-link>
      </nav>
    </div>
  </div>
</template>
