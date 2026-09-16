<script setup lang="ts">
import { onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { publicApi } from '@/api'
import type { PostItem } from '@/types'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'

interface ArchiveGroup {
  month: string
  posts: PostItem[]
}

const groups = ref<ArchiveGroup[]>([])
const total = ref(0)
const loading = ref(true)

onMounted(async () => {
  try {
    const data = await publicApi.archives()
    groups.value = data.groups
    total.value = data.total
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="container-page py-10">
    <PageHeader title="归档" eyebrow="Archives">
      <template #description>
        一路走来，共写下 <span class="font-semibold text-brand-500">{{ total }}</span> 篇文章
      </template>
    </PageHeader>

    <div v-if="loading" class="space-y-8">
      <div v-for="i in 3" :key="i" class="card h-40 animate-pulse bg-slate-100 dark:bg-slate-800" />
    </div>

    <EmptyState v-else-if="!groups.length" title="暂无归档" />

    <div
      v-else
      class="relative space-y-10 pl-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-gradient-to-b before:from-brand-400 before:via-accent-400/60 before:to-transparent"
    >
      <section v-for="(group, gi) in groups" :key="group.month" v-reveal="Math.min(gi * 80, 320)">
        <h2 class="relative -ml-6 mb-4 inline-flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
          <span class="relative flex h-3.5 w-3.5">
            <span class="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-brand-400" />
            <span class="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-brand-500 bg-white dark:bg-slate-950" />
          </span>
          {{ group.month }}
          <span class="text-xs font-normal text-slate-400">{{ group.posts.length }} 篇</span>
        </h2>
        <ul class="space-y-1">
          <li v-for="post in group.posts" :key="post.slug">
            <router-link
              :to="`/post/${post.slug}`"
              class="group flex items-center justify-between gap-4 rounded-xl px-4 py-3 transition-all duration-300 hover:translate-x-1.5 hover:bg-white hover:shadow-soft dark:hover:bg-slate-900"
            >
              <div class="flex min-w-0 items-center gap-3">
                <span class="shrink-0 text-xs tabular-nums text-slate-400">
                  {{ dayjs(post.published_at).format('MM-DD') }}
                </span>
                <span class="truncate text-sm font-medium text-slate-700 group-hover:text-brand-600 dark:text-slate-300 dark:group-hover:text-brand-400">
                  {{ post.title }}
                </span>
              </div>
              <span class="flex shrink-0 items-center gap-1.5 text-xs text-slate-400">
                {{ post.views }} 阅读
                <svg
                  class="h-3 w-3 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M5 12h14m0 0-6-6m6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
            </router-link>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
