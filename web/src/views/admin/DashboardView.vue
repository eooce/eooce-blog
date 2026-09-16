<script setup lang="ts">
import { onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { adminApi } from '@/api'
import type { AdminStats } from '@/types'

const stats = ref<AdminStats | null>(null)
const loading = ref(true)

const cards = [
  { key: 'posts.total', label: '文章总数', accent: 'from-brand-500 to-brand-400' },
  { key: 'posts.published', label: '已发布', accent: 'from-emerald-500 to-teal-500' },
  { key: 'posts.drafts', label: '草稿箱', accent: 'from-amber-500 to-accent-500' },
  { key: 'comments.total', label: '评论总数', accent: 'from-sky-500 to-cyan-500' },
  { key: 'comments.pending', label: '待审核评论', accent: 'from-accent-500 to-accent-400' },
  { key: 'views', label: '总浏览量', accent: 'from-teal-500 to-brand-400' },
] as const

function pick(path: (typeof cards)[number]['key'], s: AdminStats): number {
  const [a, b] = path.split('.')
  if (a === 'views') return s.views
  return (s as unknown as Record<string, Record<string, number>>)[a][b]
}

function maxOf(list: Array<{ count: number }>): number {
  return Math.max(1, ...list.map((i) => i.count))
}

onMounted(async () => {
  try {
    stats.value = await adminApi.stats()
  } finally {
    loading.value = false
  }
})

const today = dayjs().format('M月D日')
</script>

<template>
  <div>
    <header class="mb-8 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-black tracking-tight text-slate-900 dark:text-white">仪表盘</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">今天是 {{ today }}，博客运营状况一切尽在掌握</p>
      </div>
      <router-link to="/home/posts/new" class="btn-primary">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" stroke-linecap="round" />
        </svg>
        写文章
      </router-link>
    </header>

    <div v-if="loading" class="grid grid-cols-2 gap-4 lg:grid-cols-3">
      <div v-for="i in 6" :key="i" class="card h-28 animate-pulse bg-slate-100 dark:bg-slate-800" />
    </div>

    <template v-else-if="stats">
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div v-for="card in cards" :key="card.key" class="card p-5">
          <div class="flex items-center justify-between">
            <p class="text-sm text-slate-500 dark:text-slate-400">{{ card.label }}</p>
            <span :class="`h-2.5 w-2.5 rounded-full bg-gradient-to-br ${card.accent}`" />
          </div>
          <p class="mt-3 text-3xl font-black tabular-nums text-slate-900 dark:text-white">
            {{ pick(card.key, stats) }}
          </p>
          <router-link
            v-if="card.key === 'comments.pending' && stats.comments.pending > 0"
            to="/home/comments?status=pending"
            class="mt-1 inline-block text-xs font-medium text-rose-500 hover:underline"
          >
            去审核 →
          </router-link>
        </div>
      </div>

      <div class="mt-8 grid gap-6 lg:grid-cols-2">
        <div class="card p-6">
          <h2 class="mb-5 text-base font-bold text-slate-900 dark:text-white">近 7 天新增文章</h2>
          <div class="flex h-40 items-end gap-3">
            <div v-for="item in stats.trend.posts" :key="item.date" class="flex flex-1 flex-col items-center gap-2">
              <div class="flex h-32 w-full items-end">
                <div
                  class="w-full rounded-t-lg bg-gradient-to-t from-brand-500 to-accent-400 transition-all"
                  :style="{ height: `${(item.count / maxOf(stats.trend.posts)) * 100}%`, minHeight: '4px' }"
                  :title="`${item.count} 篇`"
                />
              </div>
              <span class="text-[11px] text-slate-400">{{ item.date.slice(8) }}</span>
            </div>
          </div>
        </div>
        <div class="card p-6">
          <h2 class="mb-5 text-base font-bold text-slate-900 dark:text-white">近 7 天新增评论</h2>
          <div class="flex h-40 items-end gap-3">
            <div v-for="item in stats.trend.comments" :key="item.date" class="flex flex-1 flex-col items-center gap-2">
              <div class="flex h-32 w-full items-end">
                <div
                  class="w-full rounded-t-lg bg-gradient-to-t from-cyan-500 to-sky-400 transition-all"
                  :style="{ height: `${(item.count / maxOf(stats.trend.comments)) * 100}%`, minHeight: '4px' }"
                  :title="`${item.count} 条`"
                />
              </div>
              <span class="text-[11px] text-slate-400">{{ item.date.slice(8) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
