<script setup lang="ts">
import { useSiteStore } from '@/stores/site'
const site = useSiteStore()
</script>

<template>
  <div class="container-page flex flex-col items-center justify-center py-24 text-center">
    <div v-reveal class="relative">
      <span
        class="absolute -inset-10 animate-spin-slow rounded-full border-2 border-dashed border-brand-200/80 dark:border-brand-500/20"
        aria-hidden="true"
      />
      <span
        class="absolute -inset-10 rounded-full bg-gradient-to-br from-brand-100/60 via-transparent to-accent-100/60 blur-xl dark:from-brand-500/10 dark:to-accent-500/10"
        aria-hidden="true"
      />
      <p class="gradient-text-animated animate-float-y relative text-8xl font-black">404</p>
    </div>
    <h1 v-reveal="100" class="mt-6 text-xl font-bold text-slate-800 dark:text-slate-200">页面迷路了</h1>
    <p v-reveal="160" class="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
      你访问的页面在 {{ site.info.site_title }} 中并不存在，可能已被移动或删除。
    </p>
    <div v-reveal="220" class="mt-6 flex gap-3">
      <router-link to="/" class="btn-primary">返回首页</router-link>
      <router-link to="/archives" class="btn-outline">浏览归档</router-link>
    </div>
  </div>
</template>
